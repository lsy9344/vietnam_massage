"use client";

import { useActionState } from "react";
import {
  confirmMonthlyCloseAction,
  lockMonthlyCloseAction,
  startMonthlyCloseReviewAction,
  type MonthlyClosingActionState
} from "@/app/(erp)/closing/actions";

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

function disabledReason(status: string, canWrite: boolean) {
  if (!canWrite) return "월마감 처리 권한이 없습니다.";
  if (status === "작성중" || status === "검토중") return "잠금은 먼저 마감확정이 필요합니다.";
  // Story 5.3 terminal copy was "이미 마감확정된 운영월입니다."; Story 5.4 replaces that state with the lock action.
  if (status === "잠금") return "잠금 상태입니다. 확정 스냅샷 조회는 계속 가능합니다.";
  return "현재 상태에서 실행 가능한 월마감 action이 없습니다.";
}

export function ClosingActionPanel({
  operatingMonthId,
  status,
  canWrite
}: {
  operatingMonthId: string;
  status: string;
  canWrite: boolean;
}) {
  const [reviewState, reviewAction, reviewPending] = useActionState<MonthlyClosingActionState, FormData>(startMonthlyCloseReviewAction, null);
  const [confirmState, confirmAction, confirmPending] = useActionState<MonthlyClosingActionState, FormData>(confirmMonthlyCloseAction, null);
  const [lockState, lockAction, lockPending] = useActionState<MonthlyClosingActionState, FormData>(lockMonthlyCloseAction, null);
  const canStartReview = canWrite && status === "작성중";
  const canConfirm = canWrite && status === "검토중";
  const canLock = canWrite && status === "마감확정";
  const reason = disabledReason(status, canWrite);

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
          <form action={confirmAction} className="grid gap-1">
            <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
            <button
              className="h-9 border border-brand bg-brand px-3 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canConfirm || confirmPending}
              type="submit"
            >
              {confirmPending ? "확정중" : "마감 확정"}
            </button>
            <InlineResult state={confirmState} />
          </form>
          {status === "마감확정" ? (
            <form action={lockAction} className="grid gap-1">
              <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
              {/* Story 5.6 owns the double-confirmation dialog and focus contract. */}
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
      {status === "작성중" || status === "검토중" || (!canStartReview && !canConfirm && !canLock) ? (
        <p className="mt-3 text-sm text-muted">{reason}</p>
      ) : null}
    </section>
  );
}
