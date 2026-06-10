"use client";

import { useActionState, useEffect, useRef, useState, type MouseEvent } from "react";
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

function formatVnd(amount: number) {
  return `${new Intl.NumberFormat("ko-KR").format(amount)} VND`;
}

function InlineResult({ state }: { state: MonthlyClosingActionState }) {
  if (!state) return null;

  if (state.ok) {
    return (
      <p className="text-sm font-medium text-success" role="status">
        처리되었습니다.
      </p>
    );
  }

  return (
    <p className="text-sm font-medium text-danger" role="alert">
      {state.formError ?? "처리하지 못했습니다."}
    </p>
  );
}

function disabledReason(status: string, canWrite: boolean, hasConfirmSummary: boolean) {
  if (!canWrite) return "월마감 처리 권한이 없습니다.";
  if (status === "검토중" && !hasConfirmSummary) return "월마감 미리보기가 준비되어야 확정할 수 있습니다.";
  if (status === "작성중" || status === "검토중") return "잠금은 먼저 마감확정이 필요합니다.";
  if (status === "잠금") return "잠금 상태입니다. 확정 스냅샷 조회는 계속 가능합니다.";
  return "현재 상태에서 실행 가능한 월마감 action이 없습니다.";
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
  const [reviewState, reviewAction, reviewPending] = useActionState<MonthlyClosingActionState, FormData>(startMonthlyCloseReviewAction, null);
  const [confirmState, confirmAction, confirmPending] = useActionState<MonthlyClosingActionState, FormData>(confirmMonthlyCloseAction, null);
  const [lockState, lockAction, lockPending] = useActionState<MonthlyClosingActionState, FormData>(lockMonthlyCloseAction, null);
  const [reopenState, reopenAction, reopenPending] = useActionState<MonthlyClosingActionState, FormData>(reopenMonthlyCloseAction, null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const canStartReview = canWrite && status === "작성중";
  const canConfirm = canWrite && status === "검토중" && Boolean(confirmSummary);
  const canLock = canWrite && status === "마감확정";
  const reason = disabledReason(status, canWrite, Boolean(confirmSummary));
  const reasonHasError = Boolean(reopenState && !reopenState.ok && reopenState.fieldErrors?.reason?.[0]);

  useEffect(() => {
    if (confirmState?.ok) setConfirmDialogOpen(false);
  }, [confirmState]);

  return (
    <section className="mb-4 border border-border bg-surface px-4 py-3" aria-label="월마감 action">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">월마감 처리</h2>
          <p className="mt-1 text-sm text-muted">
            상태 전이와 확정 스냅샷 저장은 closing domain service가 처리한다.
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
              {reviewPending ? "처리중" : "검토 시작"}
            </button>
            <InlineResult state={reviewState} />
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
                  {confirmPending ? "확정중" : "마감 확정"}
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
                    aria-label="닫기"
                    className="absolute right-3 top-3 h-8 w-8 px-0 text-base leading-none"
                    disabled={confirmPending}
                  >
                    ×
                  </AlertDialogCancel>
                  <AlertDialogHeader>
                    <AlertDialogTitle tabIndex={-1}>{confirmSummary.monthKey} 월마감을 확정할까요?</AlertDialogTitle>
                    <AlertDialogDescription>
                      확정 시 스냅샷이 고정되어 이후 설정 변경으로 재계산되지 않습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="grid gap-3">
                    <div className="border border-border bg-background px-3 py-2">
                      <div className="text-xs font-medium text-muted">운영월</div>
                      <div className="mt-1 text-sm font-semibold text-foreground">
                        {confirmSummary.monthKey} / {confirmSummary.startDate} ~ {confirmSummary.endDate} / {confirmSummary.status}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="border border-border bg-background px-3 py-2">
                        <div className="text-xs text-muted">전체 지급 합계</div>
                        <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">{formatVnd(confirmSummary.grandPayoutAmount)}</div>
                      </div>
                      <div className="border border-border bg-background px-3 py-2">
                        <div className="text-xs text-muted">warning</div>
                        <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">{confirmSummary.warningCount}건</div>
                      </div>
                    </div>
                    <dl className="grid gap-2 text-sm sm:grid-cols-3">
                      <div className="border border-border bg-background px-3 py-2">
                        <dt className="text-xs text-muted">마사지사</dt>
                        <dd className="mt-1 font-semibold tabular-nums">{formatVnd(confirmSummary.therapistPayoutAmount)}</dd>
                        <dd className="mt-1 text-xs text-muted">{confirmSummary.therapistCount}명</dd>
                      </div>
                      <div className="border border-border bg-background px-3 py-2">
                        <dt className="text-xs text-muted">운영팀</dt>
                        <dd className="mt-1 font-semibold tabular-nums">{formatVnd(confirmSummary.operationsPayoutAmount)}</dd>
                        <dd className="mt-1 text-xs text-muted">
                          {confirmSummary.operationsCount}명 / 일일 {formatVnd(confirmSummary.opsDailyIncentiveAmount)} / 월 {formatVnd(confirmSummary.opsMonthlyIncentiveAmount)}
                        </dd>
                      </div>
                      <div className="border border-border bg-background px-3 py-2">
                        <dt className="text-xs text-muted">귀케어</dt>
                        <dd className="mt-1 font-semibold tabular-nums">{formatVnd(confirmSummary.earcarePayoutAmount)}</dd>
                        <dd className="mt-1 text-xs text-muted">{confirmSummary.earcareCount}명</dd>
                      </div>
                    </dl>
                    <InlineResult state={confirmState} />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={confirmPending} ref={confirmCancelRef}>
                      취소
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
                        {confirmPending ? "확정중" : "지급 스냅샷 확정"}
                      </AlertDialogAction>
                    </form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              ) : null}
            </AlertDialog>
            {!confirmDialogOpen ? <InlineResult state={confirmState} /> : null}
          </div>
          {status === "마감확정" ? (
            <form action={lockAction} className="grid gap-1">
              <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
              <button
                className="h-9 border border-danger bg-danger px-3 text-sm font-semibold text-danger-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canLock || lockPending}
                type="submit"
              >
                {lockPending ? "잠금중" : "잠금"}
              </button>
              <InlineResult state={lockState} />
            </form>
          ) : null}
        </div>
      </div>
      {status === "잠금" ? (
        <form action={reopenAction} className="mt-4 grid gap-2 border-t border-border pt-4">
          <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
          <div className="grid gap-1">
            <label className="text-sm font-semibold text-foreground" htmlFor="reopen-reason">
              재오픈 사유
            </label>
            <textarea
              aria-describedby={reasonHasError ? "reopen-reason-error" : "reopen-help"}
              aria-invalid={reasonHasError}
              className="min-h-20 border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand disabled:cursor-not-allowed disabled:bg-readonly disabled:text-muted"
              disabled={!canReopen || reopenPending}
              id="reopen-reason"
              name="reason"
              placeholder={canReopen ? "재오픈 사유를 입력하세요." : "관리자만 재오픈할 수 있습니다."}
            />
            <p className="text-xs text-muted" id="reopen-help">
              재오픈은 잠금 상태에서만 가능하며 사유는 감사 로그에 기록된다.
            </p>
            <ReopenFieldError state={reopenState} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="h-9 border border-brand bg-brand px-3 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canReopen || reopenPending}
              type="submit"
            >
              {reopenPending ? "재오픈중" : "재오픈"}
            </button>
            {!canReopen ? <p className="text-sm text-muted">관리자만 재오픈할 수 있습니다.</p> : null}
          </div>
          <InlineResult state={reopenState} />
        </form>
      ) : null}
      {status === "작성중" || status === "검토중" || (!canStartReview && !canConfirm && !canLock) ? (
        <p className="mt-3 text-sm text-muted">{reason}</p>
      ) : null}
    </section>
  );
}
