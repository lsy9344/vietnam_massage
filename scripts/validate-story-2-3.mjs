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
  "src/modules/calls/service-call-service.ts",
  "src/modules/calls/service-call-service.test.ts",
  "src/app/(erp)/calls/editable-call-grid.tsx",
  "tests/e2e/story-2-3-completed-call-calculation.spec.ts",
  "src/modules/calls/README.md",
  "docs/modules/calls.md",
  "_bmad-output/project-context.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-2-3.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-2-3.mjs");
}

const service = read("src/modules/calls/service-call-service.ts");
for (const required of [
  "ServiceCallCalculationStatus",
  "discountAmount",
  "calculationStatus",
  "calculationErrorCode",
  "calculationErrorMessage",
  "isCompletedServiceCallStatus",
  "calculateServiceCallCompletion",
  "VISIT_COMPLETE",
  "discountTypeCode === null ? 0 : 100000",
  "Math.max(policy.basePrice - discountAmount, 0)",
  "basePrice",
  "earcarePoolAmount",
  "opsCallCredit",
  "therapistCourseRate",
  "THERAPIST_RATE_NOT_FOUND",
  "listCompletedServiceCallCalculationsForDate",
  "THERAPIST_1",
  "THERAPIST_2"
]) {
  if (!service.includes(required)) errors.push(`service-call-service.ts missing ${required}`);
}
if (/paymentAmount\s*:\s*null/.test(service) || /opsCallCredit\s*:\s*null/.test(service)) {
  errors.push("service-call-service.ts must not keep Story 2.1 null calculation placeholders");
}

const grid = read("src/app/(erp)/calls/editable-call-grid.tsx");
for (const required of [
  "ComputedCell",
  "bg-readonly",
  "[font-variant-numeric:tabular-nums]",
  "formatVnd",
  "saveStatus === \"error\"",
  "저장 보류 계산 대기",
  "calculationStatus",
  "계산됨",
  "비완료 제외",
  "정책 없음",
  "결제금액",
  "마사지사1수당",
  "마사지사2수당",
  "귀케어풀",
  "콜인정"
]) {
  if (!grid.includes(required)) errors.push(`editable-call-grid.tsx missing ${required}`);
}

const unitTest = read("src/modules/calls/service-call-service.test.ts");
for (const required of [
  "completed-call payment",
  "fixed discount",
  "keeps non-completed statuses out",
  "zero discount",
  "returns the same calculation on listing",
  "missing-rate calculation status",
  "explicit missing-rate",
  "예약 to 방문완료",
  "computed readonly values",
  "both therapist roles as separate 담당 records",
  "listCompletedServiceCallCalculationsForDate",
  "therapist2Commission",
  "earcarePoolAmount",
  "opsCallCredit"
]) {
  if (!unitTest.includes(required)) errors.push(`service-call-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-2-3-completed-call-calculation.spec.ts");
for (const required of [
  "Story 2.3",
  "방문완료",
  "비완료 제외",
  "계산됨",
  "1,500,000",
  "1,400,000",
  "700,000",
  "300,000",
  "100,000",
  "마사지사1 수당 정책을 찾을 수 없습니다.",
  "readonly"
]) {
  if (!e2e.includes(required)) errors.push(`story-2-3 e2e missing ${required}`);
}

const docs = `${read("src/modules/calls/README.md")}\n${read("docs/modules/calls.md")}\n${read("_bmad-output/project-context.md")}`;
for (const required of [
  "Story 2.3",
  "방문완료",
  "100,000",
  "CoursePolicy.basePrice",
  "CoursePolicy.earcarePoolAmount",
  "CoursePolicy.opsCallCredit",
  "TherapistCourseRate.amount",
  "listCompletedServiceCallCalculationsForDate",
  "derived amount columns",
  "UI 계산"
]) {
  if (!docs.includes(required)) errors.push(`calls docs/project context missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 2.3 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 2.3 validation passed.");
