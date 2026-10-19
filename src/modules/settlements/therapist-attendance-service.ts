import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { IN_USE_SERVICE_CALL_STATUSES } from "@/modules/calls/service-call-service";
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
  sortOrder: number;
  isActive: boolean;
};

type TherapistAttendanceRecord = {
  id: string;
  operatingMonthId: string;
  attendanceDate: Date;
  employeeId: string;
  checkInMinute: number;
  checkInMethod: string;
  checkOutMinute: number | null;
  checkOutMethod: string | null;
  standbyMinutes: number | null;
  isFullAttendanceRecognized: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type InServiceCallRecord = {
  id: string;
  assignments: Array<{ employeeId: string; assignmentRole: string; isActive: boolean }>;
};

type TherapistAttendancePrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
  employee: {
    findMany(args?: unknown): Promise<EmployeeRecord[]>;
    findUnique(args: unknown): Promise<EmployeeRecord | null>;
  };
  therapistAttendance: {
    findMany(args?: unknown): Promise<TherapistAttendanceRecord[]>;
    findUnique(args: unknown): Promise<TherapistAttendanceRecord | null>;
    upsert(args: unknown): Promise<TherapistAttendanceRecord>;
    update(args: unknown): Promise<TherapistAttendanceRecord>;
  };
  serviceCall: {
    findMany(args?: unknown): Promise<InServiceCallRecord[]>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $executeRawUnsafe?(query: string, ...values: unknown[]): Promise<unknown>;
  $transaction<T>(callback: (tx: TherapistAttendancePrismaClient) => Promise<T>): Promise<T>;
};

// 퇴근이 저장됐는데 그날 그 Therapist의 사용중 콜이 있다. 저장은 막지 않고 콜도 바꾸지 않는다.
export type TherapistAttendanceWarning = { code: "IN_SERVICE_CALL"; serviceCallIds: string[] };

// 출근·퇴근에 찍힌 방식(스펙 D16, M23). 05(직접 찍기)·06(근태 달력)·09(정정 승인)·11(현황)이
// 이 상수와 타입을 그대로 쓴다. "이전 기록"은 이 칸이 생기기 전 기록에만 쓰고(가정, D16),
// 저장 액션은 넘기지 않는다(liveTherapistAttendanceMethods 참고).
export const therapistAttendanceMethods = ["직접", "대리 입력", "정정 승인", "이전 기록"] as const;
export type TherapistAttendanceMethod = (typeof therapistAttendanceMethods)[number];
export const legacyTherapistAttendanceMethod: TherapistAttendanceMethod = "이전 기록";

// 저장 액션(upsertTherapistAttendance)이 넘길 수 있는 방식. 직접 찍기는 "직접"(05),
// 기존 출퇴근 화면은 "대리 입력"(이 티켓), 정정 승인은 "정정 승인"(09)을 넘긴다.
export const liveTherapistAttendanceMethods = ["직접", "대리 입력", "정정 승인"] as const;
export type LiveTherapistAttendanceMethod = (typeof liveTherapistAttendanceMethods)[number];

export type TherapistAttendanceDto = {
  id: string | null;
  operatingMonthId: string;
  attendanceDate: string;
  employeeId: string;
  staffCode: string;
  displayName: string;
  sortOrder: number;
  checkInTime: string | null;
  checkInMethod: TherapistAttendanceMethod | null;
  checkOutTime: string | null;
  checkOutMethod: TherapistAttendanceMethod | null;
  standbyMinutes: number | null;
  isFullAttendanceRecognized: boolean;
  isComplete: boolean;
  incompleteReason: string | null;
  isLocked: boolean;
  warnings: TherapistAttendanceWarning[];
};

export type TherapistAttendanceForDateDto = {
  operatingMonthId: string;
  attendanceDate: string;
  isLocked: boolean;
  rows: TherapistAttendanceDto[];
};

export type TherapistFullAttendanceRecognitionResultDto = {
  sourceStatus: "available";
  sourceDayCount: number;
  rows: Array<{
    employeeId: string;
    fullAttendanceDays: number;
  }>;
};

export type TherapistAttendanceErrorField = "operatingMonthId" | "attendanceDate" | "employeeId" | "checkInTime" | "checkOutTime";

export class TherapistAttendanceDomainError extends Error {
  constructor(message: string, public readonly code: string, public readonly field?: TherapistAttendanceErrorField) {
    super(message);
    this.name = "TherapistAttendanceDomainError";
  }
}

// Full attendance is recognized when standby >= 10 hours (600 minutes).
// Kept in sync with the DB CHECK constraint chk_therapist_attendances_full_attendance_consistent.
const FULL_ATTENDANCE_STANDBY_MINUTES = 600;
const MINUTES_PER_DAY = 1440;

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const attendanceQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "근무일자는 YYYY-MM-DD 형식이어야 합니다.")
});

