import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";

/**
 * 서버 컴포넌트/액션에서 현재 locale을 읽는다.
 *
 * - `locale` 쿠키 값을 사용하고, 없거나 미지원 값이면 기본 locale(vi)로.
 * - `next/headers`의 cookies()는 server context에서만 동작하므로, client에서
 *   import하면 빌드/런타임 에러가 나며 이것이 사실상 server-only 가드 역할을 한다.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

/** locale을 읽어 바인딩된 translator까지 한 번에 반환한다. */
export async function getServerTranslator() {
  const locale = await getLocale();
  return { locale, t: createTranslator(locale) };
}
