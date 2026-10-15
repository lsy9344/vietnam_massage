"use client";

import { WarningSummary } from "@/components/ui/warning-summary";
import { useLocale, useT } from "@/lib/i18n/client";
import type { CallRowWarningDto } from "@/modules/calls/service-call-service";
import { callWarningLabel } from "@/app/(erp)/calls/call-warning-label";

const openButtonClass =
  "inline-flex min-h-11 items-center rounded-full px-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary";

/**
 * 원장 행의 경고 칸. 첫 경고와 나머지 건수("+N")만 보이고, 누르면 그 콜의 상세 패널이 열린다.
 * 경고가 없어도 같은 자리의 버튼으로 패널을 연다. 저장 상태는 이 칸이 아니라 저장상태 칸에 있다.
 */
export function CallWarningCell({
  callId,
  startTime,
  warnings,
  onOpen
}: {
  callId: string;
  startTime: string;
  warnings: CallRowWarningDto[];
  onOpen: (callId: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const labels = warnings.map((warning) => callWarningLabel(t, warning));

  return (
    <button
      aria-label={t("calls.detail.rowAria", { time: startTime })}
      className={openButtonClass}
      data-call-open={callId}
      onClick={() => onOpen(callId)}
      type="button"
    >
      {labels.length > 0 ? (
        <WarningSummary locale={locale} warnings={labels} />
      ) : (
        <span className="text-xs text-muted">{t("calls.warning.openDetail")}</span>
      )}
    </button>
  );
}
