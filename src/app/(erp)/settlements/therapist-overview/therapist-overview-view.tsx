import { StatusIndicator } from "@/components/ui/status-indicator";
import { ScreenState } from "@/components/ui/screen-state";
import { tableCellClassName } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Translator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { therapistAttendanceMethodLabel } from "@/lib/i18n/codes";
import type {
  TherapistAdminMonthlyOverviewDto,
  TherapistAdminTodayOverviewDto
} from "@/modules/therapists/therapist-admin-overview-service";

/**
 * 관리자 Therapist 현황(티켓 11, 스펙 D26)의 두 영역. 숫자는 06의 판정·좁은 조회와 월마감
 * 미리보기/스냅샷 행을 그대로 옮긴 것이라 이 파일은 계산하지 않고 보이기만 한다. 서버에서만
 * 그려지는 읽기 전용 화면이라 클라이언트 상태가 없다("use client" 없음).
 */

const cellClassName = cn(tableCellClassName, "align-middle");
// 오늘·월간 표는 이름 말고는 모두 짧은 칸이라 줄이지 않는다. 줄이면 남는 폭이 다 이름 열로 가 칸들이 오른쪽 끝에 몰린다.
const numberCellClassName = cn(cellClassName, "whitespace-nowrap text-right tabular-nums");

function TherapistNameCell({ staffCode, displayName }: { staffCode: string; displayName: string }) {
  return (
    <span className="grid">
      <span className="font-semibold text-foreground">{displayName}</span>
      <span className="text-xs text-muted">{staffCode}</span>
    </span>
  );
}

function TodayCheckCell({ time, method, notYetLabel }: { time: string | null; method: string | null; notYetLabel: string }) {
  if (time === null) return <span className="text-muted">{notYetLabel}</span>;
  return (
    <span className="grid">
      <span className="font-semibold tabular-nums text-foreground">{time}</span>
      {method ? <span className="text-xs text-muted">{method}</span> : null}
    </span>
  );
}

function TodayStatusCell({
  t,
  checkInTime,
  lateMinutes,
  isUnscheduledAttendance
}: {
  t: Translator;
  checkInTime: string | null;
  lateMinutes: number | null;
  isUnscheduledAttendance: boolean;
}) {
  if (isUnscheduledAttendance) {
    return <StatusIndicator label={t("settlements.therapistOverview.today.status.unscheduled")} tone="warning" />;
  }
  if (lateMinutes !== null) {
    return <StatusIndicator label={t("settlements.therapistOverview.today.status.late", { minutes: lateMinutes })} tone="warning" />;
  }
  if (checkInTime !== null) {
    return <StatusIndicator label={t("settlements.therapistOverview.today.status.normal")} tone="success" />;
  }
  return <span className="text-muted">-</span>;
}

