import type { ReactElement } from "react";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LocaleProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";

const staticRouter: AppRouterInstance = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {}
};

/**
 * 셸 뷰 정적 렌더 테스트용 감싸기. 언어 전환처럼 Next 라우터를 쓰는 클라이언트 컴포넌트가
 * 앱 라우터 밖에서도 그려지게 한다.
 */
export function renderInShell(element: ReactElement, locale: Locale) {
  return (
    <AppRouterContext.Provider value={staticRouter}>
      <LocaleProvider locale={locale}>{element}</LocaleProvider>
    </AppRouterContext.Provider>
  );
}
