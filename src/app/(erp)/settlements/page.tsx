import Link from "next/link";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listTherapistDailySettlements, type TherapistDailySettlementResultDto } from "@/modules/settlements/therapist-daily-settlement-service";
import {
  listTherapistAttendanceForDate,
  type TherapistAttendanceForDateDto
} from "@/modules/settlements/therapist-attendance-service";
import { TherapistAttendanceTable } from "@/app/(erp)/settlements/therapist-attendance-table";
import { setTherapistDailySettlementPaymentAction } from "@/app/(erp)/settlements/actions";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import { PageHeader } from "@/components/domain/page-header";

type SettlementsPageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

const courseCodes = ["A", "B", "C", "D", "E"] as const;

const rateStatusLabel = {
  applied: "정책 적용",
  zero_policy: "0원 정책",
  missing_policy: "정책 없음"
} as const;

const roleLabel = {
  THERAPIST_1: "마사지사1",
  THERAPIST_2: "마사지사2"
} as const;

function formatVnd(amount: number) {
  return `${new Intl.NumberFormat("ko-KR").format(amount)} VND`;
}

function formatKstDateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function warningSummary(result: TherapistDailySettlementResultDto) {
  return result.warningCounts.coursePolicyMissing + result.warningCounts.therapistRateMissing + result.warningCounts.secondTherapistRequired;
}

function SettlementTabs() {
  return (
    <nav aria-label="정산 화면" className="mb-4 flex flex-wrap gap-2">
      <Link className="border border-brand bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground" href="/settlements">
        마사지사 일일정산
      </Link>
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements/earcare">
        귀케어 일일정산
      </Link>
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements/operations">
        운영팀 근무/일일인센
      </Link>
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements/operations/monthly">
        운영팀 월인센
      </Link>
    </nav>
  );
}

