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
  "src/modules/settlements/ops-monthly-incentive-service.ts",
  "src/modules/settlements/ops-monthly-incentive-service.test.ts",
  "src/app/(erp)/settlements/operations/monthly/page.tsx",
  "tests/e2e/story-4-6-ops-monthly-incentive.spec.ts",
  "src/modules/settlements/README.md",
  "_bmad-output/implementation-artifacts/4-6-운영팀-월-인센-미리보기.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-4-5.mjs && node scripts/validate-story-4-6.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-4-6.mjs immediately after validate-story-4-5.mjs");
}

const callsService = read("src/modules/calls/service-call-service.ts");
for (const required of [
  "export async function listServiceCallsForOperatingMonth",
  "export async function listCompletedServiceCallCalculationsForOperatingMonth",
  "serviceDate: {",
  "gte:",
  "lte:",
  "calculationStatus === \"calculated\"",
  "opsCallCredit"
]) {
  if (!callsService.includes(required)) errors.push(`service-call-service.ts missing monthly helper requirement: ${required}`);
}

const service = read("src/modules/settlements/ops-monthly-incentive-service.ts");
for (const required of [
  "export async function listOpsMonthlyIncentivePreview",
  "OpsMonthlyIncentiveDomainError",
  "z.object",
  "safeParse",
  "completedServiceCallCalculationsFromRows",
  "listServiceCallsForOperatingMonth",
  "opsMonthlyIncentiveRule",
  "effectiveFromMonth",
  "effectiveToMonth",
  "thresholdCallCount",
  "totalAmount",
  "leadShare",
  "counterTeamShare",
  "waiterTeamShare",
  "monthlyOpsCallCredit",
  "calculation.opsCallCredit",
  "missing_policy",
  "below_threshold",
  "appliedThresholdCallCount",
  "warningCounts",
  "notCompleted",
  "coursePolicyMissing",
  "therapistRateMissing",
  "secondTherapistRequired",
  "EmployeeRecord",
  "employeeGroup: \"OPERATIONS\"",
  "staffCode",
  "sortOrder",
  "Employee.id",
  "Math.floor",
  "undistributedAmount",
  "previewStatus",
  "closed_current",
  "draft_current",
  "callEvidence"
]) {
  if (!service.includes(required)) errors.push(`ops-monthly-incentive-service.ts missing ${required}`);
}
for (const forbidden of [
  "recordAuditEvent",
  "opsMonthlyIncentivePreview",
  "opsMonthlyIncentivePayout",
  "payoutResult",
  "monthlyClose",
  "closingSnapshot",
  "createOpsMonthly",
  "updateOpsMonthly",
  "deleteMany",
  "create({",
  "update({",
  "updateMany"
]) {
  if (service.includes(forbidden)) errors.push(`ops-monthly-incentive-service.ts must remain read-only/no-persistence: ${forbidden}`);
}

const page = read("src/app/(erp)/settlements/operations/monthly/page.tsx");
for (const required of [
  "requireRouteAccess(\"/settlements/operations/monthly\")",
  "selectedOperatingMonthFor",
  "listOperatingMonths",
  "listOpsMonthlyIncentivePreview",
  "운영팀 월인센",
  "운영월",
  "월 총콜",
  "적용 threshold",
  "전체 월인센",
  "팀별 분배",
  "직원별 월 인센 미리보기",
  "월 총콜 산출 근거",
  "정책 없음",
  "최저 구간 미달",
  "미확정 미리보기",
  "현재 기준 미리보기",
  "확정값은 월마감 스냅샷 기준",
  "role=\"alert\""
]) {
  if (!page.includes(required)) errors.push(`monthly page.tsx missing ${required}`);
}
for (const forbidden of ["use server", "action=", "saveOps", "revalidatePath", "recordAuditEvent", "snapshot 생성"]) {
  if (page.includes(forbidden)) errors.push(`monthly page.tsx must not add write/closing behavior: ${forbidden}`);
}

for (const tabPath of [
  "src/app/(erp)/settlements/page.tsx",
  "src/app/(erp)/settlements/earcare/page.tsx",
  "src/app/(erp)/settlements/operations/page.tsx"
]) {
  const contents = read(tabPath);
  if (!contents.includes("/settlements/operations/monthly") || !contents.includes("운영팀 월인센")) {
    errors.push(`${tabPath} must include 운영팀 월인센 tab link`);
  }
}

const unitTest = read("src/modules/settlements/ops-monthly-incentive-service.test.ts");
for (const required of [
  "opsCallCredit",
  "highest effective threshold",
  "below_threshold",
  "missing_policy",
  "notCompleted",
  "coursePolicyMissing",
  "therapistRateMissing",
  "secondTherapistRequired",
  "deterministic",
  "locked",
  "마감확정",
  "OPERATING_MONTH_NOT_FOUND",
  "1300",
  "1400",
  "1500",
  "Employee.id",
  "noOpsEmployees",
  "noCounterMembers",
  "duplicateLead"
]) {
  if (!unitTest.includes(required)) errors.push(`ops-monthly-incentive-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-4-6-ops-monthly-incentive.spec.ts");
for (const required of [
  "Story 4.6 operations monthly incentive",
  "story46_settlement",
  "story46_counter",
  "story46_waiter",
  "story46_readonly",
  "/settlements/operations/monthly?operatingMonthId",
  "운영팀 월인센",
  "월 총콜",
  "1100콜 이상",
  "5,000,000 VND",
  "분배율 30%",
  "분배율 35%",
  "정책 없음",
  "현재 기준 미리보기",
  "확정값은 월마감 스냅샷 기준",
  "toHaveURL(/\\/rooms/)",
  "toHaveURL(/\\/calls/)"
]) {
  if (!e2e.includes(required)) errors.push(`story-4-6-ops-monthly-incentive.spec.ts missing ${required}`);
}

const readme = read("src/modules/settlements/README.md");
for (const required of [
  "Ops Monthly Incentive Preview Service",
  "listOpsMonthlyIncentivePreview",
  "OpsMonthlyIncentiveRule",
  "opsCallCredit",
  "effective-month",
  "30/35/35",
  "deterministic remainder",
  "Employee.id",
  "read-only",
  "no persistence",
  "no closing snapshot"
]) {
  if (!readme.includes(required)) errors.push(`src/modules/settlements/README.md missing ${required}`);
}

const schema = read("prisma/schema.prisma");
for (const forbidden of ["OpsMonthlyIncentivePreview", "ops_monthly_incentive_previews", "OpsMonthlyIncentivePayout", "ops_monthly_incentive_payouts"]) {
  if (schema.includes(forbidden)) errors.push(`schema.prisma must not include out-of-scope persistence model: ${forbidden}`);
}

if (errors.length > 0) {
  console.error("Story 4.6 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 4.6 validation passed.");
