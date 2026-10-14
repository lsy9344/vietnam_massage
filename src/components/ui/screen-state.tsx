import type { ReactNode } from "react";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { cn } from "@/lib/utils";

/**
 * 같은 화면 골격 안에서 보이는 상태: 로딩, 빈 상태(데이터 없음·계산 근거 없음·검색 결과 없음은 문구로 구분),
 * 오류(원인·다음 행동·재시도), 잠금(이유·재오픈 경로·버전), 갱신 지연(마지막 갱신).
 */
export type ScreenStateKind = "loading" | "empty" | "error" | "locked" | "stale";

const kindConfig: Record<ScreenStateKind, { tone: StatusTone; border: string }> = {
  loading: { tone: "neutral", border: "border-border" },
  empty: { tone: "neutral", border: "border-dashed border-border-strong" },
  error: { tone: "danger", border: "border-danger" },
  locked: { tone: "info", border: "border-info" },
  stale: { tone: "warning", border: "border-warning" }
};

export function ScreenState({
  kind,
  label,
  title,
  description,
  action,
  className
}: {
  kind: ScreenStateKind;
  /** 상태 이름(예: "잠김", "갱신 지연"). 글자와 색, 모양으로 함께 보인다. */
  label: string;
  title: string;
  description?: ReactNode;
  /** 다음 행동(재시도, 재오픈 경로 링크 등). */
  action?: ReactNode;
  className?: string;
}) {
  const config = kindConfig[kind];
  return (
    <section
      aria-busy={kind === "loading" ? true : undefined}
      className={cn("border bg-surface px-4 py-5", config.border, className)}
      role={kind === "error" ? "alert" : "status"}
    >
      <StatusIndicator label={label} tone={config.tone} />
      <h2 className="mt-3 text-base font-semibold text-foreground">{title}</h2>
      {description ? <div className="mt-2 max-w-2xl text-sm text-muted">{description}</div> : null}
      {action ? <div className="mt-4 flex flex-wrap gap-2">{action}</div> : null}
    </section>
  );
}