export default async function SettlementsPage({ searchParams }: { searchParams: Promise<SettlementsPageSearchParams> }) {
  const account = await requireRouteAccess("/settlements");
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow="정산"
          title="마사지사 일일정산"
          description="방문완료 콜의 마사지사1/2 담당 건과 코스별 수당 근거를 조회한다."
        />
        <SettlementTabs />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">운영월을 먼저 생성해 주세요</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">마사지사 일일정산은 운영월 날짜 범위 안에서만 조회할 수 있다.</p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              운영월 관리로 이동
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
      settlementResult.reason instanceof Error ? settlementResult.reason.message : "마사지사 일일정산을 조회하지 못했습니다.";
  }

  if (attendanceResult.status === "fulfilled") {
    attendance = attendanceResult.value;
  } else {
    attendanceErrorMessage =
      attendanceResult.reason instanceof Error ? attendanceResult.reason.message : "출퇴근 입력을 조회하지 못했습니다.";
  }

  // 잠금 여부는 운영월 상태(항상 조회됨)를 기준으로 판단한다. 출퇴근 조회가 실패해도
  // 잠긴 운영월에서 지급완료 버튼이 노출됐다가 서버에서 거절되는 UX를 막는다.
  const isMonthLocked = isOperatingMonthPayoutLocked(selectedMonth.status) || (attendance?.isLocked ?? false);

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow="정산"
        title="마사지사 일일정산"
        description="방문완료 콜 기준으로 마사지사별 담당 콜, 코스별 수당, 정책 상태 근거를 조회하고 출퇴근 시간과 만근 인정을 함께 관리한다."
        meta={
          <>
            <div>운영월 상태: {selectedMonth.status}</div>
            <div>
              날짜 범위: {selectedMonth.startDate} ~ {selectedMonth.endDate}
            </div>
          </>
        }
      />

      <SettlementTabs />

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <label className="grid gap-1 text-xs font-medium text-muted">
          운영월
          <select
            aria-label="운영월"
            className="h-9 min-w-44 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={selectedMonth.id}
            name="operatingMonthId"
          >
            {operatingMonths.map((month) => (
              <option key={month.id} value={month.id}>
                {month.monthKey} ({month.status})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          조회날짜
          <input
            aria-label="조회날짜"
            className="h-9 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={serviceDate}
            max={selectedMonth.endDate}
            min={selectedMonth.startDate}
            name="serviceDate"
            type="date"
          />
        </label>
        <button className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
          조회
        </button>
      </form>

      {isMonthLocked ? (
        <section className="mb-4 border border-danger bg-surface px-4 py-3" role="status">
          <h2 className="text-sm font-semibold text-danger">잠긴 운영월입니다. 마감확정 또는 잠금 운영월입니다</h2>
          <p className="mt-1 text-sm text-muted">이 운영월의 출퇴근 시간은 수정할 수 없습니다. 입력 항목은 읽기 전용으로 표시됩니다.</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="border border-danger bg-surface px-4 py-5" role="alert">
          <h2 className="text-base font-semibold text-danger">정산 조회 실패</h2>
          <p className="mt-2 text-sm text-muted">{errorMessage}</p>
          <form className="mt-4" method="get">
            <input name="operatingMonthId" type="hidden" value={selectedMonth.id} />
            <input name="serviceDate" type="hidden" value={serviceDate} />
            <button className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
              재조회
            </button>
          </form>
        </section>
      ) : result ? (
        <>
          <section aria-label="마사지사 일일정산 요약" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">정산 대상 마사지사</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{result.settlements.length}명</div>
            </div>
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">총 담당 콜</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {result.settlements.reduce((sum, row) => sum + row.totalCallCount, 0)}건
              </div>
            </div>
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">당일정산 합계</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {formatVnd(result.settlements.reduce((sum, row) => sum + row.totalCommissionAmount, 0))}
              </div>
            </div>
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">지급완료</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {result.settlements.filter((row) => row.paymentStatus.isPaid).length} / {result.settlements.length}명
              </div>
            </div>
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">정책 warning / 제외 콜</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {warningSummary(result)}건 / {result.excludedCallCount}건
              </div>
            </div>
          </section>

          {result.settlements.length === 0 ? (
            <section className="border border-border bg-surface px-4 py-8">
              <h2 className="text-base font-semibold text-foreground">이 날짜의 방문완료 콜이 없습니다</h2>
              <p className="mt-2 text-sm text-muted">운영월 또는 조회날짜를 변경해 다시 조회하세요.</p>
            </section>
          ) : (
            <section className="overflow-x-auto border border-border bg-surface">
              <table className="min-w-[1240px] w-full border-collapse text-sm">
                <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
                  <tr>
                    <th className="border-b border-border px-3 py-2">마사지사</th>
                    <th className="border-b border-border px-3 py-2 text-right">담당 콜</th>
                    <th className="border-b border-border px-3 py-2 text-right">당일정산</th>
                    <th className="border-b border-border px-3 py-2">지급완료</th>
                    {courseCodes.map((courseCode) => (
                      <th key={courseCode} className="border-b border-border px-3 py-2 text-right">
                        {courseCode} 수량/금액
                      </th>
                    ))}
                    <th className="border-b border-border px-3 py-2 text-right">정책 상태</th>
                  </tr>
                </thead>
                <tbody>
                  {result.settlements.map((settlement) => (
                    <tr key={settlement.employeeId} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-foreground">{settlement.displayName}</div>
                        <div className="text-xs text-muted">{settlement.staffCode}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{settlement.totalCallCount}건</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(settlement.totalCommissionAmount)}</td>
                      <td className="px-3 py-2">
                        <div
                          className={
                            settlement.paymentStatus.isPaid
                              ? "inline-flex border border-status-active bg-status-active px-2 py-1 text-xs font-semibold text-status-active-foreground"
                              : "inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted"
                          }
                        >
                          {settlement.paymentStatus.isPaid ? "지급완료" : "미지급"}
                        </div>
                        {settlement.paymentStatus.isPaid ? (
                          <div className="mt-1 text-xs text-muted">{formatKstDateTime(settlement.paymentStatus.paidAt)}</div>
                        ) : null}
                        {isMonthLocked ? null : (
                          <form action={setTherapistDailySettlementPaymentAction} className="mt-2">
                            <input name="operatingMonthId" type="hidden" value={selectedMonth.id} />
                            <input name="serviceDate" type="hidden" value={serviceDate} />
                            <input name="employeeId" type="hidden" value={settlement.employeeId} />
                            <input name="isPaid" type="hidden" value={settlement.paymentStatus.isPaid ? "false" : "true"} />
                            <button className="h-8 border border-border bg-background px-2 text-xs font-semibold text-foreground hover:bg-readonly" type="submit">
                              {settlement.paymentStatus.isPaid ? "완료 취소" : "지급완료"}
                            </button>
                          </form>
                        )}
                      </td>
                      {courseCodes.map((courseCode) => {
                        const summary = settlement.courseBreakdown[courseCode];
                        return (
                          <td key={courseCode} className="px-3 py-2 text-right tabular-nums">
                            <div>{summary.callCount}건</div>
                            <div className="text-xs text-muted">{formatVnd(summary.commissionAmount)}</div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right tabular-nums">
                        정책 없음 {settlement.warningCounts.missingPolicy} / 0원 정책 {settlement.warningCounts.zeroPolicy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="mt-5 border border-border bg-surface">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">콜별 산출 근거</h2>
              <p className="mt-1 text-sm text-muted">
                담당 역할, 코스, 수당 금액, 적용 수당 정책 상태를 함께 표시한다. 정책 없음 건은 0원 담당 건으로 남긴다.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-sm">
                <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
                  <tr>
                    <th className="border-b border-border px-3 py-2">마사지사</th>
                    <th className="border-b border-border px-3 py-2">콜 ID</th>
                    <th className="border-b border-border px-3 py-2">담당 역할</th>
                    <th className="border-b border-border px-3 py-2">코스</th>
                    <th className="border-b border-border px-3 py-2 text-right">수당</th>
                    <th className="border-b border-border px-3 py-2">정책 상태</th>
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
                        <td className="px-3 py-2">{roleLabel[evidence.role]}</td>
                        <td className="px-3 py-2">{evidence.courseCode}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatVnd(evidence.commissionAmount)}</td>
                        <td className="px-3 py-2">{rateStatusLabel[evidence.rateStatus]}</td>
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
          <h2 className="text-base font-semibold text-danger">출퇴근 입력 조회 실패</h2>
          <p className="mt-2 text-sm text-muted">{attendanceErrorMessage}</p>
          <form className="mt-4" method="get">
            <input name="operatingMonthId" type="hidden" value={selectedMonth.id} />
            <input name="serviceDate" type="hidden" value={serviceDate} />
            <button className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
              재조회
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
