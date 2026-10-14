import { requireRouteAccess } from "@/lib/authorization";
import { listEmployees } from "@/modules/masters/employee-service";
import { EmployeeManager } from "@/app/(erp)/masters/employees/employee-forms";
import { getServerTranslator } from "@/lib/i18n/server";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

export default async function EmployeeMasterPage() {
  const account = await requireRouteAccess("/masters/employees");
  const { locale, t } = await getServerTranslator();
  const employees = await listEmployees();

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/masters/employees" title={t("masters.employees.title")} />
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <div>{t("masters.employees.meta.totalEmployees", { count: employees.length })}</div>
        <div>{t("masters.employees.meta.activeEmployees", { count: employees.filter((employee) => employee.isActive).length })}</div>
      </div>
      <EmployeeManager employees={employees} />
    </div>
  );
}
