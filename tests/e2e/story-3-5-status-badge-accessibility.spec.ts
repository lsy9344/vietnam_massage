import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions } from "./support/auth";
import { defaultRooms } from "@/modules/masters/room-schema";


const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const OPERATING_DAY_START_MINUTES = 11 * 60;

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
const statusAriaLabels = ["상태: 예약", "상태: 사용중", "상태: 청소중", "상태: 종료확인", "상태: 빈방"] as const;
const tvRampClasses = ["text-[40px]", "text-[28px]", "text-[22px]"] as const;

function statusSurfacePaths() {
  return [
    `/live?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`,
    `/rooms?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`,
    `/tv?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`
  ] as const;
}

async function login(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill("story35_admin");
  await page.getByLabel("비밀번호").fill("Story35!admin");
  await page.getByRole("button", { name: "로그인" }).click();
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

  throw new Error(`No Story 3.5 employee sortOrder available for ${employeeGroup}:${staffCode}`);
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

  throw new Error(`No Story 3.5 code sortOrder available for ${codeType}:${code}`);
}

async function seedAccount() {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E35-ADM-001" },
    update: {
      displayName: "E2E35 관리자",
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await storyEmployeeSortOrder("OPERATIONS", "E2E35-ADM-001", 93500),
      isActive: true
    },
    create: {
      staffCode: "E2E35-ADM-001",
      displayName: "E2E35 관리자",
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await storyEmployeeSortOrder("OPERATIONS", "E2E35-ADM-001", 93500),
      isActive: true
    }
  });
  const passwordHash = await hash("Story35!admin", argon2idOptions);

  return (prisma as any).userAccount.upsert({
    where: { accountId: "story35_admin" },
    update: {
      email: "story35_admin@example.local",
      passwordHash,
      role: "administrator",
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: "story35_admin@example.local",
      accountId: "story35_admin",
      passwordHash,
      role: "administrator",
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
    where: { operatingMonthId: openMonthId, customerMemo: { startsWith: "Story 3.5" } },
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
  await seedAccount();
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
    name: "Story35 A",
    durationMinutes: 60,
    basePrice: 1500000,
    opsCallCredit: 1,
    earcarePoolAmount: 0,
    requiresSecondTherapist: false,
    tvDisplayName: "S35 A60",
    effectiveToMonth: null,
    isActive: true
  });

  const attentionCourse = await (prisma as any).course.upsert({ where: { code: "E2E35-Z" }, update: { isActive: true }, create: { code: "E2E35-Z", isActive: true } });
  await upsertPolicy(attentionCourse.id, {
    name: "Story35 종료확인",
    durationMinutes: 0,
    basePrice: 0,
    opsCallCredit: 0,
    earcarePoolAmount: 0,
    requiresSecondTherapist: false,
    tvDisplayName: "S35 종료",
    effectiveToMonth: null,
    isActive: true
  });

  const therapist = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E35-THR-001" },
    update: {
      displayName: "E2E35 마사지사",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await storyEmployeeSortOrder("THERAPIST", "E2E35-THR-001", 93550),
      isActive: true
    },
    create: {
      staffCode: "E2E35-THR-001",
      displayName: "E2E35 마사지사",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await storyEmployeeSortOrder("THERAPIST", "E2E35-THR-001", 93550),
      isActive: true
    }
  });

  for (const [code, label, sortOrder] of [
    ["예약", "예약", 93501],
    ["사용중", "사용중", 93502],
    ["청소중", "청소중", 93503],
    ["VISIT_COMPLETE", "방문완료", 93504],
    ["NO_SHOW", "노쇼", 93505],
    ["CANCELED", "취소", 93506]
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

async function expectStatusBadge(page: Page, label: string, glyph: string) {
  await expect(page.getByLabel(`상태: ${label}`).filter({ hasText: glyph }).first()).toBeVisible();
}

test.describe("Story 3.5 status badge accessibility", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    seededData = await seedStoryData();
    const operatingMinutes = currentOperatingMinutes();
    const activeStart = operatingMinutesToTime(Math.max(operatingMinutes - 30, OPERATING_DAY_START_MINUTES));
    const futureStart = operatingMinutesToTime(operatingMinutes + 60);

    await createCall({ roomId: seededData.roomIds[0], status: "예약", startTime: futureStart, memo: "Story 3.5 reserved" });
    await createCall({ roomId: seededData.roomIds[1], status: "사용중", startTime: activeStart, memo: "Story 3.5 in use" });
    await createCall({ roomId: seededData.roomIds[2], status: "청소중", startTime: activeStart, memo: "Story 3.5 cleaning" });
    await createCall({
      roomId: seededData.roomIds[3],
      status: "사용중",
      startTime: activeStart,
      memo: "Story 3.5 attention",
      courseId: seededData.attentionCourseId
    });
  });

  test("renders shared label and glyph status badges on /live, /rooms, and /tv", async ({ page }) => {
    await login(page);

    for (const path of statusSurfacePaths()) {
      await page.goto(path);
      await expect(page.getByTestId("room-status-card")).toHaveCount(11);
      await expectStatusBadge(page, "예약", "◷");
      await expectStatusBadge(page, "사용중", "●");
      await expectStatusBadge(page, "청소중", "◐");
      await expectStatusBadge(page, "종료확인", "⚠");
      await expectStatusBadge(page, "빈방", "○");
      await expect(page.getByText("결제·확인 필요")).toBeVisible();
    }
  });

  test("keeps cleaning, empty, and complete-check token pairings accessible on every surface", async ({ page }) => {
    await login(page);
    const forbiddenWhite = "text-" + "white";

    for (const path of statusSurfacePaths()) {
      await page.goto(path);

      const cleaning = page.getByLabel("상태: 청소중").first();
      await expect(cleaning).toHaveClass(/bg-status-cleaning/);
      await expect(cleaning).toHaveClass(/text-status-cleaning-foreground/);
      await expect(cleaning).not.toHaveClass(new RegExp(forbiddenWhite));

      const empty = page.getByLabel("상태: 빈방").first();
      await expect(empty).toHaveClass(/border-status-empty/);
      await expect(empty).toHaveClass(/bg-surface/);
      await expect(empty).toHaveClass(/text-status-empty-foreground/);

      const emptyCard = page.getByTestId("room-status-card").filter({ has: page.getByLabel("상태: 빈방") }).first();
      await expect(emptyCard).toHaveClass(/border-dashed/);
      await expect(emptyCard).toHaveClass(/border-status-empty/);
      await expect(emptyCard).toHaveClass(/bg-surface/);

      const attention = page.getByLabel("상태: 종료확인").first();
      await expect(attention).toHaveClass(/bg-status-complete-check/);
      await expect(attention).not.toHaveClass(/status-attention/);
      await expect(attention).not.toHaveClass(/bg-status-complete-check-glow/);
      const attentionBadgeAnimation = await attention.evaluate((element) => getComputedStyle(element).animationName);
      expect(attentionBadgeAnimation).toBe("none");

      const attentionCard = page.getByTestId("room-status-card").filter({ has: page.getByLabel("상태: 종료확인") }).first();
      await expect(attentionCard).toHaveClass(/status-attention/);
      await expect(attentionCard).toHaveClass(/border-status-complete-check/);
      const { animationName, boxShadow } = await attentionCard.evaluate((element) => {
        const ring = getComputedStyle(element, "::after");
        return { animationName: ring.animationName, boxShadow: ring.boxShadow };
      });
      expect(animationName).toBe("status-attention-breathe");
      expect(boxShadow).not.toBe("none");
    }
  });

  test("keeps status presentation surfaces read-only without mutation affordances", async ({ page }) => {
    await login(page);

    for (const path of statusSurfacePaths()) {
      await page.goto(path);

      const cards = page.getByTestId("room-status-card");
      await expect(cards).toHaveCount(11);
      await expect(cards.getByRole("button")).toHaveCount(0);
      await expect(cards.filter({ hasText: /저장|수정|삭제|자동저장|정산|마감|입력/ })).toHaveCount(0);
    }
  });

  test("disables attention animation under reduced motion while preserving the warning label and ring", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await login(page);
    await page.goto(`/rooms?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`);

    const attentionCard = page.getByTestId("room-status-card").filter({ has: page.getByLabel("상태: 종료확인") }).first();
    await expect(page.getByLabel("상태: 종료확인").filter({ hasText: "⚠" })).toBeVisible();
    await expect(page.getByText("결제·확인 필요")).toBeVisible();
    const styles = await attentionCard.evaluate((element) => {
      const style = getComputedStyle(element, "::after");
      return { animationName: style.animationName, boxShadow: style.boxShadow };
    });
    expect(styles.animationName).toBe("none");
    expect(styles.boxShadow).not.toBe("none");
  });

  test("keeps TV typography large enough and status meaning larger than a swatch", async ({ page }) => {
    await login(page);
    await page.goto(`/tv?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`);

    await expect(page.getByTestId("room-status-card").first().locator("h2")).toHaveClass(/text-\[40px\]/);
    await expect(page.getByLabel("상태: 사용중").first()).toHaveClass(/text-\[28px\]/);
    await expect(page.getByTestId("room-status-card").first().locator("p").first()).toHaveClass(/text-\[22px\]/);
    await expect(page.getByLabel("상태: 사용중").filter({ hasText: "●" })).toBeVisible();
    await expect(page.getByLabel("상태: 빈방").filter({ hasText: "○" }).first()).toBeVisible();
  });

  test.afterAll(async () => {
    // 이 스펙이 시드한 콜을 메모 prefix 범위로 정리한 뒤 연결을 닫는다.
    await cleanupStoryCalls(seededData.openMonthId);
    await prisma.$disconnect();
  });
});
