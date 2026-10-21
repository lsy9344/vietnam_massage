import Link from "next/link";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { ListboxSelect } from "@/components/ui/listbox-select";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { SummaryCard, SummaryCards } from "@/components/ui/summary-card";
import { Cell, HeadCell, MasterTable } from "@/app/(erp)/masters/master-parts";
import { MASTER_ITEM_PARAM, readMasterItem } from "@/app/(erp)/masters/master-view-model";
import { OpenIssueWorkspace, type OpenIssueView } from "@/app/(erp)/masters/sheet-mapping/open-issue-workspace";
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
import { getServerTranslator } from "@/lib/i18n/server";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import { roomStatusLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import { type Translator } from "@/lib/i18n";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

// Story 7.1 compatibility marker: report service still consumes getSheetMappingSummary().

type SheetMappingSearchParams = Record<string, string | string[] | undefined>;

function masterDateTime(locale: Locale, value: string | null) {
  if (!value) return "-";
  return formatDateTime(locale, value, { dateStyle: "medium", timeStyle: "short" });
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

const issueStatusTones: Record<string, StatusTone> = {
  통과: "success",
  "재검증 필요": "warning",
  수정중: "info",
  미확인: "neutral"
};

function IssueStatusBadge({ status, label }: { status: string; label: string }) {
  return <StatusIndicator label={label} tone={issueStatusTones[status] ?? "neutral"} />;
}

function kindLabel(t: Translator, kind: string) {
  switch (kind) {
    case "sheet_mapping":
      return t("masters.sheetMapping.kind.sheetMapping");
    case "calculation_comparison":
      return t("masters.sheetMapping.kind.calculationComparison");
    case "manual_risk":
      return t("masters.sheetMapping.kind.manualRisk");
    default:
      return kind;
  }
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
  options: Array<{ value: string; label: string }>;
  allLabel: string;
}) {
  const id = `sheet-mapping-filter-${name}`;
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-semibold text-foreground" htmlFor={id}>
        {label}
      </label>
      <ListboxSelect
        className="min-w-36"
        defaultValue={value ?? ""}
        id={id}
        name={name}
        options={[{ label: allLabel, value: "" }, ...options]}
      />
    </div>
  );
}

const plainOptions = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

