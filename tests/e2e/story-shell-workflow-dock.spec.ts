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
  administrator: { landing: /\/live$/, zones: ["원장", "현장", "정산", "마감", "보고", "설정"], firstHeading: "첫화면 실시간 현황" },
  counter: { landing: /\/calls$/, zones: ["원장", "현장", "보고"], firstHeading: "콜/예약 입력 원장" },
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
      const zoneLinks = dock(page).getByRole("link");
      await expect(zoneLinks).toHaveText(expected.zones);
      for (const zone of allZones.filter((zone) => !expected.zones.includes(zone))) {
        await expect(dock(page).getByRole("link", { name: zone, exact: true })).toHaveCount(0);
      }
    });
  }

  test("도크는 화면 아래에 붙어 있고 사이드바·상단바와 최소 너비 1280px가 없다", async ({ page }) => {
    await login(page, accounts.administrator.accountId, accounts.administrator.password);
    const viewport = page.viewportSize();
    const box = await dock(page).boundingBox();
    expect(box && viewport ? Math.round(box.y + box.height) : 0).toBe(viewport?.height);
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" })).toHaveCount(0);
    await expect(dock(page).getByRole("link", { name: "현장", exact: true })).toHaveAttribute("aria-current", "page");
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

  test("웨이터는 도크 없이 객실 도구줄의 나 메뉴로 로그아웃한다", async ({ page }) => {
    await login(page, accounts.waiter.accountId, accounts.waiter.password);
    await page.getByRole("button", { name: "나", exact: true }).click();
    await expect(page.getByRole("group", { name: "내 계정" }).getByText("웨이터", { exact: true })).toBeVisible();
    await page.getByRole("group", { name: "내 계정" }).getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("도크로 구역을 옮겨도 고른 운영월·날짜가 유지되고 원장은 늘 원장 탭으로 열린다", async ({ page }) => {
    await login(page, accounts.administrator.accountId, accounts.administrator.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${chosenDate}&customerQuery=shell02`);

    await dock(page).getByRole("link", { name: "현장", exact: true }).click();
    await expect(page).toHaveURL(`/rooms?operatingMonthId=${monthId}&serviceDate=${chosenDate}`);
    await expect(page.getByLabel("조회날짜")).toHaveValue(chosenDate);

    await dock(page).getByRole("link", { name: "정산", exact: true }).click();
    await expect(page).toHaveURL(`/settlements?operatingMonthId=${monthId}&serviceDate=${chosenDate}`);
    await page.getByRole("navigation", { name: "정산 화면" }).getByRole("link", { name: "귀케어" }).click();
    await expect(page).toHaveURL(`/settlements/earcare?operatingMonthId=${monthId}&attendanceDate=${chosenDate}`);

    await dock(page).getByRole("link", { name: "원장", exact: true }).click();
    await expect(page).toHaveURL(`/calls?operatingMonthId=${monthId}&serviceDate=${chosenDate}`);
    await expect(page.getByLabel("조회날짜")).toHaveValue(chosenDate);
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

  test("840px 미만에서 관리자는 앞 네 구역과 더보기를 보고, 더보기로 나머지 구역에 간다", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await login(page, accounts.administrator.accountId, accounts.administrator.password);

    for (const zone of ["원장", "현장", "정산", "마감"]) {
      await expect(dock(page).getByRole("link", { name: zone, exact: true })).toBeVisible();
    }
    await expect(dock(page).getByRole("link", { name: "보고", exact: true })).toBeHidden();
    await dock(page).getByRole("button", { name: "더보기" }).click();
    await dock(page).getByRole("link", { name: "설정", exact: true }).click();
    await expect(page).toHaveURL(/\/masters\/operating-months$/);
  });

  test("840px 미만에서도 구역이 넷 이하인 역할은 더보기 없이 모두 본다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, accounts.counter.accountId, accounts.counter.password);

    for (const zone of ["원장", "현장", "보고"]) {
      await expect(dock(page).getByRole("link", { name: zone, exact: true })).toBeVisible();
    }
    await expect(dock(page).getByRole("button", { name: "더보기" })).toBeHidden();
  });

  test("840px에서 관리자의 베트남어 구역 라벨이 한 줄에 모두 들어간다", async ({ page }) => {
    await page.setViewportSize({ width: 840, height: 900 });
    await login(page, accounts.administrator.accountId, accounts.administrator.password);
    await page.context().addCookies([{ name: "locale", value: "vi", url: new URL(page.url()).origin }]);
    await page.reload();

    const viDock = page.getByRole("navigation", { name: "Chuyển khu vực nghiệp vụ" });
    await expect(viDock.getByRole("link")).toHaveText(["Sổ gọi", "Vận hành", "Đối soát", "Chốt tháng", "Báo cáo", "Thiết lập"]);
    const overflow = await viDock.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const box of await Promise.all((await viDock.getByRole("link").all()).map((link) => link.boundingBox()))) {
      expect(box?.height ?? 0).toBeLessThanOrEqual(48);
    }
  });
});
