import { prisma } from "@/lib/prisma";
import { BUSINESS_DAY_START_TIME } from "@/lib/business-time";
import { addDaysToIsoDate, businessClockString, businessTodayServiceDate } from "@/lib/operating-date";
import { isDoneServiceCallStatus, roomFloorFactsForDate } from "@/modules/calls/service-call-service";
import {
  listTherapistClockOutMissingDates,
  type TherapistClockOutMissingPrismaClient
} from "@/modules/therapists/therapist-attendance-calendar-service";
import { callGuestName, minutesUntilNextCall, sortByBusinessStartTime } from "@/modules/therapists/therapist-today-rules";
import { redactLongDigitSequences } from "@/modules/therapists/therapist-text-redaction";
import { expectedPayoutAmountForDate } from "@/modules/therapists/therapist-payout-view-service";

/** 오늘 운영일 다음으로 보여줄 날수(스펙 D10: "오늘 운영일과 앞으로 7일"). */
const UPCOMING_DAYS = 7;

export type TherapistTodayCallDto = {
  id: string;
  startTime: string;
  /** 실제 종료가 있으면 실제 종료, 없으면 표시 종료다(스펙 D10). isEstimated는 아직 실제 종료가 없을 때 true다. */
  endTime: { time: string; isEstimated: boolean };
  courseCode: string;
  roomLabel: string;
  /** 기준정보 상태 코드 또는 옛 한국어 값. 화면이 callStatusKeyOf로 칩을 고른다. */
  status: string;
  /** 2인 코스에서 함께하는 다른 Therapist의 이름(스펙 D10). 혼자면 null. */
  partnerTherapistName: string | null;
  /** 손님 이름(예약자명 → 연결 고객 → 고객/메모 첫 줄, 스펙 D11). 숫자 가림이 이미 적용돼 있다. */
  guestName: string | null;
  /** 방문별 요청(스펙 D11). 숫자 가림이 이미 적용돼 있다. */
  visitRequest: string | null;
  /** 고객 공통 선호·주의사항(스펙 D11). 숫자 가림이 이미 적용돼 있다. */
  customerPreferenceNote: string | null;
};

export type TherapistTodayDayDto = {
  serviceDate: string;
  calls: TherapistTodayCallDto[];
};

/** 오늘 출퇴근 상태(M4). 05의 출근·퇴근 버튼 자리가 이 값으로 어느 버튼을 보일지 정한다. */
export type TherapistTodayAttendanceStatus = "check_in_available" | "check_out_available" | "both_recorded";

/**
 * "오늘" 탭(M4)의 응답. 05(출근·퇴근 상태)·06(퇴근 미입력 안내)·07(오늘 예상 코스 수당)이 각자
 * 필드를 더했다 — 일반 객체 타입이라 속성을 더해도 기존 필드는 그대로다.
 */
export type TherapistTodayViewDto = {
  /** 오늘 운영일부터 7일, 날짜별로 묶음(스펙 D10). 그날 내 콜이 없어도 날짜는 들어간다. */
  days: TherapistTodayDayDto[];
  today: {
    /** 오늘 운영일(YYYY-MM-DD). days[0]과 같은 값이다 — 화면이 "오늘" 묶음을 찾을 때 이 값을 쓴다. */
    serviceDate: string;
    /** 다음 콜까지 남은 분. 오늘 남은 콜이 없으면 null(순수 규칙 minutesUntilNextCall). */
    nextCallInMinutes: number | null;
    /** 오늘 한 것(사용중·청소중·방문완료, M7). 원장 Therapist 현황 줄의 callCounts.done과 같은 판정이다. */
    doneCount: number;
    /** 오늘 출퇴근 상태(티켓 05, M4). 그날의 운영월이 아직 없으면 출근 가능으로 본다(눌러보면 05의
     * 서비스가 OPERATING_MONTH_NOT_FOUND를 낸다 — 이 화면은 그 드문 경우를 미리 판단하지 않는다). */
    attendanceStatus: TherapistTodayAttendanceStatus;
    /**
     * 운영일이 끝났는데 퇴근 미입력인 날짜(스펙 D17, 티켓 06). 오래된 날부터 온다. 비어 있으면
     * 안내를 안 보인다. 요청 버튼은 09가 단다.
     */
    clockOutMissingDates: string[];
    /**
     * 오늘 예상 코스 수당(M8, 티켓 07): 그날 일별 정산 결과에서 이 Therapist 행의
     * totalCommissionAmount다. 지급 확인과는 무관하고, 마감 전까지는 계산 중(미확정) 값이다(ADR 0010).
     * 오늘 담당 콜이 없으면(operatingMonthId를 못 구해도) 0이다.
     */
    expectedPayoutAmount: number;
  };
};

