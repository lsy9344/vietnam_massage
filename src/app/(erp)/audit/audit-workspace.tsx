"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AUDIT_LOG_PARAM, type AuditChangeSummary, type AuditFieldChange } from "@/app/(erp)/audit/audit-view-model";
import { DetailRow } from "@/components/ui/detail-row";
import { SidePanel } from "@/components/ui/panel";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** 서버 페이지가 번역·서식까지 마쳐 넘기는 감사 기록 한 건. */
export type AuditEntryView = {
  id: string;
  time: string;
  actorName: string;
  /** 처리자 이름과 다를 때만 이름 아래에 보이는 계정 ID. */
  actorAccountId: string | null;
  targetLabel: string;
  targetId: string;
  action: string;
  summary: AuditChangeSummary;
  reason: string | null;
  changes: AuditFieldChange[];
  beforeJson: string;
  afterJson: string;
  /** 보는 사람의 역할로 열 수 있는 원본 화면. 없으면 null. */
  sourceHref: string | null;
};

const cellClassName = "border-b border-border px-3 py-2 align-top";

function shorten(text: string, max = 40) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * 고른 기록은 주소의 log 매개변수 하나로만 들고, history.replaceState로 바꾼다(행을 옮길 때마다 서버를 다시 부르지 않는다).
 * Next가 replaceState를 useSearchParams에 반영하므로, 초기화 링크처럼 주소가 바뀌면 패널도 따라 닫힌다.
 * 키보드로 고르면 포커스를 패널로 옮긴다. 마우스로 고르면 좁은 폭에서만 표 아래에 쌓인 패널로 내려간다.
 * 패널을 닫으면 패널이 보이던 기록의 행으로 포커스를 돌려준다.
 */
