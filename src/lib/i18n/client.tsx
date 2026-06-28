"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { t as translate } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/types";

type LocaleContextValue = {
  locale: Locale;
};

const LocaleContext = createContext<LocaleContextValue>({ locale: defaultLocale });

/**
 * 서버에서 읽은 locale을 클라이언트 트리에 1회 시드한다.
 * client 컴포넌트는 useT()/useLocale()로 번역에 접근한다.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useT() {
  const { locale } = useContext(LocaleContext);
  return useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  );
}
