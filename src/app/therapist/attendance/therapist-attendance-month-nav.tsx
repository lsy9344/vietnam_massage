import Link from "next/link";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { businessTodayIsoDate } from "@/lib/operating-date";

function shiftMonthKey(monthKey: string, deltaMonths: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function attendanceHref(monthKey: string) {
  return `/therapist/attendance?month=${monthKey}`;
}

/**
 * 근태 달력의 달 이동(티켓 06). ScheduleWeekNav(settlements/schedule, 운영팀)와 같은 모양으로
 * ?month= 검색 매개변수를 바꾸는 서버 링크다. 자바스크립트 없이도 동작한다.
 */
export function TherapistAttendanceMonthNav({ monthKey, locale }: { monthKey: string; locale: Locale }) {
  const t = createTranslator(locale);
  const previousMonth = shiftMonthKey(monthKey, -1);
  const nextMonth = shiftMonthKey(monthKey, 1);
  const thisMonth = businessTodayIsoDate().slice(0, 7);

  return (
    <nav aria-label={t("therapist.attendance.monthNav.aria")} className="mb-4 flex items-center gap-1">
      <Link className="screen-step" href={attendanceHref(previousMonth)}>
        {t("therapist.attendance.monthNav.previous")}
      </Link>
      <Link className="screen-step" href={attendanceHref(thisMonth)}>
        {t("therapist.attendance.monthNav.thisMonth")}
      </Link>
      <Link className="screen-step" href={attendanceHref(nextMonth)}>
        {t("therapist.attendance.monthNav.next")}
      </Link>
    </nav>
  );
}
