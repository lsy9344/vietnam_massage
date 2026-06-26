import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";


type SeededData = {
  previewOperatingMonthId: string;
  lockedOperatingMonthId: string;
  previewStartDate: string;
  previewEndDate: string;
  lockedStartDate: string;
  memoPrefix: string;
  accounts: {
    admin: string;
    settlement: string;
    counter: string;
    waiter: string;
    readOnly: string;
  };
};

let seededData: SeededData;

function story51WorkerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

function story51MonthKey(workerIndex: number, offset: number) {
  const monthNumber = workerIndex * 2 + offset;
  const year = 2037 + Math.floor((monthNumber - 1) / 12);
  const month = ((monthNumber - 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function story51Date(monthKey: string, day: number) {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function utcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
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

  throw new Error(`No Story 5.1 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function storyCodeSortOrder(codeType: string, code: string, preferredSortOrder: number) {
  const existing = await (prisma as any).codeItem.findUnique({
    where: { codeType_code: { codeType, code } },
    select: { sortOrder: true }
  });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).codeItem.findFirst({
      where: { codeType, sortOrder, NOT: { code } },
      select: { id: true }
    });
    if (!conflicting) return sortOrder;
  }

  throw new Error(`No Story 5.1 code sortOrder available for ${codeType}:${code}`);
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

  throw new Error(`No Story 5.1 room sortOrder available for ${migrationReferenceName}`);
}

async function storyTimeSlotSortOrder(value: string, preferredSortOrder: number) {
  const existing = await (prisma as any).timeSlot.findUnique({
    where: { value },
    select: { sortOrder: true }
  });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).timeSlot.findUnique({
      where: { sortOrder },
      select: { id: true }
    });
    if (!conflicting) return sortOrder;
  }

  throw new Error(`No Story 5.1 timeSlot sortOrder available for ${value}`);
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002");
}

async function retryAfterUniqueRace(attempt: number) {
  await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
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

async function seedCodeItem(codeType: string, code: string, displayName: string, sortOrder: number) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const safeSortOrder = await storyCodeSortOrder(codeType, code, sortOrder);
    try {
      return await (prisma as any).codeItem.upsert({
        where: { codeType_code: { codeType, code } },
        update: { displayName, sortOrder: safeSortOrder, isActive: true },
        create: { codeType, code, displayName, sortOrder: safeSortOrder, isSystemDefault: true, isActive: true }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt === 2) throw error;
      await retryAfterUniqueRace(attempt);
    }
  }
}

async function seedTimeSlot(value: string, sortOrder: number) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const safeSortOrder = await storyTimeSlotSortOrder(value, sortOrder);
    try {
      return await (prisma as any).timeSlot.upsert({
        where: { value },
        update: { sortOrder: safeSortOrder, isActive: true },
        create: { value, sortOrder: safeSortOrder, isActive: true }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt === 2) throw error;
      await retryAfterUniqueRace(attempt);
    }
  }
}

async function upsertCoursePolicy(courseId: string, effectiveFromMonth: string, name: string, opsCallCredit: number, earcarePoolAmount: number) {
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth } });
  const data = {
    name,
    durationMinutes: 60,
    basePrice: 1500000,
    opsCallCredit,
    earcarePoolAmount,
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

async function upsertDailyRule(thresholdCallCount: number, personalAmount: number, effectiveFromMonth: string) {
  const existing = await (prisma as any).opsDailyIncentiveRule.findFirst({ where: { thresholdCallCount, effectiveFromMonth } });
  const data = { personalAmount, effectiveToMonth: null, isActive: true };
  if (existing) return (prisma as any).opsDailyIncentiveRule.update({ where: { id: existing.id }, data });
  return (prisma as any).opsDailyIncentiveRule.create({ data: { thresholdCallCount, effectiveFromMonth, ...data } });
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

async function cleanupStoryData(operatingMonthIds: string[], memoPrefix: string) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: { operatingMonthId: { in: operatingMonthIds }, customerMemo: { startsWith: memoPrefix } },
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
  earcareId?: string;
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
  if (input.earcareId) {
    await (prisma as any).serviceCallAssignment.create({
      data: { serviceCallId: call.id, assignmentRole: "EARCARE", employeeId: input.earcareId, isActive: true }
    });
  }
}

async function seedAttendance(table: "opsAttendance" | "earcareAttendance", operatingMonthId: string, attendanceDate: Date, employeeId: string, statusCode: string) {
  return (prisma as any)[table].upsert({
    where: {
      operatingMonthId_attendanceDate_employeeId: {
        operatingMonthId,
        attendanceDate,
        employeeId
      }
    },
    update: { statusCode, isActive: true },
    create: { operatingMonthId, attendanceDate, employeeId, statusCode, isActive: true }
  });
}

async function seedStoryData(workerIndex: number): Promise<SeededData> {
  const suffix = story51WorkerSuffix(workerIndex);
  const sortBase = 95100 + workerIndex * 100;
  const previewMonthKey = story51MonthKey(workerIndex, 1);
  const lockedMonthKey = story51MonthKey(workerIndex, 2);
  const previewStartDate = story51Date(previewMonthKey, 1);
  const previewEndDate = story51Date(previewMonthKey, 2);
  const lockedStartDate = story51Date(lockedMonthKey, 1);
  const memoPrefix = `Story 5.1 ${suffix}`;
  const accounts = {
    admin: `story51_admin_${suffix.toLowerCase()}`,
    settlement: `story51_settlement_${suffix.toLowerCase()}`,
    counter: `story51_counter_${suffix.toLowerCase()}`,
    waiter: `story51_waiter_${suffix.toLowerCase()}`,
    readOnly: `story51_readonly_${suffix.toLowerCase()}`
  };

  await seedCodeItem("ATTENDANCE_STATUS", "NORMAL", "정상", 95101);
  await seedCodeItem("ATTENDANCE_STATUS", "OFF", "휴무", 95102);

  const adminEmployee = await seedEmployee(`E2E51-${suffix}-AUTH-ADMIN`, "E2E51 관리자", "BACKOFFICE", "관리자", sortBase);
  const settlementEmployee = await seedEmployee(`E2E51-${suffix}-AUTH-SETTLE`, "E2E51 정산담당", "BACKOFFICE", "정산", sortBase + 1);
  const counterEmployee = await seedEmployee(`E2E51-${suffix}-AUTH-COUNTER`, "E2E51 카운터계정", "BACKOFFICE", "카운터", sortBase + 2);
  const waiterEmployee = await seedEmployee(`E2E51-${suffix}-AUTH-WAITER`, "E2E51 웨이터계정", "BACKOFFICE", "웨이터", sortBase + 3);
  const readOnlyEmployee = await seedEmployee(`E2E51-${suffix}-AUTH-READONLY`, "E2E51 조회전용", "BACKOFFICE", "조회", sortBase + 4);
  await seedAuthAccount({ accountId: accounts.admin, password: "Story51!admin", role: "administrator", employeeId: adminEmployee.id });
  await seedAuthAccount({ accountId: accounts.settlement, password: "Story51!settlement", role: "settlement_manager", employeeId: settlementEmployee.id });
  await seedAuthAccount({ accountId: accounts.counter, password: "Story51!counter", role: "counter", employeeId: counterEmployee.id });
  await seedAuthAccount({ accountId: accounts.waiter, password: "Story51!waiter", role: "waiter", employeeId: waiterEmployee.id });
  await seedAuthAccount({ accountId: accounts.readOnly, password: "Story51!readonly", role: "read_only_viewer", employeeId: readOnlyEmployee.id });

  await seedEmployee(`E2E51-${suffix}-OPS-001`, "E2E51 팀장", "OPERATIONS", "팀장", sortBase + 10);
  await seedEmployee(`E2E51-${suffix}-OPS-002`, "E2E51 카운터", "OPERATIONS", "카운터", sortBase + 11);
  await seedEmployee(`E2E51-${suffix}-OPS-003`, "E2E51 웨이터", "OPERATIONS", "웨이터", sortBase + 12);
  const therapist = await seedEmployee(`E2E51-${suffix}-THR-001`, "E2E51 마사지사", "THERAPIST", "마사지사", sortBase + 20);
  const earcare = await seedEmployee(`E2E51-${suffix}-EAR-001`, "E2E51 귀케어", "EARCARE", "귀케어", sortBase + 30);

  const previewOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: previewMonthKey },
    update: { startDate: utcDate(previewStartDate), endDate: utcDate(previewEndDate), status: "검토중" },
    create: { monthKey: previewMonthKey, startDate: utcDate(previewStartDate), endDate: utcDate(previewEndDate), status: "검토중" }
  });
  const lockedOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: lockedMonthKey },
    update: { startDate: utcDate(lockedStartDate), endDate: utcDate(lockedStartDate), status: "잠금" },
    create: { monthKey: lockedMonthKey, startDate: utcDate(lockedStartDate), endDate: utcDate(lockedStartDate), status: "잠금" }
  });
  await cleanupStoryData([previewOperatingMonth.id, lockedOperatingMonth.id], memoPrefix);

  const roomSortOrder = await storyRoomSortOrder(`E2E51-${suffix}-ROOM`, sortBase + 1);
  const room = await (prisma as any).room.upsert({
    where: { sortOrder: roomSortOrder },
    update: { displayName: "E2E51 호실", migrationReferenceName: `E2E51-${suffix}-ROOM`, isActive: true },
    create: { displayName: "E2E51 호실", migrationReferenceName: `E2E51-${suffix}-ROOM`, sortOrder: roomSortOrder, isActive: true }
  });
  await seedTimeSlot("17:00", sortBase + 2);
  const courseCode = `E2E51-${suffix}-A`;
  const course = await (prisma as any).course.upsert({ where: { code: courseCode }, update: { isActive: true }, create: { code: courseCode, isActive: true } });
  await upsertCoursePolicy(course.id, previewMonthKey, `Story51 ${suffix} A`, 1100, 100000);
  await upsertCoursePolicy(course.id, lockedMonthKey, `Story51 ${suffix} A locked`, 1100, 100000);
  await upsertRate(therapist.id, course.id, previewMonthKey, 700000);
  await upsertRate(therapist.id, course.id, lockedMonthKey, 700000);
  await upsertDailyRule(30, 50000, previewMonthKey);
  await upsertDailyRule(30, 50000, lockedMonthKey);
  await upsertMonthlyRule(1000, 3000000, previewMonthKey);
  await upsertMonthlyRule(1000, 3000000, lockedMonthKey);

  await createCall({
    operatingMonthId: previewOperatingMonth.id,
    serviceDate: utcDate(previewStartDate),
    roomId: room.id,
    courseId: course.id,
    memo: `${memoPrefix} complete preview`,
    status: "VISIT_COMPLETE",
    therapist1Id: therapist.id,
    earcareId: earcare.id
  });
  await createCall({
    operatingMonthId: previewOperatingMonth.id,
    serviceDate: utcDate(previewEndDate),
    roomId: room.id,
    courseId: course.id,
    memo: `${memoPrefix} complete undistributed earcare`,
    status: "VISIT_COMPLETE",
    therapist1Id: therapist.id,
    earcareId: earcare.id
  });
  await createCall({
    operatingMonthId: previewOperatingMonth.id,
    serviceDate: utcDate(previewEndDate),
    roomId: room.id,
    courseId: course.id,
    memo: `${memoPrefix} reserved warning`,
    status: "예약",
    therapist1Id: therapist.id
  });
  await createCall({
    operatingMonthId: lockedOperatingMonth.id,
    serviceDate: utcDate(lockedStartDate),
    roomId: room.id,
    courseId: course.id,
    memo: `${memoPrefix} locked complete`,
    status: "방문완료",
    therapist1Id: therapist.id,
    earcareId: earcare.id
  });

  for (const employee of await (prisma as any).employee.findMany({ where: { employeeGroup: "OPERATIONS", isActive: true } })) {
    await seedAttendance("opsAttendance", previewOperatingMonth.id, utcDate(previewStartDate), employee.id, "NORMAL");
    await seedAttendance("opsAttendance", lockedOperatingMonth.id, utcDate(lockedStartDate), employee.id, "NORMAL");
  }
  await seedAttendance("earcareAttendance", previewOperatingMonth.id, utcDate(previewStartDate), earcare.id, "NORMAL");
  await seedAttendance("earcareAttendance", previewOperatingMonth.id, utcDate(previewEndDate), earcare.id, "OFF");
  await seedAttendance("earcareAttendance", lockedOperatingMonth.id, utcDate(lockedStartDate), earcare.id, "NORMAL");

  return {
    previewOperatingMonthId: previewOperatingMonth.id,
    lockedOperatingMonthId: lockedOperatingMonth.id,
    previewStartDate,
    previewEndDate,
    lockedStartDate,
    memoPrefix,
    accounts
  };
}

test.describe("Story 5.1 monthly closing preview", () => {
  test.beforeAll(async ({}, workerInfo) => {
    seededData = await seedStoryData(workerInfo.workerIndex);
  });

  test.afterAll(async () => {
    // 이 워커가 시드한 콜을 운영월 + 워커별 메모 prefix 범위로 정리한 뒤 연결을 닫는다.
    await cleanupStoryData([seededData.previewOperatingMonthId, seededData.lockedOperatingMonthId], seededData.memoPrefix);
    await prisma.$disconnect();
  });

  test("settlement manager sees read-only monthly preview summary, details, and evidence", async ({ page }) => {
    await login(page, seededData.accounts.settlement, "Story51!settlement");
    await page.goto(`/closing?operatingMonthId=${seededData.previewOperatingMonthId}`);

    await expect(page.getByRole("heading", { name: "월마감 미리보기" })).toBeVisible();
    await expect(page.getByText("미확정 미리보기")).toBeVisible();
    await expect(page.getByText(`날짜 범위: ${seededData.previewStartDate} ~ ${seededData.previewEndDate}`)).toBeVisible();
    await expect(page.locator("section").filter({ hasText: "마사지사 지급 합계" })).toContainText("1,400,000 VND");
    await expect(page.getByText("운영팀 일일인센")).toBeVisible();
    await expect(page.locator("section").filter({ hasText: "운영팀 월인센" })).toContainText("3,000,000 VND");
    await expect(page.locator("section").filter({ hasText: "귀케어 지급 합계" })).toContainText("100,000 VND");
    await expect(page.getByText("전체 지급 합계")).toBeVisible();
    await expect(page.getByRole("heading", { name: "마사지사" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "운영팀" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "귀케어" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "산출 근거/warning" })).toBeVisible();

    const therapistRow = page.getByRole("row").filter({ hasText: "E2E51 마사지사" });
    await expect(therapistRow).toContainText("THR-001");
    await expect(therapistRow).toContainText("2건");
    await expect(therapistRow).toContainText("1,400,000 VND");
    await expect(page.getByText("Story 5.2 대기", { exact: false })).toBeVisible();

    const earcareRow = page.getByRole("row").filter({ hasText: "E2E51 귀케어" });
    await expect(earcareRow).toContainText("1일");
    await expect(earcareRow).toContainText("100,000 VND");
    await expect(page.getByText(`기간 ${seededData.previewStartDate} ~ ${seededData.previewEndDate}, source day count 2`)).toBeVisible();
    await expect(page.getByText("excluded call count 1")).toBeVisible();
    await expect(page.getByText(/귀케어 정상근무자 0명\s+1/)).toBeVisible();
    await expect(page.getByText(/미분배\s+1/)).toBeVisible();
    await expect(page.getByText("대표 evidence")).toBeVisible();

    await expect(page.getByRole("button", { name: /마감확정|잠금|재오픈|저장|수정/ })).toHaveCount(0);
  });

  test("operating month selector reloads the preview for the chosen month", async ({ page }) => {
    await login(page, seededData.accounts.settlement, "Story51!settlement");
    await page.goto(`/closing?operatingMonthId=${seededData.previewOperatingMonthId}`);

    await page.getByLabel("운영월").selectOption(seededData.lockedOperatingMonthId);
    await page.getByRole("button", { name: "조회" }).click();

    await expect(page).toHaveURL(new RegExp(`operatingMonthId=${seededData.lockedOperatingMonthId}`));
    await expect(page.getByText(`날짜 범위: ${seededData.lockedStartDate} ~ ${seededData.lockedStartDate}`)).toBeVisible();
    await expect(page.getByText("현재 기준 미리보기")).toBeVisible();
  });

  test("administrator sees locked month as current preview, not snapshot value", async ({ page }) => {
    await login(page, seededData.accounts.admin, "Story51!admin");
    await page.goto(`/closing?operatingMonthId=${seededData.lockedOperatingMonthId}`);

    await expect(page.getByText("현재 기준 미리보기")).toBeVisible();
    await expect(page.getByText("확정값은 월마감 스냅샷 기준")).toBeVisible();
  });

  test("counter, waiter, and read-only roles are redirected by route access policy", async ({ page }) => {
    await login(page, seededData.accounts.counter, "Story51!counter");
    await page.goto(`/closing?operatingMonthId=${seededData.previewOperatingMonthId}`);
    await expect(page).toHaveURL(/\/calls/);

    await page.context().clearCookies();
    await login(page, seededData.accounts.waiter, "Story51!waiter");
    await page.goto(`/closing?operatingMonthId=${seededData.previewOperatingMonthId}`);
    await expect(page).toHaveURL(/\/rooms/);

    await page.context().clearCookies();
    await login(page, seededData.accounts.readOnly, "Story51!readonly");
    await page.goto(`/closing?operatingMonthId=${seededData.previewOperatingMonthId}`);
    await expect(page).toHaveURL(/\/rooms/);
  });
});
