import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vietnam_massage";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);
const argon2idOptions = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

type SeededData = {
  writableOperatingMonthId: string;
  lockedOperatingMonthId: string;
  missingPolicyOperatingMonthId: string;
  belowThresholdOperatingMonthId: string;
};

let seededData: SeededData;

async function login(page: Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(accountId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

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

async function upsertCoursePolicy(courseId: string, effectiveFromMonth: string, name: string, opsCallCredit: number) {
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth } });
  const data = {
    name,
    durationMinutes: 60,
    basePrice: 1500000,
    opsCallCredit,
    earcarePoolAmount: 0,
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
    effectiveToMonth: null,
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
  await upsertCoursePolicy(course.id, "2036-07", "Story46 A", 1100);
  await upsertCoursePolicy(course.id, "2036-08", "Story46 A locked", 1100);
  await upsertCoursePolicy(course.id, "2036-09", "Story46 A below threshold", 900);
  await upsertCoursePolicy(course.id, "1999-02", "Story46 A missing monthly policy", 1100);
  await upsertRate(therapist.id, course.id, "2036-07", 700000);
  await upsertRate(therapist.id, course.id, "2036-08", 700000);
  await upsertRate(therapist.id, course.id, "2036-09", 700000);
  await upsertRate(therapist.id, course.id, "1999-02", 700000);
  await upsertMonthlyRule(1000, 3000000, "2036-07");
  await upsertMonthlyRule(1100, 5000000, "2036-07");
  await upsertMonthlyRule(1000, 3000000, "2036-08");
  await upsertMonthlyRule(1100, 5000000, "2036-08");

  await createCall({
    operatingMonthId: writableOperatingMonth.id,
    serviceDate: new Date("2036-07-10T00:00:00.000Z"),
    roomId: room.id,
    courseId: course.id,
    memo: "Story 4.6 complete writable",
    status: "VISIT_COMPLETE",
    therapist1Id: therapist.id
  });
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
    await prisma.$disconnect();
  });

  test("settlement manager previews monthly total, threshold, team split, employee distribution, and evidence", async ({ page }) => {
    await login(page, "story46_settlement", "Story46!settlement");
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.missingPolicyOperatingMonthId}`);
    await page.getByLabel("운영월").selectOption(seededData.writableOperatingMonthId);
    await page.getByRole("button", { name: "조회" }).click();

    await expect(page.getByRole("heading", { name: "운영팀 월인센" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`operatingMonthId=${seededData.writableOperatingMonthId}`));
    await expect(page.getByText("미확정 미리보기")).toBeVisible();
    await expect(page.getByText("월 총콜")).toBeVisible();
    await expect(page.getByText("1100콜 이상")).toBeVisible();
    await expect(page.getByText("5,000,000 VND")).toBeVisible();
    await expect(page.getByText("분배율 30%")).toBeVisible();
    await expect(page.getByText("분배율 35%")).toHaveCount(2);
    await expect(page.getByText("E2E46 팀장")).toBeVisible();
    await expect(page.getByText("E2E46 카운터1")).toBeVisible();
    await expect(page.getByText("E2E46 웨이터1")).toBeVisible();
    await expect(page.getByText("제외 warning")).toBeVisible();
    await expect(page.getByText("비완료 1", { exact: false })).toBeVisible();
    await expect(page.getByText("월 총콜 산출 근거")).toBeVisible();
  });

  test("shows below-threshold warning and zero monthly incentive", async ({ page }) => {
    await login(page, "story46_settlement", "Story46!settlement");
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.belowThresholdOperatingMonthId}`);

    await expect(page.getByText("최저 구간 미달")).toBeVisible();
    await expect(page.getByText("900콜").first()).toBeVisible();
    await expect(page.getByText("전체 월인센 0 VND")).toBeVisible();
    await expect(page.getByText("1000콜 미만으로 운영팀 월 인센이 없습니다.")).toBeVisible();
  });

  test("shows missing monthly policy warning without assuming zero silently", async ({ page }) => {
    await login(page, "story46_settlement", "Story46!settlement");
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.missingPolicyOperatingMonthId}`);

    await expect(page.getByText("정책 없음")).toBeVisible();
    await expect(page.getByText("적용월에 활성 운영팀 월 인센 정책이 없습니다.")).toBeVisible();
  });

  test("separates locked month current preview from closing snapshot values", async ({ page }) => {
    await login(page, "story46_settlement", "Story46!settlement");
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.lockedOperatingMonthId}`);

    await expect(page.getByText("현재 기준 미리보기")).toBeVisible();
    await expect(page.getByText("확정값은 월마감 스냅샷 기준", { exact: false })).toBeVisible();
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
