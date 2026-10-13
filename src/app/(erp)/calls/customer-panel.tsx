"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import type { CustomerDto } from "@/modules/calls/service-call-service";
import { createCustomerAction, updateCustomerAction, type CustomerActionState } from "@/app/(erp)/calls/actions";

const fieldClassName =
  "h-11 min-w-36 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand";

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

function CustomerFields({
  defaultMemo,
  defaultName,
  defaultPhone,
  state
}: {
  defaultMemo?: string | null;
  defaultName?: string;
  defaultPhone?: string | null;
  state: CustomerActionState;
}) {
  const t = useT();
  return (
    <>
      <label className="grid gap-1">
        <span className="text-xs font-medium text-muted">{t("calls.customer.field.name")}</span>
        <input className={fieldClassName} defaultValue={defaultName ?? ""} maxLength={200} name="name" required />
        <InlineError field="name" state={state} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs font-medium text-muted">{t("calls.customer.field.phone")}</span>
        <input className={fieldClassName} defaultValue={defaultPhone ?? ""} maxLength={500} name="phone" />
        <InlineError field="phone" state={state} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs font-medium text-muted">{t("calls.customer.field.memo")}</span>
        <input className={fieldClassName} defaultValue={defaultMemo ?? ""} maxLength={500} name="memo" />
        <InlineError field="memo" state={state} />
      </label>
    </>
  );
}

function CustomerEditForm({ customer }: { customer: CustomerDto }) {
  const t = useT();
  const [state, action, pending] = useActionState<CustomerActionState, FormData>(updateCustomerAction, null);

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-2 border-b border-border px-3 py-3"
      noValidate
    >
      <input name="customerId" type="hidden" value={customer.id} />
      <CustomerFields defaultMemo={customer.memo} defaultName={customer.name} defaultPhone={customer.phone} state={state} />
      <Button className="h-11 px-3 text-sm" disabled={pending} type="submit">
        {t("calls.customer.action.update")}
      </Button>
      {state?.ok ? <span className="self-center text-xs text-muted">{t("calls.save.saved")}</span> : <InlineError state={state} />}
    </form>
  );
}

function CreateCustomerForm() {
  const t = useT();
  const [state, action, pending] = useActionState<CustomerActionState, FormData>(createCustomerAction, null);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 px-3 py-3" noValidate>
      <CustomerFields state={state} />
      <Button className="h-11 px-3 text-sm" disabled={pending} type="submit">
        {t("calls.customer.action.create")}
      </Button>
      {state?.ok ? <span className="self-center text-xs text-muted">{t("calls.save.saved")}</span> : <InlineError state={state} />}
    </form>
  );
}

export function CustomerPanel({ customers }: { customers: CustomerDto[] }) {
  const t = useT();

  return (
    <section aria-label={t("calls.customer.title")} className="mb-4 border border-border bg-surface">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">{t("calls.customer.title")}</h2>
          <span className="text-xs text-muted">{t("calls.customer.count", { count: customers.length })}</span>
        </div>
        <p className="mt-1 text-xs text-muted">{t("calls.customer.description")}</p>
      </div>
      {customers.length === 0 ? <div className="px-3 py-4 text-sm text-muted">{t("calls.customer.empty")}</div> : null}
      {customers.map((customer) => (
        <CustomerEditForm
          customer={customer}
          key={`${customer.id}:${customer.name}:${customer.phone ?? ""}:${customer.memo ?? ""}`}
        />
      ))}
      <CreateCustomerForm key={customers.length} />
    </section>
  );
}
