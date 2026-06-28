"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { accountRoles, employeeGroups, employmentStatuses, shiftTypes, type EmployeeGroup } from "@/modules/masters/employee-schema";
import type { EmployeeDto } from "@/modules/masters/employee-service";
import {
  createEmployeeAction,
  deactivateEmployeeAction,
  linkUserAccountToEmployeeAction,
  updateEmployeeProfileAction,
  updateEmployeeSortOrderAction,
  type AccountLinkActionState,
  type EmployeeActionState
} from "@/app/(erp)/masters/employees/actions";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/types";

const groupLabelKeys: Record<EmployeeGroup, MessageKey> = {
  OPERATIONS: "masters.employees.group.OPERATIONS",
  EARCARE: "masters.employees.group.EARCARE",
  THERAPIST: "masters.employees.group.THERAPIST"
};

function masterDateTime(locale: Locale, value: string) {
  return formatDateTime(locale, value, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

function InlineError({ state, field }: { state: EmployeeActionState | AccountLinkActionState; field?: string }) {
  if (!state || state.ok) {
    return null;
  }

  if (field) {
    const fieldMessages = state.fieldErrors?.[field];
    if (!fieldMessages?.length) {
      return null;
    }

    return (
      <span className="text-xs text-danger">
        {fieldMessages.map((message) => (
          <span key={message}>{message}</span>
        ))}
      </span>
    );
  }

  if (!state.formError) {
    return null;
  }

  return (
    <span className="text-xs text-danger">
      <span>{state.formError}</span>
    </span>
  );
}

function EmployeeCreateForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<EmployeeActionState, FormData>(createEmployeeAction, null);

  return (
    <section className="mb-5 border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("masters.employees.create")}</h2>
      </div>
      <form action={formAction} className="grid gap-3 px-4 py-4 md:grid-cols-6">
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("masters.employees.field.name")}
          <input className="h-9 border border-border bg-background px-2 text-sm text-foreground" name="displayName" required />
          <InlineError field="displayName" state={state} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("masters.employees.field.staffCode")}
          <input className="h-9 border border-border bg-background px-2 text-sm text-foreground" name="staffCode" required />
          <InlineError field="staffCode" state={state} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("masters.employees.field.group")}
          <select className="h-9 border border-border bg-background px-2 text-sm text-foreground" name="employeeGroup" required>
            {employeeGroups.map((group) => (
              <option key={group} value={group}>
                {t(groupLabelKeys[group])}
              </option>
            ))}
          </select>
          <InlineError field="employeeGroup" state={state} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("masters.employees.field.position")}
          <input className="h-9 border border-border bg-background px-2 text-sm text-foreground" name="position" required />
          <InlineError field="position" state={state} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("masters.employees.field.shiftType")}
          <select className="h-9 border border-border bg-background px-2 text-sm text-foreground" name="shiftType">
            <option value="">{t("masters.employees.field.notEntered")}</option>
            {shiftTypes.map((shiftType) => (
              <option key={shiftType} value={shiftType}>
                {shiftType}
              </option>
            ))}
          </select>
          <InlineError field="shiftType" state={state} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("masters.employees.field.baseSalary")}
          <input className="h-9 border border-border bg-background px-2 text-sm text-foreground" min={0} name="baseSalary" required type="number" />
          <InlineError field="baseSalary" state={state} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("masters.employees.field.phone")}
          <input className="h-9 border border-border bg-background px-2 text-sm text-foreground" name="phone" />
          <InlineError field="phone" state={state} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("masters.employees.field.birthday")}
          <input className="h-9 border border-border bg-background px-2 text-sm text-foreground" name="birthday" type="date" />
          <InlineError field="birthday" state={state} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("masters.employees.field.hireDate")}
          <input className="h-9 border border-border bg-background px-2 text-sm text-foreground" name="hireDate" type="date" />
          <InlineError field="hireDate" state={state} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("masters.employees.field.employmentStatus")}
          <select className="h-9 border border-border bg-background px-2 text-sm text-foreground" name="employmentStatus">
            {employmentStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <InlineError field="employmentStatus" state={state} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("masters.common.sortOrder")}
          <input className="h-9 border border-border bg-background px-2 text-sm text-foreground" min={1} name="sortOrder" required type="number" />
          <InlineError field="sortOrder" state={state} />
        </label>
        <div className="flex items-end">
          <Button className="h-9 px-3 text-xs" disabled={pending} type="submit">
            {t("masters.employees.create")}
          </Button>
        </div>
        <InlineError state={state} />
      </form>
    </section>
  );
}

