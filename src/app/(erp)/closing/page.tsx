import Link from "next/link";
import { requireRouteAccess } from "@/lib/authorization";
import { selectedOperatingMonthFor } from "@/lib/operating-date";
import {
  listMonthlyClosingPreview,
  type MonthlyClosingPreviewDto
} from "@/modules/closing/monthly-closing-preview-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";

type ClosingPageSearchParams = {
  operatingMonthId?: string;
};

function formatVnd(amount: number) {
  return `${new Intl.NumberFormat("ko-KR").format(amount)} VND`;
}

function PreviewNotice({ result }: { result: MonthlyClosingPreviewDto }) {
  const isClosed = result.previewStatus === "closed_current";
  return (
    <section className="mb-4 border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
          {isClosed ? "현재 기준 미리보기" : "미확정 미리보기"}
        </span>
        <span className="text-sm font-semibold text-foreground">운영월 상태: {result.status}</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {isClosed
          ? "마감확정/잠금 운영월의 확정값은 월마감 스냅샷 기준입니다. 이 화면은 현재 콜 원장과 현재 정책 기준의 미리보기입니다."
          : "작성중/검토중 운영월의 현재 콜 원장과 현재 정책 기준 미확정 미리보기입니다."}
      </p>
    </section>
  );
}

function SummaryBand({ result }: { result: MonthlyClosingPreviewDto }) {
  const rows = [
    ["마사지사 지급 합계", result.totals.therapistPayoutAmount, `${result.therapists.totalCallCount} 담당 건`],
    ["운영팀 일일인센", result.totals.opsDailyIncentiveAmount, `${result.operations.rows.length} 직원 row`],
    ["운영팀 월인센", result.totals.opsMonthlyIncentiveAmount, `${result.operations.monthlyOpsCallCredit} 월 총콜`],
    ["귀케어 지급 합계", result.totals.earcarePayoutAmount, `${result.earcare.sourceCallCount} source call`],
    ["전체 지급 합계", result.totals.grandPayoutAmount, `warning ${result.warningCounts.total}건`]
  ] as const;

  return (
    <section aria-label="월마감 미리보기 요약" className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {rows.map(([label, amount, basis]) => (
        <div key={label} className="border border-border bg-surface px-4 py-3">
          <div className="text-xs font-medium text-muted">{label}</div>
          <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">{formatVnd(amount)}</div>
          <div className="mt-1 text-xs text-muted">{basis}</div>
        </div>
      ))}
    </section>
  );
}

