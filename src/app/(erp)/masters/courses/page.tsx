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

export default async function CourseMasterPage() {
  const account = await requireRouteAccess("/masters/courses");
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
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">마스터 설정</p>
          <h1 className="text-2xl font-semibold text-foreground">코스/수당/인센</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            코스와 지급 정책은 코스 ID, 직원 ID, 적용월 이력으로 관리한다. 표시명 변경은 stable ID와 코스 코드를 바꾸지 않는다.
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>기준 적용월: {monthKey}</div>
          <div>코스: {courses.length}개</div>
          <div>마사지사 수당: {therapistRates.length}개</div>
        </div>
      </div>
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
