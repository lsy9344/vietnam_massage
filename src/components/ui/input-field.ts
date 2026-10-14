import { cn } from "@/lib/utils";

/**
 * 입력칸·선택칸 모양(design.md 6.4). 조작 경계는 --border-strong, 포커스는 골드 링,
 * 오류면 빨강 테두리(칸 아래 오류 문장은 aria-describedby로 부르는 쪽이 잇는다), 비활성은 읽기 전용 바탕이다.
 */
export function inputFieldClassName({ invalid = false, className }: { invalid?: boolean; className?: string } = {}) {
  return cn(
    "h-11 rounded-sm border bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-secondary disabled:bg-readonly disabled:text-muted",
    invalid ? "border-danger" : "border-border-strong",
    className
  );
}
