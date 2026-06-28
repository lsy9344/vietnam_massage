import type { RoomStatusDto } from "@/modules/rooms/dtos";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/domain/status-badge";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";
import { roomStatusLabel } from "@/lib/i18n/codes";
import { formatKstTime } from "@/lib/i18n/format";

function courseLabel(status: RoomStatusDto) {
  if (!status.course) return "-";
  const fallback = `${status.course.code} ${status.course.name}`.trim();
  return status.course.tvDisplayName || fallback;
}

function assigneeLine(status: RoomStatusDto) {
  const names = [status.therapist1?.displayName, status.therapist2?.displayName, status.earcare?.displayName].filter(Boolean);
  return names.length > 0 ? names.join(" / ") : "-";
}

function remainingLabel(t: ReturnType<typeof createTranslator>, status: RoomStatusDto) {
  if (status.remainingMinutes === null) return "-";
  return t("roomCard.minutes", { value: status.remainingMinutes <= 0 ? 0 : status.remainingMinutes });
}

export function RoomStatusCard({
  status,
  variant = "default",
  locale = defaultLocale
}: {
  status: RoomStatusDto;
  variant?: "default" | "tv";
  locale?: Locale;
}) {
  const t = createTranslator(locale);
  const isEndingSoon = status.displayStatus === "종료임박";
  const isEmpty = status.displayStatus === "빈방";
  const isTv = variant === "tv";
  const statusLabel = roomStatusLabel(locale, status.displayStatus);

  // 안내 문구는 전부 표시 경계에서 번역한다. 서비스의 status.guidanceText(한국어)는
  // 더 이상 화면에 직접 노출하지 않는다. 종료확인/종료임박/빈방은 짧은 표시 변형을 쓰고,
  // 예약/사용중/청소중은 status 키 기반 guidance 메시지로 번역한다.
  const guidance =
    status.displayStatus === "종료확인"
      ? t("roomCard.guidance.completeCheck")
      : status.displayStatus === "종료임박"
        ? t("roomCard.guidance.endingSoon")
        : status.displayStatus === "빈방"
          ? t("roomCard.guidance.empty")
          : t(`roomCard.guidance.${status.displayStatus}`);

  return (
    <article
      aria-label={`${status.roomDisplayName} ${statusLabel}`}
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
            label={statusLabel}
            ariaLabel={t("roomStatus.aria", { status: statusLabel })}
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
          {guidance}
        </p>
      </div>

      <div className={cn("grid grid-cols-2 gap-2 text-sm", isTv && "gap-4 text-[22px]")}>
        <div className="min-w-0">
          <p className={cn("text-xs font-medium text-muted", isTv && "text-base font-bold")}>{t("roomCard.field.course")}</p>
          <p className={cn("truncate font-semibold text-foreground", isTv && "text-[22px] font-bold leading-tight")}>{courseLabel(status)}</p>
        </div>
        <div className="min-w-0">
          <p className={cn("text-xs font-medium text-muted", isTv && "text-base font-bold")}>{t("roomCard.field.start")}</p>
          <p className={cn("font-semibold text-foreground [font-variant-numeric:tabular-nums]", isTv && "text-[22px] font-bold")}>{status.startTime ?? "-"}</p>
        </div>
        <div className="min-w-0">
          <p className={cn("text-xs font-medium text-muted", isTv && "text-base font-bold")}>{t("roomCard.field.remaining")}</p>
          <p className={cn("font-semibold text-foreground [font-variant-numeric:tabular-nums]", isTv && "text-[22px] font-bold")}>{remainingLabel(t, status)}</p>
        </div>
        <div className="min-w-0">
          <p className={cn("text-xs font-medium text-muted", isTv && "text-base font-bold")}>{t("roomCard.field.expectedEnd")}</p>
          <p className={cn("font-semibold text-foreground [font-variant-numeric:tabular-nums]", isTv && "text-[22px] font-bold")}>{formatKstTime(locale, status.expectedEndAt)}</p>
        </div>
      </div>

      <div className={cn("min-w-0 self-end border-t border-border pt-3", isTv && "pt-4")}>
        <p className={cn("text-xs font-medium text-muted", isTv && "text-base font-bold")}>{t("roomCard.field.assignee")}</p>
        <p className={cn("truncate text-sm font-semibold text-foreground", isTv && "text-[22px] font-bold leading-tight")}>{assigneeLine(status)}</p>
      </div>
    </article>
  );
}
