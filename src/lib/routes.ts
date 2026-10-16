import type { Role } from "@/lib/authorization";
import type { MessageKey } from "@/lib/i18n/types";

/**
 * 탐색 셸의 라우트 목록. 화면마다 구역과 접근 역할을 한 번만 적는다.
 * 도크, 구역 안 탭, 서버의 화면 접근 검사가 모두 이 목록에서 나온다
 * (docs/design/2026-10-14-workflow-information-architecture.md 7.2절).
 */
export const zones = ["ledger", "floor", "customers", "settlements", "closing", "reports", "settings"] as const;

export type Zone = (typeof zones)[number];

/**
 * 화면이 주소로 받는 운영월·날짜 맥락. "month"는 운영월만, 나머지는 운영월과 그 이름의 날짜를 받는다.
 */
export type ScreenDateContext = "month" | "serviceDate" | "attendanceDate";

export type ScreenRoute = {
  path: string;
  /** 구역 안 탭에 보이는 짧은 이름. */
  labelKey: MessageKey;
  zone: Zone;
  roles: readonly Role[];
  dateContext?: ScreenDateContext;
  /** 구역 안 탭에 두지 않는 화면. TV는 현장 화면 도구줄의 "TV 화면 열기"로 연다. */
  notATab?: true;
  /** 화면 안의 보기 탭. 도크의 구역 메뉴에는 화면 대신 보기마다 한 줄씩 보인다. 첫 보기가 주소에 보기 값이 없을 때의 보기다. */
  views?: readonly ScreenView[];
};

/** 화면 안의 보기: 같은 화면 주소에 붙는 주소 값(예: 원장의 tab=cashbook)으로 나뉜다. */
export type ScreenView = {
  labelKey: MessageKey;
  params: Record<string, string>;
};

/** 구역을 옮겨도 유지하는 운영월·날짜. */
export type ScreenContext = {
  operatingMonthId: string | null;
  date: string | null;
};

const reportRoles: Role[] = ["administrator", "counter", "settlement_manager", "read_only_viewer"];

// 원장 화면의 보기 탭. 주소 값은 원장 화면의 것(src/lib/ledger-address.ts)과 같다.
const ledgerViews: readonly ScreenView[] = [
  { labelKey: "calls.tab.ledger", params: {} },
  { labelKey: "calls.tab.cashbook", params: { tab: "cashbook" } }
];

// 같은 구역 안에서는 적힌 순서가 탭 순서다.
export const screenRoutes: readonly ScreenRoute[] = [
  { path: "/calls", labelKey: "shell.tab.calls", zone: "ledger", roles: ["administrator", "counter"], dateContext: "serviceDate", views: ledgerViews },
  { path: "/rooms", labelKey: "shell.tab.rooms", zone: "floor", roles: ["administrator", "counter", "waiter", "read_only_viewer"], dateContext: "serviceDate" },
  { path: "/live", labelKey: "shell.tab.live", zone: "floor", roles: ["administrator", "counter"], dateContext: "serviceDate" },
  { path: "/tv", labelKey: "shell.tab.tv", zone: "floor", roles: ["administrator", "counter", "read_only_viewer"], dateContext: "serviceDate", notATab: true },
  { path: "/customers", labelKey: "shell.tab.customers", zone: "customers", roles: ["administrator", "counter"] },
  // 근무표는 운영월과 무관해 dateContext가 없다. 정산 업무의 주기 순서로 맨 앞에 둔다.
  { path: "/settlements/schedule", labelKey: "shell.tab.schedule", zone: "settlements", roles: ["administrator", "settlement_manager"] },
  { path: "/settlements", labelKey: "shell.tab.therapist", zone: "settlements", roles: ["administrator", "settlement_manager"], dateContext: "serviceDate" },
  { path: "/settlements/operations", labelKey: "shell.tab.opsDaily", zone: "settlements", roles: ["administrator", "settlement_manager"], dateContext: "attendanceDate" },
  { path: "/settlements/operations/monthly", labelKey: "shell.tab.opsMonthly", zone: "settlements", roles: ["administrator", "settlement_manager"], dateContext: "month" },
  // 월 명세서(티켓 32)는 각 정산 화면의 직원 패널에서 직원을 고르고 연다. TV와 같은 이유로 구역 안 탭에는 두지 않는다.
  { path: "/settlements/statement", labelKey: "shell.tab.statement", zone: "settlements", roles: ["administrator", "settlement_manager"], dateContext: "month", notATab: true },
  { path: "/closing", labelKey: "shell.tab.closing", zone: "closing", roles: ["administrator", "settlement_manager"], dateContext: "month" },
  { path: "/dashboard/today", labelKey: "shell.tab.dashboardToday", zone: "reports", roles: reportRoles, dateContext: "serviceDate" },
  { path: "/dashboard/monthly", labelKey: "shell.tab.dashboardMonthly", zone: "reports", roles: reportRoles, dateContext: "month" },
  { path: "/dashboard/reports", labelKey: "shell.tab.dashboardReports", zone: "reports", roles: reportRoles, dateContext: "serviceDate" },
  { path: "/masters/operating-months", labelKey: "shell.tab.operatingMonths", zone: "settings", roles: ["administrator"] },
  { path: "/masters/rooms", labelKey: "shell.tab.mastersRooms", zone: "settings", roles: ["administrator"] },
  { path: "/masters/codes", labelKey: "shell.tab.codes", zone: "settings", roles: ["administrator"] },
  { path: "/masters/employees", labelKey: "shell.tab.employees", zone: "settings", roles: ["administrator"] },
  { path: "/masters/courses", labelKey: "shell.tab.courses", zone: "settings", roles: ["administrator"] },
  { path: "/masters/sheet-mapping", labelKey: "shell.tab.sheetMapping", zone: "settings", roles: ["administrator", "read_only_viewer"] },
  { path: "/audit", labelKey: "shell.tab.audit", zone: "settings", roles: ["administrator"] }
];

