import Link from "next/link";
import { PageHeader } from "@/components/domain/page-header";
import { requireRouteAccess } from "@/lib/authorization";
import { selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatCurrencyVnd } from "@/lib/i18n/format";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n";
import {
  getMonthlyClosingSnapshot,
  MonthlyClosingDomainError,
  type MonthlyClosingDto
} from "@/modules/closing/monthly-closing-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import {
  listOpsMonthlyIncentivePreview,
  type OpsMonthlyIncentiveResultDto
} from "@/modules/settlements/ops-monthly-incentive-service";

type OpsMonthlyIncentivePageSearchParams = {
  operatingMonthId?: string;
};

function SettlementTabs({ t }: { t: Translator }) {
  return (
    <nav aria-label={t("settlements.tabs.aria")} className="mb-4 flex flex-wrap gap-2">
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements">
        {t("settlements.tabs.therapistDaily")}
      </Link>
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements/earcare">
        {t("settlements.tabs.earcareDaily")}
      </Link>
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements/operations">
        {t("settlements.tabs.opsDaily")}
      </Link>
      <Link className="border border-brand bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground" href="/settlements/operations/monthly">
        {t("settlements.tabs.opsMonthly")}
      </Link>
    </nav>
  );
}

function formatVnd(locale: Locale, t: Translator, amount: number) {
  return `${formatCurrencyVnd(locale, amount)} ${t("settlements.vndSuffix")}`;
}

function formatShare(value: number) {
  return `${Math.round(value * 10000) / 100}%`;
}

function warningTotal(result: OpsMonthlyIncentiveResultDto) {
  return (
    result.warningCounts.notCompleted +
    result.warningCounts.coursePolicyMissing +
    result.warningCounts.therapistRateMissing +
    result.warningCounts.secondTherapistRequired
  );
}

function thresholdLabel(t: Translator, result: OpsMonthlyIncentiveResultDto) {
  if (result.ruleStatus === "missing_policy") return t("settlements.opsMonthly.threshold.missingPolicy");
  if (result.ruleStatus === "below_threshold") return t("settlements.opsMonthly.threshold.belowThreshold");
  return t("settlements.opsMonthly.threshold.applied", { count: result.appliedThresholdCallCount ?? 0 });
}

function PreviewNotice({ locale, t, selectedMonth, result }: { locale: Locale; t: Translator; selectedMonth: { status: string }; result: OpsMonthlyIncentiveResultDto }) {
  const isClosed = result.isClosedOrLocked;
  const isReopenedReview = selectedMonth.status === "검토중";
  return (
    <section className="mb-4 border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
          {isClosed ? t("settlements.opsMonthly.preview.current") : t("settlements.opsMonthly.preview.draft")}
        </span>
        <span className="text-sm font-semibold text-foreground">{t("common.operatingMonthStatusPrefix")}: {operatingMonthStatusLabel(locale, selectedMonth.status)}</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {isClosed
          ? t("settlements.opsMonthly.preview.closedDescription")
          : isReopenedReview
            ? t("settlements.opsMonthly.preview.reviewDescription")
            : t("settlements.opsMonthly.preview.draftDescription")}
      </p>
    </section>
  );
}

function SnapshotSummary({ locale, t, closing, currentStatus }: { locale: Locale; t: Translator; closing: MonthlyClosingDto; currentStatus: string }) {
  const operations = closing.snapshot.operations;
  const isHistoricalAfterReopen = currentStatus === "검토중" && closing.reopenedAt !== null;
  const label = isHistoricalAfterReopen ? t("settlements.opsMonthly.snapshot.previous") : t("settlements.opsMonthly.snapshot.confirmed");
  const heading = isHistoricalAfterReopen
    ? t("settlements.opsMonthly.snapshot.headingPrevious", { monthKey: closing.snapshot.month.monthKey })
    : t("settlements.opsMonthly.snapshot.headingConfirmed", { monthKey: closing.snapshot.month.monthKey });
  return (
    <section className="mb-4 border border-border bg-surface px-4 py-3" aria-label={t("settlements.opsMonthly.snapshot.aria", { label })}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex border border-success bg-success/10 px-2 py-1 text-xs font-semibold text-success">{label}</div>
          <h2 className="mt-2 text-base font-semibold text-foreground">{heading}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("settlements.opsMonthly.snapshot.meta", { id: closing.snapshot.id, version: closing.closeVersion, confirmedAt: closing.confirmedAt })}
          </p>
          {isHistoricalAfterReopen ? <p className="mt-1 text-sm text-muted">{t("settlements.opsMonthly.snapshot.currentEditable")}</p> : null}
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-muted">{t("settlements.opsMonthly.snapshot.totalPayout")}</div>
          <div className="text-lg font-semibold text-foreground tabular-nums">{formatVnd(locale, t, operations.totalOpsPayoutAmount)}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        <div className="border border-border bg-background px-3 py-2">
          <div className="text-xs text-muted">{t("settlements.opsMonthly.snapshot.dailyIncentive")}</div>
          <div className="font-semibold tabular-nums">{formatVnd(locale, t, operations.dailyIncentiveAmount)}</div>
        </div>
        <div className="border border-border bg-background px-3 py-2">
          <div className="text-xs text-muted">{t("settlements.opsMonthly.snapshot.monthlyIncentive")}</div>
          <div className="font-semibold tabular-nums">{formatVnd(locale, t, operations.monthlyIncentiveAmount)}</div>
        </div>
        <div className="border border-border bg-background px-3 py-2">
          <div className="text-xs text-muted">{t("settlements.opsMonthly.snapshot.monthlyTotalCalls")}</div>
          <div className="font-semibold tabular-nums">{operations.monthlyOpsCallCredit}{t("settlements.callSuffix")}</div>
        </div>
      </div>
    </section>
  );
}

