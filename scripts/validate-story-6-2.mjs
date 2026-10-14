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
  "src/app/(erp)/dashboard/monthly/page.tsx",
  "src/app/(erp)/dashboard/monthly/monthly-dashboard-view.tsx",
  "src/app/(erp)/dashboard/dashboard-parts.tsx",
  "src/app/(erp)/dashboard/monthly/loading.tsx",
  "src/app/(erp)/dashboard/monthly/error.tsx",
  "src/lib/authorization.ts",
  "src/lib/routes.ts",
  "src/modules/dashboard/README.md",
  "docs/modules/dashboard.md",
  "_bmad-output/project-context.md",
  "tests/e2e/story-6-2-monthly-dashboard.spec.ts",
  "_bmad-output/implementation-artifacts/6-2-월간-kpi-대시보드와-스냅샷-조회.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-6-1.mjs && node scripts/validate-story-6-2.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-6-2.mjs immediately after validate-story-6-1.mjs");
}

for (const dependency of ["recharts", "chart.js", "@nivo/core", "victory", "d3"]) {
  if (packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]) {
    errors.push(`Story 6.2 must not add chart dependency: ${dependency}`);
  }
}

const service = read("src/modules/dashboard/dashboard-query-service.ts");
for (const required of [
  "export async function getMonthlyDashboardMetrics",
  "MonthlyDashboardMetricsDto",
  "monthlyDashboardQuerySchema",
  "getDailyCallLedgerSummary",
  "listMonthlyClosingPreview",
  "getMonthlyClosingSnapshot",
  "current_recalculation",
  "closed_snapshot",
  "snapshot_missing",
  "미확정 현재 기준",
  "확정 스냅샷 기준",
  "확정 스냅샷을 찾을 수 없습니다",
  "이전 확정 스냅샷",
  "getDailyCallLedgerSummary_range",
  "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND"
]) {
  if (!service.includes(required)) errors.push(`dashboard-query-service.ts missing ${required}`);
}
for (const forbidden of ["recordAuditEvent", ".create(", ".update(", ".delete(", ".upsert("]) {
  if (service.includes(forbidden)) errors.push(`dashboard-query-service.ts must remain read-only and avoid ${forbidden}`);
}

const koMessages = read("src/lib/i18n/messages/ko.ts");

const page = read("src/app/(erp)/dashboard/monthly/page.tsx");
// 티켓 06: 화면은 monthly-dashboard-view.tsx(와 대시보드 공통 조각)가 그리고, 페이지는 권한·주소·조회만 맡는다.
const view = read("src/app/(erp)/dashboard/monthly/monthly-dashboard-view.tsx") + read("src/app/(erp)/dashboard/dashboard-parts.tsx");
for (const required of [
  "requireRouteAccess(\"/dashboard/monthly\")",
  "getMonthlyDashboardMetrics",
  "listOperatingMonths",
  "selectedOperatingMonthFor",
  "redirect(`/dashboard/monthly?"
]) {
  if (!page.includes(required)) errors.push(`monthly dashboard page missing ${required}`);
}
// i18n: 한국어 UI 문구는 t() key로 참조하고 원문은 messages/ko.ts에 보존한다.
// 운영월이 없을 때 안내는 공용 NoOperatingMonthNotice(그 안에 common.goToOperatingMonths)로 옮겨졌다.
if (!page.includes("NoOperatingMonthNotice")) errors.push("monthly dashboard page missing t() key common.goToOperatingMonths");
if (!koMessages.includes("운영월 관리로 이동")) errors.push("messages/ko.ts missing 운영월 관리로 이동");
for (const [key, ko] of [
  ["dashboard.monthly.statusCounts.aria", "월간 상태 건수"],
  ["dashboard.monthly.money.aria", "월간 금액 KPI"],
  ["dashboard.monthly.settlement.aria", "월간 지급 정산 KPI"],
  ["dashboard.monthly.course.aria", "월간 코스별 방문완료"],
  ["dashboard.monthly.basis.currentTitle", "미확정 현재 기준"],
  ["dashboard.monthly.basis.closedSnapshot", "확정 스냅샷 기준"],
  ["dashboard.monthly.previousSnapshot.title", "이전 확정 스냅샷"],
  ["dashboard.monthly.snapshotMissing.title", "확정 스냅샷을 찾을 수 없습니다"]
]) {
  if (!view.includes(`"${key}"`)) errors.push(`monthly dashboard view missing t() key ${key}`);
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}
for (const forbidden of [
  "getDailyCallLedgerSummary",
  "listMonthlyClosingPreview",
  "getMonthlyClosingSnapshot",
  "listServiceCallsForOperatingMonth",
  "listCompletedServiceCallCalculationsForOperatingMonth",
  "snapshotJson",
  "ServiceCall",
  "DailyExpense",
  "recordAuditEvent",
  "action="
]) {
  if (page.includes(forbidden)) errors.push(`monthly dashboard page must not calculate, parse snapshots, or mutate directly: ${forbidden}`);
  // 뷰의 action= 는 ScreenState의 다음 행동(링크) prop이라, 뷰에는 form 자체를 금지한다.
  if (forbidden !== "action=" && view.includes(forbidden)) errors.push(`monthly dashboard view must not calculate, parse snapshots, or mutate directly: ${forbidden}`);
}
if (view.includes("<form")) errors.push("monthly dashboard view must stay read-only (no <form>)");

