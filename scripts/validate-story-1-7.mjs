import { existsSync, readFileSync } from "node:fs";

const errors = [];

function requireFile(path) {
  if (!existsSync(path)) {
    errors.push(`Missing required file: ${path}`);
  }
}

function read(path) {
  requireFile(path);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function readJson(path) {
  const contents = read(path);
  return contents ? JSON.parse(contents) : {};
}

[
  "prisma/schema.prisma",
  "src/modules/masters/employee-schema.ts",
  "src/modules/masters/employee-service.ts",
  "src/modules/masters/employee-service.test.ts",
  "src/modules/masters/account-service.ts",
  "src/app/(erp)/masters/employees/actions.ts",
  "src/app/(erp)/masters/employees/page.tsx",
  "src/app/(erp)/masters/employees/employee-forms.tsx",
  "src/lib/navigation.ts",
  "src/modules/masters/README.md",
  "docs/modules/masters.md",
  "_bmad-output/project-context.md",
  "tests/e2e/story-1-7-employees-master.spec.ts"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-1-7.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-1-7.mjs");
}

const prismaSchema = read("prisma/schema.prisma");
for (const required of [
  "model Employee",
  "displayName",
  "staffCode",
  "employeeGroup",
  "position",
  "shiftType",
  "baseSalary",
  "phone",
  "birthday",
  "hireDate",
  "employmentStatus",
  "sortOrder",
  "@map(\"employee_group\")",
  "@map(\"shift_type\")",
  "@map(\"base_salary\")",
  "@map(\"hire_date\")",
  "@map(\"employment_status\")",
  "@map(\"sort_order\")",
  "@db.Date",
  "@@unique([employeeGroup, sortOrder]",
  "employeeId       String?        @unique"
]) {
  if (!prismaSchema.includes(required)) {
    errors.push(`prisma/schema.prisma missing Story 1.7 requirement: ${required}`);
  }
}

const schema = read("src/modules/masters/employee-schema.ts");
for (const required of [
  "OPERATIONS",
  "EARCARE",
  "THERAPIST",
  "운영팀",
  "귀케어팀",
  "마사지사",
  "OPS-LEAD-001",
  "OPS-COUNTER-DAY-001",
  "EAR-001",
  "THR-050",
  "22000000",
  "12000000",
  "9000000",
  "5000000",
  "createEmployeeSchema",
  "updateEmployeeProfileSchema",
  "deactivateEmployeeSchema",
  "linkUserAccountToEmployeeSchema",
  "YYYY-MM-DD",
  "계정 역할이 올바르지 않습니다.",
  "비밀번호"
]) {
  if (!schema.includes(required)) {
    errors.push(`employee-schema.ts missing ${required}`);
  }
}

const service = read("src/modules/masters/employee-service.ts");
for (const required of [
  "ensureDefaultEmployees",
  "listEmployees",
  "listActiveEmployees",
  "createEmployee",
  "updateEmployeeProfile",
  "updateEmployeeSortOrder",
  "deactivateEmployee",
  "EmployeeDomainError",
  "recordAuditEvent",
  "employee.created",
  "employee.profile_changed",
  "employee.sort_order_changed",
  "employee.deactivated",
  "targetType: \"employee\"",
  "$transaction",
  "findUnique",
  "updateMany",
  "isActive: false",
  "staffCode"
]) {
  if (!service.includes(required)) {
    errors.push(`employee-service.ts missing ${required}`);
  }
}
for (const prohibited of [".delete(", ".deleteMany(", "where: { displayName", "where: { accountId"]) {
  if (service.includes(prohibited)) {
    errors.push(`employee-service.ts must not use physical delete or mutable/account lookup for employee mutation: ${prohibited}`);
  }
}

const accountService = read("src/modules/masters/account-service.ts");
for (const required of [
  "hashPassword",
  "linkUserAccountToEmployee",
  "user_account.linked_to_employee",
  "user_account.role_changed",
  "user_account.deactivated",
  "user_account.lock_reset",
  "employeeId",
  "isAccountRole",
  "recordAuditEvent"
]) {
  if (!accountService.includes(required)) {
    errors.push(`account-service.ts missing account-link requirement: ${required}`);
  }
}
for (const prohibited of ["temporaryPassword", "plainPassword", "reversible"]) {
  if (accountService.includes(prohibited) || prismaSchema.includes(prohibited)) {
    errors.push(`password material must not be persisted: ${prohibited}`);
  }
}

const actions = read("src/app/(erp)/masters/employees/actions.ts");
for (const required of [
  "\"use server\"",
  "requirePermission(\"employee:write\")",
  "ActionResult",
  "FormData",
  "safeParse",
  "createEmployee",
  "updateEmployeeProfile",
  "updateEmployeeSortOrder",
  "deactivateEmployee",
  "linkUserAccountToEmployee",
  "revalidatePath(\"/masters/employees\")",
  "fieldErrors",
  "formError",
  "권한이 없습니다."
]) {
  if (!actions.includes(required)) {
    errors.push(`employee actions missing ${required}`);
  }
}

const page = `${read("src/app/(erp)/masters/employees/page.tsx")}\n${read("src/app/(erp)/masters/employees/employee-forms.tsx")}`;
for (const required of [
  "requireRouteAccess(\"/masters/employees\")",
  "ensureDefaultEmployees",
  "listEmployees",
  "EmployeeManager",
  "직원",
  "운영팀",
  "귀케어팀",
  "마사지사",
  "직원 ID",
  "staff code",
  "주/야간",
  "기본급",
  "연결 계정",
  "비활성 처리",
  "updateEmployeeProfileAction",
  "updateEmployeeSortOrderAction",
  "deactivateEmployeeAction",
  "linkUserAccountToEmployeeAction"
]) {
  if (!page.includes(required)) {
    errors.push(`employees page missing ${required}`);
  }
}
if (page.includes("삭제")) {
  errors.push("/masters/employees page must not present physical delete wording");
}

const navigation = read("src/lib/navigation.ts");
for (const required of ["nav.item.mastersEmployees", "/masters/employees", "administrator"]) {
  if (!navigation.includes(required)) {
    errors.push(`navigation.ts missing ${required}`);
  }
}
if (navigation.includes("disabled")) {
  errors.push("navigation must hide unauthorized employee links, not disable them");
}

const unitTest = read("src/modules/masters/employee-service.test.ts");
for (const required of [
  "5 operations, 4 earcare, and 50 therapist",
  "idempotently",
  "stable staffCode",
  "display name changes",
  "physical delete",
  "audit snapshots",
  "UserAccount.employeeId",
  "Argon2id",
  "plaintext",
  "employee.profile_changed",
  "user_account.linked_to_employee",
  "user_account.role_changed"
]) {
  if (!unitTest.includes(required)) {
    errors.push(`employee service test missing ${required}`);
  }
}

const e2e = read("tests/e2e/story-1-7-employees-master.spec.ts");
for (const required of [
  "mode: \"serial\"",
  "administrator",
  "counter",
  "settlement_manager",
  "waiter",
  "read_only_viewer",
  "/masters/employees",
  "직원",
  "운영팀",
  "귀케어팀",
  "마사지사",
  "비활성 처리",
  "user_account.linked_to_employee",
  "employee.profile_changed",
  "direct /masters/employees"
]) {
  if (!e2e.includes(required)) {
    errors.push(`Story 1.7 e2e missing ${required}`);
  }
}

const readme = read("src/modules/masters/README.md");
for (const required of ["ensureDefaultEmployees", "listActiveEmployees", "linkUserAccountToEmployee", "employee.created", "user_account.linked_to_employee"]) {
  if (!readme.includes(required)) {
    errors.push(`masters README missing ${required}`);
  }
}

const mastersDoc = read("docs/modules/masters.md");
for (const required of ["Employee", "UserAccount", "employeeGroup", "staffCode", "baseSalary", "비활성", "고유 ID"]) {
  if (!mastersDoc.includes(required)) {
    errors.push(`docs/modules/masters.md missing ${required}`);
  }
}

const projectContext = read("_bmad-output/project-context.md");
for (const required of ["Employee", "UserAccount", "OPERATIONS", "EARCARE", "THERAPIST", "staffCode", "employee.created", "user_account.linked_to_employee"]) {
  if (!projectContext.includes(required)) {
    errors.push(`project-context.md missing employee/account fact: ${required}`);
  }
}

if (errors.length > 0) {
  console.error("Story 1.7 static validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Story 1.7 static validation passed.");
