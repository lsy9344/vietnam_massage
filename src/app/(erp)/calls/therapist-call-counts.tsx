import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

// "use client"가 없는 모듈이다. 원장 띠(서버)와 빠른 예약 카드(클라이언트)가 같은 숫자 표시를 함께 쓴다.

type CountedRow = Pick<TherapistAvailabilityRowDto, "attendance" | "callCounts">;

/** 출근 중인데 그날 한 것도 예약도 없는 Therapist. 원장 띠와 빠른 예약 카드가 주의 색으로 보인다. */
export function isIdleTherapist(row: CountedRow) {
  return row.attendance === "checked_in" && row.callCounts.done + row.callCounts.reserved === 0;
}

/**
 * 원장 띠에 올릴 Therapist. 가능 판정이 준 순서(직원 정렬 순서)를 그대로 둔다. 출근 중이면 콜이 없어도 올리고,
 * 퇴근했으면 그날 콜이 있을 때만, 출근 전이면 올리지 않는다. 그날 아무도 출근이 입력되지 않았으면(내일 이후 날짜 등)
 * 콜이 잡힌 Therapist만 올린다.
 */
export function therapistCallStripRows<Row extends CountedRow>(rows: Row[]) {
  const hasCalls = (row: Row) => row.callCounts.done + row.callCounts.reserved > 0;
  const anyoneAttended = rows.some((row) => row.attendance !== "before_check_in");
  return rows.filter((row) =>
    anyoneAttended ? row.attendance === "checked_in" || (row.attendance === "checked_out" && hasCalls(row)) : hasCalls(row)
  );
}

/**
 * "3 +2": 한 것은 진하게, 예약은 흐리게 "+"를 붙인다. 출근 중인데 둘 다 0이면 ▲와 주의 색으로 감싸고, 퇴근이면 흐리게 둔다.
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
      <span aria-hidden="true" className={cn("font-semibold", !idle && !checkedOut && "text-foreground")}>
        {formatNumber(locale, done)}
      </span>
      <span aria-hidden="true" className={idle ? undefined : "text-muted"}>
        +{formatNumber(locale, reserved)}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * 원장 탭 상태별 건수 아래의 Therapist별 한 줄: "한 것 +예약 │ 린 3 +2 · 마이 0 +1 …", 끝에 "미배정 N".
 * 보기만 하는 띠라 누르는 것이 없다. 올릴 Therapist도 미배정도 없으면 그리지 않는다.
 */
export function TherapistCallStrip({
  locale,
  rows,
  unassignedCount
}: {
  locale: Locale;
  /** 원장 날짜의 가능 판정 행. 출근 상태와 콜 수를 쓴다. */
  rows: TherapistAvailabilityRowDto[];
  /** 예약 상태인데 첫 번째 Therapist가 빈 콜 수. */
  unassignedCount: number;
}) {
  const stripRows = therapistCallStripRows(rows);
  if (stripRows.length === 0 && unassignedCount === 0) return null;

  return (
    <ul aria-label={t(locale, "calls.therapistCounts.aria")} className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1.5 text-sm">
      <li className="text-xs font-semibold text-muted">{t(locale, "calls.therapistCounts.legend")}</li>
      {stripRows.map((row) => {
        const checkedOut = row.attendance === "checked_out";
        return (
          <li className={cn("inline-flex items-baseline gap-1.5", checkedOut && "text-muted")} data-therapist-call-strip={row.therapistId} key={row.therapistId}>
            <span className={cn("font-semibold", !checkedOut && "text-foreground")}>{row.therapistName}</span>
            {checkedOut ? <span className="text-xs">{t(locale, "calls.availability.checkedOutTag")}</span> : null}
            <TherapistCallCount locale={locale} row={row} />
          </li>
        );
      })}
      {unassignedCount > 0 ? (
        <li className="font-semibold text-foreground" data-unassigned-call-count="">
          {t(locale, "calls.therapistCounts.unassigned", { count: formatNumber(locale, unassignedCount) })}
        </li>
      ) : null}
    </ul>
  );
}
