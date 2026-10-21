"use client";

import { useActionState, useEffect, useRef, useState, type MouseEvent } from "react";
import { useT, useLocale } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n";
import { formatCurrencyVnd } from "@/lib/i18n/format";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import {
  confirmMonthlyCloseAction,
  lockMonthlyCloseAction,
  reopenMonthlyCloseAction,
  startMonthlyCloseReviewAction,
  type ConfirmMonthlyCloseActionState,
  type MonthlyClosingActionState
} from "@/app/(erp)/closing/actions";
import type { MonthlyClosingChecklistCallDto } from "@/modules/closing/monthly-closing-checklist-service";
import { EvidenceCallItem, EvidenceCallList } from "@/app/(erp)/settlements/settlement-parts";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { StatusIndicator } from "@/components/ui/status-indicator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

const CONFIRM_MONTHLY_CLOSE_FORM_ID = "confirm-monthly-close-form";

export type ConfirmDialogSummary = {
  monthKey: string;
  startDate: string;
  endDate: string;
  status: string;
  grandPayoutAmount: number;
  therapistPayoutAmount: number;
  therapistCount: number;
  operationsPayoutAmount: number;
  operationsCount: number;
  opsDailyIncentiveAmount: number;
  opsMonthlyIncentiveAmount: number;
  warningCount: number;
};

function formatVnd(locale: Locale, t: Translator, amount: number) {
  return `${formatCurrencyVnd(locale, amount)} ${t("settlements.vndSuffix")}`;
}

function InlineResult({ t, state }: { t: Translator; state: MonthlyClosingActionState | ConfirmMonthlyCloseActionState }) {
  if (!state) return null;

  if (state.ok) {
    return (
      <p className="text-sm font-medium text-success" role="status">
        {t("closing.action.processed")}
      </p>
    );
  }

  return (
    <p className="text-sm font-medium text-danger" role="alert">
      {state.formError ?? t("closing.action.failed")}
    </p>
  );
}

function disabledReason(t: Translator, status: string, canWrite: boolean, hasConfirmSummary: boolean, checklistBlocked: boolean) {
  if (!canWrite) return t("closing.disabled.noPermission");
  if (status === "검토중" && !hasConfirmSummary) return t("closing.disabled.needPreview");
  if (status === "검토중" && checklistBlocked) return t("closing.checklist.blockedNotice");
  if (status === "작성중" || status === "검토중") return t("closing.disabled.needConfirmFirst");
  if (status === "잠금") return t("closing.disabled.locked");
  return t("closing.disabled.noAction");
}

function ReopenFieldError({ state }: { state: MonthlyClosingActionState }) {
  if (!state || state.ok || !state.fieldErrors?.reason?.[0]) return null;

  return (
    <p className="text-sm font-medium text-danger" id="reopen-reason-error" role="alert">
      {state.fieldErrors.reason[0]}
    </p>
  );
}

