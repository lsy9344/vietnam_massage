"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";

const REFRESH_INTERVAL_MS = 15_000;
const STALE_AFTER_MS = 45_000;

function formatLastUpdated(locale: Locale, value: string) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function RoomStatusRefreshController({
  lastUpdatedAt,
  variant = "default",
  locale = defaultLocale
}: {
  lastUpdatedAt: string;
  variant?: "default" | "tv";
  locale?: Locale;
}) {
  const router = useRouter();
  const t = createTranslator(locale);
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const lastUpdatedMillis = useMemo(() => new Date(lastUpdatedAt).getTime(), [lastUpdatedAt]);
  const isStale = now - lastUpdatedMillis > STALE_AFTER_MS;

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    const polling = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(polling);
  }, [refresh]);

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 text-xs text-muted",
        variant === "tv" && "gap-5 text-lg font-semibold text-foreground"
      )}
      aria-label={t("roomRefresh.aria")}
    >
      <span className={cn(variant === "tv" && isStale && "text-status-complete-check")}>
        {isPending ? t("roomRefresh.refreshing") : isStale ? t("roomRefresh.stale") : t("roomRefresh.lastUpdated")}: {formatLastUpdated(locale, lastUpdatedAt)}
      </span>
      <Button className={cn("h-8 px-2 text-xs", variant === "tv" && "h-12 px-5 text-lg font-bold")} onClick={refresh} variant="secondary">
        {t("roomRefresh.refresh")}
      </Button>
    </div>
  );
}
