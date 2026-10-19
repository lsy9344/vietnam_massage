import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AccountDomainError,
  changeOwnPassword,
  changePassword,
  generateTemporaryPassword,
  getCurrentAccountAuthorization,
  issueTherapistAccount,
  linkUserAccountToEmployee,
  resetTherapistAccountPassword,
  verifyPassword
} from "@/modules/masters/account-service";

function createMemoryPrisma() {
  const employees = new Map<string, { id: string; displayName: string }>([
    ["emp-1", { id: "emp-1", displayName: "Lan" }]
  ]);
  const accounts = [
    { id: "acc-1", accountId: "counter01", role: "counter", employeeId: "emp-1", isActive: true, lockedUntil: null },
    { id: "acc-2", accountId: "admin", role: "administrator", employeeId: null, isActive: true, lockedUntil: null }
  ];

  return {
    userAccount: {
      async findUnique(args: any) {
        const account = accounts.find((candidate) => candidate.accountId === args.where.accountId);
        if (!account) return null;
        const picked: Record<string, unknown> = {};
        for (const [field, selected] of Object.entries(args.select ?? {})) {
          if (!selected) continue;
          if (field === "employee") {
            const employee = account.employeeId ? employees.get(account.employeeId) : null;
            picked.employee = employee ? { displayName: employee.displayName } : null;
          } else {
            picked[field] = account[field as keyof typeof account];
          }
        }
        return picked;
      }
    }
  };
}

describe("getCurrentAccountAuthorization display name", () => {
  it("shows the linked employee's display name for the Me menu", async () => {
    const account = await getCurrentAccountAuthorization("counter01", { prismaClient: createMemoryPrisma() as any });

    assert.equal(account?.displayName, "Lan");
    assert.equal(account?.role, "counter");
  });

  it("falls back to the account id when no employee is linked", async () => {
    const account = await getCurrentAccountAuthorization("admin", { prismaClient: createMemoryPrisma() as any });

    assert.equal(account?.displayName, "admin");
  });
});

// 티켓 02: Therapist 패널의 전용 발급·초기화와 기존 계정 연결의 역할 제한(D26)을 보는 독립 메모리 Prisma.
// employee-service.test.ts의 더 큰 메모리와는 별개로 둬서(병렬 작업 충돌을 줄인다) account-service.ts
// 함수만 부른다.
function createTherapistAccountMemoryPrisma() {
  const employees = new Map<string, { id: string; displayName: string; staffCode: string; employeeGroup: string }>([
    ["emp-therapist-1", { id: "emp-therapist-1", displayName: "마사지사1", staffCode: "THR-901", employeeGroup: "THERAPIST" }],
    ["emp-ops-1", { id: "emp-ops-1", displayName: "카운터1", staffCode: "OPS-901", employeeGroup: "OPERATIONS" }]
  ]);
  const accounts = new Map<string, any>();
  const auditEvents: any[] = [];
  let accountSeq = 1;

  function findAccount(where: any) {
    if (where.id) return accounts.get(where.id) ?? null;
    if (where.accountId) return [...accounts.values()].find((account) => account.accountId === where.accountId) ?? null;
    if (where.employeeId) return [...accounts.values()].find((account) => account.employeeId === where.employeeId) ?? null;
    if (where.email) return [...accounts.values()].find((account) => account.email === where.email) ?? null;
    return null;
  }

  const client: any = {
    employee: {
      async findUnique({ where }: any) {
        return employees.get(where.id) ?? null;
      }
    },
    userAccount: {
      async findUnique({ where }: any) {
        return findAccount(where);
      },
      async findFirst({ where }: any) {
        return findAccount(where);
      },
      async create({ data }: any) {
        const record = {
          id: `acct-${accountSeq++}`,
          failedLoginCount: 0,
          lockedUntil: null,
          passwordChangeRequired: false,
          ...data
        };
        accounts.set(record.id, record);
        return record;
      },
      async update({ where, data }: any) {
        const current = accounts.get(where.id);
        if (!current) throw new Error("missing account");
        const updated = { ...current, ...data };
        accounts.set(where.id, updated);
        return updated;
      }
    },
    auditLog: {
      async create({ data }: any) {
        const record = { id: `audit-${auditEvents.length + 1}`, ...data };
        auditEvents.push(record);
        return record;
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      return callback(client);
    },
    accounts,
    auditEvents
  };

  return client;
}

describe("generateTemporaryPassword", () => {
  it("makes a 10 character secret from the no-lookalike alphabet, and differs across calls", () => {
    const first = generateTemporaryPassword();
    const second = generateTemporaryPassword();

    assert.equal(first.length, 10);
    assert.match(first, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz]+$/);
    assert.notEqual(first, second);
  });
});

