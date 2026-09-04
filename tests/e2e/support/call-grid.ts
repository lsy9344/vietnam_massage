import type { Locator, Page } from "@playwright/test";

/**
 * 콜 원장 그리드의 선택 셀은 `<select>`가 아니라 Story 2.6의 type-ahead combobox다.
 * `selectOption`은 "Element is not a <select> element"로 실패하므로 이 헬퍼를 쓴다.
 *
 * 옵션 목록은 `createPortal`로 document.body에 그려지므로 row 범위가 아니라 page 범위에서 고른다.
 */
export async function selectGridOption(page: Page, scope: Locator, columnLabel: string, optionLabel: string) {
  await scope.getByRole("combobox", { name: columnLabel }).click();
  // 화면에는 native <select>의 숨은 <option>도 남아 있어 role=option에 함께 걸린다.
  // 열려 있는 listbox 안으로 범위를 좁혀야 보이는 항목을 클릭한다.
  await page.getByRole("listbox").getByRole("option", { name: optionLabel, exact: true }).first().click();
}

/** 표시 라벨 대신 저장값(코드/id)으로 고른다. 옵션 요소 id가 `...-option-<value>`로 끝난다. */
export async function selectGridOptionByValue(page: Page, scope: Locator, columnLabel: string, value: string) {
  await scope.getByRole("combobox", { name: columnLabel }).click();
  await page.locator(`[role="listbox"] [role="option"][id$="-option-${value}"]`).click();
}
