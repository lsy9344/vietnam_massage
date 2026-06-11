import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import {
  createEmployeeSchema,
  deactivateEmployeeSchema,
  defaultEmployees,
  updateEmployeeProfileSchema,
  updateEmployeeSortOrderSchema,
  type EmployeeGroup,
  type EmploymentStatus,
  type ShiftType
} from "@/modules/masters/employee-schema";

export { linkUserAccountToEmployee } from "@/modules/masters/account-service";

type AccountSummary = {
  id: string;
  accountId: string;
  email: string;
  role: string;
  isActive: boolean;
  lockedUntil: Date | null;
};

type EmployeeRecord = {
  id: string;
  displayName: string;
  staffCode: string;
  employeeGroup: string;
  position: string;
  shiftType: string | null;
  baseSalary: number;
  phone: string | null;
  birthday: Date | null;
  hireDate: Date | null;
  employmentStatus: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  account?: AccountSummary | null;
};

type EmployeePrismaClient = {
  employee: {
    create(args: unknown): Promise<EmployeeRecord>;
    findMany(args?: unknown): Promise<EmployeeRecord[]>;
    findUnique(args: unknown): Promise<EmployeeRecord | null>;
    findFirst(args: unknown): Promise<EmployeeRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction?<T>(callback: (tx: EmployeePrismaClient) => Promise<T>): Promise<T>;
};

export type EmployeeDto = {
  id: string;
  displayName: string;
  staffCode: string;
  employeeGroup: EmployeeGroup;
  position: string;
  shiftType: ShiftType | null;
  baseSalary: number;
  phone: string | null;
  birthday: string | null;
  hireDate: string | null;
  employmentStatus: EmploymentStatus;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  account: {
    id: string;
    accountId: string;
    email: string;
    role: string;
    isActive: boolean;
    lockedUntil: string | null;
  } | null;
};

type EmployeeMutationBase = {
  actorId: string;
  prismaClient?: EmployeePrismaClient;
};

export type CreateEmployeeInput = EmployeeMutationBase & {
  displayName: string;
  staffCode: string;
  employeeGroup: EmployeeGroup;
  position: string;
  shiftType: ShiftType | null;
  baseSalary: number;
  phone?: string | null;
  birthday?: string | null;
  hireDate?: string | null;
  employmentStatus: EmploymentStatus;
  sortOrder: number;
};

export type UpdateEmployeeProfileInput = CreateEmployeeInput & {
  employeeId: string;
};

export type UpdateEmployeeSortOrderInput = EmployeeMutationBase & {
  employeeId: string;
  sortOrder: number;
};

export type EmployeeMutationInput = EmployeeMutationBase & {
  employeeId: string;
};

export class EmployeeDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "EmployeeDomainError";
  }
}

function getClient(client?: EmployeePrismaClient) {
  return client ?? (prisma as unknown as EmployeePrismaClient);
}

async function runInTransaction<T>(client: EmployeePrismaClient, callback: (tx: EmployeePrismaClient) => Promise<T>) {
  if (client.$transaction) {
    return client.$transaction(callback);
  }

  return callback(client);
}

function normalizeParseError(message: string) {
  return new EmployeeDomainError(message, "INVALID_EMPLOYEE_INPUT");
}

