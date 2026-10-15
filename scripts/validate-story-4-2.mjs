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
  "src/app/(erp)/settlements/actions.ts",
  "src/app/(erp)/settlements/payout-confirmation-form.tsx",
  "prisma/migrations/20260615130000_add_therapist_daily_settlement_payment_histories/migration.sql",
  "tests/e2e/story-4-2-therapist-daily-settlement.spec.ts",
  "src/modules/settlements/README.md",
  "_bmad-output/implementation-artifacts/4-2-마사지사-일일정산.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-4-1.mjs && node scripts/validate-story-4-2.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-4-2.mjs immediately after validate-story-4-1.mjs");
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

// ko/vi i18n migration: settlement UI strings moved to t() keys in the ko catalog.
const koCatalog = read("src/lib/i18n/messages/ko.ts");
function requireMoved(contents, fileLabel, key, korean) {
  if (!contents.includes(key)) errors.push(`${fileLabel} missing t() key ${key}`);
  if (!koCatalog.includes(korean)) errors.push(`ko.ts missing ${korean}`);
}

// 티켓 05부터 표와 직원 패널(근거 콜, 코스별 수당)은 클라이언트 뷰에, 오류·빈 상태 안내는 settlement-parts에 있다.
const pageFile = read("src/app/(erp)/settlements/page.tsx");
const page = [
  pageFile,
  read("src/app/(erp)/settlements/therapist-settlement-view.tsx"),
  read("src/app/(erp)/settlements/settlement-parts.tsx")
].join("\n");
for (const required of [
  "requireRouteAccess(\"/settlements\")",
  "listTherapistDailySettlements",
  "selectedOperatingMonthFor",
  "clampDateToOperatingMonth",
  "settlement.courseBreakdown[courseCode]"
]) {
  if (!page.includes(required)) errors.push(`settlements/page.tsx missing ${required}`);
}
// 운영월이 없을 때 안내는 공용 NoOperatingMonthNotice(그 안에 common.goToOperatingMonths)로 옮겨졌다.
requireMoved(page, "settlements/page.tsx", "NoOperatingMonthNotice", "운영월 관리로 이동");
requireMoved(page, "settlements/page.tsx", "settlements.therapist.title", "마사지사 일일정산");
requireMoved(page, "settlements/page.tsx", "settlements.therapist.empty.title", "이 날짜의 방문완료 콜이 없습니다");
requireMoved(page, "settlements/page.tsx", "settlements.therapist.error.title", "정산 조회 실패");
requireMoved(page, "settlements/page.tsx", "settlements.requery", "재조회");
requireMoved(page, "settlements/page.tsx", "settlements.therapist.evidence.title", "콜별 산출 근거");
requireMoved(page, "settlements/page.tsx", "settlements.therapist.evidence.role", "담당 역할");
requireMoved(page, "settlements/page.tsx", "settlements.therapist.column.policyStatus", "정책 상태");
requireMoved(page, "settlements/page.tsx", "settlements.therapist.rateStatus.missingPolicy", "정책 없음");
requireMoved(page, "settlements/page.tsx", "settlements.therapist.rateStatus.zeroPolicy", "0원 정책");
requireMoved(page, "settlements/page.tsx", "settlements.therapist.rateStatus.applied", "정책 적용");
requireMoved(page, "settlements/page.tsx", "settlements.therapist.column.courseQtyAmount", "수량/금액");
for (const forbidden of ["use server", "revalidatePath", "requirePermission(\"payout:write\")", "Server Action"]) {
  if (pageFile.includes(forbidden)) errors.push(`settlements/page.tsx must stay read-only and not include ${forbidden}`);
}

const actions = read("src/app/(erp)/settlements/actions.ts");
for (const required of [
  "export type TherapistDailySettlementPayoutActionState",
  "mapPayoutConfirmationActionError",
  "confirmTherapistDailySettlementPayoutAction",
  "reconfirmTherapistDailySettlementPayoutAction",
  "releaseTherapistDailySettlementPayoutAction",
  "_previousState: TherapistDailySettlementPayoutActionState",
  "Promise<TherapistDailySettlementPayoutActionState>",
  "return mapPayoutConfirmationActionError(error, locale)"
]) {
  if (!actions.includes(required)) errors.push(`settlements/actions.ts missing ${required}`);
}

const payoutForm = read("src/app/(erp)/settlements/payout-confirmation-form.tsx");
for (const required of [
  "\"use client\"",
  "useActionState",
  "ConfirmPayoutButton",
  "ReasonPayoutForm",
  "role=\"alert\"",
  "formError"
]) {
  if (!payoutForm.includes(required)) errors.push(`payout-confirmation-form.tsx missing ${required}`);
}

const paymentHistoryMigration = read("prisma/migrations/20260615130000_add_therapist_daily_settlement_payment_histories/migration.sql");
for (const required of [
  "CREATE TABLE \"therapist_daily_settlement_payment_histories\"",
  "idx_tdsp_histories_payment_changed",
  "idx_tdsp_histories_month_date_emp",
  "idx_tdsp_histories_actor_changed",
  "uq_tdsp_id_month_date_employee",
  "FOREIGN KEY (\"payment_id\", \"operating_month_id\", \"service_date\", \"employee_id\")",
  "FOREIGN KEY (\"changed_by_account_id\") REFERENCES \"user_accounts\""
]) {
  if (!paymentHistoryMigration.includes(required)) errors.push(`payment history migration missing ${required}`);
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
  "YYYY-MM-DD",
  // 티켓 30: 지급완료를 지급 확인(ADR 0004) 사건으로 대체했다.
  "confirmTherapistDailySettlementPayout",
  "reconfirmTherapistDailySettlementPayout",
  "releaseTherapistDailySettlementPayout",
  "확인 금액 미기록"
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
  // 티켓 05부터 코스별 수당은 직원 패널에 그날 담당한 코스만 보인다.
  "A 수량/금액",
  "D 수량/금액",
  "E2E42 마사지사3",
  "정책 없음",
  "이 날짜의 방문완료 콜이 없습니다",
  "toHaveURL(/\\/calls/)",
  // 티켓 30: 지급완료 버튼을 지급 확인(확인/재확인/해제, ADR 0004)으로 대체했다.
  "지급 확인",
  "재확인",
  "확인 해제",
  "payoutConfirmationEvent"
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
