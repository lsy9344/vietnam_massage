import { requireRouteAccess } from "@/lib/authorization";
import { listEmployees } from "@/modules/masters/employee-service";
import { CreateEmployeePanel, EmployeeManager } from "@/app/(erp)/masters/employees/employee-forms";
import { ActiveCounts } from "@/app/(erp)/masters/master-parts";
import { MASTER_ITEM_PARAM, countActive, readMasterItem } from "@/app/(erp)/masters/master-view-model";
import { getServerTranslator } from "@/lib/i18n/server";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

export default async function EmployeeMasterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await requireRouteAccess("/masters/employees");
  const { locale, t } = await getServerTranslator();
  const employees = await listEmployees();
  const params = await searchParams;
  const counts = countActive(employees);

  return (
    <div className="screen">
      <ScreenToolbar account={account} action={<CreateEmployeePanel />} locale={locale} path="/masters/employees" title={t("masters.employees.title")} />
      <div className="mb-6 grid gap-2">
        <ActiveCounts active={counts.active} inactive={counts.inactive} locale={locale} unit={(count) => `${count}${t("masters.employees.peopleSuffix")}`} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>{t("masters.employees.meta.totalEmployees", { count: employees.length })}</span>
        </div>
      </div>
      <EmployeeManager employees={employees} initialItem={readMasterItem(params[MASTER_ITEM_PARAM])} />
    </div>
  );
}
