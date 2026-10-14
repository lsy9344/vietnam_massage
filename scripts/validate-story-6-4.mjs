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

// i18n 전환: loading aria-label과 error 제목/버튼은 t() key로 참조하고 한국어 원문은 messages/ko.ts에 보존한다.
const loadingFiles = [
  ["today", "src/app/(erp)/dashboard/today/loading.tsx", "dashboard.today.loading.aria", "오늘 KPI 대시보드 로딩 중"],
  ["monthly", "src/app/(erp)/dashboard/monthly/loading.tsx", "dashboard.monthly.loading.aria", "월간 KPI 대시보드 로딩 중"],
  ["reports", "src/app/(erp)/dashboard/reports/loading.tsx", "dashboard.reports.loading.aria", "그래프 리포트 로딩 중"]
];

const errorFiles = [
  ["today", "src/app/(erp)/dashboard/today/error.tsx", "dashboard.today.error.title", "오늘 KPI를 불러오지 못했습니다"],
  ["monthly", "src/app/(erp)/dashboard/monthly/error.tsx", "dashboard.monthly.error.title", "월간 KPI를 불러오지 못했습니다"],
  ["reports", "src/app/(erp)/dashboard/reports/error.tsx", "dashboard.reports.error.title", "그래프 리포트를 불러오지 못했습니다"]
];

[
  "src/app/(erp)/dashboard/today/page.tsx",
  "src/app/(erp)/dashboard/monthly/page.tsx",
  "src/app/(erp)/dashboard/reports/page.tsx",
  "src/app/(erp)/dashboard/reports/reports-view.tsx",
  "src/app/(erp)/dashboard/reports/report-charts.tsx",
  "src/app/(erp)/dashboard/today/today-dashboard-view.tsx",
  "src/app/(erp)/dashboard/monthly/monthly-dashboard-view.tsx",
  "src/app/(erp)/dashboard/dashboard-parts.tsx",
  "src/components/domain/status-badge.tsx",
  "src/app/globals.css",
  "src/lib/authorization.ts",
  "src/lib/routes.ts",
  "src/modules/dashboard/README.md",
  "docs/modules/dashboard.md",
  "_bmad-output/project-context.md",
  "tests/e2e/story-6-4-dashboard-states-and-colors.spec.ts",
  "scripts/validate-story-6-3.mjs",
  "package.json"
].forEach(requireFile);
for (const [, path] of [...loadingFiles, ...errorFiles]) requireFile(path);

const koMessages = read("src/lib/i18n/messages/ko.ts");

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-6-3.mjs && node scripts/validate-story-6-4.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-6-4.mjs immediately after validate-story-6-3.mjs");
}

for (const dependency of ["recharts", "chart.js", "@nivo/core", "victory", "d3"]) {
  if (packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]) {
    errors.push(`Story 6.4 keeps project-local SVG/CSS chart primitives and must not add chart dependency: ${dependency}`);
  }
}

for (const [route, path, ariaKey, ariaKo] of loadingFiles) {
  const contents = read(path);
  for (const required of ["Skeleton", "aria-busy=\"true\"", `aria-label={t("${ariaKey}")}`, "border border-border", "bg-surface"]) {
    if (!contents.includes(required)) errors.push(`${route} loading.tsx missing layout-preserving loading marker: ${required}`);
  }
  if (!koMessages.includes(ariaKo)) errors.push(`messages/ko.ts missing ${ariaKo}`);
}

for (const [route, path, headingKey, headingKo] of errorFiles) {
  const contents = read(path);
  for (const required of ["\"use client\"", "kind=\"error\"", `t("${headingKey}")`, "dashboard.error.retry", "dashboard.error.refresh", "router.refresh", "reset()"]) {
    if (!contents.includes(required)) errors.push(`${route} error.tsx missing safe error-boundary marker: ${required}`);
  }
  if (!koMessages.includes(headingKo)) errors.push(`messages/ko.ts missing ${headingKo}`);
  for (const forbidden of ["error.message", "error.stack"]) {
    if (contents.includes(forbidden)) errors.push(`${route} error.tsx must not expose raw ${forbidden}`);
  }
}
for (const ko of ["다시 시도", "현재 조건 새로고침"]) {
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}

