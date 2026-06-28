import { StatusBadge } from "@/components/domain/status-badge";
import { canPerform, requireRouteAccess } from "@/lib/authorization";
import { MigrationIssueStatusForm } from "@/app/(erp)/masters/sheet-mapping/issue-status-form";
import {
  buildMigrationVerificationReport,
  listMigrationVerificationIssues,
  migrationVerificationIssueKinds,
  migrationVerificationIssueStatuses,
  parseMigrationVerificationFilters,
  type MigrationVerificationCalculationRow,
  type MigrationVerificationFilters,
  type MigrationVerificationSheetRow
} from "@/modules/migration/migration-verification-report";
import { PageHeader } from "@/components/domain/page-header";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import { type Translator } from "@/lib/i18n";

// Story 7.1 compatibility marker: report service still consumes getSheetMappingSummary().

type SheetMappingSearchParams = Record<string, string | string[] | undefined>;

function masterDateTime(locale: Locale, value: string | null) {
  if (!value) return "-";
  return formatDateTime(locale, value, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });
}

function formatEvidence(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Korean stable issue status key → 표시 라벨. 비교 로직은 한국어 key를 그대로 쓴다. */
function issueStatusLabel(t: Translator, status: string) {
  switch (status) {
    case "통과":
      return t("masters.sheetMapping.status.pass");
    case "재검증 필요":
      return t("masters.sheetMapping.status.reverify");
    case "미확인":
      return t("masters.sheetMapping.status.unconfirmed");
    case "수정중":
      return t("masters.sheetMapping.status.inProgress");
    default:
      return status;
  }
}

function SummaryTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}

