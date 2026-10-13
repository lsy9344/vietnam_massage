import type { ServiceCallOption, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

const controlClassName =
  "min-h-11 border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-brand motion-safe:transition-colors motion-safe:duration-200 motion-reduce:transition-none";
const courseButtonClassName =
  "min-h-11 max-w-full whitespace-normal border border-brand/40 bg-surface px-3 text-left text-sm font-medium text-foreground outline-none hover:border-brand hover:bg-brand/10 focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand motion-safe:transition-colors motion-safe:duration-200 motion-reduce:transition-none";
const headCellClassName = "sticky top-0 z-10 border-b border-border bg-readonly px-3 py-2 font-semibold";

export type AvailabilityCourseChoice = {
  startTime: string;
  therapistId: string;
  courseId: string;
};

function AttendanceBadge({ locale, attendance }: { locale: Locale; attendance: TherapistAvailabilityRowDto["attendance"] }) {
  return attendance === "checked_in" ? (
    <span className="inline-flex items-center border border-status-active/40 bg-status-active/10 px-1.5 py-0.5 text-xs font-semibold text-status-active">
      {t(locale, "calls.availability.attendance.checkedIn")}
    </span>
  ) : (
    <span className="inline-flex items-center border border-border px-1.5 py-0.5 text-xs text-muted">
      {t(locale, "calls.availability.attendance.notEntered")}
    </span>
  );
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
    <section aria-label={title} className="border border-b-0 border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted">{t(locale, "calls.availability.hint")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground" htmlFor="therapist-availability-time">
          {t(locale, "calls.availability.time")}
          <select
            className={`${controlClassName} min-w-28 [font-variant-numeric:tabular-nums]`}
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
          className={`${controlClassName} inline-flex items-center gap-1.5 bg-surface font-medium hover:bg-readonly`}
          id="therapist-availability-expand"
          onClick={onToggle}
          type="button"
        >
          <svg aria-hidden="true" className={`size-4 text-muted ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {open ? t(locale, "calls.availability.collapse") : t(locale, "calls.availability.expand")}
        </button>
      </div>
      {open ? (
        <div className="border-t border-border" id="therapist-availability-panel">
          {pending ? (
            <p className="px-4 py-3 text-sm text-muted" role="status">
              {t(locale, "calls.availability.loading")}
            </p>
          ) : null}
          {failed ? (
            <p className="px-4 py-3 text-sm text-danger" role="alert">
              {t(locale, "calls.availability.loadError")}
            </p>
          ) : null}
          {!pending && !failed && rows.length === 0 ? (
            <div className="grid gap-1 px-4 py-3">
              <p className="text-sm text-foreground">{t(locale, "calls.availability.empty")}</p>
              <p className="text-sm text-muted">{t(locale, "calls.availability.emptyNext")}</p>
            </div>
          ) : null}
          {!pending && !failed && rows.length > 0 ? (
            // 활성 Therapist 전원이 한 목록이라 길어진다. 목록만 안에서 스크롤해 원장이 아래로 밀리지 않게 한다.
            <div className="relative max-h-[26rem] overflow-auto">
              <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
                <thead className="text-xs text-foreground">
                  <tr>
                    <th className={`${headCellClassName} w-[9rem]`} scope="col">{t(locale, "calls.availability.column.therapist")}</th>
                    <th className={`${headCellClassName} w-[6rem]`} scope="col">{t(locale, "calls.availability.column.attendance")}</th>
                    <th className={`${headCellClassName} w-[9rem]`} scope="col">{t(locale, "calls.availability.column.thisTime")}</th>
                    <th className={`${headCellClassName} w-[9rem]`} scope="col">{t(locale, "calls.availability.column.next")}</th>
                    <th className={headCellClassName} scope="col">{t(locale, "calls.availability.column.courses")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className={`align-middle ${row.available ? "" : "bg-readonly/30"}`} key={row.therapistId}>
                      <th className="border-b border-border px-3 py-1.5 font-semibold text-foreground" scope="row">{row.therapistName}</th>
                      <td className="border-b border-border px-3 py-1.5">
                        <AttendanceBadge attendance={row.attendance} locale={locale} />
                      </td>
                      <td
                        className={`border-b border-border px-3 py-1.5 font-semibold [font-variant-numeric:tabular-nums] ${
                          row.available ? "text-status-active" : "text-danger"
                        }`}
                      >
                        {thisTimeLabel(locale, row)}
                      </td>
                      <td className="border-b border-border px-3 py-1.5 text-foreground [font-variant-numeric:tabular-nums]">{nextLabel(locale, row)}</td>
                      <td className="border-b border-border px-3 py-1.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          {row.courses.map((course) =>
                            course.possible ? (
                              <button
                                className={courseButtonClassName}
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
                              <span className="inline-flex min-h-11 items-center px-1 text-xs text-muted" key={course.courseId}>
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
