"use client";

import { useActionState, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ModalPanel } from "@/components/ui/panel";
import { useT } from "@/lib/i18n/client";
import type { CustomerDto } from "@/modules/calls/service-call-service";
import { createCustomerAction, updateCustomerAction, type CustomerActionState } from "@/app/(erp)/calls/actions";
import { customerScreenHref } from "@/app/(erp)/customers/customer-search";

function fieldError(state: CustomerActionState, field: string) {
  if (!state || state.ok) {
    return null;
  }
  return state.fieldErrors?.[field]?.[0] ?? null;
}

function FormResult({ state }: { state: CustomerActionState }) {
  const t = useT();
  if (state?.ok) {
    return <span className="text-sm text-muted">{t("calls.save.saved")}</span>;
  }
  return state?.formError ? (
    <span className="text-sm text-danger" role="alert">
      {state.formError}
    </span>
  ) : null;
}

function CustomerField({
  defaultValue,
  label,
  maxLength,
  multiline,
  name,
  required,
  state
}: {
  defaultValue?: string | null;
  label: string;
  maxLength: number;
  multiline?: boolean;
  name: "name" | "phone" | "memo" | "preferenceNote";
  required?: boolean;
  state: CustomerActionState;
}) {
  const errorId = useId();
  const error = fieldError(state, name);
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {multiline ? (
        <textarea
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={inputFieldClassName({ invalid: Boolean(error), className: "h-24 w-full py-2" })}
          defaultValue={defaultValue ?? ""}
          maxLength={maxLength}
          name={name}
          required={required}
        />
      ) : (
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={inputFieldClassName({ invalid: Boolean(error), className: "w-full" })}
          defaultValue={defaultValue ?? ""}
          maxLength={maxLength}
          name={name}
          required={required}
        />
      )}
      {error ? (
        <span className="text-sm text-danger" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function CustomerFields({ customer, state }: { customer?: CustomerDto; state: CustomerActionState }) {
  const t = useT();
  return (
    <>
      <CustomerField defaultValue={customer?.name} label={t("calls.customer.field.name")} maxLength={200} name="name" required state={state} />
      <CustomerField defaultValue={customer?.phone} label={t("calls.customer.field.phone")} maxLength={500} name="phone" state={state} />
      <CustomerField defaultValue={customer?.memo} label={t("calls.customer.field.memo")} maxLength={500} name="memo" state={state} />
      {/* 고객 공통 선호·주의사항(F06, 티켓 23). 위 메모(memo)와는 다른 칸이라 나란히 두되 하나로 합치지 않는다. */}
      <CustomerField
        defaultValue={customer?.preferenceNote}
        label={t("calls.customer.field.preferenceNote")}
        maxLength={500}
        multiline
        name="preferenceNote"
        state={state}
      />
    </>
  );
}

/** 고른 고객의 정정. 과거 콜의 고객/메모는 바꾸지 않는다(명세: 고객 프로필 수정). */
export function CustomerEditForm({ customer }: { customer: CustomerDto }) {
  const t = useT();
  const [state, action, pending] = useActionState<CustomerActionState, FormData>(updateCustomerAction, null);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input name="customerId" type="hidden" value={customer.id} />
      <CustomerFields customer={customer} state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} type="submit">
          {t("calls.customer.action.update")}
        </Button>
        <FormResult state={state} />
      </div>
    </form>
  );
}

function CreateCustomerForm({ onCreated }: { onCreated: (customer: CustomerDto) => void }) {
  const t = useT();
  const [state, action, pending] = useActionState<CustomerActionState, FormData>(async (previous, formData) => {
    const result = await createCustomerAction(previous, formData);
    if (result?.ok) onCreated(result.data);
    return result;
  }, null);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <CustomerFields state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} type="submit">
          {t("customers.create.action")}
        </Button>
        <FormResult state={state} />
      </div>
    </form>
  );
}

/** 고객 화면 도구줄의 주요 행동. 등록한 고객을 바로 골라 패널에 연다. */
export function CreateCustomerPanel() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <ModalPanel
      description={t("calls.customer.description")}
      onOpenChange={setOpen}
      open={open}
      title={t("customers.create.action")}
      trigger={<Button>{t("customers.create.action")}</Button>}
    >
      <CreateCustomerForm
        onCreated={(customer) => {
          setOpen(false);
          router.replace(customerScreenHref({ customerQuery: customer.name, visitCustomer: customer.id }), { scroll: false });
        }}
      />
    </ModalPanel>
  );
}
