"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateCapsule } from "@/components/ui/date-capsule";
import { DetailRow } from "@/components/ui/detail-row";
import { ModalPanel, SidePanel } from "@/components/ui/panel";
import {
  accountRoles,
  employeeGroups,
  employmentStatuses,
  shiftTypes,
  type EmployeeGroup,
  type EmploymentStatus,
  type ShiftType
} from "@/modules/masters/employee-schema";
import type { EmployeeDto, FutureCallSummary } from "@/modules/masters/employee-service";
import {
  createEmployeeAction,
  deactivateEmployeeAction,
  linkUserAccountToEmployeeAction,
  updateEmployeeProfileAction,
  updateEmployeeSortOrderAction,
  type AccountLinkActionState,
  type DeactivateEmployeeActionState,
  type EmployeeActionState
} from "@/app/(erp)/masters/employees/actions";
import { SaveRow, SelectField, TextField } from "@/app/(erp)/masters/master-fields";
import { ActiveStatus, Cell, HeadCell, ImpactNotice, MasterSectionHeading, MasterTable, PanelSection, masterDateTime } from "@/app/(erp)/masters/master-parts";
import { MasterSplit, SelectableRow, useMasterSelection, useSelectCreatedItem } from "@/app/(erp)/masters/master-workspace";
import { TherapistMemoPanel } from "@/app/(erp)/masters/employees/therapist-memo-panel";
import type { TherapistMemoDto } from "@/modules/therapists/therapist-memo-service";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n";
import { formatNumber } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";

const groupLabelKeys: Record<EmployeeGroup, MessageKey> = {
  OPERATIONS: "masters.employees.group.OPERATIONS",
  THERAPIST: "masters.employees.group.THERAPIST"
};

const roleLabelKeys: Record<(typeof accountRoles)[number], MessageKey> = {
  administrator: "masters.employees.role.administrator",
  counter: "masters.employees.role.counter",
  waiter: "masters.employees.role.waiter",
  settlement_manager: "masters.employees.role.settlement_manager",
  read_only_viewer: "masters.employees.role.read_only_viewer"
};

// 값은 한국어 stable key 그대로 저장하고, 보이는 이름만 번역한다.
const shiftLabelKeys: Record<ShiftType, MessageKey> = {
  전체: "masters.employees.shift.all",
  주간: "masters.employees.shift.day",
  야간: "masters.employees.shift.night"
};

const employmentLabelKeys: Record<EmploymentStatus, MessageKey> = {
  재직: "masters.employees.employment.employed",
  퇴사: "masters.employees.employment.left",
  휴직: "masters.employees.employment.onLeave"
};

function roleDisplayName(t: Translator, role: string) {
  return (accountRoles as readonly string[]).includes(role) ? t(roleLabelKeys[role as (typeof accountRoles)[number]]) : role;
}

/** 프로필 칸들. 생성 서랍과 직원 패널이 같은 칸을 쓴다(생성 서랍만 이름 라벨이 "이름"이고 staff code를 받는다). */
function ProfileFields({ employee, state }: { employee?: EmployeeDto; state: EmployeeActionState }) {
  const t = useT();
  return (
    <>
      <SelectField defaultValue={employee?.employeeGroup} label={t("masters.employees.field.group")} name="employeeGroup" required state={state}>
        {employeeGroups.map((group) => (
          <option key={group} value={group}>
            {t(groupLabelKeys[group])}
          </option>
        ))}
      </SelectField>
      <TextField defaultValue={employee?.position} label={t("masters.employees.field.position")} name="position" required state={state} />
      <SelectField defaultValue={employee?.shiftType ?? ""} label={t("masters.employees.field.shiftType")} name="shiftType" state={state}>
        <option value="">{t("masters.employees.field.notEntered")}</option>
        {shiftTypes.map((shiftType) => (
          <option key={shiftType} value={shiftType}>
            {t(shiftLabelKeys[shiftType])}
          </option>
        ))}
      </SelectField>
      <TextField defaultValue={employee?.baseSalary} label={t("masters.employees.field.baseSalary")} min={0} name="baseSalary" required state={state} type="number" />
      <TextField defaultValue={employee?.phone ?? ""} label={t("masters.employees.field.phone")} name="phone" state={state} />
      <TextField defaultValue={employee?.birthday ?? ""} label={t("masters.employees.field.birthday")} name="birthday" state={state} type="date" />
      <TextField defaultValue={employee?.hireDate ?? ""} label={t("masters.employees.field.hireDate")} name="hireDate" state={state} type="date" />
      <SelectField defaultValue={employee?.employmentStatus} label={t("masters.employees.field.employmentStatus")} name="employmentStatus" state={state}>
        {employmentStatuses.map((status) => (
          <option key={status} value={status}>
            {t(employmentLabelKeys[status])}
          </option>
        ))}
      </SelectField>
    </>
  );
}

