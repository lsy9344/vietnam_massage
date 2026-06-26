import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions } from "./support/auth";


type SeededData = {
  openMonthId: string;
  lockedMonthId: string;
  accountId: string;
  roomId: string;
  aCourseId: string;
  dCourseId: string;
  therapist1Id: string;
  therapist2Id: string;
  handlerId: string;
};

let seededData: SeededData;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function expectSummaryKpi(page: Page, label: string, value: string) {
  const pattern = new RegExp(`^${escapeRegExp(label)}\\s*${escapeRegExp(value)}$`);
  await expect(page.getByLabel("일별 요약").locator("div.grid").filter({ hasText: pattern })).toBeVisible();
}

async function login(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill("story25_counter");
  await page.getByLabel("비밀번호").fill("Story25!counter");
  await page.getByRole("button", { name: "로그인" }).click();
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive: true },
    create: { staffCode, displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive: true }
  });
}

async function seedAuthAccount(handlerId: string) {
  const passwordHash = await hash("Story25!counter", argon2idOptions);
  return (prisma as any).userAccount.upsert({
    where: { accountId: "story25_counter" },
    update: {
      email: "story25_counter@example.local",
      passwordHash,
      role: "counter",
      employeeId: handlerId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: "story25_counter@example.local",
      accountId: "story25_counter",
      passwordHash,
      role: "counter",
      employeeId: handlerId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function upsertCodeItem(codeType: string, code: string, displayName: string, sortOrder: number) {
  await (prisma as any).codeItem.upsert({
    where: { codeType_code: { codeType, code } },
    update: { displayName, sortOrder, isActive: true },
    create: { codeType, code, displayName, sortOrder, isSystemDefault: false, isActive: true }
  });
}

async function upsertPolicy(courseId: string, name: string, basePrice: number, requiresSecondTherapist: boolean, earcarePoolAmount = 0) {
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: "2033-06" } });
  const data = {
    name,
    durationMinutes: requiresSecondTherapist ? 90 : 60,
    basePrice,
    opsCallCredit: 1,
    earcarePoolAmount,
    requiresSecondTherapist,
    tvDisplayName: name,
    effectiveToMonth: null,
    isActive: true
  };
  if (existing) {
    await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data });
    return;
  }
  await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: "2033-06", ...data } });
}

async function upsertRate(therapistId: string, courseId: string, amount: number) {
  const existing = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId, courseId, effectiveFromMonth: "2033-06" } });
  const data = { amount, effectiveToMonth: null, isActive: true };
  if (existing) {
    await (prisma as any).therapistCourseRate.update({ where: { id: existing.id }, data });
    return;
  }
  await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth: "2033-06", ...data } });
}

