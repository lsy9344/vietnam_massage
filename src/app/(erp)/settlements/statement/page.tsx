import { requireRouteAccess } from "@/lib/authorization";
import { selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import { linkToScreen } from "@/lib/routes";
import { listMonthlyClosingVersions, type MonthlyClosingVersionSummaryDto } from "@/modules/closing/monthly-closing-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { listEmployees, type EmployeeDto } from "@/modules/masters/employee-service";
import {
  getMonthlyStatement,
  monthlyStatementEmployeeGroups,
  MonthlyStatementDomainError,
  type MonthlyStatementDto
} from "@/modules/closing/monthly-statement-service";
import { MonthlyStatementView } from "@/app/(erp)/settlements/statement/monthly-statement-view";
import { SettlementEmptyNotice, SettlementErrorNotice } from "@/app/(erp)/settlements/settlement-parts";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

type StatementPageSearchParams = {
  operatingMonthId?: string;
  employee?: string;
  closeVersion?: string;
};

type OperatingMonthOption = { id: string; monthKey: string; status: string };

function parseCloseVersion(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * 직원·운영월·(있으면) 마감 버전을 고르는 GET 폼. DateContextControls는 날짜가 있는 화면 공용이라
 * 운영월 한 필드만 다루므로, 이 화면은 직원·버전 필드가 더 있어 같은 모양을 손으로 맞춰 둔다.
 */
function StatementPicker({
  employees,
  locale,
  months,
  selectedMonthId,
  selectedEmployeeId,
  selectedVersion,
  versions,
  t
}: {
  employees: EmployeeDto[];
  locale: Locale;
  months: OperatingMonthOption[];
  selectedMonthId: string;
  selectedEmployeeId: string | null;
  selectedVersion: number | null;
  versions: MonthlyClosingVersionSummaryDto[];
  t: Translator;
}) {
  const groups = monthlyStatementEmployeeGroups
    .map((group) => ({ group, rows: employees.filter((employee) => employee.employeeGroup === group) }))
    .filter((entry) => entry.rows.length > 0);

  return (
    <form action="/settlements/statement" className="flex flex-wrap items-end gap-2" method="get">
      <label className="grid gap-1 text-xs font-medium text-muted">
        {t("common.operatingMonth")}
        <select aria-label={t("common.operatingMonth")} className="screen-field min-w-44" defaultValue={selectedMonthId} name="operatingMonthId">
          {months.map((month) => (
            <option key={month.id} value={month.id}>
              {t("common.monthOption", { monthKey: month.monthKey, status: operatingMonthStatusLabel(locale, month.status) })}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted">
        {t("settlements.statement.picker.employeeLabel")}
        <select
          aria-label={t("settlements.statement.picker.employeeLabel")}
          className="screen-field min-w-56"
          defaultValue={selectedEmployeeId ?? ""}
          name="employee"
        >
          <option value="">{t("settlements.statement.picker.employeePlaceholder")}</option>
          {groups.map(({ group, rows }) => (
            <optgroup key={group} label={t(`settlements.statement.group.${group}`)}>
              {rows.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.displayName} ({employee.staffCode})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {versions.length > 0 ? (
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("settlements.statement.picker.versionLabel")}
          <select
            aria-label={t("settlements.statement.picker.versionLabel")}
            className="screen-field min-w-44"
            defaultValue={selectedVersion ? String(selectedVersion) : ""}
            name="closeVersion"
          >
            <option value="">{t("settlements.statement.picker.versionLatestOption")}</option>
            {versions.map((version) => (
              <option key={version.closeVersion} value={version.closeVersion}>
                {t("settlements.statement.picker.versionOption", { version: version.closeVersion })}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button className="screen-step" type="submit">
        {t("common.query")}
      </button>
    </form>
  );
}

export default async function MonthlyStatementPage({ searchParams }: { searchParams: Promise<StatementPageSearchParams> }) {
  const account = await requireRouteAccess("/settlements/statement");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const [operatingMonths, employees] = await Promise.all([listOperatingMonths(), listEmployees()]);
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <div className="screen">
        <ScreenToolbar account={account} locale={locale} path="/settlements/statement" title={t("settlements.statement.title")} />
        <NoOperatingMonthNotice description={t("settlements.statement.emptyMonthDescription")} locale={locale} role={account.role} />
      </div>
    );
  }

  const employeeId = params.employee || null;
  const requestedVersion = parseCloseVersion(params.closeVersion);
  const context = { operatingMonthId: selectedMonth.id, date: null };
  const canOpenLedger = linkToScreen(account.role, "/calls", context) !== null;

  // 버전 목록은 운영월 단위라 직원을 아직 고르지 않아도 먼저 보여줄 수 있다(고르기 폼에 바로 반영).
  const versions = await listMonthlyClosingVersions({ operatingMonthId: selectedMonth.id });

  let result: MonthlyStatementDto | null = null;
  let errorMessage: string | null = null;

  if (employeeId) {
    try {
      result = await getMonthlyStatement({ operatingMonthId: selectedMonth.id, employeeId, closeVersion: requestedVersion });
    } catch (error) {
      if (error instanceof Error) console.error("[settlements/statement] load error", error);
      const code = error instanceof MonthlyStatementDomainError ? error.code : undefined;
      const koFallback = error instanceof Error ? error.message : t("settlements.statement.error.fallback");
      errorMessage = resolveDomainErrorMessage(locale, code, koFallback);
    }
  }

  return (
    <div className="screen">
      <div className="grid gap-4 print:hidden">
        <ScreenToolbar account={account} context={context} locale={locale} path="/settlements/statement" title={t("settlements.statement.title")} />
        <StatementPicker
          employees={employees}
          locale={locale}
          months={operatingMonths}
          selectedEmployeeId={employeeId}
          selectedMonthId={selectedMonth.id}
          selectedVersion={requestedVersion}
          t={t}
          versions={versions}
        />
      </div>

      {errorMessage ? (
        <SettlementErrorNotice
          locale={locale}
          message={errorMessage}
          query={{ operatingMonthId: selectedMonth.id, ...(employeeId ? { employee: employeeId } : {}) }}
          title={t("settlements.statement.error.title")}
        />
      ) : result ? (
        <MonthlyStatementView canOpenLedger={canOpenLedger} result={result} />
      ) : (
        <SettlementEmptyNotice description={t("settlements.statement.empty.description")} locale={locale} title={t("settlements.statement.empty.title")} />
      )}
    </div>
  );
}
