import Link from "next/link";
import { RoomStatusCard } from "@/components/domain/room-status-card";
import { RoomStatusRefreshController } from "@/components/domain/room-status-refresh-controller";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listRoomStatuses } from "@/modules/rooms/room-status-service";

type TvPageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

function latestUpdatedAt(values: Array<{ updatedAt: string }>) {
  return values.reduce((latest, value) => (value.updatedAt > latest ? value.updatedAt : latest), new Date().toISOString());
}

export default async function TvPage({ searchParams }: { searchParams: Promise<TvPageSearchParams> }) {
  const account = await requireRouteAccess("/tv");
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="fullscreen min-h-screen bg-background px-6 py-6 text-foreground lg:px-10">
        <section className="grid min-h-[calc(100vh-3rem)] place-items-center border border-border bg-surface p-8 text-center">
          <div>
            <p className="text-lg font-bold text-muted">운영 현황</p>
            <h1 className="mt-3 text-[40px] font-black leading-none">TV 현황판</h1>
            <p className="mt-5 text-[22px] font-bold text-muted">운영월을 먼저 생성해 주세요. TV 현황판은 fullscreen 읽기 전용 화면입니다.</p>
            {account.role === "administrator" ? (
              <Link className="mt-6 inline-flex text-lg font-bold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
                운영월 관리로 이동
              </Link>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  const serviceDate = clampDateToOperatingMonth(params.serviceDate, selectedMonth);
  const roomStatuses = await listRoomStatuses({ operatingMonthId: selectedMonth.id, serviceDate });
  const lastUpdatedAt = latestUpdatedAt(roomStatuses);

  return (
    <main className="fullscreen min-h-screen bg-background px-5 py-5 text-foreground lg:px-8 lg:py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-5 border-b border-border pb-4">
        <div>
          <p className="text-lg font-bold text-muted">운영 현황 · fullscreen · 읽기 전용</p>
          <h1 className="mt-1 text-[40px] font-black leading-none">TV 현황판</h1>
          <p className="mt-2 text-lg font-semibold text-muted">
            {selectedMonth.monthKey} · {serviceDate} · {selectedMonth.status}
          </p>
        </div>
        <RoomStatusRefreshController lastUpdatedAt={lastUpdatedAt} variant="tv" />
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="객실 상태">
        {roomStatuses.map((status) => (
          <RoomStatusCard key={status.roomId} status={status} variant="tv" />
        ))}
      </section>
    </main>
  );
}
