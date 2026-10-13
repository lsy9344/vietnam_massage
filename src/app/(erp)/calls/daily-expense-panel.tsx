"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/i18n/format";
import type { DailyExpenseDto, ExpenseMethod, ServiceCallOption } from "@/modules/calls/service-call-service";
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

// 표 안의 모든 입력이 같은 높이(44px)와 테두리를 쓴다. 칸이 위아래로 맞아야 한 줄이 한 지출로 읽힌다.
const fieldClassName =
  "h-11 w-full border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand disabled:bg-readonly";

export function ExpenseMethodControl({
  defaultMethod = "cash",
  disabled,
  error,
  form,
  hideLabel = false
}: {
  defaultMethod?: ExpenseMethod;
  disabled: boolean;
  error: string | null;
  form?: string;
  hideLabel?: boolean;
}) {
  const t = useT();
  return (
    <label className="grid gap-1">
      <span className={hideLabel ? "sr-only" : "text-xs font-medium text-foreground"}>{t("calls.expense.field.method")}</span>
      <select
        aria-label={t("calls.expense.field.method")}
        className="h-11 w-full min-w-24 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand disabled:bg-readonly"
        defaultValue={defaultMethod}
        disabled={disabled}
        form={form}
        name="method"
      >
        <option value="cash">{t("calls.expense.method.cash")}</option>
        <option value="bank">{t("calls.expense.method.bank")}</option>
      </select>
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function ExpenseSaveButton({
  disabled,
  idleLabel,
  pending,
  variant
}: {
  disabled: boolean;
  idleLabel: string;
  pending: boolean;
  variant?: "default" | "secondary";
}) {
  const t = useT();
  return (
    <Button aria-busy={pending} className="h-11 whitespace-nowrap px-3 text-sm" disabled={disabled} type="submit" variant={variant}>
      {pending ? t("calls.expense.action.saving") : idleLabel}
    </Button>
  );
}

function HandlerSelect({
  defaultValue,
  disabled,
  form,
  handlers,
  label
}: {
  defaultValue?: string;
  disabled: boolean;
  form: string;
  handlers: ServiceCallOption[];
  label: string;
}) {
  const t = useT();
  return (
    <select
      aria-label={label}
      className={fieldClassName}
      defaultValue={defaultValue ?? ""}
      disabled={disabled}
      form={form}
      name="handledByEmployeeId"
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

// 한 지출의 입력 칸들. 입력은 각 칸(td)에 있고 form 속성으로 같은 행의 form에 묶인다.
function ExpenseFieldCells({
  disabled,
  expense,
  form,
  handlers,
  state
}: {
  disabled: boolean;
  expense?: DailyExpenseDto;
  form: string;
  handlers: ServiceCallOption[];
  state: DailyExpenseActionState;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <td className={cellClassName}>
        <label className="grid gap-1">
          <span className="sr-only">{t("calls.expense.field.amount")}</span>
          <input
            className={`${fieldClassName} text-right [font-variant-numeric:tabular-nums]`}
            defaultValue={expense?.amount}
            disabled={disabled}
            form={form}
            min={1}
            name="amount"
            placeholder={expense ? undefined : t("calls.expense.field.amountPlaceholder")}
            required
            step={1}
            type="number"
          />
          {expense ? (
            <span className="text-right text-xs text-muted [font-variant-numeric:tabular-nums]">
              {formatNumber(locale, expense.amount)} {t("calls.summary.vndSuffix")}
            </span>
          ) : null}
          <InlineError field="amount" state={state} />
        </label>
      </td>
      <td className={cellClassName}>
        <label className="grid gap-1">
          <span className="sr-only">{t("calls.expense.field.description")}</span>
          <input
            className={fieldClassName}
            defaultValue={expense?.description}
            disabled={disabled}
            form={form}
            maxLength={200}
            name="description"
            placeholder={t("calls.expense.field.description")}
            required
          />
          <InlineError field="description" state={state} />
        </label>
      </td>
      <td className={cellClassName}>
        <div className="grid gap-1">
          <HandlerSelect
            defaultValue={expense?.handledByEmployee.id}
            disabled={disabled}
            form={form}
            handlers={handlers}
            label={t("calls.expense.field.handler")}
          />
          <InlineError field="handledByEmployeeId" state={state} />
        </div>
      </td>
      <td className={cellClassName}>
        <ExpenseMethodControl defaultMethod={expense?.method} disabled={disabled} error={fieldError(state, "method")} form={form} hideLabel />
      </td>
      <td className={cellClassName}>
        <label className="grid gap-1">
          <span className="sr-only">{t("calls.expense.field.note")}</span>
          <input
            className={fieldClassName}
            defaultValue={expense?.note ?? ""}
            disabled={disabled}
            form={form}
            maxLength={500}
            name="note"
            placeholder={t("calls.expense.field.note")}
          />
          <InlineError field="note" state={state} />
        </label>
      </td>
    </>
  );
}

const cellClassName = "border-b border-border px-2 py-2 align-top";

function SavedOrError({ state, savedLabel }: { state: DailyExpenseActionState; savedLabel: string }) {
  if (state?.ok) {
    return (
      <span className="text-xs text-muted" role="status">
        {savedLabel}
      </span>
    );
  }
  return <InlineError state={state} />;
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
  const formId = `daily-expense-${expense.id}`;
  const [updateState, updateAction, updatePending] = useActionState<DailyExpenseActionState, FormData>(updateDailyExpenseAction, null);
  const [deactivateState, deactivateAction, deactivatePending] = useActionState<DailyExpenseActionState, FormData>(deactivateDailyExpenseAction, null);
  const disabled = isLocked || updatePending || deactivatePending;

  return (
    <tr>
      <ExpenseFieldCells disabled={disabled} expense={expense} form={formId} handlers={handlers} state={updateState} />
      <td className={cellClassName}>
        <div className="flex items-start justify-end gap-2">
          <form action={updateAction} id={formId} noValidate>
            <input name="dailyExpenseId" type="hidden" value={expense.id} />
            <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
            <input name="expenseDate" type="hidden" value={serviceDate} />
            <ExpenseSaveButton disabled={disabled} idleLabel={t("calls.expense.action.update")} pending={updatePending} variant="secondary" />
          </form>
          <form action={deactivateAction}>
            <input name="dailyExpenseId" type="hidden" value={expense.id} />
            <Button className="h-11 whitespace-nowrap px-3 text-sm hover:text-danger" disabled={disabled} type="submit" variant="ghost">
              {t("calls.expense.action.deactivate")}
            </Button>
          </form>
        </div>
        <div className="mt-1 grid justify-items-end gap-1 text-right">
          <SavedOrError savedLabel={t("calls.save.saved")} state={updateState} />
          <SavedOrError savedLabel={t("calls.expense.action.deactivated")} state={deactivateState} />
        </div>
      </td>
    </tr>
  );
}

function AddExpenseRow({
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
  const formId = "daily-expense-new";
  const [state, formAction, pending] = useActionState<DailyExpenseActionState, FormData>(createDailyExpenseAction, null);
  const disabled = isLocked || pending;

  return (
    <tr className="bg-readonly/40">
      <ExpenseFieldCells disabled={disabled} form={formId} handlers={handlers} state={state} />
      <td className={cellClassName}>
        <form action={formAction} className="flex justify-end" id={formId} noValidate>
          <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
          <input name="expenseDate" type="hidden" value={serviceDate} />
          <ExpenseSaveButton disabled={disabled} idleLabel={t("calls.expense.action.add")} pending={pending} />
        </form>
        <div className="mt-1 grid justify-items-end text-right">
          <SavedOrError savedLabel={t("calls.save.saved")} state={state} />
        </div>
      </td>
    </tr>
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
  const headClassName = "border-b border-border px-2 py-2 font-semibold";
  return (
    <section className="mb-4 border border-border bg-surface" aria-label={t("calls.expense.aria")}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("calls.expense.title")}</h2>
          {isLocked ? (
            <div className="mt-1 text-xs text-danger">
              <p className="font-medium">{t("calls.grid.lockedTitle")}</p>
              <p>{t("calls.expense.lockedDescription")}</p>
            </div>
          ) : null}
        </div>
        <span className="text-xs text-muted">{t("calls.expense.itemCount", { count: expenses.length })}</span>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[960px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[9.5rem]" />
            <col />
            <col className="w-[14rem]" />
            <col className="w-[9rem]" />
            <col />
            <col className="w-[11.5rem]" />
          </colgroup>
          <thead className="bg-readonly text-xs text-foreground">
            <tr>
              <th className={`${headClassName} text-right`} scope="col">{t("calls.expense.field.amount")}</th>
              <th className={headClassName} scope="col">{t("calls.expense.field.description")}</th>
              <th className={headClassName} scope="col">{t("calls.expense.column.handler")}</th>
              <th className={headClassName} scope="col">{t("calls.expense.field.method")}</th>
              <th className={headClassName} scope="col">{t("calls.expense.field.note")}</th>
              <th className={`${headClassName} text-right`} scope="col">{t("calls.expense.column.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td className="border-b border-border px-3 py-4 text-sm text-muted" colSpan={6}>
                  {t("calls.expense.empty")}
                </td>
              </tr>
            ) : (
              expenses.map((expense) => (
                <ExpenseRow
                  expense={expense}
                  handlers={handlers}
                  isLocked={isLocked}
                  key={expense.id}
                  operatingMonthId={operatingMonthId}
                  serviceDate={serviceDate}
                />
              ))
            )}
          </tbody>
          <tfoot>
            <AddExpenseRow handlers={handlers} isLocked={isLocked} operatingMonthId={operatingMonthId} serviceDate={serviceDate} />
          </tfoot>
        </table>
      </div>
    </section>
  );
}
