import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getCurrentAccountAuthorization } from "@/modules/masters/account-service";

export { getCurrentAccountAuthorization } from "@/modules/masters/account-service";

export const roles = [
  "administrator",
  "counter",
  "waiter",
  "settlement_manager",
  "read_only_viewer"
] as const;

export type Role = (typeof roles)[number];

export type SensitivePermission =
  | "call:write"
  | "payout:write"
  | "closing:write"
  | "closing:reopen"
  | "employee:write"
  | "audit:read"
  | "migration:write";

const roleLandingPath: Record<Role, string> = {
  administrator: "/live",
  counter: "/calls",
  settlement_manager: "/settlements",
  waiter: "/rooms",
  read_only_viewer: "/rooms"
};

const roleRoutePrefixes: Record<Role, string[]> = {
  administrator: ["/live", "/calls", "/rooms", "/settlements", "/closing", "/dashboard", "/masters", "/audit", "/tv"],
  counter: ["/live", "/calls", "/rooms", "/dashboard/today", "/dashboard/monthly", "/dashboard/reports"],
  settlement_manager: ["/settlements", "/closing", "/dashboard/today", "/dashboard/monthly", "/dashboard/reports"],
  waiter: ["/rooms"],
  read_only_viewer: ["/rooms", "/tv", "/dashboard/today", "/dashboard/monthly", "/dashboard/reports"]
};

const roleExactRoutes: Record<Role, string[]> = {
  administrator: [],
  counter: [],
  settlement_manager: [],
  waiter: [],
  read_only_viewer: ["/masters/sheet-mapping"]
};

const rolePermissions: Record<Role, SensitivePermission[]> = {
  administrator: ["call:write", "payout:write", "closing:write", "closing:reopen", "employee:write", "audit:read", "migration:write"],
  counter: ["call:write"],
  settlement_manager: ["payout:write", "closing:write"],
  waiter: [],
  read_only_viewer: []
};

const isDevAuthBypassEnabled = () =>
  process.env.NODE_ENV !== "production" && process.env.LOCAL_AUTH_BYPASS === "true";

const devBypassRole = (process.env.LOCAL_AUTH_ROLE as Role | undefined) ?? "administrator";

function getDevBypassAccount() {
  if (!isDevAuthBypassEnabled() || !isRole(devBypassRole)) {
    return null;
  }

  return {
    id: "local-bypass-account",
    role: devBypassRole,
    employeeId: null,
    isActive: true,
    lockedUntil: null
  };
}

export class AuthorizationError extends Error {
  constructor(message = "권한이 없습니다.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

export function getRoleLandingPath(role: Role) {
  return roleLandingPath[role];
}

export function canAccessRoute(role: Role, pathname: string) {
  const normalizedPath = pathname === "/" ? getRoleLandingPath(role) : pathname;
  if (roleExactRoutes[role].includes(normalizedPath)) return true;
  return roleRoutePrefixes[role].some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
}

export function canPerform(role: Role, permission: SensitivePermission) {
  return rolePermissions[role].includes(permission);
}

function isUnavailable(account: { isActive: boolean; lockedUntil: Date | null }) {
  return !account.isActive || (account.lockedUntil !== null && account.lockedUntil > new Date());
}

export async function getAuthorizedAccount() {
  const bypassAccount = getDevBypassAccount();
  if (bypassAccount) {
    return bypassAccount;
  }

  const session = await getServerSession(authOptions);
  const sessionAccountId = session?.user?.accountId;
  if (!sessionAccountId) {
    return null;
  }

  const account = await getCurrentAccountAuthorization(sessionAccountId);
  if (!account || isUnavailable(account)) {
    return null;
  }

  return account;
}

export async function requireRouteAccess(pathname: string) {
  const account = await getAuthorizedAccount();
  if (!account) {
    redirect("/sign-in");
  }

  if (!canAccessRoute(account.role, pathname)) {
    redirect(getRoleLandingPath(account.role));
  }

  return account;
}

export async function requirePermission(permission: SensitivePermission) {
  const account = await getAuthorizedAccount();
  if (!account || !canPerform(account.role, permission)) {
    throw new AuthorizationError();
  }

  return account;
}
