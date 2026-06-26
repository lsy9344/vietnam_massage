import { requireRouteAccess } from "@/lib/authorization";
import { ensureDefaultEmployees, listEmployees } from "@/modules/masters/employee-service";
import { EmployeeManager } from "@/app/(erp)/masters/employees/employee-forms";
import { PageHeader } from "@/components/domain/page-header";

export default async function EmployeeMasterPage() {
  const account = await requireRouteAccess("/masters/employees");
  await ensureDefaultEmployees({ actorId: account.id });
  const employees = await listEmployees();

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow="마스터 설정"
        title="직원"
        description="직원 표시명과 계정 로그인 정보를 분리해 관리한다. 콜 원장과 정산은 이름 문자열이 아니라 직원 고유 ID를 참조한다."
        meta={
          <>
            <div>전체 직원: {employees.length}명</div>
            <div>활성 직원: {employees.filter((employee) => employee.isActive).length}명</div>
          </>
        }
      />
      <EmployeeManager employees={employees} />
    </main>
  );
}
