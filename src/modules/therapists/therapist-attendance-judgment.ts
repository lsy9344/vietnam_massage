import { businessMinuteOf } from "@/modules/therapists/therapist-today-rules";
import type { PlannedWorkingDayCellStatus } from "@/modules/masters/planned-working-day-query";

/**
 * 근태 판정(티켓 06, 스펙 D17–D18, M12). 그날 근무표 칸의 상태와 출근 예정 시각, 그날 출퇴근 기록,
 * 그 운영일이 끝났는지를 받아 지각·결근·퇴근 미입력·예정 없는 출근을 판정하는 순수 함수다. 06의 근태
 * 달력과 11의 관리자 현황이 이 함수 하나를 쓴다(새로 만들지 않는다). 수당 계산에는 들어가지 않는다.
 */
export type TherapistAttendanceDayJudgmentInput = {
  /** 근무표 칸의 상태(근무 예정·휴무·미입력). */
  planStatus: PlannedWorkingDayCellStatus;
  /** 출근 예정 시각(HH:mm). 근무표 쪽 불변식상 근무 예정이 아니면 항상 null이다. */
  plannedStartTime: string | null;
  /** 그날 출근 시각(HH:mm). 출근 기록이 없으면 null. */
  checkInTime: string | null;
  /** 그날 퇴근 시각(HH:mm). 퇴근 기록이 없으면 null. */
  checkOutTime: string | null;
  /** 영업일 시작 기준 시각(첫 활성 슬롯, HH:mm). 밤샘 비교의 공통 기준점(businessMinuteOf). */
  dayStart: string;
  /**
   * 그 운영일이 끝났는지. 오늘 운영일과 미래는 false다. 호출하는 쪽이
   * `attendanceDate < businessTodayServiceDate(now)`로 정한다(저장하는 값이 아니다).
   */
  isOperatingDayEnded: boolean;
};

export type TherapistAttendanceDayJudgment = {
  /** 지각 분(1분 이상 늦었을 때만). 출근 예정 시각이 없거나 출근 기록이 없으면 null이다. */
  lateMinutes: number | null;
  /** 근무 예정인 날, 운영일이 끝날 때까지 출근 기록이 없었다. */
  isAbsent: boolean;
  /** 출근만 있고 퇴근이 없는 상태로 운영일이 끝났다(정정 요청 대상). */
  isClockOutMissing: boolean;
  /** 휴무이거나 근무 예정이 입력되지 않은 날에 출근 기록이 남았다. */
  isUnscheduledAttendance: boolean;
};

const SCHEDULED_WORK_STATUS: PlannedWorkingDayCellStatus = "근무 예정";

// 밤샘 보정(+1440)은 두 시각을 서로 비교하지 않고, 같은 dayStart 기준의 영업일 분으로 각각 바꿔
// 비교한다(businessMinuteOf). checkOutMinute<checkInMinute일 때만 +1440하는 대기시간 계산을
// 그대로 쓰면, 예정보다 일찍 온 밤샘 출근이 1440분 가까운 지각으로 오판된다(코드베이스 지도 0절 3).
function computeLateMinutes(input: TherapistAttendanceDayJudgmentInput): number | null {
  if (input.plannedStartTime === null || input.checkInTime === null) return null;
  const plannedMinute = businessMinuteOf(input.plannedStartTime, input.dayStart);
  const checkInMinute = businessMinuteOf(input.checkInTime, input.dayStart);
  const lateMinutes = checkInMinute - plannedMinute;
  return lateMinutes > 0 ? lateMinutes : null;
}

export function judgeTherapistAttendanceDay(input: TherapistAttendanceDayJudgmentInput): TherapistAttendanceDayJudgment {
  return {
    lateMinutes: computeLateMinutes(input),
    isAbsent: input.planStatus === SCHEDULED_WORK_STATUS && input.checkInTime === null && input.isOperatingDayEnded,
    isClockOutMissing: input.checkInTime !== null && input.checkOutTime === null && input.isOperatingDayEnded,
    isUnscheduledAttendance: input.checkInTime !== null && input.planStatus !== SCHEDULED_WORK_STATUS
  };
}
