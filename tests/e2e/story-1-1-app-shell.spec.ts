import { expect, test } from "@playwright/test";
import { login as loginAccount } from "./support/auth";

// 티켓 02: 좌측 사이드바와 상단바 대신 화면 아래 업무 흐름 도크와 화면별 도구줄을 쓴다.
// 티켓 03: 고객 화면이 생겨 관리자 도크에 고객 구역이 보인다.
const dockZones = ["원장", "현장", "고객", "정산", "마감", "보고", "설정"];

test.describe("Story 1.1 ERP 앱 쉘", () => {
  test.beforeEach(async ({ page }) => {
    // 공유 login 헬퍼는 ko 쿠키 설정과 credentials POST 응답 대기까지 함께 처리한다.
    await loginAccount(page, "administrator", "Story12!administrator");
    await expect(page).toHaveURL(/\/live$/);
  });

  test("업무 흐름 도크와 현장 구역의 도구줄을 렌더링한다", async ({ page }) => {
    await expect(page).toHaveTitle("Vietnam Aesthetic ERP");

    const dock = page.getByRole("navigation", { name: "업무 이동" });
    await expect(dock).toBeVisible();
    await expect(dock.getByRole("link")).toHaveText(dockZones);
    await expect(dock.getByRole("link", { name: "현장", exact: true })).toHaveAttribute("aria-current", "page");

    // 로그인 직후 /live 랜딩이 실제로 렌더된다 (운영월 유무와 무관하게 heading은 항상 존재).
    await expect(page.getByRole("heading", { name: "첫화면 실시간 현황", level: 1 })).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
  });

  // NOTE: Story 1.1 시절의 상태 배지 토큰/연결 대기 데모는 `erp-empty-state.tsx`에 있었으나,
  // 화면 진화 후 이 컴포넌트는 더 이상 어디에서도 렌더되지 않는다(dead component).
  // 상태 배지 라벨/glyph/색상 접근성 검증은 실제 `StatusBadge` 컴포넌트를 사용하는
  // story-3-5-status-badge-accessibility.spec.ts가 소유한다. 죽은 데모를 검증하던
  // 3개 테스트(상태 배지 토큰, 색상 보정, 연결 대기 영역)는 제거했다.

  test("최소 너비 1280px 제약 없이 폭에 따라 셸이 바뀐다", async ({ page }) => {
    const minWidth = await page.evaluate(() => getComputedStyle(document.body).minWidth);
    expect(minWidth).not.toBe("1280px");

    await page.setViewportSize({ width: 390, height: 844 });
    const dock = page.getByRole("navigation", { name: "업무 이동" });
    await expect(dock.getByRole("button", { name: "더보기" })).toBeVisible();
    const dockOverflow = await dock.evaluate((element) => element.scrollWidth - element.clientWidth);
    // 본문 재배치는 뒤 티켓이 맡는다. 셸 자체(도크)는 휴대폰 폭에서 넘치지 않는다.
    expect(dockOverflow).toBeLessThanOrEqual(0);
  });
});
