import { addDaysToIsoDate } from "@/lib/operating-date";

/**
 * 근태 탭의 보기(주·월)와 그 주소. 기본은 주 보기이고(?week=YYYY-MM-DD, 없으면 이번 주), ?month=YYYY-MM이
 * 있으면 월 보기다 — 06·08·09 E2E와 예전 링크가 쓰는 ?month= 주소는 그대로 월 달력을 연다.
 * 형식이 올바르지 않은 값은 무시하고 이번 주로 되돌린다.
 */
export type TherapistAttendanceView = { kind: "week"; date: string | undefined } | { kind: "month"; monthKey: string };

const ATTENDANCE_PATH = "/therapist/attendance";
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 2042-02-31처럼 모양만 맞는 날짜는 Date가 다음 달로 넘기므로 되돌린 값이 같은지 본다.
function isRealIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function resolveTherapistAttendanceView(params: { week?: string; month?: string }): TherapistAttendanceView {
  if (params.month && MONTH_KEY_PATTERN.test(params.month)) return { kind: "month", monthKey: params.month };
  return { kind: "week", date: params.week && isRealIsoDate(params.week) ? params.week : undefined };
}

/** 이번 주(date 없음)는 매개변수 없는 주소다. */
export function attendanceWeekHref(date: string | undefined) {
  return date ? `${ATTENDANCE_PATH}?week=${date}` : ATTENDANCE_PATH;
}

export function attendanceMonthHref(monthKey: string) {
  return `${ATTENDANCE_PATH}?month=${monthKey}`;
}

/**
 * 주 보기에서 "월"을 누르면 열 달. 오늘이 든 주면 오늘의 달이고, 아니면 그 주의 목요일이 든 달
 * (주의 날 대부분이 속한 달)이다.
 */
export function monthKeyToShowForWeek(weekStartDate: string, todayServiceDate: string) {
  const weekEndDate = addDaysToIsoDate(weekStartDate, 6);
  if (weekStartDate <= todayServiceDate && todayServiceDate <= weekEndDate) return todayServiceDate.slice(0, 7);
  return addDaysToIsoDate(weekStartDate, 3).slice(0, 7);
}

/**
 * 월 보기에서 "주"를 누르면 열 주의 날짜. 오늘의 달이면 이번 주(undefined), 아니면 그 달 4일이 든 주다.
 * 4일이 든 주는 목요일이 늘 그 달 안이라, 다시 "월"을 누르면 같은 달로 돌아온다(monthKeyToShowForWeek).
 * 1일이 든 주는 1일이 금–일이면 앞 달의 주로 잡혀 한 달 앞으로 돌아간다.
 */
export function weekDateToShowForMonth(monthKey: string, todayServiceDate: string) {
  return todayServiceDate.startsWith(monthKey) ? undefined : `${monthKey}-04`;
}
