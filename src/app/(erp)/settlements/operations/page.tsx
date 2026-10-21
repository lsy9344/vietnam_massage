import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { linkToScreen } from "@/lib/routes";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listOpsAttendanceForDate, type OpsAttendanceForDateDto } from "@/modules/settlements/ops-attendance-service";
import {
  listOpsDailyIncentives,
  type OpsDailyIncentiveResultDto
} from "@/modules/settlements/ops-daily-incentive-service";
import { OpsDailyView } from "@/app/(erp)/settlements/operations/ops-daily-view";
import { opsThresholdLabel, opsWarningNoticeMessage } from "@/app/(erp)/settlements/operations/ops-threshold";
import {
  SettlementEmptyNotice,
  SettlementErrorNotice,
  SettlementLockedNotice,
  SettlementWarningLine,
  summaryAmount
} from "@/app/(erp)/settlements/settlement-parts";
import { EMPLOYEE_PARAM, incentiveRuleHasBasis, settlementAmount } from "@/app/(erp)/settlements/settlement-view-model";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { SummaryCard, SummaryCards } from "@/components/ui/summary-card";

type OpsAttendancePageSearchParams = {
  operatingMonthId?: string;
  attendanceDate?: string;
  employee?: string;
};

function warningTotal(result: OpsDailyIncentiveResultDto) {
  return (
    result.warningCounts.notCompleted +
    result.warningCounts.coursePolicyMissing +
    result.warningCounts.therapistRateMissing +
    result.warningCounts.secondTherapistRequired
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

  const context = { operatingMonthId: selectedMonth.id, date: attendanceDate };
  const hasBasis = incentiveResult ? incentiveRuleHasBasis(incentiveResult.ruleStatus) : false;

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        context={context}
        dateControls={
          <DateContextControls date={attendanceDate} locale={locale} months={operatingMonths} path="/settlements/operations" selectedMonth={selectedMonth} />
        }
        locale={locale}
        path="/settlements/operations"
        title={t("settlements.ops.title")}
      />

      {attendance?.isLocked ? (
        <SettlementLockedNotice description={t("settlements.ops.locked.description")} locale={locale} monthStatus={selectedMonth.status} />
      ) : null}

      {errorMessage ? (
        <SettlementErrorNotice
          locale={locale}
          message={errorMessage}
          query={{ operatingMonthId: selectedMonth.id, attendanceDate }}
          title={t("settlements.ops.error.title")}
        />
      ) : attendance && incentiveResult ? (
        <div className="grid gap-6">
          <div className="grid gap-4">
            <SummaryCards label={t("settlements.ops.summary.aria")}>
              <SummaryCard
                accent="mint"
                label={t("settlements.ops.summary.dailyTotalCalls")}
                note={t("settlements.ops.summary.dailyTotalCallsBasis", { count: incentiveResult.sourceCallCount })}
                value={`${incentiveResult.dailyOpsCallCount}${t("settlements.callSuffix")}`}
              />
              <SummaryCard
                accent="peach"
                label={t("settlements.ops.summary.perPerson")}
                note={`${t("settlements.ops.summary.appliedThreshold")}: ${opsThresholdLabel(locale, incentiveResult)}`}
                {...summaryAmount(settlementAmount(incentiveResult.personalIncentiveAmount, hasBasis), locale)}
              />
              <SummaryCard
                accent="mint"
                label={t("settlements.ops.summary.eligible")}
                value={`${incentiveResult.eligibleCount}${t("settlements.peopleSuffix")}`}
              />
              <SummaryCard
                accent="peach"
                label={t("settlements.ops.summary.distributed")}
                {...summaryAmount(settlementAmount(incentiveResult.distributedAmount, hasBasis), locale)}
              />
            </SummaryCards>
            {incentiveResult.warningMessage ? (
              <SettlementWarningLine
                detail={opsWarningNoticeMessage(locale, incentiveResult) ?? incentiveResult.warningMessage}
                label={t("settlements.ops.warningNotice.title")}
              />
            ) : null}
            {warningTotal(incentiveResult) > 0 ? (
              <SettlementWarningLine
                detail={t("settlements.ops.summary.warningBreakdown", {
                  notCompleted: incentiveResult.warningCounts.notCompleted,
                  policyMissing: incentiveResult.warningCounts.coursePolicyMissing,
                  rateMissing: incentiveResult.warningCounts.therapistRateMissing,
                  secondRequired: incentiveResult.warningCounts.secondTherapistRequired
                })}
                label={t("settlements.warning.excluded", { count: warningTotal(incentiveResult) })}
              />
            ) : null}
          </div>
          {incentiveResult.rows.length > 0 ? (
            <OpsDailyView
              attendance={attendance}
              canOpenLedger={linkToScreen(account.role, "/calls", context) !== null}
              canOpenStatement={linkToScreen(account.role, "/settlements/statement", context) !== null}
              initialEmployeeId={params[EMPLOYEE_PARAM] ?? null}
              key={`${selectedMonth.id}:${attendanceDate}`}
              result={incentiveResult}
            />
          ) : (
            <SettlementEmptyNotice
              description={t("settlements.ops.attendance.empty.description")}
              locale={locale}
              title={t("settlements.ops.attendance.empty.title")}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
