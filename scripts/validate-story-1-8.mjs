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
  "src/modules/masters/course-schema.ts",
  "src/modules/masters/course-service.ts",
  "src/modules/masters/course-service.test.ts",
  "src/app/(erp)/masters/courses/actions.ts",
  "src/app/(erp)/masters/courses/page.tsx",
  "src/app/(erp)/masters/courses/course-forms.tsx",
  "src/lib/navigation.ts",
  "scripts/validate-story-1-8.mjs",
  "tests/e2e/story-1-8-courses-policies.spec.ts",
  "src/modules/masters/README.md",
  "docs/modules/masters.md",
  "_bmad-output/project-context.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-1-8.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-1-8.mjs");
}

const prismaSchema = read("prisma/schema.prisma");
for (const required of [
  "model Course",
  "model CoursePolicy",
  "model TherapistCourseRate",
  "model OpsDailyIncentiveRule",
  "model OpsMonthlyIncentiveRule",
  "@@map(\"courses\")",
  "@@map(\"course_policies\")",
  "@@map(\"therapist_course_rates\")",
  "@@map(\"ops_daily_incentive_rules\")",
  "@@map(\"ops_monthly_incentive_rules\")",
  "@map(\"course_id\")",
  "@map(\"duration_minutes\")",
  "@map(\"base_price\")",
  "@map(\"ops_call_credit\")",
  "@map(\"earcare_pool_amount\")",
  "@map(\"requires_second_therapist\")",
  "@map(\"tv_display_name\")",
  "@map(\"effective_from_month\")",
  "@map(\"effective_to_month\")",
  "@map(\"threshold_call_count\")",
  "@map(\"personal_amount\")",
  "@map(\"total_amount\")",
  "@map(\"lead_share\")",
  "@map(\"counter_team_share\")",
  "@map(\"waiter_team_share\")",
  "@map(\"is_active\")",
  "@map(\"created_at\")",
  "@map(\"updated_at\")"
]) {
  if (!prismaSchema.includes(required)) errors.push(`prisma/schema.prisma missing ${required}`);
}

const schema = read("src/modules/masters/course-schema.ts");
for (const required of [
  "courseCodes",
  "defaultCourseSeeds",
  "60분 A코스 누루마사지",
  "90분 D코스 2:1 코스",
  "requiresSecondTherapist: true",
  "A 누루60",
  "D 2:1 90",
  "defaultOpsDailyIncentiveSeeds",
  "defaultOpsMonthlyIncentiveSeeds",
  "createCoursePolicySchema",
  "createTherapistCourseRateSchema",
  "YYYY-MM",
  "금액은 0 이상 정수",
  "분배율"
]) {
  if (!schema.includes(required)) errors.push(`course-schema.ts missing ${required}`);
}

const service = read("src/modules/masters/course-service.ts");
for (const required of [
  "ensureDefaultCoursesAndPolicies",
  "listCourses",
  "listActiveCourses",
  "getCoursePolicyForMonth",
  "getTherapistCourseRateForMonth",
  "listOpsDailyIncentiveRulesForMonth",
  "listOpsMonthlyIncentiveRulesForMonth",
  "createCoursePolicy",
  "updateCoursePolicy",
  "deactivateCourse",
  "createTherapistCourseRate",
  "updateTherapistCourseRate",
  "endTherapistCourseRate",
  "createOpsDailyIncentiveRule",
  "updateOpsDailyIncentiveRule",
  "createOpsMonthlyIncentiveRule",
  "updateOpsMonthlyIncentiveRule",
  "recordAuditEvent",
  "course.created",
  "course.policy_changed",
  "course.deactivated",
  "therapist_course_rate.created",
  "therapist_course_rate.changed",
  "therapist_course_rate.ended",
  "ops_daily_incentive_rule.created",
  "ops_daily_incentive_rule.changed",
  "ops_monthly_incentive_rule.created",
  "ops_monthly_incentive_rule.changed",
  "targetType: \"course\"",
  "targetType: \"course_policy\"",
  "targetType: \"therapist_course_rate\"",
  "targetType: \"ops_daily_incentive_rule\"",
  "targetType: \"ops_monthly_incentive_rule\"",
  "$transaction",
  "THR-",
  "staffCode",
  "rangesOverlap"
]) {
  if (!service.includes(required)) errors.push(`course-service.ts missing ${required}`);
}
for (const prohibited of [".delete(", ".deleteMany(", "where: { name", "where: { displayName", "where: { tvDisplayName"]) {
  if (service.includes(prohibited)) errors.push(`course-service.ts must not use physical delete or mutable display lookup: ${prohibited}`);
}

const actions = read("src/app/(erp)/masters/courses/actions.ts");
for (const required of [
  "\"use server\"",
  "requirePermission(\"employee:write\")",
  "ActionResult",
  "FormData",
  "safeParse",
  "revalidatePath(\"/masters/courses\")",
  "fieldErrors",
  "formError",
  "권한이 없습니다.",
  "CourseDomainError"
]) {
  if (!actions.includes(required)) errors.push(`courses actions missing ${required}`);
}

const page = `${read("src/app/(erp)/masters/courses/page.tsx")}\n${read("src/app/(erp)/masters/courses/course-forms.tsx")}`;
for (const required of [
  "requireRouteAccess(\"/masters/courses\")",
  "ensureDefaultCoursesAndPolicies",
  "CoursePolicyManager",
  "코스/수당/인센",
  "마사지사2",
  "TV 표시명",
  "0원 수당",
  "운영팀 일일 인센",
  "운영팀 월 인센",
  "비활성 처리",
  "정책 종료"
]) {
  if (!page.includes(required)) errors.push(`courses page missing ${required}`);
}
if (page.includes("삭제")) errors.push("/masters/courses page must not present physical delete wording");

const navigation = read("src/lib/navigation.ts");
for (const required of ["코스/수당/인센", "/masters/courses", "administrator"]) {
  if (!navigation.includes(required)) errors.push(`navigation.ts missing ${required}`);
}
if (navigation.includes("disabled")) errors.push("navigation must hide unauthorized course links, not disable them");

const unitTest = read("src/modules/masters/course-service.test.ts");
for (const required of [
  "default course and incentive seeds",
  "D코스",
  "idempotently",
  "stable Course.id and Course.code",
  "effective-month policies",
  "THR staffCode",
  "does not hide zero rates",
  "prevents rate overlap",
  "plain JSON audit snapshots",
  "CourseDomainError"
]) {
  if (!unitTest.includes(required)) errors.push(`course-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-1-8-courses-policies.spec.ts");
for (const required of [
  "Story 1.8",
  "/masters/courses",
  "A 누루60",
  "D코스",
  "마사지사2 필요: Y",
  "0원",
  "30콜",
  "1000",
  "course.policy_changed",
  "non-admin"
]) {
  if (!e2e.includes(required)) errors.push(`story-1-8 e2e missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 1.8 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 1.8 validation passed.");
