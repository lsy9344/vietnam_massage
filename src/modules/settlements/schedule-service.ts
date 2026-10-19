import { isoDateFieldSchema, plannedWorkingDayCellStatuses, ScheduleDomainError, assertValidParsedDate, toFieldError, unsetPlanStatus, type PlannedWorkingDayCellStatus, type WorkPlanStatus } from "@/modules/masters/planned-working-day-query";
export { workPlanStatuses, ScheduleDomainError, listPlannedWorkingDayStatusesForDate, unsetPlanStatus, type PlannedWorkingDayCellStatus, type WorkPlanStatus, type PlannedWorkingDayStatusDto } from "@/modules/masters/planned-working-day-query";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import { listAssignedServiceCallsForEmployeeOnDate, type AssignedServiceCallSummaryDto } from "@/modules/calls/service-call-service";
import { employeeGroups, type EmployeeGroup } from "@/modules/masters/employee-schema";

/**
 * 근무표 서비스: (직원, 날짜) 한 칸의 근무 예정/휴무 계획.
 *
 * - 행이 없으면 미입력이다. 미입력을 휴무로 취급하지 않는다(F04).
 * - 운영월과 무관하다. 운영월 잠금 검사를 하지 않고, 운영월 경계를 넘는 주도 날짜 기준으로 그대로 읽고 쓴다.
 * - 출퇴근 기록, 만근, 수당을 만들거나 바꾸지 않으며 예약 저장을 막지 않는다.
 * - 지난주 복사(copyLastWeekSchedule)와 휴무 영향 콜 조회(setPlannedWorkingDay의 impactedCalls)는 티켓 28이 더했다.
 *   영향받는 콜은 콜 서비스(service-call-service.ts)에서 읽기만 하고, 콜의 예약시각·배정·상태는 바꾸지 않는다.
 * - 출근 예정 시각(HH:MM, 선택)은 근무 예정 칸에만 둔다(1018 스펙 D28). 비어 있으면 종일 근무로 본다. 가능 판정은 출근 기록
 *   전까지 이 시각 전을 비는 시간으로 보지 않는다(service-call-service.ts).
 */

type EmployeeRecord = {
  id: string;
  displayName: string;
  staffCode: string;
  employeeGroup: string;
  sortOrder: number;
  isActive: boolean;
};

