"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { ModalPanel, SidePanel } from "@/components/ui/panel";
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
import { courseItemKey, parseCourseItem, type CourseScreenItem } from "@/app/(erp)/masters/courses/course-item";
import { SaveRow, TextField } from "@/app/(erp)/masters/master-fields";
import { ActiveStatus, Cell, HeadCell, ImpactNotice, MasterSectionHeading, MasterTable, PanelSection, masterCellClassName, masterDateTime } from "@/app/(erp)/masters/master-parts";
import { MasterSplit, SelectableRow, useMasterSelection } from "@/app/(erp)/masters/master-workspace";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

const monthPattern = "\\d{4}-\\d{2}";

function periodLabel(from: string, to: string | null, openEnded: string) {
  return `${from} ~ ${to ?? openEnded}`;
}

// 정책 저장 실패는 필드별 이유(예: "적용 종료월은 시작월보다 빠를 수 없습니다.")를 칸 아래에 보여야
// 운영자가 무엇을 고쳐야 하는지 알 수 있다. 폼 전체 오류만 보여 주면 원인을 알 수 없다.
function PolicyInputs({ course, policy, monthKey, state }: { course: CourseDto; policy: CoursePolicyDto | null; monthKey: string; state: CourseActionState }) {
  const t = useT();
  return (
    <>
      <input name="courseId" type="hidden" value={course.id} />
      <div className="grid gap-4 min-[1200px]:grid-cols-2">
        <TextField defaultValue={policy?.name ?? ""} label={t("masters.courses.field.courseName")} name="name" required state={state} />
        <TextField defaultValue={policy?.tvDisplayName ?? ""} label={t("masters.courses.field.tvDisplayName")} name="tvDisplayName" required state={state} />
        <TextField defaultValue={policy?.durationMinutes ?? 60} label={t("masters.courses.field.duration")} min={1} name="durationMinutes" state={state} type="number" />
        <TextField defaultValue={policy?.basePrice ?? 0} label={t("masters.courses.field.basePrice")} min={0} name="basePrice" state={state} type="number" />
        <TextField defaultValue={policy?.opsCallCredit ?? 1} label={t("masters.courses.field.opsCallCredit")} min={0} name="opsCallCredit" state={state} type="number" />
        <TextField defaultValue={policy?.earcarePoolAmount ?? 0} label={t("masters.courses.field.earcarePoolPerCall")} min={0} name="earcarePoolAmount" state={state} type="number" />
        <TextField defaultValue={policy?.effectiveFromMonth ?? monthKey} label={t("masters.courses.field.fromMonth")} name="effectiveFromMonth" pattern={monthPattern} placeholder="YYYY-MM" required state={state} />
        <TextField defaultValue={policy?.effectiveToMonth ?? ""} hint={t("masters.courses.toMonthHint")} label={t("masters.courses.field.toMonth")} name="effectiveToMonth" pattern={monthPattern} placeholder="YYYY-MM" state={state} />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground">
        <input className="h-5 w-5 accent-brand" defaultChecked={policy?.requiresSecondTherapist ?? course.code === "D"} name="requiresSecondTherapist" type="checkbox" value="true" />
        {t("masters.courses.secondTherapistRequired")}
      </label>
    </>
  );
}

function CurrentPolicyForm({ course, monthKey }: { course: CourseDto; monthKey: string }) {
  const t = useT();
  const policy = course.currentPolicy;
  const [state, formAction, pending] = useActionState<CourseActionState, FormData>(policy ? updateCoursePolicyAction : createCoursePolicyAction, null);

  return (
    <form action={formAction} className="grid gap-4">
      {policy ? <input name="policyId" type="hidden" value={policy.id} /> : null}
      <PolicyInputs course={course} monthKey={monthKey} policy={policy} state={state} />
      <SaveRow label={t("masters.courses.saveCurrentPolicy")} pending={pending} state={state} />
    </form>
  );
}

