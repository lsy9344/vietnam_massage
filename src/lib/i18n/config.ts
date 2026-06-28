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

/** 임의 문자열이 지원 locale인지 좁혀준다. */
export function isLocale(value: unknown): value is Locale {
  return value === "vi" || value === "ko";
}

/** 임의 입력을 지원 locale로 정규화한다. 미지원 값은 기본 locale로. */
export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}
