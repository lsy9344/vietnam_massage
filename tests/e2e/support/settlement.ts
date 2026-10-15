import type { Locator, Page } from "@playwright/test";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 정산 화면의 직원 비교 표에서 그 직원의 행. 이름이 다른 이름의 앞부분이어도(마사지사1, 마사지사10) 정확히 고른다. */
export function employeeRow(page: Page, displayName: string): Locator {
  return page.getByRole("row").filter({ has: page.getByText(displayName, { exact: true }) });
}

/**
 * 직원 비교 표에서 직원을 고르고 그 직원 패널을 돌려준다(티켓 05). 출퇴근·근무상태 정정, 근거 콜, 적용 정책,
 * 지급 확인(ADR 0004, 티켓 30)은 이 패널 안에 있다. 패널 이름은 "표시 이름 (사번)"이다.
 */
export async function openEmployeePanel(page: Page, displayName: string): Promise<Locator> {
  await employeeRow(page, displayName).getByRole("button").first().click();
  return page.getByRole("complementary", { name: new RegExp(`^${escapeRegExp(displayName)} \\(`) });
}