type PlannedWorkingDayRecord = {
  id: string;
  employeeId: string;
  workDate: Date;
  planStatus: string;
  plannedStartTime?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ScheduleServicePrismaClient = {
  employee: {
    findMany(args?: unknown): Promise<EmployeeRecord[]>;
    findUnique(args: unknown): Promise<EmployeeRecord | null>;
  };
  plannedWorkingDay: {
    findMany(args?: unknown): Promise<PlannedWorkingDayRecord[]>;
    findUnique(args: unknown): Promise<PlannedWorkingDayRecord | null>;
    upsert(args: unknown): Promise<PlannedWorkingDayRecord>;
    delete(args: unknown): Promise<PlannedWorkingDayRecord>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  // listAssignedServiceCallsForEmployeeOnDate(calls/service-call-service.ts)가 요구하는 좁은 모양만 둔다.
  // 실제로는 같은 prisma 클라이언트라 두 서비스가 콜 테이블을 함께 읽을 수 있다.
  serviceCall: {
    findMany(args?: unknown): Promise<unknown[]>;
  };
  // 트랜잭션 콜백 인자(실제 Prisma의 TransactionClient)에는 이게 없다 — 중첩 트랜잭션은 못 연다.
  // runInTransaction이 이미 트랜잭션 안인지(이 자리가 없는지)를 보고 새 트랜잭션을 열지 정한다.
  $transaction?<T>(callback: (tx: ScheduleServicePrismaClient) => Promise<T>): Promise<T>;
};

/** 이미 트랜잭션 안(client가 트랜잭션 콜백 인자라 $transaction이 없음)이면 새로 열지 않고 그대로 쓴다. */
function runInTransaction<T>(client: ScheduleServicePrismaClient, callback: (tx: ScheduleServicePrismaClient) => Promise<T>) {
  if (client.$transaction) {
    return client.$transaction(callback);
  }
  return callback(client);
}

export type PlannedWorkingDayCellDto = {
  date: string;
  status: PlannedWorkingDayCellStatus;
  /** 출근 예정 시각(HH:MM). 근무 예정 칸에만 있고, 적지 않았으면 null이다. */
  plannedStartTime: string | null;
};

export type PlannedWorkingDayEmployeeRowDto = {
  employeeId: string;
  staffCode: string;
  displayName: string;
  employeeGroup: EmployeeGroup;
  sortOrder: number;
  days: PlannedWorkingDayCellDto[];
};

export type PlannedWorkingDayGroupDto = {
  employeeGroup: EmployeeGroup;
  employees: PlannedWorkingDayEmployeeRowDto[];
};

export type PlannedWorkingDayWeekDto = {
  weekStartDate: string;
  weekEndDate: string;
  dates: string[];
  groups: PlannedWorkingDayGroupDto[];
};

export type PlannedWorkingDayCellResultDto = {
  employeeId: string;
  date: string;
  status: PlannedWorkingDayCellStatus;
  plannedStartTime: string | null;
  /** 상태가 휴무일 때만 채운다. 그 직원이 그 날짜에 어느 배정 역할로든 배정된, 노쇼·취소가 아닌 콜(스토리 102). */
  impactedCalls: AssignedServiceCallSummaryDto[];
};

const weekQuerySchema = z.object({
  date: isoDateFieldSchema
});

const setCellSchema = z.object({
  employeeId: z.string().trim().min(1, "직원을 선택하세요."),
  date: isoDateFieldSchema,
  status: z.enum(plannedWorkingDayCellStatuses, { error: "근무 상태가 올바르지 않습니다." }),
  plannedStartTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$|^$/, "출근 예정 시각은 HH:MM 형식이어야 합니다.")
    .nullish()
    .transform((value) => value || null),
  actorId: z.string().trim().min(1, "행위자 계정이 필요합니다.")
});

function getClient(client?: ScheduleServicePrismaClient) {
  return client ?? (prisma as unknown as ScheduleServicePrismaClient);
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return toIsoDate(new Date(Date.UTC(year, month - 1, day + days)));
}

// 월요일 시작 주. 자바스크립트 getUTCDay()는 0=일 ~ 6=토이므로, 일요일만 -6, 나머지는 1 - day.
function mondayOfWeekContaining(value: string) {
  const day = toDate(value).getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDays(value, diffToMonday);
}

function isEmployeeGroup(value: string): value is EmployeeGroup {
  return (employeeGroups as readonly string[]).includes(value);
}

async function loadActiveScheduleEmployee(client: ScheduleServicePrismaClient, employeeId: string) {
  const employee = await client.employee.findUnique({ where: { id: employeeId } });
  if (!employee || !employee.isActive || !isEmployeeGroup(employee.employeeGroup)) {
    throw new ScheduleDomainError("활성 직원을 찾을 수 없습니다.", "SCHEDULE_EMPLOYEE_NOT_FOUND", "employeeId");
  }
  return employee;
}

async function findCell(client: ScheduleServicePrismaClient, employeeId: string, date: string) {
  return client.plannedWorkingDay.findUnique({
    where: { employeeId_workDate: { employeeId, workDate: toDate(date) } }
  });
}

// 출근 예정 시각은 있을 때만 넣는다. 시각을 쓰지 않는 칸의 기록 모양은 그대로다.
function cellSnapshot(employeeId: string, date: string, status: PlannedWorkingDayCellStatus, plannedStartTime: string | null): AuditJsonSnapshot {
  return plannedStartTime ? { employeeId, date, status, plannedStartTime } : { employeeId, date, status };
}

/** 월요일 시작 7일(해당 날짜가 속한 주)의 근무표를 직군별로 묶어 반환한다. */
export async function listPlannedWorkingDaysForWeek(input: {
  date: string;
  prismaClient?: ScheduleServicePrismaClient;
}): Promise<PlannedWorkingDayWeekDto> {
  const parsed = weekQuerySchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.date);

  const weekStartDate = mondayOfWeekContaining(parsed.data.date);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index));
  const weekEndDate = dates[6];

  const client = getClient(input.prismaClient);
  const [employees, rows] = await Promise.all([
    client.employee.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { staffCode: "asc" }, { id: "asc" }]
    }),
    client.plannedWorkingDay.findMany({
      where: { workDate: { gte: toDate(weekStartDate), lte: toDate(weekEndDate) } }
    })
  ]);

  const employeesByGroup = new Map<EmployeeGroup, EmployeeRecord[]>(employeeGroups.map((group) => [group, []]));
  for (const employee of employees) {
    if (!isEmployeeGroup(employee.employeeGroup)) continue;
    employeesByGroup.get(employee.employeeGroup)?.push(employee);
  }

  const rowByKey = new Map(rows.map((row) => [`${row.employeeId}::${toIsoDate(row.workDate)}`, row]));

  const groups: PlannedWorkingDayGroupDto[] = employeeGroups.map((employeeGroup) => ({
    employeeGroup,
    employees: (employeesByGroup.get(employeeGroup) ?? []).map((employee) => ({
      employeeId: employee.id,
      staffCode: employee.staffCode,
      displayName: employee.displayName,
      employeeGroup,
      sortOrder: employee.sortOrder,
      days: dates.map((date) => {
        const row = rowByKey.get(`${employee.id}::${date}`);
        return {
          date,
          status: row ? (row.planStatus as WorkPlanStatus) : unsetPlanStatus,
          plannedStartTime: row?.plannedStartTime ?? null
        };
      })
    }))
  }));

  return { weekStartDate, weekEndDate, dates, groups };
}

