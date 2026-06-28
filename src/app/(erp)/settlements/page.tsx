import Link from "next/link";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatCurrencyVnd, formatDateTime } from "@/lib/i18n/format";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listTherapistDailySettlements, type TherapistDailySettlementResultDto } from "@/modules/settlements/therapist-daily-settlement-service";
import {
  listTherapistAttendanceForDate,
  type TherapistAttendanceForDateDto
} from "@/modules/settlements/therapist-attendance-service";
import { TherapistAttendanceTable } from "@/app/(erp)/settlements/therapist-attendance-table";
import { TherapistDailySettlementPaymentForm } from "@/app/(erp)/settlements/therapist-daily-settlement-payment-form";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import { PageHeader } from "@/components/domain/page-header";

type SettlementsPageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

const courseCodes = ["A", "B", "C", "D", "E"] as const;

const rateStatusKey = {
  applied: "settlements.therapist.rateStatus.applied",
  zero_policy: "settlements.therapist.rateStatus.zeroPolicy",
  missing_policy: "settlements.therapist.rateStatus.missingPolicy"
} as const;

const roleKey = {
  THERAPIST_1: "settlements.therapist.role.therapist1",
  THERAPIST_2: "settlements.therapist.role.therapist2"
} as const;

function formatVnd(locale: Locale, t: Translator, amount: number) {
  return `${formatCurrencyVnd(locale, amount)} ${t("settlements.vndSuffix")}`;
}

