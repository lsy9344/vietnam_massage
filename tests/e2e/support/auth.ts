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
 * 화면 언어 쿠키를 page context에 설정한다.
 *
 * 기본 locale은 베트남어(vi)지만, 기존 E2E 스펙들은 한국어 라벨을 locator로 쓴다.
 * 따라서 login()을 비롯한 한국어-locator 기반 스펙은 "ko" 쿠키를 강제해 한국어 UI로 동작시킨다.
 * 베트남어 기본 동작은 별도의 i18n 전용 스펙에서 검증한다.
 */
export async function setLocaleCookie(page: Page, locale: "ko" | "vi") {
  // page가 이미 한 번 navigate된 상태여야 origin을 알 수 있다. login()은 /sign-in 진입 후 호출한다.
  const current = page.url();
  const origin = current && current !== "about:blank" ? new URL(current).origin : "http://127.0.0.1:3000";
  await page.context().addCookies([{ name: "locale", value: locale, url: origin }]);
}

/**
 * cold-compile(force-reset 직후 등)이나 직전 페이지의 in-flight fetch와 충돌해 page.goto가
 * net::ERR_ABORTED로 취소될 때 최대 3회 재시도하는 안전 navigation 헬퍼.
 */
export async function gotoStable(page: Page, path: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(path);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

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
  // cold-compile(force-reset 직후 첫 요청 등)에서 첫 navigation이 net::ERR_ABORTED로 취소될 수 있어
  // /sign-in 진입을 최대 3회 재시도한다.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto("/sign-in");
      break;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  // 기본 locale은 vi. 기존 스펙은 한국어 라벨을 locator로 쓰므로 ko 쿠키를 강제하고 다시 로드한다.
  await setLocaleCookie(page, "ko");
  await page.reload().catch(() => undefined);
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

  // 로그인 성공 시 클라이언트가 `router.replace`로 landing(`/sign-in` 이탈)으로 이동하고, landing
  // 페이지(예: 무거운 `/live`)의 RSC fetch가 이어진다. 이 navigation/fetch가 진행 중일 때 호출부가
  // 곧바로 page.goto(...)하면 net::ERR_ABORTED로 취소된다(story-1-8에서 결정적으로 노출).
  // landing URL 도달 + 문서 로드 완료까지 기다려 in-flight navigation을 해소한다.
  // 실패 케이스는 `/sign-in`에 머무므로 짧은 타임아웃으로 빠져 실패 검증 테스트 흐름을 막지 않는다.
  // cold-compile(특히 force-reset 직후 첫 login)에서 landing 페이지 첫 렌더가 느릴 수 있어
  // 타임아웃을 넉넉히 둔다. 실패 케이스는 `/sign-in`에 머물러 이 대기를 소진하지만 드물다.
  const reachedLanding = await page
    .waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (reachedLanding) {
    await page.waitForLoadState("load").catch(() => undefined);
  }
}
