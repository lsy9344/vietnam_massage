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
  "src/app/(erp)/calls/actions.ts",
  "src/app/(erp)/calls/editable-call-grid.tsx",
  "tests/e2e/story-2-4-d-course-second-therapist.spec.ts",
  "src/modules/calls/README.md",
  "docs/modules/calls.md",
  "_bmad-output/project-context.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-2-4.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-2-4.mjs");
}

const service = read("src/modules/calls/service-call-service.ts");
for (const required of [
  "D_COURSE_SECOND_THERAPIST_REQUIRED",
  "requiresSecondTherapist",
  "assertSecondTherapistRequirement",
  "second_therapist_required",
  "ServiceCallDomainError",
  "findCoursePolicyForCalculation",
  "listCompletedServiceCallCalculationsForDate",
  "therapist2Id",
  "방문완료",
  "VISIT_COMPLETE"
]) {
  if (!service.includes(required)) errors.push(`service-call-service.ts missing ${required}`);
}
if (/course\.code\s*={2,3}\s*["']D["']/.test(service) || /courseLabel.*D코스/.test(service)) {
  errors.push("D-course validation must not branch on course code/label text in service-call-service.ts");
}

const actions = read("src/app/(erp)/calls/actions.ts");
for (const required of ["D_COURSE_SECOND_THERAPIST_REQUIRED", "fieldErrors: { therapist2Id", "domainErrorCode", "formError"]) {
  if (!actions.includes(required)) errors.push(`calls actions missing ${required}`);
}

const grid = read("src/app/(erp)/calls/editable-call-grid.tsx");
for (const required of [
  "aria-invalid",
  "aria-describedby",
  "role=\"alert\"",
  "border-danger",
  "ring-danger",
  "!",
  "therapist2Id",
  // i18n 전환: 저장/계산 문구는 t() key로 참조하고, 원문은 messages/ko.ts에 보존한다.
  "calls.save.error",
  "calls.save.retry",
  "calls.calc.errorPending",
  "second_therapist_required"
]) {
  if (!grid.includes(required)) errors.push(`editable-call-grid.tsx missing ${required}`);
}
const koMessages = read("src/lib/i18n/messages/ko.ts");
for (const label of ["저장 보류", "재시도", "저장 보류 계산 대기"]) {
  if (!koMessages.includes(label)) errors.push(`messages/ko.ts missing calls grid label: ${label}`);
}

const unitTest = read("src/modules/calls/service-call-service.test.ts");
for (const required of [
  "rejects D-course saves without therapist2",
  "D_COURSE_SECOND_THERAPIST_REQUIRED",
  "before row, history, assignment, or audit writes",
  "allows non-required courses without therapist2",
  "D-course completion with two therapist commissions",
  "existing invalid completed D-course rows",
  "second_therapist_required"
]) {
  if (!unitTest.includes(required)) errors.push(`service-call-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-2-4-d-course-second-therapist.spec.ts");
for (const required of [
  "Story 2.4",
  "requiresSecondTherapist",
  "D코스는 마사지사2 필수",
  "저장 보류",
  "aria-invalid",
  "aria-describedby",
  "role",
  "alert",
  "재시도",
  "3,200,000",
  "900,000"
]) {
  if (!e2e.includes(required)) errors.push(`story-2-4 e2e missing ${required}`);
}

const docs = `${read("src/modules/calls/README.md")}\n${read("docs/modules/calls.md")}\n${read("_bmad-output/project-context.md")}`;
for (const required of [
  "Story 2.4",
  "CoursePolicy.requiresSecondTherapist",
  "D_COURSE_SECOND_THERAPIST_REQUIRED",
  "마사지사2",
  "aria-invalid",
  "aria-describedby",
  "role=\"alert\"",
  "invalid completed D-row",
  "second_therapist_required"
]) {
  if (!docs.includes(required)) errors.push(`calls docs/project context missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 2.4 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 2.4 validation passed.");
