"use client";

import { useEffect, useState } from "react";
import { DetailRow } from "@/components/ui/detail-row";
import { SidePanel } from "@/components/ui/panel";
import { WarningList } from "@/components/ui/warning-summary";
import { PanelSection } from "@/app/(erp)/settlements/settlement-parts";
import { useT } from "@/lib/i18n/client";
import type { CustomerDto, ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";
import { callWarningLabel } from "@/app/(erp)/calls/call-warning-label";
import { CallCustomerLinkCorrection } from "@/app/(erp)/calls/call-customer-link-correction";
import { CallConflictCompare, useCallConflict } from "@/app/(erp)/calls/call-conflict-compare";

function relatedCallIds(row: ServiceCallRowDto) {
  const ids: string[] = [];
  for (const warning of row.warnings) {
    for (const id of warning.relatedCallIds) {
      if (id !== row.id && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/**
 * 콜 상세 패널(비모달). 그 콜의 모든 경고와 관련 콜을 읽고, 관련 콜로 옮겨 간다.
 * 원장 위에 열리므로 원장의 날짜와 입력 중인 초안은 그대로다. 저장 상태는 여기 없다(행의 저장상태 칸).
 * `row`가 null이면 주소의 콜 id가 이 날짜 원장에 없는 것이다.
 */
export function CallDetailPanel({
  customers,
  isLocked,
  row,
  rows,
  options,
  onClose,
  onSelectCall
}: {
  customers: CustomerDto[];
  isLocked: boolean;
  row: ServiceCallRowDto | null;
  rows: ServiceCallRowDto[];
  options: ServiceCallFormOptions;
  onClose: () => void;
  onSelectCall: (callId: string) => void;
}) {
  const t = useT();
  // 고객 연결 정정이나 "최신 내용으로 다시 불러오기"는 원장이 서버에서 다시 받아오는 rows prop과
  // 별개로 패널에만 바로 반영한다. 다른 콜을 고르면(주소의 콜 id가 바뀌면) 지운다.
  const [override, setOverride] = useState<ServiceCallRowDto | null>(null);
  useEffect(() => {
    setOverride(null);
  }, [row?.id]);
  const current = override ?? row;
  // 이 콜이 저장 충돌(STALE_CALL) 상태면 원장 행(editable-call-grid.tsx)이 등록한 비교 데이터를 받는다
  // (스펙 B07, 티켓 17). 등록이 없으면(충돌이 아니면) null이라 비교 화면을 그리지 않는다.
  const conflict = useCallConflict(current?.id ?? null);

  if (!current) {
    return (
      <SidePanel onClose={onClose} title={t("calls.detail.fallbackTitle")}>
        <p className="text-sm text-muted" role="status">
          {t("calls.detail.notFound")}
        </p>
      </SidePanel>
    );
  }

  const statusLabel = (value: string) => options.statuses.find((option) => option.value === value)?.label ?? value;
  const related = relatedCallIds(current)
    .map((id) => rows.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is ServiceCallRowDto => Boolean(candidate));
  const title = current.customerMemo
    ? t("calls.detail.titleWithMemo", { time: current.startTime, memo: current.customerMemo })
    : t("calls.detail.title", { time: current.startTime });

  return (
    <SidePanel onClose={onClose} title={title}>
      <div className="grid gap-6">
        {conflict ? (
          <CallConflictCompare compare={conflict} customers={customers} key={conflict.latestRow.updatedAt} options={options} />
        ) : null}

        <PanelSection title={t("calls.detail.warnings")}>
          {current.warnings.length === 0 ? (
            <p className="text-sm text-muted">{t("calls.detail.noWarnings")}</p>
          ) : (
            <WarningList label={t("calls.detail.warnings")} warnings={current.warnings.map((warning) => callWarningLabel(t, warning))} />
          )}
        </PanelSection>

        <dl>
          <DetailRow label={t("calls.column.time")} value={current.startTime} />
          <DetailRow label={t("calls.column.actualEntry")} value={current.actualEntryTime ?? "-"} />
          <DetailRow label={t("calls.detail.displayEnd")} value={current.displayEnd} />
          <DetailRow label={t("calls.column.room")} value={current.roomLabel} />
          <DetailRow label={t("calls.column.course")} value={current.courseLabel} />
          <DetailRow label={t("calls.column.therapist1")} value={current.therapist1?.displayName ?? "-"} />
          <DetailRow label={t("calls.column.therapist2")} value={current.therapist2?.displayName ?? "-"} />
          <DetailRow label={t("calls.column.reservationStatus")} value={statusLabel(current.status)} />
          {/* 방문별 요청(F06, 티켓 23). 고객 공통 선호·주의사항은 고객 화면에, 이 콜만의 요청은 여기와 빠른 예약 객실·메모 단계에 있다. */}
          <DetailRow label={t("calls.column.visitRequest")} value={current.visitRequest ?? "-"} />
        </dl>

        <PanelSection title={t("calls.detail.customerLink.title")}>
          <CallCustomerLinkCorrection
            customers={customers}
            isLocked={isLocked}
            key={current.id}
            onCorrected={setOverride}
            row={current}
          />
        </PanelSection>

        <PanelSection title={t("calls.detail.related")}>
          {related.length === 0 ? (
            <p className="text-sm text-muted">{t("calls.detail.noRelated")}</p>
          ) : (
            <ul className="grid gap-2">
              {related.map((call) => (
                <li key={call.id}>
                  {/* 목록 행 카드(design.md 6.10). 패널과 같은 --surface 바탕이라 1px 테두리로 나눈다. */}
                  <button
                    className="grid min-h-14 w-full gap-0.5 rounded-md border border-border bg-surface px-4 py-2.5 text-left text-sm transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
                    data-related-call={call.id}
                    onClick={() => onSelectCall(call.id)}
                    type="button"
                  >
                    <span className="font-semibold text-foreground [font-variant-numeric:tabular-nums]">
                      {call.startTime} · {call.courseLabel} · {call.therapist1?.displayName ?? "-"} · {statusLabel(call.status)}
                    </span>
                    <span className="text-xs text-muted">
                      {t("calls.actualEntry.displayEnd", { time: call.displayEnd })} · {t("calls.detail.goToCall")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PanelSection>
      </div>
    </SidePanel>
  );
}
