import { fallbackLocale, type Locale } from "@/lib/i18n/config";
import { ko } from "@/lib/i18n/messages/ko";
import { vi } from "@/lib/i18n/messages/vi";
import type { MessageKey, Messages } from "@/lib/i18n/types";

export type { Locale } from "@/lib/i18n/config";
export type { MessageKey, Messages } from "@/lib/i18n/types";

const catalogs: Record<Locale, Messages> = { ko, vi };

/** locale의 전체 메시지 맵을 반환한다 (client provider 시드에 사용). */
export function getMessages(locale: Locale): Messages {
  return catalogs[locale] ?? catalogs[fallbackLocale];
}

/** 해당 locale에 key가 존재하는지 확인한다 (누락 key 테스트용). */
export function has(locale: Locale, key: MessageKey): boolean {
  return Boolean(catalogs[locale] && catalogs[locale][key]);
}

/**
 * 번역 함수. key 미존재 시 fallback locale → key 자체 순으로 반환하므로
 * 화면이 빈 문자열로 깨지지 않는다.
 *
 * `{param}` 형태의 placeholder를 params로 치환한다.
 */
export function t(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  const message = catalogs[locale]?.[key] ?? catalogs[fallbackLocale][key] ?? key;
  if (!params) {
    return message;
  }
  return message.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}

/**
 * locale을 미리 바인딩한 translator를 만든다.
 * 서버 컴포넌트에서 `const tt = createTranslator(locale)` 후 `tt("key")` 형태로 사용.
 */
export function createTranslator(locale: Locale) {
  return (key: MessageKey, params?: Record<string, string | number>) => t(locale, key, params);
}

export type Translator = ReturnType<typeof createTranslator>;