/** 도구줄의 주요 행동: 직원을 만드는 서랍. 만든 직원을 바로 골라 패널에 연다. */
export function CreateEmployeePanel() {
  const t = useT();
  const selectCreated = useSelectCreatedItem();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<EmployeeActionState, FormData>(async (previous, formData) => {
    const result = await createEmployeeAction(previous, formData);
    if (result?.ok) {
      setOpen(false);
      selectCreated(result.data.id);
    }
    return result;
  }, null);

  return (
    <ModalPanel
      description={t("masters.employees.createDescription")}
      onOpenChange={setOpen}
      open={open}
      title={t("masters.employees.create")}
      trigger={<Button>{t("masters.employees.create")}</Button>}
    >
      <form action={formAction} className="grid gap-4">
        <TextField label={t("masters.employees.field.name")} name="displayName" required state={state} />
        <TextField label={t("masters.employees.field.staffCode")} name="staffCode" required state={state} />
        <ProfileFields state={state} />
        <TextField label={t("masters.common.sortOrder")} min={1} name="sortOrder" required state={state} type="number" />
        <SaveRow label={t("masters.employees.create")} pending={pending} primary savedMessage={t("masters.employees.savedNotice")} state={state} />
      </form>
    </ModalPanel>
  );
}

function ProfileForm({ employee }: { employee: EmployeeDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<EmployeeActionState, FormData>(updateEmployeeProfileAction, null);

  return (
    <form action={formAction} className="grid gap-4">
      <input name="employeeId" type="hidden" value={employee.id} />
      <input name="staffCode" type="hidden" value={employee.staffCode} />
      <input name="sortOrder" type="hidden" value={employee.sortOrder} />
      <div className="grid gap-4 min-[1200px]:grid-cols-2">
        <TextField defaultValue={employee.displayName} label={t("masters.common.displayName")} name="displayName" required state={state} />
        <ProfileFields employee={employee} state={state} />
      </div>
      <SaveRow label={t("masters.employees.saveProfile")} pending={pending} savedMessage={t("masters.employees.savedNotice")} state={state} />
    </form>
  );
}

function SortOrderForm({ employee }: { employee: EmployeeDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<EmployeeActionState, FormData>(updateEmployeeSortOrderAction, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="employeeId" type="hidden" value={employee.id} />
      <TextField defaultValue={employee.sortOrder} label={t("masters.common.sortOrder")} min={1} name="sortOrder" state={state} type="number" />
      <SaveRow label={t("masters.employees.saveSortOrder")} pending={pending} state={state} />
    </form>
  );
}

function AccountLinkForm({ employee }: { employee: EmployeeDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<AccountLinkActionState, FormData>(linkUserAccountToEmployeeAction, null);

  return (
    <form action={formAction} className="grid gap-4">
      <input name="employeeId" type="hidden" value={employee.id} />
      <div className="grid gap-4 min-[1200px]:grid-cols-2">
        <TextField defaultValue={employee.account?.accountId ?? ""} label={t("masters.employees.field.accountId")} name="accountId" state={state} />
        <TextField defaultValue={employee.account?.email ?? ""} label={t("masters.employees.field.email")} name="email" state={state} type="email" />
        <SelectField defaultValue={employee.account?.role ?? "counter"} hint={t("masters.employees.role.tvHint")} label={t("masters.employees.field.role")} name="role" state={state}>
          {accountRoles.map((role) => (
            <option key={role} value={role}>
              {t(roleLabelKeys[role])}
            </option>
          ))}
        </SelectField>
        <TextField hint={t("masters.employees.initialSecretHint")} label={t("masters.employees.field.initialSecret")} name="initialSecret" state={state} type="password" />
      </div>
      <SaveRow label={t("masters.employees.linkAccount")} pending={pending} savedMessage={t("masters.employees.savedNotice")} state={state} />
    </form>
  );
}

/** 비활성 거절(HAS_FUTURE_CALLS): 사유와, 서비스가 돌려준 콜의 날짜·예약시각을 그대로 보인다. */
export function FutureCallsRejection({ calls }: { calls: FutureCallSummary[] }) {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="grid gap-3 rounded-md bg-danger-soft px-4 py-3" role="alert">
      <p className="text-sm font-semibold text-danger">
        <span aria-hidden="true">{"■︎ "}</span>
        {t("masters.employees.futureCalls.reason", { count: formatNumber(locale, calls.length) })}
      </p>
      <p className="text-sm text-foreground">{t("masters.employees.futureCalls.hint")}</p>
      <ul aria-label={t("masters.employees.futureCalls.listLabel")} className="grid gap-2">
        {calls.map((call) => (
          <li className="flex min-h-14 flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface px-4" key={call.serviceCallId}>
            <DateCapsule>{call.serviceDate}</DateCapsule>
            <DateCapsule>{call.startTime}</DateCapsule>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeactivateForm({ employee }: { employee: EmployeeDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<DeactivateEmployeeActionState, FormData>(deactivateEmployeeAction, null);
  const futureCalls = state && "futureCalls" in state ? state.futureCalls : undefined;

  if (!employee.isActive) {
    return <p className="text-sm text-muted">{t("masters.common.alreadyInactive")}</p>;
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input name="employeeId" type="hidden" value={employee.id} />
      <p className="text-sm text-muted">{t("masters.employees.deactivateNote")}</p>
      <SaveRow label={t("masters.common.deactivate")} pending={pending} state={futureCalls ? null : state} />
      {futureCalls ? <FutureCallsRejection calls={futureCalls} /> : null}
    </form>
  );
}

function EmployeePanel({
  employee,
  onClose,
  therapistMemos
}: {
  employee: EmployeeDto;
  onClose: () => void;
  /** 티켓 12: null이면 이 계정에는 메모가 아예 안 보내진 것이고(therapist:manage 없음), 섹션도 그리지 않는다. */
  therapistMemos: TherapistMemoDto[] | null;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <SidePanel onClose={onClose} title={`${employee.displayName} (${employee.staffCode})`}>
      <div className="grid gap-6" key={employee.id}>
        <ActiveStatus inactiveNote={t("masters.employees.inactiveNote")} isActive={employee.isActive} locale={locale} />
        <ImpactNotice
          items={[t("masters.employees.impact.name"), t("masters.employees.impact.inactive"), t("masters.employees.impact.account")]}
          locale={locale}
        />
        <PanelSection title={t("masters.employees.column.profile")}>
          <ProfileForm employee={employee} />
        </PanelSection>
        <SortOrderForm employee={employee} />
        <PanelSection title={t("masters.employees.column.linkedAccount")}>
          {employee.account ? (
            <p className="text-sm text-foreground">{t("masters.employees.currentRole", { role: roleDisplayName(t, employee.account.role) })}</p>
          ) : (
            <p className="text-sm text-muted">{t("masters.employees.accountNotLinked")}</p>
          )}
          <AccountLinkForm employee={employee} />
        </PanelSection>
        {employee.employeeGroup === "THERAPIST" && therapistMemos ? (
          <TherapistMemoPanel employeeId={employee.id} memos={therapistMemos} />
        ) : null}
        <PanelSection title={t("masters.common.details")}>
          <dl>
            <DetailRow label={t("masters.employees.employeeId")} value={employee.id} />
            <DetailRow label={t("masters.employees.field.staffCode")} value={employee.staffCode} />
            <DetailRow label={t("masters.common.createdAt")} value={masterDateTime(locale, employee.createdAt)} />
            <DetailRow label={t("masters.common.updatedAt")} value={masterDateTime(locale, employee.updatedAt)} />
          </dl>
        </PanelSection>
        <PanelSection title={t("masters.common.deactivateTitle")}>
          <DeactivateForm employee={employee} />
        </PanelSection>
      </div>
    </SidePanel>
  );
}

/** 직원 마스터: 직군별 직원 목록과, 고른 직원의 변경 영향·프로필·계정 연결·비활성 처리 패널. */
export function EmployeeManager({
  employees,
  initialItem,
  therapistMemosByEmployeeId = null
}: {
  employees: EmployeeDto[];
  initialItem: string | null;
  /** 티켓 12: therapist:manage가 없는 계정에는 page.tsx가 이 prop 자체를 null로 보낸다. */
  therapistMemosByEmployeeId?: Record<string, TherapistMemoDto[]> | null;
}) {
  const t = useT();
  const locale = useLocale();
  const { selected, select, panelRef } = useMasterSelection(initialItem);
  const selectedEmployee = employees.find((employee) => employee.id === selected && employeeGroups.includes(employee.employeeGroup)) ?? null;

  return (
    <MasterSplit
      hint={t("masters.common.panelHint")}
      panel={
        selectedEmployee ? (
          <EmployeePanel
            employee={selectedEmployee}
            onClose={() => select(null)}
            therapistMemos={therapistMemosByEmployeeId?.[selectedEmployee.id] ?? null}
          />
        ) : null
      }
      panelRef={panelRef}
    >
      {employeeGroups.map((group) => {
        const groupEmployees = employees.filter((employee) => employee.employeeGroup === group);
        const title = t(groupLabelKeys[group]);
        const headingId = `employee-group-${group}`;
        return (
          <section aria-labelledby={headingId} className="grid gap-3" key={group}>
            <MasterSectionHeading count={`${formatNumber(locale, groupEmployees.length)}${t("masters.employees.peopleSuffix")}`} id={headingId} title={title} />
            <MasterTable
              head={
                <>
                  <HeadCell>{t("masters.employees.field.name")}</HeadCell>
                  <HeadCell>{t("masters.common.activeColumn")}</HeadCell>
                  <HeadCell>{t("masters.employees.field.position")}</HeadCell>
                  <HeadCell>{t("masters.employees.field.shiftType")}</HeadCell>
                  <HeadCell>{t("masters.employees.field.employmentStatus")}</HeadCell>
                  <HeadCell>{t("masters.employees.column.linkedAccount")}</HeadCell>
                </>
              }
              label={title}
              minWidth="min-w-[44rem]"
            >
              {groupEmployees.map((employee) => (
                <SelectableRow
                  key={employee.id}
                  label={employee.displayName}
                  onSelect={(viaKeyboard) => select(employee.id, viaKeyboard)}
                  selected={employee.id === selected}
                  sublabel={employee.staffCode}
                >
                  <Cell>
                    <ActiveStatus inactiveNote={t("masters.employees.inactiveNote")} isActive={employee.isActive} locale={locale} />
                  </Cell>
                  <Cell>{employee.position}</Cell>
                  <Cell nowrap>{employee.shiftType ? t(shiftLabelKeys[employee.shiftType]) : t("masters.employees.field.notEntered")}</Cell>
                  <Cell nowrap>{t(employmentLabelKeys[employee.employmentStatus])}</Cell>
                  <Cell muted={!employee.account}>
                    {employee.account ? (
                      <span className="grid">
                        <span className="text-foreground">{employee.account.accountId}</span>
                        <span className="text-xs text-muted">{roleDisplayName(t, employee.account.role)}</span>
                      </span>
                    ) : (
                      t("masters.employees.accountNotLinked")
                    )}
                  </Cell>
                </SelectableRow>
              ))}
            </MasterTable>
          </section>
        );
      })}
    </MasterSplit>
  );
}