function toDbDate(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function toIsoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function assertEmployeeGroup(value: string): asserts value is EmployeeGroup {
  if (!["OPERATIONS", "EARCARE", "THERAPIST"].includes(value)) {
    throw new EmployeeDomainError("직원 그룹이 올바르지 않습니다.", "INVALID_EMPLOYEE_GROUP");
  }
}

function assertShiftType(value: string | null): asserts value is ShiftType | null {
  if (value !== null && !["전체", "주간", "야간"].includes(value)) {
    throw new EmployeeDomainError("주/야간 값이 올바르지 않습니다.", "INVALID_SHIFT_TYPE");
  }
}

function assertEmploymentStatus(value: string): asserts value is EmploymentStatus {
  if (!["재직", "퇴사", "휴직"].includes(value)) {
    throw new EmployeeDomainError("재직상태가 올바르지 않습니다.", "INVALID_EMPLOYMENT_STATUS");
  }
}

function toDto(record: EmployeeRecord, options: { tolerateInvalidEnums?: boolean } = {}): EmployeeDto {
  // 쓰기/감사 경로는 enum invariant를 강제하고, 조회 경로(tolerateInvalidEnums)는
  // 비표준 값 단일 row가 전체 목록/페이지를 깨뜨리지 않도록 통과시킨다.
  if (!options.tolerateInvalidEnums) {
    assertEmployeeGroup(record.employeeGroup);
    assertShiftType(record.shiftType);
    assertEmploymentStatus(record.employmentStatus);
  }

  return {
    id: record.id,
    displayName: record.displayName,
    staffCode: record.staffCode,
    employeeGroup: record.employeeGroup as EmployeeGroup,
    position: record.position,
    shiftType: record.shiftType as ShiftType | null,
    baseSalary: record.baseSalary,
    phone: record.phone,
    birthday: toIsoDate(record.birthday),
    hireDate: toIsoDate(record.hireDate),
    employmentStatus: record.employmentStatus as EmploymentStatus,
    sortOrder: record.sortOrder,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    account: record.account
      ? {
          id: record.account.id,
          accountId: record.account.accountId,
          email: record.account.email,
          role: record.account.role,
          isActive: record.account.isActive,
          lockedUntil: record.account.lockedUntil ? record.account.lockedUntil.toISOString() : null
        }
      : null
  };
}

function toAuditSnapshot(dto: EmployeeDto): AuditJsonSnapshot {
  return {
    id: dto.id,
    displayName: dto.displayName,
    staffCode: dto.staffCode,
    employeeGroup: dto.employeeGroup,
    position: dto.position,
    shiftType: dto.shiftType,
    baseSalary: dto.baseSalary,
    phone: dto.phone,
    birthday: dto.birthday,
    hireDate: dto.hireDate,
    employmentStatus: dto.employmentStatus,
    sortOrder: dto.sortOrder,
    isActive: dto.isActive,
    accountId: dto.account?.id ?? null
  };
}

function profileSnapshot(dto: EmployeeDto) {
  return JSON.stringify({
    displayName: dto.displayName,
    staffCode: dto.staffCode,
    employeeGroup: dto.employeeGroup,
    position: dto.position,
    shiftType: dto.shiftType,
    baseSalary: dto.baseSalary,
    phone: dto.phone,
    birthday: dto.birthday,
    hireDate: dto.hireDate,
    employmentStatus: dto.employmentStatus,
    sortOrder: dto.sortOrder
  });
}

async function findEmployeeOrThrow(tx: EmployeePrismaClient, employeeId: string) {
  const record = await tx.employee.findUnique({
    where: { id: employeeId },
    include: { account: true }
  });
  if (!record) {
    throw new EmployeeDomainError("직원을 찾을 수 없습니다.", "EMPLOYEE_NOT_FOUND");
  }
  return record;
}

async function assertNoEmployeeConflict(
  tx: EmployeePrismaClient,
  input: { employeeGroup: EmployeeGroup; staffCode?: string; sortOrder?: number; excludeId?: string }
) {
  if (input.staffCode) {
    const conflict = await tx.employee.findFirst({
      where: { staffCode: input.staffCode, ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}) }
    });
    if (conflict) {
      throw new EmployeeDomainError("이미 사용 중인 staff code입니다.", "DUPLICATE_EMPLOYEE_STAFF_CODE");
    }
  }

  if (typeof input.sortOrder === "number") {
    const conflict = await tx.employee.findFirst({
      where: {
        employeeGroup: input.employeeGroup,
        sortOrder: input.sortOrder,
        ...(input.excludeId ? { NOT: { id: input.excludeId } } : {})
      }
    });
    if (conflict) {
      throw new EmployeeDomainError("같은 그룹에서 정렬 순서가 이미 사용 중입니다.", "DUPLICATE_EMPLOYEE_SORT_ORDER");
    }
  }
}

async function recordEmployeeAudit(
  tx: EmployeePrismaClient,
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
      targetType: "employee",
      targetId: input.targetId,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue
    },
    { prismaClient: tx as any }
  );
}

function employeeData(input: Omit<CreateEmployeeInput, "actorId" | "prismaClient">) {
  return {
    displayName: input.displayName,
    staffCode: input.staffCode,
    employeeGroup: input.employeeGroup,
    position: input.position,
    shiftType: input.shiftType,
    baseSalary: input.baseSalary,
    phone: input.phone ?? null,
    birthday: toDbDate(input.birthday),
    hireDate: toDbDate(input.hireDate),
    employmentStatus: input.employmentStatus,
    sortOrder: input.sortOrder
  };
}

export async function ensureDefaultEmployees(input: { actorId: string; prismaClient?: EmployeePrismaClient }) {
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const created: EmployeeDto[] = [];

    for (const employee of defaultEmployees) {
      const existing = await tx.employee.findUnique({ where: { staffCode: employee.staffCode }, include: { account: true } });
      if (existing) {
        continue;
      }

      const record = await tx.employee.create({
        data: {
          ...employee,
          phone: null,
          birthday: null,
          hireDate: null,
          isActive: true
        },
        include: { account: true }
      });
      const dto = toDto(record);
      created.push(dto);

      await recordEmployeeAudit(tx, {
        actorId: input.actorId,
        action: "employee.created",
        targetId: dto.id,
        beforeValue: null,
        afterValue: toAuditSnapshot(dto)
      });
    }

    return created;
  });
}

