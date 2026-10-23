"use client";

import { useState } from "react";
import { DateCapsule } from "@/components/ui/date-capsule";
import { DetailRow } from "@/components/ui/detail-row";
import { ModalPanel } from "@/components/ui/panel";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator, statusGlyphChar, toneTextClassName, type StatusTone } from "@/components/ui/status-indicator";
import { therapistAttendanceMethodLabel, therapistRequestKindLabel, therapistRequestStatusLabel, scheduleStatusLabel } from "@/lib/i18n/codes";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import { intlLocale } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { TherapistAttendanceCalendarDayDto } from "@/modules/therapists/therapist-attendance-calendar-service";

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
  const formatter = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", weekday: "short" });
  return WEEKDAY_HEADER_REFERENCE_DATES.map((date) => formatter.format(new Date(`${date}T00:00:00.000Z`)));
}

function formatFullDate(locale: Locale, isoDate: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
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

/**
 * 휴무 안내(2026-10-23 고객 요청). 휴무·소중한날 휴가는 Therapist가 여기서 신청하지 않고, 텔레그램으로
 * 카운터에 알리면 카운터가 휴무 등록 화면(/day-offs)에서 기간으로 등록한다. 이미 휴무인
 * 날에는 보이지 않는다.
 */
export function DayOffCounterNotice({ day }: { day: TherapistAttendanceCalendarDayDto }) {
  const t = useT();
  if (day.planStatus === "휴무") return null;
  return <p className="rounded-md bg-background px-3 py-2.5 text-sm text-muted">{t("therapist.attendance.dayOff.counterNotice")}</p>;
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
      {/* 정정 요청(09)은 다른 흐름(퇴근 미입력 안내)에서 들어온다. 휴무는 카운터가 등록한다(앞으로의 날짜에만 안내). */}
      {isFuture ? <DayOffCounterNotice day={day} /> : null}
    </div>
  );
}

// 칸·띠·카드가 함께 쓰는 압축 기호. 오늘 칸(검정)에서는 의미색이 묻히므로 밝은 방울 안에 둔다.
// 기호·색은 status-indicator.tsx의 공용 맵을 쓴다(R18) — 여기서 따로 적지 않는다.
function AttendanceGlyph({ badge, onInk = false }: { badge: AttendanceBadge | null; onInk?: boolean }) {
  if (!badge) return <span aria-hidden="true" className="h-[1.125rem]" />;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full text-xs leading-none",
        toneTextClassName[badge.tone],
        onInk && "bg-surface"
      )}
    >
      {statusGlyphChar(badge.tone)}
    </span>
  );
}

function weekdayShort(locale: Locale, isoDate: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", weekday: "short" }).format(new Date(`${isoDate}T00:00:00.000Z`));
}

// 날짜를 누르면 여는 상세 패널. 월 달력과 주 보기가 같은 패널을 쓴다.
function AttendanceDayPanel({
  locale,
  day,
  todayServiceDate,
  onClose
}: {
  locale: Locale;
  day: TherapistAttendanceCalendarDayDto | null;
  todayServiceDate: string;
  onClose: () => void;
}) {
  return (
    <ModalPanel onOpenChange={(open) => !open && onClose()} open={day !== null} placement="center" title={day ? formatFullDate(locale, day.date) : ""}>
      {day ? <AttendanceDayDetail day={day} locale={locale} todayServiceDate={todayServiceDate} /> : null}
    </ModalPanel>
  );
}

// 기호 설명란. 띠·월 칸의 기호는 attendanceDayBadges의 tone을 따르므로 같은 순서(심각한 것 먼저)로 적는다.
// 기호·색은 status-indicator.tsx의 공용 맵을 쓴다(R18).
const LEGEND_TONES = ["danger", "warning", "info", "success"] as const;

/**
 * 띠·월 칸의 기호와 검정 칸이 뜻하는 것. 칸에는 가장 급한 기호 하나만 보이므로 그 점도 함께 적는다
 * (사용자 요청, 2026-10-20). 소중한날 휴가의 붉은 칸도 ■에 들어 있어 따로 적지 않는다.
 */
