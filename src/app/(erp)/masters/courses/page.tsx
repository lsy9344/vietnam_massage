import { requireRouteAccess } from "@/lib/authorization";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listEmployees } from "@/modules/masters/employee-service";
import {
  ensureDefaultCoursesAndPolicies,
  listCourses,
  listOpsDailyIncentiveRulesForMonth,
  listOpsMonthlyIncentiveRulesForMonth,
  listTherapistCourseRatesForMonth
} from "@/modules/masters/course-service";
import { CoursePolicyManager } from "@/app/(erp)/masters/courses/course-forms";
import { PageHeader } from "@/components/domain/page-header";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function CourseMasterPage() {
  const account = await requireRouteAccess("/masters/courses");
  const { t } = await getServerTranslator();
  await ensureDefaultCoursesAndPolicies({ actorId: account.id });

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
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("masters.eyebrow")}
        title={t("masters.courses.title")}
        description={t("masters.courses.description")}
        meta={
          <>
            <div>{t("masters.courses.meta.baseMonth", { monthKey })}</div>
            <div>{t("masters.courses.meta.courseCount", { count: courses.length })}</div>
            <div>{t("masters.courses.meta.therapistRateCount", { count: therapistRates.length })}</div>
          </>
        }
      />
      <CoursePolicyManager
        courses={courses}
        dailyRules={dailyRules}
        monthlyRules={monthlyRules}
        monthKey={monthKey}
        therapistRates={therapistRates}
        therapists={therapists}
      />
    </main>
  );
}
