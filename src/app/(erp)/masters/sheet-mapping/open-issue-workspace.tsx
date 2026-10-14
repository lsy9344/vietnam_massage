"use client";

import type { ReactNode } from "react";
import { DetailRow } from "@/components/ui/detail-row";
import { SidePanel } from "@/components/ui/panel";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { Cell, HeadCell, MasterTable } from "@/app/(erp)/masters/master-parts";
import { MasterSplit, SelectableRow, useMasterSelection } from "@/app/(erp)/masters/master-workspace";
import { useT } from "@/lib/i18n/client";

/** 서버가 번역·서식까지 마친 열린 추적 한 건. form은 상태를 바꿀 수 있는 역할에게만 서버가 넣는다. */
export type OpenIssueView = {
  itemKey: string;
  summary: string;
  related: string;
  status: { label: string; tone: StatusTone };
  expected: string;
  actual: string;
  lastNote: string;
  changedAt: string;
  form: ReactNode | null;
};

function EvidenceBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 rounded-md border border-border p-3">
      <span className="text-xs font-semibold text-muted">{label}</span>
      {/* 기대값·결과값은 공백 없는 긴 JSON일 수 있어 아무 데서나 줄을 바꾼다. */}
      <span className="text-sm text-foreground [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

function IssuePanel({ issue, onClose }: { issue: OpenIssueView; onClose: () => void }) {
  const t = useT();
  return (
    <SidePanel onClose={onClose} title={issue.summary}>
      <div className="grid gap-6" key={issue.itemKey}>
        <div className="grid justify-items-start gap-1">
          <StatusIndicator label={issue.status.label} tone={issue.status.tone} />
          <span className="break-all text-xs text-muted">{issue.itemKey}</span>
        </div>
        <div className="grid gap-3">
          <EvidenceBox label={t("masters.sheetMapping.openIssue.expected")} value={issue.expected} />
          <EvidenceBox label={t("masters.sheetMapping.openIssue.erpActual")} value={issue.actual} />
        </div>
        <dl>
          <DetailRow label={t("masters.sheetMapping.table.related")} value={issue.related} />
          <DetailRow label={t("masters.sheetMapping.openIssue.handlerNote")} value={issue.lastNote} />
          <DetailRow label={t("masters.sheetMapping.openIssue.changedAt")} value={issue.changedAt} />
        </dl>
        {issue.form}
      </div>
    </SidePanel>
  );
}

/**
 * 누락/불일치 추적 목록과, 고른 항목의 이슈 상세 패널(정보구조 9절 "이슈 상세(비모달)").
 * 상태·메모 저장은 패널 안에 있고, 조회 전용 역할은 같은 패널에서 읽기만 한다.
 */
export function OpenIssueWorkspace({ issues, initialItem }: { issues: OpenIssueView[]; initialItem: string | null }) {
  const t = useT();
  const { selected, select, panelRef } = useMasterSelection(initialItem);
  const selectedIssue = issues.find((issue) => issue.itemKey === selected) ?? null;

  return (
    <section aria-label={t("masters.sheetMapping.openIssue.aria")} className="mb-6 grid gap-3">
      <h2 className="text-[0.9375rem] font-semibold text-foreground">{t("masters.sheetMapping.openIssue.title")}</h2>
      <MasterSplit
        hint={t("masters.sheetMapping.openIssue.panelHint")}
        panel={selectedIssue ? <IssuePanel issue={selectedIssue} onClose={() => select(null)} /> : null}
        panelRef={panelRef}
      >
        <MasterTable
          head={
            <>
              <HeadCell>{t("masters.sheetMapping.openIssue.item")}</HeadCell>
              <HeadCell>{t("masters.sheetMapping.openIssue.status")}</HeadCell>
              <HeadCell>{t("masters.sheetMapping.openIssue.handlerNote")}</HeadCell>
              <HeadCell>{t("masters.sheetMapping.openIssue.changedAt")}</HeadCell>
            </>
          }
          label={t("masters.sheetMapping.openIssue.title")}
          minWidth="min-w-[40rem]"
        >
          {issues.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-sm text-muted" colSpan={4}>
                {t("masters.sheetMapping.openIssue.empty")}
              </td>
            </tr>
          ) : (
            issues.map((issue) => (
              <SelectableRow
                key={issue.itemKey}
                label={issue.summary}
                onSelect={(viaKeyboard) => select(issue.itemKey, viaKeyboard)}
                selected={issue.itemKey === selected}
                sublabel={issue.itemKey}
              >
                <Cell>
                  <StatusIndicator label={issue.status.label} tone={issue.status.tone} />
                </Cell>
                <Cell muted>{issue.lastNote}</Cell>
                <Cell muted nowrap>
                  {issue.changedAt}
                </Cell>
              </SelectableRow>
            ))
          )}
        </MasterTable>
      </MasterSplit>
    </section>
  );
}
