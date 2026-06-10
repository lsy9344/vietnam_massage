import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";

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

type EarcareAttendanceRecord = {
  id: string;
  operatingMonthId: string;
  attendanceDate: Date;
  employeeId: string;
  statusCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type EarcareAttendancePrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
  employee: {
    findMany(args?: unknown): Promise<EmployeeRecord[]>;
    findUnique(args: unknown): Promise<EmployeeRecord | null>;
  };
  codeItem: {
    findMany(args?: unknown): Promise<CodeItemRecord[]>;
    findFirst(args?: unknown): Promise<CodeItemRecord | null>;
  };
  earcareAttendance: {
    findMany(args?: unknown): Promise<EarcareAttendanceRecord[]>;
    findUnique(args: unknown): Promise<EarcareAttendanceRecord | null>;
    upsert(args: unknown): Promise<EarcareAttendanceRecord>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction<T>(callback: (tx: EarcareAttendancePrismaClient) => Promise<T>): Promise<T>;
};

export type AttendanceStatusOptionDto = {
  code: string;
  displayName: string;
};

export type EarcareAttendanceDto = {
  id: string | null;
  operatingMonthId: string;
  attendanceDate: string;
  employeeId: string;
  staffCode: string;
  displayName: string;
  statusCode: string;
  statusDisplayName: string;
  isPayoutEligible: boolean;
  exclusionReason: string | null;
};

export type EarcareAttendanceForDateDto = {
  operatingMonthId: string;
  attendanceDate: string;
  isLocked: boolean;
  statusOptions: AttendanceStatusOptionDto[];
  rows: EarcareAttendanceDto[];
};

export class EarcareAttendanceDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "EarcareAttendanceDomainError";
  }
}

const attendanceQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "근무일자는 YYYY-MM-DD 형식이어야 합니다.")
});

const attendanceUpsertSchema = attendanceQuerySchema.extend({
  employeeId: z.string().trim().min(1, "귀케어사를 선택하세요."),
  statusCode: z.string().trim().min(1, "근무상태를 선택하세요."),
  actorId: z.string().trim().min(1, "행위자 계정이 필요합니다.")
});

function getClient(client?: EarcareAttendancePrismaClient) {
  return client ?? (prisma as unknown as EarcareAttendancePrismaClient);
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function assertValidParsedDate(value: string) {
  if (toIsoDate(toDate(value)) !== value) {
    throw new EarcareAttendanceDomainError("근무일자가 올바르지 않습니다.", "INVALID_EARCARE_ATTENDANCE_INPUT");
  }
}

function assertDateInOperatingMonth(operatingMonth: OperatingMonthRecord, attendanceDate: string) {
  const startDate = toIsoDate(operatingMonth.startDate);
  const endDate = toIsoDate(operatingMonth.endDate);
  if (attendanceDate < startDate || attendanceDate > endDate) {
    throw new EarcareAttendanceDomainError("운영월 범위를 벗어난 날짜입니다.", "OPERATING_MONTH_DATE_OUT_OF_RANGE");
  }
}

function assertUnlocked(operatingMonth: OperatingMonthRecord) {
  if (operatingMonth.status === "잠금") {
    throw new EarcareAttendanceDomainError("잠긴 운영월의 귀케어 근무상태는 수정할 수 없습니다.", "OPERATING_MONTH_LOCKED");
  }
}

function invalidInput(message: string) {
  return new EarcareAttendanceDomainError(message, "INVALID_EARCARE_ATTENDANCE_INPUT");
}

async function loadOperatingMonth(client: EarcareAttendancePrismaClient, operatingMonthId: string) {
  const operatingMonth = await client.operatingMonth.findUnique({ where: { id: operatingMonthId } });
  if (!operatingMonth) {
    throw new EarcareAttendanceDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }
  return operatingMonth;
}

async function loadAttendanceStatuses(client: EarcareAttendancePrismaClient) {
  const statuses = await client.codeItem.findMany({
    where: { codeType: "ATTENDANCE_STATUS", isActive: true },
    orderBy: [{ sortOrder: "asc" }]
  });
  if (statuses.length === 0) {
    throw new EarcareAttendanceDomainError("사용 가능한 근무상태 코드가 없습니다.", "ATTENDANCE_STATUS_NOT_FOUND");
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

function attendanceSnapshot(record: EarcareAttendanceRecord | null): AuditJsonSnapshot | null {
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
  attendance: EarcareAttendanceRecord | null;
}): EarcareAttendanceDto {
  const payoutEligible = isNormalStatus(input.status);
  return {
    id: input.attendance?.id ?? null,
    operatingMonthId: input.operatingMonthId,
    attendanceDate: input.attendanceDate,
    employeeId: input.employee.id,
    staffCode: input.employee.staffCode,
    displayName: input.employee.displayName,
    statusCode: input.status.code,
    statusDisplayName: input.status.displayName,
    isPayoutEligible: payoutEligible,
    exclusionReason: payoutEligible ? null : input.status.displayName
  };
}

function toFieldError(error: z.ZodError) {
  return invalidInput(error.issues[0]?.message ?? "입력값을 확인하세요.");
}

async function findAttendance(client: EarcareAttendancePrismaClient, input: { operatingMonthId: string; attendanceDate: string; employeeId: string }) {
  return client.earcareAttendance.findUnique({
    where: {
      operatingMonthId_attendanceDate_employeeId: {
        operatingMonthId: input.operatingMonthId,
        attendanceDate: toDate(input.attendanceDate),
        employeeId: input.employeeId
      }
    }
  });
}

export async function listEarcareAttendanceForDate(input: {
  operatingMonthId: string;
  attendanceDate: string;
  prismaClient?: EarcareAttendancePrismaClient;
}): Promise<EarcareAttendanceForDateDto> {
  const parsed = attendanceQuerySchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.attendanceDate);

  const client = getClient(input.prismaClient);
  const [operatingMonth, employees, statuses, attendances] = await Promise.all([
    loadOperatingMonth(client, parsed.data.operatingMonthId),
    client.employee.findMany({
      where: { employeeGroup: "EARCARE", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { staffCode: "asc" }]
    }),
    loadAttendanceStatuses(client),
    client.earcareAttendance.findMany({
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
    isLocked: operatingMonth.status === "잠금",
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

export async function upsertEarcareAttendance(input: {
  operatingMonthId: string;
  attendanceDate: string;
  employeeId: string;
  statusCode: string;
  actorId: string;
  prismaClient?: EarcareAttendancePrismaClient;
}): Promise<EarcareAttendanceDto> {
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

  if (!employee || employee.employeeGroup !== "EARCARE" || !employee.isActive) {
    throw new EarcareAttendanceDomainError("활성 귀케어사를 찾을 수 없습니다.", "EARCARE_EMPLOYEE_NOT_FOUND");
  }

  const status = statusByCode(statuses, parsed.data.statusCode);
  if (!status) {
    throw new EarcareAttendanceDomainError("근무상태 코드가 올바르지 않습니다.", "ATTENDANCE_STATUS_NOT_FOUND");
  }

  return client.$transaction(async (tx) => {
    const transactionOperatingMonth = await loadOperatingMonth(tx, parsed.data.operatingMonthId);
    assertDateInOperatingMonth(transactionOperatingMonth, parsed.data.attendanceDate);
    assertUnlocked(transactionOperatingMonth);

    const before = await findAttendance(tx, parsed.data);
    const after = await tx.earcareAttendance.upsert({
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
        action: before ? "earcare_attendance.changed" : "earcare_attendance.created",
        targetType: "earcare_attendance",
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
