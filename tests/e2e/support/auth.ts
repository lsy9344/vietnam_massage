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
 *
 * 폼은 `signIn("credentials", { redirect: false })`로 `/api/auth/callback/credentials`에
 * 비동기 POST를 보낸 뒤 클라이언트에서 `router.replace`로 이동한다. 클릭 직후 호출부가
 * 곧바로 `page.goto(...)`로 navigate하면 이 POST가 `net::ERR_ABORTED`로 취소되어
 * 로그인이 실패하고 `/sign-in`으로 튕긴다(전체 로그인 의존 E2E 무더기 실패의 원인).
 * 따라서 credentials POST 응답이 도착할 때까지 기다린 뒤 반환한다. 성공/실패 모두 POST
 * 응답이 오므로 실패를 검증하는 테스트도 그대로 동작한다.
 */
export async function login(page: Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(accountId);
  await page.getByLabel("비밀번호").fill(password);

  const credentialsResponse = page
    .waitForResponse(
      (response) => response.url().includes("/api/auth/callback/credentials") && response.request().method() === "POST",
      { timeout: 15_000 }
    )
    .catch(() => undefined);
  await page.getByRole("button", { name: "로그인" }).click();
  await credentialsResponse;
}
