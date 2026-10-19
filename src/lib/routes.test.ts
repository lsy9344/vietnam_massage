import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessRoute,
  getCompactDock,
  getDockZones,
  getRoleLandingPath,
  getZoneMenu,
  getZoneTabs,
  linkToScreen,
  readScreenContext,
  zoneForPath
} from "@/lib/routes";

// 티켓 02 이전의 접두사 규칙(authorization.ts)이 허용하던 화면을 그대로 적는다.
// 탐색 셸을 바꿔도 역할별 접근 범위는 넓어지지도 좁아지지도 않아야 한다.
// 티켓 01: therapist 열을 더한다. 운영팀 화면은 모두 거절되어야 한다(스펙 D2, M16).
const accessMatrix: Record<
  string,
  Record<"administrator" | "counter" | "settlement_manager" | "waiter" | "read_only_viewer" | "therapist", boolean>
> = {
  "/live": { administrator: true, counter: true, settlement_manager: false, waiter: false, read_only_viewer: false, therapist: false },
  "/rooms": { administrator: true, counter: true, settlement_manager: false, waiter: true, read_only_viewer: true, therapist: false },
  "/tv": { administrator: true, counter: true, settlement_manager: false, waiter: false, read_only_viewer: true, therapist: false },
  // 출근 코드 크게 띄우기(티켓 05, 스펙 D13): 카운터와 관리자만 연다.
  "/clock-code": { administrator: true, counter: true, settlement_manager: false, waiter: false, read_only_viewer: false, therapist: false },
  "/calls": { administrator: true, counter: true, settlement_manager: false, waiter: false, read_only_viewer: false, therapist: false },
  // 티켓 03: 고객 화면은 지금 콜 원장에 들어가는 역할에게만 연다(명세 F08 기준 6).
  "/customers": { administrator: true, counter: true, settlement_manager: false, waiter: false, read_only_viewer: false, therapist: false },
  "/settlements": { administrator: true, counter: false, settlement_manager: true, waiter: false, read_only_viewer: false, therapist: false },
  "/settlements/operations": {
    administrator: true,
    counter: false,
    settlement_manager: true,
    waiter: false,
    read_only_viewer: false,
    therapist: false
  },
  "/settlements/operations/monthly": {
    administrator: true,
    counter: false,
    settlement_manager: true,
    waiter: false,
    read_only_viewer: false,
    therapist: false
  },
  // Therapist 공지(티켓 10): 관리자 전용. settlement_manager는 therapist:manage가 없어 거절된다(M18).
  "/settlements/notices": {
    administrator: true,
    counter: false,
    settlement_manager: false,
    waiter: false,
    read_only_viewer: false,
    therapist: false
  },
  // 휴무 신청·정정 요청 승인함(티켓 08): payout:write라 settlement_manager도 들어간다(M18).
  "/settlements/requests": {
    administrator: true,
    counter: false,
    settlement_manager: true,
    waiter: false,
    read_only_viewer: false,
    therapist: false
  },
  "/closing": { administrator: true, counter: false, settlement_manager: true, waiter: false, read_only_viewer: false, therapist: false },
  "/dashboard/today": { administrator: true, counter: true, settlement_manager: true, waiter: false, read_only_viewer: true, therapist: false },
  "/dashboard/monthly": {
    administrator: true,
    counter: true,
    settlement_manager: true,
    waiter: false,
    read_only_viewer: true,
    therapist: false
  },
  "/dashboard/reports": {
    administrator: true,
    counter: true,
    settlement_manager: true,
    waiter: false,
    read_only_viewer: true,
    therapist: false
  },
  "/masters/operating-months": {
    administrator: true,
    counter: false,
    settlement_manager: false,
    waiter: false,
    read_only_viewer: false,
    therapist: false
  },
  "/masters/rooms": { administrator: true, counter: false, settlement_manager: false, waiter: false, read_only_viewer: false, therapist: false },
  "/masters/codes": { administrator: true, counter: false, settlement_manager: false, waiter: false, read_only_viewer: false, therapist: false },
  "/masters/employees": {
    administrator: true,
    counter: false,
    settlement_manager: false,
    waiter: false,
    read_only_viewer: false,
    therapist: false
  },
  "/masters/courses": {
    administrator: true,
    counter: false,
    settlement_manager: false,
    waiter: false,
    read_only_viewer: false,
    therapist: false
  },
  "/masters/sheet-mapping": {
    administrator: true,
    counter: false,
    settlement_manager: false,
    waiter: false,
    read_only_viewer: true,
    therapist: false
  },
  "/audit": { administrator: true, counter: false, settlement_manager: false, waiter: false, read_only_viewer: false, therapist: false },
  // Therapist 전용 화면(티켓 01). therapist만 들어가고, 운영팀 역할은 모두 거절된다.
  "/therapist": { administrator: false, counter: false, settlement_manager: false, waiter: false, read_only_viewer: false, therapist: true },
  "/therapist/attendance": {
    administrator: false,
    counter: false,
    settlement_manager: false,
    waiter: false,
    read_only_viewer: false,
    therapist: true
  },
  "/therapist/payout": {
    administrator: false,
    counter: false,
    settlement_manager: false,
    waiter: false,
    read_only_viewer: false,
    therapist: true
  },
  "/therapist/notices": {
    administrator: false,
    counter: false,
    settlement_manager: false,
    waiter: false,
    read_only_viewer: false,
    therapist: true
  },
  // 티켓 02: 탭이 아닌 Therapist 전용 화면(비밀번호 변경)도 다른 운영팀 역할은 모두 거절된다.
  "/therapist/password": {
    administrator: false,
    counter: false,
    settlement_manager: false,
    waiter: false,
    read_only_viewer: false,
    therapist: true
  }
};

