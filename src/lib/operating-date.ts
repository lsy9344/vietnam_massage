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

/** 영업일은 베트남 현지 시각 03:00부터 다음 날 02:59까지다. 예약 슬롯 설정과 무관하다. */
export function businessTodayServiceDate(now = new Date()) {
  const calendarToday = businessTodayIsoDate(now);
  return businessClockString(now) < BUSINESS_DAY_START_TIME ? addDaysToIsoDate(calendarToday, -1) : calendarToday;
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
