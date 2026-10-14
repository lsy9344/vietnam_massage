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
  "src/modules/calls/service-call-service.ts",
  "src/app/(erp)/dashboard/reports/page.tsx",
  "src/app/(erp)/dashboard/reports/reports-view.tsx",
  "src/app/(erp)/dashboard/reports/report-charts.tsx",
  "src/app/(erp)/dashboard/chart-scale.ts",
  "src/app/(erp)/dashboard/reports/loading.tsx",
  "src/app/(erp)/dashboard/reports/error.tsx",
  "src/lib/authorization.ts",
  "src/lib/routes.ts",
  "src/modules/dashboard/README.md",
  "docs/modules/dashboard.md",
  "_bmad-output/project-context.md",
  "tests/e2e/story-6-3-graph-report.spec.ts",
  "_bmad-output/implementation-artifacts/6-3-주인용-그래프-리포트.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-6-2.mjs && node scripts/validate-story-6-3.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-6-3.mjs immediately after validate-story-6-2.mjs");
}

for (const dependency of ["recharts", "chart.js", "@nivo/core", "victory", "d3"]) {
  if (packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]) {
    errors.push(`Story 6.3 uses project-local SVG/CSS chart primitives and must not add chart dependency: ${dependency}`);
  }
}

const service = read("src/modules/dashboard/dashboard-query-service.ts");
for (const required of [
  "export async function getDashboardGraphReport",
  "DashboardGraphReportDto",
  "DashboardGraphReportDependencies",
  "listCompletedServiceCallCalculationsForOperatingMonth",
  "listTherapistDailySettlements",
  "listRoomStatuses",
  "dailyRevenueTrend",
  "courseMix",
  "therapistCallRanking",
  "therapistSettlementRanking",
  "roomStatusDistribution",
  "noShowCancelTrend",
  "opsIncentiveOrPayoutComposition",
  "snapshot_missing",
  "확정 스냅샷을 찾을 수 없습니다"
]) {
  if (!service.includes(required)) errors.push(`dashboard-query-service.ts missing ${required}`);
}
for (const forbidden of ["recordAuditEvent", ".create(", ".update(", ".delete(", ".upsert("]) {
  if (service.includes(forbidden)) errors.push(`dashboard-query-service.ts must remain read-only and avoid ${forbidden}`);
}

const callsService = read("src/modules/calls/service-call-service.ts");
for (const required of ["CompletedServiceCallCalculationDto", "courseCode: string", "courseCode: row.courseCode"]) {
  if (!callsService.includes(required)) errors.push(`service-call-service.ts missing calculated course code extension: ${required}`);
}

const koMessages = read("src/lib/i18n/messages/ko.ts");

const page = read("src/app/(erp)/dashboard/reports/page.tsx");
for (const required of [
  "requireRouteAccess(\"/dashboard/reports\")",
  "getDashboardGraphReport",
  "listOperatingMonths",
  "selectedOperatingMonthFor",
  "clampDateToOperatingMonth",
  "redirect(`/dashboard/reports?"
]) {
  if (!page.includes(required)) errors.push(`reports page missing ${required}`);
}
// 티켓 06: 차트와 표는 reports-view.tsx와 report-charts.tsx가 그리고, 축 눈금·막대 위치는 chart-scale.ts가 정한다.
const view = read("src/app/(erp)/dashboard/reports/reports-view.tsx") + read("src/app/(erp)/dashboard/reports/report-charts.tsx");
for (const required of ["role=\"img\"", "axisTicks", "<table", "StatusBadge"]) {
  if (!view.includes(required)) errors.push(`reports view missing ${required}`);
}
// i18n: 한국어 UI 문구는 t() key로 참조하고 원문은 messages/ko.ts에 보존한다.
for (const [key, ko] of [
  ["dashboard.reports.title", "그래프 리포트"],
  ["dashboard.reports.revenue.title", "일별 매출 추이"],
  ["dashboard.reports.courseMix.title", "코스별 콜/매출 비중"],
  ["dashboard.reports.ranking.callTitle", "마사지사 담당 콜 순위"],
  ["dashboard.reports.ranking.settlementTitle", "마사지사 정산 순위"],
  ["dashboard.reports.room.title", "객실 상태 분포"],
  ["dashboard.reports.noShow.title", "노쇼/취소 추이"],
  ["dashboard.reports.payout.title", "운영팀 인센/월마감 지급 구성"],
  ["dashboard.reports.basis.description", "매출은 결제수단 선택 시점 선결제 기준"],
  ["dashboard.reports.noShow.chartNoShow", "일별 노쇼 건수"],
  ["dashboard.reports.noShow.chartCanceled", "일별 취소 건수"],
  ["dashboard.reports.snapshotMissing.title", "확정 스냅샷을 찾을 수 없습니다"]
]) {
  if (!(page + view).includes(`"${key}"`)) errors.push(`reports page/view missing t() key ${key}`);
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}
for (const forbidden of [
  "getDailyCallLedgerSummary",
  "listMonthlyClosingPreview",
  "getMonthlyClosingSnapshot",
  "listServiceCallsForOperatingMonth",
  "listCompletedServiceCallCalculationsForOperatingMonth",
  "listTherapistDailySettlements",
  "listRoomStatuses",
  "snapshotJson",
  "ServiceCall",
  "DailyExpense",
  "recordAuditEvent",
  "action="
]) {
  if ((page + view).includes(forbidden)) errors.push(`reports page/view must not calculate, parse snapshots, or mutate directly: ${forbidden}`);
}

