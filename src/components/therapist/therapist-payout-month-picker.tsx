import { Button } from "@/components/ui/button";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import type { OperatingMonthDto } from "@/modules/masters/operating-month-service";

/**
 * 수당 탭의 운영월 고르기(D21 "지난 달들도 고를 수 있다"). 운영팀 월 명세서 고르기(StatementPicker)와
 * 같은 GET 폼 모양이지만, Therapist는 직원·마감 버전을 고르지 않는다(M8) — 운영월 하나만 고른다.
 */
export function TherapistPayoutMonthPicker({
  locale,
  months,
  selectedMonthId
}: {
  locale: Locale;
  months: OperatingMonthDto[];
  selectedMonthId: string;
}) {
  const t = createTranslator(locale);
  return (
    <form action="/therapist/payout" className="flex flex-wrap items-end gap-2" method="get">
      <label className="grid gap-1 text-xs font-medium text-muted">
        {t("common.operatingMonth")}
        <select aria-label={t("therapist.payout.picker.monthAria")} className="screen-field min-w-44" defaultValue={selectedMonthId} name="operatingMonthId">
          {months.map((month) => (
            <option key={month.id} value={month.id}>
              {t("common.monthOption", { monthKey: month.monthKey, status: operatingMonthStatusLabel(locale, month.status) })}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="secondary">
        {t("common.query")}
      </Button>
    </form>
  );
}