const reportsPage = read("src/app/(erp)/dashboard/reports/page.tsx");
for (const required of ["requireRouteAccess(\"/dashboard/reports\")", "redirect(`/dashboard/reports?"]) {
  if (!reportsPage.includes(required)) errors.push(`reports page missing Story 6.4 route marker: ${required}`);
}

// 티켓 06: 리포트 화면은 reports-view.tsx가, 차트 모양은 report-charts.tsx가 그린다.
const reportsView = read("src/app/(erp)/dashboard/reports/reports-view.tsx");
const reportCharts = read("src/app/(erp)/dashboard/reports/report-charts.tsx");
for (const required of [
  "<table",
  // room status는 stable key로 StatusBadge에 넘긴다.
  "state={row.displayStatus}",
  "snapshot_missing",
  // 계산 근거가 없으면 0값 차트 대신 그 자리에 근거 없음을 둔다.
  "report.emptyStates.noRevenueTrendData",
  "report.emptyStates.noCalculatedCompletedCalls ?",
  "report.emptyStates.noCallsInPeriod",
  "<NoBasis"
]) {
  if (!reportsView.includes(required)) errors.push(`reports view missing Story 6.4 state/color marker: ${required}`);
}
if (!reportCharts.includes("role=\"img\"")) errors.push("report-charts.tsx missing Story 6.4 chart marker: role=\"img\"");
// i18n: 한국어 UI 문구는 t() key로 참조하고 원문은 messages/ko.ts에 보존한다.
for (const [key, ko] of [
  ["dashboard.reports.snapshotMissing.title", "확정 스냅샷을 찾을 수 없습니다"],
  ["dashboard.reports.ranking.settlementEmpty", "정산 source가 없어 순위를 표시하지 않습니다."],
  ["dashboard.reports.payout.empty", "확정 스냅샷이 없어 지급 구성 그래프를 표시하지 않습니다."],
  ["dashboard.reports.completedEmpty.description", "누락된 완료 데이터를 0값 매출 또는 0값 코스 비중 그래프로 꾸미지 않습니다."],
  ["dashboard.reports.courseMix.empty", "코스 비중을 그리지 않습니다"],
  ["dashboard.reports.noShow.empty", "노쇼·취소 추이를 그리지 않습니다"]
]) {
  if (!reportsView.includes(`"${key}"`)) errors.push(`reports view missing Story 6.4 t() key: ${key}`);
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}

const statusBadgeReferences = reportsView.match(/StatusBadge/g)?.length ?? 0;
if (statusBadgeReferences !== 2) {
  errors.push("reports view must use StatusBadge only for room status distribution (import + room-status usage)");
}

for (const forbidden of ["bg-status-", "text-status-", "border-status-", "var(--color-status-", "0으로 표시됩니다"]) {
  if ((reportsPage + reportsView + reportCharts).includes(forbidden)) errors.push(`reports page/view must not use forbidden Story 6.4 marker: ${forbidden}`);
}

// 티켓 06·design.md 6.14: 차트 계열은 지표 계열의 파스텔이다(매출 라벤더, 지급 피치, 건수 민트).
// 위험색과 검정 잉크는 상태·행동의 뜻이라 계열 채움에 쓰지 않는다(검정은 막대에 올렸을 때만).
for (const required of ["bg-accent-lavender", "bg-accent-peach", "bg-accent-mint"]) {
  if (!reportCharts.includes(required)) errors.push(`report-charts.tsx missing chart series color: ${required}`);
}
for (const required of ["tone=\"lavender\"", "tone=\"peach\"", "tone=\"mint\""]) {
  if (!reportsView.includes(required)) errors.push(`reports view missing chart series tone: ${required}`);
}
for (const forbidden of ["bg-danger", "var(--color-danger)", "var(--color-brand)"]) {
  if ((reportsView + reportCharts).includes(forbidden)) errors.push(`reports chart series must not use status or action color: ${forbidden}`);
}

