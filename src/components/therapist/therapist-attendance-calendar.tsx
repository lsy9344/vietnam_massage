"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ModalPanel } from "@/components/ui/panel";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { therapistAttendanceMethodLabel, therapistRequestKindLabel, therapistRequestStatusLabel, scheduleStatusLabel } from "@/lib/i18n/codes";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { cancelTherapistRequestAction, requestTherapistDayOffAction, type TherapistRequestActionState } from "@/app/therapist/attendance/actions";
import type { TherapistAttendanceCalendarDayDto, TherapistAttendanceDayRequestStatus } from "@/modules/therapists/therapist-attendance-calendar-service";

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
  if (day.isSpecialDayOff) badges.push({ label: t("therapistRequestKind.special_day_off"), tone: "danger" });
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

const REQUEST_STATUS_TONE: Record<"pending" | "approved" | "rejected" | "canceled" | "expired", StatusTone> = {
  pending: "info",
  approved: "success",
  rejected: "danger",
  canceled: "neutral",
  expired: "neutral"
};

// 휴무 계열(보통 휴무, 소중한날 휴가)만 이 조작의 "대기 중" 취소 UI를 받는다(D22, R1·R2). 서비스
// 쪽의 isDayOffFamilyKind(therapist-request-service.ts)와 같은 구분이다.
type TherapistRequestKindOfDay = NonNullable<TherapistAttendanceDayRequestStatus>["kind"];
function isDayOffFamilyRequestKind(kind: TherapistRequestKindOfDay) {
  return kind === "day_off" || kind === "special_day_off";
}

/**
 * 휴무 신청·취소(스펙 D22, 티켓 08). 근태 달력(06)의 requestStatus 자리는 날짜만 알므로
 * (TherapistAttendanceDayRequestStatus에 신청 id가 없다) 취소는 날짜로 찾아 처리한다
 * (cancelTherapistDayOffRequestForDate). 정정 요청(09)은 다른 화면(정정 요청 만들기)에서 만든다.
 *
 * R1: 그날 대기 중인 신청이 정정이면(종류를 안 보고 status만 보면 생기던 버그) 이 휴무 취소 UI를
 * 보이지 않는다 — "신청 보냄" 줄은 위 dl의 requestLabel이 이미 종류와 함께 보여준다. R3(사용자
 * 이야기 98)로 같은 날 다른 종류의 대기 중인 신청이 있으면 새 휴무 신청도 서버가 막으므로, 그 사이에는
 * "신청" 버튼도 보이지 않는다.
 */
