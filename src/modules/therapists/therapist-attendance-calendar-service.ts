import { prisma } from "@/lib/prisma";
import { BUSINESS_DAY_START_TIME } from "@/lib/business-time";
import { addDaysToIsoDate, businessTodayServiceDate } from "@/lib/operating-date";
import { calculateOperatingMonthRange } from "@/modules/masters/operating-month-service";
import {
  listPlannedWorkingDayStatusesForEmployeeInRange,
  unsetPlanStatus,
  type PlannedWorkingDayCellStatus
} from "@/modules/masters/planned-working-day-query";
import {
  listTherapistAttendanceForEmployeeInRange,
  type TherapistAttendanceMethod
} from "@/modules/settlements/therapist-attendance-service";
import { judgeTherapistAttendanceDay, type TherapistAttendanceDayJudgment } from "@/modules/therapists/therapist-attendance-judgment";
import { listApprovedSpecialDayOffs, listTherapistRequestsForEmployeeInRange, type TherapistRequestRangeReadClient } from "@/modules/therapists/therapist-request-service";

/** 그날 휴무 신청·정정 요청의 상태(08·09가 채운다). 06은 자리 모양만 정하고 항상 null을 돌려준다. */
export type TherapistAttendanceDayRequestStatus = {
  kind: "day_off" | "special_day_off" | "correction";
  status: "pending" | "approved" | "rejected" | "canceled" | "expired";
  /** 거절 사유(거절 상태일 때만). */
  rejectionReason: string | null;
} | null;

export type TherapistAttendanceCalendarDayDto = {
  date: string;
  planStatus: PlannedWorkingDayCellStatus;
  plannedStartTime: string | null;
  checkInTime: string | null;
  checkInMethod: TherapistAttendanceMethod | null;
  checkOutTime: string | null;
  checkOutMethod: TherapistAttendanceMethod | null;
  isFullAttendanceRecognized: boolean;
  isSpecialDayOff: boolean;
  judgment: TherapistAttendanceDayJudgment;
  /** 08·09가 아직 없어 항상 null이다(모양만 정해 둔다). */
  requestStatus: TherapistAttendanceDayRequestStatus;
};

export type TherapistAttendanceCalendarMonthDto = {
  monthKey: string;
  startDate: string;
  endDate: string;
  /** 오늘(지금 보는 운영일)의 서비스 날짜. 이전 달을 보고 있어도 "오늘" 표시 기준은 이 값이다. */
  todayServiceDate: string;
  days: TherapistAttendanceCalendarDayDto[];
};

