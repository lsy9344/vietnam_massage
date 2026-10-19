"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ModalPanel } from "@/components/ui/panel";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/i18n/format";
import type { DailyExpenseDto, ExpenseMethod, ServiceCallOption } from "@/modules/calls/service-call-service";
import {
  createDailyExpenseAction,
  deactivateDailyExpenseAction,
  updateDailyExpenseAction,
  type DailyExpenseActionState
} from "@/app/(erp)/calls/actions";

/** 행의 입력칸과 머리글의 칸 이름이 같은 열 폭을 쓰도록 공유한다. 열: 금액·내용·담당자·수단·비고·수정. */
const EXPENSE_INPUT_GRID = "grid grid-cols-[7rem_11rem_10rem_6.5rem_11rem_auto] items-start gap-2";

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

export function ExpenseMethodControl({
  defaultMethod = "cash",
  disabled,
  error,
  hideLabel = false
}: {
  defaultMethod?: ExpenseMethod;
  disabled: boolean;
  error: string | null;
  /** 라벨이 없는 한 줄 입력행에서는 라벨을 숨겨 다른 입력칸과 높이를 맞춘다. */
  hideLabel?: boolean;
}) {
  const t = useT();
  return (
    <label className={hideLabel ? "grid gap-1" : "grid gap-1.5"}>
      <span className={hideLabel ? "sr-only" : "text-sm font-semibold text-foreground"}>{t("calls.expense.field.method")}</span>
      <select
        aria-label={t("calls.expense.field.method")}
        className={inputFieldClassName({ className: hideLabel ? "w-full" : "min-w-28" })}
        defaultValue={defaultMethod}
        disabled={disabled}
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
  variant = "default"
}: {
  disabled: boolean;
  idleLabel: string;
  pending: boolean;
  /** 지출 추가만 주 버튼(검정)이고, 행의 수정은 보조 버튼이다. */
  variant?: "default" | "secondary";
}) {
  const t = useT();
  return (
    <Button aria-busy={pending} disabled={disabled} type="submit" variant={variant}>
      {pending ? t("calls.expense.action.saving") : idleLabel}
    </Button>
  );
}

function HandlerSelect({
  className = "min-w-44",
  defaultValue,
  disabled,
  handlers,
  label,
  name
}: {
  className?: string;
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
      className={inputFieldClassName({ className })}
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
    <tr className="align-top hover:bg-readonly">
      <td className="border-b border-border px-3 py-2">
        <form action={updateAction} className={`${EXPENSE_INPUT_GRID} min-w-[840px]`} noValidate>
          <input name="dailyExpenseId" type="hidden" value={expense.id} />
          <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
          <input name="expenseDate" type="hidden" value={serviceDate} />
          <label className="grid gap-1">
            <span className="sr-only">{t("calls.expense.field.amount")}</span>
            <input
              className={inputFieldClassName({ className: "w-full" })}
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
              className={inputFieldClassName({ className: "w-full" })}
              defaultValue={expense.description}
              disabled={disabled}
              maxLength={200}
              name="description"
              placeholder={t("calls.expense.field.description")}
              required
            />
            <InlineError field="description" state={updateState} />
          </label>
          <HandlerSelect className="w-full" defaultValue={expense.handledByEmployee.id} disabled={disabled} handlers={handlers} label={t("calls.expense.field.handler")} name="handledByEmployeeId" />
          <ExpenseMethodControl defaultMethod={expense.method} disabled={disabled} error={fieldError(updateState, "method")} hideLabel />
          <label className="grid gap-1">
            <span className="sr-only">{t("calls.expense.field.note")}</span>
            <input
              className={inputFieldClassName({ className: "w-full" })}
              defaultValue={expense.note ?? ""}
              disabled={disabled}
              maxLength={500}
              name="note"
              placeholder={t("calls.expense.field.note")}
            />
            <InlineError field="note" state={updateState} />
          </label>
          <ExpenseSaveButton disabled={disabled} idleLabel={t("calls.expense.action.update")} pending={updatePending} variant="secondary" />
          <div className="col-span-full">
            {updateState?.ok ? <span className="text-xs text-muted">{t("calls.save.saved")}</span> : <InlineError state={updateState} />}
          </div>
        </form>
      </td>
      <td className="border-b border-border px-3 py-2 text-right text-sm font-semibold">{formatNumber(locale, expense.amount)} {t("calls.summary.vndSuffix")}</td>
      <td className="border-b border-border px-3 py-2 text-sm text-muted">{expense.handledByEmployee.displayName}</td>
      <td className="border-b border-border px-3 py-2">
        <form action={deactivateAction} className="grid justify-items-end gap-1">
          <input name="dailyExpenseId" type="hidden" value={expense.id} />
          <Button disabled={disabled} type="submit" variant="secondary">
            {t("calls.expense.action.deactivate")}
          </Button>
          {deactivateState?.ok ? <span className="text-xs text-muted">{t("calls.expense.action.deactivated")}</span> : <InlineError state={deactivateState} />}
        </form>
      </td>
    </tr>
  );
}

