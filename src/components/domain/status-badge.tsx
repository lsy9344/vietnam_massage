import { cn } from "@/lib/utils";

export const statusBadgeStates = ["사용중", "예약", "청소중", "종료확인", "빈방", "종료임박"] as const;

export type StatusBadgeState = (typeof statusBadgeStates)[number];

const statusBadgeConfig: Record<
  StatusBadgeState,
  {
    glyph: string;
    className: string;
  }
> = {
  사용중: {
    glyph: "●",
    className: "bg-status-active text-status-active-foreground"
  },
  종료임박: {
    glyph: "◴",
    className: "bg-status-ending-soon text-status-ending-soon-foreground"
  },
  예약: {
    glyph: "◷",
    className: "bg-status-reserved text-status-reserved-foreground"
  },
  청소중: {
    glyph: "◐",
    className: "bg-status-cleaning text-status-cleaning-foreground"
  },
  종료확인: {
    glyph: "⚠",
    className: "bg-status-complete-check text-status-complete-check-foreground"
  },
  빈방: {
    glyph: "○",
    className: "border border-status-empty bg-surface text-status-empty-foreground"
  }
};

export function StatusBadge({
  state,
  label,
  ariaLabel,
  className
}: {
  /** RoomDisplayStatus 한국어 stable key (색/glyph 조회 + 비교용). */
  state: StatusBadgeState;
  /** 화면에 보일 번역 라벨. 미지정 시 state(한국어)로 fallback. */
  label?: string;
  /** 접근성 라벨. 미지정 시 한국어 "상태: {state}"로 fallback. */
  ariaLabel?: string;
  className?: string;
}) {
  const config = statusBadgeConfig[state];
  const displayLabel = label ?? state;

  return (
    <span
      aria-label={ariaLabel ?? `상태: ${state}`}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold leading-none",
        config.className,
        className
      )}
    >
      <span aria-hidden="true">{config.glyph}</span>
      {displayLabel}
    </span>
  );
}
