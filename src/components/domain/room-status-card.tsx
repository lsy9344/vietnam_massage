import type { RoomStatusDto } from "@/modules/rooms/dtos";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/domain/status-badge";

function formatKstTime(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function courseLabel(status: RoomStatusDto) {
  if (!status.course) return "-";
  const fallback = `${status.course.code} ${status.course.name}`.trim();
  return status.course.tvDisplayName || fallback;
}

function assigneeLine(status: RoomStatusDto) {
  const names = [status.therapist1?.displayName, status.therapist2?.displayName, status.earcare?.displayName].filter(Boolean);
  return names.length > 0 ? names.join(" / ") : "-";
}

function remainingLabel(status: RoomStatusDto) {
  if (status.remainingMinutes === null) return "-";
  return status.remainingMinutes <= 0 ? "0분" : `${status.remainingMinutes}분`;
}

export function RoomStatusCard({ status, variant = "default" }: { status: RoomStatusDto; variant?: "default" | "tv" }) {
  const isAttention = status.displayStatus === "종료확인";
  const isEmpty = status.displayStatus === "빈방";

  return (
    <article
      aria-label={`${status.roomDisplayName} ${status.displayStatus}`}
      className={cn(
        "grid min-h-56 gap-3 border border-border bg-surface p-4",
        "rounded-md",
        isEmpty && "border-dashed bg-background",
        isAttention && "status-attention border-status-complete-check",
        variant === "tv" && "min-h-64 p-5"
      )}
      data-testid="room-status-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-foreground">{status.roomDisplayName}</h2>
          <p className="mt-1 text-xs text-muted">{isAttention ? "결제·확인 필요" : isEmpty ? "즉시 가능" : status.guidanceText}</p>
        </div>
        <StatusBadge state={status.displayStatus} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">코스</p>
          <p className="truncate font-semibold text-foreground">{courseLabel(status)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">시작</p>
          <p className="font-semibold text-foreground [font-variant-numeric:tabular-nums]">{status.startTime ?? "-"}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">남은분</p>
          <p className="font-semibold text-foreground [font-variant-numeric:tabular-nums]">{remainingLabel(status)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">종료예정</p>
          <p className="font-semibold text-foreground [font-variant-numeric:tabular-nums]">{formatKstTime(status.expectedEndAt)}</p>
        </div>
      </div>

      <div className="min-w-0 border-t border-border pt-3">
        <p className="text-xs font-medium text-muted">담당자</p>
        <p className="truncate text-sm font-semibold text-foreground">{assigneeLine(status)}</p>
      </div>
    </article>
  );
}
