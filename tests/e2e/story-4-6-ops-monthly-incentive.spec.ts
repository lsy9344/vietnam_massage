import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { employeeRow, openEmployeePanel } from "./support/settlement";


type SeededData = {
  writableOperatingMonthId: string;
  lockedOperatingMonthId: string;
  missingPolicyOperatingMonthId: string;
  belowThresholdOperatingMonthId: string;
};

let seededData: SeededData;


async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive: true },
    create: { staffCode, displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive: true }
  });
}

async function seedAuthAccount(input: { accountId: string; password: string; role: string; employeeId: string }) {
  const passwordHash = await hash(input.password, argon2idOptions);
  return (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: {
      email: `${input.accountId}@example.local`,
      passwordHash,
      role: input.role,
      employeeId: input.employeeId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: `${input.accountId}@example.local`,
      accountId: input.accountId,
      passwordHash,
      role: input.role,
      employeeId: input.employeeId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function upsertCoursePolicy(courseId: string, effectiveFromMonth: string, name: string) {
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth } });
  const data = {
    name,
    durationMinutes: 60,
    basePrice: 1500000,
    requiresSecondTherapist: false,
    tvDisplayName: name,
    effectiveToMonth: null,
    isActive: true
  };
  if (existing) return (prisma as any).coursePolicy.update({ where: { id: existing.id }, data });
  return (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth, ...data } });
}

async function upsertRate(therapistId: string, courseId: string, effectiveFromMonth: string, amount: number) {
  const existing = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId, courseId, effectiveFromMonth } });
  const data = { amount, effectiveToMonth: null, isActive: true };
  if (existing) return (prisma as any).therapistCourseRate.update({ where: { id: existing.id }, data });
  return (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth, ...data } });
}

async function upsertMonthlyRule(thresholdCallCount: number, totalAmount: number, effectiveFromMonth: string) {
  const existing = await (prisma as any).opsMonthlyIncentiveRule.findFirst({ where: { thresholdCallCount, effectiveFromMonth } });
  const data = {
    totalAmount,
    leadShare: 0.3,
    counterTeamShare: 0.35,
    waiterTeamShare: 0.35,
    // 인센 규칙은 시드한 달로 한정한다. effectiveToMonth를 비워 두면 다른 스펙의 운영월까지 적용돼
    // 지급액이 서로 오염된다.
    effectiveToMonth: effectiveFromMonth,
    isActive: true
  };
  if (existing) return (prisma as any).opsMonthlyIncentiveRule.update({ where: { id: existing.id }, data });
  return (prisma as any).opsMonthlyIncentiveRule.create({ data: { thresholdCallCount, effectiveFromMonth, ...data } });
}

async function cleanupStoryData(operatingMonthIds: string[]) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: { operatingMonthId: { in: operatingMonthIds }, customerMemo: { startsWith: "Story 4.6" } },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
  }
  // 지급 확인(ADR 0004, 티켓 31)은 운영월이 고정 monthKey로 upsert되므로, 재실행 때 이전 사건이 남지 않게 함께 정리한다.
  await (prisma as any).payoutConfirmationEvent.deleteMany({ where: { operatingMonthId: { in: operatingMonthIds } } });
}

async function createCall(input: {
  operatingMonthId: string;
  serviceDate: Date;
  roomId: string;
  courseId: string;
  memo: string;
  status: string;
  therapist1Id: string;
}) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: input.operatingMonthId,
      serviceDate: input.serviceDate,
      startTime: "17:00",
      roomId: input.roomId,
      courseId: input.courseId,
      customerMemo: input.memo,
      status: input.status,
      discountTypeCode: null,
      paymentMethodCode: "CASH",
      confirmationCode: null
    }
  });

  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapist1Id, isActive: true }
  });
}

