"use client";

import { DateCapsule } from "@/components/ui/date-capsule";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { useT } from "@/lib/i18n/client";
import type { ServiceCallFormOptions, ServiceCallOption, ServiceCallRowDto } from "@/modules/calls/service-call-service";
import { callWarningLabel } from "@/app/(erp)/calls/call-warning-label";

function statusLabel(options: ServiceCallOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

const cardClassName =
  "grid min-h-14 w-full gap-1.5 rounded-md border border-border bg-surface px-4 py-3 text-left text-sm transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary data-[selected=true]:bg-readonly data-[selected=true]:[box-shadow:inset_3px_0_0_var(--brand)]";

/**
 * 휴대폰 폭(600px 미만)의 원장 카드 목록(명세 F08, 티켓 26). 넓은 표의 축소판이 아니라 다른 렌더이고,
 * 태블릿 이상에서는 보이지 않는다(call-ledger-list.tsx가 두 렌더를 CSS로만 서로 민다). 카드는 예약시각,
 * 객실, 코스, Therapist, 상태, 첫 경고만 보여 주는 읽기 전용 요약이라 고객 연락처나 금액은 여기 없다.
 * 누르면 그 콜의 상세 패널(이미 읽기 전용, 티켓 13)이 열린다.
 */
export function CallPhoneCardList({
  isPhoneWidth,
  onOpenDetail,
  options,
  rows,
  selectedCallId = null
}: {
  /** call-ledger-list.tsx가 usePhoneWidth()로 재는 실제 폭(티켓 26 회귀, story-2-1). */
  isPhoneWidth: boolean;
  onOpenDetail: (callId: string) => void;
  options: ServiceCallFormOptions;
  rows: ServiceCallRowDto[];
  selectedCallId?: string | null;
}) {
  const t = useT();

  if (rows.length === 0) {
    // 태블릿 이상 폭에서는 call-ledger-list.tsx의 목록 쪽이 이미 같은 빈 상태 문구를 보여 준다. 이 블록은
    // CSS(min-[600px]:hidden)로만 숨겨지고 DOM에는 남으므로, 그리지 않고 아예 빼서 "이 날짜의 콜이
    // 없습니다"를 찾는 검사가 두 군데에 걸리지 않게 한다.
    if (!isPhoneWidth) {
      return null;
    }
    return (
      <div className="grid gap-3 px-4 py-8">
        <p className="text-sm font-medium text-foreground">{t("calls.grid.empty.title")}</p>
      </div>
    );
  }

  return (
    <ul aria-label={t("calls.phoneCard.aria")} className="grid gap-2 p-4">
      {rows.map((row) => {
        // 경고 순서는 서비스가 정한다(CALL_ROW_WARNING_ORDER). 카드는 그 첫 항목만 보인다.
        const firstWarning = row.warnings[0] ? callWarningLabel(t, row.warnings[0]) : null;
        const therapistNames = [row.therapist1?.displayName, row.therapist2?.displayName].filter(Boolean).join(" · ") || "-";

        return (
          <li key={row.id}>
            <button
              aria-label={t("calls.detail.rowAria", { time: row.startTime })}
              className={cardClassName}
              data-call-open={row.id}
              data-selected={row.id === selectedCallId}
              data-service-call-id={row.id}
              onClick={() => onOpenDetail(row.id)}
              type="button"
            >
              <span className="flex items-center justify-between gap-2">
                <DateCapsule>{row.startTime}</DateCapsule>
                <span className="font-semibold text-foreground">{statusLabel(options.statuses, row.status)}</span>
              </span>
              <span className="font-semibold text-foreground">
                {row.roomLabel} · {row.courseLabel}
              </span>
              <span className="text-xs text-muted">{therapistNames}</span>
              {firstWarning ? <StatusIndicator label={firstWarning} tone="warning" /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