// checkOutTime is optional: an empty value stores a check-in-only row (퇴근 미입력)
// whose standby/full-attendance judgment stays unset until checkout is saved.
const attendanceUpsertSchema = attendanceQuerySchema.extend({
  employeeId: z.string().trim().min(1, "마사지사를 선택하세요."),
  checkInTime: z.string().regex(timeRegex, "출근시간은 HH:mm 형식이어야 합니다."),
  checkOutTime: z
    .string()
    .trim()
    .refine((value) => value === "" || timeRegex.test(value), "퇴근시간은 HH:mm 형식이어야 합니다."),
  // 이 호출이 (바뀐 쪽에) 남기는 방식. "이전 기록"은 받지 않는다(마이그레이션 백필 전용).
  method: z.enum(liveTherapistAttendanceMethods, { error: "출퇴근 방식을 확인하세요." }),
  actorId: z.string().trim().min(1, "행위자 계정이 필요합니다.")
});

const attendanceDeactivateSchema = attendanceQuerySchema.extend({
  employeeId: z.string().trim().min(1, "마사지사를 선택하세요."),
  actorId: z.string().trim().min(1, "행위자 계정이 필요합니다.")
});

const recognitionQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "시작일은 YYYY-MM-DD 형식이어야 합니다."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "종료일은 YYYY-MM-DD 형식이어야 합니다.")
});

