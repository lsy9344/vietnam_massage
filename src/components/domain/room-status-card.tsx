import type { RoomStatusDto } from "@/modules/rooms/dtos";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/domain/status-badge";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";
import { roomStatusLabel } from "@/lib/i18n/codes";
import { formatBusinessTime } from "@/lib/i18n/format";

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

  const timeClass = isTv
    ? "inline-flex items-baseline gap-2 text-[22px] font-bold text-foreground"
    : "inline-flex h-7 items-center gap-1 rounded-full border border-border bg-surface-float px-2.5 text-xs font-semibold";
  const timeLabelClass = isTv ? "text-base text-muted" : "font-medium text-muted";
  // 남은 시간은 손님이 객실에 있는 동안에만 뜻이 있다.
  const isOccupied = status.displayStatus === "사용중" || isEndingSoon || status.displayStatus === "종료확인";

  return (
    <article
      aria-label={`${status.roomDisplayName} ${statusLabel}`}
      className={cn(
        "flex h-full flex-col gap-2.5 rounded-lg border border-border bg-surface p-4",
        isEmpty && "border-dashed border-status-empty bg-surface",
        isEndingSoon && "status-attention border-status-ending-soon",
        status.displayStatus === "종료확인" && "status-attention border-status-complete-check",
        isTv && "min-h-[270px] gap-5 p-6"
      )}
      data-testid="room-status-card"
    >
      {/* 이름과 배지는 한 줄에 두되, 좁은 칸(TV 4열, 휴대폰)에서는 배지가 다음 줄로 내려간다. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className={cn("min-w-0 truncate text-lg font-semibold text-foreground", isTv && "text-[40px] font-black leading-none")}>
          {status.roomDisplayName}
        </h2>
        <StatusBadge
          // TV 배지는 28px라 베트남어 "Cần xác nhận kết thúc"가 좁은 칸(3열)에서 넘치지 않게 줄을 바꿀 수 있다.
          className={cn("max-w-full", isTv && "h-auto min-h-12 gap-2 whitespace-normal px-4 py-1.5 text-[28px] font-black leading-tight")}
          state={status.displayStatus}
          label={statusLabel}
          ariaLabel={t("roomStatus.aria", { status: statusLabel })}
        />
      </div>
      <p className={cn("line-clamp-2 text-sm text-muted", isTv && "text-[22px] font-bold leading-tight")}>{guidance}</p>

      <dl className={cn("grid gap-1.5 text-sm", isTv && "gap-2 text-[22px]")}>
        <div className="flex min-w-0 gap-2">
          <dt className={cn("shrink-0 text-muted", isTv && "font-bold")}>{t("roomCard.field.course")}</dt>
          <dd className={cn("min-w-0 truncate font-semibold text-foreground", isTv && "font-bold")}>{courseLabel(status)}</dd>
        </div>
        <div className="flex min-w-0 gap-2">
          <dt className={cn("shrink-0 text-muted", isTv && "font-bold")}>{t("roomCard.field.assignee")}</dt>
          <dd className={cn("min-w-0 truncate font-semibold text-foreground", isTv && "font-bold")}>{assigneeLine(status)}</dd>
        </div>
      </dl>

      {/* 시각은 서비스가 준 값을 그린다. 칸은 같은 자리에 두고 값이 없으면 "-"다. 빈방은 시각 줄이 없다. */}
      {!isEmpty ? (
        <p className={cn("mt-auto flex flex-wrap items-center gap-1.5", isTv && "gap-x-6 gap-y-2")}>
          <span className={timeClass}>
            <span className={timeLabelClass}>{t("roomCard.field.start")}</span>
            {status.startTime ?? "-"}
          </span>
          <span className={timeClass}>
            <span className={timeLabelClass}>{t("roomCard.field.expectedEnd")}</span>
            {formatBusinessTime(locale, status.expectedEndAt)}
          </span>
          {isOccupied ? (
            <span className={cn("ml-auto inline-flex items-baseline gap-1 text-sm font-semibold text-foreground", isTv && "ml-0 gap-2 text-[22px] font-bold")}>
              <span className={timeLabelClass}>{t("roomCard.field.remaining")}</span>
              {remainingLabel(t, status)}
            </span>
          ) : null}
        </p>
      ) : null}
    </article>
  );
}
