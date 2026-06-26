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
  const isEndingSoon = status.displayStatus === "종료임박";
  const isEmpty = status.displayStatus === "빈방";
  const isTv = variant === "tv";

  return (
    <article
      aria-label={`${status.roomDisplayName} ${status.displayStatus}`}
      className={cn(
        "grid h-full min-h-56 grid-rows-[auto_auto_1fr] gap-3 border border-border bg-surface p-4",
        "rounded-md",
        isEmpty && "border-dashed border-status-empty bg-surface",
        isEndingSoon && "status-attention border-status-ending-soon",
        status.displayStatus === "종료확인" && "status-attention border-status-complete-check",
        isTv && "min-h-[270px] gap-5 p-6"
      )}
      data-testid="room-status-card"
    >
      <div className="min-w-0">
        {/* Badge on its own row so the large room name never has to share
            horizontal space with it (the prior side-by-side layout overflowed
            narrow 4-up TV columns). */}
        <div className="flex justify-start">
          <StatusBadge
            className={cn("max-w-full", isTv && "h-12 gap-2 px-4 text-[28px] font-black")}
            state={status.displayStatus}
          />
        </div>
        <h2
          className={cn(
            "mt-2 truncate text-xl font-semibold text-foreground",
            isTv && "mt-3 text-[40px] font-black leading-none"
          )}
        >
          {status.roomDisplayName}
        </h2>
        <p className={cn("mt-1 line-clamp-2 text-xs text-muted", isTv && "mt-3 text-[22px] font-bold leading-tight")}>
          {status.displayStatus === "종료확인" ? "결제·확인 필요" : isEndingSoon ? "곧 종료" : isEmpty ? "즉시 가능" : status.guidanceText}
        </p>
      </div>

      <div className={cn("grid grid-cols-2 gap-2 text-sm", isTv && "gap-4 text-[22px]")}>
        <div className="min-w-0">
          <p className={cn("text-xs font-medium text-muted", isTv && "text-base font-bold")}>코스</p>
          <p className={cn("truncate font-semibold text-foreground", isTv && "text-[22px] font-bold leading-tight")}>{courseLabel(status)}</p>
        </div>
        <div className="min-w-0">
          <p className={cn("text-xs font-medium text-muted", isTv && "text-base font-bold")}>시작</p>
          <p className={cn("font-semibold text-foreground [font-variant-numeric:tabular-nums]", isTv && "text-[22px] font-bold")}>{status.startTime ?? "-"}</p>
        </div>
        <div className="min-w-0">
          <p className={cn("text-xs font-medium text-muted", isTv && "text-base font-bold")}>남은분</p>
          <p className={cn("font-semibold text-foreground [font-variant-numeric:tabular-nums]", isTv && "text-[22px] font-bold")}>{remainingLabel(status)}</p>
        </div>
        <div className="min-w-0">
          <p className={cn("text-xs font-medium text-muted", isTv && "text-base font-bold")}>종료예정</p>
          <p className={cn("font-semibold text-foreground [font-variant-numeric:tabular-nums]", isTv && "text-[22px] font-bold")}>{formatKstTime(status.expectedEndAt)}</p>
        </div>
      </div>

      <div className={cn("min-w-0 self-end border-t border-border pt-3", isTv && "pt-4")}>
        <p className={cn("text-xs font-medium text-muted", isTv && "text-base font-bold")}>담당자</p>
        <p className={cn("truncate text-sm font-semibold text-foreground", isTv && "text-[22px] font-bold leading-tight")}>{assigneeLine(status)}</p>
      </div>
    </article>
  );
}
