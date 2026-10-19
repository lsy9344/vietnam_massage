import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";

// 객실 평면도(.scratch/room-floor-plan/spec.md D3): 실시간 화면에서 방이나 빈방 칩을 누르면 오른쪽 서랍에 객실 카드가 뜬다.
// Esc·뒤 덮개·닫기로 닫고 포커스는 누른 자리로 돌아간다. 자동 갱신 뒤에도 열린 서랍이 새 값을 보이고, 방이 사라지면 닫힌다.
// 다른 현장 스펙과 겹치지 않게 지난 날짜(2025-03)와 이 스펙 전용 객실(번호 없는 "FP 객실")을 쓴다.
const account = { accountId: "fp_admin", password: "FloorPlan!admin" };
const monthKey = "2025-03";
const serviceDate = "2025-03-19";
const extraRoomName = "FP 객실";

let monthId = "";
let createdMonth = false;
let reservedCallId = "";
let extraRoomId = "";

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, sortOrder: number) {
  return testEmployees.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, isActive: true },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position: employeeGroup === "THERAPIST" ? "마사지사" : "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

async function seedAccount() {
  const employee = await seedEmployee("E2E-FP-ADMIN", "FP 관리자", "OPERATIONS", 9801);
  const data = {
    email: `${account.accountId}@example.local`,
    passwordHash: await hash(account.password, argon2idOptions),
    role: "administrator",
    employeeId: employee.id,
    isActive: true,
    lockedUntil: null,
    failedLoginCount: 0
  };
  await (prisma as any).userAccount.upsert({
    where: { accountId: account.accountId },
    update: data,
    create: { ...data, accountId: account.accountId }
  });
}

async function createCall(input: { therapistId: string; roomId: string; courseId: string; status: string; startTime: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      roomId: input.roomId,
      courseId: input.courseId,
      customerMemo: "FP 평면도",
      status: input.status
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId }
  });
  return call.id as string;
}

async function cleanup() {
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
}

const livePath = () => `/live?operatingMonthId=${monthId}&serviceDate=${serviceDate}`;

/** 자동 갱신은 영업 시간(브라우저 시계)에만 돈다. 시계를 오후 2시(베트남)에 두고 30초를 넘겨 갱신을 부른다. */
async function openLiveInBusinessHours(page: Page) {
  await page.clock.install({ time: new Date("2026-10-19T07:00:00.000Z") });
  await page.goto(livePath());
  await expect(page.getByTestId("room-floor-plan")).toBeVisible();
}

async function autoRefresh(page: Page) {
  const refreshed = page.waitForResponse((response) => response.url().includes("/live") && response.request().method() === "GET");
  await page.clock.fastForward(31_000);
  await refreshed;
}

// 서랍이 열리면 바깥이 aria-hidden이라 역할로 찾을 수 없어 접근 이름 속성으로 찾는다.
function room(page: Page, name: string) {
  return page.locator(`button[data-testid="floor-plan-room"][aria-label^="${name}, "]`);
}

function drawer(page: Page) {
  return page.getByRole("dialog", { name: "선택한 객실" });
}