const loading = read("src/app/(erp)/dashboard/monthly/loading.tsx");
if (!loading.includes("Skeleton")) errors.push("monthly loading.tsx missing Skeleton");
for (const [key, ko] of [
  ["dashboard.monthly.loading.aria", "월간 KPI 대시보드 로딩 중"],
  ["dashboard.monthly.loading.statusCountsAria", "월간 상태 건수 로딩"],
  ["dashboard.monthly.loading.moneyKpiAria", "월간 금액 KPI 로딩"],
  ["dashboard.monthly.loading.settlementAria", "월간 지급 정산 KPI 로딩"]
]) {
  if (!loading.includes(`"${key}"`)) errors.push(`monthly loading.tsx missing t() key ${key}`);
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}

const errorBoundary = read("src/app/(erp)/dashboard/monthly/error.tsx");
for (const required of ["\"use client\"", "kind=\"error\"", "router.refresh", "reset()"]) {
  if (!errorBoundary.includes(required)) errors.push(`monthly error.tsx missing ${required}`);
}
for (const [key, ko] of [
  ["dashboard.error.retry", "다시 시도"],
  ["dashboard.error.refresh", "현재 조건 새로고침"]
]) {
  if (!errorBoundary.includes(`"${key}"`)) errors.push(`monthly error.tsx missing t() key ${key}`);
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}
if (errorBoundary.includes("error.message")) {
  errors.push("monthly error.tsx must not expose raw server error.message to users");
}

// 세 대시보드 화면은 routes.ts의 reportRoles(관리자/카운터/정산담당/조회전용)를 함께 쓰고, 웨이터는 포함하지 않는다.
const routes = read("src/lib/routes.ts");
const reportRolesMatch = routes.match(/const reportRoles: Role\[\] = \[([^\]]*)\]/);
const reportRoles = reportRolesMatch ? reportRolesMatch[1].split(",").map((role) => role.trim().replace(/"/g, "")) : [];
for (const role of ["counter", "settlement_manager", "read_only_viewer"]) {
  if (!reportRoles.includes(role)) {
    errors.push(`authorization.ts must allow ${role} to /dashboard/monthly`);
  }
}
if (reportRoles.includes("waiter")) {
  errors.push("authorization.ts must keep waiter limited to /rooms");
}
const waiterRouteCount = (routes.match(/"waiter"/g) ?? []).length;
if (waiterRouteCount !== 1) errors.push("authorization.ts must keep waiter limited to /rooms");

for (const required of ["shell.tab.dashboardMonthly", "/dashboard/monthly", "reportRoles"]) {
  if (!routes.includes(required)) errors.push(`routes.ts missing ${required}`);
}

const unitTest = read("src/modules/dashboard/dashboard-query-service.test.ts");
for (const required of [
  "getMonthlyDashboardMetrics",
  "운영월 날짜 범위 전체",
  "완료 calculated 콜만",
  "closed_snapshot",
  "snapshot_missing",
  "fallback하지 않는다",
  "재오픈되어 검토중",
  "INVALID_DASHBOARD_QUERY"
]) {
  if (!unitTest.includes(required)) errors.push(`dashboard unit test missing monthly coverage marker ${required}`);
}

const e2e = read("tests/e2e/story-6-2-monthly-dashboard.spec.ts");
for (const required of [
  "Story 6.2 monthly dashboard",
  "/dashboard/monthly",
  "administrator",
  "counter",
  "settlement_manager",
  "read_only_viewer",
  "waiter",
  "월간 상태 건수",
  "월간 금액 KPI",
  "월간 지급 정산 KPI",
  "월간 코스별 방문완료",
  "미확정 현재 기준",
  "확정 스냅샷 기준",
  "확정 스냅샷을 찾을 수 없습니다",
  "월간 KPI 대시보드 로딩 중",
  "월간 KPI를 불러오지 못했습니다",
  "error.message"
]) {
  if (!e2e.includes(required)) errors.push(`story-6-2 e2e missing ${required}`);
}

const readme = read("src/modules/dashboard/README.md");
const docs = read("docs/modules/dashboard.md");
const projectContext = read("_bmad-output/project-context.md");
for (const [label, contents] of [
  ["dashboard README", readme],
  ["dashboard docs", docs],
  ["project-context", projectContext]
]) {
  for (const required of ["Story 6.2", "getMonthlyDashboardMetrics", "sourceBasis", "getMonthlyClosingSnapshot", "snapshot_missing"]) {
    if (!contents.includes(required)) errors.push(`${label} missing ${required}`);
  }
}

if (errors.length > 0) {
  console.error("Story 6.2 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 6.2 validation passed.");
