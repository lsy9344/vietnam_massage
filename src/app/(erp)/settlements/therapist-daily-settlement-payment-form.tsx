"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
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
    <form action={formAction} className="grid justify-items-start gap-1.5">
      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
      <input name="serviceDate" type="hidden" value={serviceDate} />
      <input name="employeeId" type="hidden" value={employeeId} />
      <input name="isPaid" type="hidden" value={isPaid ? "false" : "true"} />
      <Button aria-describedby={formError ? errorId : undefined} disabled={pending} type="submit" variant="secondary">
        {pending ? t("settlements.therapist.payment.processing") : isPaid ? t("settlements.therapist.payment.cancel") : t("settlements.therapist.payment.markPaid")}
      </Button>
      {formError ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}
    </form>
  );
}
