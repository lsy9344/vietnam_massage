import { requireRouteAccess } from "@/lib/authorization";
import { listOperatingMonths, type OperatingMonthDto } from "@/modules/masters/operating-month-service";
import { OperatingMonthManager } from "@/app/(erp)/masters/operating-months/operating-month-forms";

function kstTodayIsoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function getHighlightedMonthKey(months: OperatingMonthDto[]) {
  const today = kstTodayIsoDate();
  const currentMonth = months.find((month) => month.startDate <= today && month.endDate >= today);
  return currentMonth?.monthKey ?? months[0]?.monthKey ?? null;
}

export default async function OperatingMonthsPage() {
  await requireRouteAccess("/masters/operating-months");

  const months = await listOperatingMonths();

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">마스터 설정</p>
          <h1 className="text-2xl font-semibold text-foreground">운영월 관리</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            모든 콜 입력, 정산, 대시보드, 월마감이 공유할 운영월과 날짜 범위를 관리한다.
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>기본 상태: 작성중</div>
          <div>날짜 형식: YYYY-MM-DD</div>
        </div>
      </div>

      <OperatingMonthManager highlightedMonthKey={getHighlightedMonthKey(months)} months={months} />
    </main>
  );
}
