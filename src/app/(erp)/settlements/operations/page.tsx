import Link from "next/link";
import { PageHeader } from "@/components/domain/page-header";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatCurrencyVnd } from "@/lib/i18n/format";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listOpsAttendanceForDate, type OpsAttendanceForDateDto } from "@/modules/settlements/ops-attendance-service";
import {
  listOpsDailyIncentives,
  type OpsDailyIncentiveResultDto
} from "@/modules/settlements/ops-daily-incentive-service";
import { OpsAttendanceTable } from "@/app/(erp)/settlements/operations/ops-attendance-table";

type OpsAttendancePageSearchParams = {
  operatingMonthId?: string;
  attendanceDate?: string;
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
      <Link className="border border-brand bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground" href="/settlements/operations">
        {t("settlements.tabs.opsDaily")}
      </Link>
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements/operations/monthly">
        {t("settlements.tabs.opsMonthly")}
      </Link>
    </nav>
  );
}

function formatVnd(locale: Locale, t: Translator, amount: number) {
  return `${formatCurrencyVnd(locale, amount)} ${t("settlements.vndSuffix")}`;
}

function warningTotal(result: OpsDailyIncentiveResultDto) {
  return (
    result.warningCounts.notCompleted +
    result.warningCounts.coursePolicyMissing +
    result.warningCounts.therapistRateMissing +
    result.warningCounts.secondTherapistRequired
  );
}

function thresholdLabel(t: Translator, result: OpsDailyIncentiveResultDto) {
  if (result.ruleStatus === "missing_policy") return t("settlements.ops.threshold.missingPolicy");
  if (result.ruleStatus === "below_threshold") return t("settlements.ops.threshold.belowThreshold");
  return t("settlements.ops.threshold.applied", { count: result.appliedThresholdCallCount ?? 0 });
}

