import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import { assertOperatingMonthPayoutWritable, isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type EmployeeRecord = {
  id: string;
  displayName: string;
  staffCode: string;
  employeeGroup: string;
  position: string;
  sortOrder: number;
  isActive: boolean;
};

type CodeItemRecord = {
  id: string;
  codeType: string;
  code: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
};

type OpsAttendanceRecord = {
  id: string;
  operatingMonthId: string;
  attendanceDate: Date;
  employeeId: string;
  statusCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type OpsAttendancePrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
  employee: {
    findMany(args?: unknown): Promise<EmployeeRecord[]>;
    findUnique(args: unknown): Promise<EmployeeRecord | null>;
  };
  codeItem: {
    findMany(args?: unknown): Promise<CodeItemRecord[]>;
  };
  opsAttendance: {
    findMany(args?: unknown): Promise<OpsAttendanceRecord[]>;
    findUnique(args: unknown): Promise<OpsAttendanceRecord | null>;
    upsert(args: unknown): Promise<OpsAttendanceRecord>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction<T>(callback: (tx: OpsAttendancePrismaClient) => Promise<T>): Promise<T>;
};

export type OpsAttendanceStatusOptionDto = {
  code: string;
  displayName: string;
};

export type OpsAttendanceDto = {
  id: string | null;
  operatingMonthId: string;
  attendanceDate: string;
  employeeId: string;
  staffCode: string;
  displayName: string;
  position: string;
  sortOrder: number;
  statusCode: string;
  statusDisplayName: string;
  isPayoutEligible: boolean;
  exclusionReason: string | null;
};

export type OpsAttendanceForDateDto = {
  operatingMonthId: string;
  attendanceDate: string;
  isLocked: boolean;
  statusOptions: OpsAttendanceStatusOptionDto[];
  rows: OpsAttendanceDto[];
};

export class OpsAttendanceDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "OpsAttendanceDomainError";
  }
}

const attendanceQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "근무일자는 YYYY-MM-DD 형식이어야 합니다.")
});

const attendanceUpsertSchema = attendanceQuerySchema.extend({
  employeeId: z.string().trim().min(1, "운영팀 직원을 선택하세요."),
  statusCode: z.string().trim().min(1, "근무상태를 선택하세요."),
  actorId: z.string().trim().min(1, "행위자 계정이 필요합니다.")
});

function getClient(client?: OpsAttendancePrismaClient) {
  return client ?? (prisma as unknown as OpsAttendancePrismaClient);
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function assertValidParsedDate(value: string) {
  if (toIsoDate(toDate(value)) !== value) {
    throw new OpsAttendanceDomainError("근무일자가 올바르지 않습니다.", "INVALID_OPS_ATTENDANCE_INPUT");
  }
}

function assertDateInOperatingMonth(operatingMonth: OperatingMonthRecord, attendanceDate: string) {
  const startDate = toIsoDate(operatingMonth.startDate);
  const endDate = toIsoDate(operatingMonth.endDate);
  if (attendanceDate < startDate || attendanceDate > endDate) {
    throw new OpsAttendanceDomainError("운영월 범위를 벗어난 날짜입니다.", "OPERATING_MONTH_DATE_OUT_OF_RANGE");
  }
}

function assertUnlocked(operatingMonth: OperatingMonthRecord) {
  try {
    assertOperatingMonthPayoutWritable(operatingMonth, "마감확정 또는 잠금 운영월의 운영팀 근무상태는 수정할 수 없습니다.");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "OPERATING_MONTH_LOCKED") {
      throw new OpsAttendanceDomainError(error.message, "OPERATING_MONTH_LOCKED");
    }
    throw error;
  }
}

function invalidInput(message: string) {
  return new OpsAttendanceDomainError(message, "INVALID_OPS_ATTENDANCE_INPUT");
}

async function loadOperatingMonth(client: OpsAttendancePrismaClient, operatingMonthId: string) {
  const operatingMonth = await client.operatingMonth.findUnique({ where: { id: operatingMonthId } });
  if (!operatingMonth) {
    throw new OpsAttendanceDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }
  return operatingMonth;
}

async function loadAttendanceStatuses(client: OpsAttendancePrismaClient) {
  const statuses = await client.codeItem.findMany({
    where: { codeType: "ATTENDANCE_STATUS", isActive: true },
    orderBy: [{ sortOrder: "asc" }]
  });
  if (statuses.length === 0) {
    throw new OpsAttendanceDomainError("사용 가능한 근무상태 코드가 없습니다.", "ATTENDANCE_STATUS_NOT_FOUND");
  }
  return statuses;
}

function normalStatus(statuses: CodeItemRecord[]) {
  return statuses.find((status) => status.code === "NORMAL") ?? statuses.find((status) => status.displayName === "정상") ?? statuses[0];
}

function statusByCode(statuses: CodeItemRecord[], statusCode: string) {
  return statuses.find((status) => status.code === statusCode) ?? null;
}

function isNormalStatus(status: CodeItemRecord) {
  return status.code === "NORMAL" || status.displayName === "정상";
}

function attendanceSnapshot(record: OpsAttendanceRecord | null): AuditJsonSnapshot | null {
  if (!record) return null;
  return {
    operatingMonthId: record.operatingMonthId,
    attendanceDate: toIsoDate(record.attendanceDate),
    employeeId: record.employeeId,
    statusCode: record.statusCode,
    isActive: record.isActive,
    payoutImpact: true,
    changedAt: record.updatedAt.toISOString()
  };
}

