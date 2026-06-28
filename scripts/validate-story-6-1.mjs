import { existsSync, readFileSync } from "node:fs";

const errors = [];

function requireFile(path) {
  if (!existsSync(path)) errors.push(`Missing required file: ${path}`);
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
  "src/modules/dashboard/dashboard-query-service.ts",
  "src/modules/dashboard/dashboard-query-service.test.ts",
  "src/app/(erp)/dashboard/today/page.tsx",
  "src/app/(erp)/dashboard/today/loading.tsx",
  "src/app/(erp)/dashboard/today/error.tsx",
  "src/modules/dashboard/README.md",
  "docs/modules/dashboard.md",
  "_bmad-output/project-context.md",
  "tests/e2e/story-6-1-today-dashboard.spec.ts",
  "_bmad-output/implementation-artifacts/6-1-오늘-kpi-대시보드.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-5-6.mjs && node scripts/validate-story-6-1.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-6-1.mjs immediately after validate-story-5-6.mjs");
}

for (const dependency of ["recharts", "chart.js", "@nivo/core", "victory", "d3"]) {
  if (packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]) {
    errors.push(`Story 6.1 must not add chart dependency: ${dependency}`);
  }
}

const service = read("src/modules/dashboard/dashboard-query-service.ts");
for (const required of [
  "export async function getTodayDashboardMetrics",
  "DashboardQueryDomainError",
  "getDailyCallLedgerSummary",
  "listTherapistDailySettlements",
  "statusCounts",
  "financials",
  "therapistSummary",
  "courseCompletions",
  "warningCounts",
  "emptyState",
  "sourceBasis",
  "DASHBOARD_DATE_OUT_OF_RANGE"
]) {
  if (!service.includes(required)) errors.push(`dashboard-query-service.ts missing ${required}`);
}
for (const forbidden of ["recordAuditEvent", ".create(", ".update(", ".delete(", ".upsert(", "monthlyClosing"]) {
  if (service.includes(forbidden)) errors.push(`dashboard-query-service.ts must remain read-only and avoid ${forbidden}`);
}

const koMessages = read("src/lib/i18n/messages/ko.ts");

const page = read("src/app/(erp)/dashboard/today/page.tsx");
for (const required of [
  "requireRouteAccess(\"/dashboard/today\")",
  "getTodayDashboardMetrics",
  "listOperatingMonths",
  "selectedOperatingMonthFor",
  "clampDateToOperatingMonth",
  "redirect(`/dashboard/today?"
]) {
  if (!page.includes(required)) errors.push(`today dashboard page missing ${required}`);
}
// i18n: 한국어 UI 문구는 t() key로 참조하고 원문은 messages/ko.ts에 보존한다.
for (const [key, ko] of [
  ["common.goToOperatingMonths", "운영월 관리로 이동"],
  ["dashboard.today.statusCounts.aria", "오늘 상태 건수"],
  ["dashboard.today.moneyKpi.aria", "오늘 금액 KPI"],
  ["dashboard.today.course.title", "코스별 방문완료"],
  ["dashboard.today.therapist.title", "마사지사 담당콜/정산"],
  ["dashboard.today.empty.noCallsTitle", "이 날짜의 콜이 없습니다"],
  ["dashboard.today.warning.excludedTitle", "집계 제외 항목이 있습니다"]
]) {
  if (!page.includes(`"${key}"`)) errors.push(`today dashboard page missing t() key ${key}`);
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}
for (const forbidden of [
  "getDailyCallLedgerSummary",
  "listTherapistDailySettlements",
  "listServiceCallsForDate",
  "listCompletedServiceCallCalculationsForDate",
  "ServiceCall",
  "DailyExpense",
  "recordAuditEvent",
  "action="
]) {
  if (page.includes(forbidden)) errors.push(`today dashboard page must not calculate or mutate directly: ${forbidden}`);
}

const loading = read("src/app/(erp)/dashboard/today/loading.tsx");
if (!loading.includes("Skeleton")) errors.push("today loading.tsx missing Skeleton");
for (const [key, ko] of [
  ["dashboard.today.loading.aria", "오늘 KPI 대시보드 로딩 중"],
  ["dashboard.today.loading.statusCountsAria", "오늘 상태 건수 로딩"],
  ["dashboard.today.loading.moneyKpiAria", "오늘 금액 KPI 로딩"],
  ["dashboard.today.loading.detailSummaryAria", "상세 요약 로딩"]
]) {
  if (!loading.includes(`"${key}"`)) errors.push(`today loading.tsx missing t() key ${key}`);
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}

const errorBoundary = read("src/app/(erp)/dashboard/today/error.tsx");
for (const required of ["\"use client\"", "role=\"alert\"", "router.refresh", "reset()"]) {
  if (!errorBoundary.includes(required)) errors.push(`today error.tsx missing ${required}`);
}
for (const [key, ko] of [
  ["dashboard.error.retry", "다시 시도"],
  ["dashboard.error.refresh", "현재 조건 새로고침"]
]) {
  if (!errorBoundary.includes(`"${key}"`)) errors.push(`today error.tsx missing t() key ${key}`);
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}
if (errorBoundary.includes("error.message")) {
  errors.push("today error.tsx must not expose raw server error.message to users");
}

const unitTest = read("src/modules/dashboard/dashboard-query-service.test.ts");
for (const required of [
  "getTodayDashboardMetrics",
  "예약/방문완료/노쇼/취소",
  "비완료 금액 제외",
  "same",
  "courseCompletions",
  "warningCounts",
  "DASHBOARD_DATE_OUT_OF_RANGE"
]) {
  if (!unitTest.includes(required)) errors.push(`dashboard unit test missing coverage marker ${required}`);
}

const e2e = read("tests/e2e/story-6-1-today-dashboard.spec.ts");
for (const required of [
  "Story 6.1 today dashboard",
  "/dashboard/today",
  "administrator",
  "counter",
  "settlement_manager",
  "read_only_viewer",
  "waiter",
  "오늘 상태 건수",
  "오늘 금액 KPI",
  "코스별 방문완료",
  "마사지사 담당콜/정산",
  "이 날짜의 콜이 없습니다",
  "오늘 KPI 대시보드 로딩 중",
  "오늘 KPI를 불러오지 못했습니다"
]) {
  if (!e2e.includes(required)) errors.push(`story-6-1 e2e missing ${required}`);
}
for (const required of ["B 코스 방문완료", "D 코스 방문완료", "error.message"]) {
  if (!e2e.includes(required)) errors.push(`story-6-1 e2e missing tightened review marker ${required}`);
}

const readme = read("src/modules/dashboard/README.md");
const docs = read("docs/modules/dashboard.md");
const projectContext = read("_bmad-output/project-context.md");
for (const [label, contents] of [
  ["dashboard README", readme],
  ["dashboard docs", docs],
  ["project-context", projectContext]
]) {
  for (const required of ["Story 6.1", "getTodayDashboardMetrics", "getDailyCallLedgerSummary", "listTherapistDailySettlements", "read-only"]) {
    if (!contents.includes(required)) errors.push(`${label} missing ${required}`);
  }
}

if (errors.length > 0) {
  console.error("Story 6.1 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 6.1 validation passed.");
