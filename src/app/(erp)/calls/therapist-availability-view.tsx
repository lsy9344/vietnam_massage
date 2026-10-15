import type { ServiceCallOption, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { WarningSummary } from "@/components/ui/warning-summary";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

const cellClassName = "border-b border-border px-3 py-2";

export type AvailabilityCourseChoice = {
  startTime: string;
  therapistId: string;
  courseId: string;
};

function attendanceLabel(locale: Locale, attendance: TherapistAvailabilityRowDto["attendance"]) {
  return attendance === "checked_in"
    ? t(locale, "calls.availability.attendance.checkedIn")
    : t(locale, "calls.availability.attendance.notEntered");
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

function nextLabel(locale: Locale, row: TherapistAvailabilityRowDto) {
  const next = row.nextReservationTime ?? t(locale, "calls.availability.nextNone");
  if (!row.available || row.freeMinutes === null) return next;
  return `${next} · ${t(locale, "calls.availability.freeMinutes", { minutes: row.freeMinutes })}`;
}

export function TherapistAvailabilityView({
  failed,
  locale,
  open,
  pending,
  rows,
  time,
  timeSlots,
  onChoose,
  onTimeChange,
  onToggle
}: {
  failed: boolean;
  locale: Locale;
  open: boolean;
  pending: boolean;
  rows: TherapistAvailabilityRowDto[];
  time: string;
  timeSlots: ServiceCallOption[];
  onChoose: (choice: AvailabilityCourseChoice) => void;
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
          {pending ? <p className="text-sm text-muted">{t(locale, "calls.availability.loading")}</p> : null}
          {failed ? <p className="text-sm text-danger">{t(locale, "calls.availability.loadError")}</p> : null}
          {!pending && !failed && rows.length === 0 ? (
            <div className="grid gap-1">
              <p className="text-sm text-foreground">{t(locale, "calls.availability.empty")}</p>
              <p className="text-sm text-muted">{t(locale, "calls.availability.emptyNext")}</p>
            </div>
          ) : null}
          {!pending && !failed && rows.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border bg-surface">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-readonly text-xs font-semibold text-muted">
                    <th className={cellClassName} scope="col">{t(locale, "calls.availability.column.therapist")}</th>
                    <th className={cellClassName} scope="col">{t(locale, "calls.availability.column.attendance")}</th>
                    <th className={cellClassName} scope="col">{t(locale, "calls.availability.column.thisTime")}</th>
                    <th className={cellClassName} scope="col">{t(locale, "calls.availability.column.next")}</th>
                    <th className={cellClassName} scope="col">{t(locale, "calls.availability.column.courses")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const priorEndNoteId = `therapist-availability-prior-end-${row.therapistId}`;
                    const showPriorEndNote = row.priorServiceEndCheck && row.courses.some((course) => course.possible);
                    return (
                      <tr className="align-top hover:bg-readonly" key={row.therapistId}>
                        <th className={`${cellClassName} font-semibold text-foreground`} scope="row">{row.therapistName}</th>
                        <td className={cellClassName}>{attendanceLabel(locale, row.attendance)}</td>
                        <td className={cellClassName}>
                          <ThisTime locale={locale} row={row} />
                        </td>
                        <td className={cellClassName}>{nextLabel(locale, row)}</td>
                        <td className={cellClassName}>
                          <div className="flex flex-wrap gap-2">
                            {showPriorEndNote ? (
                              <span className="basis-full" id={priorEndNoteId}>
                                <WarningSummary locale={locale} warnings={[t(locale, "calls.availability.priorServiceEndCheck")]} />
                              </span>
                            ) : null}
                            {row.courses.map((course) =>
                              course.possible ? (
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
                              ) : (
                                <span className="inline-flex min-h-11 items-center text-muted" key={course.courseId}>
                                  {t(locale, "calls.availability.courseImpossible", { code: course.courseCode, minutes: course.durationMinutes })}
                                </span>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
