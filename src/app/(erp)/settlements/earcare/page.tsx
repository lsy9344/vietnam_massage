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
import { listEarcareAttendanceForDate, type EarcareAttendanceForDateDto } from "@/modules/settlements/earcare-attendance-service";
import {
  listEarcareDailySettlements,
  type EarcareDailySettlementResultDto
} from "@/modules/settlements/earcare-daily-settlement-service";
import { EarcareAttendanceTable } from "@/app/(erp)/settlements/earcare/earcare-attendance-table";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

type EarcareAttendancePageSearchParams = {
  operatingMonthId?: string;
  attendanceDate?: string;
};

function formatVnd(locale: Locale, t: Translator, amount: number) {
  return `${formatCurrencyVnd(locale, amount)} ${t("settlements.vndSuffix")}`;
}

function warningTotal(result: EarcareDailySettlementResultDto) {
  return (
    result.warningCounts.notCompleted +
    result.warningCounts.coursePolicyMissing +
    result.warningCounts.therapistRateMissing +
    result.warningCounts.secondTherapistRequired
  );
}

function EarcareSettlementSummary({ locale, t, result }: { locale: Locale; t: Translator; result: EarcareDailySettlementResultDto }) {
  return (
    <section aria-label={t("settlements.earcare.summary.aria")} className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">{t("settlements.earcare.summary.completedPool")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{formatVnd(locale, t, result.earcarePoolTotal)}</div>
        <div className="mt-1 text-xs text-muted">{t("settlements.earcare.summary.completedPoolBasis", { count: result.sourceCallCount })}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">{t("settlements.earcare.summary.normalStaff")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{result.eligibleCount}{t("settlements.peopleSuffix")}</div>
        <div className="mt-1 text-xs text-muted">{t("settlements.earcare.summary.baseShare", { amount: formatVnd(locale, t, result.baseShareAmount) })}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">{t("settlements.earcare.summary.distributed")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{formatVnd(locale, t, result.distributedAmount)}</div>
        <div className="mt-1 text-xs text-muted">{t("settlements.earcare.summary.remainder", { amount: formatVnd(locale, t, result.remainderAmount) })}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">{t("settlements.earcare.summary.undistributedWarning")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">
          {formatVnd(locale, t, result.undistributedAmount)} / {warningTotal(result)}{t("settlements.countSuffix")}
        </div>
        <div className="mt-1 text-xs text-muted">
          {t("settlements.earcare.summary.warningBreakdown", {
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

function EarcareSettlementTable({ locale, t, result }: { locale: Locale; t: Translator; result: EarcareDailySettlementResultDto }) {
  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.earcare.table.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("settlements.earcare.table.description")}</p>
      </div>
      <table className="min-w-[920px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">{t("settlements.earcare.column.earcareStaff")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.earcare.column.workStatus")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.earcare.column.payoutDecision")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("settlements.earcare.column.baseShare")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("settlements.earcare.column.remainder")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("settlements.earcare.column.payout")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.earcare.column.basis")}</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.employeeId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2">
                <div className="font-semibold text-foreground">{row.displayName}</div>
                <div className="text-xs text-muted">{row.staffCode}</div>
              </td>
              <td className="px-3 py-2">{codeLabel(locale, "ATTENDANCE_STATUS", row.statusCode, true, row.statusDisplayName)}</td>
              <td className="px-3 py-2">
                {row.isPayoutEligible ? (
                  <span className="inline-flex border border-success bg-success/10 px-2 py-1 text-xs font-semibold text-success">{t("settlements.earcare.payoutEligible")}</span>
                ) : (
                  <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
                    {t("settlements.earcare.excluded", { reason: codeLabel(locale, "ATTENDANCE_STATUS", row.statusCode, true, row.statusDisplayName) })}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatVnd(locale, t, row.baseShareAmount)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatVnd(locale, t, row.remainderShareAmount)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(locale, t, row.payoutAmount)}</td>
              <td className="px-3 py-2 text-muted">{settlementBasisText(locale, row.calculationBasis)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EarcarePoolEvidenceTable({ locale, t, result }: { locale: Locale; t: Translator; result: EarcareDailySettlementResultDto }) {
  if (result.poolEvidence.length === 0) {
    return (
      <section className="mb-4 border border-border bg-surface px-4 py-5">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.earcare.poolEvidence.empty.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settlements.earcare.poolEvidence.empty.description")}</p>
      </section>
    );
  }

  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.earcare.poolEvidence.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("settlements.earcare.poolEvidence.description")}</p>
      </div>
      <table className="min-w-[640px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">{t("settlements.earcare.poolEvidence.callId")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.earcare.poolEvidence.serviceDate")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("settlements.earcare.poolEvidence.pool")}</th>
          </tr>
        </thead>
        <tbody>
          {result.poolEvidence.map((evidence) => (
            <tr key={evidence.serviceCallId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2 font-mono text-xs text-muted">{evidence.serviceCallId}</td>
              <td className="px-3 py-2">{evidence.serviceDate}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatVnd(locale, t, evidence.earcarePoolAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function EarcareAttendancePage({ searchParams }: { searchParams: Promise<EarcareAttendancePageSearchParams> }) {
  const account = await requireRouteAccess("/settlements/earcare");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <div className="screen">
        <ScreenToolbar account={account} locale={locale} path="/settlements/earcare" title={t("settlements.earcare.title")} />
        <NoOperatingMonthNotice description={t("settlements.earcare.emptyMonthDescription")} locale={locale} role={account.role} />
      </div>
    );
  }

  const attendanceDate = clampDateToOperatingMonth(params.attendanceDate, selectedMonth);
  let result: EarcareAttendanceForDateDto | null = null;
  let settlementResult: EarcareDailySettlementResultDto | null = null;
  let errorMessage: string | null = null;

  try {
    [result, settlementResult] = await Promise.all([
      listEarcareAttendanceForDate({
        operatingMonthId: selectedMonth.id,
        attendanceDate
      }),
      listEarcareDailySettlements({
        operatingMonthId: selectedMonth.id,
        serviceDate: attendanceDate
      })
    ]);
  } catch (error) {
    // 사용자에게는 locale 메시지(매핑 없는 code는 한국어 fallback)만, 원문은 서버 로그로만.
    if (error instanceof Error) console.error("[settlements/earcare] load error", error);
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : undefined;
    const koFallback = error instanceof Error ? error.message : t("settlements.earcare.error.fallback");
    errorMessage = resolveDomainErrorMessage(locale, code, koFallback);
  }

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        context={{ operatingMonthId: selectedMonth.id, date: attendanceDate }}
        dateControls={
          <DateContextControls date={attendanceDate} locale={locale} months={operatingMonths} path="/settlements/earcare" selectedMonth={selectedMonth} />
        }
        locale={locale}
        path="/settlements/earcare"
        title={t("settlements.earcare.title")}
      />

      {result?.isLocked ? (
        <section className="mb-4 border border-danger bg-surface px-4 py-3" role="status">
          <h2 className="text-sm font-semibold text-danger">{t("settlements.locked.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("settlements.earcare.locked.description")}</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="border border-danger bg-surface px-4 py-5" role="alert">
          <h2 className="text-base font-semibold text-danger">{t("settlements.earcare.error.title")}</h2>
          <p className="mt-2 text-sm text-muted">{errorMessage}</p>
          <form className="mt-4" method="get">
            <input name="operatingMonthId" type="hidden" value={selectedMonth.id} />
            <input name="attendanceDate" type="hidden" value={attendanceDate} />
            <button className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
              {t("settlements.requery")}
            </button>
          </form>
        </section>
      ) : result && settlementResult ? (
        <>
          <EarcareSettlementSummary locale={locale} t={t} result={settlementResult} />
          <EarcareSettlementTable locale={locale} t={t} result={settlementResult} />
          <EarcarePoolEvidenceTable locale={locale} t={t} result={settlementResult} />
          <EarcareAttendanceTable
            attendanceDate={result.attendanceDate}
            disabled={result.isLocked}
            operatingMonthId={result.operatingMonthId}
            rows={result.rows}
            statusOptions={result.statusOptions}
          />
        </>
      ) : null}
    </div>
  );
}
