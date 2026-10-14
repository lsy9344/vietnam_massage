import type { KeyboardEvent } from "react";
import { SidePanel } from "@/components/ui/panel";
import { codeLabel, codeLabelFromKoreanLabel } from "@/lib/i18n/codes";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { CustomerDto, CustomerVisitCandidateDto, CustomerVisitHistoryRowDto } from "@/modules/calls/service-call-service";
import { ledgerCallHref } from "@/app/(erp)/calls/ledger-address";
import { CustomerEditForm } from "@/app/(erp)/customers/customer-forms";

const cellClassName = "border-b border-border px-3 py-2";

function visitStatusLabel(locale: Locale, status: string) {
  const fromCode = codeLabel(locale, "SERVICE_STATUS", status, true);
  if (fromCode !== status) return fromCode;
  return codeLabelFromKoreanLabel(locale, "SERVICE_STATUS", status);
}

function isChosen(candidate: CustomerVisitCandidateDto, selectedCustomerId: string | null, selectedMemo: string | null) {
  return (
    (candidate.kind === "customer" && candidate.customerId !== null && candidate.customerId === selectedCustomerId) ||
    (candidate.kind === "memo" && selectedMemo !== null && candidate.label === selectedMemo)
  );
}

/**
 * 고객 화면: 검색 캡슐과 후보 목록, 옆에 고른 고객의 패널(고객 정보 정정, 방문 이력).
 * 후보는 콜 서비스 검색(searchCustomerVisitCandidates)이 준 그대로다.
 */
export function CustomerScreenView({
  locale,
  query,
  settledQuery,
  candidates,
  activeIndex,
  customer,
  selectedMemo,
  history,
  onQueryChange,
  onQueryKeyDown,
  onQueryFocus,
  onQueryBlur,
  onSelect,
  onClose
}: {
  locale: Locale;
  query: string;
  settledQuery: string;
  candidates: CustomerVisitCandidateDto[];
  activeIndex: number;
  /** 고른 고객. 고객 기록이 없는 콜의 고객/메모를 골랐으면 null이고 selectedMemo가 있다. */
  customer: CustomerDto | null;
  selectedMemo: string | null;
  history: CustomerVisitHistoryRowDto[];
  onQueryChange: (value: string) => void;
  onQueryKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onQueryFocus?: () => void;
  onQueryBlur?: () => void;
  onSelect: (candidate: CustomerVisitCandidateDto) => void;
  onClose: () => void;
}) {
  const label = t(locale, "calls.search.label");
  const showEmpty = settledQuery.trim() !== "" && query.trim() === settledQuery.trim() && candidates.length === 0;
  const activeId = activeIndex >= 0 ? `customer-option-${activeIndex}` : undefined;
  const panelOpen = customer !== null || selectedMemo !== null;

  return (
    <div className={panelOpen ? "grid grid-cols-1 items-start gap-6 min-[840px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : "grid grid-cols-1 gap-6"}>
      <section aria-label={label} className="grid gap-3">
        <label className="grid gap-1.5" htmlFor="customer-search">
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </label>
        <div className="flex h-11 items-center rounded-full border border-border-strong bg-surface px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-secondary">
          <input
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-controls={candidates.length > 0 ? "customer-candidates" : undefined}
            aria-describedby="customer-search-hint"
            aria-expanded={candidates.length > 0}
            autoComplete="off"
            className="h-full w-full bg-transparent text-sm text-foreground outline-none"
            id="customer-search"
            onBlur={onQueryBlur}
            onChange={(event) => onQueryChange(event.target.value)}
            onFocus={onQueryFocus}
            onKeyDown={onQueryKeyDown}
            role="combobox"
            value={query}
          />
        </div>
        <p className="text-xs text-faint" id="customer-search-hint">
          {t(locale, "customers.search.hint")}
        </p>
        {showEmpty ? <p className="text-sm text-muted">{t(locale, "calls.search.empty")}</p> : null}
        {candidates.length > 0 ? (
          <ul aria-label={label} className="grid gap-2" id="customer-candidates" role="listbox">
            {candidates.map((candidate, index) => {
              const chosen = isChosen(candidate, customer?.id ?? null, selectedMemo);
              const active = index === activeIndex;
              return (
                <li key={`${candidate.kind}:${candidate.customerId ?? ""}:${candidate.label}`} role="presentation">
                  <button
                    aria-current={chosen ? "true" : undefined}
                    aria-selected={active}
                    className={`flex min-h-14 w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-4 py-2 text-left transition-colors hover:bg-readonly ${
                      chosen ? "bg-readonly [box-shadow:inset_3px_0_0_var(--brand)]" : "bg-surface"
                    } ${active ? "outline-2 outline-offset-2 outline-brand-secondary" : ""}`}
                    id={`customer-option-${index}`}
                    onClick={() => onSelect(candidate)}
                    role="option"
                    tabIndex={-1}
                    type="button"
                  >
                    <span className="text-sm font-semibold text-foreground">{candidate.label}</span>
                    {candidate.latestVisitDate ? (
                      <span className="inline-flex h-7 items-center rounded-full border border-border bg-surface-float px-2.5 text-xs font-semibold text-foreground">
                        {t(locale, "calls.search.latestVisit", { date: candidate.latestVisitDate })}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {panelOpen ? (
        <SidePanel onClose={onClose} title={customer ? customer.name : selectedMemo || "—"}>
          <div className="grid gap-6">
            {customer ? (
              <section aria-label={t(locale, "customers.detail.info")} className="grid gap-3">
                <h3 className="text-[0.9375rem] font-semibold text-foreground">{t(locale, "customers.detail.info")}</h3>
                <CustomerEditForm customer={customer} key={customer.id} />
              </section>
            ) : (
              <p className="text-sm text-muted">{t(locale, "customers.detail.memoOnly")}</p>
            )}
            <section aria-label={t(locale, "calls.search.history")} className="grid gap-3">
              <h3 className="text-[0.9375rem] font-semibold text-foreground">{t(locale, "calls.search.history")}</h3>
              {history.length === 0 ? (
                <p className="text-sm text-muted">{t(locale, "customers.history.empty")}</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border bg-surface">
                  <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                    <thead className="bg-readonly text-xs font-semibold text-muted">
                      <tr>
                        <th className={cellClassName} scope="col">{t(locale, "calls.search.column.date")}</th>
                        <th className={cellClassName} scope="col">{t(locale, "calls.search.column.time")}</th>
                        <th className={cellClassName} scope="col">{t(locale, "calls.search.column.course")}</th>
                        <th className={cellClassName} scope="col">{t(locale, "calls.search.column.therapist")}</th>
                        <th className={cellClassName} scope="col">{t(locale, "calls.search.column.status")}</th>
                        <th className={cellClassName} scope="col">{t(locale, "calls.search.column.customerMemo")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((visit) => (
                        <tr className="hover:bg-readonly" key={visit.serviceCallId}>
                          <td className={cellClassName}>
                            {/* 그 날짜 원장의 그 콜로 간다. 콜 상세 패널은 티켓 13. */}
                            <a
                              className="inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
                              href={ledgerCallHref(visit)}
                            >
                              {visit.serviceDate}
                            </a>
                          </td>
                          <td className={cellClassName}>{visit.startTime}</td>
                          <td className={cellClassName}>{visit.courseLabel}</td>
                          <td className={cellClassName}>{visit.therapistLabel}</td>
                          <td className={cellClassName}>{visitStatusLabel(locale, visit.status)}</td>
                          <td className={cellClassName}>{visit.customerMemo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </SidePanel>
      ) : null}
    </div>
  );
}
