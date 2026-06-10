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
  "src/modules/settlements/therapist-daily-settlement-service.ts",
  "src/modules/settlements/therapist-daily-settlement-service.test.ts",
  "src/app/(erp)/settlements/page.tsx",
  "tests/e2e/story-4-2-therapist-daily-settlement.spec.ts",
  "src/modules/settlements/README.md",
  "_bmad-output/implementation-artifacts/4-2-마사지사-일일정산.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-3-5.mjs && node scripts/validate-story-4-2.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-4-2.mjs immediately after validate-story-3-5.mjs");
}

const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
for (const forbidden of ["swr", "@tanstack/react-query", "redis", "ioredis", "socket.io"]) {
  if (dependencies[forbidden]) errors.push(`Story 4.2 must not add ${forbidden}`);
}

const service = read("src/modules/settlements/therapist-daily-settlement-service.ts");
for (const required of [
  "export async function listTherapistDailySettlements",
  "listServiceCallsForDate",
  "employeeId: string",
  "displayName: string",
  "staffCode: string",
  "sortOrder: number",
  "totalCallCount: number",
  "totalCommissionAmount: number",
  "courseBreakdown",
  "assignmentEvidence",
  "warningCounts",
  "role: TherapistAssignmentRole",
  "commissionAmount: number",
  "rateStatus: TherapistRateStatus",
  "applied",
  "zero_policy",
  "missing_policy",
  "THERAPIST_1",
  "THERAPIST_2",
  "course_policy_missing",
  "therapist_rate_missing",
  "second_therapist_required",
  "조회 날짜는 YYYY-MM-DD 형식이어야 합니다."
]) {
  if (!service.includes(required)) errors.push(`therapist-daily-settlement-service.ts missing ${required}`);
}
for (const forbidden of ["recordAuditEvent", "payout:write"]) {
  if (service.includes(forbidden)) errors.push(`therapist-daily-settlement-service.ts must remain read-only and not include ${forbidden}`);
}

const page = read("src/app/(erp)/settlements/page.tsx");
for (const required of [
  "requireRouteAccess(\"/settlements\")",
  "listTherapistDailySettlements",
  "selectedOperatingMonthFor",
  "clampDateToOperatingMonth",
  "운영월 관리로 이동",
  "마사지사 일일정산",
  "이 날짜의 방문완료 콜이 없습니다",
  "정산 조회 실패",
  "재조회",
  "콜별 산출 근거",
  "담당 역할",
  "정책 상태",
  "정책 없음",
  "0원 정책",
  "정책 적용",
  "courseCodes.map",
  "수량/금액"
]) {
  if (!page.includes(required)) errors.push(`settlements/page.tsx missing ${required}`);
}
for (const forbidden of ["use server", "revalidatePath", "requirePermission(\"payout:write\")", "Server Action"]) {
  if (page.includes(forbidden)) errors.push(`settlements/page.tsx must stay read-only and not include ${forbidden}`);
}

const unitTest = read("src/modules/settlements/therapist-daily-settlement-service.test.ts");
for (const required of [
  "방문완료 콜의 마사지사1/2 담당 건",
  "비완료와 invalid D row는 제외",
  "missing rate는 0원 warning",
  "같은 마사지사",
  "zero_policy",
  "missing_policy",
  "call-invalid-d",
  "call-reserved",
  "YYYY-MM-DD"
]) {
  if (!unitTest.includes(required)) errors.push(`therapist-daily-settlement-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-4-2-therapist-daily-settlement.spec.ts");
for (const required of [
  "Story 4.2 therapist daily settlement",
  "story42_settlement",
  "story42_counter",
  "/settlements?operatingMonthId",
  "마사지사 일일정산",
  "E2E42 마사지사1",
  "1,600,000 VND",
  "콜별 산출 근거",
  "정책 warning / 제외 콜",
  "1건 / 1건",
  "A 수량/금액",
  "E 수량/금액",
  "E2E42 마사지사3",
  "정책 없음",
  "이 날짜의 방문완료 콜이 없습니다",
  "toHaveURL(/\\/calls/)"
]) {
  if (!e2e.includes(required)) errors.push(`story-4-2-therapist-daily-settlement.spec.ts missing ${required}`);
}

const readme = read("src/modules/settlements/README.md");
for (const required of [
  "listTherapistDailySettlements",
  "Employee.id",
  "THERAPIST_1",
  "THERAPIST_2",
  "zero_policy",
  "missing_policy"
]) {
  if (!readme.includes(required)) errors.push(`src/modules/settlements/README.md missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 4.2 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 4.2 validation passed.");
