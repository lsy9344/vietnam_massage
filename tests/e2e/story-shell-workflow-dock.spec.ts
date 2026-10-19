import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 티켓 02: 업무 흐름 도크, "나" 메뉴, 구역 사이 날짜 유지, 건너뛰기 링크, 좁은 폭.
const roles = ["administrator", "counter", "settlement_manager", "waiter", "read_only_viewer"] as const;
type Role = (typeof roles)[number];

const accounts: Record<Role, { accountId: string; password: string; displayName: string }> = {
  administrator: { accountId: "shell02_admin", password: "Shell02!admin", displayName: "셸02 관리자" },
  counter: { accountId: "shell02_counter", password: "Shell02!counter", displayName: "셸02 카운터" },
  settlement_manager: { accountId: "shell02_settlement", password: "Shell02!settlement", displayName: "셸02 정산" },
  waiter: { accountId: "shell02_waiter", password: "Shell02!waiter", displayName: "셸02 웨이터" },
  read_only_viewer: { accountId: "shell02_viewer", password: "Shell02!viewer", displayName: "셸02 조회" }
};

const expectedDock: Record<Role, { landing: RegExp; zones: string[]; firstHeading: string }> = {
  administrator: { landing: /\/live$/, zones: ["원장", "현장", "고객", "정산", "마감", "보고", "설정"], firstHeading: "첫화면 실시간 현황" },
  counter: { landing: /\/calls$/, zones: ["원장", "현장", "고객", "보고"], firstHeading: "콜/예약 입력 원장" },
  settlement_manager: { landing: /\/settlements$/, zones: ["정산", "마감", "보고"], firstHeading: "마사지사 일일정산" },
  waiter: { landing: /\/rooms$/, zones: [], firstHeading: "객실 현황" },
  read_only_viewer: { landing: /\/rooms$/, zones: ["현장", "보고", "설정"], firstHeading: "객실 현황" }
};

const allZones = ["원장", "현장", "고객", "정산", "마감", "보고", "설정"];

let monthId = "";
const monthKey = "2081-03";
const chosenDate = "2081-03-14";

function dock(page: Page) {
  return page.getByRole("navigation", { name: "업무 이동" });
}

// 도크 줄의 구역 항목. 화면이 하나인 구역은 링크, 둘 이상인 구역은 화면 메뉴를 여는 버튼이다.
function dockZones(page: Page) {
  return dock(page).locator("[data-dock-zone]:visible");
}

function dockZone(page: Page, name: string) {
  return dockZones(page).filter({ hasText: new RegExp(`^${name}$`) });
}

function zoneMenu(page: Page, zone: string) {
  return page.getByRole("group", { name: `${zone} 화면` });
}

