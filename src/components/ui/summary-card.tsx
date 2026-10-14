import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 같은 지표는 모든 화면에서 같은 색이다(design.md 2.3). 파스텔에는 상태 뜻이 없다. */
export type SummaryAccent = "lavender" | "blue" | "peach" | "mint" | "butter";

const accentClass: Record<SummaryAccent, string> = {
  lavender: "bg-accent-lavender",
  blue: "bg-accent-blue",
  peach: "bg-accent-peach",
  mint: "bg-accent-mint",
  butter: "bg-accent-butter"
};

/**
 * 화면 맨 위 요약 카드 한 줄(design.md 6.7). 최대 4장이고 600px 미만에서는 한 열로 쌓는다.
 * 테두리와 그림자가 없고, 카드 안 글자는 모두 검정 잉크다.
 */
export function SummaryCards({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <dl aria-label={label} className={cn("grid grid-cols-1 gap-4 min-[600px]:grid-cols-2 min-[1200px]:grid-cols-4", className)}>
      {children}
    </dl>
  );
}

export function SummaryCard({
  accent,
  label,
  value,
  unit,
  note
}: {
  accent: SummaryAccent;
  label: string;
  value: string;
  /** 값 뒤의 작은 단위(예: VND). */
  unit?: string;
  /** 값 아래 한 줄 설명. */
  note?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-lg px-5 py-4 text-foreground", accentClass[accent])}>
      <dt className="text-sm font-semibold">{label}</dt>
      <dd className="mt-3 text-[1.75rem] font-semibold leading-none tracking-[-0.03em] min-[1200px]:text-4xl">
        {value}
        {unit ? (
          <>
            {" "}
            <span className="text-sm font-semibold tracking-normal">{unit}</span>
          </>
        ) : null}
      </dd>
      {note ? <dd className="mt-2 text-xs">{note}</dd> : null}
    </div>
  );
}