type TherapistTodayServiceCallRecord = {
  id: string;
  serviceDate: Date;
  startTime: string;
  actualEntryTime: string | null;
  actualEndTime: string | null;
  status: string;
  operatingMonthId: string;
  course: { code: string } | null;
  room: { displayName: string } | null;
  customerMemo: string | null;
  bookerName: string | null;
  visitRequest: string | null;
  customer: { name: string; preferenceNote: string | null } | null;
  assignments: Array<{ employeeId: string; isActive: boolean; employee: { displayName: string } }>;
};

// employee·therapistAttendance·operatingMonth는 이 파일 자체가 쓰지 않고, 퇴근 미입력 안내(06,
// listTherapistClockOutMissingDates)에 그대로 건네주기만 한다(TherapistClockOutMissingPrismaClient와
// 같은 모양이어야 한다).
type TherapistTodayPrismaClient = TherapistClockOutMissingPrismaClient & {
  serviceCall: { findMany(args: unknown): Promise<TherapistTodayServiceCallRecord[]> };
  /** 오늘 출퇴근 상태(티켓 05)를 정하는 데만 쓴다. */
  operatingMonth: { findUnique(args: unknown): Promise<{ id: string; monthKey: string } | null> };
  therapistAttendance: {
    findUnique(args: unknown): Promise<{ isActive: boolean; checkOutMinute: number | null } | null>;
  };
};

function getClient(client?: TherapistTodayPrismaClient) {
  return client ?? (prisma as unknown as TherapistTodayPrismaClient);
}

