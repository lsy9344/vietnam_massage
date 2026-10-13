"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import type { CustomerDto } from "@/modules/calls/service-call-service";
import { createCustomerAction, updateCustomerAction, type CustomerActionState } from "@/app/(erp)/calls/actions";

const fieldClassName =
  "h-11 w-full border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand";
const cellClassName = "border-b border-border px-2 py-2 align-top";

function fieldError(state: CustomerActionState, field: string) {
  if (!state || state.ok) {
    return null;
  }
  return state.fieldErrors?.[field]?.[0] ?? null;
}

function InlineError({ state, field }: { state: CustomerActionState; field?: string }) {
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

// 한 고객의 입력 칸들. 입력은 각 칸(td)에 있고 form 속성으로 같은 행의 form에 묶인다.
function CustomerFieldCells({
  customer,
  form,
  state
}: {
  customer?: CustomerDto;
  form: string;
  state: CustomerActionState;
}) {
  const t = useT();
  return (
    <>
      <td className={cellClassName}>
        <label className="grid gap-1">
          <span className="sr-only">{t("calls.customer.field.name")}</span>
          <input className={fieldClassName} defaultValue={customer?.name ?? ""} form={form} maxLength={200} name="name" required />
          <InlineError field="name" state={state} />
        </label>
      </td>
      <td className={cellClassName}>
        <label className="grid gap-1">
          <span className="sr-only">{t("calls.customer.field.phone")}</span>
          <input
            className={`${fieldClassName} [font-variant-numeric:tabular-nums]`}
            defaultValue={customer?.phone ?? ""}
            form={form}
            inputMode="tel"
            maxLength={500}
            name="phone"
          />
          <InlineError field="phone" state={state} />
        </label>
      </td>
      <td className={cellClassName}>
        <label className="grid gap-1">
          <span className="sr-only">{t("calls.customer.field.memo")}</span>
          <input className={fieldClassName} defaultValue={customer?.memo ?? ""} form={form} maxLength={500} name="memo" />
          <InlineError field="memo" state={state} />
        </label>
      </td>
    </>
  );
}

function SubmitCell({
  action,
  children,
  form,
  label,
  pending,
  state,
  variant
}: {
  action: (formData: FormData) => void;
  children?: ReactNode;
  form: string;
  label: string;
  pending: boolean;
  state: CustomerActionState;
  variant: "default" | "secondary";
}) {
  const t = useT();
  return (
    <td className={`${cellClassName} text-right`}>
      <form action={action} id={form} noValidate>
        {children}
        <Button aria-busy={pending} className="h-11 whitespace-nowrap px-3 text-sm" disabled={pending} type="submit" variant={variant}>
          {label}
        </Button>
      </form>
      <div className="mt-1">
        {state?.ok ? (
          <span className="text-xs text-muted" role="status">
            {t("calls.save.saved")}
          </span>
        ) : (
          <InlineError state={state} />
        )}
      </div>
    </td>
  );
}

function CustomerEditRow({ customer }: { customer: CustomerDto }) {
  const t = useT();
  const formId = `customer-${customer.id}`;
  const [state, action, pending] = useActionState<CustomerActionState, FormData>(updateCustomerAction, null);

  return (
    <tr>
      <CustomerFieldCells customer={customer} form={formId} state={state} />
      <SubmitCell action={action} form={formId} label={t("calls.customer.action.update")} pending={pending} state={state} variant="secondary">
        <input name="customerId" type="hidden" value={customer.id} />
      </SubmitCell>
    </tr>
  );
}

function CreateCustomerRow() {
  const t = useT();
  const formId = "customer-new";
  const [state, action, pending] = useActionState<CustomerActionState, FormData>(createCustomerAction, null);

  return (
    <tr className="bg-readonly/40">
      <CustomerFieldCells form={formId} state={state} />
      <SubmitCell action={action} form={formId} label={t("calls.customer.action.create")} pending={pending} state={state} variant="default" />
    </tr>
  );
}

export function CustomerPanel({ customers }: { customers: CustomerDto[] }) {
  const t = useT();
  const headClassName = "sticky top-0 z-10 border-b border-border bg-readonly px-2 py-2 font-semibold";

  return (
    <section aria-label={t("calls.customer.title")} className="mb-4 border border-border bg-surface">
      {/* 고객 관리는 가끔 쓰는 일이라 접어 둔다. 내용은 그대로 그려져 있어 펼치면 바로 보인다. */}
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-readonly/50 motion-safe:transition-colors motion-safe:duration-200 motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="size-4 text-muted group-open:rotate-90"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 className="text-base font-semibold text-foreground">{t("calls.customer.title")}</h2>
          </span>
          <span className="text-xs text-muted">{t("calls.customer.count", { count: customers.length })}</span>
        </summary>
        <div className="border-t border-border">
          <p className="px-4 py-2 text-xs text-muted">{t("calls.customer.description")}</p>
          <div className="relative max-h-[30rem] overflow-auto border-t border-border">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-[14rem]" />
                <col className="w-[12rem]" />
                <col />
                <col className="w-[8.5rem]" />
              </colgroup>
              <thead className="text-xs text-foreground">
                <tr>
                  <th className={headClassName} scope="col">{t("calls.customer.field.name")}</th>
                  <th className={headClassName} scope="col">{t("calls.customer.field.phone")}</th>
                  <th className={headClassName} scope="col">{t("calls.customer.field.memo")}</th>
                  <th className={headClassName} scope="col">
                    <span className="sr-only">{t("calls.expense.column.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <CreateCustomerRow key={customers.length} />
                {customers.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-sm text-muted" colSpan={4}>
                      {t("calls.customer.empty")}
                    </td>
                  </tr>
                ) : null}
                {customers.map((customer) => (
                  <CustomerEditRow
                    customer={customer}
                    key={`${customer.id}:${customer.name}:${customer.phone ?? ""}:${customer.memo ?? ""}`}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </section>
  );
}