function OpsMonthlySummary({ locale, t, result }: { locale: Locale; t: Translator; result: OpsMonthlyIncentiveResultDto }) {
  return (
    <section aria-label={t("settlements.opsMonthly.summary.aria")} className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">{t("settlements.opsMonthly.summary.monthlyTotalCalls")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{result.monthlyOpsCallCredit}{t("settlements.callSuffix")}</div>
        <div className="mt-1 text-xs text-muted">{t("settlements.opsMonthly.summary.monthlyTotalCallsBasis", { count: result.sourceCallCount })}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">{t("settlements.opsMonthly.summary.appliedThreshold")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{thresholdLabel(t, result)}</div>
        <div className="mt-1 text-xs text-muted">{t("settlements.opsMonthly.summary.totalMonthly", { amount: formatVnd(locale, t, result.totalMonthlyIncentiveAmount) })}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">{t("settlements.opsMonthly.summary.employeeTotal")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">
          {formatVnd(locale, t, result.rows.reduce((sum, row) => sum + row.payoutAmount, 0))}
        </div>
        <div className="mt-1 text-xs text-muted">{t("settlements.opsMonthly.summary.undistributed", { amount: formatVnd(locale, t, result.shares.undistributedAmount) })}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">{t("settlements.opsMonthly.summary.warningExcluded")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{warningTotal(result)}{t("settlements.countSuffix")}</div>
        <div className="mt-1 text-xs text-muted">
          {t("settlements.opsMonthly.summary.warningBreakdown", {
            notCompleted: result.warningCounts.notCompleted,
            policyMissing: result.warningCounts.coursePolicyMissing,
            rateMissing: result.warningCounts.therapistRateMissing,
            secondRequired: result.warningCounts.secondTherapistRequired
          })}
        </div>
      </div>
    </section>
  );
}

