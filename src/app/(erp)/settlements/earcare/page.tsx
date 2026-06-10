import Link from "next/link";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listEarcareAttendanceForDate, type EarcareAttendanceForDateDto } from "@/modules/settlements/earcare-attendance-service";
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
        귀케어 근무상태
      </Link>
    </nav>
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
            <h1 className="text-2xl font-semibold text-foreground">귀케어 근무상태</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">귀케어 일일정산 전에 날짜별 정상 근무 대상과 제외 사유를 저장한다.</p>
          </div>
        </div>
        <SettlementTabs />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">운영월을 먼저 생성해 주세요</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">귀케어 근무상태는 운영월 날짜 범위 안에서만 입력할 수 있다.</p>
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
  let errorMessage: string | null = null;

  try {
    result = await listEarcareAttendanceForDate({
      operatingMonthId: selectedMonth.id,
      attendanceDate
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "귀케어 근무상태를 조회하지 못했습니다.";
  }

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">정산</p>
          <h1 className="text-2xl font-semibold text-foreground">귀케어 근무상태</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">날짜별 귀케어사 근무상태를 저장해 후속 귀케어 일일정산의 지급 대상 목록으로 사용한다.</p>
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
          <h2 className="text-base font-semibold text-danger">귀케어 근무상태 조회 실패</h2>
          <p className="mt-2 text-sm text-muted">{errorMessage}</p>
          <form className="mt-4" method="get">
            <input name="operatingMonthId" type="hidden" value={selectedMonth.id} />
            <input name="attendanceDate" type="hidden" value={attendanceDate} />
            <button className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
              재조회
            </button>
          </form>
        </section>
      ) : result ? (
        <>
          <section aria-label="귀케어 근무상태 요약" className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">귀케어사</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{result.rows.length}명</div>
            </div>
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">지급 대상</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{result.rows.filter((row) => row.isPayoutEligible).length}명</div>
            </div>
            <div className="border border-border bg-surface px-4 py-3">
              <div className="text-xs font-medium text-muted">제외</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{result.rows.filter((row) => !row.isPayoutEligible).length}명</div>
            </div>
          </section>
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
