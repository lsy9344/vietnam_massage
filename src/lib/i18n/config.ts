/**
 * i18n core configuration.
 *
 * - 지원 언어는 `vi`, `ko` 두 개.
 * - 기본 언어는 `vi`, 번역 누락 시 `ko`로 fallback.
 * - 언어 선택은 `locale` 쿠키에 저장한다 (route prefix는 사용하지 않음).
 */
export const locales = ["vi", "ko"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "vi";

export const fallbackLocale: Locale = "ko";

export const LOCALE_COOKIE = "locale";

/** 사용자에게 보여줄 언어 표시명 (전환 버튼용). */
export const localeLabels: Record<Locale, string> = {
  vi: "Tiếng Việt",
  ko: "한국어"
};

/** 언어 쿠키 한 줄(document.cookie에 대입). 1년 유지, 모든 route에서 공유. */
export function localeCookieAssignment(locale: Locale) {
  return `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * 로그인 직후 바꿀 화면 언어. Therapist는 베트남 현지 직원이라 로그인하면 늘 베트남어로 시작한다(사용자 요청,
 * 2026-10-20). 그 뒤 나 메뉴에서 한국어로 바꾸면 다음 로그인 전까지 그대로다. 다른 역할은 고른 언어를 둔다(null).
 */
export function signInLocaleFor(role: string | undefined): Locale | null {
  return role === "therapist" ? "vi" : null;
}

/** 임의 문자열이 지원 locale인지 좁혀준다. */
export function isLocale(value: unknown): value is Locale {
  return value === "vi" || value === "ko";
}

/** 임의 입력을 지원 locale로 정규화한다. 미지원 값은 기본 locale로. */
export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}