function toDto(input: {
  operatingMonthId: string;
  attendanceDate: string;
  employee: EmployeeRecord;
  status: CodeItemRecord;
  attendance: OpsAttendanceRecord | null;
}): OpsAttendanceDto {
  const payoutEligible = isNormalStatus(input.status);
  return {
    id: input.attendance?.id ?? null,
    operatingMonthId: input.operatingMonthId,
    attendanceDate: input.attendanceDate,
    employeeId: input.employee.id,
    staffCode: input.employee.staffCode,
    displayName: input.employee.displayName,
    position: input.employee.position,
    sortOrder: input.employee.sortOrder,
    statusCode: input.status.code,
    statusDisplayName: input.status.displayName,
    isPayoutEligible: payoutEligible,
    exclusionReason: payoutEligible ? null : input.status.displayName
  };
}

function toFieldError(error: z.ZodError) {
  return invalidInput(error.issues[0]?.message ?? "입력값을 확인하세요.");
}

async function findAttendance(client: OpsAttendancePrismaClient, input: { operatingMonthId: string; attendanceDate: string; employeeId: string }) {
  return client.opsAttendance.findUnique({
    where: {
      operatingMonthId_attendanceDate_employeeId: {
        operatingMonthId: input.operatingMonthId,
        attendanceDate: toDate(input.attendanceDate),
        employeeId: input.employeeId
      }
    }
  });
}

export async function listOpsAttendanceForDate(input: {
  operatingMonthId: string;
  attendanceDate: string;
  prismaClient?: OpsAttendancePrismaClient;
}): Promise<OpsAttendanceForDateDto> {
  const parsed = attendanceQuerySchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.attendanceDate);

  const client = getClient(input.prismaClient);
  const [operatingMonth, employees, statuses, attendances] = await Promise.all([
    loadOperatingMonth(client, parsed.data.operatingMonthId),
    client.employee.findMany({
      where: { employeeGroup: "OPERATIONS", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { staffCode: "asc" }]
    }),
    loadAttendanceStatuses(client),
    client.opsAttendance.findMany({
      where: {
        operatingMonthId: parsed.data.operatingMonthId,
        attendanceDate: toDate(parsed.data.attendanceDate),
        isActive: true
      }
    })
  ]);
  assertDateInOperatingMonth(operatingMonth, parsed.data.attendanceDate);

  const defaultStatus = normalStatus(statuses);
  const attendanceByEmployeeId = new Map(attendances.map((attendance) => [attendance.employeeId, attendance]));
  return {
    operatingMonthId: parsed.data.operatingMonthId,
    attendanceDate: parsed.data.attendanceDate,
    isLocked: isOperatingMonthPayoutLocked(operatingMonth.status),
    statusOptions: statuses.map((status) => ({ code: status.code, displayName: status.displayName })),
    rows: employees.map((employee) => {
      const attendance = attendanceByEmployeeId.get(employee.id) ?? null;
      const status = attendance ? statusByCode(statuses, attendance.statusCode) ?? defaultStatus : defaultStatus;
      return toDto({
        operatingMonthId: parsed.data.operatingMonthId,
        attendanceDate: parsed.data.attendanceDate,
        employee,
        status,
        attendance
      });
    })
  };
}

export async function upsertOpsAttendance(input: {
  operatingMonthId: string;
  attendanceDate: string;
  employeeId: string;
  statusCode: string;
  actorId: string;
  prismaClient?: OpsAttendancePrismaClient;
}): Promise<OpsAttendanceDto> {
  const parsed = attendanceUpsertSchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.attendanceDate);

  const client = getClient(input.prismaClient);
  const [operatingMonth, employee, statuses] = await Promise.all([
    loadOperatingMonth(client, parsed.data.operatingMonthId),
    client.employee.findUnique({ where: { id: parsed.data.employeeId } }),
    loadAttendanceStatuses(client)
  ]);
  assertDateInOperatingMonth(operatingMonth, parsed.data.attendanceDate);
  assertUnlocked(operatingMonth);

  if (!employee || employee.employeeGroup !== "OPERATIONS" || !employee.isActive) {
    throw new OpsAttendanceDomainError("활성 운영팀 직원을 찾을 수 없습니다.", "OPS_EMPLOYEE_NOT_FOUND");
  }

  const status = statusByCode(statuses, parsed.data.statusCode);
  if (!status) {
    throw new OpsAttendanceDomainError("근무상태 코드가 올바르지 않습니다.", "ATTENDANCE_STATUS_NOT_FOUND");
  }

  return client.$transaction(async (tx) => {
    const transactionOperatingMonth = await loadOperatingMonth(tx, parsed.data.operatingMonthId);
    assertDateInOperatingMonth(transactionOperatingMonth, parsed.data.attendanceDate);
    assertUnlocked(transactionOperatingMonth);

    const before = await findAttendance(tx, parsed.data);
    const after = await tx.opsAttendance.upsert({
      where: {
        operatingMonthId_attendanceDate_employeeId: {
          operatingMonthId: parsed.data.operatingMonthId,
          attendanceDate: toDate(parsed.data.attendanceDate),
          employeeId: parsed.data.employeeId
        }
      },
      create: {
        operatingMonthId: parsed.data.operatingMonthId,
        attendanceDate: toDate(parsed.data.attendanceDate),
        employeeId: parsed.data.employeeId,
        statusCode: status.code,
        isActive: true
      },
      update: {
        statusCode: status.code,
        isActive: true
      }
    });

    await recordAuditEvent(
      {
        actorId: parsed.data.actorId,
        action: before ? "ops_attendance.changed" : "ops_attendance.created",
        targetType: "ops_attendance",
        targetId: after.id,
        beforeValue: attendanceSnapshot(before),
        afterValue: attendanceSnapshot(after),
        reason: "payout_affecting"
      },
      { prismaClient: tx as any }
    );

    return toDto({
      operatingMonthId: parsed.data.operatingMonthId,
      attendanceDate: parsed.data.attendanceDate,
      employee,
      status,
      attendance: after
    });
  });
}
