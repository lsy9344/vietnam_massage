"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { locales, localeLabels, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";

/**
 * 화면 언어 전환 control. 선택한 locale을 쿠키에 저장하고 현재 route를 유지한 채 새로고침한다.
 * 쿠키 저장 → router.refresh()로 서버 컴포넌트가 새 locale로 다시 렌더된다.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const current = useLocale();
  const t = useT();
  const [isPending, startTransition] = useTransition();

  function selectLocale(next: Locale) {
    if (next === current) return;
    // 1년 유지, 모든 route에서 공유.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className={cn("inline-flex items-center gap-1", className)} role="group" aria-label={t("locale.switch.aria")}>
      {locales.map((loc) => {
        const active = loc === current;
        return (
          <button
            key={loc}
            type="button"
            aria-pressed={active}
            disabled={isPending}
            onClick={() => selectLocale(loc)}
            className={cn(
              "h-8 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60",
              active ? "bg-brand text-brand-foreground" : "border border-border bg-surface text-muted hover:bg-readonly hover:text-foreground"
            )}
          >
            {localeLabels[loc]}
          </button>
        );
      })}
    </div>
  );
}
