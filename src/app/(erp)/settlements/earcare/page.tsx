import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { linkToScreen } from "@/lib/routes";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listEarcareAttendanceForDate, type EarcareAttendanceForDateDto } from "@/modules/settlements/earcare-attendance-service";
import {
  listEarcareDailySettlements,
  type EarcareDailySettlementResultDto
} from "@/modules/settlements/earcare-daily-settlement-service";
import { EarcareSettlementView } from "@/app/(erp)/settlements/earcare/earcare-settlement-view";
import {
  amountLabel,
  SettlementEmptyNotice,
  SettlementErrorNotice,
  SettlementLockedNotice,
  SettlementWarningLine,
  summaryAmount
} from "@/app/(erp)/settlements/settlement-parts";
import { EMPLOYEE_PARAM, earcareHasBasis, settlementAmount } from "@/app/(erp)/settlements/settlement-view-model";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { SummaryCard, SummaryCards } from "@/components/ui/summary-card";

type EarcareAttendancePageSearchParams = {
  operatingMonthId?: string;
  attendanceDate?: string;
  employee?: string;
};

function warningTotal(result: EarcareDailySettlementResultDto) {
  return (
    result.warningCounts.notCompleted +
    result.warningCounts.coursePolicyMissing +
    result.warningCounts.therapistRateMissing +
    result.warningCounts.secondTherapistRequired
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

  const context = { operatingMonthId: selectedMonth.id, date: attendanceDate };
  const peopleSuffix = t("settlements.peopleSuffix");

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        context={context}
        dateControls={
          <DateContextControls date={attendanceDate} locale={locale} months={operatingMonths} path="/settlements/earcare" selectedMonth={selectedMonth} />
        }
        locale={locale}
        path="/settlements/earcare"
        title={t("settlements.earcare.title")}
      />

      {result?.isLocked ? (
        <SettlementLockedNotice description={t("settlements.earcare.locked.description")} locale={locale} monthStatus={selectedMonth.status} />
      ) : null}

      {errorMessage ? (
        <SettlementErrorNotice
          locale={locale}
          message={errorMessage}
          query={{ operatingMonthId: selectedMonth.id, attendanceDate }}
          title={t("settlements.earcare.error.title")}
        />
      ) : result && settlementResult ? (
        <div className="grid gap-6">
          <div className="grid gap-4">
            <SummaryCards label={t("settlements.earcare.summary.aria")}>
              <SummaryCard
                accent="peach"
                label={t("settlements.earcare.summary.completedPool")}
                note={t("settlements.earcare.summary.completedPoolBasis", { count: settlementResult.sourceCallCount })}
                {...summaryAmount(settlementAmount(settlementResult.earcarePoolTotal, earcareHasBasis(settlementResult)), locale)}
              />
              <SummaryCard
                accent="mint"
                label={t("settlements.earcare.summary.normalStaff")}
                note={t("settlements.earcare.summary.baseShare", {
                  amount: amountLabel(settlementAmount(settlementResult.baseShareAmount, earcareHasBasis(settlementResult)), locale)
                })}
                value={`${settlementResult.eligibleCount}${peopleSuffix}`}
              />
              <SummaryCard
                accent="peach"
                label={t("settlements.earcare.summary.distributed")}
                note={t("settlements.earcare.summary.remainder", {
                  amount: amountLabel(settlementAmount(settlementResult.remainderAmount, earcareHasBasis(settlementResult)), locale)
                })}
                {...summaryAmount(settlementAmount(settlementResult.distributedAmount, earcareHasBasis(settlementResult)), locale)}
              />
              <SummaryCard
                accent="peach"
                label={t("settlements.earcare.summary.undistributed")}
                {...summaryAmount(settlementAmount(settlementResult.undistributedAmount, earcareHasBasis(settlementResult)), locale)}
              />
            </SummaryCards>
            {warningTotal(settlementResult) > 0 ? (
              <SettlementWarningLine
                detail={t("settlements.earcare.summary.warningBreakdown", {
                  notCompleted: settlementResult.warningCounts.notCompleted,
                  policyMissing: settlementResult.warningCounts.coursePolicyMissing,
                  rateMissing: settlementResult.warningCounts.therapistRateMissing,
                  secondRequired: settlementResult.warningCounts.secondTherapistRequired
                })}
                label={t("settlements.warning.excluded", { count: warningTotal(settlementResult) })}
              />
            ) : null}
          </div>
          {settlementResult.rows.length > 0 ? (
            <EarcareSettlementView
              attendance={result}
              canOpenLedger={linkToScreen(account.role, "/calls", context) !== null}
              initialEmployeeId={params[EMPLOYEE_PARAM] ?? null}
              key={`${selectedMonth.id}:${attendanceDate}`}
              result={settlementResult}
            />
          ) : (
            <SettlementEmptyNotice
              description={t("settlements.earcare.attendance.empty.description")}
              locale={locale}
              title={t("settlements.earcare.attendance.empty.title")}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
