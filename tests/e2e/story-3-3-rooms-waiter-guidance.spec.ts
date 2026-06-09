import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { defaultRooms } from "@/modules/masters/room-schema";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vietnam_massage";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);
const argon2idOptions = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const OPERATING_DAY_START_MINUTES = 11 * 60;

function isoDateFromKst(date: Date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addIsoDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
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

type Role = "waiter" | "read_only_viewer";

type SeededData = {
  openMonthId: string;
  courseId: string;
  attentionCourseId: string;
  therapistId: string;
  roomIds: string[];
};

let seededData: SeededData;

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

  throw new Error(`No Story 3.3 employee sortOrder available for ${employeeGroup}:${staffCode}`);
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

  throw new Error(`No Story 3.3 code sortOrder available for ${codeType}:${code}`);
}

async function login(page: Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(accountId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

async function seedAccount(input: { accountId: string; role: Role; password: string; staffCode: string; displayName: string }) {
  const sortOrder = await storyEmployeeSortOrder("OPERATIONS", input.staffCode, input.role === "waiter" ? 93300 : 93301);
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: input.displayName,
      employeeGroup: "OPERATIONS",
      position: input.role === "waiter" ? "웨이터" : "조회",
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
      position: input.role === "waiter" ? "웨이터" : "조회",
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
    where: { operatingMonthId: openMonthId, customerMemo: { startsWith: "Story 3.3" } },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
  }
}

async function seedStoryData(): Promise<SeededData> {
  await seedAccount({
    accountId: "story33_waiter",
    role: "waiter",
    password: "Story33!waiter",
    staffCode: "E2E33-WTR-001",
    displayName: "E2E33 웨이터"
  });
  await seedAccount({
    accountId: "story33_readonly",
    role: "read_only_viewer",
    password: "Story33!readonly",
    staffCode: "E2E33-RO-001",
    displayName: "E2E33 조회"
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
        update: {
          displayName: room.displayName,
          migrationReferenceName: room.migrationReferenceName,
          isActive: true
        },
        create: {
          displayName: room.displayName,
          migrationReferenceName: room.migrationReferenceName,
          sortOrder: room.sortOrder,
          isActive: true
        }
      })
    )
  );
  const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
  const policy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
  const policyData = {
    name: "Story33 A",
    durationMinutes: 60,
    basePrice: 1500000,
    opsCallCredit: 1,
    earcarePoolAmount: 0,
    requiresSecondTherapist: false,
    tvDisplayName: "S33 A60",
    effectiveToMonth: null,
    isActive: true
  };
  if (policy) {
    await (prisma as any).coursePolicy.update({ where: { id: policy.id }, data: policyData });
  } else {
    await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policyData } });
  }

  const attentionCourse = await (prisma as any).course.upsert({ where: { code: "E2E33-Z" }, update: { isActive: true }, create: { code: "E2E33-Z", isActive: true } });
  const attentionPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: attentionCourse.id, effectiveFromMonth: monthKey } });
  const attentionPolicyData = {
    name: "Story33 종료확인",
    durationMinutes: 0,
    basePrice: 0,
    opsCallCredit: 0,
    earcarePoolAmount: 0,
    requiresSecondTherapist: false,
    tvDisplayName: "S33 종료",
    effectiveToMonth: null,
    isActive: true
  };
  if (attentionPolicy) {
    await (prisma as any).coursePolicy.update({ where: { id: attentionPolicy.id }, data: attentionPolicyData });
  } else {
    await (prisma as any).coursePolicy.create({ data: { courseId: attentionCourse.id, effectiveFromMonth: monthKey, ...attentionPolicyData } });
  }

  const therapistSortOrder = await storyEmployeeSortOrder("THERAPIST", "E2E33-THR-001", 93302);
  const therapist = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E33-THR-001" },
    update: {
      displayName: "E2E33 마사지사",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: therapistSortOrder,
      isActive: true
    },
    create: {
      staffCode: "E2E33-THR-001",
      displayName: "E2E33 마사지사",
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
    ["예약", "예약", 93301],
    ["사용중", "사용중", 93302],
    ["청소중", "청소중", 93303],
    ["VISIT_COMPLETE", "방문완료", 93304],
    ["NO_SHOW", "노쇼", 93305],
    ["CANCELED", "취소", 93306]
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

test.describe("Story 3.3 rooms waiter guidance", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    seededData = await seedStoryData();
    const operatingMinutes = currentOperatingMinutes();
    const activeStart = operatingMinutesToTime(Math.max(operatingMinutes - 30, OPERATING_DAY_START_MINUTES));
    const futureStart = operatingMinutesToTime(operatingMinutes + 60);

    await createCall({ roomId: seededData.roomIds[0], status: "예약", startTime: futureStart, memo: "Story 3.3 reserved" });
    await createCall({ roomId: seededData.roomIds[1], status: "사용중", startTime: activeStart, memo: "Story 3.3 in use" });
    await createCall({ roomId: seededData.roomIds[2], status: "청소중", startTime: activeStart, memo: "Story 3.3 cleaning" });
    await createCall({
      roomId: seededData.roomIds[3],
      status: "사용중",
      startTime: activeStart,
      memo: "Story 3.3 attention",
      courseId: seededData.attentionCourseId
    });
  });

  test("lands waiters on /rooms and hides unauthorized sidebar menus", async ({ page }) => {
    await login(page, "story33_waiter", "Story33!waiter");

    await expect(page).toHaveURL(/\/rooms(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "객실 현황" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: "객실 현황" })).toBeVisible();
    for (const hidden of ["콜/예약 입력 원장", "정산 화면", "월마감", "오늘 대시보드", "마스터 설정", "감사 로그"]) {
      await expect(page.getByRole("link", { name: hidden })).toHaveCount(0);
    }
  });

  test("renders read-only room cards with status labels, glyphs, guidance, and refresh state", async ({ page }) => {
    await login(page, "story33_waiter", "Story33!waiter");
    await page.goto(`/rooms?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`);

    await expect(page.getByRole("heading", { name: "객실 현황" })).toBeVisible();
    await expect(page.getByTestId("room-status-card")).toHaveCount(11);
    await expect(page.getByLabel("상태: 예약").filter({ hasText: "◷" })).toBeVisible();
    await expect(page.getByLabel("상태: 사용중").filter({ hasText: "●" })).toBeVisible();
    await expect(page.getByLabel("상태: 종료확인").filter({ hasText: "⚠" })).toBeVisible();
    await expect(page.getByLabel("상태: 청소중").filter({ hasText: "◐" })).toBeVisible();
    await expect(page.getByLabel("상태: 빈방").filter({ hasText: "○" }).first()).toBeVisible();
    await expect(page.getByText("서비스가 진행 중입니다.")).toBeVisible();
    await expect(page.getByText(/종료 확인|결제·확인|청소\/입실/)).toBeVisible();
    await expect(page.getByText(/즉시 가능|입실 가능합니다/)).toBeVisible();
    await expect(page.getByText("S33 A60").first()).toBeVisible();
    await expect(page.getByText("E2E33 마사지사").first()).toBeVisible();

    const inUseCard = page.getByLabel(/사용중/).filter({ hasText: "남은분" }).first();
    await expect(inUseCard).toContainText("남은분");
    await expect(inUseCard).toContainText(/0분|[1-9]\d*분/);
    await expect(inUseCard).not.toContainText("-");
    await expect(inUseCard).toContainText("종료예정");
    await expect(page.getByTestId("room-status-card").filter({ hasText: "빈방" }).first()).toContainText("-");
    await expect(page.getByLabel("실시간 갱신 상태")).toContainText(/마지막 갱신|갱신 중|갱신 지연/);
    await expect(page.getByRole("button", { name: "새로고침" })).toBeVisible();

    await page.getByTestId("room-status-card").first().click();
    await expect(page.getByRole("heading", { name: "콜 원장 그리드" })).toHaveCount(0);
    await expect(page.getByText("저장중")).toHaveCount(0);
    await expect(page.getByText("autosave", { exact: false })).toHaveCount(0);
  });

  test("allows read-only users on /rooms and redirects waiter direct routes back to /rooms", async ({ page }) => {
    await login(page, "story33_readonly", "Story33!readonly");
    await page.goto(`/rooms?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`);
    await expect(page).toHaveURL(/\/rooms(?:\?|$)/);
    await expect(page.getByTestId("room-status-card")).toHaveCount(11);

    await login(page, "story33_waiter", "Story33!waiter");
    for (const blockedPath of ["/calls", "/settlements", "/masters/rooms"]) {
      await page.goto(blockedPath);
      await expect(page).toHaveURL(/\/rooms(?:\?|$)/);
    }
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });
});
