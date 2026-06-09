import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyPassword } from "@/modules/masters/account-service";
import { createEmployeeSchema } from "@/modules/masters/employee-schema";
import {
  createEmployee,
  deactivateEmployee,
  ensureDefaultEmployees,
  linkUserAccountToEmployee,
  listActiveEmployees,
  listEmployees,
  updateEmployeeProfile
} from "@/modules/masters/employee-service";

function createMemoryPrisma() {
  const employees = new Map<string, any>();
  const accounts = new Map<string, any>();
  const auditEvents: any[] = [];
  let employeeSeq = 1;
  let accountSeq = 1;

  function timestamp(offset: number) {
    return new Date(Date.UTC(2026, 5, 8, 0, offset, 0, 0));
  }

  function matchesWhere(record: any, where: any = {}) {
    if (where.id && record.id !== where.id) return false;
    if (where.staffCode && record.staffCode !== where.staffCode) return false;
    if (where.accountId && record.accountId !== where.accountId) return false;
    if (where.email && record.email !== where.email) return false;
    if (where.employeeId && record.employeeId !== where.employeeId) return false;
    if (typeof where.isActive === "boolean" && record.isActive !== where.isActive) return false;
    if (where.employeeGroup && record.employeeGroup !== where.employeeGroup) return false;
    if (typeof where.sortOrder === "number" && record.sortOrder !== where.sortOrder) return false;
    if (where.NOT?.id && record.id === where.NOT.id) return false;
    return true;
  }

  function withAccount(employee: any) {
    if (!employee) return null;
    return {
      ...employee,
      account: [...accounts.values()].find((account) => account.employeeId === employee.id) ?? null
    };
  }

  const client: any = {
    employee: {
      async create({ data }: any) {
        const record = {
          id: `emp-${employeeSeq++}`,
          displayName: data.displayName,
          staffCode: data.staffCode,
          employeeGroup: data.employeeGroup,
          position: data.position,
          shiftType: data.shiftType ?? null,
          baseSalary: data.baseSalary,
          phone: data.phone ?? null,
          birthday: data.birthday ?? null,
          hireDate: data.hireDate ?? null,
          employmentStatus: data.employmentStatus,
          sortOrder: data.sortOrder,
          isActive: data.isActive ?? true,
          createdAt: timestamp(employeeSeq),
          updatedAt: timestamp(employeeSeq)
        };
        employees.set(record.id, record);
        return withAccount(record);
      },
      async findMany({ where }: any = {}) {
        return [...employees.values()]
          .filter((employee) => matchesWhere(employee, where))
          .sort(
            (a, b) =>
              a.employeeGroup.localeCompare(b.employeeGroup) ||
              a.sortOrder - b.sortOrder ||
              a.createdAt.getTime() - b.createdAt.getTime()
          )
          .map(withAccount);
      },
      async findUnique({ where }: any) {
        if (where.id) return employees.has(where.id) ? withAccount(employees.get(where.id)) : null;
        if (where.staffCode) return withAccount([...employees.values()].find((employee) => employee.staffCode === where.staffCode) ?? null);
        return null;
      },
      async findFirst({ where }: any) {
        const record = [...employees.values()].find((employee) => matchesWhere(employee, where));
        return record ? withAccount(record) : null;
      },
      async updateMany({ where, data }: any) {
        const record = employees.get(where.id);
        if (!record) return { count: 0 };
        employees.set(where.id, { ...record, ...data, updatedAt: new Date("2026-06-09T00:00:00.000Z") });
        return { count: 1 };
      }
    },
    userAccount: {
      async create({ data }: any) {
        const record = {
          id: `acct-${accountSeq++}`,
          email: data.email,
          accountId: data.accountId,
          passwordHash: data.passwordHash,
          role: data.role,
          employeeId: data.employeeId ?? null,
          isActive: data.isActive ?? true,
          lockedUntil: data.lockedUntil ?? null,
          failedLoginCount: data.failedLoginCount ?? 0,
          createdAt: timestamp(accountSeq),
          updatedAt: timestamp(accountSeq)
        };
        accounts.set(record.id, record);
        return record;
      },
      async findUnique({ where }: any) {
        if (where.id) return accounts.get(where.id) ?? null;
        if (where.accountId) return [...accounts.values()].find((account) => account.accountId === where.accountId) ?? null;
        if (where.email) return [...accounts.values()].find((account) => account.email === where.email) ?? null;
        if (where.employeeId) return [...accounts.values()].find((account) => account.employeeId === where.employeeId) ?? null;
        return null;
      },
      async findFirst({ where }: any) {
        return [...accounts.values()].find((account) => matchesWhere(account, where)) ?? null;
      },
      async update({ where, data }: any) {
        const record = accounts.get(where.id);
        if (!record) throw new Error("missing account");
        const updated = { ...record, ...data, updatedAt: new Date("2026-06-09T00:00:00.000Z") };
        accounts.set(where.id, updated);
        return updated;
      }
    },
    auditLog: {
      async create({ data }: any) {
        const record = { id: `audit-${auditEvents.length + 1}`, createdAt: timestamp(0), ...data };
        auditEvents.push(record);
        return record;
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      return callback(client);
    },
    employees,
    accounts,
    auditEvents
  };

  return client;
}

describe("employee service", () => {
  it("rejects blank base salary and invalid calendar dates before service writes", () => {
    const validInput = {
      displayName: "검증 직원",
      staffCode: "VALID-001",
      employeeGroup: "OPERATIONS",
      position: "카운터",
      shiftType: "주간",
      baseSalary: "1000",
      phone: "",
      birthday: "2026-06-01",
      hireDate: "",
      employmentStatus: "재직",
      sortOrder: "100"
    };

    const blankSalary = createEmployeeSchema.safeParse({ ...validInput, baseSalary: "" });
    const impossibleDate = createEmployeeSchema.safeParse({ ...validInput, birthday: "2026-02-31" });

    assert.equal(blankSalary.success, false);
    assert.equal(impossibleDate.success, false);
    if (blankSalary.success || impossibleDate.success) {
      throw new Error("expected schema validation failures");
    }
    assert.equal(blankSalary.error.issues[0]?.message, "기본급을 입력하세요.");
    assert.equal(impossibleDate.error.issues[0]?.message, "유효한 날짜를 입력하세요.");
  });

  it("seeds 5 operations, 4 earcare, and 50 therapist employees idempotently by stable staffCode", async () => {
    const prismaClient = createMemoryPrisma();

    const firstRun = await ensureDefaultEmployees({ actorId: "admin-1", prismaClient });
    const secondRun = await ensureDefaultEmployees({ actorId: "admin-1", prismaClient });
    const employees = await listEmployees({ prismaClient });

    assert.equal(firstRun.length, 59);
    assert.equal(secondRun.length, 0);
    assert.equal(employees.filter((employee) => employee.employeeGroup === "OPERATIONS").length, 5);
    assert.equal(employees.filter((employee) => employee.employeeGroup === "EARCARE").length, 4);
    assert.equal(employees.filter((employee) => employee.employeeGroup === "THERAPIST").length, 50);
    assert.equal(prismaClient.auditEvents.filter((event: any) => event.action === "employee.created").length, 59);
  });

  it("preserves employee id and staffCode when display name changes", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultEmployees({ actorId: "admin-1", prismaClient });
    const before = (await listEmployees({ prismaClient })).find((employee) => employee.staffCode === "THR-001");
    assert.ok(before);

    const after = await updateEmployeeProfile({
      actorId: "admin-1",
      employeeId: before.id,
      displayName: "마사지사1 변경",
      staffCode: before.staffCode,
      employeeGroup: before.employeeGroup,
      position: before.position,
      shiftType: before.shiftType,
      baseSalary: before.baseSalary,
      phone: before.phone,
      birthday: before.birthday,
      hireDate: before.hireDate,
      employmentStatus: before.employmentStatus,
      sortOrder: before.sortOrder,
      prismaClient
    });

    assert.equal(after.id, before.id);
    assert.equal(after.staffCode, "THR-001");
    assert.equal(after.displayName, "마사지사1 변경");
    assert.equal(prismaClient.auditEvents.at(-1).action, "employee.profile_changed");
  });

  it("rejects staffCode changes after employee creation", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultEmployees({ actorId: "admin-1", prismaClient });
    const before = (await listEmployees({ prismaClient })).find((employee) => employee.staffCode === "THR-002");
    assert.ok(before);

    await assert.rejects(
      () =>
        updateEmployeeProfile({
          actorId: "admin-1",
          employeeId: before.id,
          displayName: before.displayName,
          staffCode: "THR-002-CHANGED",
          employeeGroup: before.employeeGroup,
          position: before.position,
          shiftType: before.shiftType,
          baseSalary: before.baseSalary,
          phone: before.phone,
          birthday: before.birthday,
          hireDate: before.hireDate,
          employmentStatus: before.employmentStatus,
          sortOrder: before.sortOrder,
          prismaClient
        }),
      /staff code는 생성 후 변경할 수 없습니다./
    );

    const after = (await listEmployees({ prismaClient })).find((employee) => employee.id === before.id);
    assert.equal(after?.staffCode, "THR-002");
  });

  it("filters inactive employees without physical delete and avoids no-op audit noise", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultEmployees({ actorId: "admin-1", prismaClient });
    const target = (await listEmployees({ prismaClient })).find((employee) => employee.staffCode === "EAR-001");
    assert.ok(target);

    await deactivateEmployee({ actorId: "admin-1", employeeId: target.id, prismaClient });
    const auditCount = prismaClient.auditEvents.length;
    await deactivateEmployee({ actorId: "admin-1", employeeId: target.id, prismaClient });

    assert.equal((await listActiveEmployees({ employeeGroup: "EARCARE", prismaClient })).some((employee) => employee.id === target.id), false);
    assert.equal(prismaClient.employees.has(target.id), true);
    assert.equal(prismaClient.auditEvents.length, auditCount);
    assert.equal(prismaClient.auditEvents.at(-1).action, "employee.deactivated");
  });

  it("normalizes date DTO values to ISO date strings or null and stores plain audit snapshots", async () => {
    const prismaClient = createMemoryPrisma();

    const employee = await createEmployee({
      actorId: "admin-1",
      displayName: "신규 직원",
      staffCode: "CUSTOM-001",
      employeeGroup: "OPERATIONS",
      position: "카운터",
      shiftType: "주간",
      baseSalary: 1000,
      phone: "",
      birthday: "2026-06-01",
      hireDate: "",
      employmentStatus: "재직",
      sortOrder: 900,
      prismaClient
    });

    assert.equal(employee.birthday, "2026-06-01");
    assert.equal(employee.hireDate, null);
    assert.equal(prismaClient.auditEvents.at(-1).afterValue.birthday, "2026-06-01");
    assert.equal(prismaClient.auditEvents.at(-1).afterValue.hireDate, null);
    assert.equal(prismaClient.auditEvents.at(-1).afterValue.birthday instanceof Date, false);
  });

  it("links accounts through UserAccount.employeeId, validates role, hashes secrets with Argon2id, avoids plaintext, and audits role changes separately", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultEmployees({ actorId: "admin-1", prismaClient });
    const employee = (await listEmployees({ prismaClient })).find((entry) => entry.staffCode === "OPS-COUNTER-DAY-001");
    assert.ok(employee);

    const created = await linkUserAccountToEmployee({
      actorId: "admin-1",
      employeeId: employee.id,
      email: "linked@example.local",
      accountId: "linked-counter",
      role: "counter",
      initialSecret: "LinkedCounter!1",
      prismaClient
    });
    const account = prismaClient.accounts.get(created.id);
    assert.equal(account.employeeId, employee.id);
    assert.equal(account.passwordHash.includes("LinkedCounter!1"), false);
    assert.equal(await verifyPassword(account.passwordHash, "LinkedCounter!1"), true);
    assert.equal(prismaClient.auditEvents.at(-1).action, "user_account.linked_to_employee");

    const updated = await linkUserAccountToEmployee({
      actorId: "admin-1",
      employeeId: employee.id,
      email: "linked@example.local",
      accountId: "linked-counter",
      role: "settlement_manager",
      prismaClient
    });
    assert.equal(updated.role, "settlement_manager");
    assert.equal(prismaClient.auditEvents.at(-1).action, "user_account.role_changed");

    const relabeled = await linkUserAccountToEmployee({
      actorId: "admin-1",
      employeeId: employee.id,
      email: "linked-renamed@example.local",
      accountId: "linked-counter-renamed",
      role: "settlement_manager",
      prismaClient
    });
    assert.equal(relabeled.email, "linked-renamed@example.local");
    assert.equal(relabeled.accountId, "linked-counter-renamed");
    assert.equal(prismaClient.auditEvents.at(-1).action, "user_account.linked_to_employee");

    await assert.rejects(
      () =>
        linkUserAccountToEmployee({
          actorId: "admin-1",
          employeeId: employee.id,
          email: "bad@example.local",
          accountId: "bad-role",
          role: "owner",
          initialSecret: "LinkedCounter!1",
          prismaClient
        } as any),
      /계정 역할이 올바르지 않습니다./
    );
  });

  it("rejects account link requests when accountId and email point to different accounts", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultEmployees({ actorId: "admin-1", prismaClient });
    const employee = (await listEmployees({ prismaClient })).find((entry) => entry.staffCode === "OPS-WAITER-DAY-001");
    assert.ok(employee);

    await prismaClient.userAccount.create({
      data: {
        email: "first@example.local",
        accountId: "first-account",
        passwordHash: "hash-1",
        role: "counter",
        employeeId: null
      }
    });
    await prismaClient.userAccount.create({
      data: {
        email: "second@example.local",
        accountId: "second-account",
        passwordHash: "hash-2",
        role: "waiter",
        employeeId: null
      }
    });

    await assert.rejects(
      () =>
        linkUserAccountToEmployee({
          actorId: "admin-1",
          employeeId: employee.id,
          email: "second@example.local",
          accountId: "first-account",
          role: "counter",
          prismaClient
        }),
      /계정 ID와 이메일이 서로 다른 계정에 속합니다./
    );
  });
});