const roleLandingPath: Record<Role, string> = {
  administrator: "/live",
  counter: "/calls",
  settlement_manager: "/settlements",
  waiter: "/rooms",
  read_only_viewer: "/rooms"
};

export function getRoleLandingPath(role: Role) {
  return roleLandingPath[role];
}

export function findScreenRoute(pathname: string) {
  return screenRoutes.find((route) => route.path === pathname) ?? null;
}

export function canAccessRoute(role: Role, pathname: string) {
  const normalizedPath = pathname === "/" ? getRoleLandingPath(role) : pathname;
  return findScreenRoute(normalizedPath)?.roles.includes(role) ?? false;
}

function tabsForRole(role: Role) {
  return screenRoutes.filter((route) => !route.notATab && route.roles.includes(role));
}

export function zoneForPath(pathname: string): Zone | null {
  return findScreenRoute(pathname)?.zone ?? null;
}

export function getZoneTabs(role: Role, zone: Zone) {
  return tabsForRole(role).filter((route) => route.zone === zone);
}

// 구역이 하나뿐인 역할(웨이터)에게는 도크를 두지 않는다(Material: 목적지 3개 미만에는 bar를 쓰지 않음).
export function getDockZones(role: Role): Zone[] {
  const accessible = new Set(tabsForRole(role).map((route) => route.zone));
  const dockZones = zones.filter((zone) => accessible.has(zone));
  return dockZones.length > 1 ? dockZones : [];
}

const COMPACT_DOCK_PRIMARY_COUNT = 4;

// 840px 미만에서는 구역이 다섯 개 이상인 역할에게 앞 네 구역과 "더보기"를 보인다.
export function getCompactDock(role: Role): { primary: Zone[]; overflow: Zone[] } {
  const dockZones = getDockZones(role);
  if (dockZones.length <= COMPACT_DOCK_PRIMARY_COUNT) {
    return { primary: dockZones, overflow: [] };
  }
  return {
    primary: dockZones.slice(0, COMPACT_DOCK_PRIMARY_COUNT),
    overflow: dockZones.slice(COMPACT_DOCK_PRIMARY_COUNT)
  };
}

/** 지금 화면 주소에서 구역을 옮길 때 넘길 운영월·날짜를 읽는다. */
export function readScreenContext(searchParams: Pick<URLSearchParams, "get">): ScreenContext {
  return {
    operatingMonthId: searchParams.get("operatingMonthId") || null,
    date: searchParams.get("serviceDate") || searchParams.get("attendanceDate") || null
  };
}

/** 화면 주소에 그 화면이 받는 운영월·날짜 맥락만 붙인다. 보기를 주면 그 보기의 주소 값을 뒤에 붙인다. */
export function screenHref(route: ScreenRoute, context: ScreenContext, view?: ScreenView) {
  const params = new URLSearchParams();
  if (route.dateContext && context.operatingMonthId) {
    params.set("operatingMonthId", context.operatingMonthId);
  }
  if (route.dateContext && route.dateContext !== "month" && context.date) {
    params.set(route.dateContext, context.date);
  }
  for (const [name, value] of Object.entries(view?.params ?? {})) {
    params.set(name, value);
  }
  const query = params.toString();
  return query ? `${route.path}?${query}` : route.path;
}

export type ZoneMenuItem = { labelKey: MessageKey; href: string; current: boolean };

/** 도크의 구역 메뉴: 그 역할이 들어갈 수 있는 구역 안 화면을 탭 순서로, 지금 화면에 current를 붙인다. */
export function getZoneMenu(
  role: Role,
  zone: Zone,
  context: ScreenContext,
  current: { path: string; params: Pick<URLSearchParams, "get"> }
): ZoneMenuItem[] {
  return getZoneTabs(role, zone).flatMap((route) => {
    const onRoute = route.path === current.path;
    if (!route.views) {
      return [{ labelKey: route.labelKey, href: screenHref(route, context), current: onRoute }];
    }
    const currentView = onRoute ? viewFromParams(route.views, current.params) : null;
    return route.views.map((view) => ({
      labelKey: view.labelKey,
      href: screenHref(route, context, view),
      current: view === currentView
    }));
  });
}

function viewFromParams(views: readonly ScreenView[], params: Pick<URLSearchParams, "get">) {
  const chosen = views.find((view) => {
    const entries = Object.entries(view.params);
    return entries.length > 0 && entries.every(([name, value]) => params.get(name) === value);
  });
  return chosen ?? views[0];
}

/**
 * 화면 사이 링크. 받는 화면에 들어갈 수 없는 역할에게는 링크를 주지 않는다(null).
 * 그 자리에는 링크 대신 요약을 보인다.
 */
export function linkToScreen(role: Role, path: string, context: ScreenContext) {
  const route = findScreenRoute(path);
  return route && route.roles.includes(role) ? screenHref(route, context) : null;
}
