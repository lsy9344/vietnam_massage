import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";


type SeededData = {
  operatingMonthId: string;
  startDate: string;
  endDate: string;
  memoPrefix: string;
  accounts: {
    settlement: string;
    counter: string;
    waiter: string;
  };
};

let seededData: SeededData;


function story52WorkerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

function story52MonthKey(workerIndex: number) {
  const monthNumber = workerIndex + 1;
  const year = 2045 + Math.floor((monthNumber - 1) / 12);
  const month = ((monthNumber - 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function story52Date(monthKey: string, day: number) {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function utcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function formatVnd(amount: number) {
  return `${new Intl.NumberFormat("ko-KR").format(amount)} VND`;
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002");
}

async function retryAfterUniqueRace(attempt: number) {
  await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
}

async function storyEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({
    where: { staffCode },
    select: { sortOrder: true }
  });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({
      where: { employeeGroup, sortOrder, NOT: { staffCode } },
      select: { id: true }
    });
    if (!conflicting) return sortOrder;
  }

  throw new Error(`No Story 5.2 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function storyRoomSortOrder(migrationReferenceName: string, preferredSortOrder: number) {
  const existing = await (prisma as any).room.findFirst({
    where: { migrationReferenceName },
    select: { sortOrder: true }
  });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).room.findUnique({
      where: { sortOrder },
      select: { id: true }
    });
    if (!conflicting) return sortOrder;
  }

  throw new Error(`No Story 5.2 room sortOrder available for ${migrationReferenceName}`);
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, sortOrder: number) {
  const safeSortOrder = await storyEmployeeSortOrder(employeeGroup, staffCode, sortOrder);
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder: safeSortOrder, isActive: true },
    create: { staffCode, displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder: safeSortOrder, isActive: true }
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
    opsCallCredit: 0,
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

async function cleanupStoryData(operatingMonthId: string, memoPrefix: string) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: { operatingMonthId, customerMemo: { startsWith: memoPrefix } },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length === 0) return;

  await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
}

async function createTherapistCalls(input: {
  operatingMonthId: string;
  serviceDate: Date;
  roomId: string;
  courseId: string;
  memoPrefix: string;
  therapistId: string;
  count: number;
}) {
  for (let index = 0; index < input.count; index += 1) {
    const call = await (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: input.operatingMonthId,
        serviceDate: input.serviceDate,
        startTime: "17:00",
        roomId: input.roomId,
        courseId: input.courseId,
        customerMemo: `${input.memoPrefix} ${input.therapistId} ${index + 1}`,
        status: "VISIT_COMPLETE",
        discountTypeCode: null,
        paymentMethodCode: "CASH",
        confirmationCode: null
      }
    });

    await (prisma as any).serviceCallAssignment.create({
      data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId, isActive: true }
    });
  }
}

async function seedStoryData(workerIndex: number): Promise<SeededData> {
  const suffix = story52WorkerSuffix(workerIndex);
  const sortBase = 95200 + workerIndex * 100;
  const monthKey = story52MonthKey(workerIndex);
  const startDate = story52Date(monthKey, 1);
  const endDate = startDate;
  const memoPrefix = `Story 5.2 ${suffix}`;
  const accounts = {
    settlement: `story52_settlement_${suffix.toLowerCase()}`,
    counter: `story52_counter_${suffix.toLowerCase()}`,
    waiter: `story52_waiter_${suffix.toLowerCase()}`
  };

  const settlementEmployee = await seedEmployee(`E2E52-${suffix}-AUTH-SETTLE`, "E2E52 정산담당", "BACKOFFICE", "정산", sortBase);
  const counterEmployee = await seedEmployee(`E2E52-${suffix}-AUTH-COUNTER`, "E2E52 카운터계정", "BACKOFFICE", "카운터", sortBase + 1);
  const waiterEmployee = await seedEmployee(`E2E52-${suffix}-AUTH-WAITER`, "E2E52 웨이터계정", "BACKOFFICE", "웨이터", sortBase + 2);
  await seedAuthAccount({ accountId: accounts.settlement, password: "Story52!settlement", role: "settlement_manager", employeeId: settlementEmployee.id });
  await seedAuthAccount({ accountId: accounts.counter, password: "Story52!counter", role: "counter", employeeId: counterEmployee.id });
  await seedAuthAccount({ accountId: accounts.waiter, password: "Story52!waiter", role: "waiter", employeeId: waiterEmployee.id });

  const callKing = await seedEmployee(`E2E52-${suffix}-THR-001`, "E2E52 콜왕", "THERAPIST", "마사지사", sortBase + 10);
  const tieHigh = await seedEmployee(`E2E52-${suffix}-THR-002`, "E2E52 동률고액", "THERAPIST", "마사지사", sortBase + 11);
  const tieLow = await seedEmployee(`E2E52-${suffix}-THR-003`, "E2E52 동률저액", "THERAPIST", "마사지사", sortBase + 12);
  const underThreshold = await seedEmployee(`E2E52-${suffix}-THR-004`, "E2E52 삼십구콜", "THERAPIST", "마사지사", sortBase + 13);

  const operatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { startDate: utcDate(startDate), endDate: utcDate(endDate), status: "검토중" },
    create: { monthKey, startDate: utcDate(startDate), endDate: utcDate(endDate), status: "검토중" }
  });
  await cleanupStoryData(operatingMonth.id, memoPrefix);

  const roomSortOrder = await storyRoomSortOrder(`E2E52-${suffix}-ROOM`, sortBase + 20);
  const room = await (prisma as any).room.upsert({
    where: { sortOrder: roomSortOrder },
    update: { displayName: "E2E52 호실", migrationReferenceName: `E2E52-${suffix}-ROOM`, isActive: true },
    create: { displayName: "E2E52 호실", migrationReferenceName: `E2E52-${suffix}-ROOM`, sortOrder: roomSortOrder, isActive: true }
  });

  const courseCode = `E2E52-${suffix}-A`;
  const course = await (prisma as any).course.upsert({
    where: { code: courseCode },
    update: { isActive: true },
    create: { code: courseCode, isActive: true }
  });
  await upsertCoursePolicy(course.id, monthKey, `Story52 ${suffix} A`);
  await upsertRate(callKing.id, course.id, monthKey, 100000);
  await upsertRate(tieHigh.id, course.id, monthKey, 120000);
  await upsertRate(tieLow.id, course.id, monthKey, 100000);
  await upsertRate(underThreshold.id, course.id, monthKey, 100000);

  await createTherapistCalls({
    operatingMonthId: operatingMonth.id,
    serviceDate: utcDate(startDate),
    roomId: room.id,
    courseId: course.id,
    memoPrefix,
    therapistId: callKing.id,
    count: 60
  });
  await createTherapistCalls({
    operatingMonthId: operatingMonth.id,
    serviceDate: utcDate(startDate),
    roomId: room.id,
    courseId: course.id,
    memoPrefix,
    therapistId: tieHigh.id,
    count: 45
  });
  await createTherapistCalls({
    operatingMonthId: operatingMonth.id,
    serviceDate: utcDate(startDate),
    roomId: room.id,
    courseId: course.id,
    memoPrefix,
    therapistId: tieLow.id,
    count: 45
  });
  await createTherapistCalls({
    operatingMonthId: operatingMonth.id,
    serviceDate: utcDate(startDate),
    roomId: room.id,
    courseId: course.id,
    memoPrefix,
    therapistId: underThreshold.id,
    count: 39
  });

  return {
    operatingMonthId: operatingMonth.id,
    startDate,
    endDate,
    memoPrefix,
    accounts
  };
}

test.describe("Story 5.2 monthly closing bonuses", () => {
  test.beforeAll(async ({}, workerInfo) => {
    seededData = await seedStoryData(workerInfo.workerIndex);
  });

  test.afterAll(async () => {
    // 이 워커가 시드한 콜을 운영월 + 워커별 메모 prefix 범위로 정리한 뒤 연결을 닫는다.
    await cleanupStoryData(seededData.operatingMonthId, seededData.memoPrefix);
    await prisma.$disconnect();
  });

  test("settlement manager can inspect count-king bonuses, final payout totals, and source-missing evidence", async ({ page }) => {
    await login(page, seededData.accounts.settlement, "Story52!settlement");

    await page.goto(`/closing?operatingMonthId=${seededData.operatingMonthId}`);

    await expect(page.getByRole("heading", { name: "월마감 미리보기" })).toBeVisible();
    await expect(page.getByText(`날짜 범위: ${seededData.startDate} ~ ${seededData.endDate}`)).toBeVisible();
    await expect(page.getByText("마사지사 지급 합계")).toBeVisible();
    await expect(page.locator("section").filter({ hasText: "마사지사 지급 합계" })).toContainText(formatVnd(28800000));
    await expect(page.getByRole("columnheader", { name: "만근 인정일" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "만근수당" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "갯수왕" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "갯수왕 수당" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "최종지급액" })).toBeVisible();

    const callKingRow = page.getByRole("row").filter({ hasText: "E2E52 콜왕" });
    await expect(callKingRow).toContainText("60건");
    await expect(callKingRow).toContainText("1위");
    await expect(callKingRow).toContainText(formatVnd(5000000));
    await expect(callKingRow).toContainText(formatVnd(11000000));

    const tieHighRow = page.getByRole("row").filter({ hasText: "E2E52 동률고액" });
    await expect(tieHighRow).toContainText("45건");
    await expect(tieHighRow).toContainText("2위");
    await expect(tieHighRow).toContainText(formatVnd(3000000));
    await expect(tieHighRow).toContainText(formatVnd(8400000));

    const tieLowRow = page.getByRole("row").filter({ hasText: "E2E52 동률저액" });
    await expect(tieLowRow).toContainText("45건");
    await expect(tieLowRow).toContainText("3위");
    await expect(tieLowRow).toContainText(formatVnd(1000000));
    await expect(tieLowRow).toContainText(formatVnd(5500000));

    const underThresholdRow = page.getByRole("row").filter({ hasText: "E2E52 삼십구콜" });
    await expect(underThresholdRow).toContainText("39건");
    await expect(underThresholdRow).toContainText("순위 없음");
    await expect(underThresholdRow).toContainText("40콜 미만 제외");
    await expect(underThresholdRow).toContainText(formatVnd(3900000));

    await expect(page.getByText("Story 4.1").first()).toBeVisible();
    await expect(page.getByText("source 없음").first()).toBeVisible();
    await expect(page.getByText("tie-breaker: totalCallCount desc, monthlySettlementAmount desc, staffCode asc, Employee.id asc").first()).toBeVisible();
    await expect(page.getByText("만근 source missing 1")).toBeVisible();
    await expect(page.getByText("갯수왕 대상 3명")).toBeVisible();
  });

  test("counter and waiter roles still cannot access /closing", async ({ page }) => {
    await login(page, seededData.accounts.counter, "Story52!counter");
    await page.goto(`/closing?operatingMonthId=${seededData.operatingMonthId}`);
    await expect(page).toHaveURL(/\/calls/);

    await page.context().clearCookies();
    await login(page, seededData.accounts.waiter, "Story52!waiter");
    await page.goto(`/closing?operatingMonthId=${seededData.operatingMonthId}`);
    await expect(page).toHaveURL(/\/rooms/);
  });
});
