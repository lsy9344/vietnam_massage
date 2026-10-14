import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatCurrencyVnd } from "@/lib/i18n/format";
import { codeLabel } from "@/lib/i18n/codes";
import { settlementBasisText } from "@/lib/i18n/settlement-basis";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listOpsAttendanceForDate, type OpsAttendanceForDateDto } from "@/modules/settlements/ops-attendance-service";
import {
  listOpsDailyIncentives,
  type OpsDailyIncentiveResultDto
} from "@/modules/settlements/ops-daily-incentive-service";
import { OpsAttendanceTable } from "@/app/(erp)/settlements/operations/ops-attendance-table";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

type OpsAttendancePageSearchParams = {
  operatingMonthId?: string;
  attendanceDate?: string;
};

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

// 서비스가 만든 한국어 warningMessage 대신, 안정적인 ruleStatus(kind)로 번역 키를 골라 표시한다.
function opsWarningNoticeMessage(t: Translator, result: OpsDailyIncentiveResultDto) {
  if (result.ruleStatus === "missing_policy") return t("settlements.ops.warningNotice.missingPolicy");
  if (result.ruleStatus === "below_threshold") return t("settlements.ops.warningNotice.belowThreshold");
  return null;
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
              <td className="px-3 py-2">{codeLabel(locale, "ATTENDANCE_STATUS", row.statusCode, true, row.statusDisplayName)}</td>
              <td className="px-3 py-2">
                {row.isPayoutEligible && result.ruleStatus === "applied" ? (
                  <span className="inline-flex border border-success bg-success/10 px-2 py-1 text-xs font-semibold text-success">{t("settlements.ops.payoutEligible")}</span>
                ) : (
                  <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
                    {row.isPayoutEligible
                      ? thresholdLabel(t, result)
                      : t("settlements.ops.excluded", {
                          reason: codeLabel(locale, "ATTENDANCE_STATUS", row.statusCode, true, row.statusDisplayName)
                        })}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(locale, t, row.payoutAmount)}</td>
              <td className="px-3 py-2 text-muted">{settlementBasisText(locale, row.calculationBasis)}</td>
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
      <div className="screen">
        <ScreenToolbar account={account} locale={locale} path="/settlements/operations" title={t("settlements.ops.title")} />
        <NoOperatingMonthNotice description={t("settlements.ops.emptyMonthDescription")} locale={locale} role={account.role} />
      </div>
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
    if (error instanceof Error) console.error("[settlements/operations] load error", error);
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : undefined;
    const koFallback = error instanceof Error ? error.message : t("settlements.ops.error.fallback");
    errorMessage = resolveDomainErrorMessage(locale, code, koFallback);
  }

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        context={{ operatingMonthId: selectedMonth.id, date: attendanceDate }}
        dateControls={
          <DateContextControls date={attendanceDate} locale={locale} months={operatingMonths} path="/settlements/operations" selectedMonth={selectedMonth} />
        }
        locale={locale}
        path="/settlements/operations"
        title={t("settlements.ops.title")}
      />

      {attendance?.isLocked ? (
        <section className="mb-4 border border-danger bg-surface px-4 py-3" role="status">
          <h2 className="text-sm font-semibold text-danger">{t("settlements.locked.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("settlements.ops.locked.description")}</p>
        </section>
      ) : null}

      {incentiveResult?.warningMessage ? (
        <section className="mb-4 border border-border bg-surface px-4 py-3" role="status">
          <h2 className="text-sm font-semibold text-foreground">{t("settlements.ops.warningNotice.title")}</h2>
          <p className="mt-1 text-sm text-muted">{opsWarningNoticeMessage(t, incentiveResult) ?? incentiveResult.warningMessage}</p>
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
    </div>
  );
}
