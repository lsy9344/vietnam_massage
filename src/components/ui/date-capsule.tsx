import type { ReactNode } from "react";

/** 카드와 목록 행 안의 예약시각·방문일(design.md 6.9). 표 셀 안에서는 캡슐 없이 글자로 둔다. */
export function DateCapsule({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full border border-border bg-surface-float px-2.5 text-xs font-semibold text-foreground">
      {children}
    </span>
  );
}
