import type { KeyboardEvent } from "react";
import { codeLabel, codeLabelFromKoreanLabel } from "@/lib/i18n/codes";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { CustomerVisitCandidateDto, CustomerVisitHistoryRowDto } from "@/modules/calls/service-call-service";
import { customerVisitLedgerPath } from "@/app/(erp)/calls/customer-visit-search";

const inputClassName =
  "h-11 w-full border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-brand";
const optionClassName =
  "flex min-h-11 w-full items-center justify-between gap-3 border-l-4 px-3 py-2 text-left hover:bg-readonly motion-safe:transition-colors motion-safe:duration-200 motion-reduce:transition-none";
const headCellClassName = "border-b border-border px-3 py-2 font-semibold";

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
  const showSide = historyOpen || candidates.length > 0;

  return (
    <section aria-label={label} className="mb-4 border border-border bg-surface">
      <div className={showSide ? "grid grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]" : ""}>
        <div className={`px-4 py-3 ${showSide ? "border-r border-border" : "max-w-xl"}`}>
          <label className="grid gap-1.5" htmlFor="customer-visit-search">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <span className="relative block">
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                aria-activedescendant={activeId}
                aria-autocomplete="list"
                aria-controls={candidates.length > 0 ? "customer-visit-candidates" : undefined}
                aria-describedby="customer-visit-search-hint"
                aria-expanded={candidates.length > 0}
                autoComplete="off"
                className={inputClassName}
                id="customer-visit-search"
                onBlur={onQueryBlur}
                onChange={(event) => onQueryChange(event.target.value)}
                onFocus={onQueryFocus}
                onKeyDown={onQueryKeyDown}
                placeholder={t(locale, "calls.search.placeholder")}
                role="combobox"
                type="search"
                value={query}
              />
            </span>
          </label>
          <p className="mt-1.5 text-xs text-muted" id="customer-visit-search-hint">
            {t(locale, "calls.search.hint")}
          </p>
          {showEmpty ? (
            <p className="mt-3 border border-border bg-readonly/50 px-3 py-2 text-sm text-foreground" role="status">
              {t(locale, "calls.search.empty")}
            </p>
          ) : null}
          {candidates.length > 0 ? (
            <ul aria-label={label} className="mt-3 max-h-72 overflow-y-auto border border-border" id="customer-visit-candidates" role="listbox">
              {candidates.map((candidate, index) => {
                const chosen =
                  (candidate.kind === "customer" && candidate.customerId !== null && candidate.customerId === selectedCustomerId) ||
                  (candidate.kind === "memo" && selectedMemo !== null && candidate.label === selectedMemo);
                const active = index === activeIndex;
                return (
                  <li className="border-b border-border last:border-b-0" key={`${candidate.kind}:${candidate.customerId ?? ""}:${candidate.label}`} role="presentation">
                    <button
                      aria-current={chosen ? "true" : undefined}
                      aria-selected={active}
                      className={`${optionClassName} ${chosen ? "border-l-brand bg-brand/10" : active ? "border-l-brand/40 bg-readonly" : "border-l-transparent bg-surface"}`}
                      id={`customer-visit-option-${index}`}
                      onClick={() => onSelect(candidate)}
                      role="option"
                      tabIndex={-1}
                      type="button"
                    >
                      <span className="grid min-w-0 gap-0.5">
                        <span className={`truncate text-sm text-foreground ${chosen ? "font-semibold" : "font-medium"}`}>{candidateTitle(candidate)}</span>
                        <span className="text-xs text-muted">
                          {candidate.kind === "customer" ? t(locale, "calls.search.kind.customer") : t(locale, "calls.search.kind.memo")}
                        </span>
                      </span>
                      {candidate.latestVisitDate ? (
                        <span className="shrink-0 text-xs text-muted [font-variant-numeric:tabular-nums]">
                          {t(locale, "calls.search.latestVisit", { date: candidate.latestVisitDate })}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        {showSide ? (
          <div className="min-w-0">
            {historyOpen ? (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                  <caption className="border-b border-border px-4 py-3 text-left">
                    <span className="text-sm font-semibold text-foreground">{t(locale, "calls.search.history")}</span>
                    <span className="ml-2 text-xs text-muted">{t(locale, "calls.search.historyCount", { count: rows.length })}</span>
                  </caption>
                  <thead className="bg-readonly text-xs text-foreground">
                    <tr>
                      <th className={headCellClassName} scope="col">{t(locale, "calls.search.column.date")}</th>
                      <th className={headCellClassName} scope="col">{t(locale, "calls.search.column.time")}</th>
                      <th className={headCellClassName} scope="col">{t(locale, "calls.search.column.course")}</th>
                      <th className={headCellClassName} scope="col">{t(locale, "calls.search.column.therapist")}</th>
                      <th className={headCellClassName} scope="col">{t(locale, "calls.search.column.status")}</th>
                      <th className={headCellClassName} scope="col">{t(locale, "calls.search.column.customerMemo")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr className="border-b border-border last:border-b-0 hover:bg-readonly/40" key={row.serviceCallId}>
                        <td className="px-3">
                          <a
                            className="inline-flex min-h-11 items-center font-medium text-brand-strong underline underline-offset-4 decoration-brand/40 hover:decoration-brand [font-variant-numeric:tabular-nums]"
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
            ) : (
              <p className="flex h-full min-h-24 items-center px-4 py-3 text-sm text-muted">{t(locale, "calls.search.pickHint")}</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
