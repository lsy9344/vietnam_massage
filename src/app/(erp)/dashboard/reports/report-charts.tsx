import type { ReactNode } from "react";
import { axisTicks, heightPercent, labelStride } from "@/app/(erp)/dashboard/chart-scale";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

/**
 * 리포트 차트(design.md 6.14). 한 차트에는 파스텔 하나만 쓴다. 파스텔끼리는 정상 시각에서도 구분 거리가 모자라
 * (팔레트 검사 ΔE < 15, 바탕 대비 < 3:1), 두 번째 계열은 색이 아니라 모양(검정 선)이나 따로 그린 작은 차트로 나눈다.
 * 모든 값은 차트 옆 표나 글자로도 보인다. 객실 상태색(--status-*)은 쓰지 않는다.
 */
export type ChartTone = "lavender" | "peach" | "mint";

const toneClass: Record<ChartTone, string> = {
  lavender: "bg-accent-lavender",
  peach: "bg-accent-peach",
  mint: "bg-accent-mint"
};

/** 범례 한 줄: 막대 계열은 네모, 선 계열은 짧은 선. 글자는 글자색이다. */
export function ChartLegend({ items }: { items: Array<{ label: string; mark: ChartTone | "line" }> }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
      {items.map((item) => (
        <li className="inline-flex items-center gap-1.5" key={item.label}>
          {item.mark === "line" ? (
            <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-foreground" />
          ) : (
            <span aria-hidden="true" className={cn("size-3 rounded-[3px]", toneClass[item.mark])} />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export type ColumnPoint = {
  key: string;
  /** 가로 축 글자(날짜의 일). */
  axisLabel: string;
  value: number;
  /** 올렸을 때 보이는 값. 같은 값은 표에도 있다. */
  tooltip: string;
};

/**
 * 날짜별 세로 막대. 막대는 0선에서 자라고 위쪽 모서리만 8px 둥글다. line을 주면 같은 축에 검정 선을 겹친다(두 번째 축은 없다).
 * 축 글자는 HTML이라 화면이 좁아져도 12px로 남는다.
 */
export function ColumnChart({
  label,
  points,
  tone,
  line,
  locale,
  className
}: {
  label: string;
  points: ColumnPoint[];
  tone: ChartTone;
  line?: number[];
  locale: Locale;
  className?: string;
}) {
  const ticks = axisTicks([...points.map((point) => point.value), ...(line ?? [])]);
  const zero = heightPercent(0, ticks);
  const stride = labelStride(points.length);
  const linePoints = line
    ?.map((value, index) => `${((index + 0.5) / line.length) * 100},${100 - heightPercent(value, ticks)}`)
    .join(" ");

  return (
    <div aria-label={label} className={cn("mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2", className)} role="img">
      <div aria-hidden="true" className="relative h-48 text-right text-xs text-faint">
        {ticks.map((tick) => (
          <span className="absolute right-0 translate-y-1/2 leading-none" key={tick} style={{ bottom: `${heightPercent(tick, ticks)}%` }}>
            {formatNumber(locale, tick, { notation: "compact", maximumFractionDigits: 1 })}
          </span>
        ))}
        {/* 가장 긴 눈금 글자만큼 폭을 잡는다. */}
        <span className="invisible block leading-none">{formatNumber(locale, ticks[ticks.length - 1], { notation: "compact", maximumFractionDigits: 1 })}</span>
      </div>
      <div className="relative h-48">
        {ticks.map((tick) => (
          <div aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-border" key={tick} style={{ bottom: `${heightPercent(tick, ticks)}%` }} />
        ))}
        <div className="absolute inset-0 flex gap-0.5">
          {points.map((point, index) => {
            const top = heightPercent(point.value, ticks);
            return (
              <div className="group relative flex-1" key={point.key}>
                <div
                  className={cn(
                    "absolute inset-x-0 mx-auto max-w-6 transition-colors group-hover:bg-brand",
                    point.value >= 0 ? "rounded-t-[8px]" : "rounded-b-[8px]",
                    toneClass[tone]
                  )}
                  style={{ bottom: `${Math.min(zero, top)}%`, height: `${Math.abs(top - zero)}%` }}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute -top-2 z-10 hidden -translate-y-full whitespace-nowrap rounded-[12px] bg-brand px-2.5 py-1.5 text-xs font-semibold text-surface group-hover:block",
                    index < points.length / 2 ? "left-0" : "right-0"
                  )}
                >
                  {point.tooltip}
                </span>
              </div>
            );
          })}
        </div>
        {linePoints ? (
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            <polyline className="fill-none stroke-foreground" points={linePoints} strokeLinejoin="round" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : null}
      </div>
      <div />
      <div aria-hidden="true" className="mt-1.5 flex gap-0.5 text-xs text-faint">
        {points.map((point, index) => (
          <span className="flex-1 text-center" key={point.key}>
            {index % stride === 0 ? point.axisLabel : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export type BarRow = {
  key: string;
  label: ReactNode;
  /** 막대 옆 글자: 값과 근거. */
  detail: string;
  value: number;
};

/**
 * 가로 막대 목록. 막대 길이는 max(기본: 가장 큰 값)에 대한 비율이고, 값은 늘 글자로도 보인다.
 * 전체에 대한 몫(비중)은 max=1로 준다.
 */
export function BarList({ rows, tone, max = Math.max(0, ...rows.map((row) => row.value)) }: { rows: BarRow[]; tone: ChartTone; max?: number }) {
  return (
    <ul className="mt-3 grid gap-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold text-foreground">{row.label}</span>
            <span className="text-muted">{row.detail}</span>
          </div>
          <div aria-hidden="true" className="mt-1.5 h-3">
            <div className={cn("h-3 rounded-r-[8px]", toneClass[tone])} style={{ width: `${max > 0 ? (row.value / max) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
