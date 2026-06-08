import { Algorithm, hash, verify } from "@node-rs/argon2";
import { prisma } from "@/lib/prisma";
import { SAFE_AUTH_ERROR_MESSAGE } from "@/lib/auth-messages";
import type { Role } from "@/lib/authorization";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import { linkUserAccountToEmployeeSchema } from "@/modules/masters/employee-schema";

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

type AccountPrismaClient = {
  employee: {
    findUnique(args: unknown): Promise<{ id: string; displayName: string; staffCode: string } | null>;
  };
  userAccount: {
    create(args: unknown): Promise<UserAccountRecord>;
    findUnique(args: unknown): Promise<UserAccountRecord | null>;
    findFirst(args: unknown): Promise<UserAccountRecord | null>;
    update(args: unknown): Promise<UserAccountRecord>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction?<T>(callback: (tx: AccountPrismaClient) => Promise<T>): Promise<T>;
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

export type LinkUserAccountToEmployeeInput = {
  actorId: string;
  employeeId: string;
  email: string;
  accountId: string;
  role: Role;
  initialSecret?: string;
  prismaClient?: AccountPrismaClient;
};

export class AccountDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AccountDomainError";
  }
}

function normalizeIdentity(identity: string) {
  return identity.trim().toLowerCase();
}

function getAccountClient(client?: AccountPrismaClient) {
  return client ?? (prisma as unknown as AccountPrismaClient);
}

async function runAccountTransaction<T>(client: AccountPrismaClient, callback: (tx: AccountPrismaClient) => Promise<T>) {
  if (client.$transaction) {
    return client.$transaction(callback);
  }

  return callback(client);
}

export function isAccountRole(value: unknown): value is Role {
  return typeof value === "string" && validRoles.includes(value as Role);
}

function toRole(value: string): Role | null {
  return isAccountRole(value) ? value : null;
}

function accountAuditSnapshot(account: UserAccountRecord): AuditJsonSnapshot {
  return {
    id: account.id,
    email: account.email,
    accountId: account.accountId,
    role: account.role,
    employeeId: account.employeeId,
    isActive: account.isActive,
    lockedUntil: account.lockedUntil ? account.lockedUntil.toISOString() : null,
    failedLoginCount: account.failedLoginCount
  };
}

async function recordAccountAudit(
  tx: AccountPrismaClient,
  input: {
    actorId: string;
    action: string;
    targetId: string;
    beforeValue: AuditJsonSnapshot | null;
    afterValue: AuditJsonSnapshot | null;
  }
) {
  await recordAuditEvent(
    {
      actorId: input.actorId,
      action: input.action,
      targetType: "user_account",
      targetId: input.targetId,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue
    },
    { prismaClient: tx as any }
  );
}