function NewPolicyHistoryForm({ course, monthKey }: { course: CourseDto; monthKey: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<CourseActionState, FormData>(createCoursePolicyAction, null);

  return (
    <form action={formAction} className="grid gap-4">
      <PolicyInputs course={course} monthKey={monthKey} policy={course.currentPolicy} state={state} />
      <SaveRow label={t("masters.courses.saveNewPolicyHistory")} pending={pending} state={state} />
    </form>
  );
}

function CourseDeactivateForm({ course }: { course: CourseDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<CourseActionState, FormData>(deactivateCourseAction, null);

  if (!course.isActive) {
    return <p className="text-sm text-muted">{t("masters.common.alreadyInactive")}</p>;
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input name="courseId" type="hidden" value={course.id} />
      <p className="text-sm text-muted">{t("masters.courses.deactivateNote")}</p>
      <SaveRow label={t("masters.common.deactivate")} pending={pending} state={state} />
    </form>
  );
}

function CoursePanel({ course, monthKey, onClose }: { course: CourseDto; monthKey: string; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const policy = course.currentPolicy;

  return (
    <SidePanel onClose={onClose} title={policy ? `${course.code} · ${policy.name}` : course.code}>
      <div className="grid gap-6" key={course.id}>
        <ActiveStatus inactiveNote={t("masters.courses.inactiveNote")} isActive={course.isActive} locale={locale} />
        <ImpactNotice
          items={[
            t("masters.courses.impact.currentPolicy"),
            t("masters.courses.impact.newHistory"),
            t("masters.courses.impact.closedMonths"),
            t("masters.courses.impact.inactive")
          ]}
          locale={locale}
        />
        <PanelSection title={t("masters.courses.currentPolicyTitle")}>
          {policy ? null : <p className="text-sm text-muted">{t("masters.courses.noPolicy")}</p>}
          <CurrentPolicyForm course={course} monthKey={monthKey} />
        </PanelSection>
        <PanelSection title={t("masters.courses.newPolicyHistoryTitle")}>
          <NewPolicyHistoryForm course={course} monthKey={monthKey} />
        </PanelSection>
        <PanelSection title={t("masters.common.details")}>
          <dl>
            <DetailRow label="Course.id" value={course.id} />
            <DetailRow label={t("masters.common.createdAt")} value={masterDateTime(locale, course.createdAt)} />
            <DetailRow label={t("masters.common.updatedAt")} value={masterDateTime(locale, course.updatedAt)} />
          </dl>
        </PanelSection>
        <PanelSection title={t("masters.common.deactivateTitle")}>
          <CourseDeactivateForm course={course} />
        </PanelSection>
      </div>
    </SidePanel>
  );
}

function RateForms({ course, monthKey, rate, therapist }: { course: CourseDto; monthKey: string; rate: TherapistCourseRateDto | undefined; therapist: EmployeeDto }) {
  const t = useT();
  const [createState, createAction, createPending] = useActionState<CourseActionState, FormData>(createTherapistCourseRateAction, null);
  const [state, action, pending] = useActionState<CourseActionState, FormData>(updateTherapistCourseRateAction, null);
  const [endState, endAction, endPending] = useActionState<CourseActionState, FormData>(endTherapistCourseRateAction, null);

  if (!rate) {
    return (
      <form action={createAction} className="grid gap-3">
        <input name="therapistId" type="hidden" value={therapist.id} />
        <input name="courseId" type="hidden" value={course.id} />
        <input name="effectiveFromMonth" type="hidden" value={monthKey} />
        <input name="effectiveToMonth" type="hidden" value="" />
        <p className="text-sm text-muted">{t("masters.courses.rateCreateNote", { monthKey })}</p>
        <TextField defaultValue={0} label={t("masters.courses.rateAmount")} min={0} name="amount" state={createState} type="number" />
        <SaveRow label={t("masters.courses.create")} pending={createPending} state={createState} />
      </form>
    );
  }

  return (
    <div className="grid gap-6">
      <form action={action} className="grid gap-3">
        <input name="rateId" type="hidden" value={rate.id} />
        <input name="effectiveFromMonth" type="hidden" value={rate.effectiveFromMonth} />
        <input name="effectiveToMonth" type="hidden" value={rate.effectiveToMonth ?? ""} />
        <TextField defaultValue={rate.amount} label={t("masters.courses.rateAmount")} min={0} name="amount" state={state} type="number" />
        <SaveRow label={t("masters.common.save")} pending={pending} state={state} />
      </form>
      <form action={endAction} className="grid gap-3">
        <input name="rateId" type="hidden" value={rate.id} />
        <TextField
          defaultValue={rate.effectiveToMonth ?? monthKey}
          label={t("masters.courses.field.toMonth")}
          name="effectiveToMonth"
          pattern={monthPattern}
          placeholder="YYYY-MM"
          state={endState}
        />
        <SaveRow label={t("masters.courses.endPolicy")} pending={endPending} state={endState} />
      </form>
    </div>
  );
}

function RatePanel({
  course,
  monthKey,
  rate,
  therapist,
  onClose
}: {
  course: CourseDto;
  monthKey: string;
  rate: TherapistCourseRateDto | undefined;
  therapist: EmployeeDto;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <SidePanel onClose={onClose} title={`${therapist.displayName} · ${course.code}`}>
      <div className="grid gap-6" key={`${therapist.id}:${course.id}`}>
        <ImpactNotice items={[t("masters.courses.impact.rateZeroVsMissing"), t("masters.courses.impact.closedMonths")]} locale={locale} />
        {rate ? (
          <dl>
            <DetailRow label={t("masters.courses.rateAmount")} value={formatNumber(locale, rate.amount)} />
            <DetailRow label={t("masters.courses.column.period")} value={periodLabel(rate.effectiveFromMonth, rate.effectiveToMonth, t("masters.courses.openEnded"))} />
          </dl>
        ) : (
          <p className="text-sm font-semibold text-warning">
            <span aria-hidden="true">{"▲︎ "}</span>
            {t("masters.courses.rateMissing")}
          </p>
        )}
        <RateForms course={course} monthKey={monthKey} rate={rate} therapist={therapist} />
      </div>
    </SidePanel>
  );
}

function DailyRuleFields({ rule, monthKey, state }: { rule?: OpsDailyIncentiveRuleDto; monthKey: string; state: CourseActionState }) {
  const t = useT();
  return (
    <div className="grid gap-4 min-[1200px]:grid-cols-2">
      <TextField defaultValue={rule?.thresholdCallCount ?? 30} label={t("masters.courses.column.dailyTotalCalls")} min={1} name="thresholdCallCount" state={state} type="number" />
      <TextField defaultValue={rule?.personalAmount ?? 0} label={t("masters.courses.column.personalAmount")} min={0} name="personalAmount" state={state} type="number" />
      <TextField defaultValue={rule?.effectiveFromMonth ?? monthKey} label={t("masters.courses.field.fromMonth")} name="effectiveFromMonth" pattern={monthPattern} placeholder="YYYY-MM" state={state} />
      <TextField defaultValue={rule?.effectiveToMonth ?? ""} hint={t("masters.courses.toMonthHint")} label={t("masters.courses.field.toMonth")} name="effectiveToMonth" pattern={monthPattern} placeholder="YYYY-MM" state={state} />
    </div>
  );
}

function MonthlyRuleFields({ rule, monthKey, state }: { rule?: OpsMonthlyIncentiveRuleDto; monthKey: string; state: CourseActionState }) {
  const t = useT();
  return (
    <div className="grid gap-4 min-[1200px]:grid-cols-2">
      <TextField defaultValue={rule?.thresholdCallCount ?? 1000} label={t("masters.courses.column.monthlyTotalCalls")} min={1} name="thresholdCallCount" state={state} type="number" />
      <TextField defaultValue={rule?.totalAmount ?? 0} label={t("masters.courses.column.totalMonthlyIncentive")} min={0} name="totalAmount" state={state} type="number" />
      {/* 분배율 합계 오류는 팀장 칸(leadShare)의 필드 메시지로 온다. */}
      <TextField defaultValue={rule?.leadShare ?? 0.3} label={t("masters.courses.column.lead")} max={1} min={0} name="leadShare" state={state} step="0.01" type="number" />
      <TextField defaultValue={rule?.counterTeamShare ?? 0.35} label={t("masters.courses.column.counterTeam")} max={1} min={0} name="counterTeamShare" state={state} step="0.01" type="number" />
      <TextField defaultValue={rule?.waiterTeamShare ?? 0.35} label={t("masters.courses.column.waiterTeam")} max={1} min={0} name="waiterTeamShare" state={state} step="0.01" type="number" />
      <TextField defaultValue={rule?.effectiveFromMonth ?? monthKey} label={t("masters.courses.field.fromMonth")} name="effectiveFromMonth" pattern={monthPattern} placeholder="YYYY-MM" state={state} />
      <TextField defaultValue={rule?.effectiveToMonth ?? ""} hint={t("masters.courses.toMonthHint")} label={t("masters.courses.field.toMonth")} name="effectiveToMonth" pattern={monthPattern} placeholder="YYYY-MM" state={state} />
    </div>
  );
}

function DailyRulePanel({ rule, monthKey, onClose }: { rule: OpsDailyIncentiveRuleDto; monthKey: string; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<CourseActionState, FormData>(updateOpsDailyIncentiveRuleAction, null);
  return (
    <SidePanel onClose={onClose} title={t("masters.courses.dailyIncentiveTitle")}>
      <div className="grid gap-6" key={rule.id}>
        <ImpactNotice items={[t("masters.courses.impact.dailyRule"), t("masters.courses.impact.closedMonths")]} locale={locale} />
        <form action={formAction} className="grid gap-4">
          <input name="ruleId" type="hidden" value={rule.id} />
          <DailyRuleFields monthKey={monthKey} rule={rule} state={state} />
          <SaveRow label={t("masters.courses.dailySave")} pending={pending} state={state} />
        </form>
      </div>
    </SidePanel>
  );
}

function MonthlyRulePanel({ rule, monthKey, onClose }: { rule: OpsMonthlyIncentiveRuleDto; monthKey: string; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<CourseActionState, FormData>(updateOpsMonthlyIncentiveRuleAction, null);
  return (
    <SidePanel onClose={onClose} title={t("masters.courses.monthlyIncentiveTitle")}>
      <div className="grid gap-6" key={rule.id}>
        <ImpactNotice items={[t("masters.courses.impact.monthlyRule"), t("masters.courses.impact.closedMonths")]} locale={locale} />
        <form action={formAction} className="grid gap-4">
          <input name="ruleId" type="hidden" value={rule.id} />
          <MonthlyRuleFields monthKey={monthKey} rule={rule} state={state} />
          <SaveRow label={t("masters.courses.monthlySave")} pending={pending} state={state} />
        </form>
      </div>
    </SidePanel>
  );
}

function CreateRulePanel({ kind, monthKey, onCreated }: { kind: "daily" | "monthly"; monthKey: string; onCreated: (item: CourseScreenItem) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const label = kind === "daily" ? t("masters.courses.dailyAdd") : t("masters.courses.monthlyAdd");
  const [state, formAction, pending] = useActionState<CourseActionState, FormData>(async (previous, formData) => {
    const result = await (kind === "daily" ? createOpsDailyIncentiveRuleAction : createOpsMonthlyIncentiveRuleAction)(previous, formData);
    if (result?.ok) {
      setOpen(false);
      onCreated({ kind, ruleId: result.data.id });
    }
    return result;
  }, null);

  return (
    <ModalPanel
      description={kind === "daily" ? t("masters.courses.impact.dailyRule") : t("masters.courses.impact.monthlyRule")}
      onOpenChange={setOpen}
      open={open}
      title={label}
      trigger={<Button variant="secondary">{label}</Button>}
    >
      <form action={formAction} className="grid gap-4">
        {kind === "daily" ? <DailyRuleFields monthKey={monthKey} state={state} /> : <MonthlyRuleFields monthKey={monthKey} state={state} />}
        <SaveRow label={label} pending={pending} primary state={state} />
      </form>
    </ModalPanel>
  );
}

function RateMatrix({
  courses,
  rates,
  therapists,
  selected,
  onSelect
}: {
  courses: CourseDto[];
  rates: Map<string, TherapistCourseRateDto>;
  therapists: EmployeeDto[];
  selected: CourseScreenItem | null;
  onSelect: (item: CourseScreenItem, viaKeyboard: boolean) => void;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <MasterTable
      head={
        <>
          <HeadCell>{t("masters.courses.column.therapist")}</HeadCell>
          {courses.map((course) => (
            <HeadCell key={course.id} numeric>
              {course.code}
            </HeadCell>
          ))}
        </>
      }
      label={t("masters.courses.therapistRateTitle")}
      minWidth="min-w-[40rem]"
    >
      {therapists.map((therapist) => (
        <tr key={therapist.id}>
          <th className={masterCellClassName} scope="row">
            <span className="grid">
              <span className="font-semibold text-foreground">{therapist.displayName}</span>
              <span className="text-xs font-normal text-muted">
                {therapist.staffCode}
                {therapist.isActive ? "" : ` · ${t("masters.common.inactive")}`}
              </span>
            </span>
          </th>
          {courses.map((course) => {
            const item: CourseScreenItem = { kind: "rate", therapistId: therapist.id, courseId: course.id };
            const isSelected = selected?.kind === "rate" && selected.therapistId === therapist.id && selected.courseId === course.id;
            // 0원 수당은 등록된 값이라 0으로 보이고, 수당이 없으면(미등록) 그 코스의 콜은 계산 경고로 남는다.
            const rate = rates.get(`${therapist.id}:${course.id}`);
            const value = rate ? formatNumber(locale, rate.amount) : t("masters.courses.rateMissing");
            return (
              <td className={cn(masterCellClassName, "p-1")} key={course.id}>
                <button
                  aria-label={t("masters.courses.rateCellAria", { therapist: therapist.displayName, course: course.code, value })}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-end rounded-sm px-2 text-right transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary",
                    isSelected && "bg-readonly [box-shadow:inset_3px_0_0_var(--brand)]"
                  )}
                  onClick={(event) => onSelect(item, event.detail === 0)}
                  type="button"
                >
                  {rate ? (
                    <span className="text-foreground">{value}</span>
                  ) : (
                    <span className="text-xs font-semibold text-warning">
                      <span aria-hidden="true">{"▲︎ "}</span>
                      {value}
                    </span>
                  )}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </MasterTable>
  );
}

/**
 * 코스·수당·인센: 코스 목록, 마사지사 × 코스 수당 표, 운영팀 일·월 인센 규칙. 고른 코스·수당 칸·규칙의 패널에서
 * 변경 영향을 먼저 보고 고친다. 코스 추가와 적용월 선택은 데이터 계약에 없다(기준 적용월은 페이지가 정한다).
 */
export function CoursePolicyManager({
  courses,
  dailyRules,
  monthlyRules,
  monthKey,
  therapistRates,
  therapists,
  initialItem
}: {
  courses: CourseDto[];
  dailyRules: OpsDailyIncentiveRuleDto[];
  monthlyRules: OpsMonthlyIncentiveRuleDto[];
  monthKey: string;
  therapistRates: TherapistCourseRateDto[];
  therapists: EmployeeDto[];
  initialItem: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  const { selected: selectedKey, select, panelRef } = useMasterSelection(initialItem);
  const selected = parseCourseItem(selectedKey);
  const rates = new Map(therapistRates.map((rate) => [`${rate.therapistId}:${rate.courseId}`, rate]));
  const openEnded = t("masters.courses.openEnded");
  const close = () => select(null);
  const choose = (item: CourseScreenItem, viaKeyboard = false) => select(courseItemKey(item), viaKeyboard);

  let panel = null;
  if (selected?.kind === "course") {
    const course = courses.find((candidate) => candidate.id === selected.courseId);
    if (course) panel = <CoursePanel course={course} monthKey={monthKey} onClose={close} />;
  } else if (selected?.kind === "rate") {
    const course = courses.find((candidate) => candidate.id === selected.courseId);
    const therapist = therapists.find((candidate) => candidate.id === selected.therapistId);
    if (course && therapist) {
      panel = <RatePanel course={course} monthKey={monthKey} onClose={close} rate={rates.get(`${therapist.id}:${course.id}`)} therapist={therapist} />;
    }
  } else if (selected?.kind === "daily") {
    const rule = dailyRules.find((candidate) => candidate.id === selected.ruleId);
    if (rule) panel = <DailyRulePanel monthKey={monthKey} onClose={close} rule={rule} />;
  } else if (selected?.kind === "monthly") {
    const rule = monthlyRules.find((candidate) => candidate.id === selected.ruleId);
    if (rule) panel = <MonthlyRulePanel monthKey={monthKey} onClose={close} rule={rule} />;
  }

  return (
    <MasterSplit hint={t("masters.common.panelHint")} panel={panel} panelRef={panelRef}>
      <section aria-labelledby="course-list-title" className="grid gap-3">
        <MasterSectionHeading count={t("masters.common.count", { count: courses.length })} id="course-list-title" title={t("masters.courses.baseCourseMaster")} />
        <MasterTable
          head={
            <>
              <HeadCell>{t("masters.courses.column.code")}</HeadCell>
              <HeadCell>{t("masters.common.activeColumn")}</HeadCell>
              <HeadCell>{t("masters.courses.field.courseName")}</HeadCell>
              <HeadCell numeric>{t("masters.courses.field.duration")}</HeadCell>
              <HeadCell numeric>{t("masters.courses.field.basePrice")}</HeadCell>
              <HeadCell numeric>{t("masters.courses.field.opsCallCredit")}</HeadCell>
              <HeadCell numeric>{t("masters.courses.field.earcarePoolPerCall")}</HeadCell>
              <HeadCell>{t("masters.courses.field.tvDisplayName")}</HeadCell>
              <HeadCell>{t("masters.courses.column.period")}</HeadCell>
              <HeadCell>{t("masters.courses.secondTherapistRequired")}</HeadCell>
            </>
          }
          label={t("masters.courses.baseCourseMaster")}
          minWidth="min-w-[64rem]"
        >
          {courses.map((course) => {
            const policy = course.currentPolicy;
            return (
              <SelectableRow
                key={course.id}
                label={course.code}
                onSelect={(viaKeyboard) => choose({ kind: "course", courseId: course.id }, viaKeyboard)}
                selected={selected?.kind === "course" && selected.courseId === course.id}
              >
                <Cell>
                  <ActiveStatus inactiveNote={t("masters.courses.inactiveNote")} isActive={course.isActive} locale={locale} />
                </Cell>
                {policy ? (
                  <>
                    <Cell>{policy.name}</Cell>
                    <Cell numeric>{formatNumber(locale, policy.durationMinutes)}</Cell>
                    <Cell numeric>{formatNumber(locale, policy.basePrice)}</Cell>
                    <Cell numeric>{formatNumber(locale, policy.opsCallCredit)}</Cell>
                    <Cell numeric>{formatNumber(locale, policy.earcarePoolAmount)}</Cell>
                    <Cell>{policy.tvDisplayName}</Cell>
                    <Cell muted>{periodLabel(policy.effectiveFromMonth, policy.effectiveToMonth, openEnded)}</Cell>
                    <Cell>{policy.requiresSecondTherapist ? t("masters.courses.secondTherapistRequiredYes") : t("masters.courses.secondTherapistRequiredNo")}</Cell>
                  </>
                ) : (
                  <td className={cn(masterCellClassName, "text-muted")} colSpan={8}>
                    {t("masters.courses.noPolicy")}
                  </td>
                )}
              </SelectableRow>
            );
          })}
        </MasterTable>
      </section>

      <section aria-labelledby="therapist-rate-title" className="grid gap-3">
        <MasterSectionHeading id="therapist-rate-title" title={t("masters.courses.therapistRateTitle")} />
        <p className="text-sm text-muted">
          {t("masters.courses.therapistRateNote")} {t("masters.courses.impact.rateZeroVsMissing")}
        </p>
        <RateMatrix courses={courses} onSelect={choose} rates={rates} selected={selected} therapists={therapists} />
      </section>

      <section aria-labelledby="daily-rule-title" className="grid gap-3">
        <MasterSectionHeading
          action={<CreateRulePanel kind="daily" monthKey={monthKey} onCreated={(item) => choose(item)} />}
          id="daily-rule-title"
          title={t("masters.courses.dailyIncentiveTitle")}
        />
        <MasterTable
          head={
            <>
              <HeadCell>{t("masters.courses.column.dailyTotalCalls")}</HeadCell>
              <HeadCell numeric>{t("masters.courses.column.personalAmount")}</HeadCell>
              <HeadCell>{t("masters.courses.column.period")}</HeadCell>
            </>
          }
          label={t("masters.courses.dailyIncentiveTitle")}
          minWidth="min-w-[28rem]"
        >
          {dailyRules.map((rule) => (
            <SelectableRow
              key={rule.id}
              label={t("masters.courses.callCount", { count: formatNumber(locale, rule.thresholdCallCount) })}
              onSelect={(viaKeyboard) => choose({ kind: "daily", ruleId: rule.id }, viaKeyboard)}
              selected={selected?.kind === "daily" && selected.ruleId === rule.id}
            >
              <Cell numeric>{formatNumber(locale, rule.personalAmount)}</Cell>
              <Cell muted>{periodLabel(rule.effectiveFromMonth, rule.effectiveToMonth, openEnded)}</Cell>
            </SelectableRow>
          ))}
        </MasterTable>
      </section>

      <section aria-labelledby="monthly-rule-title" className="grid gap-3">
        <MasterSectionHeading
          action={<CreateRulePanel kind="monthly" monthKey={monthKey} onCreated={(item) => choose(item)} />}
          id="monthly-rule-title"
          title={t("masters.courses.monthlyIncentiveTitle")}
        />
        <MasterTable
          head={
            <>
              <HeadCell>{t("masters.courses.column.monthlyTotalCalls")}</HeadCell>
              <HeadCell numeric>{t("masters.courses.column.totalMonthlyIncentive")}</HeadCell>
              <HeadCell numeric>{t("masters.courses.column.lead")}</HeadCell>
              <HeadCell numeric>{t("masters.courses.column.counterTeam")}</HeadCell>
              <HeadCell numeric>{t("masters.courses.column.waiterTeam")}</HeadCell>
              <HeadCell>{t("masters.courses.column.period")}</HeadCell>
            </>
          }
          label={t("masters.courses.monthlyIncentiveTitle")}
          minWidth="min-w-[40rem]"
        >
          {monthlyRules.map((rule) => (
            <SelectableRow
              key={rule.id}
              label={t("masters.courses.callCount", { count: formatNumber(locale, rule.thresholdCallCount) })}
              onSelect={(viaKeyboard) => choose({ kind: "monthly", ruleId: rule.id }, viaKeyboard)}
              selected={selected?.kind === "monthly" && selected.ruleId === rule.id}
            >
              <Cell numeric>{formatNumber(locale, rule.totalAmount)}</Cell>
              <Cell numeric>{formatNumber(locale, rule.leadShare)}</Cell>
              <Cell numeric>{formatNumber(locale, rule.counterTeamShare)}</Cell>
              <Cell numeric>{formatNumber(locale, rule.waiterTeamShare)}</Cell>
              <Cell muted>{periodLabel(rule.effectiveFromMonth, rule.effectiveToMonth, openEnded)}</Cell>
            </SelectableRow>
          ))}
        </MasterTable>
      </section>
    </MasterSplit>
  );
}
