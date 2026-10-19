"use client";

import { useState } from "react";
import { DetailRow } from "@/components/ui/detail-row";
import { ModalPanel } from "@/components/ui/panel";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { therapistAttendanceMethodLabel, scheduleStatusLabel } from "@/lib/i18n/codes";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import type { TherapistAttendanceCalendarDayDto } from "@/modules/therapists/therapist-attendance-calendar-service";

// 압축 칸(7열 그리드)에 쓰는 작은 기호. StatusIndicator(status-indicator.tsx)와 같은 기호·색이다.
const TONE_GLYPH: Record<"info" | "success" | "warning" | "danger", string> = {
  info: "◆",
  success: "●",
  warning: "▲",
  danger: "■"
};
const TONE_TEXT_CLASS: Record<"info" | "success" | "warning" | "danger", string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger"
};

type AttendanceBadge = { label: string; tone: StatusTone };

// 칸 하나가 가질 수 있는 배지를 우선순위대로 둔다(심각한 것 먼저). 압축 칸은 이 가운데 첫 배지의
// 기호만 보이고, 패널(날짜 상세)은 전부 보인다.
function attendanceDayBadges(t: ReturnType<typeof useT>, day: TherapistAttendanceCalendarDayDto): AttendanceBadge[] {
  const badges: AttendanceBadge[] = [];
  if (day.judgment.isAbsent) badges.push({ label: t("therapist.attendance.dayDetail.absentBadge"), tone: "danger" });
  if (day.judgment.isClockOutMissing) badges.push({ label: t("therapist.attendance.dayDetail.clockOutMissingBadge"), tone: "warning" });
  if (day.judgment.isUnscheduledAttendance) badges.push({ label: t("therapist.attendance.dayDetail.unscheduledBadge"), tone: "info" });
  if (day.judgment.lateMinutes !== null) {
    badges.push({ label: t("therapist.attendance.dayDetail.lateBadge", { minutes: day.judgment.lateMinutes }), tone: "warning" });
  }
  if (day.isFullAttendanceRecognized) badges.push({ label: t("therapist.attendance.dayDetail.fullAttendanceBadge"), tone: "success" });
  return badges;
}

function formatDayNumber(isoDate: string) {
  return String(Number(isoDate.slice(8, 10)));
}

// 월요일 시작(기존 근무표 주간 보기와 같은 규칙). getUTCDay()는 일요일이 0이다.
function weekdayIndexMondayFirst(isoDate: string) {
  const day = new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
  return (day + 6) % 7;
}

// 2023-01-02는 월요일이다. 어느 달을 보고 있어도 머리글 7개는 이 한 주에서 구한다.
const WEEKDAY_HEADER_REFERENCE_DATES = ["2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06", "2023-01-07", "2023-01-08"];

function weekdayHeaders(locale: Locale) {
  const formatter = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "ko-KR", { timeZone: "UTC", weekday: "short" });
  return WEEKDAY_HEADER_REFERENCE_DATES.map((date) => formatter.format(new Date(`${date}T00:00:00.000Z`)));
}

function formatFullDate(locale: Locale, isoDate: string) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "ko-KR", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date(`${isoDate}T00:00:00.000Z`));
}

function AttendanceDayDetail({ locale, day }: { locale: Locale; day: TherapistAttendanceCalendarDayDto }) {
  const t = useT();
  const badges = attendanceDayBadges(t, day);

  return (
    <dl className="grid gap-0">
      <DetailRow
        label={t("therapist.attendance.dayDetail.scheduleLabel")}
        value={scheduleStatusLabel(locale, day.planStatus)}
      />
      <DetailRow label={t("therapist.attendance.dayDetail.plannedStartTimeLabel")} value={day.plannedStartTime ?? t("therapist.attendance.dayDetail.noValue")} />
      <DetailRow
        label={t("therapist.attendance.dayDetail.checkInLabel")}
        value={
          day.checkInTime
            ? `${day.checkInTime} · ${therapistAttendanceMethodLabel(locale, day.checkInMethod!)}`
            : t("therapist.attendance.dayDetail.noRecordValue")
        }
      />
      <DetailRow
        label={t("therapist.attendance.dayDetail.checkOutLabel")}
        value={
          day.checkOutTime
            ? `${day.checkOutTime} · ${therapistAttendanceMethodLabel(locale, day.checkOutMethod!)}`
            : t("therapist.attendance.dayDetail.noRecordValue")
        }
      />
      <DetailRow
        label={t("therapist.attendance.dayDetail.judgmentLabel")}
        value={
          badges.length === 0 ? (
            t("therapist.attendance.dayDetail.noJudgmentValue")
          ) : (
            <span className="flex flex-wrap justify-end gap-1.5">
              {badges.map((badge) => (
                <StatusIndicator key={badge.label} label={badge.label} size="sm" tone={badge.tone} />
              ))}
            </span>
          )
        }
      />
      {/* 08·09가 채울 자리(휴무 신청·정정 요청 상태). 이 티켓은 모양만 두고 항상 "없음"이다. */}
      <DetailRow label={t("therapist.attendance.dayDetail.requestLabel")} value={t("therapist.attendance.dayDetail.noValue")} />
    </dl>
  );
}

