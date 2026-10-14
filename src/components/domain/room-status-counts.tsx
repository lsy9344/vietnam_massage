import { StatusBadge, type StatusBadgeState } from "@/components/domain/status-badge";
import { createTranslator } from "@/lib/i18n";
import { roomStatusLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import type { RoomDisplayStatus } from "@/modules/rooms/dtos";

// 객실이 하루에 거치는 순서.
const dayOrder: StatusBadgeState[] = ["예약", "사용중", "종료임박", "종료확인", "청소중", "빈방"];

/**
 * 객실 화면 머리의 상태별 객실 수 한 줄(design.md 6.8). 객실 상태 서비스가 객실마다 준 표시 상태를 셀 뿐,
 * 점유나 종료를 다시 판정하지 않는다.
 */
export function RoomStatusCounts({ displayStatuses, locale }: { displayStatuses: RoomDisplayStatus[]; locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <ul aria-label={t("rooms.counts.aria")} className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      {dayOrder.map((state) => {
        const label = roomStatusLabel(locale, state);
        const count = displayStatuses.filter((displayStatus) => displayStatus === state).length;
        return (
          <li className="inline-flex items-center gap-1.5" key={state}>
            {/* 카드의 배지("상태: …")와 이름이 겹치지 않게 상태 이름만 붙인다. */}
            <StatusBadge ariaLabel={label} label={label} state={state} />
            <span className="text-sm font-semibold text-foreground">{t("rooms.counts.count", { count: formatNumber(locale, count) })}</span>
          </li>
        );
      })}
    </ul>
  );
}