/**
 * 칸 하나를 근무 예정·휴무·미입력으로 설정한다. 미입력으로 설정하면 기존 행을 지운다. 출근 예정 시각은 근무 예정일 때만
 * 저장하고, 다른 상태면 지운다(1018 스펙 D28).
 * 실제로 값(상태 또는 출근 예정 시각)이 바뀔 때만 감사 기록(직원, 날짜, 이전 값, 새 값, 처리자)을 남긴다.
 * 결과가 휴무면 그 직원이 그 날짜에 배정된 콜(노쇼·취소 제외)을 함께 돌려준다(스토리 102). 저장은 이미
 * 끝난 뒤의 조회뿐이라, 영향받는 콜이 있어도 저장은 막지 않고 콜의 예약시각·배정·상태는 그대로 둔다.
 */
export async function setPlannedWorkingDay(input: {
  employeeId: string;
  date: string;
  status: PlannedWorkingDayCellStatus;
  /** 출근 예정 시각(HH:MM). 비우거나 빼면 종일 근무다. */
  plannedStartTime?: string | null;
  actorId: string;
  prismaClient?: ScheduleServicePrismaClient;
}): Promise<PlannedWorkingDayCellResultDto> {
  const parsed = setCellSchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.date);

  const client = getClient(input.prismaClient);
  await loadActiveScheduleEmployee(client, parsed.data.employeeId);
  const plannedStartTime = parsed.data.status === "근무 예정" ? parsed.data.plannedStartTime : null;

  const written = await runInTransaction(client, async (tx) => {
    // 트랜잭션 안에서 다시 확인한다: 바깥 조회와 트랜잭션 사이에 직원이 비활성화됐을 수 있다.
    await loadActiveScheduleEmployee(tx, parsed.data.employeeId);
    const existing = await findCell(tx, parsed.data.employeeId, parsed.data.date);
    const previousStatus: PlannedWorkingDayCellStatus = existing ? (existing.planStatus as WorkPlanStatus) : unsetPlanStatus;
    const previousStartTime = existing?.plannedStartTime ?? null;

    if (previousStatus === parsed.data.status && previousStartTime === plannedStartTime) {
      return { employeeId: parsed.data.employeeId, date: parsed.data.date, status: previousStatus, plannedStartTime };
    }

    if (parsed.data.status === unsetPlanStatus) {
      // previousStatus !== status이고 status가 미입력이면 existing은 반드시 있다.
      const removed = existing as PlannedWorkingDayRecord;
      await tx.plannedWorkingDay.delete({
        where: { employeeId_workDate: { employeeId: parsed.data.employeeId, workDate: toDate(parsed.data.date) } }
      });

      await recordAuditEvent(
        {
          actorId: parsed.data.actorId,
          action: "planned_working_day.cleared",
          targetType: "planned_working_day",
          targetId: removed.id,
          beforeValue: cellSnapshot(parsed.data.employeeId, parsed.data.date, previousStatus, previousStartTime),
          afterValue: cellSnapshot(parsed.data.employeeId, parsed.data.date, unsetPlanStatus, null)
        },
        { prismaClient: tx as any }
      );

      return { employeeId: parsed.data.employeeId, date: parsed.data.date, status: unsetPlanStatus, plannedStartTime: null };
    }

    const after = await tx.plannedWorkingDay.upsert({
      where: { employeeId_workDate: { employeeId: parsed.data.employeeId, workDate: toDate(parsed.data.date) } },
      create: { employeeId: parsed.data.employeeId, workDate: toDate(parsed.data.date), planStatus: parsed.data.status, plannedStartTime },
      update: { planStatus: parsed.data.status, plannedStartTime }
    });

    await recordAuditEvent(
      {
        actorId: parsed.data.actorId,
        action: existing ? "planned_working_day.changed" : "planned_working_day.created",
        targetType: "planned_working_day",
        targetId: after.id,
        beforeValue: cellSnapshot(parsed.data.employeeId, parsed.data.date, previousStatus, previousStartTime),
        afterValue: cellSnapshot(parsed.data.employeeId, parsed.data.date, parsed.data.status, plannedStartTime)
      },
      { prismaClient: tx as any }
    );

    return { employeeId: parsed.data.employeeId, date: parsed.data.date, status: parsed.data.status, plannedStartTime };
  });

  const impactedCalls =
    written.status === "휴무"
      ? await listAssignedServiceCallsForEmployeeOnDate({
          employeeId: written.employeeId,
          date: written.date,
          prismaClient: client
        })
      : [];

  return { ...written, impactedCalls };
}

