import { prisma } from "@/lib/prisma";
import { BUSINESS_DAY_START_TIME } from "@/lib/business-time";
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
  listPlannedWorkingDayStatusesForEmployeesInRange,
  unsetPlanStatus
} from "@/modules/masters/planned-working-day-query";
import {
  listTherapistAttendanceForDate,
  listTherapistAttendanceForEmployeesInRange,
  type TherapistAttendanceMethod
} from "@/modules/settlements/therapist-attendance-service";
import { judgeTherapistAttendanceDay, type TherapistAttendanceDayJudgment } from "@/modules/therapists/therapist-attendance-judgment";
import { listApprovedSpecialDayOffs } from "@/modules/therapists/therapist-request-service";

/**
 * 관리자 Therapist 현황(스펙 D26, M12, M18, 티켓 11). 06의 판정(judgeTherapistAttendanceDay)과 좁은 조회,
 * 월마감 미리보기/스냅샷의 Therapist 행을 그대로 써서 두 영역(오늘, 운영월)을 만든다. 이 화면만의 집계
 * 규칙은 새로 만들지 않는다.
 */

export type TherapistAdminTodayRowDto = {
  employeeId: string;
  staffCode: string;
  displayName: string;
  checkInTime: string | null;
  checkInMethod: TherapistAttendanceMethod | null;
  checkOutTime: string | null;
  checkOutMethod: TherapistAttendanceMethod | null;
  isSpecialDayOff: boolean;
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
  const dayStart = BUSINESS_DAY_START_TIME;
  const serviceDate = businessTodayServiceDate(now);

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
  const [plannedStatuses, specialDaysOff] = await Promise.all([
    listPlannedWorkingDayStatusesForDate({ employeeIds, date: serviceDate, prismaClient: client as never }),
    listApprovedSpecialDayOffs({ employeeIds, startDate: serviceDate, endDate: serviceDate, prismaClient: client as never })
  ]);
  const plannedByEmployeeId = new Map(plannedStatuses.map((status) => [status.employeeId, status]));
  const specialEmployeeIds = new Set(specialDaysOff.map((day) => day.employeeId));

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
      isSpecialDayOff: planned?.status === "휴무" && specialEmployeeIds.has(row.employeeId),
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
 *
 * R6: closingRows(미리보기·스냅샷)는 그 운영월에 유효했던 사람 그대로라 퇴사자 행도 있을 수 있다.
 * 근무표·출퇴근 조회는 활성 여부를 보지 않으므로(아래 Range 함수들) 퇴사자 행도 그대로 집계된다.
 * R7(비용): 사람마다 조회를 부르면 질의가 사람 수(최대 50명) × 2로 늘어나므로, 전체를 한 번에 읽어
 * employeeId로 나눈다(listPlannedWorkingDayStatusesForEmployeesInRange,
 * listTherapistAttendanceForEmployeesInRange).
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

  const dayStart = BUSINESS_DAY_START_TIME;
  const todayServiceDate = businessTodayServiceDate(input.now);

  const employeeIds = closingRows.map((closingRow) => closingRow.employeeId);
  const [plannedDaysByEmployeeId, attendancesByEmployeeId] = await Promise.all([
    listPlannedWorkingDayStatusesForEmployeesInRange({
      employeeIds,
      startDate: input.operatingMonth.startDate,
      endDate: input.operatingMonth.endDate,
      prismaClient: client as never
    }),
    listTherapistAttendanceForEmployeesInRange({
      employeeIds,
      startDate: input.operatingMonth.startDate,
      endDate: input.operatingMonth.endDate,
      prismaClient: client as never
    })
  ]);

  const rows = closingRows.map((closingRow): TherapistAdminMonthlyRowDto => {
    const plannedDays = plannedDaysByEmployeeId.get(closingRow.employeeId) ?? [];
    const attendanceByDate = new Map(
      (attendancesByEmployeeId.get(closingRow.employeeId) ?? []).map((attendance) => [attendance.attendanceDate, attendance])
    );

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
  });

  return { operatingMonthId: input.operatingMonth.id, monthKey: input.operatingMonth.monthKey, rows };
}