function assertSameAccount(
  first: UserAccountRecord | null,
  second: UserAccountRecord | null,
  message: string,
  code: string
) {
  if (first && second && first.id !== second.id) {
    throw new AccountDomainError(message, code);
  }
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

export async function linkUserAccountToEmployee(input: LinkUserAccountToEmployeeInput) {
  const parsed = linkUserAccountToEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    throw new AccountDomainError(parsed.error.issues[0]?.message ?? "계정 연결 입력값이 올바르지 않습니다.", "INVALID_ACCOUNT_LINK_INPUT");
  }

  const client = getAccountClient(input.prismaClient);

  return runAccountTransaction(client, async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: parsed.data.employeeId } });
    if (!employee) {
      throw new AccountDomainError("직원을 찾을 수 없습니다.", "EMPLOYEE_NOT_FOUND");
    }

    const normalizedEmail = normalizeIdentity(parsed.data.email);
    const normalizedAccountId = normalizeIdentity(parsed.data.accountId);
    const existingByEmployee = await tx.userAccount.findUnique({ where: { employeeId: parsed.data.employeeId } });
    const existingByAccountId = await tx.userAccount.findUnique({ where: { accountId: normalizedAccountId } });
    const existingByEmail = await tx.userAccount.findUnique({ where: { email: normalizedEmail } });

    assertSameAccount(
      existingByEmployee,
      existingByAccountId,
      "입력한 계정 ID가 현재 직원의 연결 계정과 다릅니다.",
      "ACCOUNT_ID_CONFLICTS_WITH_EMPLOYEE_ACCOUNT"
    );
    assertSameAccount(
      existingByEmployee,
      existingByEmail,
      "입력한 이메일이 현재 직원의 연결 계정과 다릅니다.",
      "EMAIL_CONFLICTS_WITH_EMPLOYEE_ACCOUNT"
    );
    assertSameAccount(existingByAccountId, existingByEmail, "계정 ID와 이메일이 서로 다른 계정에 속합니다.", "ACCOUNT_ID_EMAIL_MISMATCH");
    if (existingByAccountId && existingByAccountId.employeeId && existingByAccountId.employeeId !== parsed.data.employeeId) {
      throw new AccountDomainError("이미 다른 직원에게 연결된 계정 ID입니다.", "ACCOUNT_ID_ALREADY_LINKED");
    }
    if (existingByEmail && existingByEmail.employeeId && existingByEmail.employeeId !== parsed.data.employeeId) {
      throw new AccountDomainError("이미 다른 직원에게 연결된 이메일입니다.", "EMAIL_ALREADY_LINKED");
    }

    const existing = existingByEmployee ?? existingByAccountId ?? existingByEmail;

    if (!existing) {
      if (!parsed.data.initialSecret) {
        throw new AccountDomainError("새 계정을 만들려면 초기 비밀번호가 필요합니다.", "INITIAL_SECRET_REQUIRED");
      }
      const passwordHash = await hashPassword(parsed.data.initialSecret);
      const created = await tx.userAccount.create({
        data: {
          email: normalizedEmail,
          accountId: normalizedAccountId,
          passwordHash,
          role: parsed.data.role,
          employeeId: parsed.data.employeeId,
          isActive: true,
          failedLoginCount: 0,
          lockedUntil: null
        }
      });
      await recordAccountAudit(tx, {
        actorId: input.actorId,
        action: "user_account.linked_to_employee",
        targetId: created.id,
        beforeValue: null,
        afterValue: accountAuditSnapshot(created)
      });
      return created;
    }

    const before = accountAuditSnapshot(existing);
    const passwordHash = parsed.data.initialSecret ? await hashPassword(parsed.data.initialSecret) : existing.passwordHash;
    const updated = await tx.userAccount.update({
      where: { id: existing.id },
      data: {
        email: normalizedEmail,
        accountId: normalizedAccountId,
        role: parsed.data.role,
        employeeId: parsed.data.employeeId,
        passwordHash
      }
    });
    const after = accountAuditSnapshot(updated);
    const linkMetadataChanged =
      existing.employeeId !== parsed.data.employeeId || existing.email !== normalizedEmail || existing.accountId !== normalizedAccountId;

    if (existing.role !== parsed.data.role) {
      await recordAccountAudit(tx, {
        actorId: input.actorId,
        action: "user_account.role_changed",
        targetId: updated.id,
        beforeValue: before,
        afterValue: after
      });
    } else if (linkMetadataChanged) {
      await recordAccountAudit(tx, {
        actorId: input.actorId,
        action: "user_account.linked_to_employee",
        targetId: updated.id,
        beforeValue: before,
        afterValue: after
      });
    }

    return updated;
  });
}

export async function deactivateUserAccount(input: { actorId: string; userAccountId: string; prismaClient?: AccountPrismaClient }) {
  const client = getAccountClient(input.prismaClient);
  return runAccountTransaction(client, async (tx) => {
    const current = await tx.userAccount.findUnique({ where: { id: input.userAccountId } });
    if (!current) {
      throw new AccountDomainError("계정을 찾을 수 없습니다.", "ACCOUNT_NOT_FOUND");
    }
    if (!current.isActive) {
      return current;
    }
    const updated = await tx.userAccount.update({ where: { id: input.userAccountId }, data: { isActive: false } });
    await recordAccountAudit(tx, {
      actorId: input.actorId,
      action: "user_account.deactivated",
      targetId: updated.id,
      beforeValue: accountAuditSnapshot(current),
      afterValue: accountAuditSnapshot(updated)
    });
    return updated;
  });
}

export async function resetUserAccountLock(input: { actorId: string; userAccountId: string; prismaClient?: AccountPrismaClient }) {
  const client = getAccountClient(input.prismaClient);
  return runAccountTransaction(client, async (tx) => {
    const current = await tx.userAccount.findUnique({ where: { id: input.userAccountId } });
    if (!current) {
      throw new AccountDomainError("계정을 찾을 수 없습니다.", "ACCOUNT_NOT_FOUND");
    }
    if (current.failedLoginCount === 0 && current.lockedUntil === null) {
      return current;
    }
    const updated = await tx.userAccount.update({
      where: { id: input.userAccountId },
      data: { failedLoginCount: 0, lockedUntil: null }
    });
    await recordAccountAudit(tx, {
      actorId: input.actorId,
      action: "user_account.lock_reset",
      targetId: updated.id,
      beforeValue: accountAuditSnapshot(current),
      afterValue: accountAuditSnapshot(updated)
    });
    return updated;
  });
}