describe("linkUserAccountToEmployee rejects Therapist-group employees (D26)", () => {
  it("refuses to link an OPS role account to a THERAPIST-group employee, even though it is the existing generic path", async () => {
    const prismaClient = createTherapistAccountMemoryPrisma();

    await assert.rejects(
      () =>
        linkUserAccountToEmployee({
          actorId: "admin-1",
          employeeId: "emp-therapist-1",
          email: "oops@example.local",
          accountId: "oops-account",
          role: "counter",
          initialSecret: "SomeSecret1",
          prismaClient
        }),
      (error: unknown) => {
        assert.ok(error instanceof AccountDomainError);
        assert.equal(error.code, "THERAPIST_EMPLOYEE_REQUIRES_DEDICATED_ACCOUNT_FLOW");
        return true;
      }
    );
    assert.equal(prismaClient.accounts.size, 0);
  });
});

describe("issueTherapistAccount", () => {
  it("creates a therapist-role account defaulted to the staff code, hashes the one-time secret, and turns on the password-change flag", async () => {
    const prismaClient = createTherapistAccountMemoryPrisma();

    const { account, oneTimeSecret } = await issueTherapistAccount({
      actorId: "admin-1",
      employeeId: "emp-therapist-1",
      prismaClient
    });

    assert.equal(account.accountId, "thr-901");
    assert.equal(account.role, "therapist");
    assert.equal(account.passwordChangeRequired, true);
    assert.equal(account.email.endsWith("@therapist.internal"), true);
    assert.equal(account.passwordHash.includes(oneTimeSecret), false);
    assert.equal(await verifyPassword(account.passwordHash, oneTimeSecret), true);
    assert.equal(prismaClient.auditEvents.at(-1).action, "user_account.therapist_issued");
  });

  it("lets the admin override the default account id", async () => {
    const prismaClient = createTherapistAccountMemoryPrisma();

    const { account } = await issueTherapistAccount({
      actorId: "admin-1",
      employeeId: "emp-therapist-1",
      accountId: "Custom-ID",
      prismaClient
    });

    assert.equal(account.accountId, "custom-id");
  });

  it("rejects issuing a Therapist account for an OPERATIONS-group employee", async () => {
    const prismaClient = createTherapistAccountMemoryPrisma();

    await assert.rejects(
      () => issueTherapistAccount({ actorId: "admin-1", employeeId: "emp-ops-1", prismaClient }),
      (error: unknown) => {
        assert.ok(error instanceof AccountDomainError);
        assert.equal(error.code, "THERAPIST_ACCOUNT_REQUIRES_THERAPIST_EMPLOYEE");
        return true;
      }
    );
  });

  it("rejects issuing twice for the same employee (use reset instead)", async () => {
    const prismaClient = createTherapistAccountMemoryPrisma();
    await issueTherapistAccount({ actorId: "admin-1", employeeId: "emp-therapist-1", prismaClient });

    await assert.rejects(
      () => issueTherapistAccount({ actorId: "admin-1", employeeId: "emp-therapist-1", prismaClient }),
      (error: unknown) => {
        assert.ok(error instanceof AccountDomainError);
        assert.equal(error.code, "THERAPIST_ACCOUNT_ALREADY_ISSUED");
        return true;
      }
    );
  });
});