function getClient(client?: TherapistAttendancePrismaClient) {
  return client ?? (prisma as unknown as TherapistAttendancePrismaClient);
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

const errorFields: readonly TherapistAttendanceErrorField[] = [
  "operatingMonthId",
  "attendanceDate",
  "employeeId",
  "checkInTime",
  "checkOutTime"
];

function asErrorField(path: PropertyKey | undefined): TherapistAttendanceErrorField | undefined {
  return errorFields.find((field) => field === path);
}

function invalidInput(message: string, field?: TherapistAttendanceErrorField) {
  return new TherapistAttendanceDomainError(message, "INVALID_THERAPIST_ATTENDANCE_INPUT", field);
}

function toFieldError(error: z.ZodError) {
  const issue = error.issues[0];
  return invalidInput(issue?.message ?? "입력값을 확인하세요.", asErrorField(issue?.path[0]));
}

function assertValidParsedDate(value: string) {
  if (toIsoDate(toDate(value)) !== value) {
    throw invalidInput("근무일자가 올바르지 않습니다.", "attendanceDate");
  }
}

// Service-local pure helper. UI may render HH:mm, but minute-of-day is the source of truth.
function timeToMinute(value: string, field?: TherapistAttendanceErrorField) {
  const match = timeRegex.exec(value);
  if (!match) {
    throw invalidInput("시간은 HH:mm 형식이어야 합니다.", field);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function minuteToTime(minute: number) {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Overnight checkout: checkOutMinute < checkInMinute means the next-day checkout, so add 1440.
// Equal minutes mean a 0-minute standby. Standby is never negative.
function computeStandbyMinutes(checkInMinute: number, checkOutMinute: number) {
  const normalizedCheckOut = checkOutMinute < checkInMinute ? checkOutMinute + MINUTES_PER_DAY : checkOutMinute;
  return normalizedCheckOut - checkInMinute;
}

function isFullAttendance(standbyMinutes: number) {
  return standbyMinutes >= FULL_ATTENDANCE_STANDBY_MINUTES;
}

// 바뀐 쪽만 방식이 바뀐다(스펙 M23). 이전 줄이 없거나 비활성(지워짐)이면 새로 찍는 것과 같다.
function resolveCheckInMethod(input: {
  method: LiveTherapistAttendanceMethod;
  before: TherapistAttendanceRecord | null;
  checkInMinute: number;
}): TherapistAttendanceMethod {
  const before = input.before;
  if (!before || !before.isActive || before.checkInMinute !== input.checkInMinute) {
    return input.method;
  }
  return before.checkInMethod as TherapistAttendanceMethod;
}

// 퇴근을 지우면 방식도 비운다. 퇴근 시각이 새로 생기거나 바뀌면 이 호출의 방식이 되고,
// 그대로면 기존 방식을 지킨다(스펙 M23).
function resolveCheckOutMethod(input: {
  method: LiveTherapistAttendanceMethod;
  before: TherapistAttendanceRecord | null;
  checkOutMinute: number | null;
}): TherapistAttendanceMethod | null {
  if (input.checkOutMinute === null) return null;
  const before = input.before;
  if (!before || !before.isActive || before.checkOutMinute !== input.checkOutMinute) {
    return input.method;
  }
  return (before.checkOutMethod as TherapistAttendanceMethod | null) ?? input.method;
}

function assertDateInOperatingMonth(operatingMonth: OperatingMonthRecord, attendanceDate: string) {
  const startDate = toIsoDate(operatingMonth.startDate);
  const endDate = toIsoDate(operatingMonth.endDate);
  if (attendanceDate < startDate || attendanceDate > endDate) {
    throw new TherapistAttendanceDomainError("운영월 범위를 벗어난 날짜입니다.", "OPERATING_MONTH_DATE_OUT_OF_RANGE");
  }
}

function assertUnlocked(operatingMonth: OperatingMonthRecord) {
  try {
    assertOperatingMonthPayoutWritable(operatingMonth, "마감확정 또는 잠금 운영월의 출퇴근 시간은 수정할 수 없습니다.");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "OPERATING_MONTH_LOCKED") {
      throw new TherapistAttendanceDomainError(error.message, "OPERATING_MONTH_LOCKED");
    }
    throw error;
  }
}

async function loadOperatingMonth(client: TherapistAttendancePrismaClient, operatingMonthId: string) {
  const operatingMonth = await client.operatingMonth.findUnique({ where: { id: operatingMonthId } });
  if (!operatingMonth) {
    throw new TherapistAttendanceDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }
  return operatingMonth;
}

async function loadActiveTherapist(client: TherapistAttendancePrismaClient, employeeId: string) {
  const employee = await client.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.employeeGroup !== "THERAPIST" || !employee.isActive) {
    throw new TherapistAttendanceDomainError("활성 마사지사를 찾을 수 없습니다.", "THERAPIST_EMPLOYEE_NOT_FOUND");
  }
  return employee;
}

function attendanceSnapshot(record: TherapistAttendanceRecord | null): AuditJsonSnapshot | null {
  if (!record) return null;
  return {
    operatingMonthId: record.operatingMonthId,
    attendanceDate: toIsoDate(record.attendanceDate),
    employeeId: record.employeeId,
    checkInMinute: record.checkInMinute,
    checkInMethod: record.checkInMethod,
    checkOutMinute: record.checkOutMinute,
    checkOutMethod: record.checkOutMethod,
    standbyMinutes: record.standbyMinutes,
    isFullAttendanceRecognized: record.isFullAttendanceRecognized,
    isActive: record.isActive,
    payoutImpact: true,
    changedAt: record.updatedAt.toISOString()
  };
}

function toDto(input: {
  operatingMonthId: string;
  attendanceDate: string;
  employee: EmployeeRecord;
  attendance: TherapistAttendanceRecord | null;
  isLocked: boolean;
  inServiceCallIds: string[];
}): TherapistAttendanceDto {
  const active = input.attendance?.isActive ? input.attendance : null;
  const hasCheckout = active !== null && active.checkOutMinute !== null;
  const isComplete = hasCheckout;
  const warnings: TherapistAttendanceWarning[] =
    hasCheckout && input.inServiceCallIds.length > 0 ? [{ code: "IN_SERVICE_CALL", serviceCallIds: input.inServiceCallIds }] : [];
  return {
    id: active?.id ?? null,
    operatingMonthId: input.operatingMonthId,
    attendanceDate: input.attendanceDate,
    employeeId: input.employee.id,
    staffCode: input.employee.staffCode,
    displayName: input.employee.displayName,
    sortOrder: input.employee.sortOrder,
    checkInTime: active ? minuteToTime(active.checkInMinute) : null,
    checkInMethod: active ? (active.checkInMethod as TherapistAttendanceMethod) : null,
    checkOutTime: active && active.checkOutMinute !== null ? minuteToTime(active.checkOutMinute) : null,
    checkOutMethod: active && active.checkOutMethod !== null ? (active.checkOutMethod as TherapistAttendanceMethod) : null,
    standbyMinutes: active ? active.standbyMinutes : null,
    isFullAttendanceRecognized: active ? active.isFullAttendanceRecognized : false,
    isComplete,
    incompleteReason: active === null ? "출퇴근 미입력" : hasCheckout ? null : "퇴근 미입력",
    isLocked: input.isLocked,
    warnings
  };
}

// 그날 Therapist 1·2로 배정된 사용중 콜 id를 Therapist별로 모은다.
async function loadInServiceCallIdsByTherapist(
  client: TherapistAttendancePrismaClient,
  input: { operatingMonthId: string; attendanceDate: string }
) {
  const calls = await client.serviceCall.findMany({
    where: {
      operatingMonthId: input.operatingMonthId,
      serviceDate: toDate(input.attendanceDate),
      status: { in: [...IN_USE_SERVICE_CALL_STATUSES] }
    },
    select: { id: true, assignments: { select: { employeeId: true, assignmentRole: true, isActive: true } } },
    orderBy: { createdAt: "asc" }
  });
  const idsByTherapist = new Map<string, string[]>();
  for (const call of calls) {
    for (const assignment of call.assignments) {
      if (!assignment.isActive) continue;
      if (assignment.assignmentRole !== "THERAPIST_1" && assignment.assignmentRole !== "THERAPIST_2") continue;
      const ids = idsByTherapist.get(assignment.employeeId) ?? [];
      if (!ids.includes(call.id)) ids.push(call.id);
      idsByTherapist.set(assignment.employeeId, ids);
    }
  }
  return idsByTherapist;
}

async function findAttendance(
  client: TherapistAttendancePrismaClient,
  input: { operatingMonthId: string; attendanceDate: string; employeeId: string }
) {
  return client.therapistAttendance.findUnique({
    where: {
      operatingMonthId_attendanceDate_employeeId: {
        operatingMonthId: input.operatingMonthId,
        attendanceDate: toDate(input.attendanceDate),
        employeeId: input.employeeId
      }
    }
  });
}

async function lockAttendanceKey(
  client: TherapistAttendancePrismaClient,
  input: { operatingMonthId: string; attendanceDate: string; employeeId: string }
) {
  if (!client.$executeRawUnsafe) return;
  await client.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0::bigint))",
    `therapist_attendance:${input.operatingMonthId}:${input.attendanceDate}:${input.employeeId}`
  );
}

