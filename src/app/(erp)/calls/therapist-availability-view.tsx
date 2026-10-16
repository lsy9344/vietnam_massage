"use client";

import { useState } from "react";
import type { ServiceCallOption, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";
import { clockMinutes } from "@/app/(erp)/calls/quick-booking-now-slot";
import { TherapistCallCount } from "@/app/(erp)/calls/therapist-call-counts";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { WarningList } from "@/components/ui/warning-summary";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export type AvailabilityCourseChoice = {
  startTime: string;
  therapistId: string;
  courseId: string;
};

/**
 * 시간이 겹치거나(time_short) 수당이 없는(rate_missing) 배정을 "경고 확인 후 배정" 경로로 받을 때의
 * 선택(티켓 21). verdict를 함께 담아 부르는 쪽이 보여줄 경고 문장을 고른다.
 */
export type AvailabilityCourseOverrideChoice = AvailabilityCourseChoice & {
  verdict: "time_short" | "rate_missing";
};

/**
 * 출근 시각이 입력된 Therapist(출근 중과 퇴근 포함)만 남긴다. 걸러 낼 때는 첫 번째 Therapist 목록과
 * 두 번째 Therapist 후보 목록이 같은 결과를 쓰도록 한 곳에서 계산한다.
 * 아무도 출근이 입력되지 않았으면(아직 출근 전이거나 출근 입력이 없는 날짜) 걸러 낼 근거가 없어 전체를
 * 그대로 돌려주고 nobodyAttended로 알린다. hiddenCount는 출근이 입력되지 않은 Therapist 수다.
 */
export function filterByAttendance(rows: TherapistAvailabilityRowDto[], showAll: boolean) {
  const attended = rows.filter((row) => row.attendance !== "before_check_in");
  if (attended.length === 0) return { rows, hiddenCount: 0, nobodyAttended: rows.length > 0 };
  return { rows: showAll ? rows : attended, hiddenCount: rows.length - attended.length, nobodyAttended: false };
}

/**
 * 가능한 Therapist → 곧 비는 Therapist(빈 시각이 이른 순) → 퇴근한 Therapist 순서(스펙 D6). 같은 묶음 안에서는
 * 서비스가 준 순서를 지킨다. 빈 시각은 고른 시각 뒤의 시각이라 고른 시각에서 몇 분 뒤인지로 비교한다(자정을 넘겨도
 * 같은 영업일 안에서 순서가 맞는다). 빈 시각을 모르면 그 묶음 맨 뒤다.
 */
export function sortAvailabilityRows(rows: TherapistAvailabilityRowDto[], time: string) {
  const at = clockMinutes(time);
  const rank = (row: TherapistAvailabilityRowDto) => {
    if (row.attendance === "checked_out") return [2, 0];
    if (row.available) return [0, 0];
    return [1, row.freeFrom ? (clockMinutes(row.freeFrom) - at + 1440) % 1440 : Number.POSITIVE_INFINITY];
  };
  return rows
    .map((row, index) => ({ row, index, rank: rank(row) }))
    .sort((left, right) => left.rank[0] - right.rank[0] || left.rank[1] - right.rank[1] || left.index - right.index)
    .map((entry) => entry.row);
}

export type AvailabilityAttendanceFilter = {
  hiddenCount: number;
  nobodyAttended: boolean;
  onShowAllChange: (showAll: boolean) => void;
  showAll: boolean;
};

// 불가 칩을 눌렀을 때 줄 아래에 보이는 이유. 두 번째 Therapist 후보 목록(티켓 21)도 같은 문구를 쓴다.
export function impossibleCourseLabel(locale: Locale, course: TherapistAvailabilityRowDto["courses"][number]) {
  const values = { code: course.courseCode, minutes: course.durationMinutes };
  return course.verdict === "rate_missing"
    ? t(locale, "calls.availability.courseRateMissing", values)
    : t(locale, "calls.availability.courseTimeShort", values);
}

/** 한 줄 아래에 펼친 것: 경고 문구, 또는 누른 불가 칩의 이유와 "경고 확인 후 배정". 한 번에 하나만 펼친다. */
export type AvailabilityRowExpansion = { kind: "warnings" } | { kind: "course"; courseId: string } | null;

// 판정과 시각은 서비스가 정한다. 화면은 그 값을 문장으로만 바꾼다. "이 시각"과 "다음 예약"을 한 칸으로 합친다(D1).
// 가능하면 다음 예약과 여유 분(다음 예약이 없으면 영업 끝까지의 여유 분)을, 불가면 빈 시각과 다음 예약을 붙인다.
function RowStatus({ locale, row }: { locale: Locale; row: TherapistAvailabilityRowDto }) {
  const next = row.nextReservationTime ? t(locale, "calls.availability.nextShort", { time: row.nextReservationTime }) : null;
  const free = row.available && row.freeMinutes !== null ? t(locale, "calls.availability.freeMinutes", { minutes: row.freeMinutes }) : null;
  const detail = [next, free].filter(Boolean).join(" · ");
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
      {row.available ? (
        <StatusIndicator label={t(locale, "calls.availability.available")} size="sm" tone="success" />
      ) : (
        <StatusIndicator label={t(locale, "calls.availability.unavailableFrom", { time: row.freeFrom ?? "" })} size="sm" tone="neutral" />
      )}
      {detail ? <span>{detail}</span> : null}
    </span>
  );
}