test.describe("객실 평면도 실시간 서랍", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount();
    createdMonth = !(await (prisma as any).operatingMonth.findUnique({ where: { monthKey } }));
    const month = await (prisma as any).operatingMonth.upsert({
      where: { monthKey },
      update: { status: "작성중" },
      create: {
        monthKey,
        startDate: new Date(`${monthKey}-01T00:00:00.000Z`),
        endDate: new Date(`${monthKey}-31T00:00:00.000Z`),
        status: "작성중"
      }
    });
    monthId = month.id;
    await cleanup();

    const room302 = await (prisma as any).room.findFirst({ where: { displayName: "302 호실", isActive: true } });
    const extraRoom = await (prisma as any).room.upsert({
      where: { sortOrder: 98801 },
      update: { displayName: extraRoomName, isActive: true },
      create: { displayName: extraRoomName, migrationReferenceName: "FP-ROOM", sortOrder: 98801, isActive: true }
    });
    extraRoomId = extraRoom.id;
    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
    const policy = {
      name: "FP A",
      durationMinutes: 60,
      basePrice: 1500000,
      requiresSecondTherapist: false,
      tvDisplayName: "FP A60",
      effectiveToMonth: null,
      isActive: true
    };
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policy } });
    }
    const therapist = await seedEmployee("E2E-FP-THR-1", "FP 마사지사", "THERAPIST", 9811);

    reservedCallId = await createCall({ therapistId: therapist.id, roomId: room302.id, courseId: course.id, status: "RESERVED", startTime: "14:00" });
    await createCall({ therapistId: therapist.id, roomId: extraRoom.id, courseId: course.id, status: "RESERVED", startTime: "16:00" });
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await (prisma as any).room.updateMany({ where: { id: extraRoomId }, data: { isActive: false } });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "FP A", effectiveFromMonth: monthKey } });
    if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  test("층 카드 네 개에 방이 실제 자리 순서로 놓이고, 배치에 없는 방은 기타 줄에 있다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await page.goto(livePath());

    const floors = page.getByTestId("room-floor-plan").locator("[data-floor]");
    await expect(floors.locator("h2")).toHaveText(["4층", "3층", "2층", "1층"]);
    const names = (floor: number) =>
      page
        .locator(`[data-floor="${floor}"] [data-testid="floor-plan-room"]`)
        .evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")?.split(", ")[0]));
    expect(await names(4)).toEqual(["402 호실", "401 호실"]);
    expect(await names(3)).toEqual(["303 호실", "302 호실", "301 호실"]);
    expect(await names(1)).toEqual(["103 호실", "102 호실", "101 호실"]);
    await expect(room(page, "302 호실")).toHaveAccessibleName("302 호실, 예약, 시작 14:00");

    const others = page.getByRole("group", { name: "기타" });
    await expect(others.getByRole("button", { name: `${extraRoomName}, 예약, 시작 16:00` })).toBeVisible();
    // 범례는 화면 낭독기에 숨긴다.
    await expect(page.locator(".floor-plan-legend")).toHaveAttribute("aria-hidden", "true");
  });

  test("TV는 1920×1080 한 화면(한국어·베트남어)에 평면도 2×2와 빈방 줄이 스크롤 없이 들어가고, 누르는 것이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await login(page, account.accountId, account.password);

    for (const [locale, freeNow] of [
      ["ko", "지금 빈방"],
      ["vi", "Trống ngay"]
    ] as const) {
      await setLocaleCookie(page, locale);
      await page.goto(`/tv?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
      const plan = page.getByTestId("room-floor-plan");
      await expect(plan.locator("[data-floor]")).toHaveCount(4);
      // 이 스펙의 기타 줄(FP 객실)까지 있어도 한 화면에 들어간다.
      await expect(plan.locator(".floor-plan-others")).toBeVisible();
      await expect(plan.getByText(freeNow)).toBeInViewport();
      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight - document.documentElement.clientHeight
      }));
      expect(overflow, locale).toEqual({ x: 0, y: 0 });
      // 빈방 줄은 평면도 아래이고, 범례와 버튼이 없다. 이름표에 담당 Therapist가 있다.
      expect(await plan.locator(".floor-plan-free").evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(
        await plan.locator(".floor-plan-floors").evaluate((element) => element.getBoundingClientRect().bottom)
      );
      await expect(plan.locator(".floor-plan-legend")).toHaveCount(0);
      await expect(plan.getByRole("button")).toHaveCount(0);
      await expect(plan.locator('[data-floor="3"] [data-testid="floor-plan-room"]').filter({ hasText: "302" })).toContainText("FP 마사지사");
    }
  });

  test("방을 누르면 서랍에 객실 카드가 뜨고, Esc·덮개·닫기로 닫으면 포커스가 그 방으로 돌아간다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await page.goto(livePath());

    const button = room(page, "302 호실");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const card = drawer(page).getByTestId("room-status-card");
    await expect(card).toContainText("302 호실");
    await expect(card).toContainText("FP A60");
    await expect(card).toContainText("FP 마사지사");
    // 원장 링크는 원장 권한 역할(관리자)에게 지금처럼 있다.
    await expect(card.getByRole("link", { name: "302 호실 14:00 콜을 원장에서 열기" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer(page)).toHaveCount(0);
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await button.click();
    await expect(drawer(page)).toBeVisible();
    await page.mouse.click(40, 450);
    await expect(drawer(page)).toHaveCount(0);
    await expect(button).toBeFocused();

    await button.click();
    await drawer(page).getByRole("button", { name: "닫기" }).click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  test("빈방 칩을 누르면 그 방 서랍이 뜨고 닫으면 칩으로 포커스가 돌아간다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await page.goto(livePath());

    const freeLine = page.getByRole("group", { name: "지금 빈방 · 곧 비는 방" });
    const chip = freeLine.getByRole("button", { name: "303 호실", exact: true });
    await chip.click();
    const card = drawer(page).getByTestId("room-status-card");
    await expect(card).toContainText("303 호실");
    await expect(card.getByLabel("상태: 빈방")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(chip).toBeFocused();
  });

  test("자동 갱신 뒤에도 열린 서랍이 새 값을 보이고, 그 방이 목록에서 없어지면 서랍이 닫힌다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLiveInBusinessHours(page);

    await room(page, "302 호실").click();
    await expect(drawer(page).getByTestId("room-status-card")).toContainText("14:00");
    await (prisma as any).serviceCall.update({ where: { id: reservedCallId }, data: { startTime: "15:30" } });
    await autoRefresh(page);
    await expect(drawer(page).getByTestId("room-status-card")).toContainText("15:30");
    // 서랍 뒤 평면도도 새 값이다(서랍이 열린 동안 바깥은 aria-hidden이라 속성으로 본다).
    await expect(room(page, "302 호실")).toHaveAttribute("aria-label", "302 호실, 예약, 시작 15:30");
    await expect(room(page, "302 호실")).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");

    await page.getByRole("group", { name: "기타" }).getByRole("button", { name: new RegExp(`^${extraRoomName}, `) }).click();
    await expect(drawer(page)).toBeVisible();
    await (prisma as any).room.update({ where: { id: extraRoomId }, data: { isActive: false } });
    await autoRefresh(page);
    await expect(drawer(page)).toHaveCount(0);
    await expect(page.getByRole("group", { name: "기타" })).toHaveCount(0);
  });

  test("휴대폰 폭(390px)에서도 가로 스크롤이 없고 좁은 칸은 배지 기호만 둔다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, account.accountId, account.password);
    await page.goto(livePath());

    await expect(page.getByTestId("room-floor-plan")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(room(page, "302 호실").locator(".floor-plan-badge-label")).toBeHidden();
    await expect(room(page, "302 호실").getByLabel("상태: 예약")).toBeVisible();
  });
});
