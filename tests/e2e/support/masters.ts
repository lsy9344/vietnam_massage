import type { Locator, Page } from "@playwright/test";

/**
 * 기준정보 화면(티켓 07): 목록 행의 첫 칸 버튼을 누르면 그 항목의 비모달 편집 패널이 열린다.
 * 표시명·정렬 순서·비활성 처리 같은 편집 칸은 행이 아니라 이 패널 안에 있다.
 */

/** 첫 칸 버튼 이름(표시명, 시간 슬롯 값, 코스 코드 …)이 정확히 그 글자인 목록 행. */
export function masterRow(page: Page, label: string): Locator {
  return page.getByRole("row").filter({ has: page.getByRole("button", { name: label, exact: true }) });
}

/** 항목 패널. 기준정보 화면에는 비모달 패널이 하나뿐이다. */
export function masterPanel(page: Page): Locator {
  return page.getByRole("complementary");
}

/** 첫 칸 버튼 이름으로 행을 골라 패널을 연다. */
export async function openMasterPanel(page: Page, label: string): Promise<Locator> {
  await page.getByRole("button", { name: label, exact: true }).click();
  return masterPanel(page);
}

/** 이름 밑에 staff code 같은 보조 글자가 붙는 행(직원)은 그 글자를 담은 행의 첫 버튼으로 연다. */
export async function openMasterPanelByRowText(page: Page, text: string): Promise<Locator> {
  await page.getByRole("row").filter({ hasText: text }).getByRole("button").first().click();
  return masterPanel(page);
}
