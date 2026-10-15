"use client";

import { StatusIndicator } from "@/components/ui/status-indicator";
import { EmployeeWorkspace, type ComparisonColumn } from "@/app/(erp)/settlements/employee-workspace";
import { ScheduleCellForm } from "@/app/(erp)/settlements/schedule/schedule-cell-form";
import {
  ALL_SCHEDULE_CELL_STATUSES,
  EMPLOYEE_GROUP_MESSAGE_KEYS,
  SCHEDULE_WEEKDAY_MESSAGE_KEYS,
  scheduleStatusTone
} from "@/app/(erp)/settlements/schedule/schedule-view-model";
import { useLocale, useT } from "@/lib/i18n/client";
import { scheduleStatusLabel } from "@/lib/i18n/codes";
import type { PlannedWorkingDayEmployeeRowDto, PlannedWorkingDayWeekDto } from "@/modules/settlements/schedule-service";

/**
 * 근무표의 작업면(티켓 27): 세 직군을 따로 묶은 직원 비교 표와, 고른 직원의 요일별 편집 패널.
 * 직군마다 별도 EmployeeWorkspace를 두지만 같은 EMPLOYEE_PARAM을 공유해 한 번에 한 직원만 열린다.
 */
export function ScheduleView({ week, initialEmployeeId }: { week: PlannedWorkingDayWeekDto; initialEmployeeId: string | null }) {
  const t = useT();
  const locale = useLocale();

  const columns: ComparisonColumn<PlannedWorkingDayEmployeeRowDto>[] = week.dates.map((date, index) => ({
    key: date,
    header: `${t(SCHEDULE_WEEKDAY_MESSAGE_KEYS[index])} ${date.slice(5)}`,
    cell: (row) => {
      const day = row.days[index];
      return <StatusIndicator label={scheduleStatusLabel(locale, day.status)} tone={scheduleStatusTone(day.status)} />;
    }
  }));

  return (
    <div className="grid gap-6">
      <ul aria-label={t("settlements.schedule.legend.aria")} className="flex flex-wrap gap-3">
        {ALL_SCHEDULE_CELL_STATUSES.map((status) => (
          <li key={status}>
            <StatusIndicator label={scheduleStatusLabel(locale, status)} tone={scheduleStatusTone(status)} />
          </li>
        ))}
      </ul>

      {week.groups
        .filter((group) => group.employees.length > 0)
        .map((group) => (
          <section className="grid gap-3" key={group.employeeGroup}>
            <h2 className="text-base font-semibold text-foreground">{t(EMPLOYEE_GROUP_MESSAGE_KEYS[group.employeeGroup])}</h2>
            <EmployeeWorkspace
              columns={columns}
              employeeHeader={t("settlements.schedule.column.employee")}
              initialEmployeeId={initialEmployeeId}
              minTableWidth="min-w-[56rem]"
              renderPanel={(row) => (
                <div className="grid gap-3">
                  <p className="text-sm text-muted">{t("settlements.schedule.panel.note")}</p>
                  <div>
                    {row.days.map((day, index) => (
                      <ScheduleCellForm
                        date={day.date}
                        employeeId={row.employeeId}
                        employeeName={row.displayName}
                        key={day.date}
                        status={day.status}
                        weekdayLabel={t(SCHEDULE_WEEKDAY_MESSAGE_KEYS[index])}
                      />
                    ))}
                  </div>
                </div>
              )}
              rows={group.employees}
              tableLabel={t(EMPLOYEE_GROUP_MESSAGE_KEYS[group.employeeGroup])}
            />
          </section>
        ))}
    </div>
  );
}