describe("route list access", () => {
  it("keeps every role's screen access exactly as it was before the workflow shell", () => {
    for (const [path, byRole] of Object.entries(accessMatrix)) {
      for (const [role, expected] of Object.entries(byRole)) {
        assert.equal(canAccessRoute(role as keyof typeof byRole, path), expected, `${role} ${path}`);
      }
    }
  });

  it("keeps the role first screens: administrator live, counter ledger, settlement Therapist, waiter and viewer rooms, therapist today", () => {
    assert.equal(getRoleLandingPath("administrator"), "/live");
    assert.equal(getRoleLandingPath("counter"), "/calls");
    assert.equal(getRoleLandingPath("settlement_manager"), "/settlements");
    assert.equal(getRoleLandingPath("waiter"), "/rooms");
    assert.equal(getRoleLandingPath("read_only_viewer"), "/rooms");
    assert.equal(getRoleLandingPath("therapist"), "/therapist");
  });

  it("treats the root path as the role's first screen", () => {
    assert.equal(canAccessRoute("waiter", "/"), true);
    assert.equal(canAccessRoute("settlement_manager", "/"), true);
    assert.equal(canAccessRoute("therapist", "/"), true);
  });

  it("denies paths that are not screens in the route list", () => {
    assert.equal(canAccessRoute("administrator", "/masters"), false);
    assert.equal(canAccessRoute("read_only_viewer", "/masters/sheet-mapping/details"), false);
  });
});

describe("Therapist 전용 화면(티켓 01)", () => {
  it("lists the four Therapist tabs in today → attendance → payout → notices order, with no dock (one zone)", () => {
    assert.deepEqual(getZoneTabs("therapist", "therapist").map((route) => route.path), [
      "/therapist",
      "/therapist/attendance",
      "/therapist/payout",
      "/therapist/notices"
    ]);
    assert.deepEqual(getDockZones("therapist"), []);
  });

  it("gives no ops role any access to the Therapist zone's tabs", () => {
    for (const role of ["administrator", "counter", "settlement_manager", "waiter", "read_only_viewer"] as const) {
      assert.deepEqual(getZoneTabs(role, "therapist"), []);
    }
  });
});