function ProfileForm({ employee }: { employee: EmployeeDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<EmployeeActionState, FormData>(updateEmployeeProfileAction, null);

  return (
    <form action={formAction} className="grid min-w-[860px] grid-cols-[150px_120px_110px_90px_90px_110px_120px_120px_120px_auto] gap-2">
      <input name="employeeId" type="hidden" value={employee.id} />
      <input name="staffCode" type="hidden" value={employee.staffCode} />
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.common.displayName")}
        <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={employee.displayName} name="displayName" required />
        <InlineError field="displayName" state={state} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.employees.field.group")}
        <select className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={employee.employeeGroup} name="employeeGroup">
          {employeeGroups.map((group) => (
            <option key={group} value={group}>
              {t(groupLabelKeys[group])}
            </option>
          ))}
        </select>
        <InlineError field="employeeGroup" state={state} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.employees.field.position")}
        <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={employee.position} name="position" required />
        <InlineError field="position" state={state} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.employees.field.shiftType")}
        <select className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={employee.shiftType ?? ""} name="shiftType">
          <option value="">{t("masters.employees.field.notEntered")}</option>
          {shiftTypes.map((shiftType) => (
            <option key={shiftType} value={shiftType}>
              {shiftType}
            </option>
          ))}
        </select>
        <InlineError field="shiftType" state={state} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.employees.field.baseSalary")}
        <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={employee.baseSalary} min={0} name="baseSalary" type="number" />
        <InlineError field="baseSalary" state={state} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.employees.field.phone")}
        <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={employee.phone ?? ""} name="phone" />
        <InlineError field="phone" state={state} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.employees.field.birthday")}
        <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={employee.birthday ?? ""} name="birthday" type="date" />
        <InlineError field="birthday" state={state} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.employees.field.hireDate")}
        <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={employee.hireDate ?? ""} name="hireDate" type="date" />
        <InlineError field="hireDate" state={state} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.employees.field.employmentStatus")}
        <select className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={employee.employmentStatus} name="employmentStatus">
          {employmentStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <InlineError field="employmentStatus" state={state} />
      </label>
      <div className="flex items-end">
        <input name="sortOrder" type="hidden" value={employee.sortOrder} />
        <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="secondary">
          {t("masters.employees.saveProfile")}
        </Button>
      </div>
      <InlineError state={state} />
    </form>
  );
}

function SortOrderForm({ employee }: { employee: EmployeeDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<EmployeeActionState, FormData>(updateEmployeeSortOrderAction, null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input name="employeeId" type="hidden" value={employee.id} />
      <label className="sr-only" htmlFor={`sort-${employee.id}`}>
        {t("masters.common.sortOrder")}
      </label>
      <input
        className="h-8 w-20 border border-border bg-background px-2 text-sm text-foreground"
        defaultValue={employee.sortOrder}
        id={`sort-${employee.id}`}
        min={1}
        name="sortOrder"
        type="number"
      />
      <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="secondary">
        {t("masters.employees.saveSortOrder")}
      </Button>
      <InlineError field="sortOrder" state={state} />
    </form>
  );
}

function DeactivateForm({ employee }: { employee: EmployeeDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<EmployeeActionState, FormData>(deactivateEmployeeAction, null);

  if (!employee.isActive) {
    return <span className="text-xs text-muted">{t("masters.common.alreadyInactive")}</span>;
  }

  return (
    <form action={formAction} className="grid gap-1">
      <input name="employeeId" type="hidden" value={employee.id} />
      <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="ghost">
        {t("masters.common.deactivate")}
      </Button>
      <InlineError state={state} />
    </form>
  );
}

function AccountLinkForm({ employee }: { employee: EmployeeDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<AccountLinkActionState, FormData>(linkUserAccountToEmployeeAction, null);

  return (
    <form action={formAction} className="grid min-w-[560px] grid-cols-[130px_170px_145px_130px_auto] gap-2">
      <input name="employeeId" type="hidden" value={employee.id} />
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.employees.field.accountId")}
        <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={employee.account?.accountId ?? ""} name="accountId" />
        <InlineError field="accountId" state={state} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.employees.field.email")}
        <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={employee.account?.email ?? ""} name="email" type="email" />
        <InlineError field="email" state={state} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.employees.field.role")}
        <select className="h-8 border border-border bg-background px-2 text-sm text-foreground" defaultValue={employee.account?.role ?? "counter"} name="role">
          {accountRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <InlineError field="role" state={state} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        {t("masters.employees.field.initialSecret")}
        <input className="h-8 border border-border bg-background px-2 text-sm text-foreground" name="initialSecret" type="password" />
        <InlineError field="initialSecret" state={state} />
      </label>
      <div className="flex items-end">
        <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="secondary">
          {t("masters.employees.linkAccount")}
        </Button>
      </div>
      <InlineError state={state} />
    </form>
  );
}

function EmployeeTable({ title, employees }: { title: string; employees: EmployeeDto[] }) {
  const t = useT();
  const locale = useLocale();
  return (
    <section className="border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">
          {title} <span className="text-sm font-normal text-muted">{employees.length}{t("masters.employees.peopleSuffix")}</span>
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1720px] border-collapse text-left text-sm">
          <thead className="bg-readonly text-xs font-semibold text-muted">
            <tr>
              <th className="w-[930px] border-b border-border px-3 py-2">{t("masters.employees.column.profile")}</th>
              <th className="w-40 border-b border-border px-3 py-2">{t("masters.employees.column.idStaffCode")}</th>
              <th className="w-40 border-b border-border px-3 py-2">{t("masters.employees.column.sort")}</th>
              <th className="w-28 border-b border-border px-3 py-2">{t("masters.employees.column.status")}</th>
              <th className="w-[590px] border-b border-border px-3 py-2">{t("masters.employees.column.linkedAccount")}</th>
              <th className="w-44 border-b border-border px-3 py-2">{t("masters.employees.column.timestamps")}</th>
              <th className="border-b border-border px-3 py-2">{t("masters.common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr className={employee.isActive ? "align-top" : "bg-readonly align-top"} key={employee.id}>
                <td className="border-b border-border px-3 py-2">
                  <ProfileForm employee={employee} />
                  <div className="mt-1 text-xs text-muted">
                    {t("masters.employees.baseSalaryLine", {
                      group: t(groupLabelKeys[employee.employeeGroup]),
                      amount: formatNumber(locale, employee.baseSalary)
                    })}
                  </div>
                </td>
                <td className="border-b border-border px-3 py-2 text-xs text-muted">
                  <div>{t("masters.employees.employeeId", { id: employee.id })}</div>
                  <div>{t("masters.employees.staffCodeLine", { code: employee.staffCode })}</div>
                </td>
                <td className="border-b border-border px-3 py-2">
                  <SortOrderForm employee={employee} />
                </td>
                <td className="border-b border-border px-3 py-2">
                  <div>{employee.employmentStatus}</div>
                  <div className="text-xs text-muted">{employee.isActive ? t("masters.common.active") : t("masters.common.inactive")}</div>
                </td>
                <td className="border-b border-border px-3 py-2">
                  <AccountLinkForm employee={employee} />
                  {employee.account ? (
                    <div className="mt-1 text-xs text-muted">{t("masters.employees.currentRole", { role: employee.account.role })}</div>
                  ) : null}
                </td>
                <td className="border-b border-border px-3 py-2 text-xs text-muted">
                  <div>{t("masters.employees.createdLine", { value: masterDateTime(locale, employee.createdAt) })}</div>
                  <div>{t("masters.employees.updatedLine", { value: masterDateTime(locale, employee.updatedAt) })}</div>
                </td>
                <td className="border-b border-border px-3 py-2">
                  <DeactivateForm employee={employee} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function EmployeeManager({ employees }: { employees: EmployeeDto[] }) {
  const t = useT();
  const grouped = employeeGroups.map((group) => ({
    group,
    employees: employees.filter((employee) => employee.employeeGroup === group)
  }));

  return (
    <>
      <EmployeeCreateForm />
      <div className="grid gap-5">
        {grouped.map((entry) => (
          <EmployeeTable employees={entry.employees} key={entry.group} title={t(groupLabelKeys[entry.group])} />
        ))}
      </div>
    </>
  );
}
