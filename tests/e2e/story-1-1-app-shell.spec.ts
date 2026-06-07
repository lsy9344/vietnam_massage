import { expect, test } from "@playwright/test";

const sidebarGroups = [
  "운영 현황",
  "콜 원장",
  "정산",
  "월마감",
  "대시보드",
  "마스터 설정",
  "감사 로그"
];

const statusRules = [
  { label: "사용중", glyph: "●" },
  { label: "예약", glyph: "◷" },
  { label: "청소중", glyph: "◐" },
  { label: "종료확인", glyph: "⚠" },
  { label: "빈방", glyph: "○" }
];

test.describe("Story 1.1 ERP 앱 쉘", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("기본 데스크톱 shell과 sidebar 도메인 순서를 렌더링한다", async ({ page }) => {
    await expect(page).toHaveTitle("Vietnam Massage ERP");
    await expect(page.getByRole("heading", { name: "ERP 운영", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "앱 쉘 준비 상태", level: 2 })).toBeVisible();

    const menu = page.getByRole("navigation", { name: "ERP 도메인 메뉴" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("button")).toHaveText(sidebarGroups);
    await expect(menu.getByRole("button", { name: "운영 현황" })).toHaveAttribute("aria-current", "page");

    await expect(page.getByLabel("앱 쉘 영역 미리보기")).toContainText("운영 현황");
    await expect(page.getByLabel("앱 쉘 영역 미리보기")).toContainText("콜 원장");
    await expect(page.getByLabel("앱 쉘 영역 미리보기")).toContainText("정산/월마감");
  });

  test("상태 badge는 라벨과 glyph를 함께 노출하고 접근 가능한 이름을 가진다", async ({ page }) => {
    const tokenRegion = page.getByLabel("상태 배지 토큰");
    await expect(tokenRegion).toBeVisible();

    for (const status of statusRules) {
      const badge = page.getByLabel(`상태: ${status.label}`);
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(status.glyph);
      await expect(badge).toContainText(status.label);
    }
  });

  test("critical status token 색상은 접근성 보정값을 유지한다", async ({ page }) => {
    await expect(page.getByLabel("상태: 청소중")).toHaveCSS("color", "rgb(61, 49, 21)");
    await expect(page.getByLabel("상태: 빈방")).toHaveCSS("color", "rgb(61, 49, 21)");
    await expect(page.getByLabel("상태: 빈방")).toHaveCSS("border-color", "rgb(179, 163, 125)");
  });

  test("blank screen 방지와 v1 desktop 제약을 유지한다", async ({ page }) => {
    await expect(page.getByLabel("연결 대기 영역")).toContainText("후속 기능 연결 대기");
    await expect(page.getByText("표시할 운영 데이터가 아직 없다.")).toBeVisible();
    await expect(page.getByLabel("로딩 상태 예시").locator(".animate-pulse")).toHaveCount(3);

    const minWidth = await page.evaluate(() => getComputedStyle(document.body).minWidth);
    expect(minWidth).toBe("1280px");
  });
});
