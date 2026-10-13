import type { KeyboardEvent } from "react";
import { codeLabel, codeLabelFromKoreanLabel } from "@/lib/i18n/codes";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { CustomerVisitCandidateDto, CustomerVisitHistoryRowDto } from "@/modules/calls/service-call-service";
import { customerVisitLedgerPath } from "@/app/(erp)/calls/customer-visit-search";

const inputClassName =
  "h-11 w-full border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand";
const optionClassName =
  "min-h-11 w-full px-3 py-2 text-left motion-safe:transition-colors motion-safe:duration-200 motion-reduce:transition-none";

function visitStatusLabel(locale: Locale, status: string) {
  const fromCode = codeLabel(locale, "SERVICE_STATUS", status, true);
  if (fromCode !== status) return fromCode;
  return codeLabelFromKoreanLabel(locale, "SERVICE_STATUS", status);
}

function candidateTitle(candidate: CustomerVisitCandidateDto) {
  return candidate.phone ? `${candidate.label} · ${candidate.phone}` : candidate.label;
}

export function CustomerVisitSearchView({
  locale,
  query,
  settledQuery,
  candidates,
  rows,
  historyOpen,
  activeIndex,
  selectedCustomerId,
  selectedMemo,
  onQueryChange,
  onQueryKeyDown,
  onQueryFocus,
  onQueryBlur,
  onSelect
}: {
  locale: Locale;
  query: string;
  settledQuery: string;
  candidates: CustomerVisitCandidateDto[];
  rows: CustomerVisitHistoryRowDto[];
  historyOpen: boolean;
  activeIndex: number;
  selectedCustomerId: string | null;
  selectedMemo: string | null;
  onQueryChange: (value: string) => void;
  onQueryKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onQueryFocus?: () => void;
  onQueryBlur?: () => void;
  onSelect: (candidate: CustomerVisitCandidateDto) => void;
}) {
  const label = t(locale, "calls.search.label");
  const showEmpty = settledQuery.trim() !== "" && query.trim() === settledQuery.trim() && candidates.length === 0;
  const activeId = activeIndex >= 0 ? `customer-visit-option-${activeIndex}` : undefined;

  return (
    <section aria-label={label} className="mb-4 border border-border bg-surface">
      <div className="border-b border-border px-3 py-3">
        <label className="grid max-w-md gap-1" htmlFor="customer-visit-search">
          <span className="text-xs font-medium text-muted">{label}</span>
          <input
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-controls={candidates.length > 0 ? "customer-visit-candidates" : undefined}
            aria-expanded={candidates.length > 0}
            autoComplete="off"
            className={inputClassName}
            id="customer-visit-search"
            onBlur={onQueryBlur}
            onChange={(event) => onQueryChange(event.target.value)}
            onFocus={onQueryFocus}
            onKeyDown={onQueryKeyDown}
            role="combobox"
            value={query}
          />
        </label>
      </div>
      {showEmpty ? <p className="px-3 py-3 text-sm text-muted">{t(locale, "calls.search.empty")}</p> : null}
      {candidates.length > 0 ? (
        <ul aria-label={label} className="border-b border-border" id="customer-visit-candidates" role="listbox">
          {candidates.map((candidate, index) => {
            const chosen =
              (candidate.kind === "customer" && candidate.customerId !== null && candidate.customerId === selectedCustomerId) ||
              (candidate.kind === "memo" && selectedMemo !== null && candidate.label === selectedMemo);
            return (
              <li key={`${candidate.kind}:${candidate.customerId ?? ""}:${candidate.label}`} role="presentation">
                <button
                  aria-current={chosen ? "true" : undefined}
                  aria-selected={index === activeIndex}
                  className={`${optionClassName} ${index === activeIndex ? "bg-readonly" : "bg-surface"} ${chosen ? "font-semibold" : ""}`}
                  id={`customer-visit-option-${index}`}
                  onClick={() => onSelect(candidate)}
                  role="option"
                  tabIndex={-1}
                  type="button"
                >
                  <span className="block text-sm text-foreground">{candidateTitle(candidate)}</span>
                  {candidate.latestVisitDate ? (
                    <span className="block text-xs text-muted [font-variant-numeric:tabular-nums]">
                      {t(locale, "calls.search.latestVisit", { date: candidate.latestVisitDate })}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {historyOpen ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <caption className="px-3 py-2 text-left text-sm font-semibold text-foreground">{t(locale, "calls.search.history")}</caption>
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium" scope="col">{t(locale, "calls.search.column.date")}</th>
                <th className="px-3 py-2 font-medium" scope="col">{t(locale, "calls.search.column.time")}</th>
                <th className="px-3 py-2 font-medium" scope="col">{t(locale, "calls.search.column.course")}</th>
                <th className="px-3 py-2 font-medium" scope="col">{t(locale, "calls.search.column.therapist")}</th>
                <th className="px-3 py-2 font-medium" scope="col">{t(locale, "calls.search.column.status")}</th>
                <th className="px-3 py-2 font-medium" scope="col">{t(locale, "calls.search.column.customerMemo")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t border-border" key={row.serviceCallId}>
                  <td className="px-3">
                    <a
                      className="inline-flex min-h-11 items-center text-brand underline-offset-4 hover:underline [font-variant-numeric:tabular-nums]"
                      href={customerVisitLedgerPath(row.operatingMonthId, row.serviceDate)}
                    >
                      {row.serviceDate}
                    </a>
                  </td>
                  <td className="px-3 [font-variant-numeric:tabular-nums]">{row.startTime}</td>
                  <td className="px-3">{row.courseLabel}</td>
                  <td className="px-3">{row.therapistLabel}</td>
                  <td className="px-3">{visitStatusLabel(locale, row.status)}</td>
                  <td className="px-3">{row.customerMemo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
