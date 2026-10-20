import { BUSINESS_DAY_START_TIME, BUSINESS_TIME_ZONE } from "@/lib/business-time";

export type OperatingMonthDateRange = {
  id: string;
  startDate: string;
  endDate: string;
};

export function businessTodayIsoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function addDaysToIsoDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** 지금의 시계 값(HH:mm, 영업 시간대). selectNowSlot(quick-booking-now-slot.ts)의 클라이언트 쪽 nowClockString과 같은 모양이다. */
export function businessClockString(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

/**
 * Therapist 쪽(화면, 수당, 출퇴근, 근태 판정)의 오늘 서비스 날짜(사용자 결정 2026-10-20, R0). 영업일은
 * 베트남 현지 시각 03:00부터 다음 날 02:59까지다. 예약 슬롯 설정과 무관하다. 운영팀 원장·직원 서비스의
 * "오늘"은 이 함수를 쓰지 않는다 — businessTodayServiceDateFromActiveSlots를 쓴다.
 */
export function businessTodayServiceDate(now = new Date()) {
  const calendarToday = businessTodayIsoDate(now);
  return businessClockString(now) < BUSINESS_DAY_START_TIME ? addDaysToIsoDate(calendarToday, -1) : calendarToday;
}

/**
 * 운영팀 쪽(콜 원장, 직원의 미래 콜 검사 같은 기존 호출처)의 오늘 서비스 날짜(스펙 226줄, 티켓 10
 * 결정, 93df843 이전 b8b375a와 같은 식, 사용자 결정 2026-10-20으로 되돌림, R0). 영업일은 Asia/
 * Ho_Chi_Minh 기준으로 첫 활성 슬롯부터 다음 날 첫 활성 슬롯 전까지라서, 자정부터 첫 활성 슬롯
 * 전까지는 전날 서비스 날짜가 오늘이다. activeSlots는 호출하는 쪽이 이미 sortOrder로 정렬해 넘긴다
 * (selectNowSlot과 같은 계약). businessTodayIsoDate는 순수 달력날이라 이 보정이 없다 — 날짜 이동
 * 기본값처럼 달력날이 맞는 자리에는 그대로 businessTodayIsoDate를 쓴다.
 */
export function businessTodayServiceDateFromActiveSlots(activeSlots: ReadonlyArray<{ value: string }>, now = new Date()) {
  const calendarToday = businessTodayIsoDate(now);
  const firstSlot = activeSlots[0];
  if (!firstSlot) return calendarToday;
  return businessClockString(now) < firstSlot.value ? addDaysToIsoDate(calendarToday, -1) : calendarToday;
}

export function clampDateToOperatingMonth(date: string | undefined, month: OperatingMonthDateRange, now = new Date()) {
  if (!date) {
    const today = businessTodayIsoDate(now);
    return today >= month.startDate && today <= month.endDate ? today : month.startDate;
  }

  if (date < month.startDate) return month.startDate;
  if (date > month.endDate) return month.endDate;

  return date;
}

export function selectedOperatingMonthFor<T extends { id: string }>(months: T[], operatingMonthId?: string) {
  return months.find((month) => month.id === operatingMonthId) ?? months[0] ?? null;
}
