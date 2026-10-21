"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { cn } from "@/lib/utils";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";
import { intlLocale } from "@/lib/i18n/format";
import { BUSINESS_TIME_ZONE } from "@/lib/business-time";
import { roomStatusRefreshState } from "@/modules/rooms/room-status-refresh";

const REFRESH_INTERVAL_MS = 30_000;
const STALE_AFTER_MS = 90_000;

function formatLastUpdated(locale: Locale, value: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

type RoomStatusRefreshValue = {
  locale: Locale;
  lastUpdatedAt: string;
  isPending: boolean;
  isOutsideBusinessHours: boolean;
  isStale: boolean;
  refresh: () => void;
};

const RoomStatusRefreshContext = createContext<RoomStatusRefreshValue | null>(null);

function useRoomStatusRefresh() {
  const value = useContext(RoomStatusRefreshContext);
  if (!value) {
    throw new Error("RoomStatusRefreshController와 RoomStatusStaleNotice는 RoomStatusRefresh 안에 둔다.");
  }
  return value;
}

/**
 * 객실·실시간·TV 화면의 30초 자동 갱신. 화면마다 한 번 감싸고, 도구줄의 갱신 상태(RoomStatusRefreshController)와
 * 본문의 갱신 지연 안내(RoomStatusStaleNotice)가 같은 상태를 읽는다.
 */
export function RoomStatusRefresh({
  lastUpdatedAt,
  locale = defaultLocale,
  children
}: {
  lastUpdatedAt: string;
  locale?: Locale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);

  // 영업 시간 외이거나 화면이 보이지 않으면 폴링을 멈춘다. 매 폴링이 서버 렌더 + DB 질의를 부르고,
  // 그동안 DB가 잠들지 못해 그대로 요금이 되기 때문이다.
  const {
    isOutsideBusinessHours,
    isPaused: isAutoRefreshPaused,
    isStale
  } = roomStatusRefreshState({ now: new Date(now), lastUpdatedAt, isDocumentVisible, staleAfterMs: STALE_AFTER_MS });

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

  return (
    <RoomStatusRefreshContext.Provider value={{ locale, lastUpdatedAt, isPending, isOutsideBusinessHours, isStale, refresh }}>
      {children}
    </RoomStatusRefreshContext.Provider>
  );
}

/** 도구줄 상태 자리(design.md 6.2)의 마지막 갱신 시각과 새로고침. TV는 머리말에 크게 둔다. */
export function RoomStatusRefreshController({ variant = "default" }: { variant?: "default" | "tv" }) {
  const { locale, lastUpdatedAt, isPending, isOutsideBusinessHours, isStale, refresh } = useRoomStatusRefresh();
  const t = createTranslator(locale);

  const statusLabel = isPending
    ? t("roomRefresh.refreshing")
    : isOutsideBusinessHours
      ? t("roomRefresh.paused")
      : isStale
        ? t("roomRefresh.stale")
        : t("roomRefresh.lastUpdated");
  const label = `${statusLabel}: ${formatLastUpdated(locale, lastUpdatedAt)}`;

  return (
    <div className={cn("flex items-center justify-end gap-3", variant === "tv" && "gap-5")} aria-label={t("roomRefresh.aria")}>
      {variant === "tv" ? (
        <span className={cn("text-lg font-semibold text-foreground", isStale && "text-status-complete-check")}>{label}</span>
      ) : isStale ? (
        <StatusIndicator label={label} tone="warning" />
      ) : (
        <span className="text-xs font-semibold text-faint">{label}</span>
      )}
      <Button className={cn(variant === "tv" && "h-12 px-5 text-lg font-bold")} onClick={refresh} variant="secondary">
        {t("roomRefresh.refresh")}
      </Button>
    </div>
  );
}

/** 갱신 지연(design.md 6.13): 마지막 갱신 뒤 상태를 받지 못했으면 본문 맨 위에서 화면이 지금과 다를 수 있다고 알린다. */
export function RoomStatusStaleNotice() {
  const { locale, lastUpdatedAt, isStale } = useRoomStatusRefresh();
  if (!isStale) {
    return null;
  }
  const t = createTranslator(locale);
  return (
    <ScreenState
      className="mb-6"
      description={t("roomRefresh.staleNotice.description")}
      kind="stale"
      label={t("roomRefresh.stale")}
      title={t("roomRefresh.staleNotice.title", { time: formatLastUpdated(locale, lastUpdatedAt) })}
    />
  );
}