export async function listEmployees(options: { prismaClient?: EmployeePrismaClient } = {}) {
  const records = await getClient(options.prismaClient).employee.findMany({
    include: { account: true },
    orderBy: [{ employeeGroup: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return records.map((record) => toDto(record, { tolerateInvalidEnums: true }));
}

export async function listActiveEmployees(options: { employeeGroup?: EmployeeGroup; prismaClient?: EmployeePrismaClient } = {}) {
  const records = await getClient(options.prismaClient).employee.findMany({
    where: { isActive: true, ...(options.employeeGroup ? { employeeGroup: options.employeeGroup } : {}) },
    include: { account: true },
    orderBy: [{ employeeGroup: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return records.map((record) => toDto(record, { tolerateInvalidEnums: true }));
}

export async function createEmployee(input: CreateEmployeeInput) {
  const parsed = createEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "직원 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    await assertNoEmployeeConflict(tx, {
      staffCode: parsed.data.staffCode,
      employeeGroup: parsed.data.employeeGroup,
      sortOrder: parsed.data.sortOrder
    });

    const record = await tx.employee.create({
      data: {
        ...employeeData(parsed.data),
        isActive: true
      },
      include: { account: true }
    });
    const dto = toDto(record);

    await recordEmployeeAudit(tx, {
      actorId: input.actorId,
      action: "employee.created",
      targetId: dto.id,
      beforeValue: null,
      afterValue: toAuditSnapshot(dto)
    });

    return dto;
  });
}

export async function updateEmployeeProfile(input: UpdateEmployeeProfileInput) {
  const parsed = updateEmployeeProfileSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "직원 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findEmployeeOrThrow(tx, parsed.data.employeeId);
    const before = toDto(currentRecord);

    if (parsed.data.staffCode !== before.staffCode) {
      throw new EmployeeDomainError("staff code는 생성 후 변경할 수 없습니다.", "IMMUTABLE_EMPLOYEE_STAFF_CODE");
    }

    await assertNoEmployeeConflict(tx, {
      employeeGroup: parsed.data.employeeGroup,
      sortOrder: parsed.data.sortOrder,
      excludeId: parsed.data.employeeId
    });

    const nextProfile = {
      ...before,
      ...parsed.data,
      phone: parsed.data.phone ?? null,
      birthday: parsed.data.birthday,
      hireDate: parsed.data.hireDate
    };
    if (profileSnapshot(before) === profileSnapshot(nextProfile)) {
      return before;
    }

    const updateResult = await tx.employee.updateMany({
      where: { id: parsed.data.employeeId },
      data: employeeData(parsed.data)
    });
    if (updateResult.count !== 1) {
      throw new EmployeeDomainError("직원을 찾을 수 없습니다.", "EMPLOYEE_NOT_FOUND");
    }

    const updatedRecord = await findEmployeeOrThrow(tx, parsed.data.employeeId);
    const after = toDto(updatedRecord);

    await recordEmployeeAudit(tx, {
      actorId: input.actorId,
      action: "employee.profile_changed",
      targetId: after.id,
      beforeValue: toAuditSnapshot(before),
      afterValue: toAuditSnapshot(after)
    });

    return after;
  });
}

export async function updateEmployeeSortOrder(input: UpdateEmployeeSortOrderInput) {
  const parsed = updateEmployeeSortOrderSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "직원 정렬 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findEmployeeOrThrow(tx, parsed.data.employeeId);
    const before = toDto(currentRecord);
    await assertNoEmployeeConflict(tx, {
      employeeGroup: before.employeeGroup,
      sortOrder: parsed.data.sortOrder,
      excludeId: parsed.data.employeeId
    });

    if (before.sortOrder === parsed.data.sortOrder) {
      return before;
    }

    const updateResult = await tx.employee.updateMany({
      where: { id: parsed.data.employeeId },
      data: { sortOrder: parsed.data.sortOrder }
    });
    if (updateResult.count !== 1) {
      throw new EmployeeDomainError("직원을 찾을 수 없습니다.", "EMPLOYEE_NOT_FOUND");
    }

    const after = toDto(await findEmployeeOrThrow(tx, parsed.data.employeeId));
    await recordEmployeeAudit(tx, {
      actorId: input.actorId,
      action: "employee.sort_order_changed",
      targetId: after.id,
      beforeValue: toAuditSnapshot(before),
      afterValue: toAuditSnapshot(after)
    });

    return after;
  });
}

export async function deactivateEmployee(input: EmployeeMutationInput) {
  const parsed = deactivateEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "직원 비활성 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findEmployeeOrThrow(tx, parsed.data.employeeId);
    const before = toDto(currentRecord);
    if (!before.isActive) {
      return before;
    }

    const updateResult = await tx.employee.updateMany({
      where: { id: parsed.data.employeeId },
      data: { isActive: false }
    });
    if (updateResult.count !== 1) {
      throw new EmployeeDomainError("직원을 찾을 수 없습니다.", "EMPLOYEE_NOT_FOUND");
    }

    const after = toDto(await findEmployeeOrThrow(tx, parsed.data.employeeId));
    await recordEmployeeAudit(tx, {
      actorId: input.actorId,
      action: "employee.deactivated",
      targetId: after.id,
      beforeValue: toAuditSnapshot(before),
      afterValue: toAuditSnapshot(after)
    });

    return after;
  });
}