function useSelection() {
  const selected = useSearchParams().get(AUDIT_LOG_PARAM);
  const panelRef = useRef<HTMLDivElement>(null);
  const reveal = useRef<{ how: "keyboard" | "pointer" } | { how: "close"; id: string } | null>(null);

  useEffect(() => {
    const action = reveal.current;
    reveal.current = null;
    if (!action) return;
    // 패널은 처음 열 때의 행으로 포커스를 돌려주므로(SidePanel), 그 뒤에 지금 기록의 행으로 다시 옮긴다.
    if (action.how === "close") {
      document.querySelector<HTMLElement>(`[data-audit-log="${CSS.escape(action.id)}"]`)?.focus();
      return;
    }
    const panel = panelRef.current;
    if (!selected || !panel) return;
    if (action.how === "keyboard") panel.focus();
    else if (!window.matchMedia("(min-width: 840px)").matches) panel.scrollIntoView({ block: "start" });
  }, [selected]);

  function select(id: string | null, viaKeyboard = false) {
    if (id !== null && id === selected) {
      if (viaKeyboard) panelRef.current?.focus();
      return;
    }
    reveal.current = id === null ? (selected ? { how: "close", id: selected } : null) : { how: viaKeyboard ? "keyboard" : "pointer" };
    const url = new URL(window.location.href);
    if (id) url.searchParams.set(AUDIT_LOG_PARAM, id);
    else url.searchParams.delete(AUDIT_LOG_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return { selected, select, panelRef };
}

function ChangeSummary({ summary }: { summary: AuditChangeSummary }) {
  const t = useT();
  if (summary.kind === "created") return <span className="text-muted">{t("audit.summary.created")}</span>;
  if (summary.kind === "none") return <span className="text-muted">{t("audit.summary.none")}</span>;
  return (
    <span className="grid gap-0.5">
      {summary.changes.map((item) => (
        <span className="block" key={item.field ?? ""}>
          {item.field ? `${item.field}: ` : ""}
          {shorten(item.before)} → {shorten(item.after)}
        </span>
      ))}
      {summary.more > 0 ? <span className="text-xs text-muted">{t("audit.summary.more", { count: summary.more })}</span> : null}
    </span>
  );
}

function AuditDetail({ entry }: { entry: AuditEntryView }) {
  const t = useT();
  return (
    <div className="grid gap-6">
      <dl>
        <DetailRow label={t("audit.column.time")} value={entry.time} />
        <DetailRow
          label={t("audit.column.actor")}
          value={
            <>
              {entry.actorName}
              {entry.actorAccountId ? <span className="block text-xs font-normal text-muted">{entry.actorAccountId}</span> : null}
            </>
          }
        />
        <DetailRow
          label={t("audit.column.target")}
          value={
            <>
              {entry.targetLabel}
              <span className="block break-all text-xs font-normal text-muted">{entry.targetId}</span>
            </>
          }
        />
        <DetailRow label={t("audit.column.action")} value={<span className="break-all font-mono text-xs">{entry.action}</span>} />
        <DetailRow label={t("audit.column.reason")} value={entry.reason ?? "-"} />
      </dl>

      {entry.sourceHref ? (
        <Link
          className="inline-flex h-11 items-center justify-self-start rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
          href={entry.sourceHref}
        >
          {t("audit.detail.openSource")}
        </Link>
      ) : (
        <p className="text-sm text-muted">{t("audit.detail.noSource")}</p>
      )}

      <section aria-label={t("audit.column.change")} className="grid gap-3">
        <h3 className="text-[0.9375rem] font-semibold text-foreground">{t("audit.column.change")}</h3>
        <div className="relative overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-readonly text-xs font-semibold text-muted">
              <tr>
                <th className={cn(cellClassName, "whitespace-nowrap")} scope="col">
                  {t("audit.column.field")}
                </th>
                <th className={cn(cellClassName, "whitespace-nowrap")} scope="col">
                  {t("audit.column.before")}
                </th>
                <th className={cn(cellClassName, "whitespace-nowrap")} scope="col">
                  {t("audit.column.after")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entry.changes.map((item) => (
                <tr key={item.field ?? ""}>
                  <th className={cn(cellClassName, "font-normal")} scope="row">
                    <span className="grid justify-items-start gap-1">
                      <span className="break-all">{item.field ?? t("audit.detail.value")}</span>
                      {item.changed ? <StatusIndicator className="text-xs" label={t("audit.detail.changed")} tone="info" /> : null}
                    </span>
                  </th>
                  <td className={cn(cellClassName, "[overflow-wrap:anywhere]", !item.changed && "text-muted")}>{item.before}</td>
                  <td className={cn(cellClassName, "[overflow-wrap:anywhere]", item.changed ? "font-semibold text-foreground" : "text-muted")}>
                    {item.after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <details>
        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-sm text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary">
          {t("audit.detail.raw")}
        </summary>
        <div className="mt-2 grid gap-3">
          {[
            { label: t("audit.column.before"), json: entry.beforeJson },
            { label: t("audit.column.after"), json: entry.afterJson }
          ].map((side) => (
            <div className="grid gap-1.5" key={side.label}>
              <span className="text-xs font-semibold text-muted">{side.label}</span>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-sm bg-readonly p-3 text-xs text-foreground">{side.json}</pre>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

/**
 * 감사 작업면: 기록 표와, 고른 기록의 변경 상세 비모달 패널(정보구조 9절, design.md 6.6·6.11).
 * 840px 이상에서는 표 옆에 패널을 두고, 미만에서는 표 아래에 쌓는다. 패널은 읽기 전용이다.
 */
export function AuditWorkspace({
  entries,
  emptyMessage,
  countLabel
}: {
  entries: AuditEntryView[];
  emptyMessage: string;
  countLabel: string;
}) {
  const t = useT();
  const { selected, select, panelRef } = useSelection();
  const entry = entries.find((item) => item.id === selected) ?? null;

  return (
    <div className={entry ? "grid grid-cols-1 items-start gap-6 min-[840px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid gap-6"}>
      <section aria-labelledby="audit-list-title" className="grid min-w-0 gap-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-[0.9375rem] font-semibold text-foreground" id="audit-list-title">
            {t("audit.sectionTitle")}
          </h2>
          <span className="text-sm text-muted">{countLabel}</span>
        </div>
        {entry || entries.length === 0 ? null : <p className="text-sm text-muted">{t("audit.detail.hint")}</p>}

        {entries.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-muted">{emptyMessage}</p>
        ) : (
          // relative: 표 안 sr-only 라벨이 스크롤 상자 밖 문서 폭을 늘리지 않게 이 상자 안에 가둔다.
          <div className="relative overflow-x-auto rounded-md border border-border bg-surface">
            <table aria-labelledby="audit-list-title" className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <thead className="bg-readonly text-xs font-semibold text-muted">
                <tr>
                  {[t("audit.column.time"), t("audit.column.actor"), t("audit.column.target"), t("audit.column.change"), t("audit.column.reason")].map(
                    (label) => (
                      <th className={cn(cellClassName, "whitespace-nowrap")} key={label} scope="col">
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((item) => {
                  const isSelected = item.id === selected;
                  return (
                    <tr
                      className={cn("cursor-pointer transition-colors hover:bg-readonly", isSelected && "bg-readonly")}
                      key={item.id}
                      onClick={() => select(item.id)}
                    >
                      {/* 선택된 행의 왼쪽 검정 막대(design.md 6.6). 표 행에는 그림자가 그려지지 않는 브라우저가 있어 첫 칸에 둔다. */}
                      <th className={cn(cellClassName, "font-normal", isSelected && "[box-shadow:inset_3px_0_0_var(--brand)]")} scope="row">
                        <button
                          aria-pressed={isSelected}
                          data-audit-log={item.id}
                          className="flex min-h-11 items-center whitespace-nowrap rounded-sm text-left font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            // Enter·Space로 누른 클릭은 detail이 0이다.
                            select(item.id, event.detail === 0);
                          }}
                          type="button"
                        >
                          {item.time}
                        </button>
                      </th>
                      <td className={cellClassName}>
                        <span className="font-semibold text-foreground">{item.actorName}</span>
                        {item.actorAccountId ? <span className="block text-xs text-muted">{item.actorAccountId}</span> : null}
                      </td>
                      <td className={cellClassName}>
                        <span className="font-semibold text-foreground">{item.targetLabel}</span>
                        <span className="block break-all text-xs text-muted">{item.targetId}</span>
                        <span className="block break-all font-mono text-xs text-muted">{item.action}</span>
                      </td>
                      <td className={cellClassName}>
                        <ChangeSummary summary={item.summary} />
                      </td>
                      <td className={cn(cellClassName, item.reason ? "text-foreground" : "text-muted")}>{item.reason ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {entry ? (
        <div className="min-w-0 outline-none min-[840px]:sticky min-[840px]:top-4" ref={panelRef} tabIndex={-1}>
          <SidePanel onClose={() => select(null)} title={t("audit.detail.title")}>
            <AuditDetail entry={entry} />
          </SidePanel>
        </div>
      ) : null}
    </div>
  );
}