export function TherapistOverviewTodaySection({
  t,
  locale,
  overview
}: {
  t: Translator;
  locale: Locale;
  overview: TherapistAdminTodayOverviewDto;
}) {
  if (overview.operatingMonthMissing) {
    return (
      <ScreenState
        description={t("settlements.therapistOverview.today.missingMonth.description")}
        kind="empty"
        label={t("common.screenState.empty")}
        title={t("settlements.therapistOverview.today.missingMonth.title")}
      />
    );
  }

  if (overview.rows.length === 0) {
    return (
      <ScreenState
        description={t("settlements.therapistOverview.today.empty.description")}
        kind="empty"
        label={t("common.screenState.empty")}
        title={t("settlements.therapistOverview.today.empty.title")}
      />
    );
  }

  return (
    // relative: 표 안 sr-only 라벨이 스크롤 상자 밖 문서 폭을 늘리지 않게 이 상자 안에 가둔다(design.md 6.6).
    <div className="relative overflow-x-auto rounded-md border border-border bg-surface">
      <table aria-label={t("settlements.therapistOverview.today.heading")} className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead className="bg-readonly text-xs font-semibold text-muted">
          <tr>
            {[
              t("settlements.therapistOverview.today.column.therapist"),
              t("settlements.therapistOverview.today.column.checkIn"),
              t("settlements.therapistOverview.today.column.checkOut"),
              t("settlements.therapistOverview.today.column.status")
            ].map((label) => (
              <th className={cellClassName} key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {overview.rows.map((row) => (
            <tr key={row.employeeId}>
              <th className={cellClassName} scope="row">
                <TherapistNameCell displayName={row.displayName} staffCode={row.staffCode} />
              </th>
              <td className={cellClassName}>
                <TodayCheckCell
                  method={row.checkInMethod ? therapistAttendanceMethodLabel(locale, row.checkInMethod) : null}
                  notYetLabel={t("settlements.therapistOverview.today.checkIn.notYet")}
                  time={row.checkInTime}
                />
              </td>
              <td className={cellClassName}>
                <TodayCheckCell
                  method={row.checkOutMethod ? therapistAttendanceMethodLabel(locale, row.checkOutMethod) : null}
                  notYetLabel={t("settlements.therapistOverview.today.checkOut.notYet")}
                  time={row.checkOutTime}
                />
              </td>
              <td className={cellClassName}>
                {row.isSpecialDayOff ? (
                  <StatusIndicator label={t("therapistRequestKind.special_day_off")} tone="danger" />
                ) : (
                  <TodayStatusCell
                    checkInTime={row.checkInTime}
                    isUnscheduledAttendance={row.judgment.isUnscheduledAttendance}
                    lateMinutes={row.judgment.lateMinutes}
                    t={t}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TherapistOverviewMonthlySection({ t, overview }: { t: Translator; overview: TherapistAdminMonthlyOverviewDto }) {
  if (overview.rows.length === 0) {
    return (
      <ScreenState
        description={t("settlements.therapistOverview.monthly.empty.description")}
        kind="empty"
        label={t("common.screenState.empty")}
        title={t("settlements.therapistOverview.monthly.empty.title")}
      />
    );
  }

  const columns = [
    t("settlements.therapistOverview.monthly.column.therapist"),
    t("settlements.therapistOverview.monthly.column.late"),
    t("settlements.therapistOverview.monthly.column.absent"),
    t("settlements.therapistOverview.monthly.column.clockOutMissing"),
    t("settlements.therapistOverview.monthly.column.unscheduled"),
    t("settlements.therapistOverview.monthly.column.proxyInput"),
    t("settlements.therapistOverview.monthly.column.callCount"),
    t("settlements.therapistOverview.monthly.column.rank")
  ];

  return (
    <div className="relative overflow-x-auto rounded-md border border-border bg-surface">
      <table aria-label={t("settlements.therapistOverview.monthly.heading")} className="w-full min-w-[52rem] border-collapse text-left text-sm">
        <thead className="bg-readonly text-xs font-semibold text-muted">
          <tr>
            {columns.map((label, index) => (
              <th className={index === 0 ? cellClassName : numberCellClassName} key={label} scope="col">
                <span className={index === 0 ? "" : "block"}>{label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {overview.rows.map((row) => (
            <tr key={row.employeeId}>
              <th className={cellClassName} scope="row">
                <TherapistNameCell displayName={row.displayName} staffCode={row.staffCode} />
              </th>
              <td className={numberCellClassName}>
                {row.lateCount > 0
                  ? t("settlements.therapistOverview.monthly.late.value", { count: row.lateCount, minutes: row.lateMinutesTotal })
                  : t("settlements.therapistOverview.monthly.count.value", { count: 0 })}
              </td>
              <td className={numberCellClassName}>{t("settlements.therapistOverview.monthly.count.value", { count: row.absentCount })}</td>
              <td className={numberCellClassName}>{t("settlements.therapistOverview.monthly.count.value", { count: row.clockOutMissingCount })}</td>
              <td className={numberCellClassName}>
                {t("settlements.therapistOverview.monthly.count.value", { count: row.unscheduledAttendanceCount })}
              </td>
              <td className={numberCellClassName}>{t("settlements.therapistOverview.monthly.count.value", { count: row.proxyInputCount })}</td>
              <td className={numberCellClassName}>
                {row.totalCallCount}
                {t("settlements.callSuffix")}
              </td>
              <td className={cn(numberCellClassName, "font-semibold")}>
                {t("settlements.therapistOverview.monthly.rank.value", { rank: row.rank })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