// 근무 확인 필요, 시술 중 종료 확인, 앞 시술 종료 확인 필요. 앞 시술 종료 확인은 가능 코스가 있을 때만 붙인다.
export function availabilityRowWarnings(locale: Locale, row: TherapistAvailabilityRowDto) {
  const warnings: string[] = [];
  if (row.shiftCheck) warnings.push(t(locale, "calls.availability.shiftCheck"));
  if (!row.available && row.unavailableReason === "in_service_past_display_end" && row.inServiceDisplayEnd) {
    warnings.push(t(locale, "calls.availability.inServiceEndCheck", { time: row.inServiceDisplayEnd }));
  }
  if (row.priorServiceEndCheck && row.courses.some((course) => course.verdict === "possible")) {
    warnings.push(t(locale, "calls.availability.priorServiceEndCheck"));
  }
  return warnings;
}

// Button의 글자는 전역 font: inherit 규칙 때문에 부모 글꼴로 그려진다. 좁은 서랍에 칩 셋이 한 줄로 들어가도록
// 칩 글자는 안쪽 span에서 14px/600으로 정한다.
const chipClassName = "h-11 gap-1 whitespace-nowrap px-2.5";
const chipTextClassName = "text-sm font-semibold";

/**
 * 가능 코스의 한 줄(스펙 D1–D5): 이름(퇴근이면 흐린 "퇴근")과 그날 콜 수 · 상태 · 코스 칩 · 경고 아이콘. 펼친 것은 줄 아래에 연다.
 * 첫 Therapist 목록과 두 번째 Therapist 후보 목록이 함께 쓴다. 두 번째 목록은 고른 코스의 칩 하나만 넘긴다.
 */
