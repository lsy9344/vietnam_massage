"use client";

import { useEffect, useRef, useState } from "react";
import { clockCodeMinuteNow, computeClockInCode } from "@/modules/therapists/therapist-clock-code";
import type { ClockCodeDisplayKeys } from "@/modules/therapists/therapist-clock-code-service";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * 출근 코드 표시(스펙 D13, M11). TV 구석(size="corner")과 "출근 코드" 버튼으로 여는 큰 화면
 * (size="full")이 같은 컴포넌트를 쓴다. 매장 화면은 자정을 넘겨도 서버를 다시 부르지 않고 다음 날
 * 키로 넘어가야 해서(D13), 서버가 오늘·다음 날 두 날짜 키(keys)만 내려주고 분마다 코드를 다시 계산
 * 하는 것은 이 컴포넌트가 한다 — 네트워크 요청은 한 번도 보내지 않는다.
 *
 * TV·클록 코드 화면 모두 LocaleProvider 밖(운영팀 (erp) 레이아웃 밖)이라 useT() 대신 명시적
 * locale prop을 받는다(RoomStatusRefreshController와 같은 모양).
 */
export function ClockCodeDisplay({ keys, locale, size = "corner" }: { keys: ClockCodeDisplayKeys; locale: Locale; size?: "corner" | "full" }) {
  const t = createTranslator(locale);
  const [code, setCode] = useState<string | null>(null);
  const keysRef = useRef(keys);
  keysRef.current = keys;

  useEffect(() => {
    let lastMinuteKey = "";
    let cancelled = false;

    async function tick() {
      const minute = clockCodeMinuteNow();
      const minuteKey = `${minute.calendarDate}:${minute.minuteOfDay}`;
      if (minuteKey === lastMinuteKey) return;
      lastMinuteKey = minuteKey;

      const current = keysRef.current;
      const daySecretHex = minute.calendarDate === current.tomorrow.date ? current.tomorrow.daySecretHex : current.today.daySecretHex;
      const next = await computeClockInCode(daySecretHex, minute.minuteOfDay);
      if (!cancelled) setCode(next);
    }

    void tick();
    const interval = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isFull = size === "full";
  return (
    <div
      aria-label={t("clockCode.aria")}
      aria-live="polite"
      className={
        isFull
          ? "grid place-items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center"
          : "grid gap-0.5 rounded-lg border border-border bg-surface px-4 py-2 text-center"
      }
    >
      <p className={isFull ? "text-lg font-bold text-muted" : "text-xs font-semibold text-muted"}>{t("clockCode.label")}</p>
      <p className={`font-black tabular-nums tracking-[0.2em] text-foreground ${isFull ? "text-[120px] leading-none" : "text-2xl leading-tight"}`} data-testid="clock-code-digits">
        {code ?? "····"}
      </p>
    </div>
  );
}
