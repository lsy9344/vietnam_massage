"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { EmployeeDto } from "@/modules/masters/employee-service";
import type {
  CourseDto,
  CoursePolicyDto,
  OpsDailyIncentiveRuleDto,
  OpsMonthlyIncentiveRuleDto,
  TherapistCourseRateDto
} from "@/modules/masters/course-service";
import {
  createCoursePolicyAction,
  createOpsDailyIncentiveRuleAction,
  createOpsMonthlyIncentiveRuleAction,
  createTherapistCourseRateAction,
  deactivateCourseAction,
  endTherapistCourseRateAction,
  updateCoursePolicyAction,
  updateOpsDailyIncentiveRuleAction,
  updateOpsMonthlyIncentiveRuleAction,
  updateTherapistCourseRateAction,
  type CourseActionState
} from "@/app/(erp)/masters/courses/actions";

function formatVnd(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function InlineError({ state, field }: { state: CourseActionState; field?: string }) {
  if (!state || state.ok) return null;

  if (field) {
    const messages = state.fieldErrors?.[field];
    if (!messages?.length) return null;
    return <span className="text-xs text-danger">{messages.join(" ")}</span>;
  }

  return state.formError ? <span className="text-xs text-danger">{state.formError}</span> : null;
}

function PolicyInputs({ course, policy, monthKey }: { course: CourseDto; policy: CoursePolicyDto | null; monthKey: string }) {
  return (
    <>
      <input name="courseId" type="hidden" value={course.id} />
      {policy ? <input name="policyId" type="hidden" value={policy.id} /> : null}
      <label className="grid gap-1 text-xs text-muted">
        코스명
        <input className="h-8 min-w-52 border border-border bg-background px-2 text-sm text-foreground" defaultValue={policy?.name ?? ""} name="name" required />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        시간
        <input className="h-8 w-20 border border-border bg-background px-2 text-sm text-foreground" defaultValue={policy?.durationMinutes ?? 60} min={1} name="durationMinutes" type="number" />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        기본판매가
        <input className="h-8 w-28 border border-border bg-background px-2 text-sm text-foreground" defaultValue={policy?.basePrice ?? 0} min={0} name="basePrice" type="number" />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        콜인정
        <input className="h-8 w-20 border border-border bg-background px-2 text-sm text-foreground" defaultValue={policy?.opsCallCredit ?? 1} min={0} name="opsCallCredit" type="number" />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        귀케어 풀/콜
        <input className="h-8 w-28 border border-border bg-background px-2 text-sm text-foreground" defaultValue={policy?.earcarePoolAmount ?? 0} min={0} name="earcarePoolAmount" type="number" />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        TV 표시명
        <input className="h-8 w-32 border border-border bg-background px-2 text-sm text-foreground" defaultValue={policy?.tvDisplayName ?? ""} name="tvDisplayName" required />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        시작월
        <input className="h-8 w-28 border border-border bg-background px-2 text-sm text-foreground" defaultValue={policy?.effectiveFromMonth ?? monthKey} name="effectiveFromMonth" pattern="\d{4}-\d{2}" required />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        종료월
        <input className="h-8 w-28 border border-border bg-background px-2 text-sm text-foreground" defaultValue={policy?.effectiveToMonth ?? ""} name="effectiveToMonth" pattern="\d{4}-\d{2}" />
      </label>
      <label className="flex h-12 items-end gap-2 text-xs text-muted">
        <input className="h-4 w-4 accent-brand" defaultChecked={policy?.requiresSecondTherapist ?? course.code === "D"} name="requiresSecondTherapist" type="checkbox" value="true" />
        마사지사2 필요
      </label>
    </>
  );
}

function CoursePolicyRow({ course, monthKey }: { course: CourseDto; monthKey: string }) {
  const [updateState, updateAction, updatePending] = useActionState<CourseActionState, FormData>(updateCoursePolicyAction, null);
  const [createState, createAction, createPending] = useActionState<CourseActionState, FormData>(createCoursePolicyAction, null);
  const [deactivateState, deactivateAction, deactivatePending] = useActionState<CourseActionState, FormData>(deactivateCourseAction, null);
  const policy = course.currentPolicy;

  return (
    <tr className={course.isActive ? "align-top" : "bg-readonly align-top"}>
      <td className="border-b border-border px-3 py-2 text-sm font-semibold text-foreground">
        {course.code}
        <div className="mt-1 text-xs font-normal text-muted">Course.id {course.id}</div>
      </td>
      <td className="border-b border-border px-3 py-2">
        <form action={policy ? updateAction : createAction} className="grid min-w-[1160px] grid-cols-[220px_80px_112px_80px_112px_128px_112px_112px_130px_auto] gap-2">
          <PolicyInputs course={course} monthKey={monthKey} policy={policy} />
          <div className="flex items-end">
            <Button className="h-8 px-2 text-xs" disabled={updatePending || createPending} type="submit" variant="secondary">
              현재 정책 저장
            </Button>
          </div>
          <InlineError state={policy ? updateState : createState} />
        </form>
        <form action={createAction} className="mt-2 flex min-w-[760px] items-end gap-2">
          <PolicyInputs course={course} monthKey={monthKey} policy={policy} />
          <Button className="h-8 px-2 text-xs" disabled={createPending} type="submit">
            새 정책 이력 저장
          </Button>
        </form>
      </td>
      <td className="border-b border-border px-3 py-2 text-xs text-muted">
        <div>{policy ? `${formatVnd(policy.basePrice)} VND` : "정책 없음"}</div>
        <div>{policy?.requiresSecondTherapist ? "마사지사2 필요: Y" : "마사지사2 필요: N"}</div>
        <div>{course.isActive ? "활성" : "비활성"}</div>
      </td>
      <td className="border-b border-border px-3 py-2">
        <form action={deactivateAction} className="grid gap-1">
          <input name="courseId" type="hidden" value={course.id} />
          <Button className="h-8 px-2 text-xs" disabled={deactivatePending || !course.isActive} type="submit" variant="ghost">
            비활성 처리
          </Button>
          <InlineError state={deactivateState} />
        </form>
      </td>
    </tr>
  );
}

function CourseSection({ courses, monthKey }: { courses: CourseDto[]; monthKey: string }) {
  return (
    <section className="border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">기본 코스 마스터</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1520px] border-collapse text-left text-sm">
          <thead className="bg-readonly text-xs font-semibold text-muted">
            <tr>
              <th className="w-40 border-b border-border px-3 py-2">코드 / stable ID</th>
              <th className="border-b border-border px-3 py-2">코스 정책</th>
              <th className="w-44 border-b border-border px-3 py-2">현재 요약</th>
              <th className="w-32 border-b border-border px-3 py-2">작업</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <CoursePolicyRow course={course} key={course.id} monthKey={monthKey} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RateCell({
  course,
  monthKey,
  rate,
  therapist
}: {
  course: CourseDto;
  monthKey: string;
  rate: TherapistCourseRateDto | undefined;
  therapist: EmployeeDto;
}) {
  const [createState, createAction, createPending] = useActionState<CourseActionState, FormData>(createTherapistCourseRateAction, null);
  const [state, action, pending] = useActionState<CourseActionState, FormData>(updateTherapistCourseRateAction, null);
  const [endState, endAction, endPending] = useActionState<CourseActionState, FormData>(endTherapistCourseRateAction, null);

  if (!rate) {
    return (
      <form action={createAction} className="grid gap-1">
        <input name="therapistId" type="hidden" value={therapist.id} />
        <input name="courseId" type="hidden" value={course.id} />
        <input name="effectiveFromMonth" type="hidden" value={monthKey} />
        <input name="effectiveToMonth" type="hidden" value="" />
        <div className="flex items-center gap-1">
          <input className="h-8 w-24 border border-border bg-background px-2 text-right text-sm text-foreground" defaultValue={0} min={0} name="amount" type="number" />
          <Button className="h-8 px-2 text-xs" disabled={createPending} type="submit" variant="secondary">
            생성
          </Button>
        </div>
        <InlineError state={createState} />
      </form>
    );
  }

  return (
    <div className="grid gap-1">
      <form action={action} className="flex items-center gap-1">
        <input name="rateId" type="hidden" value={rate.id} />
        <input name="effectiveFromMonth" type="hidden" value={rate.effectiveFromMonth} />
        <input name="effectiveToMonth" type="hidden" value={rate.effectiveToMonth ?? ""} />
        <input className="h-8 w-24 border border-border bg-background px-2 text-right text-sm text-foreground" defaultValue={rate.amount} min={0} name="amount" type="number" />
        <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="secondary">
          저장
        </Button>
      </form>
      <form action={endAction} className="flex items-center gap-1">
        <input name="rateId" type="hidden" value={rate.id} />
        <input className="h-7 w-24 border border-border bg-background px-2 text-xs text-foreground" defaultValue={rate.effectiveToMonth ?? monthKey} name="effectiveToMonth" pattern="\d{4}-\d{2}" />
        <Button className="h-7 px-2 text-xs" disabled={endPending} type="submit" variant="ghost">
          정책 종료
        </Button>
      </form>
      <InlineError state={state} />
      <InlineError state={endState} />
    </div>
  );
}

function TherapistRateSection({
  courses,
  monthKey,
  therapistRates,
  therapists
}: {
  courses: CourseDto[];
  monthKey: string;
  therapistRates: TherapistCourseRateDto[];
  therapists: EmployeeDto[];
}) {
  const rates = new Map(therapistRates.map((rate) => [`${rate.therapistId}:${rate.courseId}`, rate]));

  return (
    <section className="border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">마사지사 개인별 코스 수당</h2>
        <p className="mt-1 text-xs text-muted">0원 수당은 누락값이 아니라 원본 이관 초기값이다.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-readonly text-xs font-semibold text-muted">
            <tr>
              <th className="w-48 border-b border-border px-3 py-2">마사지사</th>
              {courses.map((course) => (
                <th className="w-40 border-b border-border px-3 py-2" key={course.id}>
                  {course.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {therapists.map((therapist) => (
              <tr className="align-top" key={therapist.id}>
                <td className="border-b border-border px-3 py-2">
                  <div className="font-medium text-foreground">{therapist.displayName}</div>
                  <div className="text-xs text-muted">{therapist.staffCode}</div>
                </td>
                {courses.map((course) => (
                  <td className="border-b border-border px-3 py-2" key={course.id}>
                    <RateCell course={course} monthKey={monthKey} rate={rates.get(`${therapist.id}:${course.id}`)} therapist={therapist} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DailyRuleForm({ rule, monthKey }: { rule?: OpsDailyIncentiveRuleDto; monthKey: string }) {
  const [state, action, pending] = useActionState<CourseActionState, FormData>(rule ? updateOpsDailyIncentiveRuleAction : createOpsDailyIncentiveRuleAction, null);

  return (
    <form action={action} className="grid grid-cols-[110px_130px_110px_110px_auto] gap-2">
      {rule ? <input name="ruleId" type="hidden" value={rule.id} /> : null}
      <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={rule?.thresholdCallCount ?? 30} min={1} name="thresholdCallCount" type="number" />
      <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={rule?.personalAmount ?? 0} min={0} name="personalAmount" type="number" />
      <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={rule?.effectiveFromMonth ?? monthKey} name="effectiveFromMonth" pattern="\d{4}-\d{2}" />
      <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={rule?.effectiveToMonth ?? ""} name="effectiveToMonth" pattern="\d{4}-\d{2}" />
      <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant={rule ? "secondary" : "default"}>
        {rule ? "일일 저장" : "일일 추가"}
      </Button>
      <InlineError state={state} />
    </form>
  );
}

function MonthlyRuleForm({ rule, monthKey }: { rule?: OpsMonthlyIncentiveRuleDto; monthKey: string }) {
  const [state, action, pending] = useActionState<CourseActionState, FormData>(rule ? updateOpsMonthlyIncentiveRuleAction : createOpsMonthlyIncentiveRuleAction, null);

  return (
    <form action={action} className="grid grid-cols-[90px_120px_80px_80px_80px_110px_110px_auto] gap-2">
      {rule ? <input name="ruleId" type="hidden" value={rule.id} /> : null}
      <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={rule?.thresholdCallCount ?? 1000} min={1} name="thresholdCallCount" type="number" />
      <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={rule?.totalAmount ?? 0} min={0} name="totalAmount" type="number" />
      <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={rule?.leadShare ?? 0.3} max={1} min={0} name="leadShare" step="0.01" type="number" />
      <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={rule?.counterTeamShare ?? 0.35} max={1} min={0} name="counterTeamShare" step="0.01" type="number" />
      <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={rule?.waiterTeamShare ?? 0.35} max={1} min={0} name="waiterTeamShare" step="0.01" type="number" />
      <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={rule?.effectiveFromMonth ?? monthKey} name="effectiveFromMonth" pattern="\d{4}-\d{2}" />
      <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={rule?.effectiveToMonth ?? ""} name="effectiveToMonth" pattern="\d{4}-\d{2}" />
      <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant={rule ? "secondary" : "default"}>
        {rule ? "월 저장" : "월 추가"}
      </Button>
      <InlineError state={state} />
    </form>
  );
}

function IncentiveSection({
  dailyRules,
  monthlyRules,
  monthKey
}: {
  dailyRules: OpsDailyIncentiveRuleDto[];
  monthlyRules: OpsMonthlyIncentiveRuleDto[];
  monthKey: string;
}) {
  return (
    <section className="grid gap-4 border border-border bg-surface px-4 py-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">운영팀 일일 인센 정책</h2>
        <div className="mt-3 grid gap-2">
          <div className="grid grid-cols-[110px_130px_110px_110px_auto] gap-2 text-xs font-semibold text-muted">
            <span>일 총콜</span>
            <span>개인 지급액</span>
            <span>시작월</span>
            <span>종료월</span>
            <span>작업</span>
          </div>
          {dailyRules.map((rule) => (
            <DailyRuleForm key={rule.id} monthKey={monthKey} rule={rule} />
          ))}
          <DailyRuleForm monthKey={monthKey} />
        </div>
      </div>
      <div className="border-t border-border pt-4">
        <h2 className="text-base font-semibold text-foreground">운영팀 월 인센 정책</h2>
        <div className="mt-3 grid gap-2">
          <div className="grid grid-cols-[90px_120px_80px_80px_80px_110px_110px_auto] gap-2 text-xs font-semibold text-muted">
            <span>월 총콜</span>
            <span>전체 월인센</span>
            <span>팀장</span>
            <span>카운터팀</span>
            <span>웨이터팀</span>
            <span>시작월</span>
            <span>종료월</span>
            <span>작업</span>
          </div>
          {monthlyRules.map((rule) => (
            <MonthlyRuleForm key={rule.id} monthKey={monthKey} rule={rule} />
          ))}
          <MonthlyRuleForm monthKey={monthKey} />
        </div>
      </div>
    </section>
  );
}

export function CoursePolicyManager({
  courses,
  dailyRules,
  monthlyRules,
  monthKey,
  therapistRates,
  therapists
}: {
  courses: CourseDto[];
  dailyRules: OpsDailyIncentiveRuleDto[];
  monthlyRules: OpsMonthlyIncentiveRuleDto[];
  monthKey: string;
  therapistRates: TherapistCourseRateDto[];
  therapists: EmployeeDto[];
}) {
  return (
    <div className="grid gap-5">
      <CourseSection courses={courses} monthKey={monthKey} />
      <TherapistRateSection courses={courses} monthKey={monthKey} therapistRates={therapistRates} therapists={therapists} />
      <IncentiveSection dailyRules={dailyRules} monthKey={monthKey} monthlyRules={monthlyRules} />
    </div>
  );
}