function IssueStatusBadge({ status, label }: { status: string; label: string }) {
  const className =
    status === "통과"
      ? "border-success text-success"
      : status === "재검증 필요"
        ? "border-danger text-danger"
        : "border-border text-foreground";

  return <span className={`inline-flex border bg-background px-2 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function FilterSelect({
  name,
  label,
  value,
  options,
  allLabel
}: {
  name: keyof MigrationVerificationFilters;
  label: string;
  value?: string;
  options: string[];
  allLabel: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-muted">
      {label}
      <select className="min-w-36 border border-border bg-background px-2 py-2 text-sm font-normal text-foreground" defaultValue={value ?? ""} name={name}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterPanel({ filters, sheetOptions, t }: { filters: MigrationVerificationFilters; sheetOptions: string[]; t: Translator }) {
  return (
    <form className="mb-5 flex flex-wrap items-end gap-3 border border-border bg-surface px-4 py-4" action="/masters/sheet-mapping">
      <FilterSelect allLabel={t("masters.sheetMapping.filter.all")} label={t("masters.sheetMapping.filter.sheet")} name="sheet" options={sheetOptions} value={filters.sheet} />
      <FilterSelect allLabel={t("masters.sheetMapping.filter.all")} label={t("masters.sheetMapping.filter.fr")} name="fr" options={["FR-36", "FR-37"]} value={filters.fr} />
      <FilterSelect allLabel={t("masters.sheetMapping.filter.all")} label={t("masters.sheetMapping.filter.story")} name="story" options={["Story 7.1", "Story 7.2", "Story 7.3"]} value={filters.story} />
      <FilterSelect allLabel={t("masters.sheetMapping.filter.all")} label={t("masters.sheetMapping.filter.status")} name="status" options={[...migrationVerificationIssueStatuses]} value={filters.status} />
      <FilterSelect allLabel={t("masters.sheetMapping.filter.all")} label={t("masters.sheetMapping.filter.kind")} name="kind" options={[...migrationVerificationIssueKinds]} value={filters.kind} />
      <button className="border border-border bg-foreground px-4 py-2 text-sm font-semibold text-background">{t("masters.sheetMapping.filter.apply")}</button>
      <a className="border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground" href="/masters/sheet-mapping">
        {t("masters.sheetMapping.filter.reset")}
      </a>
    </form>
  );
}

function VerificationTable({
  sheetRows,
  calculationRows,
  locale,
  t
}: {
  sheetRows: MigrationVerificationSheetRow[];
  calculationRows: MigrationVerificationCalculationRow[];
  locale: Locale;
  t: Translator;
}) {
  const rows = [
    ...sheetRows.map((row) => ({
      key: row.itemKey,
      sourceSheet: row.sourceSheet,
      visibility: row.visibility === "hidden" ? t("masters.sheetMapping.visibility.hidden") : t("masters.sheetMapping.visibility.visible"),
      related: `${row.relatedRequirement} / ${row.relatedStory}`,
      mappingStatus: row.mappingStatus === "mapped" ? t("masters.sheetMapping.mapping.mapped") : t("masters.sheetMapping.mapping.missing"),
      calculationStatus: row.calculationStatus === "linked" ? t("masters.sheetMapping.calculation.linked") : t("masters.sheetMapping.calculation.notApplicable"),
      issueStatus: row.issueStatus,
      note: row.lastNote,
      changedAt: row.lastChangedAt
    })),
    ...calculationRows.map((row) => ({
      key: row.itemKey,
      sourceSheet: row.sourceSheet,
      visibility: "-",
      related: `${row.relatedRequirement} / ${row.relatedStory}`,
      mappingStatus: t("masters.sheetMapping.mapping.reference"),
      calculationStatus: row.status === "pass" ? t("masters.sheetMapping.calculation.pass") : t("masters.sheetMapping.calculation.mismatch"),
      issueStatus: row.issueStatus,
      note: row.lastNote ?? row.message,
      changedAt: row.lastChangedAt
    }))
  ];

  return (
    <section className="mb-5 overflow-x-auto border border-border bg-surface" aria-label={t("masters.sheetMapping.table.aria")}>
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold text-muted">
            <th className="px-4 py-3">source sheet</th>
            <th className="px-4 py-3">visibility</th>
            <th className="px-4 py-3">FR / story</th>
            <th className="px-4 py-3">mapping status</th>
            <th className="px-4 py-3">calculation status</th>
            <th className="px-4 py-3">issue status</th>
            <th className="px-4 py-3">{t("masters.sheetMapping.table.lastNoteChangedAt")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-border align-top last:border-0" key={row.key}>
              <td className="px-4 py-4 font-semibold text-foreground">{row.sourceSheet}</td>
              <td className="px-4 py-4 text-foreground">{row.visibility}</td>
              <td className="px-4 py-4 text-foreground">{row.related}</td>
              <td className="px-4 py-4 text-foreground">{row.mappingStatus}</td>
              <td className="px-4 py-4 text-foreground">{row.calculationStatus}</td>
              <td className="px-4 py-4">
                <IssueStatusBadge label={issueStatusLabel(t, row.issueStatus)} status={row.issueStatus} />
              </td>
              <td className="px-4 py-4 text-muted">
                <div>{row.note ?? "-"}</div>
                <div className="mt-1 text-xs">{masterDateTime(locale, row.changedAt)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-foreground">
        {items.length === 0 ? (
          <li>-</li>
        ) : (
          items.map((item) => <li key={item}>- {item}</li>)
        )}
      </ul>
    </div>
  );
}

function SheetEvidenceDetails({ rows, t }: { rows: MigrationVerificationSheetRow[]; t: Translator }) {
  return (
    <section className="mb-5 border border-border bg-surface px-4 py-4" aria-label={t("masters.sheetMapping.evidence.aria")}>
      <h2 className="text-base font-semibold text-foreground">{t("masters.sheetMapping.evidence.title")}</h2>
      <div className="mt-3 grid gap-3">
        {rows.map((row) => (
          <details className="border border-border bg-background px-3 py-3" key={row.itemKey}>
            <summary className="cursor-pointer text-sm font-semibold text-brand underline-offset-4 hover:underline">
              {t("masters.sheetMapping.evidence.summary", { sheet: row.sourceSheet })}
            </summary>
            <div className="mt-3 grid gap-4 border-t border-border pt-3 lg:grid-cols-2">
              <ListBlock items={row.workbookEvidence} title={t("masters.sheetMapping.evidence.workbook")} />
              <ListBlock items={row.erpSurfaces} title={t("masters.sheetMapping.evidence.erpSurfaces")} />
              <ListBlock items={row.preservedRules} title={t("masters.sheetMapping.evidence.preservedRules")} />
              <ListBlock items={row.verificationItems} title={t("masters.sheetMapping.evidence.verificationItems")} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function CalculationDetails({ rows, t }: { rows: MigrationVerificationCalculationRow[]; t: Translator }) {
  return (
    <section className="mb-5 overflow-x-auto border border-border bg-surface" aria-label={t("masters.sheetMapping.calcDetails.aria")}>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("masters.sheetMapping.calcDetails.title")}</h2>
      </div>
      <table className="w-full min-w-[1040px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold text-muted">
            <th className="px-4 py-3">area</th>
            <th className="px-4 py-3">fixture</th>
            <th className="px-4 py-3">{t("masters.sheetMapping.calcDetails.status")}</th>
            <th className="px-4 py-3">{t("masters.sheetMapping.calcDetails.expected")}</th>
            <th className="px-4 py-3">{t("masters.sheetMapping.calcDetails.erpActual")}</th>
            <th className="px-4 py-3">{t("masters.sheetMapping.calcDetails.source")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-border align-top last:border-0" key={row.itemKey}>
              <td className="px-4 py-4 font-semibold text-foreground">{row.area}</td>
              <td className="px-4 py-4 text-foreground">{row.fixtureId}</td>
              <td className="px-4 py-4">
                <IssueStatusBadge
                  label={row.status === "pass" ? t("masters.sheetMapping.status.pass") : t("masters.sheetMapping.calcDetails.unconfirmed")}
                  status={row.status === "pass" ? "통과" : "미확인"}
                />
              </td>
              <td className="max-w-80 px-4 py-4 text-muted">{formatEvidence(row.expected)}</td>
              <td className="max-w-80 px-4 py-4 text-muted">{formatEvidence(row.actual)}</td>
              <td className="max-w-80 px-4 py-4 text-muted">{row.sourceReference}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function OpenIssueTable({
  canWrite,
  issues,
  locale,
  t
}: {
  canWrite: boolean;
  issues: ReturnType<typeof buildMigrationVerificationReport>["openIssueRows"];
  locale: Locale;
  t: Translator;
}) {
  return (
    <section className="mb-5 overflow-x-auto border border-border bg-surface" aria-label={t("masters.sheetMapping.openIssue.aria")}>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("masters.sheetMapping.openIssue.title")}</h2>
      </div>
      <table className="w-full min-w-[1040px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold text-muted">
            <th className="px-4 py-3">{t("masters.sheetMapping.openIssue.item")}</th>
            <th className="px-4 py-3">{t("masters.sheetMapping.openIssue.status")}</th>
            <th className="px-4 py-3">{t("masters.sheetMapping.openIssue.expected")}</th>
            <th className="px-4 py-3">{t("masters.sheetMapping.openIssue.erpActual")}</th>
            <th className="px-4 py-3">{t("masters.sheetMapping.openIssue.handlerNote")}</th>
          </tr>
        </thead>
        <tbody>
          {issues.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-sm font-medium text-foreground" colSpan={5}>
                {t("masters.sheetMapping.openIssue.empty")}
              </td>
            </tr>
          ) : (
            issues.map((issue) => (
              <tr className="border-b border-border align-top last:border-0" key={issue.itemKey}>
                <td className="px-4 py-4">
                  <p className="font-semibold text-foreground">{issue.summary}</p>
                  <p className="mt-1 text-xs text-muted">
                    {issue.itemKey} · {issue.relatedRequirement ?? "-"} · {issue.relatedStory ?? "-"}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <IssueStatusBadge label={issueStatusLabel(t, issue.status)} status={issue.status} />
                </td>
                <td className="max-w-72 px-4 py-4 text-muted">{formatEvidence(issue.expected)}</td>
                <td className="max-w-72 px-4 py-4 text-muted">{formatEvidence(issue.actual)}</td>
                <td className="px-4 py-4">
                  {canWrite ? (
                    <MigrationIssueStatusForm issue={issue} />
                  ) : (
                    <div className="text-muted">
                      <div>{issue.lastNote ?? "-"}</div>
                      <div className="mt-1 text-xs">{masterDateTime(locale, issue.lastChangedAt)}</div>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

export default async function SheetMappingPage({ searchParams }: { searchParams: Promise<SheetMappingSearchParams> }) {
  const account = await requireRouteAccess("/masters/sheet-mapping");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const filters = parseMigrationVerificationFilters(params);
  const persistedIssues = await listMigrationVerificationIssues();
  const report = buildMigrationVerificationReport({ filters, persistedIssues });
  const canWrite = canPerform(account.role, "migration:write");
  const hiddenListRow = report.sheetRows.find((row) => row.sourceSheet === "목록");
  const hiddenListMapped = hiddenListRow?.mappingStatus === "mapped";

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("masters.eyebrow")}
        title={t("masters.sheetMapping.title")}
        description={t("masters.sheetMapping.description")}
        meta={
          <>
            <div>{t("masters.sheetMapping.meta.preservationGoal")}</div>
            <div>{t("masters.sheetMapping.meta.generatedAt", { value: masterDateTime(locale, report.generatedAt) })}</div>
            <div>{canWrite ? t("masters.sheetMapping.meta.canWrite") : t("masters.sheetMapping.meta.readOnly")}</div>
            <div>{t("masters.sheetMapping.meta.noWriteNote")}</div>
          </>
        }
      />

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label={t("masters.sheetMapping.summary.aria")}>
        <SummaryTile
          label={t("masters.sheetMapping.summary.preservationRate")}
          note={report.summary.preservationGoalMet ? t("masters.sheetMapping.summary.goalMet") : t("masters.sheetMapping.summary.goalNotMet")}
          value={`${formatNumber(locale, report.summary.preservationRate)}${t("masters.sheetMapping.percentSuffix")}`}
        />
        <SummaryTile
          label={t("masters.sheetMapping.summary.missingItems")}
          note={t("masters.sheetMapping.summary.missingItemsNote")}
          value={`${formatNumber(locale, report.summary.missingSheetCount)}${t("masters.sheetMapping.countSuffix")}`}
        />
        <SummaryTile
          label={t("masters.sheetMapping.summary.calcPass")}
          note={t("masters.sheetMapping.summary.calcPassNote", { status: report.summary.coreCalculationStatus })}
          value={`${formatNumber(locale, report.summary.calculationPassCount)}${t("masters.sheetMapping.countSuffix")}`}
        />
        <SummaryTile
          label={t("masters.sheetMapping.summary.calcMismatch")}
          note={t("masters.sheetMapping.summary.calcMismatchNote")}
          value={`${formatNumber(locale, report.summary.calculationMismatchCount)}${t("masters.sheetMapping.countSuffix")}`}
        />
        <SummaryTile
          label={t("masters.sheetMapping.summary.openIssues")}
          note={t("masters.sheetMapping.summary.openIssuesNote")}
          value={`${formatNumber(locale, report.summary.openIssueCount)}${t("masters.sheetMapping.countSuffix")}`}
        />
      </section>

      <section
        className={`mb-5 border px-4 py-4 ${hiddenListMapped ? "border-border bg-surface" : "border-danger bg-surface"}`}
        role={hiddenListMapped ? "status" : "alert"}
      >
        <h2 className="text-base font-semibold text-foreground">{t("masters.sheetMapping.gate.title")}</h2>
        <p className="mt-2 text-sm text-muted">
          {t("masters.sheetMapping.gate.description", {
            status: hiddenListMapped ? t("masters.sheetMapping.mapping.mapped") : t("masters.sheetMapping.mapping.missing")
          })}
        </p>
      </section>

      <section className="mb-5 border border-border bg-surface px-4 py-4" aria-label={t("masters.sheetMapping.statusTokens.aria")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("masters.sheetMapping.statusTokens.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("masters.sheetMapping.statusTokens.description")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge state="사용중" />
            <StatusBadge state="예약" />
            <StatusBadge state="청소중" />
            <StatusBadge state="종료확인" />
            <StatusBadge state="빈방" />
          </div>
        </div>
      </section>

      <FilterPanel filters={report.filters} sheetOptions={report.sheetRows.map((row) => row.sourceSheet)} t={t} />
      <VerificationTable calculationRows={report.calculationRows} locale={locale} sheetRows={report.sheetRows} t={t} />
      <SheetEvidenceDetails rows={report.sheetRows} t={t} />
      <CalculationDetails rows={report.calculationRows} t={t} />
      <OpenIssueTable canWrite={canWrite} issues={report.openIssueRows} locale={locale} t={t} />
    </main>
  );
}
