"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/i18n/format";
import type { DailyExpenseDto, ServiceCallOption } from "@/modules/calls/service-call-service";
import {
  createDailyExpenseAction,
  deactivateDailyExpenseAction,
  updateDailyExpenseAction,
  type DailyExpenseActionState
} from "@/app/(erp)/calls/actions";

function fieldError(state: DailyExpenseActionState, field: string) {
  if (!state || state.ok) {
    return null;
  }
  return state.fieldErrors?.[field]?.[0] ?? null;
}

function InlineError({ state, field }: { state: DailyExpenseActionState; field?: string }) {
  if (!state || state.ok) {
    return null;
  }

  const message = field ? fieldError(state, field) : state.formError;
  return message ? (
    <span className="text-xs text-danger" role="alert">
      {message}
    </span>
  ) : null;
}

function HandlerSelect({
  defaultValue,
  disabled,
  handlers,
  label,
  name
}: {
  defaultValue?: string;
  disabled: boolean;
  handlers: ServiceCallOption[];
  label: string;
  name: string;
}) {
  const t = useT();
  return (
    <select
      aria-label={label}
      className="h-8 min-w-44 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
      defaultValue={defaultValue ?? ""}
      disabled={disabled}
      name={name}
      required
    >
      <option value="">{t("calls.expense.field.handlerPlaceholder")}</option>
      {handlers.map((handler) => (
        <option key={handler.value} value={handler.value}>
          {handler.label}
        </option>
      ))}
    </select>
  );
}

