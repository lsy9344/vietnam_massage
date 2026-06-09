"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL_MS = 15_000;
const STALE_AFTER_MS = 45_000;

function formatLastUpdated(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function RoomStatusRefreshController({ lastUpdatedAt, variant = "default" }: { lastUpdatedAt: string; variant?: "default" | "tv" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const lastUpdatedMillis = useMemo(() => new Date(lastUpdatedAt).getTime(), [lastUpdatedAt]);
  const isStale = now - lastUpdatedMillis > STALE_AFTER_MS;

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    const polling = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(polling);
  }, [refresh]);

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 text-xs text-muted",
        variant === "tv" && "gap-5 text-lg font-semibold text-foreground"
      )}
      aria-label="실시간 갱신 상태"
    >
      <span className={cn(variant === "tv" && isStale && "text-status-complete-check")}>
        {isPending ? "갱신 중" : isStale ? "갱신 지연" : "마지막 갱신"}: {formatLastUpdated(lastUpdatedAt)}
      </span>
      <Button className={cn("h-8 px-2 text-xs", variant === "tv" && "h-12 px-5 text-lg font-bold")} onClick={refresh} variant="secondary">
        새로고침
      </Button>
    </div>
  );
}
