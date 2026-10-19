import { prisma } from "@/lib/prisma";
import { businessTodayServiceDate } from "@/lib/operating-date";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import {
  compareTherapistRowsByCountKingOrder,
  listMonthlyClosingPreview,
  type MonthlyClosingTherapistRowDto
} from "@/modules/closing/monthly-closing-preview-service";
import { getMonthlyClosingSnapshot } from "@/modules/closing/monthly-closing-service";
import type { OperatingMonthDto } from "@/modules/masters/operating-month-service";
import {
  listPlannedWorkingDayStatusesForDate,
  listPlannedWorkingDayStatusesForEmployeeInRange,
  unsetPlanStatus
} from "@/modules/masters/planned-working-day-query";
import {
  listTherapistAttendanceForDate,
  listTherapistAttendanceForEmployeeInRange,
  type TherapistAttendanceMethod
} from "@/modules/settlements/therapist-attendance-service";
import { judgeTherapistAttendanceDay, type TherapistAttendanceDayJudgment } from "@/modules/therapists/therapist-attendance-judgment";

/**
 * 관리자 Therapist 현황(스펙 D26, M12, M18, 티켓 11). 06의 판정(judgeTherapistAttendanceDay)과 좁은 조회,
 * 월마감 미리보기/스냅샷의 Therapist 행을 그대로 써서 두 영역(오늘, 운영월)을 만든다. 이 화면만의 집계
 * 규칙은 새로 만들지 않는다.
 */

type AdminOverviewTimeSlotRecord = { value: string; sortOrder: number; createdAt: Date; isActive: boolean };
type AdminOverviewTimeSlotClient = { timeSlot: { findMany(args?: unknown): Promise<AdminOverviewTimeSlotRecord[]> } };

async function loadDayStartAndServiceDate(client: unknown, now: Date) {
  const slots = await (client as AdminOverviewTimeSlotClient).timeSlot.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  return { dayStart: slots[0]?.value ?? "00:00", serviceDate: businessTodayServiceDate(slots, now) };
}

export type TherapistAdminTodayRowDto = {
  employeeId: string;
  staffCode: string;
  displayName: string;
  checkInTime: string | null;
  checkInMethod: TherapistAttendanceMethod | null;
  checkOutTime: string | null;
  checkOutMethod: TherapistAttendanceMethod | null;
  /** 06의 판정 그대로(오늘 운영일은 늘 isOperatingDayEnded: false라 결근·퇴근 미입력은 늘 false다). */
  judgment: TherapistAttendanceDayJudgment;
};

export type TherapistAdminTodayOverviewDto = {
  serviceDate: string;
  /** 오늘 운영일이 속한 운영월이 아직 없으면 true(출근 기록 자체가 없을 수 있어 rows는 빈 배열). */
  operatingMonthMissing: boolean;
  rows: TherapistAdminTodayRowDto[];
};

/**
 * 오늘 영역(D26 첫 줄): 활성 Therapist마다 출근 여부·시각·방식과 지각·예정 없는 출근을 보인다.
 * listTherapistAttendanceForDate가 이미 활성 Therapist 전원을 돌려주므로 roster를 따로 읽지 않는다.
 */
export async function getTherapistAdminTodayOverview(input: {
  operatingMonths: OperatingMonthDto[];
  now?: Date;
  prismaClient?: unknown;
}): Promise<TherapistAdminTodayOverviewDto> {
  const client = input.prismaClient ?? prisma;
  const now = input.now ?? new Date();
  const { dayStart, serviceDate } = await loadDayStartAndServiceDate(client, now);

  const monthKey = serviceDate.slice(0, 7);
  const operatingMonth = input.operatingMonths.find((month) => month.monthKey === monthKey) ?? null;
  if (!operatingMonth) {
    return { serviceDate, operatingMonthMissing: true, rows: [] };
  }

  const attendance = await listTherapistAttendanceForDate({
    operatingMonthId: operatingMonth.id,
    attendanceDate: serviceDate,
    prismaClient: client as never
  });
  const employeeIds = attendance.rows.map((row) => row.employeeId);
  const plannedStatuses = await listPlannedWorkingDayStatusesForDate({ employeeIds, date: serviceDate, prismaClient: client as never });
  const plannedByEmployeeId = new Map(plannedStatuses.map((status) => [status.employeeId, status]));

  const rows: TherapistAdminTodayRowDto[] = attendance.rows.map((row) => {
    const planned = plannedByEmployeeId.get(row.employeeId) ?? null;
    const judgment = judgeTherapistAttendanceDay({
      planStatus: planned?.status ?? unsetPlanStatus,
      plannedStartTime: planned?.plannedStartTime ?? null,
      checkInTime: row.checkInTime,
      checkOutTime: row.checkOutTime,
      dayStart,
      isOperatingDayEnded: false
    });
    return {
      employeeId: row.employeeId,
      staffCode: row.staffCode,
      displayName: row.displayName,
      checkInTime: row.checkInTime,
      checkInMethod: row.checkInMethod,
      checkOutTime: row.checkOutTime,
      checkOutMethod: row.checkOutMethod,
      judgment
    };
  });

  return { serviceDate, operatingMonthMissing: false, rows };
}

export type TherapistAdminMonthlyRowDto = {
  employeeId: string;
  staffCode: string;
  displayName: string;
  lateCount: number;
  lateMinutesTotal: number;
  absentCount: number;
  clockOutMissingCount: number;
  unscheduledAttendanceCount: number;
  /** 체크인·체크아웃 각각 "대리 입력"이면 1씩 센다("이전 기록"은 세지 않음). */
  proxyInputCount: number;
  /** 완료 콜 수(방문완료). 월마감 미리보기/스냅샷 행의 totalCallCount 그대로다. */
  totalCallCount: number;
  /** 완료 콜 수 기준 전체 순위(동점 규칙은 compareTherapistRowsByCountKingOrder). 활성 Therapist가 없으면 빈 배열이라 null이 되지 않는다. */
  rank: number;
};

