import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CallStatusKey = "reserved" | "inUse" | "cleaning" | "completed" | "noShow" | "canceled";

type FilledStatus = Exclude<CallStatusKey, "reserved" | "canceled">;

// 네 상태는 모양도 색도 서로 다르다(재생, 반짝임, 체크, 엑스). fill은 채운 칩, accent는 밝은 바탕 위의 같은 색이다.
// 예약·취소는 채우지 않은 ○ 칩 그대로다.
const filledConfig: Record<FilledStatus, { icon: ReactNode; fill: string; accent: string }> = {
  inUse: {
    icon: <path d="M8 4.5 20 12 8 19.5Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" strokeWidth="2.5" />,
    fill: "bg-info text-info-foreground",
    accent: "text-info"
  },
  cleaning: {
    icon: (
      <path d="M12 1.5C12.8 8.3 15.7 11.2 22.5 12 15.7 12.8 12.8 15.7 12 22.5 11.2 15.7 8.3 12.8 1.5 12 8.3 11.2 11.2 8.3 12 1.5Z" fill="currentColor" />
    ),
    fill: "bg-warning text-warning-foreground",
    accent: "text-warning"
  },
  completed: {
    icon: <path d="M4.5 12.5 9.8 17.8 19.5 6.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" />,
    fill: "bg-success text-success-foreground",
    accent: "text-success"
  },
  noShow: {
    icon: <path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3.4" />,
    fill: "bg-danger text-danger-foreground",
    accent: "text-danger"
  }
};

/**
 * 상태별 건수 한 줄(원장 머리, 실시간 요약, 대시보드, 고객 방문 건수)의 콜 상태 칩(design.md 2.4, 6.8): 진한 색으로 채운 알약 + 흰 그림 기호.
 * count.text를 주면 건수를 칩 끝의 밝은 방울에 넣는다. 0건이면 채움을 빼서 건수가 있는 상태만 튀게 한다.
 */
export function CallStatusChip({
  status,
  label,
  count,
  className
}: {
  status: CallStatusKey;
  label: string;
  /** value는 0건 판단용, text는 방울에 보일 글자(예: "2건"). 건수가 오른쪽 값 칸에 따로 있으면 value만 준다. */
  count?: { value: number; text?: string };
  className?: string;
}) {
  const filled = status === "reserved" || status === "canceled" ? null : filledConfig[status];
  const isEmptyFilled = filled !== null && count?.value === 0;
  const countText = count?.text;
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full text-sm font-semibold leading-none",
        countText === undefined ? "px-3" : "pl-3 pr-1.5",
        !filled ? "border border-border-strong bg-surface text-foreground" : isEmptyFilled ? "border border-border-strong text-muted" : filled.fill,
        className
      )}
    >
      {filled ? (
        <svg aria-hidden="true" className={cn("size-4 shrink-0", isEmptyFilled && filled.accent)} viewBox="0 0 24 24">
          {filled.icon}
        </svg>
      ) : (
        // U+FE0E: 기호를 늘 글자 모양으로 그린다(이모지로 바뀌지 않게).
        <span aria-hidden="true">{"○︎"}</span>
      )}
      <span>{label}</span>
      {countText === undefined ? null : (
        <>
          {" "}
          <span
            className={cn(
              "inline-flex h-6 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold",
              !filled ? "bg-readonly text-foreground" : isEmptyFilled ? "bg-readonly text-muted" : `bg-surface ${filled.accent}`
            )}
          >
            {countText}
          </span>
        </>
      )}
    </span>
  );
}
