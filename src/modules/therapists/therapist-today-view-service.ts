import { prisma } from "@/lib/prisma";
import { addDaysToIsoDate, businessClockString, businessTodayServiceDate } from "@/lib/operating-date";
import { isDoneServiceCallStatus, roomFloorFactsForDate } from "@/modules/calls/service-call-service";
import { callGuestName, minutesUntilNextCall, sortByBusinessStartTime } from "@/modules/therapists/therapist-today-rules";
import { redactLongDigitSequences } from "@/modules/therapists/therapist-text-redaction";

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

/**
 * "오늘" 탭(M4)의 응답. 05(출근·퇴근 버튼)·06(퇴근 미입력 안내)·07(오늘 예상 코스 수당)이 이 타입에
 * 필드를 더한다 — M4가 그 세 가지도 이 화면의 일부로 정의한다(출퇴근 상태, 퇴근 미입력 안내 여부,
 * today.expectedPayoutAmount). 이 티켓은 그 필드를 만들지 않는다: 값을 모르면서 모양만 미리 정하면
 * 추측이 섞이기 때문이다. 일반 객체 타입이라 나중에 속성을 더해도 기존 필드는 그대로다.
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

type TherapistTodayPrismaClient = {
  timeSlot: { findMany(args?: unknown): Promise<Array<{ value: string; sortOrder: number; createdAt: Date; isActive: boolean }>> };
  serviceCall: { findMany(args: unknown): Promise<TherapistTodayServiceCallRecord[]> };
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

  const slots = await client.timeSlot.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const dayStart = slots[0]?.value ?? "00:00";
  const today = businessTodayServiceDate(slots, now);
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

  return { days, today: { serviceDate: today, nextCallInMinutes, doneCount } };
}
