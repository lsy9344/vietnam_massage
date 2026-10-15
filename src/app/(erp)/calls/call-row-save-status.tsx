"use client";

import { Button } from "@/components/ui/button";
import { SaveStatus, type SaveState } from "@/components/ui/save-status";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatDateTime } from "@/lib/i18n/format";
import type { RowSaveStatus } from "@/app/(erp)/calls/call-row-save";

const chipState: Record<RowSaveStatus, SaveState> = {
  // 이 화면에서 아직 고치지 않은 행도 저장된 행이다.
  idle: "saved",
  saving: "saving",
  saved: "saved",
  failed: "failed",
  conflict: "conflict"
};

const actionClass = "h-auto min-h-11 justify-self-start whitespace-normal px-3 py-1.5 text-left text-xs";

/**
 * 원장 행의 저장 상태. 경고 칸과 따로 저장상태 칸에 늘 보인다(design.md 6.6).
 * 실패하면 같은 초안으로 다시 시도한다. 다른 화면이 먼저 저장했으면(충돌) 최신 내용으로 다시 불러온다.
 * 강제 덮어쓰기는 없다.
 */
export function CallRowSaveStatus({
  state,
  savedAt,
  message,
  onRetry,
  onReload
}: {
  state: RowSaveStatus;
  savedAt: string;
  message: string | null;
  onRetry: () => void;
  onReload: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const chip = chipState[state];

  // data-save-state: 처음 불러온 행(idle)과 이 화면에서 저장을 마친 행(saved)은 같은 "저장됨"으로 보인다.
  return (
    <span className="grid gap-1" data-save-state={state}>
      <span className="flex flex-wrap items-center gap-1.5">
        <SaveStatus locale={locale} state={chip} />
        {chip === "saved" ? (
          <span className="text-xs text-muted [font-variant-numeric:tabular-nums]">
            {formatDateTime(locale, savedAt, { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : null}
      </span>
      {state === "failed" ? (
        <>
          <span className="text-xs text-danger" role="alert">
            {message ?? t("calls.save.autosaveFailed")}
          </span>
          <Button className={actionClass} onClick={onRetry} variant="secondary">
            {t("calls.save.retry")}
          </Button>
        </>
      ) : null}
      {state === "conflict" ? (
        <>
          {message ? (
            <span className="text-xs text-warning" role="alert">
              {message}
            </span>
          ) : null}
          <Button className={actionClass} onClick={onReload} variant="secondary">
            {t("calls.save.reloadLatest")}
          </Button>
        </>
      ) : null}
    </span>
  );
}