/** 지난주 복사로 휴무가 된 칸의 영향받는 콜(스토리 102, S8). 칸 하나를 직접 휴무로 바꿀 때와 같은 모양이다. */
export type PlannedWorkingDayCopyImpactDto = {
  employeeId: string;
  employeeName: string;
  date: string;
  calls: AssignedServiceCallSummaryDto[];
};

export type PlannedWorkingDayCopyResultDto = {
  weekStartDate: string;
  weekEndDate: string;
  filledCount: number;
  /** 채운 칸 중 휴무가 되어 영향받는 콜이 있는 칸만 담는다(없으면 빈 배열). */
  impacts: PlannedWorkingDayCopyImpactDto[];
};

const copyLastWeekSchema = z.object({
  date: isoDateFieldSchema,
  actorId: z.string().trim().min(1, "행위자 계정이 필요합니다.")
});

/**
 * 지난주(이 날짜가 속한 주의 바로 앞 7일)의 값을 이번 주의 같은 요일 중 미입력 칸에만 채운다(스토리 101). 출근 예정 시각도
 * 함께 복사한다(1018 스펙 D28).
 * 이미 입력된 근무 예정·휴무는 덮지 않는다. 운영월 경계를 넘는 주도 날짜 기준으로 그대로 복사한다.
 * 칸마다 setPlannedWorkingDay와 같은 경로로 쓰고 같은 감사 기록을 남기며, 그렇게 휴무가 된 칸의 영향받는
 * 콜을 모아 돌려준다(S8, 스토리 102). 칸이 몇 개든(활성 직원 수 × 7) 한 트랜잭션으로 묶어(S8) 중간에
 * 하나라도 실패하면 전체를 되돌린다 — 그래야 일부만 복사된 채로 남지 않는다.
 */
export async function copyLastWeekSchedule(input: {
  date: string;
  actorId: string;
  prismaClient?: ScheduleServicePrismaClient;
}): Promise<PlannedWorkingDayCopyResultDto> {
  const parsed = copyLastWeekSchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.date);

  const weekStartDate = mondayOfWeekContaining(parsed.data.date);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index));
  const weekEndDate = dates[6];
  const previousWeekStartDate = addDays(weekStartDate, -7);
  const previousDates = Array.from({ length: 7 }, (_, index) => addDays(previousWeekStartDate, index));

  const client = getClient(input.prismaClient);

  const { filledCount, impacts } = await runInTransaction(client, async (tx) => {
    const [employees, rows] = await Promise.all([
      tx.employee.findMany({ where: { isActive: true } }),
      tx.plannedWorkingDay.findMany({
        where: { workDate: { gte: toDate(previousWeekStartDate), lte: toDate(weekEndDate) } }
      })
    ]);

    // 행이 있으면 입력된 것(근무 예정 또는 휴무)이고, 없으면 미입력이다(F04).
    const rowByKey = new Map(rows.map((row) => [`${row.employeeId}::${toIsoDate(row.workDate)}`, row]));

    let count = 0;
    const impactRows: PlannedWorkingDayCopyImpactDto[] = [];
    for (const employee of employees) {
      if (!isEmployeeGroup(employee.employeeGroup)) continue;
      for (let index = 0; index < 7; index += 1) {
        const currentDate = dates[index];
        if (rowByKey.has(`${employee.id}::${currentDate}`)) continue; // 이미 입력된 칸은 덮지 않는다.
        const previous = rowByKey.get(`${employee.id}::${previousDates[index]}`);
        if (previous === undefined) continue; // 지난주도 미입력이면 채울 값이 없다.

        const written = await setPlannedWorkingDay({
          employeeId: employee.id,
          date: currentDate,
          status: previous.planStatus as WorkPlanStatus,
          plannedStartTime: previous.plannedStartTime ?? null,
          actorId: parsed.data.actorId,
          prismaClient: tx
        });
        count += 1;
        if (written.impactedCalls.length > 0) {
          impactRows.push({ employeeId: employee.id, employeeName: employee.displayName, date: currentDate, calls: written.impactedCalls });
        }
      }
    }
    return { filledCount: count, impacts: impactRows };
  });

  return { weekStartDate, weekEndDate, filledCount, impacts };
}