// 티켓 06·design.md 2.5: 객실 상태색(StatusBadge)은 객실·실시간·TV에만 쓴다. 대시보드의 콜 상태 건수는 StatusIndicator다.
const dashboardParts = read("src/app/(erp)/dashboard/dashboard-parts.tsx");
if (!dashboardParts.includes("<StatusIndicator")) errors.push("dashboard status counts must use StatusIndicator");
const todayPage = read("src/app/(erp)/dashboard/today/today-dashboard-view.tsx") + dashboardParts;
for (const [key, ko] of [
  ["dashboard.today.empty.noCallsTitle", "이 날짜의 콜이 없습니다"],
  ["dashboard.today.warning.excludedTitle", "집계 제외 항목이 있습니다"]
]) {
  if (!todayPage.includes(`"${key}"`)) errors.push(`today view missing distinct empty/status t() key: ${key}`);
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}

const monthlyPage = read("src/app/(erp)/dashboard/monthly/monthly-dashboard-view.tsx") + dashboardParts;
for (const [key, ko] of [
  ["dashboard.monthly.empty.noCallsTitle", "이 운영월의 콜이 없습니다"],
  ["dashboard.monthly.snapshotMissing.title", "확정 스냅샷을 찾을 수 없습니다"],
  ["dashboard.monthly.snapshotMissing.description", "현재 재계산값으로 대체하지 않습니다"]
]) {
  if (!monthlyPage.includes(`"${key}"`)) errors.push(`monthly view missing distinct empty/snapshot t() key: ${key}`);
  if (!koMessages.includes(ko)) errors.push(`messages/ko.ts missing ${ko}`);
}
for (const [label, contents] of [
  ["today", todayPage],
  ["monthly", monthlyPage]
]) {
  if (contents.includes("StatusBadge")) errors.push(`${label} dashboard must not borrow room status colors (StatusBadge)`);
}

// 세 대시보드 화면은 routes.ts의 reportRoles(관리자/카운터/정산담당/조회전용)를 함께 쓰고, 웨이터는 포함하지 않는다.
const routes = read("src/lib/routes.ts");
const reportRolesMatch = routes.match(/const reportRoles: Role\[\] = \[([^\]]*)\]/);
const reportRoles = reportRolesMatch ? reportRolesMatch[1].split(",").map((role) => role.trim().replace(/"/g, "")) : [];
for (const route of ["/dashboard/today", "/dashboard/monthly", "/dashboard/reports"]) {
  for (const role of ["counter", "settlement_manager", "read_only_viewer"]) {
    if (!reportRoles.includes(role)) {
      errors.push(`authorization.ts must allow ${role} to ${route}`);
    }
  }
}
if (reportRoles.includes("waiter")) {
  errors.push("authorization.ts must keep waiter limited to /rooms, including direct /dashboard/* access redirect to /rooms");
}
const waiterRouteCount = (routes.match(/"waiter"/g) ?? []).length;
if (waiterRouteCount !== 1) {
  errors.push("authorization.ts must keep waiter limited to /rooms, including direct /dashboard/* access redirect to /rooms");
}

for (const required of ["/dashboard/today", "/dashboard/monthly", "/dashboard/reports", "reportRoles"]) {
  if (!routes.includes(required)) errors.push(`routes.ts missing dashboard route-access marker: ${required}`);
}

const e2eSpec = read("tests/e2e/story-6-4-dashboard-states-and-colors.spec.ts");
for (const required of [
  "Story 6.4 dashboard source guardrails",
  "Story 6.4 dashboard browser states and route access",
  "aria-busy=\"true\"",
  "error.message",
  "bg-status-",
  "snapshot-missing monthly and reports states",
  "missing calculated completed calls do not render revenue or course charts as successful zero graphs",
  "waiter is redirected away from /dashboard/",
  "counter",
  "settlement_manager",
  "read_only_viewer"
]) {
  if (!e2eSpec.includes(required)) errors.push(`Story 6.4 E2E spec missing required coverage marker: ${required}`);
}

for (const [label, contents] of [
  ["dashboard README", read("src/modules/dashboard/README.md")],
  ["dashboard docs", read("docs/modules/dashboard.md")],
  ["project-context", read("_bmad-output/project-context.md")]
]) {
  for (const required of [
    "Story 6.4",
    "status color",
    "loading",
    "error",
    "empty",
    "chart dependency",
    "0값"
  ]) {
    if (!contents.includes(required)) errors.push(`${label} missing Story 6.4 documentation marker: ${required}`);
  }
}

if (errors.length > 0) {
  console.error("Story 6.4 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 6.4 validation passed.");