export async function listTherapistAttendanceForDate(input: {
  operatingMonthId: string;
  attendanceDate: string;
  prismaClient?: TherapistAttendancePrismaClient;
}): Promise<TherapistAttendanceForDateDto> {
  const parsed = attendanceQuerySchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.attendanceDate);

  const client = getClient(input.prismaClient);
  const [operatingMonth, employees, attendances, inServiceCallIds] = await Promise.all([
    loadOperatingMonth(client, parsed.data.operatingMonthId),
    client.employee.findMany({
      where: { employeeGroup: "THERAPIST", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { staffCode: "asc" }, { id: "asc" }]
    }),
    client.therapistAttendance.findMany({
      where: {
        operatingMonthId: parsed.data.operatingMonthId,
        attendanceDate: toDate(parsed.data.attendanceDate),
        isActive: true
      }
    }),
    loadInServiceCallIdsByTherapist(client, parsed.data)
  ]);
  assertDateInOperatingMonth(operatingMonth, parsed.data.attendanceDate);

  const isLocked = isOperatingMonthPayoutLocked(operatingMonth.status);
  const attendanceByEmployeeId = new Map(attendances.map((attendance) => [attendance.employeeId, attendance]));
  return {
    operatingMonthId: parsed.data.operatingMonthId,
    attendanceDate: parsed.data.attendanceDate,
    isLocked,
    rows: employees.map((employee) =>
      toDto({
        operatingMonthId: parsed.data.operatingMonthId,
        attendanceDate: parsed.data.attendanceDate,
        employee,
        attendance: attendanceByEmployeeId.get(employee.id) ?? null,
        isLocked,
        inServiceCallIds: inServiceCallIds.get(employee.id) ?? []
      })
    )
  };
}

