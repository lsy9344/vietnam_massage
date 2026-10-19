import { hash, verify } from "@/lib/password-hash";
import { prisma } from "@/lib/prisma";
import { SAFE_AUTH_ERROR_MESSAGE } from "@/lib/auth-messages";
import type { Role } from "@/lib/authorization";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import { linkUserAccountToEmployeeSchema } from "@/modules/masters/employee-schema";

export { SAFE_AUTH_ERROR_MESSAGE };
export const LOGIN_LOCKOUT_THRESHOLD = 5;
export const LOGIN_LOCKOUT_MINUTES = 15;
const ARGON2ID_ALGORITHM = 2;

const validRoles = [
  "administrator",
  "counter",
  "waiter",
  "settlement_manager",
  "read_only_viewer",
  // 티켓 01: 로그인·세션이 therapist 역할을 인식하게 한다. 발급 화면(02)의 employee-schema accountRoles는
  // 아직 therapist를 넣지 않는다 — 그 화면은 THERAPIST 구분 직원에게만 이 역할을 주는 제약을 따로 구현한다.
  "therapist"
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
  passwordChangeRequired: boolean;
  employee?: {
    displayName: string;
  } | null;
};

type AccountPrismaClient = {
  employee: {
    findUnique(args: unknown): Promise<{ id: string; displayName: string; staffCode: string; employeeGroup: string } | null>;
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
  /** "나" 메뉴에 보이는 이름. 연결된 직원의 표시명, 없으면 계정 ID. */
  displayName: string;
  /** 티켓 02(M17 뒷부분): 켜져 있으면 Therapist 검사가 비밀번호 변경 화면과 로그아웃 말고는 막는다. */
  passwordChangeRequired: boolean;
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
    failedLoginCount: account.failedLoginCount,
    // 메모리 테스트 더미 계정은 이 칸을 채우지 않을 수 있어(실제 DB는 NOT NULL 기본값 false), undefined가
    // 감사 JSON 검사에서 거절되지 않도록 Boolean으로 좁힌다.
    passwordChangeRequired: Boolean(account.passwordChangeRequired)
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
    algorithm: ARGON2ID_ALGORITHM,
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
    const matches = await verify(passwordHash, secret);
    if (!matches) {
      console.error("[auth] password verification returned false");
    }
    return matches;
  } catch (error) {
    console.error("[auth] password verification failed", error);
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

export async function getCurrentAccountAuthorization(
  accountId: string,
  options: { prismaClient?: AccountPrismaClient } = {}
): Promise<CurrentAccountAuthorization | null> {
  const account = (await getAccountClient(options.prismaClient).userAccount.findUnique({
    where: { accountId },
    select: {
      id: true,
      accountId: true,
      role: true,
      employeeId: true,
      isActive: true,
      lockedUntil: true,
      passwordChangeRequired: true,
      employee: { select: { displayName: true } }
    }
  })) as (Omit<CurrentAccountAuthorization, "role" | "displayName"> & {
    accountId: string;
    role: string;
    employee: { displayName: string } | null;
  }) | null;

  if (!account) {
    return null;
  }

  const role = toRole(account.role);
  if (!role) {
    return null;
  }

  return {
    id: account.id,
    role,
    employeeId: account.employeeId,
    isActive: account.isActive,
    lockedUntil: account.lockedUntil,
    displayName: account.employee?.displayName ?? account.accountId,
    passwordChangeRequired: Boolean(account.passwordChangeRequired)
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

/** 비밀번호를 바꾸고 잠금을 푼다. 성공하면 비밀번호 변경 필요 표시도 지운다(M21). */
export async function changePassword(accountId: string, nextSecret: string, options: { prismaClient?: AccountPrismaClient } = {}) {
  const client = getAccountClient(options.prismaClient);
  const passwordHash = await hashPassword(nextSecret);
  return client.userAccount.update({
    where: { id: accountId },
    data: {
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      passwordChangeRequired: false
    }
  });
}

export type ChangeOwnPasswordInput = {
  accountId: string;
  currentSecret: string;
  nextSecret: string;
  prismaClient?: AccountPrismaClient;
};

/**
 * 본인이 지금 비밀번호를 확인시키고 새 비밀번호로 바꾼다(티켓 02, 02 가정: 지금 비밀번호도 받는다).
 * 관리자가 임시 비밀번호를 다시 주는 초기화와 달리, 본인 확인이 먼저다.
 */
export async function changeOwnPassword(input: ChangeOwnPasswordInput) {
  const client = getAccountClient(input.prismaClient);
  const account = await client.userAccount.findUnique({ where: { id: input.accountId } });
  if (!account) {
    throw new AccountDomainError("계정을 찾을 수 없습니다.", "ACCOUNT_NOT_FOUND");
  }

  const matches = await verifyPassword(account.passwordHash, input.currentSecret);
  if (!matches) {
    throw new AccountDomainError("지금 비밀번호가 올바르지 않습니다.", "CURRENT_PASSWORD_INCORRECT");
  }

  return changePassword(input.accountId, input.nextSecret, { prismaClient: input.prismaClient });
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
    // D26: Therapist 구분 직원은 이 화면이 아니라 전용 발급 화면(issueTherapistAccount)에서만 계정을 연결한다.
    // 그 화면의 유일한 역할(therapist)은 이 폼의 accountRoles 선택지에 없으므로, 거꾸로 이 경로로 들어온
    // Therapist 직원 요청은 여기서 서버가 거절한다(티켓 01 메모, 티켓 02 구현).
    if (employee.employeeGroup === "THERAPIST") {
      throw new AccountDomainError(
        "Therapist 구분 직원은 Therapist 패널의 전용 발급 화면에서만 계정을 연결합니다.",
        "THERAPIST_EMPLOYEE_REQUIRES_DEDICATED_ACCOUNT_FLOW"
      );
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

// 안내 쪽지에 한 번만 보이는 임시 비밀번호(스펙 D5). 종이에서 헷갈리는 0/O, 1/l/I을 뺀 글자만 쓴다.
const TEMPORARY_PASSWORD_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const TEMPORARY_PASSWORD_LENGTH = 10;

/** Cloudflare Workers·브라우저·Node에서 모두 되는 Web Crypto로 임시 비밀번호를 만든다(M11과 같은 방식). */
export function generateTemporaryPassword() {
  const bytes = new Uint8Array(TEMPORARY_PASSWORD_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => TEMPORARY_PASSWORD_ALPHABET[byte % TEMPORARY_PASSWORD_ALPHABET.length]).join("");
}

export type IssueTherapistAccountInput = {
  actorId: string;
  employeeId: string;
  /** 비워 두면 직원 코드를 기본값으로 쓴다(스펙 D5). */
  accountId?: string;
  prismaClient?: AccountPrismaClient;
};

/**
 * Therapist 패널의 전용 발급(스펙 D2, D5, D26, M5). 역할은 항상 therapist로 고정하고, Therapist 구분
 * 직원에게만 발급하며, 이메일이 없는 Therapist를 위해 겹치지 않는 내부용 이메일을 만들어 넣는다(티켓 02
 * 가정). 안내 쪽지에 한 번만 쓸 임시 비밀번호를 평문으로 돌려주고, 해시만 저장한다.
 */
export async function issueTherapistAccount(input: IssueTherapistAccountInput) {
  const oneTimeSecret = generateTemporaryPassword();
  const client = getAccountClient(input.prismaClient);

  const account = await runAccountTransaction(client, async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) {
      throw new AccountDomainError("직원을 찾을 수 없습니다.", "EMPLOYEE_NOT_FOUND");
    }
    if (employee.employeeGroup !== "THERAPIST") {
      throw new AccountDomainError(
        "Therapist 구분 직원에게만 Therapist 계정을 발급할 수 있습니다.",
        "THERAPIST_ACCOUNT_REQUIRES_THERAPIST_EMPLOYEE"
      );
    }

    const existing = await tx.userAccount.findUnique({ where: { employeeId: input.employeeId } });
    if (existing) {
      throw new AccountDomainError("이미 계정이 있는 직원입니다. 비밀번호 초기화를 쓰세요.", "THERAPIST_ACCOUNT_ALREADY_ISSUED");
    }

    const accountId = normalizeIdentity(input.accountId?.trim() ? input.accountId : employee.staffCode);
    const conflict = await tx.userAccount.findUnique({ where: { accountId } });
    if (conflict) {
      throw new AccountDomainError("이미 사용 중인 계정 ID입니다.", "ACCOUNT_ID_ALREADY_LINKED");
    }
    // D5 가정: Therapist에게는 이메일이 없다 — 겹치지 않는 내부용 주소를 만들고 로그인은 계정 ID로 한다.
    const email = `${accountId}@therapist.internal`;

    const passwordHash = await hashPassword(oneTimeSecret);
    const created = await tx.userAccount.create({
      data: {
        email,
        accountId,
        passwordHash,
        role: "therapist",
        employeeId: input.employeeId,
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null,
        passwordChangeRequired: true
      }
    });

    await recordAccountAudit(tx, {
      actorId: input.actorId,
      action: "user_account.therapist_issued",
      targetId: created.id,
      beforeValue: null,
      afterValue: accountAuditSnapshot(created)
    });

    return created;
  });

  return { account, oneTimeSecret };
}

export type ResetTherapistAccountPasswordInput = {
  actorId: string;
  userAccountId: string;
  prismaClient?: AccountPrismaClient;
};

/** 비밀번호 초기화(스펙 D5, M5): 새 임시 비밀번호로 바꾸고, 변경 필요 표시를 다시 켜고, 잠금도 푼다. */
export async function resetTherapistAccountPassword(input: ResetTherapistAccountPasswordInput) {
  const oneTimeSecret = generateTemporaryPassword();
  const client = getAccountClient(input.prismaClient);

  const account = await runAccountTransaction(client, async (tx) => {
    const current = await tx.userAccount.findUnique({ where: { id: input.userAccountId } });
    if (!current) {
      throw new AccountDomainError("계정을 찾을 수 없습니다.", "ACCOUNT_NOT_FOUND");
    }
    if (current.role !== "therapist") {
      throw new AccountDomainError(
        "Therapist 계정만 이 방법으로 비밀번호를 초기화할 수 있습니다.",
        "THERAPIST_ACCOUNT_RESET_REQUIRES_THERAPIST_ROLE"
      );
    }

    const passwordHash = await hashPassword(oneTimeSecret);
    const updated = await tx.userAccount.update({
      where: { id: input.userAccountId },
      data: { passwordHash, passwordChangeRequired: true, failedLoginCount: 0, lockedUntil: null }
    });

    await recordAccountAudit(tx, {
      actorId: input.actorId,
      action: "user_account.password_reset",
      targetId: updated.id,
      beforeValue: accountAuditSnapshot(current),
      afterValue: accountAuditSnapshot(updated)
    });

    return updated;
  });

  return { account, oneTimeSecret };
}
