import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { defaultRooms } from "@/modules/masters/room-schema";
import { isWithinLiveRefreshWindow } from "@/modules/rooms/room-status-refresh";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

function currentOperatingServiceDate(now = new Date()) {
  const vietnamTime = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  const day = vietnamTime.getUTCHours() < 11 ? new Date(vietnamTime.getTime() - 24 * 60 * 60 * 1000) : vietnamTime;
  return day.toISOString().slice(0, 10);
}

const monthKey = currentOperatingServiceDate().slice(0, 7);
// 다른 현장 스펙이 오늘 날짜의 같은 객실에 콜을 넣으므로, 병렬 실행에서 서로 덮지 않게 이 스펙은 다른 날짜를 쓴다.
const serviceDate = currentOperatingServiceDate().endsWith("-23") ? `${monthKey}-24` : `${monthKey}-23`;
const memoPrefix = "Ticket 04";
// 다른 스펙이 만든 객실도 같은 DB에 있을 수 있으므로 기본 객실만 센다.
const defaultRoomNames = new RegExp(defaultRooms.map((room) => room.displayName).join("|"));

const accounts = {
  admin: { accountId: "ticket04_admin", password: "Ticket04!admin", role: "administrator", staffCode: "E2E-T04-ADM", sortOrder: 94400 },
  waiter: { accountId: "ticket04_waiter", password: "Ticket04!waiter", role: "waiter", staffCode: "E2E-T04-WTR", sortOrder: 94400 }
} as const;

let monthId = "";

