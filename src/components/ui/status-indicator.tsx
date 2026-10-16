import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

// 상태는 글자 + 색 + 모양으로 함께 보인다. 기호는 U+FE0E로 늘 글자 모양(이모지 아님)으로 그린다.
const toneConfig: Record<StatusTone, { glyph: string; className: string }> = {
  neutral: { glyph: "○", className: "border border-border-strong bg-surface text-foreground" },
  info: { glyph: "◆", className: "bg-info-soft text-info" },
  success: { glyph: "●", className: "bg-success-soft text-success" },
  warning: { glyph: "▲", className: "bg-warning-soft text-warning" },
  danger: { glyph: "■", className: "bg-danger-soft text-danger" }
};

/**
 * 콜 상태, 근무 예정, 지급 확인 상태, 운영월 단계 같은 상태 표시.
 * 객실 상태는 기존 StatusBadge(객실 상태 전용 색)를 쓴다.
 */
export function StatusIndicator({
  tone,
  label,
  className,
  size = "md"
}: {
  tone: StatusTone;
  label: string;
  className?: string;
  /** sm: 한 줄에 여러 정보를 쌓는 촘촘한 목록(예: 빠른 예약의 가능 코스 줄)에서 쓰는 12px 칩. */
  size?: "md" | "sm";
}) {
  const config = toneConfig[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full font-semibold leading-none",
        size === "sm" ? "min-h-5 gap-1 px-2 text-xs" : "min-h-7 gap-1.5 px-2.5 text-sm",
        config.className,
        className
      )}
    >
      <span aria-hidden="true">{`${config.glyph}︎`}</span>
      {label}
    </span>
  );
}