describe("resetTherapistAccountPassword", () => {
  it("rotates the secret, keeps the password-change flag on, clears any lock, and audits separately from issuing", async () => {
    const prismaClient = createTherapistAccountMemoryPrisma();
    const issued = await issueTherapistAccount({ actorId: "admin-1", employeeId: "emp-therapist-1", prismaClient });
    prismaClient.accounts.set(issued.account.id, { ...issued.account, failedLoginCount: 4, lockedUntil: new Date("2099-01-01T00:00:00.000Z") });

    const { account, oneTimeSecret } = await resetTherapistAccountPassword({
      actorId: "admin-1",
      userAccountId: issued.account.id,
      prismaClient
    });

    assert.notEqual(oneTimeSecret, issued.oneTimeSecret);
    assert.equal(await verifyPassword(account.passwordHash, oneTimeSecret), true);
    assert.equal(account.passwordChangeRequired, true);
    assert.equal(account.failedLoginCount, 0);
    assert.equal(account.lockedUntil, null);
    assert.equal(prismaClient.auditEvents.at(-1).action, "user_account.password_reset");
  });

  it("rejects resetting a non-therapist account through this path", async () => {
    const prismaClient = createTherapistAccountMemoryPrisma();
    const opsAccount = await prismaClient.userAccount.create({
      data: { email: "counter@example.local", accountId: "counter-1", passwordHash: "hash", role: "counter", employeeId: "emp-ops-1" }
    });

    await assert.rejects(
      () => resetTherapistAccountPassword({ actorId: "admin-1", userAccountId: opsAccount.id, prismaClient }),
      (error: unknown) => {
        assert.ok(error instanceof AccountDomainError);
        assert.equal(error.code, "THERAPIST_ACCOUNT_RESET_REQUIRES_THERAPIST_ROLE");
        return true;
      }
    );
  });
});

describe("changePassword / changeOwnPassword", () => {
  it("changePassword clears the password-change-required flag(M21)", async () => {
    const prismaClient = createTherapistAccountMemoryPrisma();
    const issued = await issueTherapistAccount({ actorId: "admin-1", employeeId: "emp-therapist-1", prismaClient });
    assert.equal(issued.account.passwordChangeRequired, true);

    const updated = await changePassword(issued.account.id, "BrandNewSecret1", { prismaClient });

    assert.equal(updated.passwordChangeRequired, false);
    assert.equal(await verifyPassword(updated.passwordHash, "BrandNewSecret1"), true);
  });

  it("changeOwnPassword rejects the wrong current password and leaves the account untouched", async () => {
    const prismaClient = createTherapistAccountMemoryPrisma();
    const issued = await issueTherapistAccount({ actorId: "admin-1", employeeId: "emp-therapist-1", prismaClient });

    await assert.rejects(
      () =>
        changeOwnPassword({
          accountId: issued.account.id,
          currentSecret: "wrong-secret",
          nextSecret: "BrandNewSecret1",
          prismaClient
        }),
      (error: unknown) => {
        assert.ok(error instanceof AccountDomainError);
        assert.equal(error.code, "CURRENT_PASSWORD_INCORRECT");
        return true;
      }
    );
    assert.equal(await verifyPassword(prismaClient.accounts.get(issued.account.id).passwordHash, issued.oneTimeSecret), true);
  });

  it("changeOwnPassword verifies the current secret, then changes it and clears the flag", async () => {
    const prismaClient = createTherapistAccountMemoryPrisma();
    const issued = await issueTherapistAccount({ actorId: "admin-1", employeeId: "emp-therapist-1", prismaClient });

    const updated = await changeOwnPassword({
      accountId: issued.account.id,
      currentSecret: issued.oneTimeSecret,
      nextSecret: "BrandNewSecret1",
      prismaClient
    });

    assert.equal(updated.passwordChangeRequired, false);
    assert.equal(await verifyPassword(updated.passwordHash, "BrandNewSecret1"), true);
  });
});
