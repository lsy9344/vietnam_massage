import type { Role } from "@/lib/authorization";

export type NavigationItem = {
  label: string;
  href: string;
  allowedRoles: Role[];
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const allRoles: Role[] = ["administrator", "counter", "waiter", "settlement_manager", "read_only_viewer"];

export const navigationGroups: NavigationGroup[] = [
  {
    label: "운영 현황",
    items: [
      { label: "첫화면 실시간 현황", href: "/live", allowedRoles: ["administrator", "counter"] },
      { label: "객실 현황", href: "/rooms", allowedRoles: ["administrator", "counter", "waiter", "read_only_viewer"] },
      { label: "TV 현황판", href: "/tv", allowedRoles: ["administrator", "read_only_viewer"] }
    ]
  },
  {
    label: "콜 원장",
    items: [{ label: "콜/예약 입력 원장", href: "/calls", allowedRoles: ["administrator", "counter"] }]
  },
  {
    label: "정산",
    items: [{ label: "정산 화면", href: "/settlements", allowedRoles: ["administrator", "settlement_manager"] }]
  },
  {
    label: "월마감",
    items: [{ label: "월마감", href: "/closing", allowedRoles: ["administrator", "settlement_manager"] }]
  },
  {
    label: "대시보드",
    items: [
      { label: "오늘 대시보드", href: "/dashboard/today", allowedRoles: allRoles.filter((role) => role !== "waiter") },
      { label: "월간 대시보드", href: "/dashboard/monthly", allowedRoles: allRoles.filter((role) => role !== "waiter") },
      { label: "그래프 리포트", href: "/dashboard/reports", allowedRoles: allRoles.filter((role) => role !== "waiter") }
    ]
  },
  {
    label: "마스터 설정",
    items: [
      { label: "운영월", href: "/masters/operating-months", allowedRoles: ["administrator"] },
      { label: "객실", href: "/masters/rooms", allowedRoles: ["administrator"] },
      { label: "코드/시간 슬롯", href: "/masters/codes", allowedRoles: ["administrator"] },
      { label: "직원", href: "/masters/employees", allowedRoles: ["administrator"] },
      { label: "코스/수당/인센", href: "/masters/courses", allowedRoles: ["administrator"] },
      { label: "시트 기능 매핑표", href: "/masters/sheet-mapping", allowedRoles: ["administrator", "read_only_viewer"] }
    ]
  },
  {
    label: "감사 로그",
    items: [{ label: "감사 로그", href: "/audit", allowedRoles: ["administrator"] }]
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
