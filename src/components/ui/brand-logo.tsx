import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export const BRAND_NAME = "GANGNAM SPA";

const MARK_SRC = "/brand/mark.svg";
const WORDMARK_SRC = "/brand/wordmark.png";

/** 로고 심볼(G 테두리, 그릇, 김). label이 없으면 옆 글자나 링크 이름이 대신 말하는 장식이다. */
export function BrandMark({ label, className }: { label?: string; className?: string }) {
  // 작은 정적 그림이라 이미지 최적화를 거치지 않는다.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={label ?? ""} className={cn("block h-auto", className)} height={100} src={MARK_SRC} width={97} />;
}

/** 그림 모양으로 가린 빛줄기 층(globals.css .brand-sheen). */
function SheenLayer({ src, className }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("brand-sheen", className)}
      style={{ "--brand-sheen-mask": `url(${src})` } as CSSProperties}
    />
  );
}

// 로그인 화면은 심볼 위에 글자를 크게(stacked), 나 메뉴는 심볼 옆에 글자를 작게(inline) 둔다.
const lockupLayout = {
  stacked: { root: "flex-col gap-4", mark: "w-24", name: "w-60" },
  inline: { root: "flex-row gap-2", mark: "w-6", name: "w-28" }
};

/**
 * 심볼과 GANGNAM SPA 글자를 묶은 로고. 화면 낭독기에는 브랜드 이름이 한 번만 읽힌다.
 * sheen이면 빛줄기가 심볼, 이어서 글자 위를 몇 초마다 한 번 지나간다(로그인 화면만, design.md 6.15).
 */
export function BrandLockup({
  layout = "stacked",
  sheen = false,
  className
}: {
  layout?: keyof typeof lockupLayout;
  sheen?: boolean;
  className?: string;
}) {
  const size = lockupLayout[layout];
  return (
    <div className={cn("flex items-center", size.root, className)}>
      <span className={cn("relative block", size.mark)}>
        <BrandMark className="w-full" />
        {sheen ? <SheenLayer src={MARK_SRC} /> : null}
      </span>
      <span className={cn("relative block", size.name)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={BRAND_NAME} className="block h-auto w-full" height={130} src={WORDMARK_SRC} width={1079} />
        {sheen ? <SheenLayer className="brand-sheen-late" src={WORDMARK_SRC} /> : null}
      </span>
    </div>
  );
}
