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

const loadingFiles = [
  ["today", "src/app/(erp)/dashboard/today/loading.tsx", "오늘 KPI 대시보드 로딩 중"],
  ["monthly", "src/app/(erp)/dashboard/monthly/loading.tsx", "월간 KPI 대시보드 로딩 중"],
  ["reports", "src/app/(erp)/dashboard/reports/loading.tsx", "그래프 리포트 로딩 중"]
];

const errorFiles = [
  ["today", "src/app/(erp)/dashboard/today/error.tsx", "오늘 KPI를 불러오지 못했습니다"],
  ["monthly", "src/app/(erp)/dashboard/monthly/error.tsx", "월간 KPI를 불러오지 못했습니다"],
  ["reports", "src/app/(erp)/dashboard/reports/error.tsx", "그래프 리포트를 불러오지 못했습니다"]
];

[
  "src/app/(erp)/dashboard/today/page.tsx",
  "src/app/(erp)/dashboard/monthly/page.tsx",
  "src/app/(erp)/dashboard/reports/page.tsx",
  "src/components/domain/status-badge.tsx",
  "src/app/globals.css",
  "src/lib/authorization.ts",
  "src/lib/navigation.ts",
  "src/modules/dashboard/README.md",
  "docs/modules/dashboard.md",
  "_bmad-output/project-context.md",
  "tests/e2e/story-6-4-dashboard-states-and-colors.spec.ts",
  "scripts/validate-story-6-3.mjs",
  "package.json"
].forEach(requireFile);
for (const [, path] of [...loadingFiles, ...errorFiles]) requireFile(path);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-6-3.mjs && node scripts/validate-story-6-4.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-6-4.mjs immediately after validate-story-6-3.mjs");
}

for (const dependency of ["recharts", "chart.js", "@nivo/core", "victory", "d3"]) {
  if (packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]) {
    errors.push(`Story 6.4 keeps project-local SVG/CSS chart primitives and must not add chart dependency: ${dependency}`);
  }
}

for (const [route, path, label] of loadingFiles) {
  const contents = read(path);
  for (const required of ["Skeleton", "aria-busy=\"true\"", `aria-label=\"${label}\"`, "border border-border", "bg-surface"]) {
    if (!contents.includes(required)) errors.push(`${route} loading.tsx missing layout-preserving loading marker: ${required}`);
  }
}

for (const [route, path, heading] of errorFiles) {
  const contents = read(path);
  for (const required of ["\"use client\"", "role=\"alert\"", heading, "다시 시도", "현재 조건 새로고침", "router.refresh", "reset()"]) {
    if (!contents.includes(required)) errors.push(`${route} error.tsx missing safe error-boundary marker: ${required}`);
  }
  for (const forbidden of ["error.message", "error.stack"]) {
    if (contents.includes(forbidden)) errors.push(`${route} error.tsx must not expose raw ${forbidden}`);
  }
}

const reportsPage = read("src/app/(erp)/dashboard/reports/page.tsx");
for (const required of [
  "requireRouteAccess(\"/dashboard/reports\")",
  "redirect(`/dashboard/reports?",
  "role=\"img\"",
  "<title id=\"daily-revenue-chart-title\"",
  "<table",
  "범례: 노쇼는 브랜드색, 취소는 위험색",
  "StatusBadge state={row.displayStatus}",
  "snapshot_missing",
  "확정 스냅샷을 찾을 수 없습니다",
  "정산 source가 없어 순위를 표시하지 않습니다.",
  "확정 스냅샷이 없어 지급 구성 그래프를 표시하지 않습니다.",
  "완료 콜 그래프 없음",
  "report.emptyStates.noCalculatedCompletedCalls ? <CompletedChartEmptyPanel /> : <RevenueTrendChart report={report} />",
  "report.emptyStates.noCalculatedCompletedCalls ? ("
]) {
  if (!reportsPage.includes(required)) errors.push(`reports page missing Story 6.4 state/color marker: ${required}`);
}

const statusBadgeReferences = reportsPage.match(/StatusBadge/g)?.length ?? 0;
if (statusBadgeReferences !== 2) {
  errors.push("reports page must use StatusBadge only for room status distribution (import + room-status usage)");
}

for (const forbidden of ["bg-status-", "text-status-", "border-status-", "var(--color-status-", "0으로 표시됩니다"]) {
  if (reportsPage.includes(forbidden)) errors.push(`reports page must not use forbidden Story 6.4 marker: ${forbidden}`);
}

for (const required of ["bg-brand", "bg-danger", "var(--color-brand)", "var(--color-danger)"]) {
  if (!reportsPage.includes(required)) errors.push(`reports page non-status chart series must keep semantic color marker: ${required}`);
}

const todayPage = read("src/app/(erp)/dashboard/today/page.tsx");
for (const required of ["이 날짜의 콜이 없습니다", "집계 제외 항목이 있습니다", "StatusBadge state=\"예약\""]) {
  if (!todayPage.includes(required)) errors.push(`today page missing distinct empty/status marker: ${required}`);
}

const monthlyPage = read("src/app/(erp)/dashboard/monthly/page.tsx");
for (const required of ["이 운영월의 콜이 없습니다", "확정 스냅샷을 찾을 수 없습니다", "현재 재계산값으로 대체하지 않습니다", "StatusBadge state={label}"]) {
  if (!monthlyPage.includes(required)) errors.push(`monthly page missing distinct empty/snapshot/status marker: ${required}`);
}

const authorization = read("src/lib/authorization.ts");
for (const route of ["/dashboard/today", "/dashboard/monthly", "/dashboard/reports"]) {
  for (const role of ["counter", "settlement_manager", "read_only_viewer"]) {
    if (!new RegExp(`${role}: \\[[^\\]]*"${route}"`).test(authorization)) {
      errors.push(`authorization.ts must allow ${role} to ${route}`);
    }
  }
}
if (!authorization.includes("waiter: [\"/rooms\"]")) {
  errors.push("authorization.ts must keep waiter limited to /rooms, including direct /dashboard/* access redirect to /rooms");
}

const navigation = read("src/lib/navigation.ts");
for (const required of ["/dashboard/today", "/dashboard/monthly", "/dashboard/reports", "role !== \"waiter\""]) {
  if (!navigation.includes(required)) errors.push(`navigation.ts missing dashboard route-access marker: ${required}`);
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
