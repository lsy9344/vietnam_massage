import Link from "next/link";
import { createTranslator } from "@/lib/i18n";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import { addDaysToIsoDate, businessTodayIsoDate } from "@/lib/operating-date";
import { findScreenRoute, screenHref } from "@/lib/routes";

type OperatingMonthOption = {
  id: string;
  monthKey: string;
  status: string;
  startDate: string;
  endDate: string;
};

type DateContextControlsProps = {
  /** 이 화면의 라우트 목록 경로. 날짜 매개변수 이름을 정한다. */
  path: string;
  months: OperatingMonthOption[];
  selectedMonth: OperatingMonthOption;
  /** 고른 날짜. 운영월만 받는 화면은 null. */
  date: string | null;
  locale: Locale;
  /** 영업 기준 오늘(YYYY-MM-DD). 테스트에서 고정한다. */
  today?: string;
  /** 날짜를 옮겨도 남길 화면 자체의 매개변수(예: 콜 원장의 탭). */
  keepParams?: Record<string, string>;
};

/**
 * 날짜가 있는 화면의 운영월·날짜 맥락. 화면마다 복사되던 조회 폼을 대신한다.
 * 이전/다음 날과 오늘 링크는 운영월 범위 안에서만 보인다.
 */
export function DateContextControls({
  path,
  months,
  selectedMonth,
  date,
  locale,
  today = businessTodayIsoDate(),
  keepParams = {}
}: DateContextControlsProps) {
  const t = createTranslator(locale);
  const route = findScreenRoute(path);
  const dateParam = route?.dateContext && route.dateContext !== "month" ? route.dateContext : null;
  const keptQuery = new URLSearchParams(keepParams).toString();
  const hrefFor = (monthId: string, day: string) => {
    const href = route ? screenHref(route, { operatingMonthId: monthId, date: day }) : path;
    return keptQuery ? `${href}${href.includes("?") ? "&" : "?"}${keptQuery}` : href;
  };

  const previousDay = date && date > selectedMonth.startDate ? addDaysToIsoDate(date, -1) : null;
  const nextDay = date && date < selectedMonth.endDate ? addDaysToIsoDate(date, 1) : null;
  const todayMonth = months.find((month) => today >= month.startDate && today <= month.endDate) ?? null;

  return (
    <form action={path} className="flex flex-wrap items-end gap-2" method="get">
      {Object.entries(keepParams).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <label className="grid gap-1 text-xs font-medium text-muted">
        {t("common.operatingMonth")}
        <select
          aria-label={t("common.operatingMonth")}
          className="screen-field min-w-44"
          defaultValue={selectedMonth.id}
          name="operatingMonthId"
        >
          {months.map((month) => (
            <option key={month.id} value={month.id}>
              {t("common.monthOption", { monthKey: month.monthKey, status: operatingMonthStatusLabel(locale, month.status) })}
            </option>
          ))}
        </select>
      </label>
      {dateParam && date ? (
        <>
          <label className="grid gap-1 text-xs font-medium text-muted">
            {t("common.queryDate")}
            <input
              aria-label={t("common.queryDate")}
              className="screen-field"
              defaultValue={date}
              max={selectedMonth.endDate}
              min={selectedMonth.startDate}
              name={dateParam}
              type="date"
            />
          </label>
          <div className="flex items-center gap-1">
            {previousDay ? (
              <Link className="screen-step" href={hrefFor(selectedMonth.id, previousDay)}>
                {t("shell.date.previous")}
              </Link>
            ) : null}
            {todayMonth && dateParam ? (
              <Link className="screen-step" href={hrefFor(todayMonth.id, today)}>
                {t("shell.date.today")}
              </Link>
            ) : null}
            {nextDay ? (
              <Link className="screen-step" href={hrefFor(selectedMonth.id, nextDay)}>
                {t("shell.date.next")}
              </Link>
            ) : null}
          </div>
        </>
      ) : null}
      <button className="screen-step" type="submit">
        {t("common.query")}
      </button>
      <p className="w-full text-xs text-muted [font-variant-numeric:tabular-nums]">
        {t("common.operatingMonthStatusPrefix")}: {operatingMonthStatusLabel(locale, selectedMonth.status)} · {t("common.dateRange")}:{" "}
        {selectedMonth.startDate} ~ {selectedMonth.endDate}
      </p>
    </form>
  );
}
