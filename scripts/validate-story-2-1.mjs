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
  "src/modules/calls/service-call-schema.ts",
  "src/modules/calls/service-call-service.ts",
  "src/modules/calls/service-call-service.test.ts",
  "src/app/(erp)/calls/actions.ts",
  "src/app/(erp)/calls/page.tsx",
  "src/app/(erp)/calls/loading.tsx",
  "src/app/(erp)/calls/editable-call-grid.tsx",
  "tests/e2e/story-2-1-call-ledger-basic.spec.ts",
  "src/modules/calls/README.md",
  "docs/modules/calls.md",
  "_bmad-output/project-context.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-2-1.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-2-1.mjs");
}

const prismaSchema = read("prisma/schema.prisma");
for (const required of [
  "model ServiceCall",
  "model ServiceCallAssignment",
  "@@map(\"service_calls\")",
  "@@map(\"service_call_assignments\")",
  "operatingMonthId",
  "serviceDate",
  "@db.Date",
  "startTime",
  "roomId",
  "courseId",
  "status",
  "discountTypeCode",
  "paymentMethodCode",
  "confirmationCode",
  "assignmentRole",
  "@@index([operatingMonthId, serviceDate]",
  "@@index([roomId, serviceDate]",
  "@@index([status, serviceDate]",
  "@@unique([serviceCallId, assignmentRole]",
  "@@index([employeeId, assignmentRole]"
]) {
  if (!prismaSchema.includes(required)) errors.push(`prisma/schema.prisma missing ${required}`);
}

const schema = read("src/modules/calls/service-call-schema.ts");
for (const required of [
  "serviceCallInputSchema",
  "THERAPIST_1",
  "THERAPIST_2",
  "EARCARE",
  "운영월을 선택하세요.",
  "날짜는 YYYY-MM-DD",
  "시간은 HH:mm"
]) {
  if (!schema.includes(required)) errors.push(`service-call-schema.ts missing ${required}`);
}

const service = read("src/modules/calls/service-call-service.ts");
for (const required of [
  "listServiceCallsForDate",
  "saveBasicServiceCallRow",
  "listServiceCallFormOptions",
  "OPERATING_MONTH_LOCKED",
  "OPERATING_MONTH_DATE_OUT_OF_RANGE",
  "운영월 범위를 벗어난 날짜입니다.",
  "listActiveRooms",
  "listActiveCourses",
  "listActiveEmployees",
  "listActiveCodeItems",
  "listActiveTimeSlots",
  "$transaction",
  "paymentAmount",
  "therapist1Commission",
  "therapist2Commission",
  "earcarePoolAmount",
  "opsCallCredit"
]) {
  if (!service.includes(required)) errors.push(`service-call-service.ts missing ${required}`);
}
for (const prohibited of [".delete(", ".deleteMany(", "displayName: parsed", "roomLabel: parsed", "courseLabel: parsed"]) {
  if (service.includes(prohibited)) errors.push(`service-call-service.ts must not use physical delete or mutable display storage: ${prohibited}`);
}

const actions = read("src/app/(erp)/calls/actions.ts");
for (const required of [
  "\"use server\"",
  "requirePermission(\"call:write\")",
  "ActionResult",
  "safeParse",
  "saveBasicServiceCallRow",
  "revalidatePath(\"/calls\")",
  "AuthorizationError",
  "ServiceCallDomainError",
  "fieldErrors",
  "formError"
]) {
  if (!actions.includes(required)) errors.push(`calls actions missing ${required}`);
}

const page = `${read("src/app/(erp)/calls/page.tsx")}\n${read("src/app/(erp)/calls/loading.tsx")}\n${read("src/app/(erp)/calls/editable-call-grid.tsx")}`;
for (const required of [
  "requireRouteAccess(\"/calls\")",
  "operatingMonthId",
  "serviceDate",
  "min={selectedMonth.startDate}",
  "max={selectedMonth.endDate}",
  "listServiceCallsForDate",
  "listServiceCallFormOptions",
  "EditableCallGrid",
  "이 날짜의 콜이 없습니다",
  "새 콜 행 추가",
  "잠긴 운영월입니다.",
  "Skeleton"
]) {
  if (!page.includes(required)) errors.push(`calls page/grid/loading missing ${required}`);
}

const unitTest = read("src/modules/calls/service-call-service.test.ts");
for (const required of [
  "date with no call ledger rows",
  "stable IDs/codes",
  "assignment columns",
  "time slot sort order",
  "outside the selected operating month range",
  "locked operating month",
  "active masters",
  "assignment role"
]) {
  if (!unitTest.includes(required)) errors.push(`service-call-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-2-1-call-ledger-basic.spec.ts");
for (const required of [
  "Story 2.1",
  "/calls",
  "이 날짜의 콜이 없습니다",
  "새 콜 행 추가",
  "운영월 범위를 벗어난 날짜입니다.",
  "잠긴 운영월입니다.",
  "non-write role",
  "assignments"
]) {
  if (!e2e.includes(required)) errors.push(`story-2-1 e2e missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 2.1 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 2.1 validation passed.");