function ExpenseRow({
  expense,
  handlers,
  isLocked,
  operatingMonthId,
  serviceDate
}: {
  expense: DailyExpenseDto;
  handlers: ServiceCallOption[];
  isLocked: boolean;
  operatingMonthId: string;
  serviceDate: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [updateState, updateAction, updatePending] = useActionState<DailyExpenseActionState, FormData>(updateDailyExpenseAction, null);
  const [deactivateState, deactivateAction, deactivatePending] = useActionState<DailyExpenseActionState, FormData>(deactivateDailyExpenseAction, null);
  const disabled = isLocked || updatePending || deactivatePending;

  return (
    <tr className="align-top">
      <td className="border-b border-border px-2 py-2">
        <form action={updateAction} className="flex min-w-[760px] flex-wrap items-start gap-2" noValidate>
          <input name="dailyExpenseId" type="hidden" value={expense.id} />
          <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
          <input name="expenseDate" type="hidden" value={serviceDate} />
          <label className="grid gap-1">
            <span className="sr-only">{t("calls.expense.field.amount")}</span>
            <input
              className="h-8 w-32 border border-border bg-background px-2 text-xs text-foreground outline-none [font-variant-numeric:tabular-nums] focus:border-brand disabled:bg-readonly"
              defaultValue={expense.amount}
              disabled={disabled}
              min={1}
              name="amount"
              required
              step={1}
              type="number"
            />
            <InlineError field="amount" state={updateState} />
          </label>
          <label className="grid gap-1">
            <span className="sr-only">{t("calls.expense.field.description")}</span>
            <input
              className="h-8 w-48 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
              defaultValue={expense.description}
              disabled={disabled}
              maxLength={200}
              name="description"
              placeholder={t("calls.expense.field.description")}
              required
            />
            <InlineError field="description" state={updateState} />
          </label>
          <HandlerSelect defaultValue={expense.handledByEmployee.id} disabled={disabled} handlers={handlers} label={t("calls.expense.field.handler")} name="handledByEmployeeId" />
          <label className="grid gap-1">
            <span className="sr-only">{t("calls.expense.field.note")}</span>
            <input
              className="h-8 w-48 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
              defaultValue={expense.note ?? ""}
              disabled={disabled}
              maxLength={500}
              name="note"
              placeholder={t("calls.expense.field.note")}
            />
            <InlineError field="note" state={updateState} />
          </label>
          <Button className="h-8 px-2 text-xs" disabled={disabled} type="submit">
            {t("calls.expense.action.update")}
          </Button>
          {updateState?.ok ? <span className="self-center text-xs text-muted">{t("calls.save.saved")}</span> : <InlineError state={updateState} />}
        </form>
      </td>
      <td className="border-b border-border px-2 py-2 text-right text-xs [font-variant-numeric:tabular-nums]">{formatNumber(locale, expense.amount)} {t("calls.summary.vndSuffix")}</td>
      <td className="border-b border-border px-2 py-2 text-xs text-muted">{expense.handledByEmployee.displayName}</td>
      <td className="border-b border-border px-2 py-2">
        <form action={deactivateAction} className="grid justify-items-end gap-1">
          <input name="dailyExpenseId" type="hidden" value={expense.id} />
          <Button className="h-8 px-2 text-xs" disabled={disabled} type="submit" variant="secondary">
            {t("calls.expense.action.deactivate")}
          </Button>
          {deactivateState?.ok ? <span className="text-xs text-muted">{t("calls.expense.action.deactivated")}</span> : <InlineError state={deactivateState} />}
        </form>
      </td>
    </tr>
  );
}

function AddExpenseForm({
  handlers,
  isLocked,
  operatingMonthId,
  serviceDate
}: {
  handlers: ServiceCallOption[];
  isLocked: boolean;
  operatingMonthId: string;
  serviceDate: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<DailyExpenseActionState, FormData>(createDailyExpenseAction, null);
  const disabled = isLocked || pending;

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2 border-t border-border px-3 py-3" noValidate>
      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
      <input name="expenseDate" type="hidden" value={serviceDate} />
      <label className="grid gap-1">
        <span className="sr-only">{t("calls.expense.field.amount")}</span>
        <input
          className="h-8 w-32 border border-border bg-background px-2 text-xs text-foreground outline-none [font-variant-numeric:tabular-nums] focus:border-brand disabled:bg-readonly"
          disabled={disabled}
          min={1}
          name="amount"
          placeholder={t("calls.expense.field.amountPlaceholder")}
          required
          step={1}
          type="number"
        />
        <InlineError field="amount" state={state} />
      </label>
      <label className="grid gap-1">
        <span className="sr-only">{t("calls.expense.field.description")}</span>
        <input
          className="h-8 w-56 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
          disabled={disabled}
          maxLength={200}
          name="description"
          placeholder={t("calls.expense.field.description")}
          required
        />
        <InlineError field="description" state={state} />
      </label>
      <HandlerSelect disabled={disabled} handlers={handlers} label={t("calls.expense.field.handler")} name="handledByEmployeeId" />
      <label className="grid gap-1">
        <span className="sr-only">{t("calls.expense.field.note")}</span>
        <input
          className="h-8 w-56 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
          disabled={disabled}
          maxLength={500}
          name="note"
          placeholder={t("calls.expense.field.note")}
        />
        <InlineError field="note" state={state} />
      </label>
      <Button className="h-8 px-2 text-xs" disabled={disabled} type="submit">
        {t("calls.expense.action.add")}
      </Button>
      {state?.ok ? <span className="self-center text-xs text-muted">{t("calls.save.saved")}</span> : <InlineError state={state} />}
    </form>
  );
}

export function DailyExpensePanel({
  expenses,
  handlers,
  isLocked,
  operatingMonthId,
  serviceDate
}: {
  expenses: DailyExpenseDto[];
  handlers: ServiceCallOption[];
  isLocked: boolean;
  operatingMonthId: string;
  serviceDate: string;
}) {
  const t = useT();
  return (
    <section className="mb-4 border border-border bg-surface" aria-label={t("calls.expense.aria")}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("calls.expense.title")}</h2>
          {isLocked ? (
            <div className="mt-1 text-xs text-danger">
              <p className="font-medium">{t("calls.grid.lockedTitle")}</p>
              <p>{t("calls.expense.lockedDescription")}</p>
            </div>
          ) : null}
        </div>
        <span className="text-xs text-muted">{t("calls.expense.itemCount", { count: expenses.length })}</span>
      </div>
      {expenses.length === 0 ? (
        <div className="px-3 py-4 text-sm text-muted">{t("calls.expense.empty")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-readonly text-xs font-semibold text-foreground">
              <tr>
                <th className="border-b border-border px-2 py-2">{t("calls.expense.column.input")}</th>
                <th className="border-b border-border px-2 py-2 text-right">{t("calls.expense.column.displayAmount")}</th>
                <th className="border-b border-border px-2 py-2">{t("calls.expense.column.handler")}</th>
                <th className="border-b border-border px-2 py-2 text-right">{t("calls.expense.column.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <ExpenseRow
                  expense={expense}
                  handlers={handlers}
                  isLocked={isLocked}
                  key={expense.id}
                  operatingMonthId={operatingMonthId}
                  serviceDate={serviceDate}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AddExpenseForm handlers={handlers} isLocked={isLocked} operatingMonthId={operatingMonthId} serviceDate={serviceDate} />
    </section>
  );
}
