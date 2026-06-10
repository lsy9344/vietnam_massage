"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { DailyExpenseDto, ServiceCallOption } from "@/modules/calls/service-call-service";
import {
  createDailyExpenseAction,
  deactivateDailyExpenseAction,
  updateDailyExpenseAction,
  type DailyExpenseActionState
} from "@/app/(erp)/calls/actions";

function formatVnd(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

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
  return (
    <select
      aria-label={label}
      className="h-8 min-w-44 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
      defaultValue={defaultValue ?? ""}
      disabled={disabled}
      name={name}
      required
    >
      <option value="">담당자</option>
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
            <span className="sr-only">지출금액</span>
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
            <span className="sr-only">내용</span>
            <input
              className="h-8 w-48 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
              defaultValue={expense.description}
              disabled={disabled}
              maxLength={200}
              name="description"
              placeholder="내용"
              required
            />
            <InlineError field="description" state={updateState} />
          </label>
          <HandlerSelect defaultValue={expense.handledByEmployee.id} disabled={disabled} handlers={handlers} label="지출 담당자" name="handledByEmployeeId" />
          <label className="grid gap-1">
            <span className="sr-only">비고</span>
            <input
              className="h-8 w-48 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
              defaultValue={expense.note ?? ""}
              disabled={disabled}
              maxLength={500}
              name="note"
              placeholder="비고"
            />
            <InlineError field="note" state={updateState} />
          </label>
          <Button className="h-8 px-2 text-xs" disabled={disabled} type="submit">
            수정
          </Button>
          {updateState?.ok ? <span className="self-center text-xs text-muted">저장됨</span> : <InlineError state={updateState} />}
        </form>
      </td>
      <td className="border-b border-border px-2 py-2 text-right text-xs [font-variant-numeric:tabular-nums]">{formatVnd(expense.amount)} VND</td>
      <td className="border-b border-border px-2 py-2 text-xs text-muted">{expense.handledByEmployee.displayName}</td>
      <td className="border-b border-border px-2 py-2">
        <form action={deactivateAction} className="grid justify-items-end gap-1">
          <input name="dailyExpenseId" type="hidden" value={expense.id} />
          <Button className="h-8 px-2 text-xs" disabled={disabled} type="submit" variant="secondary">
            비활성
          </Button>
          {deactivateState?.ok ? <span className="text-xs text-muted">비활성됨</span> : <InlineError state={deactivateState} />}
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
  const [state, formAction, pending] = useActionState<DailyExpenseActionState, FormData>(createDailyExpenseAction, null);
  const disabled = isLocked || pending;

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2 border-t border-border px-3 py-3" noValidate>
      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
      <input name="expenseDate" type="hidden" value={serviceDate} />
      <label className="grid gap-1">
        <span className="sr-only">지출금액</span>
        <input
          className="h-8 w-32 border border-border bg-background px-2 text-xs text-foreground outline-none [font-variant-numeric:tabular-nums] focus:border-brand disabled:bg-readonly"
          disabled={disabled}
          min={1}
          name="amount"
          placeholder="금액"
          required
          step={1}
          type="number"
        />
        <InlineError field="amount" state={state} />
      </label>
      <label className="grid gap-1">
        <span className="sr-only">내용</span>
        <input
          className="h-8 w-56 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
          disabled={disabled}
          maxLength={200}
          name="description"
          placeholder="내용"
          required
        />
        <InlineError field="description" state={state} />
      </label>
      <HandlerSelect disabled={disabled} handlers={handlers} label="지출 담당자" name="handledByEmployeeId" />
      <label className="grid gap-1">
        <span className="sr-only">비고</span>
        <input
          className="h-8 w-56 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
          disabled={disabled}
          maxLength={500}
          name="note"
          placeholder="비고"
        />
        <InlineError field="note" state={state} />
      </label>
      <Button className="h-8 px-2 text-xs" disabled={disabled} type="submit">
        지출 추가
      </Button>
      {state?.ok ? <span className="self-center text-xs text-muted">저장됨</span> : <InlineError state={state} />}
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
  return (
    <section className="mb-4 border border-border bg-surface" aria-label="일별 지출">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">일별 지출</h2>
          {isLocked ? (
            <div className="mt-1 text-xs text-danger">
              <p className="font-medium">잠긴 운영월입니다.</p>
              <p>마감확정 또는 잠금 운영월입니다. 지출 입력과 수정이 차단됩니다.</p>
            </div>
          ) : null}
        </div>
        <span className="text-xs text-muted">{expenses.length}개 항목</span>
      </div>
      {expenses.length === 0 ? (
        <div className="px-3 py-4 text-sm text-muted">이 날짜에 등록된 지출이 없습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-readonly text-xs font-semibold text-foreground">
              <tr>
                <th className="border-b border-border px-2 py-2">입력</th>
                <th className="border-b border-border px-2 py-2 text-right">표시금액</th>
                <th className="border-b border-border px-2 py-2">담당자</th>
                <th className="border-b border-border px-2 py-2 text-right">처리</th>
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
