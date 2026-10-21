"use client";

import { ConfirmPayoutButton, ReasonPayoutForm, type PayoutConfirmationActionState } from "@/app/(erp)/settlements/payout-confirmation-form";
import { PanelSection, vnd } from "@/app/(erp)/settlements/settlement-parts";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import type { Translator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import type { PayoutConfirmationDto, PayoutConfirmationEventDto } from "@/modules/settlements/payout-confirmation-service";

/**
 * 지급 확인(ADR 0004, 티켓 30) 현재 상태와 확인/재확인/해제 폼, 이력을 그리는 공용 패널 구역.
 * 티켓 30은 Therapist 직원 패널 안에 이 모양을 직접 그렸고(therapist-settlement-view.tsx), 티켓 31이 운영팀
 * 일일·운영팀 월까지 같은 구역을 공유한다. Therapist도 이 컴포넌트를 사용한다(T8).
 */
const payoutStatusKey: Record<PayoutConfirmationDto["status"], { key: MessageKey; tone: StatusTone }> = {
  unconfirmed: { key: "settlements.payout.status.unconfirmed", tone: "neutral" },
  confirmed: { key: "settlements.payout.status.confirmed", tone: "success" },
  needs_reconfirmation: { key: "settlements.payout.status.needsReconfirmation", tone: "warning" },
  confirmed_amount_unrecorded: { key: "settlements.payout.status.amountUnrecorded", tone: "neutral" }
};

export function PayoutStatusIndicator({ status, t }: { status: PayoutConfirmationDto["status"]; t: Translator }) {
  const mapped = payoutStatusKey[status];
  return <StatusIndicator label={t(mapped.key)} tone={mapped.tone} />;
}

function payoutHistoryEventLabel(t: Translator, eventType: PayoutConfirmationEventDto["eventType"]) {
  if (eventType === "confirm") return t("settlements.payout.history.event.confirm");
  if (eventType === "reconfirm") return t("settlements.payout.history.event.reconfirm");
  return t("settlements.payout.history.event.release");
}

function payoutActorLabel(event: PayoutConfirmationEventDto) {
  const accountId = event.actor?.accountId ?? event.actorAccountId;
  const employeeName = event.actor?.employeeDisplayName;
  return employeeName ? `${accountId} / ${employeeName}` : accountId;
}

function formatBusinessDateTime(locale: Locale, value: string | null) {
  if (!value) return null;
  return formatDateTime(locale, value, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

export type PayoutConfirmationUnit = { operatingMonthId: string; serviceDate: string; employeeId: string };

/**
 * 직원 패널의 지급 확인 구역: 현재 상태·현재 계산 금액·마지막 확인 금액·차이, 확인/재확인/해제 폼, 이력(최대 5건).
 * 단위마다 다른 결과 DTO 타입은 T로 받고, confirm/reconfirm/release 세 서버 액션만 넘기면 된다.
 */
export function PayoutConfirmationPanel<T>({
  title,
  payout,
  unit,
  payoutLocked,
  confirmAction,
  reconfirmAction,
  releaseAction,
  locale,
  t
}: {
  title: string;
  payout: PayoutConfirmationDto;
  unit: PayoutConfirmationUnit;
  /** 잠긴(마감확정·잠금) 운영월에서는 폼을 보이지 않는다. */
  payoutLocked: boolean;
  confirmAction: (state: PayoutConfirmationActionState<T>, formData: FormData) => Promise<PayoutConfirmationActionState<T>>;
  reconfirmAction: (state: PayoutConfirmationActionState<T>, formData: FormData) => Promise<PayoutConfirmationActionState<T>>;
  releaseAction: (state: PayoutConfirmationActionState<T>, formData: FormData) => Promise<PayoutConfirmationActionState<T>>;
  locale: Locale;
  t: Translator;
}) {
  // 미확인일 때만 "확인"을 쓸 수 있다. 그 밖(확인됨/지급 재확인 필요/확인 금액 미기록)은 재확인·해제를 쓸 수 있다.
  const hasActiveConfirmation = payout.status !== "unconfirmed";

  return (
    <PanelSection title={title}>
      <div className="grid gap-1 text-sm text-muted">
        <div>
          <PayoutStatusIndicator status={payout.status} t={t} />
        </div>
        <div>
          {t("settlements.payout.currentAmount")}: {vnd(locale, payout.currentAmount)}
        </div>
        {payout.lastConfirmedAmount !== null ? (
          <div>
            {t("settlements.payout.lastConfirmedAmount")}: {vnd(locale, payout.lastConfirmedAmount)}
          </div>
        ) : null}
        {payout.difference !== null && payout.difference !== 0 ? (
          <div>
            {t("settlements.payout.difference")}: {vnd(locale, payout.difference)}
          </div>
        ) : null}
      </div>

      {payoutLocked ? null : hasActiveConfirmation ? (
        <div className="grid gap-3">
          <ReasonPayoutForm
            action={reconfirmAction}
            pendingLabel={t("settlements.payout.action.reconfirming")}
            placeholder={t("settlements.payout.reason.reconfirmPlaceholder")}
            submitLabel={t("settlements.payout.action.reconfirm")}
            {...unit}
          />
          <ReasonPayoutForm
            action={releaseAction}
            pendingLabel={t("settlements.payout.action.releasing")}
            placeholder={t("settlements.payout.reason.releasePlaceholder")}
            submitLabel={t("settlements.payout.action.release")}
            {...unit}
          />
        </div>
      ) : (
        <ConfirmPayoutButton action={confirmAction} {...unit} />
      )}

      {payout.history.length > 0 ? (
        <div className="border-l border-border pl-3 text-sm text-muted">
          <div className="font-semibold text-foreground">{t("settlements.payout.history.title", { count: payout.history.length })}</div>
          <ol className="mt-1 grid gap-2">
            {payout.history.slice(0, 5).map((event) => (
              <li key={event.id}>
                <div>
                  {payoutHistoryEventLabel(t, event.eventType)} ·{" "}
                  {event.amount !== null ? vnd(locale, event.amount) : t("settlements.payout.history.amount.unrecorded")}
                </div>
                <div>{formatBusinessDateTime(locale, event.occurredAt)}</div>
                <div>{t("settlements.payout.handler", { actor: payoutActorLabel(event) })}</div>
                {event.reason ? <div>{event.reason}</div> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </PanelSection>
  );
}