function toDateOnly(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function toIsoDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBusinessMinuteOfInstant(instant: Date) {
  const hour = String(instant.getUTCHours()).padStart(2, "0");
  const minute = String(instant.getUTCMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

/** 손님 쪽 좁은 질의(M6): 연락처, 비고, 금액·결제, 다른 콜 정보는 애초에 select하지 않는다. */
function partnerNameOf(record: TherapistTodayServiceCallRecord, employeeId: string) {
  return record.assignments.find((assignment) => assignment.isActive && assignment.employeeId !== employeeId)?.employee.displayName ?? null;
}

function toTherapistTodayCallDto(
  record: TherapistTodayServiceCallRecord,
  employeeId: string,
  displayEnds: Map<string, Date>
): TherapistTodayCallDto {
  const isEstimated = !record.actualEndTime;
  const displayEndAt = displayEnds.get(record.id);
  const endTime = record.actualEndTime ?? (displayEndAt ? formatBusinessMinuteOfInstant(displayEndAt) : record.startTime);
  const guestName = callGuestName({ bookerName: record.bookerName, customerName: record.customer?.name ?? null, customerMemo: record.customerMemo });

  return {
    id: record.id,
    startTime: record.startTime,
    endTime: { time: endTime, isEstimated },
    courseCode: record.course?.code ?? "",
    roomLabel: record.room?.displayName ?? "미배정",
    status: record.status,
    partnerTherapistName: partnerNameOf(record, employeeId),
    guestName: redactLongDigitSequences(guestName),
    visitRequest: redactLongDigitSequences(record.visitRequest),
    customerPreferenceNote: redactLongDigitSequences(record.customer?.preferenceNote ?? null)
  };
}

/**
 * "오늘" 탭(M1·M4): 오늘 운영일과 앞으로 7일의 내 콜(날짜별), 오늘 현황(다음 콜까지 남은 시간, 오늘 한
 * 것). employeeId는 always 세션(requireTherapistAccess)에서 온 값이다(M3) — 이 함수는 요청에서 직원
 * id를 받지 않는다.
 */
export async function getTherapistTodayView(input: {
  employeeId: string;
  now?: Date;
  prismaClient?: TherapistTodayPrismaClient;
}): Promise<TherapistTodayViewDto> {
  const client = getClient(input.prismaClient);
  const now = input.now ?? new Date();

  const dayStart = BUSINESS_DAY_START_TIME;
  const today = businessTodayServiceDate(now);
  const lastDate = addDaysToIsoDate(today, UPCOMING_DAYS);

  const records = await client.serviceCall.findMany({
    where: {
      serviceDate: { gte: toDateOnly(today), lte: toDateOnly(lastDate) },
      assignments: { some: { employeeId: input.employeeId, isActive: true } }
    },
    select: {
      id: true,
      serviceDate: true,
      startTime: true,
      actualEntryTime: true,
      actualEndTime: true,
      status: true,
      operatingMonthId: true,
      course: { select: { code: true } },
      room: { select: { displayName: true } },
      customerMemo: true,
      bookerName: true,
      visitRequest: true,
      customer: { select: { name: true, preferenceNote: true } },
      assignments: {
        where: { isActive: true },
        select: { employeeId: true, isActive: true, employee: { select: { displayName: true } } }
      }
    }
  });

  const recordsByDate = new Map<string, TherapistTodayServiceCallRecord[]>();
  for (const record of records) {
    const key = toIsoDateOnly(record.serviceDate);
    const current = recordsByDate.get(key) ?? [];
    current.push(record);
    recordsByDate.set(key, current);
  }

  // 표시 종료는 그날 전체 콜(다른 Therapist 포함)을 봐야 하는 판정이라(다음 예약에 양보), roomFloorFactsForDate가
  // 그 계산을 한다. 내 콜이 없는 날, 또는 이미 구한 (운영월, 날짜) 짝은 다시 읽지 않는다.
  const displayEndsByDate = new Map<string, Map<string, Date>>();
  for (const [serviceDate, dayRecords] of recordsByDate) {
    const operatingMonthId = dayRecords[0]?.operatingMonthId;
    if (!operatingMonthId) continue;
    const { displayEnds } = await roomFloorFactsForDate({ operatingMonthId, serviceDate, prismaClient: client });
    displayEndsByDate.set(serviceDate, displayEnds);
  }

  const dates = [today, ...Array.from({ length: UPCOMING_DAYS }, (_, index) => addDaysToIsoDate(today, index + 1))];
  const days = dates.map((serviceDate) => {
    const dayRecords = sortByBusinessStartTime(recordsByDate.get(serviceDate) ?? [], dayStart);
    const displayEnds = displayEndsByDate.get(serviceDate) ?? new Map<string, Date>();
    return { serviceDate, calls: dayRecords.map((record) => toTherapistTodayCallDto(record, input.employeeId, displayEnds)) };
  });

  const todayRecords = recordsByDate.get(today) ?? [];
  const doneCount = todayRecords.filter((record) => isDoneServiceCallStatus(record.status)).length;
  const nextCallInMinutes = minutesUntilNextCall({
    now: businessClockString(now),
    dayStart,
    calls: todayRecords.map((record) => ({ startTime: record.startTime, status: record.status }))
  });
  const attendanceStatus = await todayAttendanceStatus(client, today, input.employeeId);
  const clockOutMissingDates = await listTherapistClockOutMissingDates({ employeeId: input.employeeId, now, prismaClient: client });

  // 담당 콜이 없으면 오늘 몫 수당도 없다 — 일별 정산을 다시 부르지 않고 0으로 둔다(M8).
  const todayOperatingMonthId = todayRecords[0]?.operatingMonthId ?? null;
  const expectedPayoutAmount = todayOperatingMonthId
    ? await expectedPayoutAmountForDate({
        employeeId: input.employeeId,
        operatingMonthId: todayOperatingMonthId,
        serviceDate: today,
        prismaClient: client
      })
    : 0;

  return {
    days,
    today: { serviceDate: today, nextCallInMinutes, doneCount, attendanceStatus, clockOutMissingDates, expectedPayoutAmount }
  };
}

/**
 * 오늘 출퇴근 상태(티켓 05). 그날의 운영월이 아직 없으면(드문 경우) 출근 가능으로 본다 — 05의 출근
 * 코드 서비스가 직접 운영월·퇴근월 상태를 다시 확인하므로 여기서는 보수적인 기본값만 돌려준다.
 */
async function todayAttendanceStatus(
  client: TherapistTodayPrismaClient,
  today: string,
  employeeId: string
): Promise<TherapistTodayAttendanceStatus> {
  const operatingMonth = await client.operatingMonth.findUnique({ where: { monthKey: today.slice(0, 7) } });
  if (!operatingMonth) return "check_in_available";

  const attendance = await client.therapistAttendance.findUnique({
    where: { operatingMonthId_attendanceDate_employeeId: { operatingMonthId: operatingMonth.id, attendanceDate: toDateOnly(today), employeeId } }
  });
  if (!attendance?.isActive) return "check_in_available";
  return attendance.checkOutMinute === null ? "check_out_available" : "both_recorded";
}
