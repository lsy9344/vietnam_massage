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
  "package.json",
  "src/app/(erp)/live/page.tsx",
  "src/app/(erp)/live/loading.tsx",
  "src/components/domain/room-status-refresh-controller.tsx",
  "src/app/(erp)/calls/page.tsx",
  "src/app/(erp)/calls/daily-summary-strip.tsx",
  "src/components/domain/room-status-card.tsx",
  "src/components/domain/status-badge.tsx",
  "src/lib/operating-date.ts",
  "src/lib/operating-date.test.ts",
  "src/modules/calls/service-call-service.ts",
  "src/modules/calls/service-call-service.test.ts",
  "tests/e2e/story-3-2-live-status.spec.ts",
  "_bmad-output/project-context.md",
  "docs/modules/rooms.md",
  "src/modules/rooms/README.md",
  "docs/modules/calls.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-3-2.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-3-2.mjs");
}

const koMessagesLive = read("src/lib/i18n/messages/ko.ts");
const livePage = read("src/app/(erp)/live/page.tsx");
for (const required of [
  "requireRouteAccess(\"/live\")",
  "listOperatingMonths",
  "selectedOperatingMonthFor",
  "clampDateToOperatingMonth",
  "Promise.all",
  "listRoomStatuses",
  "getDailyCallLedgerSummary",
  "RoomStatusCard",
  "RoomStatusRefreshController",
  // i18n 전환: 한국어 UI 문구는 t() key로 참조하고, 원문은 messages/ko.ts에 보존한다.
  "common.goToOperatingMonths",
  "grid grid-cols-4",
  "live.summary.aria",
  "summary.inUseCount",
  "summary.cleaningCount",
  "live.kpi.paymentTotal",
  "live.kpi.netSales",
  "courseSummaries",
  "warningCounts"
]) {
  if (!livePage.includes(required)) errors.push(`live/page.tsx missing ${required}`);
}
for (const label of ["운영월 관리로 이동", "오늘 상태 요약", "결제합계", "순매출"]) {
  if (!koMessagesLive.includes(label)) errors.push(`messages/ko.ts missing live label: ${label}`);
}
for (const forbidden of ["ErpEmptyState", "EditableCallGrid", "DailyExpensePanel", "autosaveServiceCallRow", "saveBasicServiceCallRow"]) {
  if (livePage.includes(forbidden)) errors.push(`live/page.tsx must stay read-only and not include ${forbidden}`);
}

const loading = read("src/app/(erp)/live/loading.tsx");
for (const required of ["Skeleton", "live.loading.roomsAria", "live.loading.summaryAria", "Array.from({ length: 11 }", "grid grid-cols-4"]) {
  if (!loading.includes(required)) errors.push(`live/loading.tsx missing ${required}`);
}
for (const label of ["객실 상태 로딩", "오늘 요약 로딩"]) {
  if (!koMessagesLive.includes(label)) errors.push(`messages/ko.ts missing live loading label: ${label}`);
}

// i18n 전환: 컴포넌트의 한국어 문구는 messages/ko.ts로 이동했고, 컴포넌트는 t()로 참조한다.
const koMessages = read("src/lib/i18n/messages/ko.ts");
const refresh = read("src/components/domain/room-status-refresh-controller.tsx");
for (const required of ["useRouter", "router.refresh", "setInterval", "15_000", "45_000", "roomRefresh.lastUpdated", "roomRefresh.refreshing", "roomRefresh.stale", "roomRefresh.refresh"]) {
  if (!refresh.includes(required)) errors.push(`room-status-refresh-controller.tsx missing ${required}`);
}
for (const label of ["마지막 갱신", "갱신 중", "갱신 지연", "새로고침"]) {
  if (!koMessages.includes(label)) errors.push(`messages/ko.ts missing refresh label: ${label}`);
}
if (refresh.includes("@tanstack/react-query")) {
  errors.push("live refresh must not import @tanstack/react-query");
}

const card = read("src/components/domain/room-status-card.tsx");
for (const required of [
  "RoomStatusDto",
  "StatusBadge",
  "status.displayStatus",
  "status.remainingMinutes",
  "status.expectedEndAt",
  "status.guidanceText",
  "status.course.tvDisplayName",
  "status.therapist1",
  "status.therapist2",
  "status.earcare",
  "roomCard.guidance.completeCheck",
  "roomCard.guidance.empty",
  "status-attention",
  "data-testid=\"room-status-card\""
]) {
  if (!card.includes(required)) errors.push(`room-status-card.tsx missing ${required}`);
}
for (const label of ["결제·확인 필요", "즉시 가능"]) {
  if (!koMessages.includes(label)) errors.push(`messages/ko.ts missing room-card label: ${label}`);
}

const helper = `${read("src/lib/operating-date.ts")}\n${read("src/app/(erp)/calls/page.tsx")}`;
for (const required of ["kstTodayIsoDate", "clampDateToOperatingMonth", "selectedOperatingMonthFor"]) {
  if (!helper.includes(required)) errors.push(`operating date helper usage missing ${required}`);
}
const callsPage = read("src/app/(erp)/calls/page.tsx");
for (const forbidden of ["function kstTodayIsoDate", "function clampDateToMonth", "function selectedMonthFor"]) {
  if (callsPage.includes(forbidden)) errors.push(`calls/page.tsx must use shared helper, found ${forbidden}`);
}

const service = read("src/modules/calls/service-call-service.ts");
for (const required of ["inUseCount: number", "cleaningCount: number", "isInUseStatus", "isCleaningStatus", "inUseCount: rows.filter", "cleaningCount: rows.filter"]) {
  if (!service.includes(required)) errors.push(`service-call-service.ts missing ${required}`);
}
const serviceTest = read("src/modules/calls/service-call-service.test.ts");
for (const required of ["summary.inUseCount", "summary.cleaningCount", "\"IN_USE\"", "\"CLEANING\""]) {
  if (!serviceTest.includes(required)) errors.push(`service-call-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-3-2-live-status.spec.ts");
for (const required of [
  "Story 3.2 live room and call status",
  "/live?operatingMonthId",
  "room-status-card",
  "toHaveCount(11)",
  "상태: 종료확인",
  "결제·확인 필요",
  "오늘 상태 요약",
  "결제합계",
  "순매출",
  "실시간 갱신 상태",
  "콜 원장 그리드",
  "저장중"
]) {
  if (!e2e.includes(required)) errors.push(`story-3-2-live-status.spec.ts missing ${required}`);
}
if (e2e.includes("waitForTimeout(")) {
  errors.push("story-3-2-live-status.spec.ts must not use hardcoded waits");
}

const docs = `${read("_bmad-output/project-context.md")}\n${read("docs/modules/rooms.md")}\n${read("src/modules/rooms/README.md")}\n${read("docs/modules/calls.md")}`;
for (const required of [
  "Story 3.2",
  "/live",
  "읽기 전용",
  "RoomStatusDto",
  "listRoomStatuses",
  "getDailyCallLedgerSummary",
  "inUseCount",
  "cleaningCount",
  "갱신 지연",
  "UI 계산 재구현 금지"
]) {
  if (!docs.includes(required)) errors.push(`docs/project context missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 3.2 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 3.2 validation passed.");
