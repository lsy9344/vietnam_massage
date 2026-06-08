import { Algorithm, hash, verify } from "@node-rs/argon2";
import { prisma } from "@/lib/prisma";
import { SAFE_AUTH_ERROR_MESSAGE } from "@/lib/auth-messages";
import type { Role } from "@/lib/authorization";

export { SAFE_AUTH_ERROR_MESSAGE };
export const LOGIN_LOCKOUT_THRESHOLD = 5;
export const LOGIN_LOCKOUT_MINUTES = 15;

const validRoles = [
  "administrator",
  "counter",
  "waiter",
  "settlement_manager",
  "read_only_viewer"
] as const;

type UserAccountRecord = {
  id: string;
  email: string;
  accountId: string;
  passwordHash: string;
  role: string;
  employeeId: string | null;
  isActive: boolean;
  lockedUntil: Date | null;
  failedLoginCount: number;
  employee?: {
    displayName: string;
  } | null;
};

export type AuthenticatedAccount = {
  id: string;
  email: string;
  accountId: string;
  role: Role;
  employeeId: string | null;
  displayName: string;
};

export type CurrentAccountAuthorization = {
  id: string;
  role: Role;
  employeeId: string | null;
  isActive: boolean;
  lockedUntil: Date | null;
};

export type CreateUserAccountInput = {
  email: string;
  accountId: string;
  initialSecret: string;
  role: Role;
  employeeId?: string | null;
};

function normalizeIdentity(identity: string) {
  return identity.trim().toLowerCase();
}

export function isAccountRole(value: unknown): value is Role {
  return typeof value === "string" && validRoles.includes(value as Role);
}

function toRole(value: string): Role | null {
  return isAccountRole(value) ? value : null;
}

function isLocked(account: { lockedUntil: Date | null }, now = new Date()) {
  return account.lockedUntil !== null && account.lockedUntil > now;
}

export async function hashPassword(secret: string) {
  if (secret.trim().length === 0) {
    throw new Error("비밀번호는 비어 있을 수 없습니다.");
  }

  return hash(secret, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function verifyPassword(passwordHash: string, secret: string) {
  if (secret.length === 0) {
    return false;
  }

  try {
    return await verify(passwordHash, secret);
  } catch {
    return false;
  }
}

async function findAccountByIdentity(identity: string): Promise<UserAccountRecord | null> {
  const normalized = normalizeIdentity(identity);
  return (prisma as any).userAccount.findFirst({
    where: {
      OR: [{ email: normalized }, { accountId: normalized }]
    },
    include: {
      employee: {
        select: {
          displayName: true
        }
      }
    }
  });
}

export async function recordFailedLogin(accountId: string, identity: string) {
  const account = await (prisma as any).userAccount.findUnique({
    where: { id: accountId },
    select: { failedLoginCount: true }
  });
  const failedLoginCount = (account?.failedLoginCount ?? 0) + 1;
  const lockedUntil =
    failedLoginCount >= LOGIN_LOCKOUT_THRESHOLD
      ? new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000)
      : null;

  await (prisma as any).$transaction([
    (prisma as any).userAccount.update({
      where: { id: accountId },
      data: {
        failedLoginCount,
        lockedUntil
      }
    }),
    (prisma as any).loginAttempt.create({
      data: {
        userAccountId: accountId,
        identity: normalizeIdentity(identity),
        success: false
      }
    })
  ]);
}

async function recordSuccessfulLogin(accountId: string, identity: string) {
  await (prisma as any).$transaction([
    (prisma as any).userAccount.update({
      where: { id: accountId },
      data: {
        failedLoginCount: 0,
        lockedUntil: null
      }
    }),
    (prisma as any).loginAttempt.create({
      data: {
        userAccountId: accountId,
        identity: normalizeIdentity(identity),
        success: true
      }
    })
  ]);
}

export async function authenticateAccount(identity: string, secret: string) {
  const account = await findAccountByIdentity(identity);
  if (!account || !account.isActive || isLocked(account)) {
    return null;
  }

  const role = toRole(account.role);
  if (!role) {
    return null;
  }

  const passwordMatches = await verifyPassword(account.passwordHash, secret);
  if (!passwordMatches) {
    await recordFailedLogin(account.id, identity);
    return null;
  }

  await recordSuccessfulLogin(account.id, identity);

  return {
    id: account.id,
    email: account.email,
    accountId: account.accountId,
    role,
    employeeId: account.employeeId,
    displayName: account.employee?.displayName ?? account.accountId
  } satisfies AuthenticatedAccount;
}

export async function getCurrentAccountAuthorization(accountId: string) {
  const account = (await (prisma as any).userAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      role: true,
      employeeId: true,
      isActive: true,
      lockedUntil: true
    }
  })) as CurrentAccountAuthorization | null;

  if (!account) {
    return null;
  }

  const role = toRole(account.role);
  if (!role) {
    return null;
  }

  return {
    ...account,
    role
  };
}

export async function createUserAccount(input: CreateUserAccountInput) {
  const passwordHash = await hashPassword(input.initialSecret);
  return (prisma as any).userAccount.create({
    data: {
      email: normalizeIdentity(input.email),
      accountId: normalizeIdentity(input.accountId),
      passwordHash,
      role: input.role,
      employeeId: input.employeeId ?? null
    }
  });
}

export async function changePassword(accountId: string, nextSecret: string) {
  const passwordHash = await hashPassword(nextSecret);
  return (prisma as any).userAccount.update({
    where: { id: accountId },
    data: {
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null
    }
  });
}
