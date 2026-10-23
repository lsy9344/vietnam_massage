import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canAccessRoute, getRoleLandingPath } from "@/lib/routes";
import { getCurrentAccountAuthorization } from "@/modules/masters/account-service";

export { getCurrentAccountAuthorization } from "@/modules/masters/account-service";
// 화면 접근 규칙은 탐색 셸의 라우트 목록 하나에서 나온다.
export { canAccessRoute, getRoleLandingPath } from "@/lib/routes";

export const roles = [
  "administrator",
  "counter",
  "waiter",
  "settlement_manager",
  "read_only_viewer",
  // 티켓 01: Therapist 전용 역할. 민감 권한이 없고 Therapist 화면에만 들어간다(스펙 D2).
  "therapist"
] as const;

export type Role = (typeof roles)[number];

export type SensitivePermission =
  | "call:write"
  | "payout:write"
  | "closing:write"
  | "closing:reopen"
  | "employee:write"
  | "audit:read"
  | "migration:write"
  // 티켓 01: 공지·Therapist 현황·내부 메모(10, 11, 12)가 쓰는 관리자 전용 권한(스펙 M18).
  | "therapist:manage"
  // 카운터 휴무 등록(2026-10-23 고객 요청): Therapist 휴무·소중한날 휴가를 기간으로 등록·취소한다(카운터·관리자).
  // 근무표 칸을 휴무로 바꾸지만 payout:write(출퇴근·정산 수정)는 주지 않는다.
  | "dayoff:write";

const rolePermissions: Record<Role, SensitivePermission[]> = {
  administrator: ["call:write", "payout:write", "closing:write", "closing:reopen", "employee:write", "audit:read", "migration:write", "therapist:manage", "dayoff:write"],
  counter: ["call:write", "dayoff:write"],
  settlement_manager: ["payout:write", "closing:write"],
  waiter: [],
  read_only_viewer: [],
  therapist: []
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
    displayName: "local-bypass-account",
    role: devBypassRole,
    employeeId: null,
    isActive: true,
    lockedUntil: null,
    passwordChangeRequired: false
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
