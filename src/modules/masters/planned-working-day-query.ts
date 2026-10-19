import { z } from "zod";
import { prisma } from "@/lib/prisma";

/** 근무 예정의 값과 읽기 전용 조회. 콜·정산 서비스를 가져오지 않는다. */
export const workPlanStatuses = ["근무 예정", "휴무"] as const;
export type WorkPlanStatus = (typeof workPlanStatuses)[number];

export const unsetPlanStatus = "미입력" as const;
export type PlannedWorkingDayCellStatus = WorkPlanStatus | typeof unsetPlanStatus;
export const plannedWorkingDayCellStatuses = [...workPlanStatuses, unsetPlanStatus] as [
  PlannedWorkingDayCellStatus,
  ...PlannedWorkingDayCellStatus[]
];

export type ScheduleErrorField = "employeeId" | "date" | "status" | "plannedStartTime";

export class ScheduleDomainError extends Error {
  constructor(message: string, public readonly code: string, public readonly field?: ScheduleErrorField) {
    super(message);
    this.name = "ScheduleDomainError";
  }
}

export const isoDateFieldSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다.");

const statusQuerySchema = z.object({
  employeeIds: z.array(z.string().trim().min(1)).max(500),
  date: isoDateFieldSchema
});

const rangeQuerySchema = z.object({
  employeeId: z.string().trim().min(1),
  startDate: isoDateFieldSchema,
  endDate: isoDateFieldSchema
});

export type PlannedWorkingDayStatusDto = {
  employeeId: string;
  status: PlannedWorkingDayCellStatus;
  /** 근무표의 출근 예정 시각(HH:MM, 1018 스펙 D1). 적지 않았으면 null. */
  plannedStartTime: string | null;
};

export type PlannedWorkingDayDayStatusDto = {
  date: string;
  status: PlannedWorkingDayCellStatus;
  /** 근무표의 출근 예정 시각(HH:MM, 1018 스펙 D1). 적지 않았으면 null. */
  plannedStartTime: string | null;
};

const errorFields: readonly ScheduleErrorField[] = ["employeeId", "date", "status", "plannedStartTime"];

function asErrorField(path: PropertyKey | undefined): ScheduleErrorField | undefined {
  return errorFields.find((field) => field === path);
}

function invalidInput(message: string, field?: ScheduleErrorField) {
  return new ScheduleDomainError(message, "INVALID_SCHEDULE_INPUT", field);
}

export function toFieldError(error: z.ZodError) {
  const issue = error.issues[0];
  return invalidInput(issue?.message ?? "입력값을 확인하세요.", asErrorField(issue?.path[0]));
}

export function assertValidParsedDate(value: string) {
  if (toIsoDate(toDate(value)) !== value) {
    throw invalidInput("날짜가 올바르지 않습니다.", "date");
  }
}

function toDate(value: string) { return new Date(`${value}T00:00:00.000Z`); }
function toIsoDate(value: Date) { return value.toISOString().slice(0, 10); }

// listTherapistAvailability(calls/service-call-service.ts, 티켓 29)가 가능 코스 행에 근무 예정을 붙일 때
// 재사용할 수 있도록 plannedWorkingDay.findMany만 요구하는 좁은 타입이다. calls 쪽의
// AssignedCallReadClient(listAssignedServiceCallsForEmployeeOnDate)와 같은 방식.
type PlannedWorkingDayReadClient = {
  plannedWorkingDay: { findMany(args?: unknown): Promise<Array<{ employeeId: string; planStatus: string; plannedStartTime?: string | null }>> };
};

/**
 * 직원 목록과 날짜 하나의 근무표 상태를 돌려준다. 가능 코스(29)와 휴무 영향 콜(28)이
 * 재사용하는 직원별·날짜별 조회다. 행이 없는 직원은 미입력으로 채운다.
 */
export async function listPlannedWorkingDayStatusesForDate(input: {
  employeeIds: string[];
  date: string;
  prismaClient?: PlannedWorkingDayReadClient;
}): Promise<PlannedWorkingDayStatusDto[]> {
  const parsed = statusQuerySchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.date);

  const uniqueEmployeeIds = [...new Set(parsed.data.employeeIds)];
  if (uniqueEmployeeIds.length === 0) return [];

  const client = input.prismaClient ?? (prisma as unknown as PlannedWorkingDayReadClient);
  const rows = await client.plannedWorkingDay.findMany({
    where: { employeeId: { in: uniqueEmployeeIds }, workDate: toDate(parsed.data.date) }
  });
  const rowByEmployeeId = new Map(rows.map((row) => [row.employeeId, row]));

  return uniqueEmployeeIds.map((employeeId) => {
    const row = rowByEmployeeId.get(employeeId);
    return {
      employeeId,
      status: row ? (row.planStatus as WorkPlanStatus) : unsetPlanStatus,
      plannedStartTime: row?.plannedStartTime ?? null
    };
  });
}

// listPlannedWorkingDayStatusesForEmployeeInRange(아래)만 요구하는 좁은 타입이다. 위 타입과 달리
// workDate를 받아 날짜별로 묶는다(PlannedWorkingDayReadClient와 같은 선례).
type PlannedWorkingDayRangeReadClient = {
  plannedWorkingDay: { findMany(args?: unknown): Promise<Array<{ workDate: Date; planStatus: string; plannedStartTime: string | null }>> };
};

function enumerateIsoDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let cursor = toDate(startDate); cursor <= toDate(endDate); cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    dates.push(toIsoDate(cursor));
  }
  return dates;
}

/**
 * 직원 하나·기간 하나의 근무표 상태를 돌려준다(06 근태 달력, 11 관리자 현황). 날짜마다
 * listPlannedWorkingDayStatusesForDate를 부르는 대신 한 번에 읽는다. 행이 없는 날은 미입력으로
 * 채운다(listPlannedWorkingDayStatusesForDate와 같은 규칙).
 */
export async function listPlannedWorkingDayStatusesForEmployeeInRange(input: {
  employeeId: string;
  startDate: string;
  endDate: string;
  prismaClient?: PlannedWorkingDayRangeReadClient;
}): Promise<PlannedWorkingDayDayStatusDto[]> {
  const parsed = rangeQuerySchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.startDate);
  assertValidParsedDate(parsed.data.endDate);
  if (parsed.data.startDate > parsed.data.endDate) {
    throw invalidInput("조회 기간의 시작일이 종료일보다 늦습니다.", "date");
  }

  const client = input.prismaClient ?? (prisma as unknown as PlannedWorkingDayRangeReadClient);
  const rows = await client.plannedWorkingDay.findMany({
    where: { employeeId: parsed.data.employeeId, workDate: { gte: toDate(parsed.data.startDate), lte: toDate(parsed.data.endDate) } }
  });
  const rowByDate = new Map(rows.map((row) => [toIsoDate(row.workDate), row]));

  return enumerateIsoDates(parsed.data.startDate, parsed.data.endDate).map((date) => {
    const row = rowByDate.get(date);
    return {
      date,
      status: row ? (row.planStatus as WorkPlanStatus) : unsetPlanStatus,
      plannedStartTime: row?.plannedStartTime ?? null
    };
  });
}
