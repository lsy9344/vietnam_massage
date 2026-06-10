import Link from "next/link";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listEarcareAttendanceForDate, type EarcareAttendanceForDateDto } from "@/modules/settlements/earcare-attendance-service";
import {
  listEarcareDailySettlements,
  type EarcareDailySettlementResultDto
} from "@/modules/settlements/earcare-daily-settlement-service";
import { EarcareAttendanceTable } from "@/app/(erp)/settlements/earcare/earcare-attendance-table";

type EarcareAttendancePageSearchParams = {
  operatingMonthId?: string;
  attendanceDate?: string;
};

function SettlementTabs() {
  return (
    <nav aria-label="정산 화면" className="mb-4 flex flex-wrap gap-2">
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements">
        마사지사 일일정산
      </Link>
      <Link className="border border-brand bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground" href="/settlements/earcare">
        귀케어 일일정산
      </Link>
    </nav>
  );
}

function formatVnd(amount: number) {
  return `${new Intl.NumberFormat("ko-KR").format(amount)} VND`;
}

function warningTotal(result: EarcareDailySettlementResultDto) {
  return (
    result.warningCounts.notCompleted +
    result.warningCounts.coursePolicyMissing +
    result.warningCounts.therapistRateMissing +
    result.warningCounts.secondTherapistRequired
  );
}

function EarcareSettlementSummary({ result }: { result: EarcareDailySettlementResultDto }) {
  return (
    <section aria-label="귀케어 일일정산 요약" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">방문완료 풀</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{formatVnd(result.earcarePoolTotal)}</div>
        <div className="mt-1 text-xs text-muted">calculated 완료 콜 {result.sourceCallCount}건 기준</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">정상 근무자</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{result.eligibleCount}명</div>
        <div className="mt-1 text-xs text-muted">기본 몫 {formatVnd(result.baseShareAmount)}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">지급 합계</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{formatVnd(result.distributedAmount)}</div>
        <div className="mt-1 text-xs text-muted">잔여 배분 {formatVnd(result.remainderAmount)}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">미분배 / 제외 warning</div>
        <div className="mt-1 text-xl font-semibold text-foreground">
          {formatVnd(result.undistributedAmount)} / {warningTotal(result)}건
        </div>
        <div className="mt-1 text-xs text-muted">
          비완료 {result.warningCounts.notCompleted}, 정책없음 {result.warningCounts.coursePolicyMissing}, 수당없음{" "}
          {result.warningCounts.therapistRateMissing}, D코스누락 {result.warningCounts.secondTherapistRequired}
        </div>
      </div>
    </section>
  );
}

