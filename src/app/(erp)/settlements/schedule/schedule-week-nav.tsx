import Link from "next/link";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { addDaysToIsoDate, businessTodayIsoDate } from "@/lib/operating-date";
import { scheduleHref } from "@/app/(erp)/settlements/schedule/schedule-view-model";

/**
 * 근무표의 주 탐색(티켓 27). DateContextControls는 운영월 범위로 하루씩 옮기는 화면용이라
 * 운영월이 없는 이 화면에는 맞지 않는다. 이전주/다음주/오늘과, 임의 날짜로 바로 가는 날짜 칸을 둔다.
 */
export function ScheduleWeekNav({
  weekStartDate,
  weekEndDate,
  locale
}: {
  weekStartDate: string;
  weekEndDate: string;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const previousWeek = addDaysToIsoDate(weekStartDate, -7);
  const nextWeek = addDaysToIsoDate(weekStartDate, 7);
  const today = businessTodayIsoDate();

  return (
    <form action="/settlements/schedule" className="flex flex-wrap items-end gap-2" method="get">
      <label className="grid gap-1 text-xs font-medium text-muted">
        {t("settlements.schedule.weekRangeAria")}
        <input aria-label={t("settlements.schedule.weekRangeAria")} className="screen-field" defaultValue={weekStartDate} name="date" type="date" />
      </label>
      <div className="flex items-center gap-1">
        <Link className="screen-step" href={scheduleHref(previousWeek)}>
          {t("settlements.schedule.nav.previousWeek")}
        </Link>
        <Link className="screen-step" href={scheduleHref(today)}>
          {t("settlements.schedule.nav.today")}
        </Link>
        <Link className="screen-step" href={scheduleHref(nextWeek)}>
          {t("settlements.schedule.nav.nextWeek")}
        </Link>
      </div>
      <button className="screen-step" type="submit">
        {t("common.query")}
      </button>
      <p className="w-full text-xs text-muted [font-variant-numeric:tabular-nums]">
        {weekStartDate} ~ {weekEndDate}
      </p>
    </form>
  );
}