function formatKstDateTime(locale: Locale, value: string | null) {
  if (!value) return null;
  return formatDateTime(locale, value, {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function paymentActorAccountId(paymentStatus: TherapistDailySettlementResultDto["settlements"][number]["paymentStatus"]) {
  return paymentStatus.paidBy?.accountId ?? paymentStatus.paidByAccountId;
}

function paymentActorEmployeeLabel(paymentStatus: TherapistDailySettlementResultDto["settlements"][number]["paymentStatus"]) {
  if (!paymentStatus.paidBy?.employeeDisplayName) return null;
  return paymentStatus.paidBy.employeeStaffCode
    ? `${paymentStatus.paidBy.employeeDisplayName} (${paymentStatus.paidBy.employeeStaffCode})`
    : paymentStatus.paidBy.employeeDisplayName;
}

function paymentHistoryActorLabel(history: TherapistDailySettlementResultDto["settlements"][number]["paymentStatus"]["history"][number]) {
  const accountId = history.changedBy?.accountId ?? history.changedByAccountId;
  const employeeName = history.changedBy?.employeeDisplayName;
  return employeeName ? `${accountId} / ${employeeName}` : accountId;
}

function paymentStateLabel(t: Translator, value: boolean | null) {
  if (value === null || value === false) return t("settlements.therapist.state.unpaid");
  return t("settlements.therapist.state.paid");
}

function warningSummary(result: TherapistDailySettlementResultDto) {
  return result.warningCounts.coursePolicyMissing + result.warningCounts.therapistRateMissing + result.warningCounts.secondTherapistRequired;
}

function SettlementTabs({ t }: { t: Translator }) {
  return (
    <nav aria-label={t("settlements.tabs.aria")} className="mb-4 flex flex-wrap gap-2">
      <Link className="border border-brand bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground" href="/settlements">
        {t("settlements.tabs.therapistDaily")}
      </Link>
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements/earcare">
        {t("settlements.tabs.earcareDaily")}
      </Link>
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements/operations">
        {t("settlements.tabs.opsDaily")}
      </Link>
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements/operations/monthly">
        {t("settlements.tabs.opsMonthly")}
      </Link>
    </nav>
  );
}

export default async function SettlementsPage({ searchParams }: { searchParams: Promise<SettlementsPageSearchParams> }) {
  const account = await requireRouteAccess("/settlements");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow={t("nav.group.settlements")}
          title={t("settlements.therapist.title")}
          description={t("settlements.therapist.emptyDescription")}
        />
        <SettlementTabs t={t} />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">{t("common.createOperatingMonthFirst")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t("settlements.therapist.emptyMonthDescription")}</p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              {t("common.goToOperatingMonths")}
            </Link>
          ) : null}
        </section>
      </main>
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

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("nav.group.settlements")}
        title={t("settlements.therapist.title")}
        description={t("settlements.therapist.description")}
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
            defaultValue={serviceDate}
            max={selectedMonth.endDate}
            min={selectedMonth.startDate}
            name="serviceDate"
            type="date"
          />
        </label>
        <button className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
          {t("common.query")}
        </button>
      </form>

      {isMonthLocked ? (
        <section className="mb-4 border border-danger bg-surface px-4 py-3" role="status">
          <h2 className="text-sm font-semibold text-danger">{t("settlements.locked.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("settlements.therapist.locked.description")}</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="border border-danger bg-surface px-4 py-5" role="alert">
          <h2 className="text-base font-semibold text-danger">{t("settlements.therapist.error.title")}</h2>
          <p className="mt-2 text-sm text-muted">{errorMessage}</p>
          <form className="mt-4" method="get">
            <input name="operatingMonthId" type="hidden" value={selectedMonth.id} />
            <input name="serviceDate" type="hidden" value={serviceDate} />
            <button className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
              {t("settlements.requery")}
            </button>
          </form>
        </section>
      ) : result ? (
        <>
          <section aria-label={t("settlements.therapist.summary.aria")} className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">{t("settlements.therapist.summary.targetCount")}</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{result.settlements.length}{t("settlements.peopleSuffix")}</div>
            </div>
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">{t("settlements.therapist.summary.totalCalls")}</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {result.settlements.reduce((sum, row) => sum + row.totalCallCount, 0)}{t("settlements.countSuffix")}
              </div>
            </div>
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">{t("settlements.therapist.summary.dailyTotal")}</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {formatVnd(locale, t, result.settlements.reduce((sum, row) => sum + row.totalCommissionAmount, 0))}
              </div>
            </div>
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">{t("settlements.therapist.summary.paid")}</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {result.settlements.filter((row) => row.paymentStatus.isPaid).length} / {result.settlements.length}{t("settlements.peopleSuffix")}
              </div>
            </div>
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">{t("settlements.therapist.summary.warningExcluded")}</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {warningSummary(result)}{t("settlements.countSuffix")} / {result.excludedCallCount}{t("settlements.countSuffix")}
              </div>
            </div>
          </section>

          {result.settlements.length === 0 ? (
            <section className="border border-border bg-surface px-4 py-8">
              <h2 className="text-base font-semibold text-foreground">{t("settlements.therapist.empty.title")}</h2>
              <p className="mt-2 text-sm text-muted">{t("settlements.therapist.empty.description")}</p>
            </section>
          ) : (
            <section className="overflow-x-auto border border-border bg-surface">
              <table className="min-w-[1240px] w-full border-collapse text-sm">
                <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
                  <tr>
                    <th className="border-b border-border px-3 py-2">{t("settlements.therapist.column.therapist")}</th>
                    <th className="border-b border-border px-3 py-2 text-right">{t("settlements.therapist.column.assignedCalls")}</th>
                    <th className="border-b border-border px-3 py-2 text-right">{t("settlements.therapist.column.dailySettlement")}</th>
                    <th className="border-b border-border px-3 py-2">{t("settlements.therapist.column.paid")}</th>
                    {courseCodes.map((courseCode) => (
                      <th key={courseCode} className="border-b border-border px-3 py-2 text-right">
                        {t("settlements.therapist.column.courseQtyAmount", { course: courseCode })}
                      </th>
                    ))}
                    <th className="border-b border-border px-3 py-2 text-right">{t("settlements.therapist.column.policyStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.settlements.map((settlement) => (
                    <tr key={settlement.employeeId} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-foreground">{settlement.displayName}</div>
                        <div className="text-xs text-muted">{settlement.staffCode}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{settlement.totalCallCount}{t("settlements.countSuffix")}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(locale, t, settlement.totalCommissionAmount)}</td>
                      <td className="px-3 py-2">
                        <div
                          className={
                            settlement.paymentStatus.isPaid
                              ? "inline-flex border border-status-active bg-status-active px-2 py-1 text-xs font-semibold text-status-active-foreground"
                              : "inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted"
                          }
                        >
                          {settlement.paymentStatus.isPaid ? t("settlements.therapist.state.paid") : t("settlements.therapist.state.unpaid")}
                        </div>
                        {settlement.paymentStatus.isPaid ? (
                          <div className="mt-1 space-y-0.5 text-xs text-muted">
                            <div>{formatKstDateTime(locale, settlement.paymentStatus.paidAt)}</div>
                            {paymentActorAccountId(settlement.paymentStatus) ? (
                              <div>{t("settlements.therapist.handler", { actor: paymentActorAccountId(settlement.paymentStatus) ?? "" })}</div>
                            ) : null}
                            {paymentActorEmployeeLabel(settlement.paymentStatus) ? (
                              <div>{paymentActorEmployeeLabel(settlement.paymentStatus)}</div>
                            ) : null}
                          </div>
                        ) : null}
                        {settlement.paymentStatus.history.length > 0 ? (
                          <div className="mt-2 border-l border-border pl-2 text-xs text-muted">
                            <div className="font-semibold text-foreground">{t("settlements.therapist.history.title", { count: settlement.paymentStatus.history.length })}</div>
                            <ol className="mt-1 space-y-1">
                              {settlement.paymentStatus.history.slice(0, 3).map((history) => (
                                <li key={`${history.changedAt}-${history.changedByAccountId}`}>
                                  <div>
                                    {paymentStateLabel(t, history.previousIsPaid)} -&gt; {paymentStateLabel(t, history.newIsPaid)}
                                  </div>
                                  <div>{formatKstDateTime(locale, history.changedAt)}</div>
                                  <div>{t("settlements.therapist.handler", { actor: paymentHistoryActorLabel(history) ?? "" })}</div>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ) : null}
                        {isMonthLocked ? null : (
                          <TherapistDailySettlementPaymentForm
                            employeeId={settlement.employeeId}
                            isPaid={settlement.paymentStatus.isPaid}
                            operatingMonthId={selectedMonth.id}
                            serviceDate={serviceDate}
                          />
                        )}
                      </td>
                      {courseCodes.map((courseCode) => {
                        const summary = settlement.courseBreakdown[courseCode];
                        return (
                          <td key={courseCode} className="px-3 py-2 text-right tabular-nums">
                            <div>{summary.callCount}{t("settlements.countSuffix")}</div>
                            <div className="text-xs text-muted">{formatVnd(locale, t, summary.commissionAmount)}</div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t("settlements.therapist.policyStatusCell", { missing: settlement.warningCounts.missingPolicy, zero: settlement.warningCounts.zeroPolicy })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="mt-5 border border-border bg-surface">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">{t("settlements.therapist.evidence.title")}</h2>
              <p className="mt-1 text-sm text-muted">
                {t("settlements.therapist.evidence.description")}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-sm">
                <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
                  <tr>
                    <th className="border-b border-border px-3 py-2">{t("settlements.therapist.column.therapist")}</th>
                    <th className="border-b border-border px-3 py-2">{t("settlements.therapist.evidence.callId")}</th>
                    <th className="border-b border-border px-3 py-2">{t("settlements.therapist.evidence.role")}</th>
                    <th className="border-b border-border px-3 py-2">{t("settlements.therapist.evidence.course")}</th>
                    <th className="border-b border-border px-3 py-2 text-right">{t("settlements.therapist.evidence.commission")}</th>
                    <th className="border-b border-border px-3 py-2">{t("settlements.therapist.column.policyStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.settlements.flatMap((settlement) =>
                    settlement.assignmentEvidence.map((evidence) => (
                      <tr key={`${evidence.serviceCallId}-${evidence.role}-${evidence.employeeId}`} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2">
                          {settlement.displayName} <span className="text-xs text-muted">({settlement.staffCode})</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{evidence.serviceCallId}</td>
                        <td className="px-3 py-2">{t(roleKey[evidence.role])}</td>
                        <td className="px-3 py-2">{evidence.courseCode}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatVnd(locale, t, evidence.commissionAmount)}</td>
                        <td className="px-3 py-2">{t(rateStatusKey[evidence.rateStatus])}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {attendanceErrorMessage ? (
        <section className="mt-5 border border-danger bg-surface px-4 py-5" role="alert">
          <h2 className="text-base font-semibold text-danger">{t("settlements.therapist.attendanceError.title")}</h2>
          <p className="mt-2 text-sm text-muted">{attendanceErrorMessage}</p>
          <form className="mt-4" method="get">
            <input name="operatingMonthId" type="hidden" value={selectedMonth.id} />
            <input name="serviceDate" type="hidden" value={serviceDate} />
            <button className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
              {t("settlements.requery")}
            </button>
          </form>
        </section>
      ) : attendance ? (
        <div className="mt-5">
          <TherapistAttendanceTable
            attendanceDate={attendance.attendanceDate}
            disabled={attendance.isLocked}
            operatingMonthId={attendance.operatingMonthId}
            rows={attendance.rows}
          />
        </div>
      ) : null}
    </main>
  );
}
