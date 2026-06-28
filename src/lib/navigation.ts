import type { Role } from "@/lib/authorization";
import type { MessageKey } from "@/lib/i18n/types";

export type NavigationItem = {
  labelKey: MessageKey;
  href: string;
  allowedRoles: Role[];
};

export type NavigationGroup = {
  labelKey: MessageKey;
  items: NavigationItem[];
};

const allRoles: Role[] = ["administrator", "counter", "waiter", "settlement_manager", "read_only_viewer"];

export const navigationGroups: NavigationGroup[] = [
  {
    labelKey: "nav.group.operations",
    items: [
      { labelKey: "nav.item.live", href: "/live", allowedRoles: ["administrator", "counter"] },
      { labelKey: "nav.item.rooms", href: "/rooms", allowedRoles: ["administrator", "counter", "waiter", "read_only_viewer"] },
      { labelKey: "nav.item.tv", href: "/tv", allowedRoles: ["administrator", "read_only_viewer"] }
    ]
  },
  {
    labelKey: "nav.group.calls",
    items: [{ labelKey: "nav.item.calls", href: "/calls", allowedRoles: ["administrator", "counter"] }]
  },
  {
    labelKey: "nav.group.settlements",
    items: [{ labelKey: "nav.item.settlements", href: "/settlements", allowedRoles: ["administrator", "settlement_manager"] }]
  },
  {
    labelKey: "nav.group.closing",
    items: [{ labelKey: "nav.item.closing", href: "/closing", allowedRoles: ["administrator", "settlement_manager"] }]
  },
  {
    labelKey: "nav.group.dashboard",
    items: [
      { labelKey: "nav.item.dashboardToday", href: "/dashboard/today", allowedRoles: allRoles.filter((role) => role !== "waiter") },
      { labelKey: "nav.item.dashboardMonthly", href: "/dashboard/monthly", allowedRoles: allRoles.filter((role) => role !== "waiter") },
      { labelKey: "nav.item.dashboardReports", href: "/dashboard/reports", allowedRoles: allRoles.filter((role) => role !== "waiter") }
    ]
  },
  {
    labelKey: "nav.group.masters",
    items: [
      { labelKey: "nav.item.mastersOperatingMonths", href: "/masters/operating-months", allowedRoles: ["administrator"] },
      { labelKey: "nav.item.mastersRooms", href: "/masters/rooms", allowedRoles: ["administrator"] },
      { labelKey: "nav.item.mastersCodes", href: "/masters/codes", allowedRoles: ["administrator"] },
      { labelKey: "nav.item.mastersEmployees", href: "/masters/employees", allowedRoles: ["administrator"] },
      { labelKey: "nav.item.mastersCourses", href: "/masters/courses", allowedRoles: ["administrator"] },
      { labelKey: "nav.item.mastersSheetMapping", href: "/masters/sheet-mapping", allowedRoles: ["administrator", "read_only_viewer"] }
    ]
  },
  {
    labelKey: "nav.group.audit",
    items: [{ labelKey: "nav.item.audit", href: "/audit", allowedRoles: ["administrator"] }]
  }
];

export function getNavigationForRole(role: Role) {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.allowedRoles.includes(role))
    }))
    .filter((group) => group.items.length > 0);
}