async function seedAccount(role: Role) {
  const account = accounts[role];
  const staffCode = `E2E-SHELL02-${role.toUpperCase()}`;
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName: account.displayName, isActive: true },
    create: {
      staffCode,
      displayName: account.displayName,
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 8100 + roles.indexOf(role),
      isActive: true
    }
  });
  const passwordHash = await hash(account.password, argon2idOptions);
  const data = {
    email: `${account.accountId}@example.local`,
    passwordHash,
    role,
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

test.describe("티켓 02 업무 흐름 셸", () => {
  test.beforeAll(async () => {
    for (const role of roles) {
      await seedAccount(role);
    }
    const month = await (prisma as any).operatingMonth.upsert({
      where: { monthKey },
      update: {},
      create: {
        monthKey,
        startDate: new Date(`${monthKey}-01T00:00:00.000Z`),
        endDate: new Date(`${monthKey}-31T00:00:00.000Z`),
        status: "작성중"
      }
    });
    monthId = month.id;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  for (const role of roles) {
    test(`${role}는 첫 화면에서 들어갈 수 있는 구역만 업무 순서대로 본다`, async ({ page }) => {
      const expected = expectedDock[role];
      await login(page, accounts[role].accountId, accounts[role].password);
      await expect(page).toHaveURL(expected.landing);
      await expect(page.getByRole("heading", { name: expected.firstHeading, level: 1 })).toBeVisible();

      if (expected.zones.length === 0) {
        await expect(dock(page)).toHaveCount(0);
        return;
      }
      await expect(dockZones(page)).toHaveText(expected.zones);
      for (const zone of allZones.filter((zone) => !expected.zones.includes(zone))) {
        await expect(dockZone(page, zone)).toHaveCount(0);
      }
    });
  }

  test("도크는 화면 아래에 붙어 있고 사이드바·상단바와 최소 너비 1280px가 없다", async ({ page }) => {
    await login(page, accounts.administrator.accountId, accounts.administrator.password);
    const viewport = page.viewportSize();
    const box = await dock(page).boundingBox();
    // design.md 6.1: 도크는 화면 아래 가장자리에서 12px(--dock-inset) 떨어져 떠 있다.
    expect(box && viewport ? Math.round(box.y + box.height) : 0).toBe((viewport?.height ?? 0) - 12);
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" })).toHaveCount(0);
    await expect(dockZone(page, "현장")).toHaveAttribute("aria-current", "true");
    expect(await page.evaluate(() => getComputedStyle(document.body).minWidth)).not.toBe("1280px");
  });

  test("나 메뉴에서 표시 이름과 역할을 보고 로그아웃하면 세션이 끝난다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await dock(page).getByRole("button", { name: "나", exact: true }).click();
    const meMenu = page.getByRole("group", { name: "내 계정" });
    await expect(meMenu.getByText(accounts.counter.displayName)).toBeVisible();
    await expect(meMenu.getByText("카운터", { exact: true })).toBeVisible();
    await expect(meMenu.getByRole("group", { name: "화면 언어 전환" })).toBeVisible();

    await meMenu.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto("/calls");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("도크 맨 앞 로고는 첫 화면으로 가고, 840px 미만에서는 로고가 나 메뉴에서만 보인다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto("/customers");
    const brand = dock(page).getByRole("link", { name: "GANGNAM SPA 첫 화면" });
    await brand.click();
    await expect(page).toHaveURL(expectedDock.counter.landing);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(brand).toBeHidden();
    await dock(page).getByRole("button", { name: "나", exact: true }).click();
    await expect(page.getByRole("group", { name: "내 계정" }).getByRole("img", { name: "GANGNAM SPA" })).toBeVisible();
  });

  test("웨이터는 도크 없이 객실 도구줄의 나 메뉴로 로그아웃한다", async ({ page }) => {
    await login(page, accounts.waiter.accountId, accounts.waiter.password);
    await page.getByRole("button", { name: "나", exact: true }).click();
    await expect(page.getByRole("group", { name: "내 계정" }).getByText("웨이터", { exact: true })).toBeVisible();
    await page.getByRole("group", { name: "내 계정" }).getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("도크의 구역 메뉴로 화면을 옮겨도 고른 운영월·날짜가 유지되고, 원장 메뉴의 원장은 원장 탭으로 열린다", async ({ page }) => {
    await login(page, accounts.administrator.accountId, accounts.administrator.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${chosenDate}&customerQuery=shell02`);

    await dockZone(page, "현장").click();
    await zoneMenu(page, "현장").getByRole("link", { name: "객실" }).click();
    await expect(page).toHaveURL(`/rooms?operatingMonthId=${monthId}&serviceDate=${chosenDate}`);
    await expect(page.getByLabel("조회날짜")).toHaveValue(chosenDate);

    await dockZone(page, "정산").click();
    await zoneMenu(page, "정산").getByRole("link", { name: "운영팀 일일" }).click();
    await expect(page).toHaveURL(`/settlements/operations?operatingMonthId=${monthId}&attendanceDate=${chosenDate}`);
    // 도구줄의 구역 안 탭도 그대로 쓴다.
    await page.getByRole("navigation", { name: "정산 화면" }).getByRole("link", { name: "Therapist" }).click();
    await expect(page).toHaveURL(`/settlements?operatingMonthId=${monthId}&serviceDate=${chosenDate}`);

    await dockZone(page, "원장").click();
    await zoneMenu(page, "원장").getByRole("link", { name: "원장", exact: true }).click();
    await expect(page).toHaveURL(`/calls?operatingMonthId=${monthId}&serviceDate=${chosenDate}`);
    await expect(page.getByLabel("조회날짜")).toHaveValue(chosenDate);
  });

  test("화면이 둘 이상인 구역을 누르면 그 구역 위에 화면 메뉴가 뜨고, 화면을 고르거나 Esc나 바깥을 누르면 닫힌다", async ({ page }) => {
    await login(page, accounts.administrator.accountId, accounts.administrator.password);
    const viewport = page.viewportSize();
    const dockBox = await dock(page).boundingBox();

    for (const zone of ["정산", "설정"]) {
      await dockZone(page, zone).click();
      const zoneBox = await dockZone(page, zone).boundingBox();
      const menuBox = await zoneMenu(page, zone).boundingBox();
      // 메뉴는 도크 위에 뜨고, 누른 구역과 가로로 겹치며, 오른쪽 끝 구역에서도 화면 안에 있다.
      expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual(dockBox?.y ?? 0);
      expect(menuBox?.x ?? 0).toBeLessThanOrEqual((zoneBox?.x ?? 0) + (zoneBox?.width ?? 0));
      expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeGreaterThanOrEqual(zoneBox?.x ?? 0);
      expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);

      await page.keyboard.press("Escape");
      await expect(zoneMenu(page, zone)).toBeHidden();
      await expect(dockZone(page, zone)).toBeFocused();
    }

    await dockZone(page, "보고").click();
    await expect(zoneMenu(page, "보고")).toBeVisible();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(zoneMenu(page, "보고")).toBeHidden();

    await dockZone(page, "정산").click();
    await expect(zoneMenu(page, "정산").getByRole("link")).toHaveText(["근무표", "Therapist", "운영팀 일일", "운영팀 월", "공지"]);
    await zoneMenu(page, "정산").getByRole("link", { name: "운영팀 월" }).click();
    await expect(page).toHaveURL(/\/settlements\/operations\/monthly/);
    await expect(zoneMenu(page, "정산")).toBeHidden();
    await dockZone(page, "정산").click();
    await expect(zoneMenu(page, "정산").getByRole("link", { name: "운영팀 월" })).toHaveAttribute("aria-current", "page");
  });

  test("도구줄의 이전·다음 날 링크로 날짜를 옮긴다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/rooms?operatingMonthId=${monthId}&serviceDate=${chosenDate}`);

    await page.getByRole("link", { name: "다음 날" }).click();
    await expect(page).toHaveURL(`/rooms?operatingMonthId=${monthId}&serviceDate=2081-03-15`);
    await page.getByRole("link", { name: "이전 날" }).click();
    await expect(page).toHaveURL(`/rooms?operatingMonthId=${monthId}&serviceDate=${chosenDate}`);
    await expect(page.getByRole("link", { name: "TV 화면 열기" })).toHaveAttribute(
      "href",
      `/tv?operatingMonthId=${monthId}&serviceDate=${chosenDate}`
    );
  });

  test("길게 스크롤하는 원장에서는 도구줄이 위에 붙어 있다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${chosenDate}`);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByRole("heading", { name: "콜/예약 입력 원장", level: 1 })).toBeInViewport();
    await expect(page.getByLabel("조회날짜")).toBeInViewport();
  });

  test("건너뛰기 링크로 본문과 업무 이동으로 바로 간다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    // 문서를 새로 읽어 포커스 시작점을 화면 맨 앞으로 둔다.
    await page.reload();

    await page.keyboard.press("Tab");
    const skipToMain = page.getByRole("link", { name: "본문으로" });
    await expect(skipToMain).toBeFocused();
    await expect(skipToMain).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("link", { name: "업무 이동으로" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dock(page)).toBeFocused();
  });

  test("도크가 포커스된 요소를 가리지 않는다", async ({ page }) => {
    await login(page, accounts.administrator.accountId, accounts.administrator.password);
    await page.goto("/masters/codes");
    const dockTop = (await dock(page).boundingBox())?.y ?? 0;

    // 본문의 마지막 조작 요소까지 키보드로 가서 도크 위에 보이는지 본다.
    const lastControl = page.locator("#main-content").locator("button, input, select, a[href]").last();
    await lastControl.focus();
    const box = await lastControl.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(dockTop);
  });

  test("840px 미만에서 관리자는 앞 네 구역과 더보기를 보고, 더보기 안의 구역 메뉴로 나머지 화면에 간다", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await login(page, accounts.administrator.accountId, accounts.administrator.password);

    await expect(dockZones(page)).toHaveText(["원장", "현장", "고객", "정산"]);
    await dock(page).getByRole("button", { name: "더보기", exact: true }).click();
    // 화면이 하나인 마감은 링크, 보고·설정은 그 구역의 화면 메뉴로 들어간다.
    await expect(dock(page).getByRole("link", { name: "마감", exact: true })).toBeVisible();
    await dock(page).getByRole("button", { name: "설정", exact: true }).click();
    await expect(dock(page).getByRole("button", { name: "더보기 목록" })).toBeFocused();
    await expect(dock(page).locator("[data-dock-overflow]").getByText("설정 화면")).toBeVisible();
    await dock(page).getByRole("link", { name: "감사" }).click();
    await expect(page).toHaveURL(/\/audit$/);
    await expect(dock(page).getByRole("link", { name: "감사" })).toBeHidden();

    // 다시 열면 더보기 목록부터 보인다.
    await dock(page).getByRole("button", { name: "더보기", exact: true }).click();
    await expect(dock(page).getByRole("button", { name: "보고", exact: true })).toBeVisible();
  });

  test("840px 미만에서도 구역이 넷 이하인 역할은 더보기 없이 모두 본다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, accounts.counter.accountId, accounts.counter.password);

    await expect(dockZones(page)).toHaveText(["원장", "현장", "고객", "보고"]);
    await expect(dock(page).getByRole("button", { name: "더보기" })).toBeHidden();
  });

  test("840px에서 관리자의 베트남어 구역 라벨이 한 줄에 모두 들어간다", async ({ page }) => {
    await page.setViewportSize({ width: 840, height: 900 });
    await login(page, accounts.administrator.accountId, accounts.administrator.password);
    await page.context().addCookies([{ name: "locale", value: "vi", url: new URL(page.url()).origin }]);
    await page.reload();

    const viDock = page.getByRole("navigation", { name: "Chuyển khu vực nghiệp vụ" });
    const viZones = viDock.locator("[data-dock-zone]:visible");
    await expect(viZones).toHaveText(["Sổ gọi", "Vận hành", "Khách", "Đối soát", "Chốt tháng", "Báo cáo", "Thiết lập"]);
    // 맨 앞 로고까지 함께 들어가야 한다.
    await expect(viDock.getByRole("link", { name: "GANGNAM SPA – Màn hình đầu" })).toBeVisible();
    const overflow = await viDock.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const box of await Promise.all((await viZones.all()).map((zone) => zone.boundingBox()))) {
      expect(box?.height ?? 0).toBeLessThanOrEqual(48);
    }
  });
});