function DrawerField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}

/** 지출 추가 서랍의 입력. 저장되면 onAdded로 서랍을 닫고, 목록은 서버가 다시 그린다. */
export function AddExpenseForm({
  handlers,
  operatingMonthId,
  serviceDate,
  onAdded
}: {
  handlers: ServiceCallOption[];
  operatingMonthId: string;
  serviceDate: string;
  onAdded: () => void;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<DailyExpenseActionState, FormData>(async (previous, formData) => {
    const result = await createDailyExpenseAction(previous, formData);
    if (result?.ok) onAdded();
    return result;
  }, null);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
      <input name="expenseDate" type="hidden" value={serviceDate} />
      <DrawerField label={t("calls.expense.field.amount")}>
        <input
          className={inputFieldClassName({ className: "w-full" })}
          disabled={pending}
          min={1}
          name="amount"
          required
          step={1}
          type="number"
        />
        <InlineError field="amount" state={state} />
      </DrawerField>
      <DrawerField label={t("calls.expense.field.description")}>
        <input className={inputFieldClassName({ className: "w-full" })} disabled={pending} maxLength={200} name="description" required />
        <InlineError field="description" state={state} />
      </DrawerField>
      <DrawerField label={t("calls.expense.field.handler")}>
        <HandlerSelect className="w-full" disabled={pending} handlers={handlers} label={t("calls.expense.field.handler")} name="handledByEmployeeId" />
      </DrawerField>
      <ExpenseMethodControl disabled={pending} error={fieldError(state, "method")} />
      <DrawerField label={t("calls.expense.field.note")}>
        <input className={inputFieldClassName({ className: "w-full" })} disabled={pending} maxLength={500} name="note" />
        <InlineError field="note" state={state} />
      </DrawerField>
      <div className="flex flex-wrap items-center gap-3">
        <ExpenseSaveButton disabled={pending} idleLabel={t("calls.expense.action.add")} pending={pending} />
        {state && !state.ok ? <InlineError state={state} /> : null}
      </div>
    </form>
  );
}

/**
 * "하루 수납·지출" 탭 도구줄의 주요 행동(정보구조 9절). 지출 추가를 서랍으로 연다.
 * 이미 있는 지출의 수정과 비활성은 목록의 행 안에서 한다. 잠긴 운영월에서는 열 수 없다.
 */
export function AddExpensePanel({
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
  const [open, setOpen] = useState(false);

  return (
    <ModalPanel
      onOpenChange={setOpen}
      open={open}
      title={t("calls.expense.action.add")}
      trigger={<Button disabled={isLocked}>{t("calls.expense.action.add")}</Button>}
    >
      <AddExpenseForm handlers={handlers} onAdded={() => setOpen(false)} operatingMonthId={operatingMonthId} serviceDate={serviceDate} />
    </ModalPanel>
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
    <section className="overflow-hidden rounded-lg border border-border bg-surface" aria-label={t("calls.expense.aria")}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-foreground">{t("calls.expense.title")}</h2>
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
        <div className="px-4 py-4 text-sm text-muted">{t("calls.expense.empty")}</div>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-readonly text-xs font-semibold text-muted">
              <tr>
                <th className="border-b border-border px-3 py-2 align-bottom">
                  <div>{t("calls.expense.column.input")}</div>
                  <div className={`${EXPENSE_INPUT_GRID} mt-1 min-w-[840px] font-medium`}>
                    <span>{t("calls.expense.field.amount")}</span>
                    <span>{t("calls.expense.field.description")}</span>
                    <span>{t("calls.expense.field.handler")}</span>
                    <span>{t("calls.expense.field.method")}</span>
                    <span>{t("calls.expense.field.note")}</span>
                  </div>
                </th>
                <th className="border-b border-border px-3 py-2 text-right align-bottom">{t("calls.expense.column.displayAmount")}</th>
                <th className="border-b border-border px-3 py-2 align-bottom">{t("calls.expense.column.handler")}</th>
                <th className="border-b border-border px-3 py-2 text-right align-bottom">{t("calls.expense.column.actions")}</th>
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
    </section>
  );
}
