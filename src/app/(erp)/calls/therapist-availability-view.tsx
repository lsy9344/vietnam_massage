import type { ReactNode } from "react";
import type { ServiceCallOption, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { WarningSummary } from "@/components/ui/warning-summary";
import { t } from "@/lib/i18n";
import { scheduleStatusLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";

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

export type AvailabilityAttendanceFilter = {
  hiddenCount: number;
  nobodyAttended: boolean;
  onShowAllChange: (showAll: boolean) => void;
  showAll: boolean;
};

// 두 번째 Therapist 후보 목록(티켓 21)도 같은 출근 표시 문구를 쓴다.
export const attendanceKey = {
  before_check_in: "calls.availability.attendance.beforeCheckIn",
  checked_in: "calls.availability.attendance.checkedIn",
  checked_out: "calls.availability.attendance.checkedOut"
} as const;

// 근무표(27)의 그날 근무 예정. 출근(Attendance)과는 다른 테이블·칸이라 서로 다른 값일 수 있고, 가능
// 판정·코스 버튼을 바꾸지 않는 안내일 뿐이다(스토리 12–13, 60, 104, V07, 티켓 29).
function Schedule({ locale, row }: { locale: Locale; row: TherapistAvailabilityRowDto }) {
  return scheduleStatusLabel(locale, row.plannedWorkingDayStatus);
}

// 출근 표시와 근무 확인 필요는 서비스가 정한다. 코스 버튼은 이 칸과 상관없이 그대로 둔다.
function Attendance({ locale, row }: { locale: Locale; row: TherapistAvailabilityRowDto }) {
  const label = t(locale, attendanceKey[row.attendance]);
  if (!row.shiftCheck) return label;
  return (
    <div className="grid justify-items-start gap-1.5">
      {label}
      <WarningSummary locale={locale} warnings={[t(locale, "calls.availability.shiftCheck")]} />
    </div>
  );
}

// 판정과 시각은 서비스가 정한다. 화면은 그 값을 문장으로만 바꾼다.
function ThisTime({ locale, row }: { locale: Locale; row: TherapistAvailabilityRowDto }) {
  if (row.available) return <StatusIndicator label={t(locale, "calls.availability.available")} tone="success" />;
  return (
    <div className="grid justify-items-start gap-1.5">
      <StatusIndicator label={t(locale, "calls.availability.unavailableFrom", { time: row.freeFrom ?? "" })} tone="neutral" />
      {row.unavailableReason === "in_service_past_display_end" && row.inServiceDisplayEnd ? (
        <WarningSummary locale={locale} warnings={[t(locale, "calls.availability.inServiceEndCheck", { time: row.inServiceDisplayEnd })]} />
      ) : null}
    </div>
  );
}

// 두 번째 Therapist 후보 목록(티켓 21)도 같은 "시간 부족"/"이 코스 불가" 문구를 쓴다.
export function impossibleCourseLabel(locale: Locale, course: TherapistAvailabilityRowDto["courses"][number]) {
  const values = { code: course.courseCode, minutes: course.durationMinutes };
  return course.verdict === "rate_missing"
    ? t(locale, "calls.availability.courseRateMissing", values)
    : t(locale, "calls.availability.courseTimeShort", values);
}

// 좁은 서랍에서도 가로로 넘치지 않게 칸마다 "이름 값" 한 쌍으로 두고, 모자라면 다음 줄로 넘긴다.
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function nextLabel(locale: Locale, row: TherapistAvailabilityRowDto) {
  const next = row.nextReservationTime ?? t(locale, "calls.availability.nextNone");
  if (!row.available || row.freeMinutes === null) return next;
  return `${next} · ${t(locale, "calls.availability.freeMinutes", { minutes: row.freeMinutes })}`;
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
   * 시간 부족·수당 없음 코스를 "경고 확인 후 배정" 경로로 받을 때(티켓 21). 주면 그 코스에 가능 버튼과
   * 다른 모양·문구의 버튼을 보이고, 주지 않으면(기존 호출) 흐린 글자만 그대로 보인다.
   */
  onOverride?: (choice: AvailabilityCourseOverrideChoice) => void;
  onTimeChange: (time: string) => void;
  onToggle: () => void;
}) {
  const title = t(locale, "calls.availability.title");

  return (
    <section aria-label={title} className="mb-4 rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-end gap-4 p-4">
        <h2 className="pb-3 text-[0.9375rem] font-semibold text-foreground">{title}</h2>
        <label className="grid gap-1.5 text-xs font-semibold text-muted" htmlFor="therapist-availability-time">
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
        <div className="border-t border-border p-4" id="therapist-availability-panel">
          <p className="mb-3 text-xs text-muted">{t(locale, "calls.availability.scheduleNote")}</p>
          {attendanceFilter?.nobodyAttended ? (
            <p className="mb-3 text-xs text-muted">{t(locale, "calls.availability.attendanceNone")}</p>
          ) : null}
          {attendanceFilter && attendanceFilter.hiddenCount > 0 ? (
            <label className="mb-3 flex min-h-11 items-center gap-2 text-sm text-foreground">
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
            <ul className="grid gap-2">
              {rows.map((row) => {
                const priorEndNoteId = `therapist-availability-prior-end-${row.therapistId}`;
                const showPriorEndNote = row.priorServiceEndCheck && row.courses.some((course) => course.verdict === "possible");
                return (
                  <li
                    className="grid gap-2 rounded-md border border-border bg-surface px-3 py-2.5 hover:bg-readonly"
                    data-availability-row={row.therapistId}
                    key={row.therapistId}
                  >
                    <span className="font-semibold text-foreground">{row.therapistName}</span>
                    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                      <Fact label={t(locale, "calls.availability.column.schedule")}>
                        <Schedule locale={locale} row={row} />
                      </Fact>
                      <Fact label={t(locale, "calls.availability.column.attendance")}>
                        <Attendance locale={locale} row={row} />
                      </Fact>
                      <Fact label={t(locale, "calls.availability.column.thisTime")}>
                        <ThisTime locale={locale} row={row} />
                      </Fact>
                      <Fact label={t(locale, "calls.availability.column.next")}>{nextLabel(locale, row)}</Fact>
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      {showPriorEndNote ? (
                        <span className="basis-full" id={priorEndNoteId}>
                          <WarningSummary locale={locale} warnings={[t(locale, "calls.availability.priorServiceEndCheck")]} />
                        </span>
                      ) : null}
                      {row.courses.map((course) => {
                        const verdict = course.verdict;
                        return verdict === "possible" ? (
                          <Button
                            aria-describedby={showPriorEndNote ? priorEndNoteId : undefined}
                            className="h-auto min-h-11 max-w-full whitespace-normal text-left"
                            data-course-id={course.courseId}
                            data-start-time={time}
                            data-therapist-id={row.therapistId}
                            key={course.courseId}
                            onClick={() => onChoose({ startTime: time, therapistId: row.therapistId, courseId: course.courseId })}
                            variant="secondary"
                          >
                            {t(locale, "calls.availability.coursePossible", { code: course.courseCode, minutes: course.durationMinutes })}
                          </Button>
                        ) : onOverride ? (
                          <Button
                            aria-describedby={showPriorEndNote ? priorEndNoteId : undefined}
                            className="h-auto min-h-11 max-w-full whitespace-normal text-left border-warning text-warning hover:bg-warning-soft"
                            data-course-id={course.courseId}
                            data-override-course-id={course.courseId}
                            data-start-time={time}
                            data-therapist-id={row.therapistId}
                            key={course.courseId}
                            onClick={() =>
                              onOverride({
                                startTime: time,
                                therapistId: row.therapistId,
                                courseId: course.courseId,
                                verdict
                              })
                            }
                            variant="secondary"
                          >
                            {impossibleCourseLabel(locale, course)} · {t(locale, "calls.quickBooking.therapist.overrideAssign")}
                          </Button>
                        ) : (
                          <span className="inline-flex min-h-11 items-center text-muted" key={course.courseId}>
                            {impossibleCourseLabel(locale, course)}
                          </span>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
