import Link from "next/link";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { intlLocale } from "@/lib/i18n/format";
import { addDaysToIsoDate } from "@/lib/operating-date";
import {
  attendanceMonthHref,
  attendanceWeekHref,
  monthKeyToShowForWeek,
  weekDateToShowForMonth
} from "@/app/therapist/attendance/attendance-view";

export type TherapistAttendanceNavRange =
  | { kind: "week"; weekStartDate: string; weekEndDate: string }
  | { kind: "month"; monthKey: string };

function shiftMonthKey(monthKey: string, deltaMonths: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function utcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** 주는 "10월 19일~25일"(달이 바뀌면 "10월 27일~11월 2일"), 달은 "2026년 10월"이다. */
export function formatAttendanceRange(locale: Locale, range: TherapistAttendanceNavRange) {
  if (range.kind === "week") {
    return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", month: "long", day: "numeric" }).formatRange(
      utcDate(range.weekStartDate),
      utcDate(range.weekEndDate)
    );
  }
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", year: "numeric", month: "long" }).format(utcDate(`${range.monthKey}-01`));
}

/**
 * 근태 탭 머리: 지금 보는 기간, 주·월 보기 전환, 이전·이번·다음 이동. 모두 검색 매개변수를 바꾸는
 * 서버 링크라 자바스크립트 없이도 동작한다(티켓 06의 달 이동과 같은 방식). 보기 전환은 design.md 6.2의
 * 낱개 알약 탭이다.
 */
export function TherapistAttendanceNav({
  locale,
  range,
  todayServiceDate
}: {
  locale: Locale;
  range: TherapistAttendanceNavRange;
  todayServiceDate: string;
}) {
  const t = createTranslator(locale);
  const isWeek = range.kind === "week";
  const weekHref = isWeek ? attendanceWeekHref(range.weekStartDate) : attendanceWeekHref(weekDateToShowForMonth(range.monthKey, todayServiceDate));
  const monthHref = isWeek ? attendanceMonthHref(monthKeyToShowForWeek(range.weekStartDate, todayServiceDate)) : attendanceMonthHref(range.monthKey);
  const steps = isWeek
    ? {
        aria: t("therapist.attendance.weekNav.aria"),
        previous: { href: attendanceWeekHref(addDaysToIsoDate(range.weekStartDate, -7)), label: t("therapist.attendance.weekNav.previous") },
        current: { href: attendanceWeekHref(undefined), label: t("therapist.attendance.weekNav.thisWeek") },
        next: { href: attendanceWeekHref(addDaysToIsoDate(range.weekStartDate, 7)), label: t("therapist.attendance.weekNav.next") }
      }
    : {
        aria: t("therapist.attendance.monthNav.aria"),
        previous: { href: attendanceMonthHref(shiftMonthKey(range.monthKey, -1)), label: t("therapist.attendance.monthNav.previous") },
        current: { href: attendanceMonthHref(todayServiceDate.slice(0, 7)), label: t("therapist.attendance.monthNav.thisMonth") },
        next: { href: attendanceMonthHref(shiftMonthKey(range.monthKey, 1)), label: t("therapist.attendance.monthNav.next") }
      };

  return (
    <div className="mb-4 grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[0.9375rem] font-semibold text-foreground">{formatAttendanceRange(locale, range)}</h2>
        <nav aria-label={t("therapist.attendance.view.aria")} className="flex shrink-0 items-center gap-2">
          <Link aria-current={isWeek ? "page" : undefined} className="screen-tab" href={weekHref}>
            {t("therapist.attendance.view.week")}
          </Link>
          <Link aria-current={isWeek ? undefined : "page"} className="screen-tab" href={monthHref}>
            {t("therapist.attendance.view.month")}
          </Link>
        </nav>
      </div>
      <nav aria-label={steps.aria} className="flex items-center gap-1">
        <Link className="screen-step" href={steps.previous.href}>
          <span aria-hidden="true">‹&nbsp;</span>
          {steps.previous.label}
        </Link>
        <Link className="screen-step" href={steps.current.href}>
          {steps.current.label}
        </Link>
        <Link className="screen-step" href={steps.next.href}>
          {steps.next.label}
          <span aria-hidden="true">&nbsp;›</span>
        </Link>
      </nav>
    </div>
  );
}