async function cleanupStoryData(openMonthId: string, lockedMonthId: string) {
  const openDate = new Date("2033-06-05T00:00:00.000Z");
  const lockedDate = new Date("2033-07-05T00:00:00.000Z");
  const calls = await (prisma as any).serviceCall.findMany({
    where: {
      operatingMonthId: openMonthId,
      serviceDate: openDate,
      customerMemo: { startsWith: "Story 2.5" }
    },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);

  if (callIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
  }

  await (prisma as any).dailyExpense.deleteMany({
    where: {
      OR: [
        { operatingMonthId: openMonthId, expenseDate: openDate },
        { operatingMonthId: lockedMonthId, expenseDate: lockedDate }
      ]
    }
  });
}

async function seedStoryData(): Promise<SeededData> {
  const handler = await seedEmployee("E2E25-OPS-001", "E2E25 카운터", "OPERATIONS", "카운터", 92500);
  const account = await seedAuthAccount(handler.id);
  const openMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2033-06" },
    update: { startDate: new Date("2033-06-01T00:00:00.000Z"), endDate: new Date("2033-06-30T00:00:00.000Z"), status: "작성중" },
    create: { monthKey: "2033-06", startDate: new Date("2033-06-01T00:00:00.000Z"), endDate: new Date("2033-06-30T00:00:00.000Z"), status: "작성중" }
  });
  const lockedMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2033-07" },
    update: { startDate: new Date("2033-07-01T00:00:00.000Z"), endDate: new Date("2033-07-31T00:00:00.000Z"), status: "잠금" },
    create: { monthKey: "2033-07", startDate: new Date("2033-07-01T00:00:00.000Z"), endDate: new Date("2033-07-31T00:00:00.000Z"), status: "잠금" }
  });
  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 92501 },
    update: { displayName: "E2E25 호실", migrationReferenceName: "E2E25-ROOM", isActive: true },
    create: { displayName: "E2E25 호실", migrationReferenceName: "E2E25-ROOM", sortOrder: 92501, isActive: true }
  });
  const aCourse = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
  const dCourse = await (prisma as any).course.upsert({ where: { code: "D" }, update: { isActive: true }, create: { code: "D", isActive: true } });
  const therapist1 = await seedEmployee("E2E25-THR-001", "E2E25 마사지사1", "THERAPIST", "마사지사", 92501);
  const therapist2 = await seedEmployee("E2E25-THR-002", "E2E25 마사지사2", "THERAPIST", "마사지사", 92502);
  await upsertPolicy(aCourse.id, "Story25 A", 1500000, false, 100000);
  await upsertPolicy(dCourse.id, "Story25 D", 3200000, true);
  await upsertRate(therapist1.id, aCourse.id, 700000);
  await upsertRate(therapist2.id, aCourse.id, 0);
  await upsertRate(therapist1.id, dCourse.id, 900000);
  await upsertRate(therapist2.id, dCourse.id, 900000);
  await (prisma as any).timeSlot.upsert({
    where: { value: "14:00" },
    update: { sortOrder: 92501, isActive: true },
    create: { value: "14:00", sortOrder: 92501, isActive: true }
  });
  await upsertCodeItem("SERVICE_STATUS", "RESERVED", "예약", 92501);
  await upsertCodeItem("SERVICE_STATUS", "VISIT_COMPLETE", "방문완료", 92502);
  await upsertCodeItem("SERVICE_STATUS", "CANCELED", "취소", 92503);
  await upsertCodeItem("DISCOUNT_TYPE", "BIRTHDAY", "생일자", 92501);
  await cleanupStoryData(openMonth.id, lockedMonth.id);

  return {
    openMonthId: openMonth.id,
    lockedMonthId: lockedMonth.id,
    accountId: account.id,
    roomId: room.id,
    aCourseId: aCourse.id,
    dCourseId: dCourse.id,
    therapist1Id: therapist1.id,
    therapist2Id: therapist2.id,
    handlerId: handler.id
  };
}

async function countStoryDailyExpenseAuditEvents() {
  return (prisma as any).auditLog.count({
    where: {
      actorId: seededData.accountId,
      targetType: "daily_expense",
      action: { in: ["daily_expense.created", "daily_expense.changed", "daily_expense.deactivated"] }
    }
  });
}

async function createCallRow(input: { courseId: string; status: string; discountTypeCode?: string | null; therapist2Id?: string | null }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: seededData.openMonthId,
      serviceDate: new Date("2033-06-05T00:00:00.000Z"),
      startTime: "14:00",
      roomId: seededData.roomId,
      courseId: input.courseId,
      customerMemo: `Story 2.5 ${input.status}`,
      status: input.status,
      discountTypeCode: input.discountTypeCode ?? null
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: seededData.therapist1Id }
  });
  if (input.therapist2Id) {
    await (prisma as any).serviceCallAssignment.create({
      data: { serviceCallId: call.id, assignmentRole: "THERAPIST_2", employeeId: input.therapist2Id }
    });
  }
}