export function ClosingActionPanel({
  operatingMonthId,
  status,
  canWrite,
  canReopen,
  confirmSummary,
  checklistBlocked,
  pendingCloseCalls,
  canOpenLedger
}: {
  operatingMonthId: string;
  status: string;
  canWrite: boolean;
  canReopen: boolean;
  confirmSummary: ConfirmDialogSummary | null;
  /** F07: 마감 전 점검에 계산 오류나 지급 재확인 미처리가 남아 있으면 확정을 막는다(서버가 다시 검사). */
  checklistBlocked: boolean;
  /** F07/ADR 0005(티켓 34): 예약·사용중·청소중 콜. 확정 다이얼로그에서 확인·사유를 받는다. */
  pendingCloseCalls: MonthlyClosingChecklistCallDto[];
  /** 점검 항목에서 원본으로 가는 동작은 역할을 따른다(관리자만 원장 링크). */
  canOpenLedger: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [reviewState, reviewAction, reviewPending] = useActionState<MonthlyClosingActionState, FormData>(startMonthlyCloseReviewAction, null);
  const [confirmState, confirmAction, confirmPending] = useActionState<ConfirmMonthlyCloseActionState, FormData>(confirmMonthlyCloseAction, null);
  const [lockState, lockAction, lockPending] = useActionState<MonthlyClosingActionState, FormData>(lockMonthlyCloseAction, null);
  const [reopenState, reopenAction, reopenPending] = useActionState<MonthlyClosingActionState, FormData>(reopenMonthlyCloseAction, null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [displayedPendingCloseCalls, setDisplayedPendingCloseCalls] = useState(pendingCloseCalls);
  const [pendingCloseAcknowledged, setPendingCloseAcknowledged] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const canStartReview = canWrite && status === "작성중";
  const canConfirm = canWrite && status === "검토중" && Boolean(confirmSummary) && !checklistBlocked;
  const canLock = canWrite && status === "마감확정";
  const reason = disabledReason(t, status, canWrite, Boolean(confirmSummary), checklistBlocked);
  // F07/ADR 0005(티켓 34): 마감 확인 대상 콜이 있으면 전부 확인하고 사유를 적어야 확정 제출을 할 수 있다.
  // 서버가 트랜잭션 안에서 다시 검사하므로 이 비활성화는 안내일 뿐이다.
  const pendingCloseRequiresException = displayedPendingCloseCalls.length > 0;
  const pendingCloseReady = !pendingCloseRequiresException || (pendingCloseAcknowledged && exceptionReason.trim().length > 0);
  const reasonHasError = Boolean(reopenState && !reopenState.ok && reopenState.fieldErrors?.reason?.[0]);

  useEffect(() => {
    if (confirmState?.ok) {
      setConfirmDialogOpen(false);
      return;
    }
    // F07/ADR 0005(티켓 34): 확인한 목록 이후 새 대상이 생겨 거절되면, 서버가 돌려준 지금의 목록으로
    // 다이얼로그를 갱신하고 확인 체크를 다시 받는다(다이얼로그는 열어 둔다).
    // domainErrorCode는 두 분기 모두 string으로 넓어 narrowing이 안 되므로, 실제 들고 있는 필드로 가린다.
    if (confirmState && !confirmState.ok && "currentPendingCloseCalls" in confirmState) {
      setDisplayedPendingCloseCalls(confirmState.currentPendingCloseCalls);
      setPendingCloseAcknowledged(false);
    }
  }, [confirmState]);

  function handleConfirmDialogOpenChange(open: boolean) {
    if (open) {
      setDisplayedPendingCloseCalls(pendingCloseCalls);
      setPendingCloseAcknowledged(false);
      setExceptionReason("");
    }
    setConfirmDialogOpen(open);
  }

  return (
    <section className="mb-4 border border-border bg-surface px-4 py-3" aria-label={t("closing.actionPanel.aria")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("closing.actionPanel.title")}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("closing.actionPanel.description")}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <form action={reviewAction} className="grid gap-1">
            <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
            <Button
              variant="secondary"
              disabled={!canStartReview || reviewPending}
              type="submit"
            >
              {reviewPending ? t("closing.action.processing") : t("closing.action.startReview")}
            </Button>
            <InlineResult t={t} state={reviewState} />
          </form>
          <div className="grid gap-1">
            {/* Story 5.6: first click opens this AlertDialog; only the second confirmation submits the server action. */}
            <AlertDialog open={confirmDialogOpen} onOpenChange={handleConfirmDialogOpenChange}>
              <AlertDialogTrigger asChild>
                <Button

                  disabled={!canConfirm || confirmPending}
                  type="button"
                >
                  {confirmPending ? t("closing.action.confirming") : t("closing.action.confirm")}
                </Button>
              </AlertDialogTrigger>
              {confirmSummary ? (
                <AlertDialogContent
                  onOpenAutoFocus={(event: Event) => {
                    event.preventDefault();
                    confirmCancelRef.current?.focus();
                  }}
                >
                  <AlertDialogCancel
                    aria-label={t("closing.action.close")}
                    className="absolute right-3 top-3 size-11 justify-center px-0 text-base leading-none"
                    disabled={confirmPending}
                  >
                    ×
                  </AlertDialogCancel>
                  <AlertDialogHeader>
                    <AlertDialogTitle tabIndex={-1}>{t("closing.confirmDialog.title", { monthKey: confirmSummary.monthKey })}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("closing.confirmDialog.description")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="grid gap-3">
                    <div className="border border-border bg-background px-3 py-2">
                      <div className="text-xs font-medium text-muted">{t("closing.confirmDialog.operatingMonth")}</div>
                      <div className="mt-1 text-sm font-semibold text-foreground">
                        {confirmSummary.monthKey} / {confirmSummary.startDate} ~ {confirmSummary.endDate} / {operatingMonthStatusLabel(locale, confirmSummary.status)}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="border border-border bg-background px-3 py-2">
                        <div className="text-xs text-muted">{t("closing.confirmDialog.grandPayout")}</div>
                        <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">{formatVnd(locale, t, confirmSummary.grandPayoutAmount)}</div>
                      </div>
                      <div className="border border-border bg-background px-3 py-2">
                        <div className="text-xs text-muted">{t("closing.confirmDialog.warning")}</div>
                        <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">{confirmSummary.warningCount}{t("settlements.countSuffix")}</div>
                      </div>
                    </div>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div className="border border-border bg-background px-3 py-2">
                        <dt className="text-xs text-muted">{t("closing.confirmDialog.therapist")}</dt>
                        <dd className="mt-1 font-semibold tabular-nums">{formatVnd(locale, t, confirmSummary.therapistPayoutAmount)}</dd>
                        <dd className="mt-1 text-xs text-muted">{confirmSummary.therapistCount}{t("settlements.peopleSuffix")}</dd>
                      </div>
                      <div className="border border-border bg-background px-3 py-2">
                        <dt className="text-xs text-muted">{t("closing.confirmDialog.operations")}</dt>
                        <dd className="mt-1 font-semibold tabular-nums">{formatVnd(locale, t, confirmSummary.operationsPayoutAmount)}</dd>
                        <dd className="mt-1 text-xs text-muted">
                          {t("closing.confirmDialog.opsDetail", {
                            count: confirmSummary.operationsCount,
                            daily: formatVnd(locale, t, confirmSummary.opsDailyIncentiveAmount),
                            monthly: formatVnd(locale, t, confirmSummary.opsMonthlyIncentiveAmount)
                          })}
                        </dd>
                      </div>
                    </dl>
                    {pendingCloseRequiresException ? (
                      <div className="grid gap-2 border border-border bg-background px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">{t("closing.confirmDialog.pendingCloseCalls.title")}</span>
                          <StatusIndicator
                            label={t("closing.checklist.pendingCloseCalls.count", { count: displayedPendingCloseCalls.length })}
                            tone="warning"
                          />
                        </div>
                        <p className="text-sm text-muted">{t("closing.confirmDialog.pendingCloseCalls.description")}</p>
                        <EvidenceCallList label={t("closing.confirmDialog.pendingCloseCalls.title")}>
                          {displayedPendingCloseCalls.map((call) => (
                            <EvidenceCallItem
                              amount={null}
                              call={call}
                              canOpenLedger={canOpenLedger}
                              key={call.serviceCallId}
                              locale={locale}
                              serviceDate={call.serviceDate}
                            />
                          ))}
                        </EvidenceCallList>
                        {pendingCloseAcknowledged
                          ? displayedPendingCloseCalls.map((call) => (
                              <input
                                form={CONFIRM_MONTHLY_CLOSE_FORM_ID}
                                key={call.serviceCallId}
                                name="confirmedPendingCloseCallIds"
                                type="hidden"
                                value={call.serviceCallId}
                              />
                            ))
                          : null}
                        <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                          <input
                            checked={pendingCloseAcknowledged}
                            className="size-5 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
                            disabled={confirmPending}
                            form={CONFIRM_MONTHLY_CLOSE_FORM_ID}
                            onChange={(event) => setPendingCloseAcknowledged(event.target.checked)}
                            type="checkbox"
                          />
                          {t("closing.confirmDialog.pendingCloseCalls.ackLabel", { count: displayedPendingCloseCalls.length })}
                        </label>
                        <div className="grid gap-1">
                          <label className="text-sm font-semibold text-foreground" htmlFor="pending-close-exception-reason">
                            {t("closing.confirmDialog.pendingCloseCalls.reasonLabel")}
                          </label>
                          <textarea
                            className={inputFieldClassName({ className: "h-auto min-h-16 py-2" })}
                            disabled={confirmPending}
                            form={CONFIRM_MONTHLY_CLOSE_FORM_ID}
                            id="pending-close-exception-reason"
                            name="exceptionReason"
                            onChange={(event) => setExceptionReason(event.target.value)}
                            placeholder={t("closing.confirmDialog.pendingCloseCalls.reasonPlaceholder")}
                            value={exceptionReason}
                          />
                          <p className="text-xs text-muted">{t("closing.confirmDialog.pendingCloseCalls.reasonHelp")}</p>
                        </div>
                      </div>
                    ) : null}
                    <InlineResult t={t} state={confirmState} />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={confirmPending} ref={confirmCancelRef}>
                      {t("closing.action.cancel")}
                    </AlertDialogCancel>
                    <form action={confirmAction} id={CONFIRM_MONTHLY_CLOSE_FORM_ID}>
                      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
                      <AlertDialogAction
                        disabled={confirmPending || !pendingCloseReady}
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }}
                        type="button"
                      >
                        {confirmPending ? t("closing.action.confirming") : t("closing.action.confirmSnapshot")}
                      </AlertDialogAction>
                    </form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              ) : null}
            </AlertDialog>
            {!confirmDialogOpen ? <InlineResult t={t} state={confirmState} /> : null}
          </div>
          {status === "마감확정" ? (
            <form action={lockAction} className="grid gap-1">
              <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
              <Button
                className="bg-danger text-danger-foreground hover:bg-danger"
                disabled={!canLock || lockPending}
                type="submit"
              >
                {lockPending ? t("closing.action.locking") : t("closing.action.lock")}
              </Button>
              <InlineResult t={t} state={lockState} />
            </form>
          ) : null}
        </div>
      </div>
      {status === "잠금" || status === "마감확정" ? (
        <form action={reopenAction} className="mt-4 grid gap-2 border-t border-border pt-4">
          <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
          <div className="grid gap-1">
            <label className="text-sm font-semibold text-foreground" htmlFor="reopen-reason">
              {t("closing.reopen.label")}
            </label>
            <textarea
              aria-describedby={reasonHasError ? "reopen-reason-error" : "reopen-help"}
              aria-invalid={reasonHasError}
              className={inputFieldClassName({ invalid: reasonHasError, className: "h-auto min-h-20 py-2" })}
              disabled={!canReopen || reopenPending}
              id="reopen-reason"
              name="reason"
              placeholder={canReopen ? t("closing.reopen.placeholder") : t("closing.reopen.adminOnly")}
            />
            <p className="text-xs text-muted" id="reopen-help">
              {t("closing.reopen.help")}
            </p>
            <ReopenFieldError state={reopenState} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button

              disabled={!canReopen || reopenPending}
              type="submit"
            >
              {reopenPending ? t("closing.action.reopening") : t("closing.action.reopen")}
            </Button>
            {!canReopen ? <p className="text-sm text-muted">{t("closing.reopen.adminOnly")}</p> : null}
          </div>
          <InlineResult t={t} state={reopenState} />
        </form>
      ) : null}
      {status === "작성중" || status === "검토중" || (!canStartReview && !canConfirm && !canLock) ? (
        <p className="mt-3 text-sm text-muted">{reason}</p>
      ) : null}
    </section>
  );
}