function EarcareSettlementTable({ result }: { result: EarcareDailySettlementResultDto }) {
  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">귀케어사별 지급액</h2>
        <p className="mt-1 text-sm text-muted">근무상태, 지급 판정, 지급액, 산출 근거를 같은 조회 날짜 기준으로 표시한다.</p>
      </div>
      <table className="min-w-[920px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">귀케어사</th>
            <th className="border-b border-border px-3 py-2">근무상태</th>
            <th className="border-b border-border px-3 py-2">지급 판정</th>
            <th className="border-b border-border px-3 py-2 text-right">기본 몫</th>
            <th className="border-b border-border px-3 py-2 text-right">잔여 배분</th>
            <th className="border-b border-border px-3 py-2 text-right">지급액</th>
            <th className="border-b border-border px-3 py-2">산출 근거</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.employeeId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2">
                <div className="font-semibold text-foreground">{row.displayName}</div>
                <div className="text-xs text-muted">{row.staffCode}</div>
              </td>
              <td className="px-3 py-2">{row.statusDisplayName}</td>
              <td className="px-3 py-2">
                {row.isPayoutEligible ? (
                  <span className="inline-flex border border-success bg-success/10 px-2 py-1 text-xs font-semibold text-success">지급 대상</span>
                ) : (
                  <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
                    제외: {row.exclusionReason ?? row.statusDisplayName}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatVnd(row.baseShareAmount)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatVnd(row.remainderShareAmount)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(row.payoutAmount)}</td>
              <td className="px-3 py-2 text-muted">{row.calculationBasis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EarcarePoolEvidenceTable({ result }: { result: EarcareDailySettlementResultDto }) {
  if (result.poolEvidence.length === 0) {
    return (
      <section className="mb-4 border border-border bg-surface px-4 py-5">
        <h2 className="text-base font-semibold text-foreground">방문완료 귀케어 풀이 없습니다</h2>
        <p className="mt-2 text-sm text-muted">calculated 방문완료 콜이 없거나 귀케어 풀 금액이 0원입니다.</p>
      </section>
    );
  }

  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">풀 산출 근거</h2>
        <p className="mt-1 text-sm text-muted">calls domain의 완료 콜 계산 결과에서 받은 귀케어 풀만 합산한다.</p>
      </div>
      <table className="min-w-[640px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">콜 ID</th>
            <th className="border-b border-border px-3 py-2">서비스 날짜</th>
            <th className="border-b border-border px-3 py-2 text-right">귀케어 풀</th>
          </tr>
        </thead>
        <tbody>
          {result.poolEvidence.map((evidence) => (
            <tr key={evidence.serviceCallId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2 font-mono text-xs text-muted">{evidence.serviceCallId}</td>
              <td className="px-3 py-2">{evidence.serviceDate}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatVnd(evidence.earcarePoolAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function EarcareAttendancePage({ searchParams }: { searchParams: Promise<EarcareAttendancePageSearchParams> }) {
  const account = await requireRouteAccess("/settlements/earcare");
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <div className="mb-5 flex items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted">정산</p>
            <h1 className="text-2xl font-semibold text-foreground">귀케어 일일정산</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">방문완료 귀케어 풀과 날짜별 정상 근무 대상 기준으로 지급액을 조회한다.</p>
          </div>
        </div>
        <SettlementTabs />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">운영월을 먼저 생성해 주세요</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">귀케어 일일정산은 운영월 날짜 범위 안에서만 조회할 수 있다.</p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              운영월 관리로 이동
            </Link>
          ) : null}
        </section>
      </main>
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
    errorMessage = error instanceof Error ? error.message : "귀케어 일일정산을 조회하지 못했습니다.";
  }

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">정산</p>
          <h1 className="text-2xl font-semibold text-foreground">귀케어 일일정산</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">방문완료 콜 귀케어 풀을 정상 근무 귀케어사에게 균등 분배하고 근무상태 원천을 함께 관리한다.</p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>운영월 상태: {selectedMonth.status}</div>
          <div>
            날짜 범위: {selectedMonth.startDate} ~ {selectedMonth.endDate}
          </div>
        </div>
      </div>

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
            defaultValue={attendanceDate}
            max={selectedMonth.endDate}
            min={selectedMonth.startDate}
            name="attendanceDate"
            type="date"
          />
        </label>
        <button className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
          조회
        </button>
      </form>

      {result?.isLocked ? (
        <section className="mb-4 border border-danger bg-surface px-4 py-3" role="status">
          <h2 className="text-sm font-semibold text-danger">잠긴 운영월입니다</h2>
          <p className="mt-1 text-sm text-muted">이 운영월의 귀케어 근무상태는 수정할 수 없습니다. 입력 항목은 읽기 전용으로 표시됩니다.</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="border border-danger bg-surface px-4 py-5" role="alert">
          <h2 className="text-base font-semibold text-danger">귀케어 일일정산 조회 실패</h2>
          <p className="mt-2 text-sm text-muted">{errorMessage}</p>
          <form className="mt-4" method="get">
            <input name="operatingMonthId" type="hidden" value={selectedMonth.id} />
            <input name="attendanceDate" type="hidden" value={attendanceDate} />
            <button className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
              재조회
            </button>
          </form>
        </section>
      ) : result && settlementResult ? (
        <>
          <EarcareSettlementSummary result={settlementResult} />
          <EarcareSettlementTable result={settlementResult} />
          <EarcarePoolEvidenceTable result={settlementResult} />
          <EarcareAttendanceTable
            attendanceDate={result.attendanceDate}
            disabled={result.isLocked}
            operatingMonthId={result.operatingMonthId}
            rows={result.rows}
            statusOptions={result.statusOptions}
          />
        </>
      ) : null}
    </main>
  );
}
