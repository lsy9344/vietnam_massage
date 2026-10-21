import { testEmployees } from "./support/test-employees";
import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

/**
 * 티켓 33: 마감 전 점검(F07, ADR 0002). 계산 오류·지급 재확인 미처리가 있으면 마감 확정이 막히고,
 * 마감 확인 대상 콜(예약·사용중·청소중)은 목록으로만 보이며 확정을 막지 않는다(확인·사유는 34에서).
 * 점검 항목의 원본 이동은 역할을 따른다: 관리자는 원장 링크, 정산 담당은 그 자리 요약.
 */

type SeededData = {
  blockedMonthId: string;
  pendingMonthId: string;
  accounts: {
    admin: string;
    settlement: string;
  };
};

let seededData: SeededData;

function story33WorkerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

function story33MonthKey(workerIndex: number, offset: number) {
  const monthNumber = workerIndex * 2 + offset;
  const year = 2090 + Math.floor((monthNumber - 1) / 12);
  const month = ((monthNumber - 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function story33Date(monthKey: string, day: number) {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function utcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

async function storyEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({ where: { employeeGroup, sortOrder, NOT: { staffCode } }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }

  throw new Error(`No ticket-33 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function storyRoomSortOrder(migrationReferenceName: string, preferredSortOrder: number) {
  const existing = await (prisma as any).room.findFirst({ where: { migrationReferenceName }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).room.findUnique({ where: { sortOrder }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }

  throw new Error(`No ticket-33 room sortOrder available for ${migrationReferenceName}`);
}

async function storyTimeSlotSortOrder(value: string, preferredSortOrder: number) {
  const existing = await (prisma as any).timeSlot.findUnique({ where: { value }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).timeSlot.findUnique({ where: { sortOrder }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }

  throw new Error(`No ticket-33 timeSlot sortOrder available for ${value}`);
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, sortOrder: number) {
  const safeSortOrder = await storyEmployeeSortOrder(employeeGroup, staffCode, sortOrder);
  return testEmployees.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder: safeSortOrder, isActive: true },
    create: { staffCode, displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder: safeSortOrder, isActive: true }
  });
}

async function seedAuthAccount(input: { accountId: string; password: string; role: string; employeeId: string }) {
  const passwordHash = await hash(input.password, argon2idOptions);
  return (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: { email: `${input.accountId}@example.local`, passwordHash, role: input.role, employeeId: input.employeeId, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: { email: `${input.accountId}@example.local`, accountId: input.accountId, passwordHash, role: input.role, employeeId: input.employeeId, isActive: true, lockedUntil: null, failedLoginCount: 0 }
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

async function cleanupStoryData(operatingMonthIds: string[], memoPrefix: string) {
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: { in: operatingMonthIds }, customerMemo: { startsWith: memoPrefix } }, select: { id: true } });
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
  roomId: string | null;
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
      paymentMethodCode: null,
      confirmationCode: null
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapist1Id, isActive: true }
  });
  return call;
}

async function seedStoryData(workerIndex: number): Promise<SeededData> {
  const suffix = story33WorkerSuffix(workerIndex);
  const sortBase = 95330 + workerIndex * 100;
  const blockedMonthKey = story33MonthKey(workerIndex, 1);
  const pendingMonthKey = story33MonthKey(workerIndex, 2);
  const blockedDate = story33Date(blockedMonthKey, 1);
  const pendingDate = story33Date(pendingMonthKey, 1);
  const memoPrefix = `Ticket33 ${suffix}`;
  const accounts = {
    admin: `ticket33_admin_${suffix.toLowerCase()}`,
    settlement: `ticket33_settlement_${suffix.toLowerCase()}`
  };

  const adminEmployee = await seedEmployee(`E2E33-${suffix}-AUTH-ADMIN`, "E2E33 관리자", "BACKOFFICE", "관리자", sortBase);
  const settlementEmployee = await seedEmployee(`E2E33-${suffix}-AUTH-SETTLE`, "E2E33 정산담당", "BACKOFFICE", "정산", sortBase + 1);
  await seedAuthAccount({ accountId: accounts.admin, password: "Ticket33!admin", role: "administrator", employeeId: adminEmployee.id });
  await seedAuthAccount({ accountId: accounts.settlement, password: "Ticket33!settlement", role: "settlement_manager", employeeId: settlementEmployee.id });

  const therapistLabel = `E2E33 마사지사 ${suffix}`;
  const therapist = await seedEmployee(`E2E33-${suffix}-THR-001`, therapistLabel, "THERAPIST", "마사지사", sortBase + 10);

  const blockedMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: blockedMonthKey },
    update: { startDate: utcDate(blockedDate), endDate: utcDate(blockedDate), status: "검토중" },
    create: { monthKey: blockedMonthKey, startDate: utcDate(blockedDate), endDate: utcDate(blockedDate), status: "검토중" }
  });
  const pendingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: pendingMonthKey },
    update: { startDate: utcDate(pendingDate), endDate: utcDate(pendingDate), status: "검토중" },
    create: { monthKey: pendingMonthKey, startDate: utcDate(pendingDate), endDate: utcDate(pendingDate), status: "검토중" }
  });
  await cleanupStoryData([blockedMonth.id, pendingMonth.id], memoPrefix);
  await (prisma as any).monthlyClosing.deleteMany({ where: { operatingMonthId: { in: [blockedMonth.id, pendingMonth.id] } } });

  const roomSortOrder = await storyRoomSortOrder(`E2E33-${suffix}-ROOM`, sortBase + 1);
  const room = await (prisma as any).room.upsert({
    where: { sortOrder: roomSortOrder },
    update: { displayName: "E2E33 호실", migrationReferenceName: `E2E33-${suffix}-ROOM`, isActive: true },
    create: { displayName: "E2E33 호실", migrationReferenceName: `E2E33-${suffix}-ROOM`, sortOrder: roomSortOrder, isActive: true }
  });
  const timeSlotSortOrder = await storyTimeSlotSortOrder("17:00", sortBase + 2);
  await (prisma as any).timeSlot.upsert({
    where: { value: "17:00" },
    update: { isActive: true },
    create: { value: "17:00", sortOrder: timeSlotSortOrder, isActive: true }
  });

  // 정책 없는 코스: 방문완료 콜에 붙이면 계산 오류(코스 정책 없음)가 된다.
  const noPolicyCourseCode = `E2E33-${suffix}-NOPOLICY`;
  const noPolicyCourse = await (prisma as any).course.upsert({ where: { code: noPolicyCourseCode }, update: { isActive: true }, create: { code: noPolicyCourseCode, isActive: true } });

  // 정책 있는 코스: 예약 콜에 붙여도 계산 오류는 아니다(마감 확인 대상일 뿐).
  const validCourseCode = `E2E33-${suffix}-VALID`;
  const validCourse = await (prisma as any).course.upsert({ where: { code: validCourseCode }, update: { isActive: true }, create: { code: validCourseCode, isActive: true } });
  await upsertCoursePolicy(validCourse.id, pendingMonthKey, `Ticket33 ${suffix} valid`);

  await createCall({
    operatingMonthId: blockedMonth.id,
    serviceDate: utcDate(blockedDate),
    roomId: room.id,
    courseId: noPolicyCourse.id,
    memo: `${memoPrefix} calculation error`,
    status: "방문완료",
    therapist1Id: therapist.id
  });
  await createCall({
    operatingMonthId: pendingMonth.id,
    serviceDate: utcDate(pendingDate),
    roomId: null,
    courseId: validCourse.id,
    memo: `${memoPrefix} reserved pending close`,
    status: "예약",
    therapist1Id: therapist.id
  });

  return { blockedMonthId: blockedMonth.id, pendingMonthId: pendingMonth.id, accounts };
}

test.describe("Ticket 33 closing checklist and confirm blocking", () => {
  test.beforeAll(async ({}, workerInfo) => {
    seededData = await seedStoryData(workerInfo.workerIndex);
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("settlement manager sees the calculation-error call as an inline summary (no ledger link) and confirmation is blocked", async ({ page }) => {
    await login(page, seededData.accounts.settlement, "Ticket33!settlement");
    await page.goto(`/closing?operatingMonthId=${seededData.blockedMonthId}`);

    await expect(page.getByRole("heading", { name: "마감 전 점검" })).toBeVisible();
    const calcErrorSection = page.getByRole("region", { name: "마감 전 점검" }).locator("section", { hasText: "계산 오류" }).first();
    await expect(calcErrorSection).toContainText("1건 해결 필요");
    await expect(calcErrorSection).toContainText("코스 정책이 없습니다");

    await expect(calcErrorSection.locator("a", { hasText: "17:00" })).toHaveCount(0);

    await expect(page.getByText("계산 오류와 지급 재확인을 먼저 해결하세요.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "마감 확정" })).toBeDisabled();

    const closing = await (prisma as any).monthlyClosing.count({ where: { operatingMonthId: seededData.blockedMonthId } });
    expect(closing).toBe(0);
  });

  test("administrator sees the same calculation-error call as a ledger link", async ({ page }) => {
    await login(page, seededData.accounts.admin, "Ticket33!admin");
    await page.goto(`/closing?operatingMonthId=${seededData.blockedMonthId}`);

    const calcErrorSection = page.getByRole("region", { name: "마감 전 점검" }).locator("section", { hasText: "계산 오류" }).first();
    await expect(calcErrorSection.locator("a", { hasText: "17:00" })).toBeVisible();
    await expect(page.getByRole("button", { name: "마감 확정" })).toBeDisabled();
  });

  test("a reservation call appears as a pending-close item and confirmation needs the checklist confirmed with a reason (F07/ADR 0005, ticket 34)", async ({ page }) => {
    await login(page, seededData.accounts.settlement, "Ticket33!settlement");
    await page.goto(`/closing?operatingMonthId=${seededData.pendingMonthId}`);

    await expect(page.getByText("계산 오류 없음")).toBeVisible();
    await expect(page.getByText("지급 재확인 미처리 없음")).toBeVisible();
    const pendingSection = page.getByRole("region", { name: "마감 전 점검" }).locator("section", { hasText: "마감 확인 대상 콜" }).first();
    await expect(pendingSection).toContainText("1건");

    const confirmButton = page.getByRole("button", { name: "마감 확정" });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    // 티켓 34: 마감 확인 대상 콜이 있으면 확인 체크와 사유 없이는 "지급 기록 확정"이 막힌다.
    const submitButton = dialog.getByRole("button", { name: "지급 기록 확정" });
    await expect(submitButton).toBeDisabled();
    await dialog.getByRole("checkbox", { name: /위 1건을 확인했습니다/ }).check();
    await expect(submitButton).toBeDisabled();
    await dialog.getByLabel("예외 마감 사유").fill("다음달 초 방문이 확정된 예약이라 예외로 마감합니다");
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    // 운영 빌드에서는 서버 액션이 200으로 끝나도 화면 반영(revalidatePath)이 가끔 늦거나 멈춘 것처럼
    // 보인다(e2e-prod-known-failures 메모의 5-3/5-5/5-6과 같은 증상, 개발 서버에서는 재현되지 않는다).
    // 그래서 결과는 화면 문구가 아니라 DB 상태로 직접 확인한다.
    await expect(async () => {
      const month = await (prisma as any).operatingMonth.findUnique({ where: { id: seededData.pendingMonthId }, select: { status: true } });
      expect(month?.status).toBe("마감확정");
    }).toPass({ timeout: 20000 });
    // 예외 마감 대상 콜이었어도 콜 상태는 그대로다(자동 방문완료 처리하지 않는다).
    const call = await (prisma as any).serviceCall.findFirst({ where: { operatingMonthId: seededData.pendingMonthId }, select: { status: true } });
    expect(call?.status).toBe("예약");
    // 사유, 확인한 콜과 그 당시 상태, 처리자가 이번 마감 버전에 남는다.
    const closing = await (prisma as any).monthlyClosing.findFirst({
      where: { operatingMonthId: seededData.pendingMonthId },
      orderBy: { closeVersion: "desc" },
      select: { snapshotJson: true }
    });
    const pendingCloseException = (closing?.snapshotJson as any)?.pendingCloseException;
    expect(pendingCloseException?.reason).toBe("다음달 초 방문이 확정된 예약이라 예외로 마감합니다");
    expect(pendingCloseException?.calls).toHaveLength(1);
    expect(pendingCloseException?.calls[0]?.status).toBe("예약");
  });
});
