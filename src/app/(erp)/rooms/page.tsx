import Link from "next/link";
import { RoomStatusCard } from "@/components/domain/room-status-card";
import { RoomStatusRefreshController } from "@/components/domain/room-status-refresh-controller";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listRoomStatuses } from "@/modules/rooms/room-status-service";

type RoomsPageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

function latestUpdatedAt(values: Array<{ updatedAt: string }>) {
  return values.reduce((latest, value) => (value.updatedAt > latest ? value.updatedAt : latest), new Date().toISOString());
}

export default async function RoomsPage({ searchParams }: { searchParams: Promise<RoomsPageSearchParams> }) {
  const account = await requireRouteAccess("/rooms");
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase text-muted">운영 현황</p>
          <h1 className="text-2xl font-semibold text-foreground">객실 현황</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">객실별 상태와 웨이터 안내 문구를 읽기 전용으로 조회한다.</p>
        </div>
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">운영월을 먼저 생성해 주세요</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">객실 현황은 운영월 날짜 범위 안의 객실 상태를 조회한다.</p>
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
  const [roomStatuses] = await Promise.all([listRoomStatuses({ operatingMonthId: selectedMonth.id, serviceDate })]);
  const lastUpdatedAt = latestUpdatedAt(roomStatuses);

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">운영 현황</p>
          <h1 className="text-2xl font-semibold text-foreground">객실 현황</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">객실별 상태, 남은 시간, 종료확인, 웨이터 안내 문구를 읽기 전용으로 조회한다.</p>
        </div>
        <RoomStatusRefreshController lastUpdatedAt={lastUpdatedAt} />
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
        <div className="ml-auto text-right text-xs text-muted">
          <div>운영월 상태: {selectedMonth.status}</div>
          <div>
            날짜 범위: {selectedMonth.startDate} ~ {selectedMonth.endDate}
          </div>
        </div>
      </form>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="객실 상태">
        {roomStatuses.map((status) => (
          <RoomStatusCard key={status.roomId} status={status} />
        ))}
      </section>
    </main>
  );
}
