"use client";

import { useActionState, useId } from "react";
import { useT } from "@/lib/i18n/client";
import {
  setTherapistDailySettlementPaymentAction,
  type TherapistDailySettlementPaymentActionState
} from "@/app/(erp)/settlements/actions";

type TherapistDailySettlementPaymentFormProps = {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  isPaid: boolean;
};

export function TherapistDailySettlementPaymentForm({
  operatingMonthId,
  serviceDate,
  employeeId,
  isPaid
}: TherapistDailySettlementPaymentFormProps) {
  const t = useT();
  const errorId = useId();
  const [state, formAction, pending] = useActionState<TherapistDailySettlementPaymentActionState, FormData>(
    setTherapistDailySettlementPaymentAction,
    null
  );
  const formError = state && !state.ok ? state.formError ?? t("settlements.therapist.payment.error") : null;

  return (
    <form action={formAction} className="mt-2">
      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
      <input name="serviceDate" type="hidden" value={serviceDate} />
      <input name="employeeId" type="hidden" value={employeeId} />
      <input name="isPaid" type="hidden" value={isPaid ? "false" : "true"} />
      <button
        aria-describedby={formError ? errorId : undefined}
        className="h-8 border border-border bg-background px-2 text-xs font-semibold text-foreground hover:bg-readonly disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? t("settlements.therapist.payment.processing") : isPaid ? t("settlements.therapist.payment.cancel") : t("settlements.therapist.payment.markPaid")}
      </button>
      {formError ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
          {formError}
        </p>
      ) : null}
    </form>
  );
}
