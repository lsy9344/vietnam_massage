import Link from "next/link";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { businessTodayServiceDate } from "@/lib/operating-date";

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
 *
 * R11: "이번 달"은 Therapist 쪽 영업일 기준(businessTodayServiceDate, 03:00 경계)을 쓴다 —
 * businessTodayIsoDate(달력날)를 쓰면 00:00–02:59에는 아직 어제 운영일인데도 다음 달로 넘어가
 * 근태 달력과 어긋난다. now는 테스트에서만 넘긴다(기본은 지금 시각).
 */
export function TherapistAttendanceMonthNav({ monthKey, locale, now }: { monthKey: string; locale: Locale; now?: Date }) {
  const t = createTranslator(locale);
  const previousMonth = shiftMonthKey(monthKey, -1);
  const nextMonth = shiftMonthKey(monthKey, 1);
  const thisMonth = businessTodayServiceDate(now).slice(0, 7);

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