export async function upsertTherapistAttendance(input: {
  operatingMonthId: string;
  attendanceDate: string;
  employeeId: string;
  checkInTime: string;
  checkOutTime: string;
  method: LiveTherapistAttendanceMethod;
  actorId: string;
  prismaClient?: TherapistAttendancePrismaClient;
}): Promise<TherapistAttendanceDto> {
  const parsed = attendanceUpsertSchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.attendanceDate);

  const checkInMinute = timeToMinute(parsed.data.checkInTime, "checkInTime");
  // Empty checkout stores a check-in-only row: standby stays unset and the full-attendance
  // flag is never recognized until the checkout is saved (which re-evaluates it).
  const checkOutMinute = parsed.data.checkOutTime === "" ? null : timeToMinute(parsed.data.checkOutTime, "checkOutTime");
  const standbyMinutes = checkOutMinute === null ? null : computeStandbyMinutes(checkInMinute, checkOutMinute);
  const isFullAttendanceRecognized = standbyMinutes !== null && isFullAttendance(standbyMinutes);

  const client = getClient(input.prismaClient);
  const [operatingMonth, employee] = await Promise.all([
    loadOperatingMonth(client, parsed.data.operatingMonthId),
    loadActiveTherapist(client, parsed.data.employeeId)
  ]);
  assertDateInOperatingMonth(operatingMonth, parsed.data.attendanceDate);
  assertUnlocked(operatingMonth);

  return client.$transaction(async (tx) => {
    const transactionOperatingMonth = await loadOperatingMonth(tx, parsed.data.operatingMonthId);
    assertDateInOperatingMonth(transactionOperatingMonth, parsed.data.attendanceDate);
    assertUnlocked(transactionOperatingMonth);
    const transactionEmployee = await loadActiveTherapist(tx, parsed.data.employeeId);

    await lockAttendanceKey(tx, parsed.data);
    const before = await findAttendance(tx, parsed.data);
    const checkInMethod = resolveCheckInMethod({ method: parsed.data.method, before, checkInMinute });
    const checkOutMethod = resolveCheckOutMethod({ method: parsed.data.method, before, checkOutMinute });
    const after = await tx.therapistAttendance.upsert({
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
        checkInMinute,
        checkInMethod,
        checkOutMinute,
        checkOutMethod,
        standbyMinutes,
        isFullAttendanceRecognized,
        isActive: true
      },
      update: {
        checkInMinute,
        checkInMethod,
        checkOutMinute,
        checkOutMethod,
        standbyMinutes,
        isFullAttendanceRecognized,
        isActive: true
      }
    });

    await recordAuditEvent(
      {
        actorId: parsed.data.actorId,
        action: before ? "therapist_attendance.changed" : "therapist_attendance.created",
        targetType: "therapist_attendance",
        targetId: after.id,
        beforeValue: attendanceSnapshot(before),
        afterValue: attendanceSnapshot(after),
        reason: "payout_affecting"
      },
      { prismaClient: tx as any }
    );

    const inServiceCallIds = after.checkOutMinute === null ? [] : (await loadInServiceCallIdsByTherapist(tx, parsed.data)).get(after.employeeId) ?? [];
    return toDto({
      operatingMonthId: parsed.data.operatingMonthId,
      attendanceDate: parsed.data.attendanceDate,
      employee: transactionEmployee,
      attendance: after,
      isLocked: isOperatingMonthPayoutLocked(transactionOperatingMonth.status),
      inServiceCallIds
    });
  });
}