/**
 * 근태 달력(티켓 06, 스펙 D18). 월요일 시작 7열 그리드. 칸은 날짜와 가장 급한 배지 기호 하나만 보이고,
 * 누르면 패널에 그날 전체(근무표·출퇴근·방식·판정·신청 상태 자리)를 보인다 — 390px에서 모든 내용을
 * 칸 안에 바로 적으면 읽을 수 없어서다(코드베이스 지도에 선례가 없어 이번 티켓에서 정한 모양, 가정).
 */
export function TherapistAttendanceCalendar({
  locale,
  monthKey,
  todayServiceDate,
  days
}: {
  locale: Locale;
  monthKey: string;
  todayServiceDate: string;
  days: TherapistAttendanceCalendarDayDto[];
}) {
  const t = useT();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedDay = days.find((day) => day.date === selectedDate) ?? null;

  if (days.length === 0) {
    return (
      <ScreenState
        description={t("therapist.attendance.calendar.empty.description")}
        kind="empty"
        label={t("common.screenState.empty")}
        title={t("therapist.attendance.calendar.empty.title")}
      />
    );
  }

  const leadingBlankCount = weekdayIndexMondayFirst(days[0]!.date);
  const monthLabel = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "ko-KR", { timeZone: "UTC", year: "numeric", month: "long" }).format(
    new Date(`${monthKey}-01T00:00:00.000Z`)
  );

  return (
    <div>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
        {weekdayHeaders(locale).map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div aria-label={t("therapist.attendance.calendar.aria", { month: monthLabel })} className="mt-2 grid grid-cols-7 gap-1" role="grid">
        {Array.from({ length: leadingBlankCount }, (_, index) => <div aria-hidden="true" key={`blank-${index}`} />)}
        {days.map((day) => {
          const badges = attendanceDayBadges(t, day);
          const primaryBadge = badges[0] ?? null;
          const isToday = day.date === todayServiceDate;
          const fullDate = formatFullDate(locale, day.date);
          const ariaLabel =
            t("therapist.attendance.cell.aria", { date: fullDate }) + (primaryBadge ? ` · ${primaryBadge.label}` : "");

          return (
            <button
              aria-label={ariaLabel}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md border bg-surface text-sm transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary",
                isToday ? "border-brand" : "border-border"
              )}
              key={day.date}
              onClick={() => setSelectedDate(day.date)}
              type="button"
            >
              <span className={cn("font-semibold [font-variant-numeric:tabular-nums]", isToday ? "text-brand" : "text-foreground")}>
                {formatDayNumber(day.date)}
              </span>
              {primaryBadge ? (
                <span aria-hidden="true" className={TONE_TEXT_CLASS[primaryBadge.tone as keyof typeof TONE_TEXT_CLASS]}>
                  {TONE_GLYPH[primaryBadge.tone as keyof typeof TONE_GLYPH]}
                </span>
              ) : (
                <span aria-hidden="true" className="h-[1em]" />
              )}
            </button>
          );
        })}
      </div>

      <ModalPanel onOpenChange={(open) => !open && setSelectedDate(null)} open={selectedDay !== null} title={selectedDay ? formatFullDate(locale, selectedDay.date) : ""}>
        {selectedDay ? <AttendanceDayDetail day={selectedDay} locale={locale} /> : null}
      </ModalPanel>
    </div>
  );
}