export type TherapistAdminMonthlyOverviewDto = {
  operatingMonthId: string;
  monthKey: string;
  rows: TherapistAdminMonthlyRowDto[];
};

export type TherapistAdminOverviewDependencies = {
  listMonthlyClosingPreview: typeof listMonthlyClosingPreview;
  getMonthlyClosingSnapshot: typeof getMonthlyClosingSnapshot;
};

const defaultDependencies: TherapistAdminOverviewDependencies = { listMonthlyClosingPreview, getMonthlyClosingSnapshot };

/**
 * 완료 콜 수·순위의 근거 행(M9 해석 결정 2026-10-20): 마감확정·잠금이면 그 마감 스냅샷(최신 버전),
 * 아니면 지금 계산 중인 월마감 미리보기를 쓴다. 두 경우 모두 이미 있던 조각이라 새로 계산하지 않는다.
 */
async function therapistClosingRows(
  month: Pick<OperatingMonthDto, "id" | "status">,
  deps: TherapistAdminOverviewDependencies,
  prismaClient: unknown
): Promise<MonthlyClosingTherapistRowDto[]> {
  if (isOperatingMonthPayoutLocked(month.status)) {
    const snapshot = await deps.getMonthlyClosingSnapshot({ operatingMonthId: month.id, prismaClient: prismaClient as never });
    return snapshot.snapshot.therapists.rows;
  }
  const preview = await deps.listMonthlyClosingPreview({ operatingMonthId: month.id, prismaClient: prismaClient as never });
  return preview.therapists.rows;
}

/**
 * 운영월 영역(D26 둘째 줄): 사람별 지각·결근·퇴근 미입력·예정 없는 출근·대리 입력 횟수(06의 좁은 조회 +
 * judgeTherapistAttendanceDay를 날짜마다 그대로 쓴다)와 완료 콜 수·순위(월마감 미리보기/스냅샷 행 +
 * compareTherapistRowsByCountKingOrder, 새로 만들지 않는다)를 합친다.
 */
export async function getTherapistAdminMonthlyOverview(input: {
  operatingMonth: Pick<OperatingMonthDto, "id" | "monthKey" | "startDate" | "endDate" | "status">;
  now?: Date;
  prismaClient?: unknown;
  dependencies?: Partial<TherapistAdminOverviewDependencies>;
}): Promise<TherapistAdminMonthlyOverviewDto> {
  const deps = { ...defaultDependencies, ...input.dependencies };
  const client = input.prismaClient ?? prisma;

  const closingRows = await therapistClosingRows(input.operatingMonth, deps, client);
  const rankedRows = [...closingRows].sort(compareTherapistRowsByCountKingOrder);
  const rankByEmployeeId = new Map(rankedRows.map((row, index) => [row.employeeId, index + 1]));

  const { dayStart, serviceDate: todayServiceDate } = await loadDayStartAndServiceDate(client, input.now ?? new Date());

  const rows = await Promise.all(
    closingRows.map(async (closingRow): Promise<TherapistAdminMonthlyRowDto> => {
      const [plannedDays, attendances] = await Promise.all([
        listPlannedWorkingDayStatusesForEmployeeInRange({
          employeeId: closingRow.employeeId,
          startDate: input.operatingMonth.startDate,
          endDate: input.operatingMonth.endDate,
          prismaClient: client as never
        }),
        listTherapistAttendanceForEmployeeInRange({
          employeeId: closingRow.employeeId,
          startDate: input.operatingMonth.startDate,
          endDate: input.operatingMonth.endDate,
          prismaClient: client as never
        })
      ]);
      const attendanceByDate = new Map(attendances.map((attendance) => [attendance.attendanceDate, attendance]));

      let lateCount = 0;
      let lateMinutesTotal = 0;
      let absentCount = 0;
      let clockOutMissingCount = 0;
      let unscheduledAttendanceCount = 0;
      let proxyInputCount = 0;

      for (const planned of plannedDays) {
        const attendance = attendanceByDate.get(planned.date) ?? null;
        const judgment = judgeTherapistAttendanceDay({
          planStatus: planned.status,
          plannedStartTime: planned.plannedStartTime,
          checkInTime: attendance?.checkInTime ?? null,
          checkOutTime: attendance?.checkOutTime ?? null,
          dayStart,
          isOperatingDayEnded: planned.date < todayServiceDate
        });
        if (judgment.lateMinutes !== null) {
          lateCount += 1;
          lateMinutesTotal += judgment.lateMinutes;
        }
        if (judgment.isAbsent) absentCount += 1;
        if (judgment.isClockOutMissing) clockOutMissingCount += 1;
        if (judgment.isUnscheduledAttendance) unscheduledAttendanceCount += 1;
        if (attendance?.checkInMethod === "대리 입력") proxyInputCount += 1;
        if (attendance?.checkOutMethod === "대리 입력") proxyInputCount += 1;
      }

      return {
        employeeId: closingRow.employeeId,
        staffCode: closingRow.staffCode,
        displayName: closingRow.displayName,
        lateCount,
        lateMinutesTotal,
        absentCount,
        clockOutMissingCount,
        unscheduledAttendanceCount,
        proxyInputCount,
        totalCallCount: closingRow.totalCallCount,
        rank: rankByEmployeeId.get(closingRow.employeeId) ?? rankedRows.length + 1
      };
    })
  );

  return { operatingMonthId: input.operatingMonth.id, monthKey: input.operatingMonth.monthKey, rows };
}