async function seedStoryData(): Promise<SeededData> {
  const settlementEmployee = await seedEmployee("E2E46-AUTH-001", "E2E46 정산담당", "BACKOFFICE", "정산", 94600);
  const counterEmployee = await seedEmployee("E2E46-AUTH-002", "E2E46 카운터", "BACKOFFICE", "카운터", 94601);
  const waiterEmployee = await seedEmployee("E2E46-AUTH-003", "E2E46 웨이터계정", "BACKOFFICE", "웨이터", 94602);
  const readOnlyEmployee = await seedEmployee("E2E46-AUTH-004", "E2E46 조회전용", "BACKOFFICE", "조회", 94603);
  await seedAuthAccount({ accountId: "story46_settlement", password: "Story46!settlement", role: "settlement_manager", employeeId: settlementEmployee.id });
  await seedAuthAccount({ accountId: "story46_counter", password: "Story46!counter", role: "counter", employeeId: counterEmployee.id });
  await seedAuthAccount({ accountId: "story46_waiter", password: "Story46!waiter", role: "waiter", employeeId: waiterEmployee.id });
  await seedAuthAccount({ accountId: "story46_readonly", password: "Story46!readonly", role: "read_only_viewer", employeeId: readOnlyEmployee.id });

  await seedEmployee("E2E46-OPS-001", "E2E46 팀장", "OPERATIONS", "팀장", 94610);
  await seedEmployee("E2E46-OPS-002", "E2E46 카운터1", "OPERATIONS", "카운터", 94611);
  await seedEmployee("E2E46-OPS-003", "E2E46 카운터2", "OPERATIONS", "카운터", 94612);
  await seedEmployee("E2E46-OPS-004", "E2E46 웨이터1", "OPERATIONS", "웨이터", 94613);
  await seedEmployee("E2E46-OPS-005", "E2E46 웨이터2", "OPERATIONS", "웨이터", 94614);
  const therapist = await seedEmployee("E2E46-THR-001", "E2E46 마사지사", "THERAPIST", "마사지사", 94620);

  const writableOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2036-07" },
    update: { startDate: new Date("2036-07-01T00:00:00.000Z"), endDate: new Date("2036-07-31T00:00:00.000Z"), status: "검토중" },
    create: { monthKey: "2036-07", startDate: new Date("2036-07-01T00:00:00.000Z"), endDate: new Date("2036-07-31T00:00:00.000Z"), status: "검토중" }
  });
  const lockedOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2036-08" },
    update: { startDate: new Date("2036-08-01T00:00:00.000Z"), endDate: new Date("2036-08-31T00:00:00.000Z"), status: "잠금" },
    create: { monthKey: "2036-08", startDate: new Date("2036-08-01T00:00:00.000Z"), endDate: new Date("2036-08-31T00:00:00.000Z"), status: "잠금" }
  });
  const missingPolicyOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "1999-02" },
    update: { startDate: new Date("1999-02-01T00:00:00.000Z"), endDate: new Date("1999-02-28T00:00:00.000Z"), status: "작성중" },
    create: { monthKey: "1999-02", startDate: new Date("1999-02-01T00:00:00.000Z"), endDate: new Date("1999-02-28T00:00:00.000Z"), status: "작성중" }
  });
  const belowThresholdOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2036-09" },
    update: { startDate: new Date("2036-09-01T00:00:00.000Z"), endDate: new Date("2036-09-30T00:00:00.000Z"), status: "작성중" },
    create: { monthKey: "2036-09", startDate: new Date("2036-09-01T00:00:00.000Z"), endDate: new Date("2036-09-30T00:00:00.000Z"), status: "작성중" }
  });
  await cleanupStoryData([writableOperatingMonth.id, lockedOperatingMonth.id, missingPolicyOperatingMonth.id, belowThresholdOperatingMonth.id]);

  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 94601 },
    update: { displayName: "E2E46 호실", migrationReferenceName: "E2E46-ROOM", isActive: true },
    create: { displayName: "E2E46 호실", migrationReferenceName: "E2E46-ROOM", sortOrder: 94601, isActive: true }
  });
  await (prisma as any).timeSlot.upsert({
    where: { value: "17:00" },
    update: { sortOrder: 94601, isActive: true },
    create: { value: "17:00", sortOrder: 94601, isActive: true }
  });
  const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
  await upsertCoursePolicy(course.id, "2036-07", "Story46 A");
  await upsertCoursePolicy(course.id, "2036-08", "Story46 A locked");
  await upsertCoursePolicy(course.id, "2036-09", "Story46 A below threshold");
  await upsertCoursePolicy(course.id, "1999-02", "Story46 A missing monthly policy");
  await upsertRate(therapist.id, course.id, "2036-07", 700000);
  await upsertRate(therapist.id, course.id, "2036-08", 700000);
  await upsertRate(therapist.id, course.id, "2036-09", 700000);
  await upsertRate(therapist.id, course.id, "1999-02", 700000);
  // 운영팀 월 인센은 그달 방문완료 콜 수를 그대로 threshold와 비교한다.
  await upsertMonthlyRule(2, 3000000, "2036-07");
  await upsertMonthlyRule(3, 5000000, "2036-07");
  await upsertMonthlyRule(2, 3000000, "2036-08");
  await upsertMonthlyRule(3, 5000000, "2036-08");
  // 최저 구간 미달(2036-09) 시나리오도 규칙이 존재해야 "정책 없음"이 아니라 "최저 구간 미달"이 뜬다.
  await upsertMonthlyRule(2, 3000000, "2036-09");
  await upsertMonthlyRule(3, 5000000, "2036-09");

  // 최상위 구간(3콜 이상)에 닿으려면 그달 방문완료 콜이 실제로 3건 있어야 한다.
  for (const [index, serviceDate] of ["2036-07-10", "2036-07-12", "2036-07-13"].entries()) {
    await createCall({
      operatingMonthId: writableOperatingMonth.id,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      roomId: room.id,
      courseId: course.id,
      memo: `Story 4.6 complete writable ${index}`,
      status: "VISIT_COMPLETE",
      therapist1Id: therapist.id
    });
  }
  await createCall({
    operatingMonthId: writableOperatingMonth.id,
    serviceDate: new Date("2036-07-11T00:00:00.000Z"),
    roomId: room.id,
    courseId: course.id,
    memo: "Story 4.6 reserved warning",
    status: "예약",
    therapist1Id: therapist.id
  });
  await createCall({
    operatingMonthId: lockedOperatingMonth.id,
    serviceDate: new Date("2036-08-10T00:00:00.000Z"),
    roomId: room.id,
    courseId: course.id,
    memo: "Story 4.6 complete locked",
    status: "방문완료",
    therapist1Id: therapist.id
  });
  await createCall({
    operatingMonthId: missingPolicyOperatingMonth.id,
    serviceDate: new Date("1999-02-10T00:00:00.000Z"),
    roomId: room.id,
    courseId: course.id,
    memo: "Story 4.6 complete missing monthly policy",
    status: "방문완료",
    therapist1Id: therapist.id
  });
  await createCall({
    operatingMonthId: belowThresholdOperatingMonth.id,
    serviceDate: new Date("2036-09-10T00:00:00.000Z"),
    roomId: room.id,
    courseId: course.id,
    memo: "Story 4.6 complete below threshold",
    status: "VISIT_COMPLETE",
    therapist1Id: therapist.id
  });

  return {
    writableOperatingMonthId: writableOperatingMonth.id,
    lockedOperatingMonthId: lockedOperatingMonth.id,
    missingPolicyOperatingMonthId: missingPolicyOperatingMonth.id,
    belowThresholdOperatingMonthId: belowThresholdOperatingMonth.id
  };
}