const loading = read("src/app/(erp)/dashboard/reports/loading.tsx");
if (!loading.includes("Skeleton")) errors.push("reports loading.tsx missing Skeleton");
for (const [key, ko] of [
  ["dashboard.reports.loading.aria", "그래프 리포트 로딩 중"],
  ["dashboard.reports.loading.courseAndPayoutAria", "코스와 지급 구성 그래프 로딩"],
  ["dashboard.reports.loading.rankingAria", "마사지사 순위 그래프 로딩"],
  ["dashboard.reports.loading.roomNoShowAria", "객실 상태와 노쇼 취소 그래프 로딩"]
]) {
  if (!loading.includes(`"${key}"`)) errors.push(`reports loading.tsx missing t() key ${key}`);
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}

const errorBoundary = read("src/app/(erp)/dashboard/reports/error.tsx");
for (const required of ["\"use client\"", "kind=\"error\"", "router.refresh", "reset()"]) {
  if (!errorBoundary.includes(required)) errors.push(`reports error.tsx missing ${required}`);
}
for (const [key, ko] of [
  ["dashboard.error.retry", "다시 시도"],
  ["dashboard.error.refresh", "현재 조건 새로고침"]
]) {
  if (!errorBoundary.includes(`"${key}"`)) errors.push(`reports error.tsx missing t() key ${key}`);
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}
if (errorBoundary.includes("error.message")) {
  errors.push("reports error.tsx must not expose raw server error.message to users");
}

// 세 대시보드 화면은 routes.ts의 reportRoles(관리자/카운터/정산담당/조회전용)를 함께 쓰고, 웨이터는 포함하지 않는다.
const routes = read("src/lib/routes.ts");
const reportRolesMatch = routes.match(/const reportRoles: Role\[\] = \[([^\]]*)\]/);
const reportRoles = reportRolesMatch ? reportRolesMatch[1].split(",").map((role) => role.trim().replace(/"/g, "")) : [];
for (const role of ["counter", "settlement_manager", "read_only_viewer"]) {
  if (!reportRoles.includes(role)) {
    errors.push(`authorization.ts must allow ${role} to /dashboard/reports`);
  }
}
if (reportRoles.includes("waiter")) {
  errors.push("authorization.ts must keep waiter limited to /rooms");
}
const waiterRouteCount = (routes.match(/"waiter"/g) ?? []).length;
if (waiterRouteCount !== 1) errors.push("authorization.ts must keep waiter limited to /rooms");

for (const required of ["shell.tab.dashboardReports", "/dashboard/reports", "reportRoles"]) {
  if (!routes.includes(required)) errors.push(`routes.ts missing ${required}`);
}

const unitTest = read("src/modules/dashboard/dashboard-query-service.test.ts");
for (const required of [
  "getDashboardGraphReport",
  "dailyRevenueTrend",
  "courseMix",
  "therapistCallRanking",
  "therapistSettlementRanking",
  "roomStatusDistribution",
  "noShowCancelTrend",
  "snapshot_missing",
  "current로 대체하지 않는다",
  "DASHBOARD_DATE_OUT_OF_RANGE"
]) {
  if (!unitTest.includes(required)) errors.push(`dashboard unit test missing graph report coverage marker ${required}`);
}

const e2e = read("tests/e2e/story-6-3-graph-report.spec.ts");
for (const required of [
  "Story 6.3 graph report",
  "/dashboard/reports",
  "administrator",
  "counter",
  "settlement_manager",
  "read_only_viewer",
  "waiter",
  "그래프 리포트",
  "일별 매출 추이",
  "코스별 콜/매출 비중",
  "마사지사 담당 콜 순위",
  "마사지사 정산 순위",
  "객실 상태 분포",
  "노쇼/취소 추이",
  "운영팀 인센/월마감 지급 구성",
  "그래프 리포트 로딩 중",
  "그래프 리포트를 불러오지 못했습니다",
  "error.message"
]) {
  if (!e2e.includes(required)) errors.push(`story-6-3 e2e missing ${required}`);
}

const readme = read("src/modules/dashboard/README.md");
const docs = read("docs/modules/dashboard.md");
const projectContext = read("_bmad-output/project-context.md");
for (const [label, contents] of [
  ["dashboard README", readme],
  ["dashboard docs", docs],
  ["project-context", projectContext]
]) {
  for (const required of ["Story 6.3", "getDashboardGraphReport", "DashboardGraphReportDto", "sourceBasis", "snapshot_missing", "/dashboard/reports"]) {
    if (!contents.includes(required)) errors.push(`${label} missing ${required}`);
  }
}

if (errors.length > 0) {
  console.error("Story 6.3 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 6.3 validation passed.");
