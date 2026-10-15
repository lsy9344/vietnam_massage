import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessRoute,
  getCompactDock,
  getDockZones,
  getRoleLandingPath,
  getZoneHref,
  getZoneTabs,
  linkToScreen,
  readScreenContext,
  zoneForPath
} from "@/lib/routes";

// 티켓 02 이전의 접두사 규칙(authorization.ts)이 허용하던 화면을 그대로 적는다.
// 탐색 셸을 바꿔도 역할별 접근 범위는 넓어지지도 좁아지지도 않아야 한다.
const accessMatrix: Record<string, Record<"administrator" | "counter" | "settlement_manager" | "waiter" | "read_only_viewer", boolean>> = {
  "/live": { administrator: true, counter: true, settlement_manager: false, waiter: false, read_only_viewer: false },
  "/rooms": { administrator: true, counter: true, settlement_manager: false, waiter: true, read_only_viewer: true },
  "/tv": { administrator: true, counter: true, settlement_manager: false, waiter: false, read_only_viewer: true },
  "/calls": { administrator: true, counter: true, settlement_manager: false, waiter: false, read_only_viewer: false },
  // 티켓 03: 고객 화면은 지금 콜 원장에 들어가는 역할에게만 연다(명세 F08 기준 6).
  "/customers": { administrator: true, counter: true, settlement_manager: false, waiter: false, read_only_viewer: false },
  "/settlements": { administrator: true, counter: false, settlement_manager: true, waiter: false, read_only_viewer: false },
  "/settlements/earcare": { administrator: true, counter: false, settlement_manager: true, waiter: false, read_only_viewer: false },
  "/settlements/operations": { administrator: true, counter: false, settlement_manager: true, waiter: false, read_only_viewer: false },
  "/settlements/operations/monthly": { administrator: true, counter: false, settlement_manager: true, waiter: false, read_only_viewer: false },
  "/closing": { administrator: true, counter: false, settlement_manager: true, waiter: false, read_only_viewer: false },
  "/dashboard/today": { administrator: true, counter: true, settlement_manager: true, waiter: false, read_only_viewer: true },
  "/dashboard/monthly": { administrator: true, counter: true, settlement_manager: true, waiter: false, read_only_viewer: true },
  "/dashboard/reports": { administrator: true, counter: true, settlement_manager: true, waiter: false, read_only_viewer: true },
  "/masters/operating-months": { administrator: true, counter: false, settlement_manager: false, waiter: false, read_only_viewer: false },
  "/masters/rooms": { administrator: true, counter: false, settlement_manager: false, waiter: false, read_only_viewer: false },
  "/masters/codes": { administrator: true, counter: false, settlement_manager: false, waiter: false, read_only_viewer: false },
  "/masters/employees": { administrator: true, counter: false, settlement_manager: false, waiter: false, read_only_viewer: false },
  "/masters/courses": { administrator: true, counter: false, settlement_manager: false, waiter: false, read_only_viewer: false },
  "/masters/sheet-mapping": { administrator: true, counter: false, settlement_manager: false, waiter: false, read_only_viewer: true },
  "/audit": { administrator: true, counter: false, settlement_manager: false, waiter: false, read_only_viewer: false }
};

describe("route list access", () => {
  it("keeps every role's screen access exactly as it was before the workflow shell", () => {
    for (const [path, byRole] of Object.entries(accessMatrix)) {
      for (const [role, expected] of Object.entries(byRole)) {
        assert.equal(canAccessRoute(role as keyof typeof byRole, path), expected, `${role} ${path}`);
      }
    }
  });

  it("keeps the role first screens: administrator live, counter ledger, settlement Therapist, waiter and viewer rooms", () => {
    assert.equal(getRoleLandingPath("administrator"), "/live");
    assert.equal(getRoleLandingPath("counter"), "/calls");
    assert.equal(getRoleLandingPath("settlement_manager"), "/settlements");
    assert.equal(getRoleLandingPath("waiter"), "/rooms");
    assert.equal(getRoleLandingPath("read_only_viewer"), "/rooms");
  });

  it("treats the root path as the role's first screen", () => {
    assert.equal(canAccessRoute("waiter", "/"), true);
    assert.equal(canAccessRoute("settlement_manager", "/"), true);
  });

  it("denies paths that are not screens in the route list", () => {
    assert.equal(canAccessRoute("administrator", "/masters"), false);
    assert.equal(canAccessRoute("read_only_viewer", "/masters/sheet-mapping/details"), false);
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

  it("carries the chosen operating month and date into dated zones", () => {
    assert.equal(getZoneHref("counter", "floor", ledgerContext), "/rooms?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
    assert.equal(getZoneHref("administrator", "settlements", ledgerContext), "/settlements?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
    assert.equal(getZoneHref("counter", "reports", ledgerContext), "/dashboard/today?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
  });

  it("carries only the operating month into the month-only closing zone", () => {
    assert.equal(getZoneHref("settlement_manager", "closing", ledgerContext), "/closing?operatingMonthId=m-2026-10");
  });

  it("reads the attendance date of the earcare and operations screens as the date to carry", () => {
    const earcareContext = readScreenContext(new URLSearchParams("operatingMonthId=m-2026-10&attendanceDate=2026-10-12"));
    assert.equal(getZoneHref("administrator", "ledger", earcareContext), "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-12");
  });

  it("always opens the ledger tab of the ledger zone, dropping the ledger's own query state", () => {
    const ledgerWithSearch = readScreenContext(
      new URLSearchParams("operatingMonthId=m-2026-10&serviceDate=2026-10-14&customerQuery=kim&visitMemo=vip")
    );
    assert.equal(getZoneHref("counter", "ledger", ledgerWithSearch), "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
  });

  it("opens the first tab the role can enter and leaves undated zones without date context", () => {
    assert.equal(getZoneHref("administrator", "settings", ledgerContext), "/masters/operating-months");
    assert.equal(getZoneHref("read_only_viewer", "settings", ledgerContext), "/masters/sheet-mapping");
    assert.equal(getZoneHref("administrator", "floor", ledgerContext), "/rooms?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
  });

  it("opens the undated customer screen without the ledger's month and date", () => {
    assert.equal(getZoneHref("counter", "customers", ledgerContext), "/customers");
  });

  it("links to the bare first tab when no month or date has been chosen yet", () => {
    assert.equal(getZoneHref("counter", "ledger", readScreenContext(new URLSearchParams())), "/calls");
  });
});

describe("zone tabs", () => {
  const tabPaths = (role: Parameters<typeof getZoneTabs>[0], zone: Parameters<typeof getZoneTabs>[1]) =>
    getZoneTabs(role, zone).map((route) => route.path);

  it("lists the zone's screens the role can enter, in workflow order", () => {
    assert.deepEqual(tabPaths("administrator", "settlements"), [
      "/settlements",
      "/settlements/earcare",
      "/settlements/operations",
      "/settlements/operations/monthly",
      "/settlements/schedule"
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

describe("links between screens", () => {
  const context = { operatingMonthId: "m-2026-10", date: "2026-10-14" };

  it("links to a screen with the month and date only when the role can enter it", () => {
    assert.equal(linkToScreen("counter", "/calls", context), "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
    assert.equal(linkToScreen("administrator", "/settlements/earcare", context), "/settlements/earcare?operatingMonthId=m-2026-10&attendanceDate=2026-10-14");
  });

  it("gives no link to roles that cannot enter the screen", () => {
    assert.equal(linkToScreen("settlement_manager", "/calls", context), null);
    assert.equal(linkToScreen("read_only_viewer", "/calls", context), null);
  });
});