export async function deactivateTherapistAttendance(input: {
  operatingMonthId: string;
  attendanceDate: string;
  employeeId: string;
  actorId: string;
  prismaClient?: TherapistAttendancePrismaClient;
}): Promise<TherapistAttendanceDto> {
  const parsed = attendanceDeactivateSchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.attendanceDate);

  const client = getClient(input.prismaClient);
  const [operatingMonth] = await Promise.all([
    loadOperatingMonth(client, parsed.data.operatingMonthId),
    loadActiveTherapist(client, parsed.data.employeeId)
  ]);
  assertDateInOperatingMonth(operatingMonth, parsed.data.attendanceDate);
  assertUnlocked(operatingMonth);

  const existing = await findAttendance(client, parsed.data);
  if (!existing) {
    throw new TherapistAttendanceDomainError("비활성 처리할 출퇴근 입력이 없습니다.", "THERAPIST_ATTENDANCE_NOT_FOUND");
  }

  return client.$transaction(async (tx) => {
    const transactionOperatingMonth = await loadOperatingMonth(tx, parsed.data.operatingMonthId);
    assertDateInOperatingMonth(transactionOperatingMonth, parsed.data.attendanceDate);
    assertUnlocked(transactionOperatingMonth);
    const transactionEmployee = await loadActiveTherapist(tx, parsed.data.employeeId);

    // Re-read inside the transaction: the row may have been deactivated or removed
    // between the outer read and the transaction. Without this guard a clear could
    // record a stale or duplicate `deactivated` audit event with no real state change.
    await lockAttendanceKey(tx, parsed.data);
    const before = await findAttendance(tx, parsed.data);
    if (!before || !before.isActive) {
      throw new TherapistAttendanceDomainError("비활성 처리할 출퇴근 입력이 없습니다.", "THERAPIST_ATTENDANCE_NOT_FOUND");
    }

    const after = await tx.therapistAttendance.update({
      where: {
        operatingMonthId_attendanceDate_employeeId: {
          operatingMonthId: parsed.data.operatingMonthId,
          attendanceDate: toDate(parsed.data.attendanceDate),
          employeeId: parsed.data.employeeId
        }
      },
      data: {
        isActive: false
      }
    });

    await recordAuditEvent(
      {
        actorId: parsed.data.actorId,
        action: "therapist_attendance.deactivated",
        targetType: "therapist_attendance",
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
      employee: transactionEmployee,
      attendance: after,
      isLocked: isOperatingMonthPayoutLocked(transactionOperatingMonth.status),
      inServiceCallIds: []
    });
  });
}

export async function listTherapistFullAttendanceRecognitions(input: {
  operatingMonthId: string;
  startDate: string;
  endDate: string;
  prismaClient?: TherapistAttendancePrismaClient;
}): Promise<TherapistFullAttendanceRecognitionResultDto> {
  const parsed = recognitionQuerySchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.startDate);
  assertValidParsedDate(parsed.data.endDate);
  if (parsed.data.startDate > parsed.data.endDate) {
    throw invalidInput("조회 기간의 시작일이 종료일보다 늦습니다.");
  }

  const client = getClient(input.prismaClient);
  // Bound the requested range to the operating month so recognitions can never be
  // aggregated from dates outside the month that owns the closing/full-attendance source.
  const operatingMonth = await loadOperatingMonth(client, parsed.data.operatingMonthId);
  assertDateInOperatingMonth(operatingMonth, parsed.data.startDate);
  assertDateInOperatingMonth(operatingMonth, parsed.data.endDate);

  const attendances = await client.therapistAttendance.findMany({
    where: {
      operatingMonthId: parsed.data.operatingMonthId,
      attendanceDate: {
        gte: toDate(parsed.data.startDate),
        lte: toDate(parsed.data.endDate)
      },
      isActive: true
    }
  });

  const sourceDays = new Set<string>();
  const daysByEmployeeId = new Map<string, number>();
  for (const attendance of attendances) {
    sourceDays.add(toIsoDate(attendance.attendanceDate));
    if (attendance.isFullAttendanceRecognized) {
      daysByEmployeeId.set(attendance.employeeId, (daysByEmployeeId.get(attendance.employeeId) ?? 0) + 1);
    }
  }

  return {
    sourceStatus: "available",
    sourceDayCount: sourceDays.size,
    rows: [...daysByEmployeeId.entries()]
      .map(([employeeId, fullAttendanceDays]) => ({ employeeId, fullAttendanceDays }))
      .sort((a, b) => a.employeeId.localeCompare(b.employeeId))
  };
}
