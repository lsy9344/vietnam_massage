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
import { ActiveCounts } from "@/app/(erp)/masters/master-parts";
import { MASTER_ITEM_PARAM, countActive, readMasterItem } from "@/app/(erp)/masters/master-view-model";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

export default async function CourseMasterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
  const params = await searchParams;
  const counts = countActive(courses);

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/masters/courses" title={t("masters.courses.title")} />
      <div className="mb-6 grid gap-2">
        <ActiveCounts active={counts.active} inactive={counts.inactive} locale={locale} unit={(count) => t("masters.common.count", { count })} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>{t("masters.courses.meta.baseMonth", { monthKey })}</span>
          <span>{t("masters.courses.meta.courseCount", { count: courses.length })}</span>
          <span>{t("masters.courses.meta.therapistRateCount", { count: therapistRates.length })}</span>
        </div>
      </div>
      <CoursePolicyManager
        courses={courses}
        dailyRules={dailyRules}
        initialItem={readMasterItem(params[MASTER_ITEM_PARAM])}
        monthlyRules={monthlyRules}
        monthKey={monthKey}
        therapistRates={therapistRates}
        therapists={therapists}
      />
    </div>
  );
}
