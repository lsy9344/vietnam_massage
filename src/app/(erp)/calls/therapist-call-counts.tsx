import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

// "use client"가 없는 모듈이다. 빠른 예약 카드가 쓰는 Therapist별 "한 것 · 예약" 표시다.

type CountedRow = Pick<TherapistAvailabilityRowDto, "attendance" | "callCounts">;

/** 출근 중인데 그날 한 것도 예약도 없는 Therapist. 빠른 예약 카드가 주의 색으로 보인다. */
export function isIdleTherapist(row: CountedRow) {
  return row.attendance === "checked_in" && row.callCounts.done + row.callCounts.reserved === 0;
}

/**
 * "한 것 3 · 예약 2". 출근 중인데 둘 다 0이면 ▲와 주의 색으로 감싸고, 퇴근이면 흐리게 둔다.
 * 화면 낭독기에는 "한 것 3, 예약 2"로 읽힌다.
 */
export function TherapistCallCount({ locale, row }: { locale: Locale; row: CountedRow }) {
  const idle = isIdleTherapist(row);
  const checkedOut = row.attendance === "checked_out";
  const { done, reserved } = row.callCounts;
  const label = [
    t(locale, "calls.therapistCounts.count", { done: formatNumber(locale, done), reserved: formatNumber(locale, reserved) }),
    idle ? t(locale, "calls.therapistCounts.idle") : null
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap",
        idle && "rounded-full bg-warning-soft px-2 text-warning",
        checkedOut && "text-muted"
      )}
      data-idle={idle ? "" : undefined}
      data-therapist-call-count=""
      title={label}
    >
      {idle ? <span aria-hidden="true">{"▲︎"}</span> : null}
      {/* 이름 옆 숫자만 있으면 "마사지사1 1 2"처럼 읽혀(2026-10-22 고객 요청) 숫자마다 이름을 붙인다. */}
      <span aria-hidden="true" className={cn("text-xs", !idle && !checkedOut && "text-foreground")}>
        {t(locale, "calls.therapistCounts.visible", { done: formatNumber(locale, done), reserved: formatNumber(locale, reserved) })}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