function TherapistTable({ result }: { result: MonthlyClosingPreviewDto }) {
  if (result.therapists.rows.length === 0) {
    return (
      <section className="mb-4 border border-border bg-surface px-4 py-5">
        <h2 className="text-base font-semibold text-foreground">마사지사 지급 대상이 없습니다</h2>
        <p className="mt-2 text-sm text-muted">운영월 기간에 기존 일별 마사지사 정산 결과가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">마사지사</h2>
        <p className="mt-1 text-sm text-muted">직원 row key와 downstream 식별자는 Employee.id이며, 보너스는 Story 5.2 대기 상태로 분리한다.</p>
      </div>
      <table className="min-w-[1120px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">마사지사</th>
            <th className="border-b border-border px-3 py-2 text-right">월 총 담당 콜</th>
            <th className="border-b border-border px-3 py-2 text-right">월 정산액</th>
            <th className="border-b border-border px-3 py-2">만근/보너스 상태</th>
            <th className="border-b border-border px-3 py-2 text-right">최종지급액 기초값</th>
            <th className="border-b border-border px-3 py-2">산출 근거</th>
          </tr>
        </thead>
        <tbody>
          {result.therapists.rows.map((row) => (
            <tr key={row.employeeId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2">
                <div className="font-semibold text-foreground">{row.displayName}</div>
                <div className="text-xs text-muted">{row.staffCode}</div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.totalCallCount}건</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(row.monthlySettlementAmount)}</td>
              <td className="px-3 py-2 text-muted">만근수당/갯수왕 수당 후속 story 대기</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(row.finalBasePayoutAmount)}</td>
              <td className="px-3 py-2 text-muted">
                evidence {row.assignmentEvidenceCount}건, zero policy {row.warningCounts.zeroPolicy}, missing policy {row.warningCounts.missingPolicy}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function OperationsTable({ result }: { result: MonthlyClosingPreviewDto }) {
  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">운영팀</h2>
        <p className="mt-1 text-sm text-muted">
          일일인센은 운영월 날짜별 결과를 합산하고, 월인센은 기존 월 인센 preview service의 threshold와 분배 근거를 재사용한다.
        </p>
      </div>
      <table className="min-w-[980px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">운영팀 직원</th>
            <th className="border-b border-border px-3 py-2">직책</th>
            <th className="border-b border-border px-3 py-2 text-right">일일인센</th>
            <th className="border-b border-border px-3 py-2 text-right">월인센</th>
            <th className="border-b border-border px-3 py-2 text-right">운영팀 지급 합계</th>
            <th className="border-b border-border px-3 py-2">산출 근거</th>
          </tr>
        </thead>
        <tbody>
          {result.operations.rows.map((row) => (
            <tr key={row.employeeId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2">
                <div className="font-semibold text-foreground">{row.displayName}</div>
                <div className="text-xs text-muted">{row.staffCode}</div>
              </td>
              <td className="px-3 py-2">{row.position}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatVnd(row.dailyIncentiveAmount)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatVnd(row.monthlyIncentiveAmount)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(row.totalOpsPayoutAmount)}</td>
              <td className="px-3 py-2 text-muted">
                일일 evidence {row.dailyEvidenceCount}일
                {row.monthlyCalculationBasis ? ` / ${row.monthlyCalculationBasis}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EarcareTable({ result }: { result: MonthlyClosingPreviewDto }) {
  return (
    <section className="mb-4 overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">귀케어</h2>
        <p className="mt-1 text-sm text-muted">정상근무자 0명과 미분배 금액은 지급 합계에 숨기지 않고 warning 근거로 표시한다.</p>
      </div>
      <table className="min-w-[760px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">귀케어 직원</th>
            <th className="border-b border-border px-3 py-2 text-right">지급 대상 일수</th>
            <th className="border-b border-border px-3 py-2 text-right">귀케어 지급액</th>
            <th className="border-b border-border px-3 py-2">산출 근거</th>
          </tr>
        </thead>
        <tbody>
          {result.earcare.rows.map((row) => (
            <tr key={row.employeeId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2">
                <div className="font-semibold text-foreground">{row.displayName}</div>
                <div className="text-xs text-muted">{row.staffCode}</div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.eligibleDayCount}일</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(row.payoutAmount)}</td>
              <td className="px-3 py-2 text-muted">{row.calculationBasis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EvidenceSection({ result }: { result: MonthlyClosingPreviewDto }) {
  return (
    <section className="mb-4 border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">산출 근거/warning</h2>
        <p className="mt-1 text-sm text-muted">
          기간 {result.evidence.period}, source day count {result.evidence.sourceDayCount}, included call count {result.evidence.includedCallCount},
          excluded call count {result.evidence.excludedCallCount}
        </p>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-border px-4 py-3 md:border-r">
          <div className="text-xs font-medium text-muted">warning counts</div>
          <div className="mt-1 text-sm text-foreground">
            total {result.warningCounts.total}, policy {result.evidence.policyWarningCount}, 마사지사 제외 {result.warningCounts.therapistExcludedCallCount},
            운영팀 일일{" "}
            {result.warningCounts.opsDaily.notCompleted +
              result.warningCounts.opsDaily.coursePolicyMissing +
              result.warningCounts.opsDaily.therapistRateMissing +
              result.warningCounts.opsDaily.secondTherapistRequired}
            , 운영팀 월{" "}
            {result.warningCounts.opsMonthly.notCompleted +
              result.warningCounts.opsMonthly.coursePolicyMissing +
              result.warningCounts.opsMonthly.therapistRateMissing +
              result.warningCounts.opsMonthly.secondTherapistRequired}
            , 운영팀 메시지 {result.warningCounts.opsWarningMessageCount}, 귀케어 정상근무자 0명 {result.warningCounts.earcareNormalStaffZeroDays}, 미분배{" "}
            {result.warningCounts.earcareUndistributedDays}
          </div>
        </div>
        <div className="border-b border-border px-4 py-3">
          <div className="text-xs font-medium text-muted">대표 evidence</div>
          <div className="mt-1 break-all text-sm text-foreground">
            {[
              ...result.evidence.representativeEvidence.therapist,
              ...result.evidence.representativeEvidence.operationsDaily,
              ...result.evidence.representativeEvidence.operationsMonthly,
              ...result.evidence.representativeEvidence.earcare
            ].join(", ") || "evidence 없음"}
          </div>
        </div>
      </div>
      {result.operations.warningMessages.length > 0 ? (
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-muted">운영팀 warning</div>
          <ul className="mt-1 list-inside list-disc text-sm text-muted">
            {result.operations.warningMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default async function ClosingPage({ searchParams }: { searchParams: Promise<ClosingPageSearchParams> }) {
  const account = await requireRouteAccess("/closing");
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase text-muted">월마감</p>
          <h1 className="text-2xl font-semibold text-foreground">월마감 미리보기</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">운영월 전체 날짜 범위로 지급액 미리보기를 집계한다.</p>
        </div>
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">운영월을 먼저 생성해 주세요</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">월마감 미리보기는 운영월 시작일과 종료일 기준으로만 조회할 수 있다.</p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              운영월 관리로 이동
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  let result: MonthlyClosingPreviewDto | null = null;
  let errorMessage: string | null = null;

  try {
    result = await listMonthlyClosingPreview({
      operatingMonthId: selectedMonth.id
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "월마감 미리보기를 조회하지 못했습니다.";
  }

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">월마감</p>
          <h1 className="text-2xl font-semibold text-foreground">월마감 미리보기</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">마사지사, 운영팀, 귀케어 지급액을 운영월 날짜 범위 기준으로 읽기 전용 집계한다.</p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>운영월 상태: {selectedMonth.status}</div>
          <div>
            날짜 범위: {selectedMonth.startDate} ~ {selectedMonth.endDate}
          </div>
        </div>
      </div>

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
          <h2 className="text-base font-semibold text-danger">월마감 미리보기 조회 실패</h2>
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
          <PreviewNotice result={result} />
          <SummaryBand result={result} />
          <TherapistTable result={result} />
          <OperationsTable result={result} />
          <EarcareTable result={result} />
          <EvidenceSection result={result} />
        </>
      ) : null}
    </main>
  );
}