function ShareSummary({ locale, t, result }: { locale: Locale; t: Translator; result: OpsMonthlyIncentiveResultDto }) {
  const rows = [
    [t("settlements.opsMonthly.share.lead"), result.shares.leadShare, result.shares.leadAmount],
    [t("settlements.opsMonthly.share.counterTeam"), result.shares.counterTeamShare, result.shares.counterTeamAmount],
    [t("settlements.opsMonthly.share.waiterTeam"), result.shares.waiterTeamShare, result.shares.waiterTeamAmount]
  ] as const;
  return (
    <section className="mb-4 border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.opsMonthly.share.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("settlements.opsMonthly.share.description")}</p>
      </div>
      <div className="grid gap-0 sm:grid-cols-3">
        {rows.map(([label, share, amount]) => (
          <div key={label} className="border-b border-border px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{formatVnd(locale, t, amount)}</div>
            <div className="mt-1 text-xs text-muted">{t("settlements.opsMonthly.share.ratio", { value: formatShare(share) })}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmployeePayoutTable({ locale, t, result }: { locale: Locale; t: Translator; result: OpsMonthlyIncentiveResultDto }) {
  if (result.rows.length === 0) {
    return (
      <section className="mb-4 border border-border bg-surface px-4 py-5">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.opsMonthly.employeeTable.empty.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settlements.opsMonthly.employeeTable.empty.description")}</p>
      </section>
    );
  }

  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.opsMonthly.employeeTable.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("settlements.opsMonthly.employeeTable.description")}</p>
      </div>
      <table className="min-w-[980px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">{t("settlements.opsMonthly.column.opsStaff")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.opsMonthly.column.position")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.opsMonthly.column.teamRole")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.opsMonthly.column.shareTeamPortion")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("settlements.opsMonthly.column.expectedPayout")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.opsMonthly.column.basis")}</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.employeeId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2">
                <div className="font-semibold text-foreground">{row.displayName}</div>
                <div className="text-xs text-muted">{row.staffCode}</div>
              </td>
              <td className="px-3 py-2">{row.position}</td>
              <td className="px-3 py-2">{row.teamShareLabel}</td>
              <td className="px-3 py-2">{row.calculationBasis}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(locale, t, row.payoutAmount)}</td>
              <td className="px-3 py-2 text-muted">{row.calculationBasis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CallEvidenceTable({ t, result }: { t: Translator; result: OpsMonthlyIncentiveResultDto }) {
  if (result.callEvidence.length === 0) {
    return (
      <section className="mb-4 border border-border bg-surface px-4 py-5">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.opsMonthly.callEvidence.empty.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settlements.opsMonthly.callEvidence.empty.description")}</p>
      </section>
    );
  }

  const visibleEvidence = result.callEvidence.slice(0, 50);
  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.opsMonthly.callEvidence.title")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("settlements.opsMonthly.callEvidence.description", { count: result.callEvidence.length })}
        </p>
      </div>
      <table className="min-w-[640px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">{t("settlements.opsMonthly.callEvidence.callId")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.opsMonthly.callEvidence.serviceDate")}</th>
            <th className="border-b border-border px-3 py-2 text-right">opsCallCredit</th>
          </tr>
        </thead>
        <tbody>
          {visibleEvidence.map((evidence) => (
            <tr key={evidence.serviceCallId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2 font-mono text-xs text-muted">{evidence.serviceCallId}</td>
              <td className="px-3 py-2">{evidence.serviceDate}</td>
              <td className="px-3 py-2 text-right tabular-nums">{evidence.opsCallCredit}{t("settlements.callSuffix")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function OperationsMonthlyIncentivePage({
  searchParams
}: {
  searchParams: Promise<OpsMonthlyIncentivePageSearchParams>;
}) {
  const account = await requireRouteAccess("/settlements/operations/monthly");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow={t("nav.group.settlements")}
          title={t("settlements.opsMonthly.title")}
          description={t("settlements.opsMonthly.emptyDescription")}
        />
        <SettlementTabs t={t} />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">{t("common.createOperatingMonthFirst")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t("settlements.opsMonthly.emptyMonthDescription")}</p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              {t("common.goToOperatingMonths")}
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  let result: OpsMonthlyIncentiveResultDto | null = null;
  let closingSnapshot: MonthlyClosingDto | null = null;
  let snapshotErrorMessage: string | null = null;
  let errorMessage: string | null = null;

  try {
    result = await listOpsMonthlyIncentivePreview({
      operatingMonthId: selectedMonth.id
    });
    if (result.isClosedOrLocked || selectedMonth.status === "검토중") {
      try {
        const snapshot = await getMonthlyClosingSnapshot({
          operatingMonthId: selectedMonth.id
        });
        closingSnapshot = result.isClosedOrLocked || snapshot.reopenedAt !== null ? snapshot : null;
      } catch (error) {
        if (error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND") {
          snapshotErrorMessage = t("settlements.opsMonthly.snapshotNotFound");
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : t("settlements.opsMonthly.error.fallback");
  }

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("nav.group.settlements")}
        title={t("settlements.opsMonthly.title")}
        description={t("settlements.opsMonthly.description")}
        meta={
          <>
            <div>{t("common.operatingMonthStatusPrefix")}: {operatingMonthStatusLabel(locale, selectedMonth.status)}</div>
            <div>
              {t("common.dateRange")}: {selectedMonth.startDate} ~ {selectedMonth.endDate}
            </div>
          </>
        }
      />

      <SettlementTabs t={t} />

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("common.operatingMonth")}
          <select
            aria-label={t("common.operatingMonth")}
            className="h-9 min-w-44 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={selectedMonth.id}
            name="operatingMonthId"
          >
            {operatingMonths.map((month) => (
              <option key={month.id} value={month.id}>
                {t("common.monthOption", { monthKey: month.monthKey, status: operatingMonthStatusLabel(locale, month.status) })}
              </option>
            ))}
          </select>
        </label>
        <button className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
          {t("common.query")}
        </button>
      </form>

      {errorMessage ? (
        <section className="border border-danger bg-surface px-4 py-5" role="alert">
          <h2 className="text-base font-semibold text-danger">{t("settlements.opsMonthly.error.title")}</h2>
          <p className="mt-2 text-sm text-muted">{errorMessage}</p>
          <form className="mt-4" method="get">
            <input name="operatingMonthId" type="hidden" value={selectedMonth.id} />
            <button className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
              {t("settlements.requery")}
            </button>
          </form>
        </section>
      ) : result ? (
        <>
          {closingSnapshot ? <SnapshotSummary locale={locale} t={t} closing={closingSnapshot} currentStatus={selectedMonth.status} /> : null}
          {snapshotErrorMessage ? (
            <section className="mb-4 border border-warning bg-surface px-4 py-3" role="status">
              <h2 className="text-sm font-semibold text-warning">{t("settlements.opsMonthly.snapshotMissing.title")}</h2>
              <p className="mt-1 text-sm text-muted">{snapshotErrorMessage}</p>
            </section>
          ) : null}
          <PreviewNotice locale={locale} t={t} result={result} selectedMonth={selectedMonth} />
          {result.warningMessage ? (
            <section className="mb-4 border border-warning bg-surface px-4 py-3" role="status">
              <h2 className="text-sm font-semibold text-warning">{t("settlements.opsMonthly.warning.title")}</h2>
              <p className="mt-1 text-sm text-muted">{result.warningMessage}</p>
            </section>
          ) : null}
          <OpsMonthlySummary locale={locale} t={t} result={result} />
          <ShareSummary locale={locale} t={t} result={result} />
          <EmployeePayoutTable locale={locale} t={t} result={result} />
          <CallEvidenceTable t={t} result={result} />
        </>
      ) : null}
    </main>
  );
}
