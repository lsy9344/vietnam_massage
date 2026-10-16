"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useRef, useState, type MouseEvent } from "react";
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
  getZoneMenu,
  readScreenContext,
  zoneForPath,
  type Zone,
  type ZoneMenuItem
} from "@/lib/routes";

// 오늘 운영(원장·현장·고객), 백오피스(정산·마감), 그 밖(보고·설정) 사이에 간격을 둔다.
const zoneGroupStart = new Set<Zone>(["settlements", "reports"]);

// 도크는 화면을 옮겨도 그대로 있으므로, 메뉴에서 화면을 고르면 메뉴를 직접 닫는다.
function closeMenu(event: MouseEvent<HTMLElement>) {
  event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
}

/**
 * 업무 흐름 도크. 화면이 하나인 구역은 누르면 바로 가고, 화면이 둘 이상인 구역은 누르면
 * 그 구역 위에 화면 메뉴가 뜬다(구역 안 탭과 같은 목록, 원장은 보기 탭까지).
 */
export function WorkflowDockView({
  account,
  currentPath,
  searchParams,
  locale
}: {
  account: ShellAccount;
  currentPath: string;
  /** 지금 화면 주소의 검색 값. 구역을 옮길 때 넘길 운영월·날짜와 지금 보기를 읽는다. */
  searchParams: Pick<URLSearchParams, "get">;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const menuIdPrefix = useId();
  const moreMenuId = `${menuIdPrefix}-more`;
  const moreMenuRef = useRef<HTMLDivElement>(null);
  // 840px 미만 더보기 안에서 화면이 둘 이상인 구역을 고르면 그 구역의 화면 메뉴로 들어간다.
  const [moreZone, setMoreZone] = useState<Zone | null>(null);
  // 더보기 안에서 들어가거나 돌아오면 바뀐 목록의 첫 항목으로 포커스를 옮긴다.
  const focusFirstMoreItem = useRef(false);
  useEffect(() => {
    if (focusFirstMoreItem.current) {
      focusFirstMoreItem.current = false;
      moreMenuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    }
  }, [moreZone]);

  const dockZones = getDockZones(account.role);
  if (dockZones.length === 0) {
    return null;
  }

  const context = readScreenContext(searchParams);
  const menuOf = (zone: Zone) => getZoneMenu(account.role, zone, context, { path: currentPath, params: searchParams });
  const { overflow } = getCompactDock(account.role);
  const currentZone = zoneForPath(currentPath);
  const currentInOverflow = currentZone !== null && overflow.includes(currentZone);
  const zoneLabel = (zone: Zone) => t(`shell.zone.${zone}`);
  const menuLabel = (zone: Zone) => t("shell.tabs.aria", { zone: zoneLabel(zone) });
  const enterMoreZone = (zone: Zone | null) => {
    focusFirstMoreItem.current = true;
    setMoreZone(zone);
  };

  const menuLink = (item: ZoneMenuItem) => (
    <Link
      aria-current={item.current ? "page" : undefined}
      className="shell-menu-item"
      href={item.href}
      key={item.href}
      onClick={closeMenu}
    >
      {t(item.labelKey)}
    </Link>
  );

  const zoneItem = (zone: Zone, className?: string) => {
    const isCurrent = zone === currentZone;
    const menu = menuOf(zone);
    if (menu.length < 2) {
      return (
        <Link
          aria-current={isCurrent ? "page" : undefined}
          className={cn("shell-dock-item", className)}
          data-dock-zone={zone}
          href={menu[0].href}
          key={zone}
        >
          {zoneLabel(zone)}
        </Link>
      );
    }

    const menuId = `${menuIdPrefix}-${zone}`;
    // 메뉴는 브라우저 앵커 위치로 누른 구역 위에 뜬다(globals.css .shell-popover-zone).
    const anchorName = `--dock-zone-${zone}`;
    return (
      <Fragment key={zone}>
        <button
          aria-current={isCurrent ? "true" : undefined}
          className={cn("shell-dock-item shell-dock-menu-trigger", isCurrent && "shell-dock-item-current", className)}
          data-dock-zone={zone}
          popoverTarget={menuId}
          style={{ anchorName }}
          type="button"
        >
          {zoneLabel(zone)}
        </button>
        <div
          aria-labelledby={`${menuId}-label`}
          className="shell-popover shell-popover-zone"
          id={menuId}
          popover="auto"
          role="group"
          style={{ positionAnchor: anchorName }}
        >
          <p className="px-3 pb-1.5 pt-2 text-xs font-semibold text-muted" id={`${menuId}-label`}>
            {menuLabel(zone)}
          </p>
          {menu.map(menuLink)}
        </div>
      </Fragment>
    );
  };

  return (
    // print:hidden: 월 명세서(티켓 32) 같은 인쇄 화면에서 업무 흐름 도크가 인쇄물에 찍히지 않게 한다.
    <nav aria-label={t("shell.dock.aria")} className="shell-dock print:hidden" id={WORKFLOW_DOCK_ID} tabIndex={-1}>
      <div className="shell-dock-zones">
        {dockZones.map((zone, index) =>
          zoneItem(
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
              onClick={() => setMoreZone(null)}
              popoverTarget={moreMenuId}
              type="button"
            >
              {t("shell.dock.more")}
            </button>
            <div className="shell-popover shell-popover-end" data-dock-overflow id={moreMenuId} popover="auto" ref={moreMenuRef}>
              {moreZone ? (
                <>
                  <button className="shell-menu-item" onClick={() => enterMoreZone(null)} type="button">
                    <span aria-hidden="true">‹</span>
                    {t("shell.dock.backToMore")}
                  </button>
                  <p className="px-3 pb-1.5 pt-2 text-xs font-semibold text-muted">{menuLabel(moreZone)}</p>
                  {menuOf(moreZone).map(menuLink)}
                </>
              ) : (
                overflow.map((zone) => {
                  const menu = menuOf(zone);
                  return menu.length < 2 ? (
                    <Link
                      aria-current={zone === currentZone ? "page" : undefined}
                      className="shell-menu-item"
                      href={menu[0].href}
                      key={zone}
                      onClick={closeMenu}
                    >
                      {zoneLabel(zone)}
                    </Link>
                  ) : (
                    <button
                      aria-current={zone === currentZone ? "true" : undefined}
                      className="shell-menu-item"
                      key={zone}
                      onClick={() => enterMoreZone(zone)}
                      type="button"
                    >
                      {zoneLabel(zone)}
                      {/* 들어가면 보일 화면 수 */}
                      <span aria-hidden="true" className="ml-auto text-xs text-faint">
                        {menu.length} ›
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : null}
      </div>
      <MeMenu account={account} placement="dock" />
    </nav>
  );
}

/** 지금 화면의 주소에서 구역과 운영월·날짜, 보기를 읽어 도크를 그린다. */
export function WorkflowDock({ account }: { account: ShellAccount }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  return <WorkflowDockView account={account} currentPath={pathname} locale={locale} searchParams={searchParams} />;
}