function OpsIncentiveSummary({ locale, t, result }: { locale: Locale; t: Translator; result: OpsDailyIncentiveResultDto }) {
  return (
    <section aria-label={t("settlements.ops.summary.aria")} className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">{t("settlements.ops.summary.dailyTotalCalls")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{result.dailyOpsCallCredit}{t("settlements.callSuffix")}</div>
        <div className="mt-1 text-xs text-muted">{t("settlements.ops.summary.dailyTotalCallsBasis", { count: result.sourceCallCount })}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">{t("settlements.ops.summary.appliedThreshold")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{thresholdLabel(t, result)}</div>
        <div className="mt-1 text-xs text-muted">{t("settlements.ops.summary.perPerson", { amount: formatVnd(locale, t, result.personalIncentiveAmount) })}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">{t("settlements.ops.summary.eligible")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{result.eligibleCount}{t("settlements.peopleSuffix")}</div>
        <div className="mt-1 text-xs text-muted">{t("settlements.ops.summary.distributed", { amount: formatVnd(locale, t, result.distributedAmount) })}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">{t("settlements.ops.summary.warningExcluded")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{warningTotal(result)}{t("settlements.countSuffix")}</div>
        <div className="mt-1 text-xs text-muted">
          {t("settlements.ops.summary.warningBreakdown", {
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

function OpsIncentiveTable({ locale, t, result }: { locale: Locale; t: Translator; result: OpsDailyIncentiveResultDto }) {
  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.ops.table.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("settlements.ops.table.description")}</p>
      </div>
      <table className="min-w-[980px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">{t("settlements.ops.column.opsStaff")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.ops.column.position")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.ops.column.workStatus")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.ops.column.payoutDecision")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("settlements.ops.column.payout")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.ops.column.basis")}</th>
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
              <td className="px-3 py-2">{row.statusDisplayName}</td>
              <td className="px-3 py-2">
                {row.isPayoutEligible && result.ruleStatus === "applied" ? (
                  <span className="inline-flex border border-success bg-success/10 px-2 py-1 text-xs font-semibold text-success">{t("settlements.ops.payoutEligible")}</span>
                ) : (
                  <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
                    {row.isPayoutEligible ? thresholdLabel(t, result) : t("settlements.ops.excluded", { reason: row.exclusionReason ?? row.statusDisplayName })}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(locale, t, row.payoutAmount)}</td>
              <td className="px-3 py-2 text-muted">{row.calculationBasis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function OpsCallEvidenceTable({ t, result }: { t: Translator; result: OpsDailyIncentiveResultDto }) {
  if (result.callEvidence.length === 0) {
    return (
      <section className="mb-4 border border-border bg-surface px-4 py-5">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.ops.callEvidence.empty.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settlements.ops.callEvidence.empty.description")}</p>
      </section>
    );
  }

  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.ops.callEvidence.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("settlements.ops.callEvidence.description")}</p>
      </div>
      <table className="min-w-[640px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">{t("settlements.ops.callEvidence.callId")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.ops.callEvidence.serviceDate")}</th>
            <th className="border-b border-border px-3 py-2 text-right">opsCallCredit</th>
          </tr>
        </thead>
        <tbody>
          {result.callEvidence.map((evidence) => (
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

export default async function OperationsAttendancePage({ searchParams }: { searchParams: Promise<OpsAttendancePageSearchParams> }) {
  const account = await requireRouteAccess("/settlements/operations");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow={t("nav.group.settlements")}
          title={t("settlements.ops.title")}
          description={t("settlements.ops.emptyDescription")}
        />
        <SettlementTabs t={t} />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">{t("common.createOperatingMonthFirst")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t("settlements.ops.emptyMonthDescription")}</p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              {t("common.goToOperatingMonths")}
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  const attendanceDate = clampDateToOperatingMonth(params.attendanceDate, selectedMonth);
  let attendance: OpsAttendanceForDateDto | null = null;
  let incentiveResult: OpsDailyIncentiveResultDto | null = null;
  let errorMessage: string | null = null;

  try {
    [attendance, incentiveResult] = await Promise.all([
      listOpsAttendanceForDate({
        operatingMonthId: selectedMonth.id,
        attendanceDate
      }),
      listOpsDailyIncentives({
        operatingMonthId: selectedMonth.id,
        serviceDate: attendanceDate
      })
    ]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : t("settlements.ops.error.fallback");
  }

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("nav.group.settlements")}
        title={t("settlements.ops.title")}
        description={t("settlements.ops.description")}
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
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("common.queryDate")}
          <input
            aria-label={t("common.queryDate")}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={attendanceDate}
            max={selectedMonth.endDate}
            min={selectedMonth.startDate}
            name="attendanceDate"
            type="date"
          />
        </label>
        <button className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
          {t("common.query")}
        </button>
      </form>

      {attendance?.isLocked ? (
        <section className="mb-4 border border-danger bg-surface px-4 py-3" role="status">
          <h2 className="text-sm font-semibold text-danger">{t("settlements.locked.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("settlements.ops.locked.description")}</p>
        </section>
      ) : null}

      {incentiveResult?.warningMessage ? (
        <section className="mb-4 border border-border bg-surface px-4 py-3" role="status">
          <h2 className="text-sm font-semibold text-foreground">{t("settlements.ops.warningNotice.title")}</h2>
          <p className="mt-1 text-sm text-muted">{incentiveResult.warningMessage}</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="border border-danger bg-surface px-4 py-5" role="alert">
          <h2 className="text-base font-semibold text-danger">{t("settlements.ops.error.title")}</h2>
          <p className="mt-2 text-sm text-muted">{errorMessage}</p>
          <form className="mt-4" method="get">
            <input name="operatingMonthId" type="hidden" value={selectedMonth.id} />
            <input name="attendanceDate" type="hidden" value={attendanceDate} />
            <button className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
              {t("settlements.requery")}
            </button>
          </form>
        </section>
      ) : attendance && incentiveResult ? (
        <>
          <OpsIncentiveSummary locale={locale} t={t} result={incentiveResult} />
          <OpsIncentiveTable locale={locale} t={t} result={incentiveResult} />
          <OpsCallEvidenceTable t={t} result={incentiveResult} />
          <OpsAttendanceTable
            attendanceDate={attendance.attendanceDate}
            disabled={attendance.isLocked}
            operatingMonthId={attendance.operatingMonthId}
            rows={attendance.rows}
            statusOptions={attendance.statusOptions}
          />
        </>
      ) : null}
    </main>
  );
}
