"use client";

import { createContext, useCallback, useContext, useEffect, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createTranslator } from "@/lib/i18n";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { BUSINESS_DAY_START_TIME, BUSINESS_TIME_ZONE, BUSINESS_TIME_ZONE_OFFSET } from "@/lib/business-time";
import { addDaysToIsoDate, businessTodayServiceDate } from "@/lib/operating-date";

type TherapistRefreshValue = {
  locale: Locale;
  lastUpdatedAt: string;
  isPending: boolean;
  refresh: () => void;
};

const TherapistRefreshContext = createContext<TherapistRefreshValue | null>(null);

function useTherapistRefresh() {
  const value = useContext(TherapistRefreshContext);
  if (!value) {
    throw new Error("TherapistRefreshController는 TherapistRefresh 안에 둔다.");
  }
  return value;
}

/**
 * D8: Therapist 화면의 새로고침 공통 조각. 운영팀 객실 현황의 30초 자동 폴링(RoomStatusRefresh)과
 * 달리 주기적으로 다시 읽지 않는다 — 화면을 열 때(서버 렌더가 이미 최신이다), 화면으로 돌아올 때
 * (visibilitychange), 새로고침 버튼, 매일 03:00 전환 때만 다시 읽는다. Therapist 휴대폰 수십 대가 주기적으로
 * 읽으면 DB가 잠들지 못해 요금이 늘어나기 때문이다(메모리 erp-polling-cost-structure).
 *
 * 03–10의 Therapist 화면은 본문을 이 컴포넌트로 감싸고, TherapistRefreshController로 마지막 갱신
 * 시각과 새로고침 버튼을 보인다.
 */
export function TherapistRefresh({
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

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    // visibilitychange 이벤트는 상태가 바뀔 때만 발생하므로, 마운트 시점에는 부르지 않는다
    // (그 시점은 서버 렌더가 이미 최신이다). 숨겨졌다가 다시 보일 때만 다시 읽는다.
    const syncVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, [refresh]);

  // 매일 03:00에 보이는 화면만 한 번 갱신한다. 숨겨진 화면은 돌아왔을 때 기존 경로로 갱신한다.
  useEffect(() => {
    const now = new Date();
    const today = businessTodayServiceDate(now);
    const staleDay = businessTodayServiceDate(new Date(lastUpdatedAt)) !== today;
    const nextDay = addDaysToIsoDate(today, 1);
    const delay = staleDay ? 0 : new Date(`${nextDay}T${BUSINESS_DAY_START_TIME}:00${BUSINESS_TIME_ZONE_OFFSET}`).getTime() - now.getTime();
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") refresh();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [lastUpdatedAt, refresh]);

  return <TherapistRefreshContext.Provider value={{ locale, lastUpdatedAt, isPending, refresh }}>{children}</TherapistRefreshContext.Provider>;
}

function formatLastUpdated(locale: Locale, value: string) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "ko-KR", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

/** 마지막 갱신 시각과 새로고침 버튼. TherapistTopBar 아래, 화면 본문 맨 위에 둔다. */
export function TherapistRefreshController() {
  const { locale, lastUpdatedAt, isPending, refresh } = useTherapistRefresh();
  const t = createTranslator(locale);
  const label = `${t("therapist.refresh.lastUpdated")}: ${formatLastUpdated(locale, lastUpdatedAt)}`;

  return (
    <div aria-label={t("therapist.refresh.aria")} className="mb-4 flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-faint">{isPending ? t("therapist.refresh.refreshing") : label}</span>
      <Button onClick={refresh} variant="secondary">
        {t("therapist.refresh.refresh")}
      </Button>
    </div>
  );
}