describe("workflow dock zones", () => {
  it("shows each role only the zones it can enter, always in ledger → floor → customers → settlements → closing → reports → settings order", () => {
    assert.deepEqual(getDockZones("administrator"), ["ledger", "floor", "customers", "settlements", "closing", "reports", "settings"]);
    assert.deepEqual(getDockZones("counter"), ["ledger", "floor", "customers", "reports"]);
    assert.deepEqual(getDockZones("settlement_manager"), ["settlements", "closing", "reports"]);
    assert.deepEqual(getDockZones("read_only_viewer"), ["floor", "reports", "settings"]);
  });

  it("gives the waiter no dock because the floor is the only zone it can enter", () => {
    assert.deepEqual(getDockZones("waiter"), []);
  });

  it("opens the customer zone only to the roles that enter the call ledger", () => {
    for (const role of ["settlement_manager", "waiter", "read_only_viewer"] as const) {
      assert.equal(getDockZones(role).includes("customers"), false);
    }
  });
});

describe("workflow dock below 840px", () => {
  it("shows the first four zones and moves the rest behind More when a role has five or more zones", () => {
    assert.deepEqual(getCompactDock("administrator"), {
      primary: ["ledger", "floor", "customers", "settlements"],
      overflow: ["closing", "reports", "settings"]
    });
  });

  it("keeps every zone visible with no More for roles with four or fewer zones", () => {
    assert.deepEqual(getCompactDock("counter"), { primary: ["ledger", "floor", "customers", "reports"], overflow: [] });
    assert.deepEqual(getCompactDock("settlement_manager"), { primary: ["settlements", "closing", "reports"], overflow: [] });
    assert.deepEqual(getCompactDock("read_only_viewer"), { primary: ["floor", "reports", "settings"], overflow: [] });
  });
});

