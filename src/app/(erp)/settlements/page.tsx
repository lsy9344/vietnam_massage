import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { linkToScreen } from "@/lib/routes";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listTherapistDailySettlements, type TherapistDailySettlementResultDto } from "@/modules/settlements/therapist-daily-settlement-service";
import {
  listTherapistAttendanceForDate,
  type TherapistAttendanceForDateDto
} from "@/modules/settlements/therapist-attendance-service";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import {
  SettlementEmptyNotice,
  SettlementErrorNotice,
  SettlementLockedNotice,
  SettlementWarningLine,
  summaryAmount
} from "@/app/(erp)/settlements/settlement-parts";
import { EMPLOYEE_PARAM, therapistComparisonRows, therapistDailyTotal } from "@/app/(erp)/settlements/settlement-view-model";
import { TherapistSettlementView } from "@/app/(erp)/settlements/therapist-settlement-view";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { SummaryCard, SummaryCards } from "@/components/ui/summary-card";

type SettlementsPageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
  employee?: string;
};

function warningSummary(result: TherapistDailySettlementResultDto) {
  return result.warningCounts.coursePolicyMissing + result.warningCounts.therapistRateMissing + result.warningCounts.secondTherapistRequired;
}

export default async function SettlementsPage({ searchParams }: { searchParams: Promise<SettlementsPageSearchParams> }) {
  const account = await requireRouteAccess("/settlements");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <div className="screen">
        <ScreenToolbar account={account} locale={locale} path="/settlements" title={t("settlements.therapist.title")} />
        <NoOperatingMonthNotice description={t("settlements.therapist.emptyMonthDescription")} locale={locale} role={account.role} />
      </div>
    );
  }

  const serviceDate = clampDateToOperatingMonth(params.serviceDate, selectedMonth);
  let result: TherapistDailySettlementResultDto | null = null;
  let attendance: TherapistAttendanceForDateDto | null = null;
  let errorMessage: string | null = null;
  let attendanceErrorMessage: string | null = null;

  // Settlement read and attendance read are independent: a failure in one must not hide the other.
  const [settlementResult, attendanceResult] = await Promise.allSettled([
    listTherapistDailySettlements({
      operatingMonthId: selectedMonth.id,
      serviceDate
    }),
    listTherapistAttendanceForDate({
      operatingMonthId: selectedMonth.id,
      attendanceDate: serviceDate
    })
  ]);

  if (settlementResult.status === "fulfilled") {
    result = settlementResult.value;
  } else {
    errorMessage =
      settlementResult.reason instanceof Error ? settlementResult.reason.message : t("settlements.therapist.error.fallback");
  }

  if (attendanceResult.status === "fulfilled") {
    attendance = attendanceResult.value;
  } else {
    attendanceErrorMessage =
      attendanceResult.reason instanceof Error ? attendanceResult.reason.message : t("settlements.therapist.attendanceError.fallback");
  }

  // 잠금 여부는 운영월 상태(항상 조회됨)를 기준으로 판단한다. 출퇴근 조회가 실패해도
  // 잠긴 운영월에서 지급완료 버튼이 노출됐다가 서버에서 거절되는 UX를 막는다.
  const isMonthLocked = isOperatingMonthPayoutLocked(selectedMonth.status) || (attendance?.isLocked ?? false);
  const context = { operatingMonthId: selectedMonth.id, date: serviceDate };
  const rows = therapistComparisonRows(result?.settlements ?? null, attendance?.rows ?? null);
  const requery = { operatingMonthId: selectedMonth.id, serviceDate };
  const countSuffix = t("settlements.countSuffix");
  const peopleSuffix = t("settlements.peopleSuffix");

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        context={context}
        dateControls={
          <DateContextControls date={serviceDate} locale={locale} months={operatingMonths} path="/settlements" selectedMonth={selectedMonth} />
        }
        locale={locale}
        path="/settlements"
        title={t("settlements.therapist.title")}
      />

      {isMonthLocked ? (
        <SettlementLockedNotice description={t("settlements.therapist.locked.description")} locale={locale} monthStatus={selectedMonth.status} />
      ) : null}

      <div className="grid gap-6">
        {errorMessage ? (
          <SettlementErrorNotice locale={locale} message={errorMessage} query={requery} title={t("settlements.therapist.error.title")} />
        ) : result && result.settlements.length === 0 ? (
          <SettlementEmptyNotice
            description={t("settlements.therapist.empty.description")}
            locale={locale}
            title={t("settlements.therapist.empty.title")}
          />
        ) : result ? (
          <div className="grid gap-4">
            <SummaryCards label={t("settlements.therapist.summary.aria")}>
              <SummaryCard
                accent="mint"
                label={t("settlements.therapist.summary.targetCount")}
                value={`${result.settlements.length}${peopleSuffix}`}
              />
              <SummaryCard
                accent="mint"
                label={t("settlements.therapist.summary.totalCalls")}
                value={`${result.settlements.reduce((sum, row) => sum + row.totalCallCount, 0)}${countSuffix}`}
              />
              <SummaryCard
                accent="peach"
                label={t("settlements.therapist.summary.dailyTotal")}
                {...summaryAmount(therapistDailyTotal(result.settlements), locale)}
              />
              <SummaryCard
                accent="mint"
                label={t("settlements.therapist.summary.confirmed")}
                value={`${result.settlements.filter((row) => row.payoutConfirmation.status === "confirmed").length} / ${result.settlements.length}${peopleSuffix}`}
              />
            </SummaryCards>
            {warningSummary(result) > 0 || result.excludedCallCount > 0 ? (
              <SettlementWarningLine
                label={`${t("settlements.therapist.summary.warningExcluded")} ${warningSummary(result)}${countSuffix} / ${result.excludedCallCount}${countSuffix}`}
              />
            ) : null}
          </div>
        ) : null}

        {attendanceErrorMessage ? (
          <SettlementErrorNotice
            locale={locale}
            message={attendanceErrorMessage}
            query={requery}
            title={t("settlements.therapist.attendanceError.title")}
          />
        ) : null}

        {rows.length > 0 ? (
          <TherapistSettlementView
            attendanceAvailable={attendance !== null}
            attendanceDisabled={attendance?.isLocked ?? true}
            canOpenLedger={linkToScreen(account.role, "/calls", context) !== null}
            canOpenStatement={linkToScreen(account.role, "/settlements/statement", context) !== null}
            initialEmployeeId={params[EMPLOYEE_PARAM] ?? null}
            key={`${selectedMonth.id}:${serviceDate}`}
            operatingMonthId={selectedMonth.id}
            paymentLocked={isMonthLocked}
            rows={rows}
            serviceDate={serviceDate}
          />
        ) : attendance ? (
          <SettlementEmptyNotice
            description={t("settlements.therapist.attendance.empty.description")}
            locale={locale}
            title={t("settlements.therapist.attendance.empty.title")}
          />
        ) : null}
      </div>
    </div>
  );
}