function FilterPanel({ filters, sheetOptions, t }: { filters: MigrationVerificationFilters; sheetOptions: string[]; t: Translator }) {
  return (
    <form className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4" action="/masters/sheet-mapping">
      <FilterSelect allLabel={t("masters.sheetMapping.filter.all")} label={t("masters.sheetMapping.filter.sheet")} name="sheet" options={plainOptions(sheetOptions)} value={filters.sheet} />
      <FilterSelect allLabel={t("masters.sheetMapping.filter.all")} label={t("masters.sheetMapping.filter.fr")} name="fr" options={plainOptions(["FR-36", "FR-37"])} value={filters.fr} />
      <FilterSelect allLabel={t("masters.sheetMapping.filter.all")} label={t("masters.sheetMapping.filter.story")} name="story" options={plainOptions(["Story 7.1", "Story 7.2", "Story 7.3"])} value={filters.story} />
      <FilterSelect
        allLabel={t("masters.sheetMapping.filter.all")}
        label={t("masters.sheetMapping.filter.status")}
        name="status"
        options={migrationVerificationIssueStatuses.map((status) => ({ value: status, label: issueStatusLabel(t, status) }))}
        value={filters.status}
      />
      <FilterSelect
        allLabel={t("masters.sheetMapping.filter.all")}
        label={t("masters.sheetMapping.filter.kind")}
        name="kind"
        options={migrationVerificationIssueKinds.map((kind) => ({ value: kind, label: kindLabel(t, kind) }))}
        value={filters.kind}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary">
          {t("masters.sheetMapping.filter.apply")}
        </Button>
        <Link
          className="inline-flex h-11 items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
          href="/masters/sheet-mapping"
        >
          {t("masters.sheetMapping.filter.reset")}
        </Link>
      </div>
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
    <section aria-label={t("masters.sheetMapping.table.aria")} className="mb-6">
      <MasterTable
        head={
          <>
            <HeadCell>{t("masters.sheetMapping.table.sourceSheet")}</HeadCell>
            <HeadCell>{t("masters.sheetMapping.table.visibility")}</HeadCell>
            <HeadCell>{t("masters.sheetMapping.table.related")}</HeadCell>
            <HeadCell>{t("masters.sheetMapping.table.mappingStatus")}</HeadCell>
            <HeadCell>{t("masters.sheetMapping.table.calculationStatus")}</HeadCell>
            <HeadCell>{t("masters.sheetMapping.table.issueStatus")}</HeadCell>
            <HeadCell>{t("masters.sheetMapping.table.lastNoteChangedAt")}</HeadCell>
          </>
        }
        label={t("masters.sheetMapping.table.aria")}
        minWidth="min-w-[68rem]"
      >
        {rows.map((row) => (
          <tr className="align-top transition-colors hover:bg-readonly" key={row.key}>
            <Cell>
              <span className="font-semibold text-foreground">{row.sourceSheet}</span>
            </Cell>
            <Cell>{row.visibility}</Cell>
            <Cell>{row.related}</Cell>
            <Cell>{row.mappingStatus}</Cell>
            <Cell>{row.calculationStatus}</Cell>
            <Cell>
              <IssueStatusBadge label={issueStatusLabel(t, row.issueStatus)} status={row.issueStatus} />
            </Cell>
            <Cell muted>
              <div>{row.note ?? "-"}</div>
              <div className="mt-1 text-xs">{masterDateTime(locale, row.changedAt)}</div>
            </Cell>
          </tr>
        ))}
      </MasterTable>
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-foreground">
        {items.length === 0 ? <li>-</li> : items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function SheetEvidenceDetails({ rows, t }: { rows: MigrationVerificationSheetRow[]; t: Translator }) {
  return (
    <section className="mb-6 grid gap-3" aria-label={t("masters.sheetMapping.evidence.aria")}>
      <h2 className="text-[0.9375rem] font-semibold text-foreground">{t("masters.sheetMapping.evidence.title")}</h2>
      <div className="grid gap-2">
        {rows.map((row) => (
          <details className="rounded-md border border-border bg-surface" key={row.itemKey}>
            <summary className="flex min-h-11 cursor-pointer items-center rounded-md px-4 text-sm font-semibold text-foreground transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary">
              {t("masters.sheetMapping.evidence.summary", { sheet: row.sourceSheet })}
            </summary>
            <div className="grid gap-4 border-t border-border p-4 lg:grid-cols-2">
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
    <section className="mb-6 grid gap-3" aria-label={t("masters.sheetMapping.calcDetails.aria")}>
      <h2 className="text-[0.9375rem] font-semibold text-foreground">{t("masters.sheetMapping.calcDetails.title")}</h2>
      <MasterTable
        head={
          <>
            <HeadCell>{t("masters.sheetMapping.calcDetails.area")}</HeadCell>
            <HeadCell>{t("masters.sheetMapping.calcDetails.fixture")}</HeadCell>
            <HeadCell>{t("masters.sheetMapping.calcDetails.status")}</HeadCell>
            <HeadCell>{t("masters.sheetMapping.calcDetails.expected")}</HeadCell>
            <HeadCell>{t("masters.sheetMapping.calcDetails.erpActual")}</HeadCell>
            <HeadCell>{t("masters.sheetMapping.calcDetails.source")}</HeadCell>
          </>
        }
        label={t("masters.sheetMapping.calcDetails.title")}
        minWidth="min-w-[64rem]"
      >
        {rows.map((row) => (
          <tr className="align-top transition-colors hover:bg-readonly" key={row.itemKey}>
            <Cell>
              <span className="font-semibold text-foreground">{row.area}</span>
            </Cell>
            <Cell>{row.fixtureId}</Cell>
            <Cell>
              <IssueStatusBadge
                label={row.status === "pass" ? t("masters.sheetMapping.status.pass") : t("masters.sheetMapping.calcDetails.unconfirmed")}
                status={row.status === "pass" ? "통과" : "미확인"}
              />
            </Cell>
            <Cell muted>
              <span className="block max-w-80 break-words">{formatEvidence(row.expected)}</span>
            </Cell>
            <Cell muted>
              <span className="block max-w-80 break-words">{formatEvidence(row.actual)}</span>
            </Cell>
            <Cell muted>
              <span className="block max-w-80 break-words">{row.sourceReference}</span>
            </Cell>
          </tr>
        ))}
      </MasterTable>
    </section>
  );
}

/** 열린 추적을 패널이 그대로 그릴 수 있게 번역·서식까지 마친다. 상태 변경 폼은 쓸 수 있는 역할에게만 넣는다. */
function openIssueViews({
  canWrite,
  issues,
  locale,
  t
}: {
  canWrite: boolean;
  issues: ReturnType<typeof buildMigrationVerificationReport>["openIssueRows"];
  locale: Locale;
  t: Translator;
}): OpenIssueView[] {
  return issues.map((issue) => ({
    itemKey: issue.itemKey,
    summary: issue.summary,
    related: `${issue.relatedRequirement ?? "-"} / ${issue.relatedStory ?? "-"}`,
    status: { label: issueStatusLabel(t, issue.status), tone: issueStatusTones[issue.status] ?? "neutral" },
    expected: formatEvidence(issue.expected),
    actual: formatEvidence(issue.actual),
    lastNote: issue.lastNote ?? "-",
    changedAt: masterDateTime(locale, issue.lastChangedAt),
    form: canWrite ? <MigrationIssueStatusForm issue={issue} /> : null
  }));
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
  const count = (value: number) => formatNumber(locale, value);

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/masters/sheet-mapping" title={t("masters.sheetMapping.title")} />
      <div className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>{t("masters.sheetMapping.meta.preservationGoal")}</span>
        <span>{t("masters.sheetMapping.meta.generatedAt", { value: masterDateTime(locale, report.generatedAt) })}</span>
        <span>{canWrite ? t("masters.sheetMapping.meta.canWrite") : t("masters.sheetMapping.meta.readOnly")}</span>
        <span>{t("masters.sheetMapping.meta.noWriteNote")}</span>
      </div>

      <SummaryCards className="mb-6" label={t("masters.sheetMapping.summary.aria")}>
        <SummaryCard
          accent="mint"
          label={t("masters.sheetMapping.summary.preservationRate")}
          note={report.summary.preservationGoalMet ? t("masters.sheetMapping.summary.goalMet") : t("masters.sheetMapping.summary.goalNotMet")}
          value={`${count(report.summary.preservationRate)}${t("masters.sheetMapping.percentSuffix")}`}
        />
        <SummaryCard
          accent="mint"
          label={t("masters.sheetMapping.summary.missingItems")}
          note={t("masters.sheetMapping.summary.missingItemsNote")}
          value={`${count(report.summary.missingSheetCount)}${t("masters.sheetMapping.countSuffix")}`}
        />
        <SummaryCard
          accent="mint"
          label={t("masters.sheetMapping.summary.calcMismatch")}
          note={t("masters.sheetMapping.summary.calcPassLine", {
            count: count(report.summary.calculationPassCount),
            status: report.summary.coreCalculationStatus
          })}
          value={`${count(report.summary.calculationMismatchCount)}${t("masters.sheetMapping.countSuffix")}`}
        />
        <SummaryCard
          accent="mint"
          label={t("masters.sheetMapping.summary.openIssues")}
          note={t("masters.sheetMapping.summary.openIssuesNote")}
          value={`${count(report.summary.openIssueCount)}${t("masters.sheetMapping.countSuffix")}`}
        />
      </SummaryCards>

      <section
        className={`mb-6 grid gap-2 rounded-lg border bg-surface p-4 ${hiddenListMapped ? "border-border" : "border-danger"}`}
        role={hiddenListMapped ? "status" : "alert"}
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[0.9375rem] font-semibold text-foreground">{t("masters.sheetMapping.gate.title")}</h2>
          <StatusIndicator
            label={hiddenListMapped ? t("masters.sheetMapping.mapping.mapped") : t("masters.sheetMapping.mapping.missing")}
            tone={hiddenListMapped ? "success" : "danger"}
          />
        </div>
        <p className="text-sm text-muted">
          {t("masters.sheetMapping.gate.description", {
            status: hiddenListMapped ? t("masters.sheetMapping.mapping.mapped") : t("masters.sheetMapping.mapping.missing")
          })}
        </p>
      </section>

      <section className="mb-6 rounded-lg border border-border bg-surface p-4" aria-label={t("masters.sheetMapping.statusTokens.aria")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[0.9375rem] font-semibold text-foreground">{t("masters.sheetMapping.statusTokens.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("masters.sheetMapping.statusTokens.description")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["사용중", "예약", "청소중", "종료확인", "빈방"] as const).map((state) => (
              <StatusBadge
                key={state}
                state={state}
                label={roomStatusLabel(locale, state)}
                ariaLabel={t("roomStatus.aria", { status: roomStatusLabel(locale, state) })}
              />
            ))}
          </div>
        </div>
      </section>

      <FilterPanel filters={report.filters} sheetOptions={report.sheetRows.map((row) => row.sourceSheet)} t={t} />
      <VerificationTable calculationRows={report.calculationRows} locale={locale} sheetRows={report.sheetRows} t={t} />
      <SheetEvidenceDetails rows={report.sheetRows} t={t} />
      <CalculationDetails rows={report.calculationRows} t={t} />
      <OpenIssueWorkspace
        initialItem={readMasterItem(params[MASTER_ITEM_PARAM])}
        issues={openIssueViews({ canWrite, issues: report.openIssueRows, locale, t })}
      />
    </div>
  );
}
