"use client";

import Link from "next/link";
import { useId } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MeMenu, type ShellAccount } from "@/components/shell/me-menu";
import { WORKFLOW_DOCK_ID } from "@/components/shell/skip-links";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import {
  getCompactDock,
  getDockZones,
  getZoneHref,
  readScreenContext,
  zoneForPath,
  type ScreenContext,
  type Zone
} from "@/lib/routes";

// 오늘 운영(원장·현장·고객), 백오피스(정산·마감), 그 밖(보고·설정) 사이에 간격을 둔다.
const zoneGroupStart = new Set<Zone>(["settlements", "reports"]);

export function WorkflowDockView({
  account,
  context,
  currentPath,
  locale
}: {
  account: ShellAccount;
  context: ScreenContext;
  currentPath: string;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const moreMenuId = useId();
  const dockZones = getDockZones(account.role);
  if (dockZones.length === 0) {
    return null;
  }

  const { overflow } = getCompactDock(account.role);
  const currentZone = zoneForPath(currentPath);
  const currentInOverflow = currentZone !== null && overflow.includes(currentZone);
  const zoneLink = (zone: Zone, className?: string) => (
    <Link
      aria-current={zone === currentZone ? "page" : undefined}
      className={cn("shell-dock-item", className)}
      href={getZoneHref(account.role, zone, context) ?? "/"}
      key={zone}
    >
      {t(`shell.zone.${zone}`)}
    </Link>
  );

  return (
    <nav aria-label={t("shell.dock.aria")} className="shell-dock" id={WORKFLOW_DOCK_ID} tabIndex={-1}>
      <div className="shell-dock-zones">
        {dockZones.map((zone, index) =>
          zoneLink(
            zone,
            cn(zoneGroupStart.has(zone) && index > 0 && "shell-dock-group-start", overflow.includes(zone) && "shell-dock-wide-only")
          )
        )}
        {overflow.length > 0 ? (
          <>
            {/* 840px 미만에서 현재 구역이 더보기 안에 있으면 더보기가 현재 표시를 대신 맡는다. */}
            <button
              aria-current={currentInOverflow ? "true" : undefined}
              className={cn("shell-dock-item shell-dock-compact-only", currentInOverflow && "shell-dock-item-current")}
              popoverTarget={moreMenuId}
              type="button"
            >
              {t("shell.dock.more")}
            </button>
            <div className="shell-popover shell-popover-end" data-dock-overflow id={moreMenuId} popover="auto">
              {overflow.map((zone) => zoneLink(zone))}
            </div>
          </>
        ) : null}
      </div>
      <MeMenu account={account} placement="dock" />
    </nav>
  );
}

/** 지금 화면의 주소에서 구역과 운영월·날짜를 읽어 도크를 그린다. */
export function WorkflowDock({ account }: { account: ShellAccount }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  return (
    <WorkflowDockView
      account={account}
      context={readScreenContext(searchParams)}
      currentPath={pathname}
      locale={locale}
    />
  );
}
