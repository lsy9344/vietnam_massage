import type { ServiceCallOption, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

const controlClassName =
  "min-h-11 border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-brand motion-safe:transition-colors motion-safe:duration-200 motion-reduce:transition-none";

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

function thisTimeLabel(locale: Locale, row: TherapistAvailabilityRowDto) {
  if (row.available) return t(locale, "calls.availability.available");
  return t(locale, "calls.availability.unavailableFrom", { time: row.freeFrom ?? "" });
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
    <section aria-label={title} className="mb-4 rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex flex-wrap items-end gap-3 px-3 py-3">
        <h2 className="pb-2 text-sm font-semibold text-foreground">{title}</h2>
        <label className="grid gap-1 text-xs font-medium text-muted" htmlFor="therapist-availability-time">
          {t(locale, "calls.availability.time")}
          <select
            className={`${controlClassName} min-w-28`}
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
        <button
          aria-controls="therapist-availability-panel"
          aria-expanded={open}
          className={controlClassName}
          id="therapist-availability-expand"
          onClick={onToggle}
          type="button"
        >
          {open ? t(locale, "calls.availability.collapse") : t(locale, "calls.availability.expand")}
        </button>
      </div>
      {open ? (
        <div className="border-t border-border px-3 py-3" id="therapist-availability-panel">
          {pending ? <p className="text-sm text-muted">{t(locale, "calls.availability.loading")}</p> : null}
          {failed ? <p className="text-sm text-danger">{t(locale, "calls.availability.loadError")}</p> : null}
          {!pending && !failed && rows.length === 0 ? (
            <div className="grid gap-1">
              <p className="text-sm text-foreground">{t(locale, "calls.availability.empty")}</p>
              <p className="text-sm text-muted">{t(locale, "calls.availability.emptyNext")}</p>
            </div>
          ) : null}
          {!pending && !failed && rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="text-xs text-muted">
                    <th className="px-2 py-2 font-medium" scope="col">{t(locale, "calls.availability.column.therapist")}</th>
                    <th className="px-2 py-2 font-medium" scope="col">{t(locale, "calls.availability.column.attendance")}</th>
                    <th className="px-2 py-2 font-medium" scope="col">{t(locale, "calls.availability.column.thisTime")}</th>
                    <th className="px-2 py-2 font-medium" scope="col">{t(locale, "calls.availability.column.next")}</th>
                    <th className="px-2 py-2 font-medium" scope="col">{t(locale, "calls.availability.column.courses")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className="align-top" key={row.therapistId}>
                      <th className="border-t border-border px-2 py-2 font-medium text-foreground" scope="row">{row.therapistName}</th>
                      <td className="border-t border-border px-2 py-2">{attendanceLabel(locale, row.attendance)}</td>
                      <td className="border-t border-border px-2 py-2 [font-variant-numeric:tabular-nums]">{thisTimeLabel(locale, row)}</td>
                      <td className="border-t border-border px-2 py-2 [font-variant-numeric:tabular-nums]">{nextLabel(locale, row)}</td>
                      <td className="border-t border-border px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          {row.courses.map((course) =>
                            course.possible ? (
                              <button
                                className={`${controlClassName} max-w-full whitespace-normal text-left`}
                                data-course-id={course.courseId}
                                data-start-time={time}
                                data-therapist-id={row.therapistId}
                                key={course.courseId}
                                onClick={() => onChoose({ startTime: time, therapistId: row.therapistId, courseId: course.courseId })}
                                type="button"
                              >
                                {t(locale, "calls.availability.coursePossible", { code: course.courseCode, minutes: course.durationMinutes })}
                              </button>
                            ) : (
                              <span className="inline-flex min-h-11 items-center text-muted" key={course.courseId}>
                                {t(locale, "calls.availability.courseImpossible", { code: course.courseCode, minutes: course.durationMinutes })}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
