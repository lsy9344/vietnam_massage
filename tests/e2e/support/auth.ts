import type { Page } from "@playwright/test";

/**
 * Story 1.2 기준 Argon2id 해시 파라미터.
 * 모든 E2E 시드 계정의 passwordHash는 이 옵션으로 생성한다.
 */
export const argon2idOptions = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

/**
 * 공유 로그인 헬퍼: 계정 ID(또는 이메일)와 비밀번호로 로그인 폼을 제출한다.
 */
export async function login(page: Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(accountId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}