type CalendarTimeSlotRecord = { value: string; sortOrder: number; createdAt: Date; isActive: boolean };
type CalendarPlannedWorkingDayRecord = { workDate: Date; planStatus: string; plannedStartTime: string | null };
type CalendarEmployeeRecord = { id: string; displayName: string; staffCode: string; employeeGroup: string; sortOrder: number; isActive: boolean };
type CalendarTherapistAttendanceRecord = {
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
type CalendarOperatingMonthRecord = { id: string; monthKey: string; startDate: Date; endDate: Date; status: string };

// listTherapistAttendanceForEmployeeInRange(출퇴근)만 요구하는 좁은 타입이다. 근무표를 보지 않는
// listTherapistClockOutMissingDates가 쓴다 — getTherapistTodayView("오늘" 탭)는 근무표 모델이
// 없으므로 이 타입만 만족하면 된다(export해서 그 파일의 클라이언트 타입이 이 모양을 따라가게 한다).
export type TherapistClockOutMissingPrismaClient = {
  timeSlot: { findMany(args?: unknown): Promise<CalendarTimeSlotRecord[]> };
  employee: { findUnique(args: unknown): Promise<CalendarEmployeeRecord | null> };
  therapistAttendance: { findMany(args?: unknown): Promise<CalendarTherapistAttendanceRecord[]> };
  operatingMonth: { findUnique(args: unknown): Promise<CalendarOperatingMonthRecord | null> };
};

// listPlannedWorkingDayStatusesForEmployeeInRange·listTherapistAttendanceForEmployeeInRange·
// listTherapistRequestsForEmployeeInRange(08)가 저마다 요구하는 좁은 타입을 한 클라이언트로 함께
// 만족시킨다(각 레코드 모양은 그 모듈의 비공개 타입과 같다).
type TherapistAttendanceCalendarPrismaClient = TherapistClockOutMissingPrismaClient &
  TherapistRequestRangeReadClient & {
    plannedWorkingDay: { findMany(args?: unknown): Promise<CalendarPlannedWorkingDayRecord[]> };
  };

function getClient(client?: TherapistAttendanceCalendarPrismaClient) {
  return client ?? (prisma as unknown as TherapistAttendanceCalendarPrismaClient);
}

/**
 * 근태 달력 한 달(티켓 06, 스펙 D18, M12). monthKey가 없으면 오늘이 속한 달이다. 지난 달을 봐도
 * 운영월 레코드가 없을 수 있어(사용자 확인 전) 달 경계는 calculateOperatingMonthRange(달력월, DB 없음)로만 정한다.
 */
export async function getTherapistAttendanceCalendar(input: {
  employeeId: string;
  monthKey?: string;
  now?: Date;
  prismaClient?: TherapistAttendanceCalendarPrismaClient;
}): Promise<TherapistAttendanceCalendarMonthDto> {
  const now = input.now ?? new Date();
  const todayServiceDate = businessTodayServiceDate(now);
  const range = calculateOperatingMonthRange(input.monthKey ?? todayServiceDate.slice(0, 7));
  const days = await listTherapistAttendanceDays({
    employeeId: input.employeeId,
    startDate: range.startDate,
    endDate: range.endDate,
    now,
    client: getClient(input.prismaClient)
  });

  return { monthKey: range.monthKey, startDate: range.startDate, endDate: range.endDate, todayServiceDate, days };
}

export type TherapistAttendanceCalendarWeekDto = {
  /** 월요일. */
  weekStartDate: string;
  /** 일요일. */
  weekEndDate: string;
  todayServiceDate: string;
  days: TherapistAttendanceCalendarDayDto[];
};

// 월요일 시작(근무표 주간 보기 listPlannedWorkingDaysForWeek와 같은 규칙). getUTCDay()는 일요일이 0이다.
function mondayOfWeekContaining(isoDate: string) {
  const weekday = new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
  return addDaysToIsoDate(isoDate, -((weekday + 6) % 7));
}

/**
 * 근태 달력 한 주(월–일). 근태 탭의 기본 보기다. date가 속한 주를 돌려주고, date가 없으면 오늘
 * 운영일이 속한 주다. 주가 두 달에 걸쳐도 한 번에 읽는다(달 경계와 무관).
 */
export async function getTherapistAttendanceWeek(input: {
  employeeId: string;
  date?: string;
  now?: Date;
  prismaClient?: TherapistAttendanceCalendarPrismaClient;
}): Promise<TherapistAttendanceCalendarWeekDto> {
  const now = input.now ?? new Date();
  const todayServiceDate = businessTodayServiceDate(now);
  const weekStartDate = mondayOfWeekContaining(input.date ?? todayServiceDate);
  const weekEndDate = addDaysToIsoDate(weekStartDate, 6);
  const days = await listTherapistAttendanceDays({
    employeeId: input.employeeId,
    startDate: weekStartDate,
    endDate: weekEndDate,
    now,
    client: getClient(input.prismaClient)
  });

  return { weekStartDate, weekEndDate, todayServiceDate, days };
}

// 근무표(좁은 조회)·출퇴근(좁은 조회)·신청·판정 순수 함수를 합쳐 기간의 날짜별 한 줄로 만든다.
async function listTherapistAttendanceDays(input: {
  employeeId: string;
  startDate: string;
  endDate: string;
  now: Date;
  client: TherapistAttendanceCalendarPrismaClient;
}): Promise<TherapistAttendanceCalendarDayDto[]> {
  const { employeeId, startDate, endDate, now, client } = input;
  const dayStart = BUSINESS_DAY_START_TIME;
  const todayServiceDate = businessTodayServiceDate(now);
  const [plannedDays, attendances, requestDays, specialDaysOff] = await Promise.all([
    listPlannedWorkingDayStatusesForEmployeeInRange({
      employeeId,
      startDate,
      endDate,
      prismaClient: client
    }),
    listTherapistAttendanceForEmployeeInRange({
      employeeId,
      startDate,
      endDate,
      prismaClient: client
    }),
    // 08·09가 채운 자리(휴무 신청·정정 요청 상태). 값만 메운다 — 타입은 06이 정한 그대로다.
    listTherapistRequestsForEmployeeInRange({
      employeeId,
      startDate,
      endDate,
      now,
      prismaClient: client
    }),
    listApprovedSpecialDayOffs({
      employeeIds: [employeeId],
      startDate,
      endDate,
      prismaClient: client
    })
  ]);

  const plannedByDate = new Map(plannedDays.map((day) => [day.date, day]));
  const attendanceByDate = new Map(attendances.map((attendance) => [attendance.attendanceDate, attendance]));
  const requestByDate = new Map(requestDays.map((request) => [request.targetDate, request]));
  const specialDates = new Set(specialDaysOff.map((day) => day.date));

  return plannedDays.map((planned) => {
    const attendance = attendanceByDate.get(planned.date) ?? null;
    const request = requestByDate.get(planned.date) ?? null;
    const judgment = judgeTherapistAttendanceDay({
      planStatus: planned.status,
      plannedStartTime: planned.plannedStartTime,
      checkInTime: attendance?.checkInTime ?? null,
      checkOutTime: attendance?.checkOutTime ?? null,
      dayStart,
      isOperatingDayEnded: planned.date < todayServiceDate
    });

    return {
      date: planned.date,
      planStatus: planned.status,
      plannedStartTime: planned.plannedStartTime,
      checkInTime: attendance?.checkInTime ?? null,
      checkInMethod: attendance?.checkInMethod ?? null,
      checkOutTime: attendance?.checkOutTime ?? null,
      checkOutMethod: attendance?.checkOutMethod ?? null,
      isFullAttendanceRecognized: attendance?.isFullAttendanceRecognized ?? false,
      isSpecialDayOff: planned.status === "휴무" && specialDates.has(planned.date),
      judgment,
      requestStatus: request ? { kind: request.kind, status: request.status, rejectionReason: request.rejectionReason } : null
    };
  });
}

// 끝난 운영일의 퇴근 미입력을 찾는 돌아보는 창(스펙 D17, "오늘" 탭·근태 탭 공통 안내). 운영월
// 경계와 무관하게 최근 31일만 본다(가정) — 보정 요청은 보통 그 안에서 처리되고, 범위를 넓히면
// 달마다 범위를 다시 정해야 하는 복잡함만 늘어난다.
const CLOCK_OUT_MISSING_LOOKBACK_DAYS = 31;

/**
 * 운영일이 끝났는데 퇴근 미입력인 날짜 목록("오늘" 탭·근태 탭 공통 "퇴근 미입력 — 정정 요청" 안내,
 * 스펙 D17). 날짜가 오래된 것부터 온다. 요청 버튼은 09가 단다 — 이 함수는 날짜만 돌려준다.
 */
export async function listTherapistClockOutMissingDates(input: {
  employeeId: string;
  now?: Date;
  prismaClient?: TherapistClockOutMissingPrismaClient;
}): Promise<string[]> {
  const client = input.prismaClient ?? (prisma as unknown as TherapistClockOutMissingPrismaClient);
  const now = input.now ?? new Date();

  const todayServiceDate = businessTodayServiceDate(now);
  const lookbackStart = addDaysToIsoDate(todayServiceDate, -CLOCK_OUT_MISSING_LOOKBACK_DAYS);
  const lastEndedDate = addDaysToIsoDate(todayServiceDate, -1);
  if (lookbackStart > lastEndedDate) return [];

  const attendances = await listTherapistAttendanceForEmployeeInRange({
    employeeId: input.employeeId,
    startDate: lookbackStart,
    endDate: lastEndedDate,
    prismaClient: client
  });

  return attendances.filter((attendance) => attendance.checkInTime !== null && attendance.checkOutTime === null).map((attendance) => attendance.attendanceDate);
}