export function DayOffRequestControls({ day }: { day: TherapistAttendanceCalendarDayDto }) {
  const t = useT();
  const [requestState, requestAction, requestPending] = useActionState<TherapistRequestActionState, FormData>(requestTherapistDayOffAction, null);
  const [cancelState, cancelAction, cancelPending] = useActionState<TherapistRequestActionState, FormData>(cancelTherapistRequestAction, null);
  const [formOpen, setFormOpen] = useState(false);
  const reasonId = useId();
  const kindId = useId();

  const requestFormError = requestState && !requestState.ok ? requestState.formError : undefined;
  const cancelFormError = cancelState && !cancelState.ok ? cancelState.formError : undefined;

  const pendingOtherKind = day.requestStatus?.status === "pending" && !isDayOffFamilyRequestKind(day.requestStatus.kind);
  // 서버가 다시 읽기 전까지는 이 자리에서 지금 한 행동(신청/취소)의 결과를 먼저 보인다. 서버 값은
  // revalidatePath로 곧 뒤따라온다 — 둘이 어긋나는 사이에도 이 화면만은 맞는 쪽을 보인다.
  const effectivelyPending =
    cancelState?.ok ? false : requestState?.ok ? true : day.requestStatus?.status === "pending" && isDayOffFamilyRequestKind(day.requestStatus.kind);
  // 승인되면 서버가 planStatus를 "휴무"로 바꾸므로, 이 칸은 더는 신청·취소 어느 쪽도 보이지 않는다.
  const alreadyDayOff = day.planStatus === "휴무";

  if (alreadyDayOff || pendingOtherKind) {
    return null;
  }

  if (effectivelyPending) {
    return (
      <form action={cancelAction} className="grid gap-2">
        <input name="date" type="hidden" value={day.date} />
        <div className="flex items-center justify-between gap-3">
          <StatusIndicator label={t("therapist.attendance.dayOff.sentNotice")} size="sm" tone="info" />
          <Button disabled={cancelPending} type="submit" variant="secondary">
            {cancelPending ? t("therapist.attendance.dayOff.canceling") : t("therapist.attendance.dayOff.cancelButton")}
          </Button>
        </div>
        {cancelFormError ? (
          <span className="text-sm text-danger" role="alert">
            {cancelFormError}
          </span>
        ) : null}
      </form>
    );
  }

  if (!formOpen) {
    return (
      <div>
        <Button onClick={() => setFormOpen(true)} type="button" variant="secondary">
          {t("therapist.attendance.dayOff.requestButton")}
        </Button>
      </div>
    );
  }

  return (
    <form action={requestAction} className="grid gap-2 rounded-md border border-border bg-surface-float p-3">
      <input name="date" type="hidden" value={day.date} />
      <label className="grid gap-1.5 text-sm font-semibold text-foreground" htmlFor={kindId}>
        {t("therapist.attendance.dayOff.kindLabel")}
        <select className={inputFieldClassName()} defaultValue="day_off" disabled={requestPending} id={kindId} name="kind">
          <option value="day_off">{t("therapistRequestKind.day_off")}</option>
          <option value="special_day_off">{t("therapistRequestKind.special_day_off")}</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-foreground" htmlFor={reasonId}>
        {t("therapist.attendance.dayOff.reasonLabel")}
        <textarea
          className={inputFieldClassName({ className: "h-auto min-h-20 py-2" })}
          disabled={requestPending}
          id={reasonId}
          name="reason"
          placeholder={t("therapist.attendance.dayOff.reasonPlaceholder")}
        />
      </label>
      {requestFormError ? (
        <span className="text-sm text-danger" role="alert">
          {requestFormError}
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        <Button disabled={requestPending} type="submit">
          {requestPending ? t("therapist.attendance.dayOff.submitting") : t("therapist.attendance.dayOff.submit")}
        </Button>
        <Button disabled={requestPending} onClick={() => setFormOpen(false)} type="button" variant="ghost">
          {t("therapist.attendance.dayOff.dismiss")}
        </Button>
      </div>
    </form>
  );
}

function AttendanceDayDetail({ locale, day, todayServiceDate }: { locale: Locale; day: TherapistAttendanceCalendarDayDto; todayServiceDate: string }) {
  const t = useT();
  const badges = attendanceDayBadges(t, day);
  const isFuture = day.date >= todayServiceDate;

  return (
    <div className="grid gap-3">
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
        {/* 08이 채우고 09(정정 요청)가 같은 자리를 그대로 쓴다. */}
        <DetailRow
          label={t("therapist.attendance.dayDetail.requestLabel")}
          value={
            day.requestStatus ? (
              <span className="flex flex-col items-end gap-1">
                <StatusIndicator
                  label={`${therapistRequestKindLabel(locale, day.requestStatus.kind)} · ${therapistRequestStatusLabel(locale, day.requestStatus.status)}`}
                  size="sm"
                  tone={REQUEST_STATUS_TONE[day.requestStatus.status]}
                />
                {day.requestStatus.status === "rejected" && day.requestStatus.rejectionReason ? (
                  <span className="text-xs text-muted">{t("therapist.attendance.dayDetail.requestRejectionReason", { reason: day.requestStatus.rejectionReason })}</span>
                ) : null}
              </span>
            ) : (
              t("therapist.attendance.dayDetail.noValue")
            )
          }
        />
      </dl>
      {/* 정정 요청(09)은 다른 흐름(퇴근 미입력 안내)에서 들어온다. 휴무 신청은 앞으로의 날짜에서만 연다. */}
      {isFuture ? <DayOffRequestControls day={day} /> : null}
    </div>
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
                day.isSpecialDayOff ? "border-danger bg-danger-soft hover:bg-danger-soft" : isToday ? "border-brand" : "border-border"
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

      {days.some((day) => day.isSpecialDayOff) ? (
        <p className="mt-3 text-xs font-semibold text-danger">■ {t("therapistRequestKind.special_day_off")}</p>
      ) : null}

      <ModalPanel onOpenChange={(open) => !open && setSelectedDate(null)} open={selectedDay !== null} title={selectedDay ? formatFullDate(locale, selectedDay.date) : ""}>
        {selectedDay ? <AttendanceDayDetail day={selectedDay} locale={locale} todayServiceDate={todayServiceDate} /> : null}
      </ModalPanel>
    </div>
  );
}
