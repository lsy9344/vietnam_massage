"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import type { ActionResult } from "@/lib/action-result";

/**
 * 지급 확인(ADR 0004, 티켓 30) 사건을 쓰는 세 작은 폼: 확인, 재확인, 해제. 재확인과 해제는 사유가 필수다.
 * 네 단위(Therapist·귀케어·운영팀 일일·운영팀 월, 티켓 30·31)가 같은 모양의 action state를 쓰므로(결과 DTO만 다르다)
 * T로 그 결과 DTO 타입을 받아 직원 패널 어디서나 재사용한다. 폼은 state.ok/formError만 보고 state.data는 쓰지 않는다.
 */
export type PayoutConfirmationActionState<T> = ActionResult<T> | null;
type PayoutConfirmationFormAction<T> = (state: PayoutConfirmationActionState<T>, formData: FormData) => Promise<PayoutConfirmationActionState<T>>;

type PayoutUnitFields = { operatingMonthId: string; serviceDate: string; employeeId: string };

function UnitHiddenFields({ operatingMonthId, serviceDate, employeeId }: PayoutUnitFields) {
  return (
    <>
      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
      <input name="serviceDate" type="hidden" value={serviceDate} />
      <input name="employeeId" type="hidden" value={employeeId} />
    </>
  );
}

/** 확인: 사유 없이 바로 쓴다. 이미 확인된 단위에는 보이지 않는다(호출하는 쪽에서 상태로 가린다). */
export function ConfirmPayoutButton<T>({ action, ...unit }: PayoutUnitFields & { action: PayoutConfirmationFormAction<T> }) {
  const t = useT();
  const errorId = useId();
  const [state, formAction, pending] = useActionState<PayoutConfirmationActionState<T>, FormData>(action, null);
  const formError = state && !state.ok ? state.formError ?? t("settlements.payout.error.generic") : null;

  return (
    <form action={formAction} className="grid justify-items-start gap-1.5">
      <UnitHiddenFields {...unit} />
      <Button aria-describedby={formError ? errorId : undefined} disabled={pending} type="submit" variant="secondary">
        {pending ? t("settlements.payout.action.confirming") : t("settlements.payout.action.confirm")}
      </Button>
      {formError ? (
        <p className="text-sm text-danger" id={errorId} role="alert">
          {formError}
        </p>
      ) : null}
    </form>
  );
}

/** 재확인/해제 공용: 사유 입력이 필수다. */
export function ReasonPayoutForm<T>({
  action,
  submitLabel,
  pendingLabel,
  placeholder,
  ...unit
}: PayoutUnitFields & {
  action: PayoutConfirmationFormAction<T>;
  submitLabel: string;
  pendingLabel: string;
  placeholder: string;
}) {
  const t = useT();
  const errorId = useId();
  const reasonId = useId();
  const reasonErrorId = useId();
  const [state, formAction, pending] = useActionState<PayoutConfirmationActionState<T>, FormData>(action, null);
  const formError = state && !state.ok ? state.formError ?? t("settlements.payout.error.generic") : null;

  return (
    <form action={formAction} className="grid gap-1.5">
      <UnitHiddenFields {...unit} />
      <label className="text-sm font-semibold text-foreground" htmlFor={reasonId}>
        {t("settlements.payout.reason.label")}
      </label>
      <textarea
        aria-describedby={formError ? errorId : reasonErrorId}
        className="min-h-20 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
        disabled={pending}
        id={reasonId}
        name="reason"
        placeholder={placeholder}
      />
      <Button aria-describedby={formError ? errorId : undefined} disabled={pending} type="submit" variant="secondary">
        {pending ? pendingLabel : submitLabel}
      </Button>
      {formError ? (
        <p className="text-sm text-danger" id={errorId} role="alert">
          {formError}
        </p>
      ) : (
        <p className="text-xs text-muted" id={reasonErrorId}>
          {t("settlements.payout.reason.required")}
        </p>
      )}
    </form>
  );
}