// 직원은 (직군, 정렬 순서)가 겹치면 안 되고 다른 스펙도 같은 DB에 직원을 넣으므로, 비어 있는 정렬 순서를 찾는다.
async function freeEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({ where: { employeeGroup, sortOrder, NOT: { staffCode } }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }
  throw new Error(`No Ticket 04 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedAccount(account: (typeof accounts)[keyof typeof accounts]) {
  const employee = await testEmployees.upsert({
    where: { staffCode: account.staffCode },
    update: { isActive: true },
    create: {
      staffCode: account.staffCode,
      displayName: `E2E T04 ${account.role}`,
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await freeEmployeeSortOrder("OPERATIONS", account.staffCode, account.sortOrder),
      isActive: true
    }
  });
  const passwordHash = await hash(account.password, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: account.accountId },
    update: { passwordHash, role: account.role, employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      email: `${account.accountId}@example.local`,
      accountId: account.accountId,
      passwordHash,
      role: account.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function cleanupCalls() {
  const calls = await (prisma as any).serviceCall.findMany({ where: { customerMemo: { startsWith: memoPrefix } }, select: { id: true } });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length === 0) return;
  await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
}

async function seed() {
  await seedAccount(accounts.admin);
  await seedAccount(accounts.waiter);
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const openMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { status: "작성중" },
    create: {
      monthKey,
      startDate: new Date(`${monthKey}-01T00:00:00.000Z`),
      endDate: new Date(`${monthKey}-${String(lastDay).padStart(2, "0")}T00:00:00.000Z`),
      status: "작성중"
    }
  });
  monthId = openMonth.id;
  await cleanupCalls();

  const rooms = await Promise.all(
    defaultRooms.map((room) =>
      (prisma as any).room.upsert({
        where: { sortOrder: room.sortOrder },
        update: { displayName: room.displayName, isActive: true },
        create: { displayName: room.displayName, migrationReferenceName: room.migrationReferenceName, sortOrder: room.sortOrder, isActive: true }
      })
    )
  );
  const course = await (prisma as any).course.upsert({ where: { code: "E2E-T04" }, update: { isActive: true }, create: { code: "E2E-T04", isActive: true } });
  const policy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
  const policyData = {
    name: "Ticket04 B90",
    durationMinutes: 90,
    basePrice: 0,
    requiresSecondTherapist: false,
    tvDisplayName: "T04 B90 스톤 테라피",
    effectiveToMonth: null,
    isActive: true
  };
  if (policy) await (prisma as any).coursePolicy.update({ where: { id: policy.id }, data: policyData });
  else await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policyData } });

  const therapists = [];
  for (const [index, name] of ["Mai", "Linh", "Thu"].entries()) {
    const staffCode = `E2E-T04-THR-${index}`;
    therapists.push(
      await testEmployees.upsert({
        where: { staffCode },
        update: { isActive: true },
        create: {
          staffCode,
          displayName: `T04 ${name}`,
          employeeGroup: "THERAPIST",
          position: "마사지사",
          shiftType: "전체",
          baseSalary: 0,
          employmentStatus: "재직",
          sortOrder: await freeEmployeeSortOrder("THERAPIST", staffCode, 94410),
          isActive: true
        }
      })
    );
  }

  // 마사지사마다 콜 하나라 표시 종료가 서로 당겨지지 않는다.
  for (const [roomIndex, therapistIndex, status, startTime] of [
    [0, 0, "사용중", "20:00"],
    [3, 1, "예약", "21:00"],
    [5, 2, "청소중", "19:00"]
  ] as const) {
    const call = await (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: monthId,
        serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
        startTime,
        roomId: rooms[roomIndex].id,
        courseId: course.id,
        customerMemo: `${memoPrefix} ${status}`,
        status
      }
    });
    await (prisma as any).serviceCallAssignment.create({
      data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: therapists[therapistIndex].id }
    });
  }
}

function floorPath(path: "/live" | "/rooms" | "/tv") {
  return `${path}?operatingMonthId=${monthId}&serviceDate=${serviceDate}`;
}

async function documentOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe("Ticket 04 floor screens", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seed();
  });

  for (const path of ["/rooms", "/live"] as const) {
    test(`keeps the last update in the toolbar and shows a stale notice once updates stop on ${path}`, async ({ page }) => {
      // 영업 시간 외(03:00~11:00)에는 자동 갱신을 멈추고 오래된 상태를 지연으로 보지 않는다.
      test.skip(!isWithinLiveRefreshWindow(new Date()), "자동 갱신이 도는 영업 시간에만 갱신 지연이 뜬다");
      await page.clock.install({ time: Date.now() });
      await login(page, accounts.admin.accountId, accounts.admin.password);
      await page.goto(floorPath(path));

      const toolbar = page.locator("header.screen-toolbar");
      await expect(toolbar.getByLabel("실시간 갱신 상태")).toContainText(/마지막 갱신: \d{2}:\d{2}:\d{2}/);
      await expect(toolbar.getByRole("button", { name: "새로고침" })).toBeVisible();
      const notice = page.getByRole("status").filter({ hasText: "이후로 객실 상태를 새로 받지 못했습니다" });
      await expect(notice).toHaveCount(0);

      // 지연 판정은 자동 갱신 주기(30초)의 3배인 90초다. 브라우저 시계만 넘기므로 서버가 다시 준 마지막 갱신도 95초 전이 된다.
      await page.clock.fastForward(95_000);
      await expect(toolbar.getByLabel("실시간 갱신 상태")).toContainText("갱신 지연");
      await expect(notice).toBeVisible();
      await expect(notice).toContainText("화면의 상태가 지금과 다를 수 있습니다");
    });
  }

  test("reads as short floor cards at phone width and never scrolls the page sideways", async ({ page }) => {
    await login(page, accounts.admin.accountId, accounts.admin.password);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(floorPath("/live"));
    // 실시간 객실판은 층별 평면도다(.scratch/room-floor-plan). 기본 객실은 모두 층 카드 안 제자리에 있다.
    const placedRooms = page.locator('[data-floor] [data-testid="floor-plan-room"]');
    await expect(placedRooms).toHaveCount(defaultRooms.length);
    // 코스·담당자·시각은 방을 눌러 연 서랍의 객실 카드에 있다.
    await page.locator('[data-testid="floor-plan-room"][aria-label^="401 호실, "]').click();
    const inUseCard = page.getByRole("dialog", { name: "선택한 객실" }).getByTestId("room-status-card");
    await expect(inUseCard).toContainText("T04 Mai");
    await expect(inUseCard).toContainText("T04 B90 스톤 테라피");
    await expect(inUseCard).toContainText(/시작\s*20:00/);
    await page.keyboard.press("Escape");
    // 휴대폰에서 층 카드는 한 손 화면 안에 여러 층이 보이는 짧은 카드다.
    for (const box of await page.locator("[data-floor]").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()))) {
      expect(box.height).toBeLessThanOrEqual(200);
      expect(box.width).toBeLessThanOrEqual(390);
    }
    // 객실판은 /rooms에서는 객실 카드, 평면도 화면에서는 방 이름표다.
    const boardItems = page.locator('[data-testid="room-status-card"], [data-testid="floor-plan-room"]');

    for (const locale of ["ko", "vi"] as const) {
      await setLocaleCookie(page, locale);
      for (const width of [390, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of ["/live", "/rooms", "/tv"] as const) {
          await page.goto(floorPath(path));
          await expect(boardItems.first()).toBeVisible();
          expect(await documentOverflow(page), `${locale} ${path} @${width}`).toBe(0);
        }
      }
    }
  });

  test("keeps the waiter's rooms screen to room status only", async ({ page }) => {
    await login(page, accounts.waiter.accountId, accounts.waiter.password);
    await page.goto(floorPath("/rooms"));

    await expect(page.getByTestId("room-status-card").filter({ hasText: defaultRoomNames })).toHaveCount(defaultRooms.length);
    // 예약·청소중은 시각이 지나도 바뀌지 않는다(사용중은 그 날짜가 지나면 종료확인이 된다).
    await expect(page.getByLabel("상태별 객실 수")).toContainText(/예약\s*1실/);
    await expect(page.getByLabel("상태별 객실 수")).toContainText(/청소중\s*1실/);
    await expect(page.getByLabel("실시간 갱신 상태")).toContainText(/마지막 갱신|갱신 중|갱신 지연|자동 갱신 중지/);
    // 금액, 고객/메모, TV 열기, 원장 링크는 없다.
    await expect(page.getByText("VND")).toHaveCount(0);
    await expect(page.getByText(memoPrefix)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "TV 화면 열기" })).toHaveCount(0);
    await expect(page.locator('a[href^="/calls"]')).toHaveCount(0);
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanupCalls();
    await prisma.$disconnect();
  });
});