test.describe("Story 2.5 일별 지출 입력과 요약 계산", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    seededData = await seedStoryData();
    await createCallRow({ courseId: seededData.aCourseId, status: "VISIT_COMPLETE", discountTypeCode: "BIRTHDAY", therapist2Id: seededData.therapist2Id });
    await createCallRow({ courseId: seededData.dCourseId, status: "VISIT_COMPLETE", therapist2Id: seededData.therapist2Id });
    await createCallRow({ courseId: seededData.aCourseId, status: "RESERVED" });
    await createCallRow({ courseId: seededData.aCourseId, status: "CANCELED" });
  });

  test("지출 추가/수정/비활성과 지출합계/순매출 갱신을 확인한다", async ({ page }) => {
    await login(page);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2033-06-05`);
    const auditCountBefore = await countStoryDailyExpenseAuditEvents();

    await expectSummaryKpi(page, "예약건수", "1건");
    await expectSummaryKpi(page, "방문완료", "2건");
    await expectSummaryKpi(page, "노쇼/취소", "0 / 1");
    await expectSummaryKpi(page, "결제합계", "4,600,000 VND");
    await expectSummaryKpi(page, "마사지사정산", "2,500,000 VND");
    await expectSummaryKpi(page, "귀케어풀", "100,000 VND");
    await expectSummaryKpi(page, "할인합계", "100,000 VND");
    await expectSummaryKpi(page, "지출합계", "0 VND");
    await expectSummaryKpi(page, "순매출", "4,600,000 VND");
    await expect(page.getByLabel("일별 요약").getByRole("row", { name: /^A\s+1\s+1\s+2$/ })).toBeVisible();
    await expect(page.getByLabel("일별 요약").getByRole("row", { name: /^D\s+1\s+0\s+2$/ })).toBeVisible();
    await expect(page.getByLabel("일별 요약").getByRole("row", { name: /^E\s+0\s+0\s+0$/ })).toBeVisible();

    const expensePanel = page.getByLabel("일별 지출");
    await expensePanel.getByPlaceholder("금액").fill("250000");
    await expensePanel.getByPlaceholder("내용").fill("소모품");
    await expensePanel.getByLabel("지출 담당자").last().selectOption(seededData.handlerId);
    await expensePanel.getByRole("button", { name: "지출 추가" }).click();
    await expect(expensePanel.getByText("저장됨")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("일별 요약")).toContainText("250,000 VND");
    await expect(page.getByLabel("일별 요약")).toContainText("4,350,000 VND");

    const row = expensePanel.getByRole("row", { name: /소모품/ });
    await row.getByLabel("지출금액").fill("300000");
    await row.getByLabel("내용").fill("소모품 수정");
    await row.getByRole("button", { name: "수정" }).click();
    await page.reload();
    await expect(page.getByLabel("일별 요약")).toContainText("300,000 VND");
    await expect(page.getByLabel("일별 요약")).toContainText("4,300,000 VND");

    await page.getByRole("row", { name: /소모품 수정/ }).getByRole("button", { name: "비활성" }).click();
    await page.reload();
    await expect(page.getByLabel("일별 요약")).toContainText("4,600,000 VND");
    await expect(page.getByText("이 날짜에 등록된 지출이 없습니다.")).toBeVisible();
    await expect
      .poll(countStoryDailyExpenseAuditEvents)
      .toBe(auditCountBefore + 3);
  });

  test("field error와 잠긴 운영월 read-only 상태를 확인한다", async ({ page }) => {
    await login(page);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2033-06-05`);
    await page.getByLabel("일별 지출").getByPlaceholder("금액").fill("0");
    await page.getByLabel("일별 지출").getByPlaceholder("내용").fill("금액 오류");
    await page.getByLabel("일별 지출").getByRole("button", { name: "지출 추가" }).click();
    await expect(page.getByText("금액은 0보다 커야 합니다.")).toBeVisible();

    await page.goto(`/calls?operatingMonthId=${seededData.lockedMonthId}&serviceDate=2033-07-05`);
    await expect(page.getByText("잠긴 운영월입니다. 지출 입력과 수정이 차단됩니다.")).toBeVisible();
    await expect(page.getByLabel("일별 지출").getByRole("button", { name: "지출 추가" })).toBeDisabled();
  });

  test.afterAll(async () => {
    // 이 스펙이 시드한 콜/지출을 운영월 범위로 정리한 뒤 연결을 닫는다.
    await cleanupStoryData(seededData.openMonthId, seededData.lockedMonthId);
    await prisma.$disconnect();
  });
});
