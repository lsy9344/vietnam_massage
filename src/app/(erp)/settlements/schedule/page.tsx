import { requireRouteAccess } from "@/lib/authorization";
import { getServerTranslator } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { businessTodayIsoDate } from "@/lib/operating-date";
import { linkToScreen } from "@/lib/routes";
import { listPlannedWorkingDaysForWeek, type PlannedWorkingDayWeekDto } from "@/modules/settlements/schedule-service";
import { ScheduleCopyWeekAction } from "@/app/(erp)/settlements/schedule/schedule-copy-action";
import { ScheduleView } from "@/app/(erp)/settlements/schedule/schedule-view";
import { ScheduleWeekNav } from "@/app/(erp)/settlements/schedule/schedule-week-nav";
import { scheduleWeekSummary } from "@/app/(erp)/settlements/schedule/schedule-view-model";
import { SettlementEmptyNotice, SettlementErrorNotice } from "@/app/(erp)/settlements/settlement-parts";
import { EMPLOYEE_PARAM } from "@/app/(erp)/settlements/settlement-view-model";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { SummaryCard, SummaryCards } from "@/components/ui/summary-card";

type SchedulePageSearchParams = {
  date?: string;
  employee?: string;
};

/**
 * 근무표 화면(티켓 27). 운영월과 무관하게 날짜 기준으로 월요일 시작 7일을 읽고 쓴다
 * (F04: 근무표는 운영월 잠금과 무관하다). 지난주 복사와 휴무 영향 콜은 28이 더했다.
 */
export default async function SchedulePage({ searchParams }: { searchParams: Promise<SchedulePageSearchParams> }) {
  const account = await requireRouteAccess("/settlements/schedule");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const referenceDate = params.date ?? businessTodayIsoDate();
  // 휴무 영향 콜 항목이 원장 링크를 보일지(관리자) 요약만 보일지(정산 담당)는 콜 원장 라우트 접근
  // 권한을 그대로 따른다(스토리 148). operatingMonthId는 href 구성에 쓰지 않으니 비워 둔다.
  const canOpenLedger = linkToScreen(account.role, "/calls", { operatingMonthId: null, date: referenceDate }) !== null;

  let week: PlannedWorkingDayWeekDto | null = null;
  let errorMessage: string | null = null;

  try {
    week = await listPlannedWorkingDaysForWeek({ date: referenceDate });
  } catch (error) {
    if (error instanceof Error) console.error("[settlements/schedule] load error", error);
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : undefined;
    const koFallback = error instanceof Error ? error.message : t("settlements.schedule.error.fallback");
    errorMessage = resolveDomainErrorMessage(locale, code, koFallback);
  }

  const hasEmployees = week ? week.groups.some((group) => group.employees.length > 0) : false;
  const summary = week ? scheduleWeekSummary(week) : null;
  const countSuffix = t("settlements.countSuffix");

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        action={week ? <ScheduleCopyWeekAction canOpenLedger={canOpenLedger} key={week.weekStartDate} weekStartDate={week.weekStartDate} /> : null}
        dateControls={week ? <ScheduleWeekNav locale={locale} weekEndDate={week.weekEndDate} weekStartDate={week.weekStartDate} /> : null}
        locale={locale}
        path="/settlements/schedule"
        title={t("settlements.schedule.title")}
      />

      {errorMessage ? (
        <SettlementErrorNotice
          locale={locale}
          message={errorMessage}
          query={{ date: referenceDate }}
          title={t("settlements.schedule.error.title")}
        />
      ) : week && summary ? (
        <div className="grid gap-6">
          <SummaryCards label={t("settlements.schedule.summary.aria")}>
            <SummaryCard accent="mint" label={t("settlements.schedule.summary.planned")} value={`${summary.plannedCount}${countSuffix}`} />
            <SummaryCard accent="mint" label={t("settlements.schedule.summary.dayOff")} value={`${summary.dayOffCount}${countSuffix}`} />
            <SummaryCard accent="mint" label={t("settlements.schedule.summary.unset")} value={`${summary.unsetCount}${countSuffix}`} />
          </SummaryCards>

          {hasEmployees ? (
            <ScheduleView canOpenLedger={canOpenLedger} initialEmployeeId={params[EMPLOYEE_PARAM] ?? null} key={week.weekStartDate} week={week} />
          ) : (
            <SettlementEmptyNotice description={t("settlements.schedule.empty.description")} locale={locale} title={t("settlements.schedule.empty.title")} />
          )}
        </div>
      ) : null}
    </div>
  );
}
