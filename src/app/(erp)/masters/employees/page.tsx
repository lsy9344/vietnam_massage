import { requireRouteAccess } from "@/lib/authorization";
import { ensureDefaultEmployees, listEmployees } from "@/modules/masters/employee-service";
import { EmployeeManager } from "@/app/(erp)/masters/employees/employee-forms";

export default async function EmployeeMasterPage() {
  const account = await requireRouteAccess("/masters/employees");
  await ensureDefaultEmployees({ actorId: account.id });
  const employees = await listEmployees();

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">마스터 설정</p>
          <h1 className="text-2xl font-semibold text-foreground">직원</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            직원 표시명과 계정 로그인 정보를 분리해 관리한다. 콜 원장과 정산은 이름 문자열이 아니라 직원 고유 ID를 참조한다.
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>전체 직원: {employees.length}명</div>
          <div>활성 직원: {employees.filter((employee) => employee.isActive).length}명</div>
        </div>
      </div>
      <EmployeeManager employees={employees} />
    </main>
  );
}
