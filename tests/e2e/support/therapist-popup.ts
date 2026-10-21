import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Therapist 화면의 창(출퇴근 코드, 정정 요청, 공지, 근태 날짜 상세)은 모두 같은 가운데 팝업이다
 * (ModalPanel placement="center", design.md 6.11): 흐린 덮개 위 가로 가운데, 화면 가장자리에서 떨어져 있고,
 * 머리 띠는 브랜드 검정 잉크, 본문은 흰색이 아닌 아이보리 작업면(--surface)이다. 머리 띠의 닫기는 바탕색(--background)으로 채운다.
 */
export async function expectTherapistCenterPopup(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible();
  const viewport = page.viewportSize()!;
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(15);
  expect(viewport.width - (box.x + box.width)).toBeGreaterThanOrEqual(15);
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  expect(box.y).toBeGreaterThan(0);
  expect(box.y + box.height).toBeLessThan(viewport.height);
  await expect(page.locator("[data-modal-overlay]")).toHaveCSS("backdrop-filter", /blur/);
  await expect(dialog.locator("[data-modal-header]")).toHaveCSS("background-color", "rgb(9, 9, 9)");
  await expect(dialog).toHaveCSS("background-color", "rgb(250, 244, 233)");
  await expect(dialog.locator("[data-modal-header]").getByRole("button", { name: /^(닫기|Đóng)$/ })).toHaveCSS("background-color", "rgb(241, 232, 215)");
}
