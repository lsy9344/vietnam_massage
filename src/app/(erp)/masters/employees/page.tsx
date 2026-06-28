import { requireRouteAccess } from "@/lib/authorization";
import { ensureDefaultEmployees, listEmployees } from "@/modules/masters/employee-service";
import { EmployeeManager } from "@/app/(erp)/masters/employees/employee-forms";
import { PageHeader } from "@/components/domain/page-header";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function EmployeeMasterPage() {
  const account = await requireRouteAccess("/masters/employees");
  const { t } = await getServerTranslator();
  await ensureDefaultEmployees({ actorId: account.id });
  const employees = await listEmployees();

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("masters.eyebrow")}
        title={t("masters.employees.title")}
        description={t("masters.employees.description")}
        meta={
          <>
            <div>{t("masters.employees.meta.totalEmployees", { count: employees.length })}</div>
            <div>{t("masters.employees.meta.activeEmployees", { count: employees.filter((employee) => employee.isActive).length })}</div>
          </>
        }
      />
      <EmployeeManager employees={employees} />
    </main>
  );
}
