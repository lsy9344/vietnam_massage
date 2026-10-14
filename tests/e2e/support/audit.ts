import { expect, type Locator, type Page } from "@playwright/test";

/**
 * 티켓 08: 감사 목록 행은 바뀐 항목 요약만 보이고, 변경 전·후 전체 값은 행을 골라 여는 "변경 상세" 패널에 있다.
 * action이 맞는 행을 차례로 열어 패널에 `contains`가 보이는 첫 기록의 패널을 돌려준다.
 */
export async function openAuditEntry(page: Page, { action, contains }: { action: RegExp; contains: string }) {
  const rows = page.getByRole("row", { name: action });
  const panel = page.getByRole("complementary", { name: "변경 상세" });
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    const button = rows.nth(index).getByRole("button");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    if ((await panel.getByText(contains).count()) > 0) return panel;
  }
  throw new Error(`No audit entry ${action} contains "${contains}"`);
}

/** 변경 상세 패널의 변경 전·후 표에서 한 항목의 변경 후 칸. */
export function auditAfterValue(panel: Locator, field: string): Locator {
  return panel
    .getByRole("region", { name: "변경 전·후" })
    .getByRole("row")
    .filter({ has: panel.page().getByRole("rowheader").filter({ hasText: new RegExp(`^${field}(?![A-Za-z])`) }) })
    .getByRole("cell")
    .nth(1);
}
