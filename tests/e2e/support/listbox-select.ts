import type { Locator } from "@playwright/test";

/**
 * 공용 선택 칸(`src/components/ui/listbox-select.tsx`)을 쓰는 헬퍼.
 *
 * 네이티브 `<select>`가 아니라 `role="combobox"` 버튼 + `role="listbox"` 목록이라 `selectOption`이 되지
 * 않는다(콜 원장 칸 선택과 같은 이유, `tests/e2e/support/call-grid.ts`). 목록은 body에 portal로 뜨므로
 * 목록 쪽 범위는 page로 본다.
 *
 * 인자로 받는 것은 combobox 버튼을 찾는 locator다(`page.getByLabel("인원")`,
 * `dayForm.getByRole("combobox")`처럼 그 자리 자체를 가리켜야 한다).
 */

/** 선택 칸을 열고, 보이는 글자가 같은 항목을 고른다. */
export async function pickListboxOption(combobox: Locator, optionName: string | RegExp) {
  await combobox.click();
  const listbox = combobox.page().getByRole("listbox");
  await listbox.getByRole("option", { name: optionName }).first().click();
}

/** 선택 칸을 열고, 저장값(value)이 같은 항목을 고른다. */
export async function pickListboxOptionByValue(combobox: Locator, value: string) {
  await combobox.click();
  const listbox = combobox.page().getByRole("listbox");
  await listbox.locator(`[data-value="${value}"]`).first().click();
}

/** 선택 칸을 열어 목록을 다루는 상태로 둔다(후보 목록을 볼 때). */
export async function openListbox(combobox: Locator) {
  await combobox.click();
  return combobox.page().getByRole("listbox");
}
