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
  type MonthlyClosingActionState
} from "@/app/(erp)/closing/actions";
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
  earcarePayoutAmount: number;
  earcareCount: number;
  warningCount: number;
};

function formatVnd(locale: Locale, t: Translator, amount: number) {
  return `${formatCurrencyVnd(locale, amount)} ${t("settlements.vndSuffix")}`;
}

function InlineResult({ t, state }: { t: Translator; state: MonthlyClosingActionState }) {
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

function disabledReason(t: Translator, status: string, canWrite: boolean, hasConfirmSummary: boolean) {
  if (!canWrite) return t("closing.disabled.noPermission");
  if (status === "검토중" && !hasConfirmSummary) return t("closing.disabled.needPreview");
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
  confirmSummary
}: {
  operatingMonthId: string;
  status: string;
  canWrite: boolean;
  canReopen: boolean;
  confirmSummary: ConfirmDialogSummary | null;
}) {
  const t = useT();
  const locale = useLocale();
  const [reviewState, reviewAction, reviewPending] = useActionState<MonthlyClosingActionState, FormData>(startMonthlyCloseReviewAction, null);
  const [confirmState, confirmAction, confirmPending] = useActionState<MonthlyClosingActionState, FormData>(confirmMonthlyCloseAction, null);
  const [lockState, lockAction, lockPending] = useActionState<MonthlyClosingActionState, FormData>(lockMonthlyCloseAction, null);
  const [reopenState, reopenAction, reopenPending] = useActionState<MonthlyClosingActionState, FormData>(reopenMonthlyCloseAction, null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const canStartReview = canWrite && status === "작성중";
  const canConfirm = canWrite && status === "검토중" && Boolean(confirmSummary);
  const canLock = canWrite && status === "마감확정";
  const reason = disabledReason(t, status, canWrite, Boolean(confirmSummary));
  const reasonHasError = Boolean(reopenState && !reopenState.ok && reopenState.fieldErrors?.reason?.[0]);

  useEffect(() => {
    if (confirmState?.ok) setConfirmDialogOpen(false);
  }, [confirmState]);

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
            <button
              className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canStartReview || reviewPending}
              type="submit"
            >
              {reviewPending ? t("closing.action.processing") : t("closing.action.startReview")}
            </button>
            <InlineResult t={t} state={reviewState} />
          </form>
          <div className="grid gap-1">
            {/* Story 5.6: first click opens this AlertDialog; only the second confirmation submits the server action. */}
            <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
              <AlertDialogTrigger asChild>
                <button
                  className="h-9 border border-brand bg-brand px-3 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canConfirm || confirmPending}
                  type="button"
                >
                  {confirmPending ? t("closing.action.confirming") : t("closing.action.confirm")}
                </button>
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
                    className="absolute right-3 top-3 h-8 w-8 px-0 text-base leading-none"
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
                    <dl className="grid gap-2 text-sm sm:grid-cols-3">
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
                      <div className="border border-border bg-background px-3 py-2">
                        <dt className="text-xs text-muted">{t("closing.confirmDialog.earcare")}</dt>
                        <dd className="mt-1 font-semibold tabular-nums">{formatVnd(locale, t, confirmSummary.earcarePayoutAmount)}</dd>
                        <dd className="mt-1 text-xs text-muted">{confirmSummary.earcareCount}{t("settlements.peopleSuffix")}</dd>
                      </div>
                    </dl>
                    <InlineResult t={t} state={confirmState} />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={confirmPending} ref={confirmCancelRef}>
                      {t("closing.action.cancel")}
                    </AlertDialogCancel>
                    <form action={confirmAction}>
                      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
                      <AlertDialogAction
                        disabled={confirmPending}
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
              <button
                className="h-9 border border-danger bg-danger px-3 text-sm font-semibold text-danger-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canLock || lockPending}
                type="submit"
              >
                {lockPending ? t("closing.action.locking") : t("closing.action.lock")}
              </button>
              <InlineResult t={t} state={lockState} />
            </form>
          ) : null}
        </div>
      </div>
      {status === "잠금" ? (
        <form action={reopenAction} className="mt-4 grid gap-2 border-t border-border pt-4">
          <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
          <div className="grid gap-1">
            <label className="text-sm font-semibold text-foreground" htmlFor="reopen-reason">
              {t("closing.reopen.label")}
            </label>
            <textarea
              aria-describedby={reasonHasError ? "reopen-reason-error" : "reopen-help"}
              aria-invalid={reasonHasError}
              className="min-h-20 border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand disabled:cursor-not-allowed disabled:bg-readonly disabled:text-muted"
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
            <button
              className="h-9 border border-brand bg-brand px-3 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canReopen || reopenPending}
              type="submit"
            >
              {reopenPending ? t("closing.action.reopening") : t("closing.action.reopen")}
            </button>
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