export function AvailabilityRow({
  courses,
  expansion,
  locale,
  reserveWarningSlot = true,
  row,
  second = false,
  time,
  disabled,
  onChoose,
  onExpansionChange,
  onOverride
}: {
  /** 보일 코스 칩. 주지 않으면 서비스가 준 코스 전부다. */
  courses?: TherapistAvailabilityRowDto["courses"];
  expansion: AvailabilityRowExpansion;
  locale: Locale;
  /** 경고가 없는 줄에도 경고 아이콘 자리를 비워 두어 칩이 줄마다 같은 자리에 오게 한다. 목록에 경고가 하나도 없으면 끈다. */
  reserveWarningSlot?: boolean;
  row: TherapistAvailabilityRowDto;
  /** 두 번째 Therapist 후보 목록의 줄. 첫 목록의 줄과 id·표지 속성이 겹치지 않게 한다. */
  second?: boolean;
  time: string;
  disabled?: boolean;
  onChoose: (choice: AvailabilityCourseChoice) => void;
  onExpansionChange: (expansion: AvailabilityRowExpansion) => void;
  onOverride?: (choice: AvailabilityCourseOverrideChoice) => void;
}) {
  const chips = courses ?? row.courses;
  const idBase = `${second ? "second-therapist" : "therapist-availability"}-${row.therapistId}`;
  const warningsId = `${idBase}-warnings`;
  const reasonId = `${idBase}-reason`;
  const warnings = availabilityRowWarnings(locale, row);
  const warningsOpen = expansion?.kind === "warnings";
  const openCourse = expansion?.kind === "course" ? chips.find((course) => course.courseId === expansion.courseId) ?? null : null;
  const rowAttributes = second ? { "data-second-therapist-row": row.therapistId } : { "data-availability-row": row.therapistId };

  return (
    <li className="grid gap-1.5 border-b border-border py-1.5 last:border-b-0" {...rowAttributes}>
      <div className="flex items-center gap-2">
        <div className="grid min-w-24 flex-1 gap-1">
          <span className="flex min-w-0 items-baseline gap-1.5 text-sm">
            <span className="font-semibold text-foreground [overflow-wrap:anywhere]">{row.therapistName}</span>
            {row.attendance === "checked_out" ? <span className="shrink-0 text-xs text-muted">{t(locale, "calls.availability.checkedOutTag")}</span> : null}
            <TherapistCallCount locale={locale} row={row} />
          </span>
          <RowStatus locale={locale} row={row} />
        </div>
        <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
          {chips.map((course) => {
            const chipText = t(locale, "calls.availability.chip", { code: course.courseCode, minutes: course.durationMinutes });
            if (course.verdict === "possible") {
              return (
                <Button
                  aria-describedby={warnings.length > 0 ? warningsId : undefined}
                  aria-label={t(locale, "calls.availability.coursePossible", { code: course.courseCode, minutes: course.durationMinutes })}
                  className={cn(chipClassName, "border-border-strong")}
                  data-course-id={course.courseId}
                  data-start-time={time}
                  data-therapist-id={row.therapistId}
                  disabled={disabled}
                  key={course.courseId}
                  onClick={() => onChoose({ startTime: time, therapistId: row.therapistId, courseId: course.courseId })}
                  variant="secondary"
                >
                  <span className={chipTextClassName}>{chipText}</span>
                </Button>
              );
            }
            const open = openCourse?.courseId === course.courseId;
            return (
              <Button
                aria-controls={open ? reasonId : undefined}
                aria-expanded={open}
                aria-label={impossibleCourseLabel(locale, course)}
                className={cn(chipClassName, "border-dashed text-muted", open && "bg-readonly")}
                data-course-id={course.courseId}
                data-therapist-id={row.therapistId}
                disabled={disabled}
                key={course.courseId}
                onClick={() => onExpansionChange(open ? null : { kind: "course", courseId: course.courseId })}
                variant="secondary"
              >
                <span aria-hidden="true">{"○︎"}</span>
                <span className={chipTextClassName}>{chipText}</span>
              </Button>
            );
          })}
        </div>
        {warnings.length > 0 ? (
          <Button
            aria-controls={warningsId}
            aria-expanded={warningsOpen}
            aria-label={t(locale, "calls.availability.warningsToggle", { count: warnings.length })}
            className={cn("w-11 shrink-0 justify-center bg-warning-soft px-0 text-warning hover:bg-warning-soft", warningsOpen && "outline outline-1 outline-warning")}
            onClick={() => onExpansionChange(warningsOpen ? null : { kind: "warnings" })}
            variant="ghost"
          >
            <span aria-hidden="true">{"▲︎"}</span>
            {warnings.length > 1 ? <span aria-hidden="true">{warnings.length}</span> : null}
          </Button>
        ) : reserveWarningSlot ? (
          <span aria-hidden="true" className="w-11 shrink-0" />
        ) : null}
      </div>
      {warnings.length > 0 ? (
        <div className="pb-1.5" hidden={!warningsOpen} id={warningsId}>
          <WarningList label={t(locale, "calls.availability.warningsToggle", { count: warnings.length })} warnings={warnings} />
        </div>
      ) : null}
      {openCourse && openCourse.verdict !== "possible" ? (
        <div className="flex flex-wrap items-center gap-2 pb-1.5" id={reasonId}>
          <p className="text-sm text-foreground">{impossibleCourseLabel(locale, openCourse)}</p>
          {onOverride ? (
            <Button
              className="border-warning text-warning hover:bg-warning-soft"
              data-override-course-id={openCourse.courseId}
              data-therapist-id={row.therapistId}
              disabled={disabled}
              onClick={() =>
                onOverride({ startTime: time, therapistId: row.therapistId, courseId: openCourse.courseId, verdict: openCourse.verdict as "time_short" | "rate_missing" })
              }
              variant="secondary"
            >
              {t(locale, "calls.quickBooking.therapist.overrideAssign")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function TherapistAvailabilityView({
  attendanceFilter,
  failed,
  locale,
  open,
  pending,
  rows,
  time,
  timeSlots,
  onChoose,
  onOverride,
  onTimeChange,
  onToggle
}: {
  /** 주면 출근 전 Therapist를 숨겼다는 안내와 "출근 전도 보기" 체크칸을 보인다(rows는 부르는 쪽이 이미 걸러 넘긴다). */
  attendanceFilter?: AvailabilityAttendanceFilter;
  failed: boolean;
  locale: Locale;
  open: boolean;
  pending: boolean;
  rows: TherapistAvailabilityRowDto[];
  time: string;
  timeSlots: ServiceCallOption[];
  onChoose: (choice: AvailabilityCourseChoice) => void;
  /**
   * 시간 부족·수당 없음 코스를 "경고 확인 후 배정" 경로로 받을 때(티켓 21). 주면 불가 칩을 눌렀을 때 이유 옆에
   * 그 버튼을 보이고, 주지 않으면 이유만 보인다.
   */
  onOverride?: (choice: AvailabilityCourseOverrideChoice) => void;
  onTimeChange: (time: string) => void;
  onToggle: () => void;
}) {
  const title = t(locale, "calls.availability.title");
  const [expanded, setExpanded] = useState<{ therapistId: string; expansion: AvailabilityRowExpansion } | null>(null);
  const reserveWarningSlot = rows.some((row) => availabilityRowWarnings(locale, row).length > 0);

  return (
    <section aria-label={title} className="mb-4 rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 px-4 py-2">
        <h2 className="text-[0.9375rem] font-semibold text-foreground">{title}</h2>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted" htmlFor="therapist-availability-time">
          {t(locale, "calls.availability.time")}
          <select
            className={inputFieldClassName({ className: "min-w-28" })}
            id="therapist-availability-time"
            onChange={(event) => onTimeChange(event.target.value)}
            value={time}
          >
            {timeSlots.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          aria-controls="therapist-availability-panel"
          aria-expanded={open}
          id="therapist-availability-expand"
          onClick={onToggle}
          variant="secondary"
        >
          {open ? t(locale, "calls.availability.collapse") : t(locale, "calls.availability.expand")}
        </Button>
      </div>
      {open ? (
        <div className="border-t border-border px-4 py-2" id="therapist-availability-panel">
          {attendanceFilter?.nobodyAttended ? (
            <p className="mb-2 text-xs text-muted">{t(locale, "calls.availability.attendanceNone")}</p>
          ) : null}
          {attendanceFilter && attendanceFilter.hiddenCount > 0 ? (
            <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
              <input
                checked={attendanceFilter.showAll}
                className="h-5 w-5 accent-brand"
                onChange={(event) => attendanceFilter.onShowAllChange(event.target.checked)}
                type="checkbox"
              />
              {t(locale, "calls.availability.showBeforeCheckIn", { count: attendanceFilter.hiddenCount })}
            </label>
          ) : null}
          {pending ? <p className="text-sm text-muted">{t(locale, "calls.availability.loading")}</p> : null}
          {failed ? <p className="text-sm text-danger">{t(locale, "calls.availability.loadError")}</p> : null}
          {!pending && !failed && rows.length === 0 ? (
            <div className="grid gap-1">
              <p className="text-sm text-foreground">{t(locale, "calls.availability.empty")}</p>
              <p className="text-sm text-muted">{t(locale, "calls.availability.emptyNext")}</p>
            </div>
          ) : null}
          {!pending && !failed && rows.length > 0 ? (
            <ul className="grid">
              {sortAvailabilityRows(rows, time).map((row) => (
                <AvailabilityRow
                  expansion={expanded?.therapistId === row.therapistId ? expanded.expansion : null}
                  key={row.therapistId}
                  locale={locale}
                  onChoose={onChoose}
                  onExpansionChange={(expansion) => setExpanded(expansion ? { therapistId: row.therapistId, expansion } : null)}
                  onOverride={onOverride}
                  reserveWarningSlot={reserveWarningSlot}
                  row={row}
                  time={time}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