function AttendanceLegend() {
  const t = useT();
  return (
    <div aria-label={t("therapist.attendance.legend.aria")} className="mt-3 rounded-md bg-surface px-4 py-2.5" role="note">
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-semibold text-foreground">
        {LEGEND_TONES.map((tone) => (
          <li className="inline-flex items-center gap-1.5" key={tone}>
            <span aria-hidden="true" className={toneTextClassName[tone]}>{statusGlyphChar(tone)}</span>
            {t(`therapist.attendance.legend.${tone}`)}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-3 rounded-[4px] bg-brand" />
          {t("therapist.attendance.legend.today")}
        </li>
      </ul>
      <p className="mt-1.5 text-xs text-muted">{t("therapist.attendance.legend.note")}</p>
    </div>
  );
}

function AttendanceEmptyState() {
  const t = useT();
  return (
    <ScreenState
      description={t("therapist.attendance.calendar.empty.description")}
      kind="empty"
      label={t("common.screenState.empty")}
      title={t("therapist.attendance.calendar.empty.title")}
    />
  );
}

/**
 * 근태 달력 월 보기(티켓 06, 스펙 D18). 월요일 시작 7열 그리드. 칸은 날짜와 가장 급한 배지 기호 하나만 보이고,
 * 누르면 패널에 그날 전체(근무표·출퇴근·방식·판정·신청 상태 자리)를 보인다 — 390px에서 모든 내용을
 * 칸 안에 바로 적으면 읽을 수 없어서다. 오늘 칸은 검정으로 채우고, 근무 예정이 아닌 날의 숫자는 흐리게 둔다.
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

  if (days.length === 0) return <AttendanceEmptyState />;

  const leadingBlankCount = weekdayIndexMondayFirst(days[0]!.date);
  const monthLabel = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", year: "numeric", month: "long" }).format(
    new Date(`${monthKey}-01T00:00:00.000Z`)
  );

  return (
    <div>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
        {weekdayHeaders(locale).map((label, index) => (
          <span className="rounded-full bg-surface py-1" key={`${label}-${index}`}>
            {label}
          </span>
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
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary",
                isToday
                  ? "border-brand bg-brand text-brand-foreground hover:bg-brand-strong"
                  : day.isSpecialDayOff
                    ? "border-danger bg-danger-soft hover:bg-danger-soft"
                    : "border-transparent bg-surface hover:bg-readonly"
              )}
              key={day.date}
              onClick={() => setSelectedDate(day.date)}
              type="button"
            >
              <span
                className={cn(
                  "font-semibold leading-none [font-variant-numeric:tabular-nums]",
                  !isToday && (day.planStatus === "근무 예정" ? "text-foreground" : "text-muted")
                )}
              >
                {formatDayNumber(day.date)}
              </span>
              <AttendanceGlyph badge={primaryBadge} onInk={isToday} />
            </button>
          );
        })}
      </div>

      <AttendanceLegend />

      <AttendanceDayPanel day={selectedDay} locale={locale} onClose={() => setSelectedDate(null)} todayServiceDate={todayServiceDate} />
    </div>
  );
}

// 카드에 바로 보일 신청 상태. 취소·만료는 지난 일이라 카드에서는 빼고 패널에서만 보인다.
const CARD_REQUEST_STATUSES = new Set(["pending", "approved", "rejected"]);

// 카드의 칩 줄은 한 줄이다. 넘치면 가장 급한 하나만 두고 나머지는 "+N"으로 접는다(패널에는 모두 보인다).
const MAX_CARD_CHIPS = 2;

/**
 * 주 보기의 날짜 카드. 모든 카드가 같은 높이가 되도록 줄을 고정한다(사용자 요청, 2026-10-20) — 근무표·출근 예정
 * 한 줄, 출근·퇴근 캡슐 한 줄(기록이 없으면 "—"), 칩 한 줄. 390px에서 캡슐 셋은 한 줄에 들어가지 않아 예정 시각은 첫 줄에 둔다. 내용에 따라 줄이 생기고 사라지면 미입력 카드만 낮아져
 * 왼쪽 요일·날짜 칸의 글자가 칸을 벗어났다.
 */
function AttendanceWeekDayCard({
  locale,
  day,
  isToday,
  onOpen
}: {
  locale: Locale;
  day: TherapistAttendanceCalendarDayDto;
  isToday: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  const isScheduled = day.planStatus === "근무 예정";
  const isWorkingNow = isToday && day.checkInTime !== null && day.checkOutTime === null;
  const request = day.requestStatus && CARD_REQUEST_STATUSES.has(day.requestStatus.status) ? day.requestStatus : null;
  const chips: AttendanceBadge[] = [
    ...(isWorkingNow ? [{ label: t("therapist.attendance.week.working"), tone: "info" as const }] : []),
    ...attendanceDayBadges(t, day),
    ...(request
      ? [{ label: `${therapistRequestKindLabel(locale, request.kind)} · ${therapistRequestStatusLabel(locale, request.status)}`, tone: REQUEST_STATUS_TONE[request.status] }]
      : [])
  ];
  const visibleChips = chips.length > MAX_CARD_CHIPS ? chips.slice(0, 1) : chips;
  const foldedChips = chips.slice(visibleChips.length);

  return (
    <li id={`attendance-day-${day.date}`}>
      <button
        className={cn(
          "flex w-full items-stretch gap-3 rounded-md border px-4 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary",
          day.isSpecialDayOff ? "border-danger bg-danger-soft" : cn("bg-surface hover:bg-readonly", isToday ? "border-brand" : "border-border")
        )}
        onClick={onOpen}
        type="button"
      >
        <span className="sr-only">{formatFullDate(locale, day.date)}</span>
        <span
          aria-hidden="true"
          className={cn(
            "flex w-12 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-sm",
            isToday ? "bg-brand text-brand-foreground" : "bg-readonly text-foreground"
          )}
          data-card-part="date"
        >
          <span className="text-xs font-semibold leading-none">{weekdayShort(locale, day.date)}</span>
          <span className="text-xl font-semibold leading-none [font-variant-numeric:tabular-nums]">{formatDayNumber(day.date)}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <span className="flex h-5 items-center justify-between gap-2">
            <span
              className={cn("min-w-0 truncate text-[0.9375rem] font-semibold leading-5", isScheduled ? "text-foreground" : "text-muted")}
              data-card-part="status"
            >
              {scheduleStatusLabel(locale, day.planStatus)}
            </span>
            {day.plannedStartTime ? (
              <span className="shrink-0 text-sm leading-5 text-muted" data-card-part="planned">
                {t("therapist.attendance.week.card.planned", { time: day.plannedStartTime })}
              </span>
            ) : null}
          </span>
          <span className="flex h-7 items-center gap-1.5 overflow-hidden" data-card-part="times">
            <DateCapsule>{t("therapist.attendance.week.card.checkIn", { time: day.checkInTime ?? "—" })}</DateCapsule>
            <DateCapsule>{t("therapist.attendance.week.card.checkOut", { time: day.checkOutTime ?? "—" })}</DateCapsule>
          </span>
          <span className="flex h-5 items-center gap-1.5 overflow-hidden" data-card-part="chips">
            {visibleChips.map((chip) => (
              <StatusIndicator key={chip.label} label={chip.label} size="sm" tone={chip.tone} />
            ))}
            {foldedChips.length > 0 ? (
              <span className="inline-flex min-h-5 shrink-0 items-center rounded-full border border-border px-2 text-xs font-semibold leading-none text-muted">
                <span aria-hidden="true">+{foldedChips.length}</span>
                <span className="sr-only">{foldedChips.map((chip) => chip.label).join(", ")}</span>
              </span>
            ) : null}
          </span>
        </span>
        <span aria-hidden="true" className="self-center text-lg text-muted">
          ›
        </span>
      </button>
    </li>
  );
}

/**
 * 근태 주 보기(근태 탭의 기본 보기). 위에는 월–일 띠(오늘은 검정, 그날 가장 급한 배지 기호)를 두고,
 * 아래에 날짜마다 근무표·출퇴근 시각·판정이 한눈에 보이는 카드를 쌓는다. 띠의 날짜와 카드 어느 쪽을 눌러도
 * 월 보기와 같은 상세 팝업(휴무 신청 포함)이 열린다(사용자 요청, 2026-10-20).
 */
export function TherapistAttendanceWeek({
  locale,
  weekLabel,
  todayServiceDate,
  days
}: {
  locale: Locale;
  weekLabel: string;
  todayServiceDate: string;
  days: TherapistAttendanceCalendarDayDto[];
}) {
  const t = useT();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedDay = days.find((day) => day.date === selectedDate) ?? null;

  if (days.length === 0) return <AttendanceEmptyState />;

  return (
    <div>
      <div aria-label={t("therapist.attendance.week.stripAria")} className="grid grid-cols-7 gap-1" role="group">
        {days.map((day) => {
          const isToday = day.date === todayServiceDate;
          const primaryBadge = attendanceDayBadges(t, day)[0] ?? null;
          return (
            <button
              aria-label={t("therapist.attendance.cell.aria", { date: formatFullDate(locale, day.date) }) + (primaryBadge ? ` · ${primaryBadge.label}` : "")}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary",
                isToday
                  ? "border-brand bg-brand text-brand-foreground hover:bg-brand-strong"
                  : day.isSpecialDayOff
                    ? "border-danger bg-danger-soft"
                    : "border-transparent bg-surface hover:bg-readonly"
              )}
              key={day.date}
              onClick={() => setSelectedDate(day.date)}
              type="button"
            >
              <span className={cn("text-xs font-semibold leading-none", !isToday && "text-muted")}>{weekdayShort(locale, day.date)}</span>
              <span
                className={cn(
                  "text-base font-semibold leading-none [font-variant-numeric:tabular-nums]",
                  !isToday && (day.planStatus === "근무 예정" ? "text-foreground" : "text-muted")
                )}
              >
                {formatDayNumber(day.date)}
              </span>
              <AttendanceGlyph badge={primaryBadge} onInk={isToday} />
            </button>
          );
        })}
      </div>

      <AttendanceLegend />

      <ul aria-label={t("therapist.attendance.week.aria", { range: weekLabel })} className="mt-4 grid gap-2">
        {days.map((day) => (
          <AttendanceWeekDayCard
            day={day}
            isToday={day.date === todayServiceDate}
            key={day.date}
            locale={locale}
            onOpen={() => setSelectedDate(day.date)}
          />
        ))}
      </ul>

      <AttendanceDayPanel day={selectedDay} locale={locale} onClose={() => setSelectedDate(null)} todayServiceDate={todayServiceDate} />
    </div>
  );
}