describe("moving between zones with the dock", () => {
  const ledgerContext = readScreenContext(new URLSearchParams("operatingMonthId=m-2026-10&serviceDate=2026-10-14"));
  // 구역의 첫 화면 주소: 화면이 하나인 구역의 도크 링크이자 구역 메뉴의 첫 줄이다.
  const firstScreenHref = (role: Parameters<typeof getZoneMenu>[0], zone: Parameters<typeof getZoneMenu>[1], context: typeof ledgerContext) =>
    getZoneMenu(role, zone, context, { path: "/", params: new URLSearchParams() })[0]?.href ?? null;

  it("carries the chosen operating month and date into dated zones", () => {
    assert.equal(firstScreenHref("counter", "floor", ledgerContext), "/rooms?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
    assert.equal(firstScreenHref("administrator", "ledger", ledgerContext), "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
    assert.equal(firstScreenHref("counter", "reports", ledgerContext), "/dashboard/today?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
  });

  it("carries only the operating month into the month-only closing zone", () => {
    assert.equal(firstScreenHref("settlement_manager", "closing", ledgerContext), "/closing?operatingMonthId=m-2026-10");
  });

  it("reads the attendance date of the operations screens as the date to carry", () => {
    const opsContext = readScreenContext(new URLSearchParams("operatingMonthId=m-2026-10&attendanceDate=2026-10-12"));
    assert.equal(firstScreenHref("administrator", "ledger", opsContext), "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-12");
  });

  it("puts the ledger tab first in the ledger zone, dropping the ledger's own query state", () => {
    const ledgerWithSearch = readScreenContext(
      new URLSearchParams("operatingMonthId=m-2026-10&serviceDate=2026-10-14&customerQuery=kim&visitMemo=vip")
    );
    assert.equal(firstScreenHref("counter", "ledger", ledgerWithSearch), "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
  });

  it("opens the first tab the role can enter and leaves undated zones without date context", () => {
    assert.equal(firstScreenHref("administrator", "settings", ledgerContext), "/masters/operating-months");
    assert.equal(firstScreenHref("read_only_viewer", "settings", ledgerContext), "/masters/sheet-mapping");
    assert.equal(firstScreenHref("administrator", "floor", ledgerContext), "/rooms?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
  });

  it("opens the undated customer screen without the ledger's month and date", () => {
    assert.equal(firstScreenHref("counter", "customers", ledgerContext), "/customers");
  });

  it("links to the bare first tab when no month or date has been chosen yet", () => {
    assert.equal(firstScreenHref("counter", "ledger", readScreenContext(new URLSearchParams())), "/calls");
  });
});

describe("zone tabs", () => {
  const tabPaths = (role: Parameters<typeof getZoneTabs>[0], zone: Parameters<typeof getZoneTabs>[1]) =>
    getZoneTabs(role, zone).map((route) => route.path);

  it("lists the zone's screens the role can enter, in workflow order", () => {
    assert.deepEqual(tabPaths("administrator", "settlements"), [
      "/settlements/schedule",
      "/settlements",
      "/settlements/operations",
      "/settlements/operations/monthly",
      "/settlements/notices",
      "/settlements/requests"
    ]);
    assert.deepEqual(tabPaths("administrator", "settings"), [
      "/masters/operating-months",
      "/masters/rooms",
      "/masters/codes",
      "/masters/employees",
      "/masters/courses",
      "/masters/sheet-mapping",
      "/audit"
    ]);
    assert.deepEqual(tabPaths("read_only_viewer", "settings"), ["/masters/sheet-mapping"]);
    assert.deepEqual(tabPaths("waiter", "floor"), ["/rooms"]);
  });

  it("keeps the TV board out of the floor tabs because it opens from the toolbar", () => {
    assert.deepEqual(tabPaths("counter", "floor"), ["/rooms", "/live"]);
    assert.deepEqual(tabPaths("read_only_viewer", "floor"), ["/rooms"]);
  });

  it("finds the zone of a screen path", () => {
    assert.equal(zoneForPath("/settlements/operations/monthly"), "settlements");
    assert.equal(zoneForPath("/audit"), "settings");
    assert.equal(zoneForPath("/tv"), "floor");
    assert.equal(zoneForPath("/sign-in"), null);
  });
});

describe("zone menu in the dock", () => {
  const context = { operatingMonthId: "m-2026-10", date: "2026-10-14" };
  const at = (path: string, query = "") => ({ path, params: new URLSearchParams(query) });

  it("lists the zone's screens the role can enter with the month and date, marking the screen you are on", () => {
    assert.deepEqual(getZoneMenu("administrator", "settlements", context, at("/settlements/operations")), [
      { labelKey: "shell.tab.schedule", href: "/settlements/schedule", current: false },
      { labelKey: "shell.tab.therapist", href: "/settlements?operatingMonthId=m-2026-10&serviceDate=2026-10-14", current: false },
      { labelKey: "shell.tab.opsDaily", href: "/settlements/operations?operatingMonthId=m-2026-10&attendanceDate=2026-10-14", current: true },
      { labelKey: "shell.tab.opsMonthly", href: "/settlements/operations/monthly?operatingMonthId=m-2026-10", current: false },
      { labelKey: "shell.tab.therapistNotices", href: "/settlements/notices", current: false },
      { labelKey: "shell.tab.therapistRequests", href: "/settlements/requests", current: false }
    ]);
  });

  it("splits the ledger into its two views, the ledger view being current unless the cashbook is open", () => {
    const ledger = { labelKey: "calls.tab.ledger", href: "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14" };
    const cashbook = { labelKey: "calls.tab.cashbook", href: "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14&tab=cashbook" };

    assert.deepEqual(getZoneMenu("counter", "ledger", context, at("/calls", "tab=cashbook")), [
      { ...ledger, current: false },
      { ...cashbook, current: true }
    ]);
    assert.deepEqual(getZoneMenu("counter", "ledger", context, at("/calls", "customerQuery=kim")), [
      { ...ledger, current: true },
      { ...cashbook, current: false }
    ]);
    assert.deepEqual(
      getZoneMenu("counter", "ledger", context, at("/rooms")).map((item) => item.current),
      [false, false]
    );
  });
});

describe("links between screens", () => {
  const context = { operatingMonthId: "m-2026-10", date: "2026-10-14" };

  it("links to a screen with the month and date only when the role can enter it", () => {
    assert.equal(linkToScreen("counter", "/calls", context), "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
    assert.equal(linkToScreen("administrator", "/settlements/operations", context), "/settlements/operations?operatingMonthId=m-2026-10&attendanceDate=2026-10-14");
  });

  it("gives no link to roles that cannot enter the screen", () => {
    assert.equal(linkToScreen("settlement_manager", "/calls", context), null);
    assert.equal(linkToScreen("read_only_viewer", "/calls", context), null);
  });
});
