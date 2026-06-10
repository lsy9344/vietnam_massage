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
  "src/modules/settlements/earcare-daily-settlement-service.ts",
  "src/modules/settlements/earcare-daily-settlement-service.test.ts",
  "src/modules/settlements/earcare-attendance-service.ts",
  "src/app/(erp)/settlements/earcare/page.tsx",
  "src/app/(erp)/settlements/earcare/actions.ts",
  "src/app/(erp)/settlements/earcare/earcare-attendance-table.tsx",
  "tests/e2e/story-4-4-earcare-daily-settlement.spec.ts",
  "src/modules/settlements/README.md",
  "_bmad-output/implementation-artifacts/4-4-귀케어-일일정산.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-4-3.mjs && node scripts/validate-story-4-4.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-4-4.mjs immediately after validate-story-4-3.mjs");
}

const service = read("src/modules/settlements/earcare-daily-settlement-service.ts");
for (const required of [
  "export async function listEarcareDailySettlements",
  "EarcareDailySettlementDomainError",
  "z.object",
  "operatingMonthId",
  "serviceDate",
  "OPERATING_MONTH_NOT_FOUND",
  "OPERATING_MONTH_DATE_OUT_OF_RANGE",
  "listEarcareAttendanceForDate",
  "listCompletedServiceCallCalculationsForDate",
  "listServiceCallsForDate",
  "earcarePoolTotal",
  "sourceCallCount",
  "eligibleCount",
  "baseShareAmount",
  "Math.floor(earcarePoolTotal / eligibleCount)",
  "remainderAmount",
  "sortOrder",
  "employeeId.localeCompare",
  "remainderShareAmount",
  "distributedAmount",
  "undistributedAmount",
  "warningCounts",
  "notCompleted",
  "coursePolicyMissing",
  "therapistRateMissing",
  "secondTherapistRequired",
  "poolEvidence",
  "calculationBasis"
]) {
  if (!service.includes(required)) errors.push(`earcare-daily-settlement-service.ts missing ${required}`);
}
for (const forbidden of [
  "recordAuditEvent",
  "prisma.earcareDailySettlement",
  "payoutResult",
  "monthlyClose",
  "closingSnapshot",
  "createEarcare",
  "updateEarcare"
]) {
  if (service.includes(forbidden)) errors.push(`earcare-daily-settlement-service.ts must not implement out-of-scope ${forbidden}`);
}

const page = read("src/app/(erp)/settlements/earcare/page.tsx");
for (const required of [
  "requireRouteAccess(\"/settlements/earcare\")",
  "selectedOperatingMonthFor",
  "clampDateToOperatingMonth",
  "listEarcareAttendanceForDate",
  "listEarcareDailySettlements",
  "귀케어 일일정산",
  "EarcareSettlementSummary",
  "방문완료 풀",
  "정상 근무자",
  "지급 합계",
  "미분배",
  "귀케어사별 지급액",
  "풀 산출 근거",
  "EarcareAttendanceTable",
  "잠긴 운영월입니다",
  "재조회"
]) {
  if (!page.includes(required)) errors.push(`earcare page.tsx missing ${required}`);
}
for (const forbidden of ["saveEarcarePayout", "payoutAmount: {", "closing", "snapshot"]) {
  if (page.includes(forbidden)) errors.push(`earcare page.tsx must not implement out-of-scope ${forbidden}`);
}

const action = read("src/app/(erp)/settlements/earcare/actions.ts");
if (!action.includes("upsertEarcareAttendance") || !action.includes("revalidatePath(\"/settlements/earcare\")")) {
  errors.push("earcare actions.ts must keep Story 4.3 attendance save and route revalidation");
}
for (const forbidden of ["saveEarcarePayout", "listEarcareDailySettlements", "payoutAmount", "recordAuditEvent("]) {
  if (action.includes(forbidden)) errors.push(`earcare actions.ts must not add payout calculation mutation/audit behavior: ${forbidden}`);
}

const table = read("src/app/(erp)/settlements/earcare/earcare-attendance-table.tsx");
for (const required of ["useActionState", "저장중", "저장됨", "재시도", "저장 실패", "지급 대상", "제외:"]) {
  if (!table.includes(required)) errors.push(`earcare-attendance-table.tsx missing existing save UX ${required}`);
}

const unitTest = read("src/modules/settlements/earcare-daily-settlement-service.test.ts");
for (const required of [
  "calculated completed earcare pools",
  "notCompleted",
  "coursePolicyMissing",
  "therapistRateMissing",
  "secondTherapistRequired",
  "distributes remainder",
  "Employee.id as the deterministic remainder tie-breaker",
  "no earcare employee is NORMAL",
  "locked operating months readable",
  "OPERATING_MONTH_DATE_OUT_OF_RANGE",
  "근무상태 변경 반영"
]) {
  if (!unitTest.includes(required)) errors.push(`earcare-daily-settlement-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-4-4-earcare-daily-settlement.spec.ts");
for (const required of [
  "Story 4.4 earcare daily settlement",
  "story44_settlement",
  "story44_counter",
  "/settlements/earcare?operatingMonthId",
  "귀케어 일일정산",
  "방문완료 풀",
  "귀케어사별 지급액",
  "정상 근무자 0명",
  "잠긴 운영월입니다",
  "toHaveURL(/\\/calls/)"
]) {
  if (!e2e.includes(required)) errors.push(`story-4-4-earcare-daily-settlement.spec.ts missing ${required}`);
}

const readme = read("src/modules/settlements/README.md");
for (const required of [
  "listEarcareDailySettlements",
  "listCompletedServiceCallCalculationsForDate",
  "earcarePoolTotal",
  "baseShareAmount = Math.floor",
  "remainderAmount",
  "undistributedAmount",
  "Locked operating months remain readable",
  "no payout persistence"
]) {
  if (!readme.includes(required)) errors.push(`src/modules/settlements/README.md missing ${required}`);
}

const schema = read("prisma/schema.prisma");
for (const forbidden of ["EarcareDailySettlement", "earcare_daily_settlements", "earcarePayoutAmount", "earcare_payout_amount"]) {
  if (schema.includes(forbidden)) errors.push(`schema.prisma must not include payout persistence: ${forbidden}`);
}

if (errors.length > 0) {
  console.error("Story 4.4 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 4.4 validation passed.");