test.describe("Story 4.6 operations monthly incentive", () => {
  test.beforeAll(async () => {
    seededData = await seedStoryData();
  });

  test.afterAll(async () => {
    // 이 스펙이 시드한 콜/출퇴근 데이터를 운영월 범위로 정리한 뒤 연결을 닫는다.
    await cleanupStoryData([
      seededData.writableOperatingMonthId,
      seededData.lockedOperatingMonthId,
      seededData.missingPolicyOperatingMonthId,
      seededData.belowThresholdOperatingMonthId
    ]);
    await prisma.$disconnect();
  });

  test("settlement manager previews monthly total, threshold, team split, employee distribution, and evidence", async ({ page }) => {
    await login(page, "story46_settlement", "Story46!settlement");
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.missingPolicyOperatingMonthId}`);
    await page.getByLabel("운영월").selectOption(seededData.writableOperatingMonthId);
    // 직원 이름도 버튼이라("조회 전용" 직원 등) 조회 버튼은 이름이 정확히 같은 것으로 고른다.
    await page.getByRole("button", { name: "조회", exact: true }).click();

    await expect(page.getByRole("heading", { name: "운영팀 월인센" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`operatingMonthId=${seededData.writableOperatingMonthId}`));
    await expect(page.getByText("미확정 미리보기").first()).toBeVisible();
    // 같은 문구가 요약 카드와 직원 패널 양쪽에 나오므로 요약 카드 목록으로 좁힌다.
    const summary = page.getByLabel("운영팀 월 인센 요약");
    await expect(summary.getByText("월 총콜")).toBeVisible();
    await expect(summary.getByText("3콜 이상")).toBeVisible();
    await expect(summary.getByText("5,000,000 VND").first()).toBeVisible();
    await expect(page.getByText("분배율 30%").first()).toBeVisible();
    await expect(page.getByText("분배율 35%")).toHaveCount(2);
    await expect(page.getByText("E2E46 팀장").first()).toBeVisible();
    await expect(page.getByText("E2E46 카운터1").first()).toBeVisible();
    await expect(page.getByText("E2E46 웨이터1").first()).toBeVisible();
    await expect(page.getByText("제외 warning").first()).toBeVisible();
    await expect(page.getByText("비완료 1", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("월 총콜 산출 근거").first()).toBeVisible();
  });

  test("settlement manager can confirm payout, reconfirm, and release with a reason, reviewing actor history", async ({ page }) => {
    await login(page, "story46_settlement", "Story46!settlement");
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.writableOperatingMonthId}`);

    // 지급 확인(ADR 0004, 티켓 30·31)은 직원 패널에서 한다. 월 단위라 날짜가 없다. 표의 행에는 확인 상태만 보인다.
    const leadPanel = await openEmployeePanel(page, "E2E46 팀장");
    await expect(leadPanel).toContainText("미확인");
    await leadPanel.getByRole("button", { name: "지급 확인" }).click();

    await expect(leadPanel).toContainText("확인됨");
    await expect(leadPanel).toContainText("확인 이력 1건");
    await expect(leadPanel).toContainText("처리자: story46_settlement / E2E46 정산담당");
    await expect(employeeRow(page, "E2E46 팀장")).toContainText("확인됨");

    // 재확인은 사유가 필수다.
    await leadPanel.getByLabel("사유").first().fill("정책 정정으로 다시 확인");
    await leadPanel.getByRole("button", { name: "재확인" }).click();
    await expect(leadPanel).toContainText("확인 이력 2건");
    await expect(leadPanel).toContainText("정책 정정으로 다시 확인");

    // 해제도 사유가 필수고, 해제 뒤에는 미확인으로 돌아간다.
    await leadPanel.getByLabel("사유").last().fill("정산 오류로 확인 해제");
    await leadPanel.getByRole("button", { name: "확인 해제" }).click();
    await expect(leadPanel).toContainText("미확인");
    await expect(leadPanel).toContainText("확인 이력 3건");
    await expect(employeeRow(page, "E2E46 팀장")).toContainText("미확인");
  });

  test("shows below-threshold warning and zero monthly incentive", async ({ page }) => {
    await login(page, "story46_settlement", "Story46!settlement");
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.belowThresholdOperatingMonthId}`);

    await expect(page.getByText("최저 구간 미달").first()).toBeVisible();
    await expect(page.getByText("1콜").first()).toBeVisible();
    // 기준 미달의 0은 정책이 정한 결과라 근거 없음이 아니라 0이다. 라벨과 값은 요약 카드의 다른 칸이다.
    await expect(
      page.getByLabel("운영팀 월 인센 요약").locator("div", { has: page.getByText("전체 월인센", { exact: true }) })
    ).toContainText("0 VND");
    await expect(page.getByText("2콜 미만으로 운영팀 월 인센이 없습니다.").first()).toBeVisible();
  });

  test("shows missing monthly policy warning without assuming zero silently", async ({ page }) => {
    await login(page, "story46_settlement", "Story46!settlement");
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.missingPolicyOperatingMonthId}`);

    await expect(page.getByText("정책 없음").first()).toBeVisible();
    await expect(page.getByText("적용월에 활성 운영팀 월 인센 정책이 없습니다.").first()).toBeVisible();
    // 정책이 없으면 월 인센과 직원 금액은 0 대신 근거 없음이다(티켓 05).
    await expect(
      page.getByLabel("운영팀 월 인센 요약").locator("div", { has: page.getByText("전체 월인센", { exact: true }) })
    ).toContainText("계산 근거 없음");
  });

  test("separates locked month current preview from closing snapshot values", async ({ page }) => {
    await login(page, "story46_settlement", "Story46!settlement");
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.lockedOperatingMonthId}`);

    await expect(page.getByText("현재 기준 미리보기").first()).toBeVisible();
    await expect(page.getByText("확정값은 월마감 스냅샷 기준", { exact: false }).first()).toBeVisible();
  });

  test("counter cannot access monthly settlement preview", async ({ page }) => {
    await login(page, "story46_counter", "Story46!counter");
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.writableOperatingMonthId}`);
    await expect(page).toHaveURL(/\/calls/);
  });

  test("waiter cannot access monthly settlement preview", async ({ page }) => {
    await login(page, "story46_waiter", "Story46!waiter");
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.writableOperatingMonthId}`);
    await expect(page).toHaveURL(/\/rooms/);
  });

  test("read-only viewer cannot access monthly settlement preview", async ({ page }) => {
    await login(page, "story46_readonly", "Story46!readonly");
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.writableOperatingMonthId}`);
    await expect(page).toHaveURL(/\/rooms/);
  });
});
