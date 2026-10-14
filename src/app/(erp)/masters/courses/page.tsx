import { requireRouteAccess } from "@/lib/authorization";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listEmployees } from "@/modules/masters/employee-service";
import {
  listCourses,
  listOpsDailyIncentiveRulesForMonth,
  listOpsMonthlyIncentiveRulesForMonth,
  listTherapistCourseRatesForMonth
} from "@/modules/masters/course-service";
import { CoursePolicyManager } from "@/app/(erp)/masters/courses/course-forms";
import { getServerTranslator } from "@/lib/i18n/server";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

export default async function CourseMasterPage() {
  const account = await requireRouteAccess("/masters/courses");
  const { locale, t } = await getServerTranslator();

  const operatingMonths = await listOperatingMonths();
  const monthKey = operatingMonths.length > 0 ? [...operatingMonths].sort((a, b) => a.monthKey.localeCompare(b.monthKey))[0].monthKey : "2026-06";
  const [courses, employees, therapistRates, dailyRules, monthlyRules] = await Promise.all([
    listCourses({ monthKey }),
    listEmployees(),
    listTherapistCourseRatesForMonth({ monthKey }),
    listOpsDailyIncentiveRulesForMonth({ monthKey }),
    listOpsMonthlyIncentiveRulesForMonth({ monthKey })
  ]);
  const therapists = employees.filter((employee) => employee.employeeGroup === "THERAPIST");

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/masters/courses" title={t("masters.courses.title")} />
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <div>{t("masters.courses.meta.baseMonth", { monthKey })}</div>
        <div>{t("masters.courses.meta.courseCount", { count: courses.length })}</div>
        <div>{t("masters.courses.meta.therapistRateCount", { count: therapistRates.length })}</div>
      </div>
      <CoursePolicyManager
        courses={courses}
        dailyRules={dailyRules}
        monthlyRules={monthlyRules}
        monthKey={monthKey}
        therapistRates={therapistRates}
        therapists={therapists}
      />
    </div>
  );
}
