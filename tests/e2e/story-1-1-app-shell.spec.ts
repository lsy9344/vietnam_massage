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

test.describe("Story 1.1 ERP 앱 쉘", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("이메일 또는 계정 ID").fill("administrator");
    await page.getByLabel("비밀번호").fill("Story12!administrator");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/live$/);
  });

  test("기본 데스크톱 shell과 sidebar 도메인 순서를 렌더링한다", async ({ page }) => {
    await expect(page).toHaveTitle("Vietnam Massage ERP");
    await expect(page.getByRole("heading", { name: "ERP 운영", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "역할별 ERP 업무", level: 2 })).toBeVisible();

    const menu = page.getByRole("navigation", { name: "ERP 도메인 메뉴" });
    await expect(menu).toBeVisible();
    for (const group of sidebarGroups) {
      await expect(menu.getByRole("region", { name: group })).toBeVisible();
    }
    await expect(menu.getByRole("link", { name: "첫화면 실시간 현황" })).toHaveAttribute("aria-current", "page");

    await expect(page.getByText("운영 현황").first()).toBeVisible();
    // 로그인 직후 /live 랜딩이 실제로 렌더된다 (운영월 유무와 무관하게 heading은 항상 존재).
    await expect(page.getByRole("heading", { name: "첫화면 실시간 현황", level: 1 })).toBeVisible();
  });

  // NOTE: Story 1.1 시절의 상태 배지 토큰/연결 대기 데모는 `erp-empty-state.tsx`에 있었으나,
  // 화면 진화 후 이 컴포넌트는 더 이상 어디에서도 렌더되지 않는다(dead component).
  // 상태 배지 라벨/glyph/색상 접근성 검증은 실제 `StatusBadge` 컴포넌트를 사용하는
  // story-3-5-status-badge-accessibility.spec.ts가 소유한다. 죽은 데모를 검증하던
  // 3개 테스트(상태 배지 토큰, 색상 보정, 연결 대기 영역)는 제거했다.

  test("v1 desktop 최소 너비 제약을 유지한다", async ({ page }) => {
    const minWidth = await page.evaluate(() => getComputedStyle(document.body).minWidth);
    expect(minWidth).toBe("1280px");
  });
});
