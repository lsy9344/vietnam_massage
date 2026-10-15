import type { ReactNode } from "react";

/**
 * 카드·패널 안 요약 목록(`<dl>`)의 한 줄: 왼쪽 라벨, 오른쪽 값. 값은 오른쪽 정렬이라 금액이 세로로 맞는다.
 * 라벨 자리에 상태 칩(StatusIndicator)을 둘 수 있다.
 */
export function DetailRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0">
      <dt className="flex min-h-7 items-center text-muted">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}
