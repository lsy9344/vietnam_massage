import Link from "next/link";
import { requireRouteAccess } from "@/lib/authorization";
import { selectedOperatingMonthFor } from "@/lib/operating-date";
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

function SettlementTabs() {
  return (
    <nav aria-label="정산 화면" className="mb-4 flex flex-wrap gap-2">
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements">
        마사지사 일일정산
      </Link>
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements/earcare">
        귀케어 일일정산
      </Link>
      <Link className="border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-readonly" href="/settlements/operations">
        운영팀 근무/일일인센
      </Link>
      <Link className="border border-brand bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground" href="/settlements/operations/monthly">
        운영팀 월인센
      </Link>
    </nav>
  );
}

function formatVnd(amount: number) {
  return `${new Intl.NumberFormat("ko-KR").format(amount)} VND`;
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

function thresholdLabel(result: OpsMonthlyIncentiveResultDto) {
  if (result.ruleStatus === "missing_policy") return "정책 없음";
  if (result.ruleStatus === "below_threshold") return "최저 구간 미달";
  return `${result.appliedThresholdCallCount}콜 이상`;
}

function PreviewNotice({ selectedMonth, result }: { selectedMonth: { status: string }; result: OpsMonthlyIncentiveResultDto }) {
  const isClosed = result.isClosedOrLocked;
  return (
    <section className="mb-4 border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
          {isClosed ? "현재 기준 미리보기" : "미확정 미리보기"}
        </span>
        <span className="text-sm font-semibold text-foreground">운영월 상태: {selectedMonth.status}</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {isClosed
          ? "마감확정/잠금 운영월의 확정값은 월마감 스냅샷 기준이며, 이 화면은 현재 콜 원장과 현재 정책 기준의 재계산 미리보기입니다."
          : "작성중/검토중 운영월의 현재 콜 원장과 현재 정책 기준 미확정 미리보기입니다."}
      </p>
    </section>
  );
}

function SnapshotSummary({ closing }: { closing: MonthlyClosingDto }) {
  const operations = closing.snapshot.operations;
  return (
    <section className="mb-4 border border-border bg-surface px-4 py-3" aria-label="운영팀 월인센 확정 스냅샷">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex border border-success bg-success/10 px-2 py-1 text-xs font-semibold text-success">확정 스냅샷</div>
          <h2 className="mt-2 text-base font-semibold text-foreground">{closing.snapshot.month.monthKey} 운영팀 확정 지급값</h2>
          <p className="mt-1 text-sm text-muted">
            snapshot id {closing.snapshot.id} / 확정시각 {closing.confirmedAt}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-muted">운영팀 확정 지급 합계</div>
          <div className="text-lg font-semibold text-foreground tabular-nums">{formatVnd(operations.totalOpsPayoutAmount)}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        <div className="border border-border bg-background px-3 py-2">
          <div className="text-xs text-muted">일일인센</div>
          <div className="font-semibold tabular-nums">{formatVnd(operations.dailyIncentiveAmount)}</div>
        </div>
        <div className="border border-border bg-background px-3 py-2">
          <div className="text-xs text-muted">월인센</div>
          <div className="font-semibold tabular-nums">{formatVnd(operations.monthlyIncentiveAmount)}</div>
        </div>
        <div className="border border-border bg-background px-3 py-2">
          <div className="text-xs text-muted">월 총콜</div>
          <div className="font-semibold tabular-nums">{operations.monthlyOpsCallCredit}콜</div>
        </div>
      </div>
    </section>
  );
}

function OpsMonthlySummary({ result }: { result: OpsMonthlyIncentiveResultDto }) {
  return (
    <section aria-label="운영팀 월 인센 요약" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">월 총콜</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{result.monthlyOpsCallCredit}콜</div>
        <div className="mt-1 text-xs text-muted">calculated 방문완료 콜 {result.sourceCallCount}건의 opsCallCredit 합계</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">적용 threshold</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{thresholdLabel(result)}</div>
        <div className="mt-1 text-xs text-muted">전체 월인센 {formatVnd(result.totalMonthlyIncentiveAmount)}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">직원 지급 합계</div>
        <div className="mt-1 text-xl font-semibold text-foreground">
          {formatVnd(result.rows.reduce((sum, row) => sum + row.payoutAmount, 0))}
        </div>
        <div className="mt-1 text-xs text-muted">미배분 {formatVnd(result.shares.undistributedAmount)}</div>
      </div>
      <div className="border border-border bg-surface px-4 py-3">
        <div className="text-xs font-medium text-muted">제외 warning</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{warningTotal(result)}건</div>
        <div className="mt-1 text-xs text-muted">
          비완료 {result.warningCounts.notCompleted}, 정책없음 {result.warningCounts.coursePolicyMissing}, 수당없음{" "}
          {result.warningCounts.therapistRateMissing}, D코스누락 {result.warningCounts.secondTherapistRequired}
        </div>
      </div>
    </section>
  );
}

function ShareSummary({ result }: { result: OpsMonthlyIncentiveResultDto }) {
  const rows = [
    ["팀장", result.shares.leadShare, result.shares.leadAmount],
    ["카운터팀", result.shares.counterTeamShare, result.shares.counterTeamAmount],
    ["웨이터팀", result.shares.waiterTeamShare, result.shares.waiterTeamAmount]
  ] as const;
  return (
    <section className="mb-4 border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">팀별 분배</h2>
        <p className="mt-1 text-sm text-muted">DB 정책 row의 분배율을 적용하고 integer VND 결과로 확정한다.</p>
      </div>
      <div className="grid gap-0 sm:grid-cols-3">
        {rows.map(([label, share, amount]) => (
          <div key={label} className="border-b border-border px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{formatVnd(amount)}</div>
            <div className="mt-1 text-xs text-muted">분배율 {formatShare(share)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmployeePayoutTable({ result }: { result: OpsMonthlyIncentiveResultDto }) {
  if (result.rows.length === 0) {
    return (
      <section className="mb-4 border border-border bg-surface px-4 py-5">
        <h2 className="text-base font-semibold text-foreground">활성 운영팀 직원이 없습니다</h2>
        <p className="mt-2 text-sm text-muted">월 인센 금액은 미배분으로 표시됩니다.</p>
      </section>
    );
  }

  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">직원별 월 인센 미리보기</h2>
        <p className="mt-1 text-sm text-muted">직원 식별과 row key는 Employee.id를 사용한다.</p>
      </div>
      <table className="min-w-[980px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">운영팀 직원</th>
            <th className="border-b border-border px-3 py-2">직책</th>
            <th className="border-b border-border px-3 py-2">팀 역할</th>
            <th className="border-b border-border px-3 py-2">분배율/팀 몫</th>
            <th className="border-b border-border px-3 py-2 text-right">지급 예상액</th>
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
              <td className="px-3 py-2">{row.position}</td>
              <td className="px-3 py-2">{row.teamShareLabel}</td>
              <td className="px-3 py-2">{row.calculationBasis}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(row.payoutAmount)}</td>
              <td className="px-3 py-2 text-muted">{row.calculationBasis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CallEvidenceTable({ result }: { result: OpsMonthlyIncentiveResultDto }) {
  if (result.callEvidence.length === 0) {
    return (
      <section className="mb-4 border border-border bg-surface px-4 py-5">
        <h2 className="text-base font-semibold text-foreground">월 총콜 산출 근거가 없습니다</h2>
        <p className="mt-2 text-sm text-muted">calculated 방문완료 콜이 없거나 opsCallCredit 합계가 0콜입니다.</p>
      </section>
    );
  }

  const visibleEvidence = result.callEvidence.slice(0, 50);
  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">월 총콜 산출 근거</h2>
        <p className="mt-1 text-sm text-muted">
          service DTO는 전체 evidence를 제공하며 화면에는 최대 50건만 표시한다. 총 {result.callEvidence.length}건.
        </p>
      </div>
      <table className="min-w-[640px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">콜 ID</th>
            <th className="border-b border-border px-3 py-2">서비스 날짜</th>
            <th className="border-b border-border px-3 py-2 text-right">opsCallCredit</th>
          </tr>
        </thead>
        <tbody>
          {visibleEvidence.map((evidence) => (
            <tr key={evidence.serviceCallId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2 font-mono text-xs text-muted">{evidence.serviceCallId}</td>
              <td className="px-3 py-2">{evidence.serviceDate}</td>
              <td className="px-3 py-2 text-right tabular-nums">{evidence.opsCallCredit}콜</td>
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
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase text-muted">정산</p>
          <h1 className="text-2xl font-semibold text-foreground">운영팀 월인센</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">운영월 전체 방문완료 콜 기준 운영팀 월 인센을 조회한다.</p>
        </div>
        <SettlementTabs />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">운영월을 먼저 생성해 주세요</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">운영팀 월 인센 미리보기는 운영월 전체 날짜 범위로만 조회할 수 있다.</p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              운영월 관리로 이동
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
    if (result.isClosedOrLocked) {
      try {
        closingSnapshot = await getMonthlyClosingSnapshot({
          operatingMonthId: selectedMonth.id
        });
      } catch (error) {
        if (error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND") {
          snapshotErrorMessage = "확정 스냅샷을 찾을 수 없습니다. 현재 기준 미리보기와 확정값을 혼동하지 마세요.";
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "운영팀 월 인센을 조회하지 못했습니다.";
  }

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">정산</p>
          <h1 className="text-2xl font-semibold text-foreground">운영팀 월인센</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">운영월 총콜과 정책 threshold 기준으로 월 인센 예상액과 직원별 분배 근거를 조회한다.</p>
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
        <button className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
          조회
        </button>
      </form>

      {errorMessage ? (
        <section className="border border-danger bg-surface px-4 py-5" role="alert">
          <h2 className="text-base font-semibold text-danger">운영팀 월 인센 조회 실패</h2>
          <p className="mt-2 text-sm text-muted">{errorMessage}</p>
          <form className="mt-4" method="get">
            <input name="operatingMonthId" type="hidden" value={selectedMonth.id} />
            <button className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
              재조회
            </button>
          </form>
        </section>
      ) : result ? (
        <>
          {closingSnapshot ? <SnapshotSummary closing={closingSnapshot} /> : null}
          {snapshotErrorMessage ? (
            <section className="mb-4 border border-warning bg-surface px-4 py-3" role="status">
              <h2 className="text-sm font-semibold text-warning">확정 스냅샷 없음</h2>
              <p className="mt-1 text-sm text-muted">{snapshotErrorMessage}</p>
            </section>
          ) : null}
          <PreviewNotice result={result} selectedMonth={selectedMonth} />
          {result.warningMessage ? (
            <section className="mb-4 border border-warning bg-surface px-4 py-3" role="status">
              <h2 className="text-sm font-semibold text-warning">미리보기 warning</h2>
              <p className="mt-1 text-sm text-muted">{result.warningMessage}</p>
            </section>
          ) : null}
          <OpsMonthlySummary result={result} />
          <ShareSummary result={result} />
          <EmployeePayoutTable result={result} />
          <CallEvidenceTable result={result} />
        </>
      ) : null}
    </main>
  );
}
