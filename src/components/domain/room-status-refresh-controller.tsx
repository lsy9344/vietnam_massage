"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";
import { BUSINESS_TIME_ZONE } from "@/lib/business-time";
import { isWithinLiveRefreshWindow } from "@/modules/rooms/room-status-refresh";

const REFRESH_INTERVAL_MS = 30_000;
const STALE_AFTER_MS = 90_000;

function formatLastUpdated(locale: Locale, value: string) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "ko-KR", {
    timeZone: BUSINESS_TIME_ZONE,
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
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const lastUpdatedMillis = useMemo(() => new Date(lastUpdatedAt).getTime(), [lastUpdatedAt]);

  // 영업 시간 외이거나 화면이 보이지 않으면 폴링을 멈춘다. 매 폴링이 서버 렌더 + DB 질의를 부르고,
  // 그동안 DB가 잠들지 못해 그대로 요금이 되기 때문이다.
  const isOutsideBusinessHours = !isWithinLiveRefreshWindow(new Date(now));
  const isAutoRefreshPaused = isOutsideBusinessHours || !isDocumentVisible;
  // 멈춘 동안에는 데이터가 오래된 게 정상이므로 "갱신 지연"으로 표시하지 않는다.
  const isStale = !isAutoRefreshPaused && now - lastUpdatedMillis > STALE_AFTER_MS;

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
    const syncVisibility = () => setIsDocumentVisible(document.visibilityState === "visible");
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  const wasPausedRef = useRef(false);

  useEffect(() => {
    if (isAutoRefreshPaused) {
      wasPausedRef.current = true;
      return;
    }

    // 멈춰 있던 동안 쌓인 변화가 있으므로 재개 시 한 번은 즉시 갱신한다.
    // (최초 마운트 때는 서버 렌더가 방금 끝났으므로 건너뛴다.)
    if (wasPausedRef.current) {
      wasPausedRef.current = false;
      refresh();
    }

    const polling = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(polling);
  }, [refresh, isAutoRefreshPaused]);

  const statusLabel = isPending
    ? t("roomRefresh.refreshing")
    : isOutsideBusinessHours
      ? t("roomRefresh.paused")
      : isStale
        ? t("roomRefresh.stale")
        : t("roomRefresh.lastUpdated");

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 text-xs text-muted",
        variant === "tv" && "gap-5 text-lg font-semibold text-foreground"
      )}
      aria-label={t("roomRefresh.aria")}
    >
      <span className={cn(variant === "tv" && isStale && "text-status-complete-check")}>
        {statusLabel}: {formatLastUpdated(locale, lastUpdatedAt)}
      </span>
      <Button className={cn("h-8 px-2 text-xs", variant === "tv" && "h-12 px-5 text-lg font-bold")} onClick={refresh} variant="secondary">
        {t("roomRefresh.refresh")}
      </Button>
    </div>
  );
}
