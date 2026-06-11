import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { defaultRooms } from "@/modules/masters/room-schema";


const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const OPERATING_DAY_START_MINUTES = 11 * 60;

type Role = "administrator" | "counter" | "waiter" | "settlement_manager" | "read_only_viewer";
type SeededData = {
  openMonthId: string;
  courseId: string;
  attentionCourseId: string;
  therapistId: string;
  roomIds: string[];
};

let seededData: SeededData;

function isoDateFromKst(date: Date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

function addIsoDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function currentOperatingServiceDate(now = new Date()) {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const calendarDate = isoDateFromKst(now);
  return kst.getUTCHours() < 11 ? addIsoDays(calendarDate, -1) : calendarDate;
}

function currentOperatingMinutes(now = new Date()) {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const wallMinutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return wallMinutes < OPERATING_DAY_START_MINUTES ? wallMinutes + 24 * 60 : wallMinutes;
}

function operatingMinutesToTime(value: number) {
  const minutes = ((value % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function monthBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${monthKey}-01`,
    endDate: `${monthKey}-${String(lastDay).padStart(2, "0")}`
  };
}

const serviceDate = currentOperatingServiceDate();
const monthKey = serviceDate.slice(0, 7);


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

  throw new Error(`No Story 3.4 employee sortOrder available for ${employeeGroup}:${staffCode}`);
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

  throw new Error(`No Story 3.4 code sortOrder available for ${codeType}:${code}`);
}

async function seedAccount(input: { accountId: string; role: Role; password: string; staffCode: string; displayName: string }) {
  const sortOrder = await storyEmployeeSortOrder("OPERATIONS", input.staffCode, 93400 + input.staffCode.charCodeAt(input.staffCode.length - 1));
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: input.displayName,
      employeeGroup: "OPERATIONS",
      position: input.role === "waiter" ? "웨이터" : input.role === "counter" ? "카운터" : "조회",
      shiftType: "주간",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    },
    create: {
      staffCode: input.staffCode,
      displayName: input.displayName,
      employeeGroup: "OPERATIONS",
      position: input.role === "waiter" ? "웨이터" : input.role === "counter" ? "카운터" : "조회",
      shiftType: "주간",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
  const passwordHash = await hash(input.password, argon2idOptions);

  return (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: {
      email: `${input.accountId}@example.local`,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: `${input.accountId}@example.local`,
      accountId: input.accountId,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function upsertCodeItem(codeType: string, code: string, displayName: string, sortOrder: number) {
  const safeSortOrder = await storyCodeSortOrder(codeType, code, sortOrder);
  await (prisma as any).codeItem.upsert({
    where: { codeType_code: { codeType, code } },
    update: { displayName, sortOrder: safeSortOrder, isActive: true },
    create: { codeType, code, displayName, sortOrder: safeSortOrder, isSystemDefault: false, isActive: true }
  });
}

async function cleanupStoryCalls(openMonthId: string) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: { operatingMonthId: openMonthId, customerMemo: { startsWith: "Story 3.4" } },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
  }
}

async function upsertPolicy(courseId: string, data: Record<string, unknown>) {
  const policy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
  if (policy) {
    await (prisma as any).coursePolicy.update({ where: { id: policy.id }, data });
  } else {
    await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...data } });
  }
}

async function seedStoryData(): Promise<SeededData> {
  await seedAccount({ accountId: "story34_admin", role: "administrator", password: "Story34!admin", staffCode: "E2E34-ADM-001", displayName: "E2E34 관리자" });
  await seedAccount({ accountId: "story34_readonly", role: "read_only_viewer", password: "Story34!readonly", staffCode: "E2E34-RO-001", displayName: "E2E34 조회" });
  await seedAccount({ accountId: "story34_waiter", role: "waiter", password: "Story34!waiter", staffCode: "E2E34-WTR-001", displayName: "E2E34 웨이터" });
  await seedAccount({ accountId: "story34_counter", role: "counter", password: "Story34!counter", staffCode: "E2E34-CTR-001", displayName: "E2E34 카운터" });
  await seedAccount({
    accountId: "story34_settlement",
    role: "settlement_manager",
    password: "Story34!settlement",
    staffCode: "E2E34-SET-001",
    displayName: "E2E34 정산"
  });

  const { startDate, endDate } = monthBounds(monthKey);
  const openMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date(`${endDate}T00:00:00.000Z`), status: "작성중" },
    create: { monthKey, startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date(`${endDate}T00:00:00.000Z`), status: "작성중" }
  });
  await cleanupStoryCalls(openMonth.id);

  const rooms = await Promise.all(
    defaultRooms.map((room) =>
      (prisma as any).room.upsert({
        where: { sortOrder: room.sortOrder },
        update: { displayName: room.displayName, migrationReferenceName: room.migrationReferenceName, isActive: true },
        create: { displayName: room.displayName, migrationReferenceName: room.migrationReferenceName, sortOrder: room.sortOrder, isActive: true }
      })
    )
  );

  const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
  await upsertPolicy(course.id, {
    name: "Story34 A",
    durationMinutes: 60,
    basePrice: 1500000,
    opsCallCredit: 1,
    earcarePoolAmount: 0,
    requiresSecondTherapist: false,
    tvDisplayName: "S34 A60",
    effectiveToMonth: null,
    isActive: true
  });

  const attentionCourse = await (prisma as any).course.upsert({ where: { code: "E2E34-Z" }, update: { isActive: true }, create: { code: "E2E34-Z", isActive: true } });
  await upsertPolicy(attentionCourse.id, {
    name: "Story34 종료확인",
    durationMinutes: 0,
    basePrice: 0,
    opsCallCredit: 0,
    earcarePoolAmount: 0,
    requiresSecondTherapist: false,
    tvDisplayName: "S34 종료",
    effectiveToMonth: null,
    isActive: true
  });

  const therapistSortOrder = await storyEmployeeSortOrder("THERAPIST", "E2E34-THR-001", 93450);
  const therapist = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E34-THR-001" },
    update: {
      displayName: "E2E34 마사지사",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: therapistSortOrder,
      isActive: true
    },
    create: {
      staffCode: "E2E34-THR-001",
      displayName: "E2E34 마사지사",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: therapistSortOrder,
      isActive: true
    }
  });

  for (const [code, label, sortOrder] of [
    ["예약", "예약", 93401],
    ["사용중", "사용중", 93402],
    ["청소중", "청소중", 93403],
    ["VISIT_COMPLETE", "방문완료", 93404],
    ["NO_SHOW", "노쇼", 93405],
    ["CANCELED", "취소", 93406]
  ] as const) {
    await upsertCodeItem("SERVICE_STATUS", code, label, sortOrder);
  }

  return {
    openMonthId: openMonth.id,
    courseId: course.id,
    attentionCourseId: attentionCourse.id,
    therapistId: therapist.id,
    roomIds: rooms.map((room: { id: string }) => room.id)
  };
}

async function createCall(input: { roomId: string; status: string; startTime: string; memo: string; courseId?: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: seededData.openMonthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      roomId: input.roomId,
      courseId: input.courseId ?? seededData.courseId,
      customerMemo: input.memo,
      status: input.status
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: seededData.therapistId }
  });
}

test.describe("Story 3.4 TV fullscreen board", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    seededData = await seedStoryData();
    const operatingMinutes = currentOperatingMinutes();
    const activeStart = operatingMinutesToTime(Math.max(operatingMinutes - 30, OPERATING_DAY_START_MINUTES));
    const futureStart = operatingMinutesToTime(operatingMinutes + 60);

    await createCall({ roomId: seededData.roomIds[0], status: "예약", startTime: futureStart, memo: "Story 3.4 reserved" });
    await createCall({ roomId: seededData.roomIds[1], status: "사용중", startTime: activeStart, memo: "Story 3.4 in use" });
    await createCall({ roomId: seededData.roomIds[2], status: "청소중", startTime: activeStart, memo: "Story 3.4 cleaning" });
    await createCall({
      roomId: seededData.roomIds[3],
      status: "사용중",
      startTime: activeStart,
      memo: "Story 3.4 attention",
      courseId: seededData.attentionCourseId
    });
  });

  test("allows read-only users to view /tv without ERP chrome and with 11 large cards", async ({ page }) => {
    await page.clock.install({ time: Date.now() });
    await login(page, "story34_readonly", "Story34!readonly");
    await page.goto(`/tv?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`);

    await expect(page).toHaveURL(/\/tv(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "TV 현황판" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" })).toHaveCount(0);
    await expect(page.getByText("ERP 운영")).toHaveCount(0);
    await expect(page.getByText("역할별 ERP 업무")).toHaveCount(0);
    await expect(page.getByTestId("room-status-card")).toHaveCount(11);
    await expect(page.getByLabel("상태: 예약").filter({ hasText: "◷" })).toBeVisible();
    await expect(page.getByLabel("상태: 사용중").filter({ hasText: "●" })).toBeVisible();
    await expect(page.getByLabel("상태: 종료확인").filter({ hasText: "⚠" })).toBeVisible();
    await expect(page.getByLabel("상태: 청소중").filter({ hasText: "◐" })).toBeVisible();
    await expect(page.getByLabel("상태: 빈방").filter({ hasText: "○" }).first()).toBeVisible();
    await expect(page.getByText("S34 A60").first()).toBeVisible();
    await expect(page.getByText("E2E34 마사지사").first()).toBeVisible();
    await expect(page.getByText("결제·확인 필요")).toBeVisible();
    await expect(page.getByTestId("room-status-card").first().locator("h2")).toHaveClass(/text-\[40px\]/);
    await expect(page.getByLabel("실시간 갱신 상태")).toContainText(/마지막 갱신|갱신 중|갱신 지연/);
    await expect(page.getByLabel("실시간 갱신 상태")).toContainText(/갱신 지연|마지막 갱신|갱신 중/);
    await expect(page.getByRole("button", { name: "새로고침" })).toBeVisible();
    await page.clock.fastForward(46_000);
    await expect(page.getByLabel("실시간 갱신 상태")).toContainText("갱신 지연");

    await page.getByTestId("room-status-card").first().click();
    await expect(page.getByRole("heading", { name: "콜 원장 그리드" })).toHaveCount(0);
    await expect(page.getByText("저장중")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /저장|수정|입력|정산|마감/ })).toHaveCount(0);
  });

  test("allows administrators but redirects unauthorized roles away from /tv", async ({ page }) => {
    await login(page, "story34_admin", "Story34!admin");
    await page.goto(`/tv?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`);
    await expect(page).toHaveURL(/\/tv(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "TV 현황판" })).toBeVisible();

    await login(page, "story34_waiter", "Story34!waiter");
    await page.goto(`/tv?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`);
    await expect(page).toHaveURL(/\/rooms(?:\?|$)/);

    await login(page, "story34_counter", "Story34!counter");
    await page.goto(`/tv?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`);
    await expect(page).toHaveURL(/\/calls(?:\?|$)/);

    await login(page, "story34_settlement", "Story34!settlement");
    await page.goto(`/tv?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`);
    await expect(page).toHaveURL(/\/settlements(?:\?|$)/);
  });

  test.afterAll(async () => {
    // 이 스펙이 시드한 콜을 메모 prefix 범위로 정리한 뒤 연결을 닫는다.
    await cleanupStoryCalls(seededData.openMonthId);
    await prisma.$disconnect();
  });
});
