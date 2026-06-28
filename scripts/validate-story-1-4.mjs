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
  "src/modules/masters/operating-month-schema.ts",
  "src/modules/masters/operating-month-service.ts",
  "src/modules/masters/operating-month-service.test.ts",
  "src/app/(erp)/masters/operating-months/actions.ts",
  "src/app/(erp)/masters/operating-months/page.tsx",
  "src/lib/authorization.ts",
  "src/lib/navigation.ts",
  "src/modules/masters/README.md",
  "_bmad-output/project-context.md",
  "tests/e2e/story-1-4-operating-months.spec.ts"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-1-4.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-1-4.mjs");
}

const prismaSchema = read("prisma/schema.prisma");
for (const required of [
  "model OperatingMonth",
  "monthKey",
  "startDate",
  "endDate",
  "status",
  "@map(\"month_key\")",
  "@map(\"start_date\")",
  "@map(\"end_date\")",
  "@map(\"created_at\")",
  "@map(\"updated_at\")",
  "@unique",
  "@db.Date",
  "@@map(\"operating_months\")"
]) {
  if (!prismaSchema.includes(required)) {
    errors.push(`prisma/schema.prisma missing OperatingMonth requirement: ${required}`);
  }
}

const schema = read("src/modules/masters/operating-month-schema.ts");
for (const required of [
  "operatingMonthStatuses",
  "작성중",
  "검토중",
  "마감확정",
  "잠금",
  "operatingMonthKeySchema",
  "isoDateOnlySchema",
  "operatingMonthStatusSchema",
  "z.enum"
]) {
  if (!schema.includes(required)) {
    errors.push(`operating-month-schema.ts missing ${required}`);
  }
}

const service = read("src/modules/masters/operating-month-service.ts");
for (const required of [
  "createOperatingMonth",
  "listOperatingMonths",
  "changeOperatingMonthStatus",
  "getOperatingMonthDateRange",
  "calculateOperatingMonthRange",
  "이미 존재하는 운영월입니다.",
  "작성중",
  "검토중",
  "recordAuditEvent",
  "operating_month.created",
  "operating_month.status_changed",
  "$transaction",
  "updateMany",
  "toIsoDateOnly"
]) {
  if (!service.includes(required)) {
    errors.push(`operating-month-service.ts missing ${required}`);
  }
}
for (const prohibited of ["reopen", "재오픈", "monthlyClose", "closingSnapshot"]) {
  if (service.includes(prohibited)) {
    errors.push(`operating-month-service.ts must not implement monthly-close/reopen scope: ${prohibited}`);
  }
}

const actions = read("src/app/(erp)/masters/operating-months/actions.ts");
for (const required of [
  "\"use server\"",
  "requirePermission(\"employee:write\")",
  "ActionResult",
  "FormData",
  "safeParse",
  "createOperatingMonth",
  "changeOperatingMonthStatus",
  "revalidatePath(\"/masters/operating-months\")",
  "fieldErrors",
  "formError"
]) {
  if (!actions.includes(required)) {
    errors.push(`operating-month actions missing ${required}`);
  }
}

const page = `${read("src/app/(erp)/masters/operating-months/page.tsx")}\n${read("src/app/(erp)/masters/operating-months/operating-month-forms.tsx")}`;
for (const required of [
  "requireRouteAccess(\"/masters/operating-months\")",
  "listOperatingMonths",
  "운영월 관리",
  "YYYY-MM",
  "시작일",
  "종료일",
  "현재 상태",
  "생성 시각",
  "수정 시각",
  "검토중으로 변경",
  "createOperatingMonthAction",
  "changeOperatingMonthStatusAction"
]) {
  if (!page.includes(required)) {
    errors.push(`operating-month page missing ${required}`);
  }
}
if (page.includes("ErpEmptyState") || page.includes("Story 1.4에서 연결")) {
  errors.push("/masters/operating-months page must be a real management page, not a placeholder");
}

const authorization = read("src/lib/authorization.ts");
if (!authorization.includes("\"employee:write\"") || !authorization.includes("\"/masters\"")) {
  errors.push("authorization.ts must preserve administrator master route and employee:write permission");
}
if (/counter:[^\n]+\bemployee:write\b/.test(authorization)) {
  errors.push("counter must not have employee:write permission");
}

const navigation = read("src/lib/navigation.ts");
for (const required of ["nav.item.mastersOperatingMonths", "/masters/operating-months", "administrator"]) {
  if (!navigation.includes(required)) {
    errors.push(`navigation.ts missing ${required}`);
  }
}
if (navigation.includes("disabled")) {
  errors.push("navigation must hide unauthorized operating-month links, not disable them");
}

const unitTest = read("src/modules/masters/operating-month-service.test.ts");
for (const required of [
  "2026-06-01",
  "2026-06-30",
  "2028-02-29",
  "이미 존재하는 운영월입니다.",
  "운영월 날짜 범위가 YYYY-MM과 일치하지 않습니다.",
  "작성중",
  "검토중",
  "마감확정",
  "이 story에서는 작성중에서 검토중으로 변경만 지원합니다.",
  "does not write a second audit event",
  "operating_month.created",
  "operating_month.status_changed",
  "getOperatingMonthDateRange"
]) {
  if (!unitTest.includes(required)) {
    errors.push(`operating-month service test missing ${required}`);
  }
}

const e2e = read("tests/e2e/story-1-4-operating-months.spec.ts");
for (const required of [
  "mode: \"serial\"",
  "administrator",
  "counter",
  "settlement_manager",
  "waiter",
  "read_only_viewer",
  "/masters/operating-months",
  "운영월 관리",
  "생성 시각",
  "수정 시각",
  "선택 기준",
  "validity.valid",
  "이미 존재하는 운영월입니다.",
  "검토중으로 변경",
  "operating_month.created",
  "operating_month.status_changed",
  "direct /masters/operating-months"
]) {
  if (!e2e.includes(required)) {
    errors.push(`Story 1.4 e2e missing ${required}`);
  }
}

const readme = read("src/modules/masters/README.md");
for (const required of ["운영월", "createOperatingMonth", "getOperatingMonthDateRange", "operating_month.status_changed"]) {
  if (!readme.includes(required)) {
    errors.push(`masters README missing ${required}`);
  }
}

const projectContext = read("_bmad-output/project-context.md");
for (const required of ["OperatingMonth", "작성중", "검토중", "마감확정", "잠금", "getOperatingMonthDateRange"]) {
  if (!projectContext.includes(required)) {
    errors.push(`project-context.md missing operating-month fact: ${required}`);
  }
}

if (errors.length > 0) {
  console.error("Story 1.4 static validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Story 1.4 static validation passed.");
