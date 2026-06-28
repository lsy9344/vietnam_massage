import { existsSync, readFileSync } from "node:fs";

const errors = [];

function requireFile(path) {
  if (!existsSync(path)) {
    errors.push(`Missing required file: ${path}`);
  }
}

function forbidFile(path) {
  if (existsSync(path)) {
    errors.push(`Forbidden file should be removed: ${path}`);
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
  "src/app/tv/page.tsx",
  "src/app/tv/loading.tsx",
  "src/components/domain/room-status-refresh-controller.tsx",
  "src/components/domain/room-status-card.tsx",
  "src/components/domain/status-badge.tsx",
  "src/lib/authorization.ts",
  "src/lib/navigation.ts",
  "src/modules/rooms/room-status-service.ts",
  "tests/e2e/story-3-4-tv-fullscreen-board.spec.ts",
  "_bmad-output/project-context.md",
  "docs/modules/rooms.md",
  "src/modules/rooms/README.md",
  "docs/modules/calls.md"
].forEach(requireFile);

forbidFile("src/app/(erp)/tv/page.tsx");

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-3-4.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-3-4.mjs");
}

const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
for (const forbidden of ["@tanstack/react-query", "swr", "redis", "ioredis", "socket.io"]) {
  if (dependencies[forbidden]) errors.push(`Story 3.4 must not add ${forbidden}`);
}

const koMessagesTv = read("src/lib/i18n/messages/ko.ts");
const tvPage = read("src/app/tv/page.tsx");
for (const required of [
  "requireRouteAccess(\"/tv\")",
  "listOperatingMonths",
  "selectedOperatingMonthFor",
  "clampDateToOperatingMonth",
  "listRoomStatuses",
  "RoomStatusCard",
  "variant=\"tv\"",
  "RoomStatusRefreshController",
  "variant=\"tv\"",
  "latestRoomStatusUpdatedAt",
  "operatingMonthId",
  "serviceDate",
  // i18n 전환: 한국어 UI 문구는 t() key로 참조하고, 원문은 messages/ko.ts에 보존한다.
  "nav.item.tv",
  "fullscreen",
  "tv.eyebrowFull",
  "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4",
  "common.roomStatusAria"
]) {
  if (!tvPage.includes(required)) errors.push(`src/app/tv/page.tsx missing ${required}`);
}
for (const label of ["TV 현황판", "읽기 전용", "객실 상태"]) {
  if (!koMessagesTv.includes(label)) errors.push(`messages/ko.ts missing tv label: ${label}`);
}
for (const forbidden of [
  "ErpEmptyState",
  "EditableCallGrid",
  "DailyExpensePanel",
  "autosaveServiceCallRow",
  "saveBasicServiceCallRow",
  "createDailyExpense",
  "updateDailyExpense",
  "deactivateDailyExpense",
  "requirePermission("
]) {
  if (tvPage.includes(forbidden)) errors.push(`src/app/tv/page.tsx must stay fullscreen read-only and not include ${forbidden}`);
}

const loading = read("src/app/tv/loading.tsx");
for (const required of ["Skeleton", "tv.loading.boardAria", "Array.from({ length: 11 }", "min-h-screen", "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"]) {
  if (!loading.includes(required)) errors.push(`src/app/tv/loading.tsx missing ${required}`);
}
if (!koMessagesTv.includes("TV 현황판 로딩")) errors.push("messages/ko.ts missing tv loading label: TV 현황판 로딩");

const refresh = read("src/components/domain/room-status-refresh-controller.tsx");
for (const required of [
  "variant?: \"default\" | \"tv\"",
  "variant === \"tv\"",
  "useRouter",
  "router.refresh",
  "setInterval",
  "15_000",
  "45_000",
  "roomRefresh.lastUpdated",
  "roomRefresh.refreshing",
  "roomRefresh.stale",
  "roomRefresh.refresh",
  "roomRefresh.aria",
  "text-status-complete-check"
]) {
  if (!refresh.includes(required)) errors.push(`room-status-refresh-controller.tsx missing ${required}`);
}
// i18n 전환: 컴포넌트 한국어 문구는 messages/ko.ts로 이동.
const koMessages = read("src/lib/i18n/messages/ko.ts");
for (const label of ["마지막 갱신", "갱신 중", "갱신 지연", "새로고침", "실시간 갱신 상태"]) {
  if (!koMessages.includes(label)) errors.push(`messages/ko.ts missing refresh label: ${label}`);
}
if (refresh.includes("@tanstack/react-query")) {
  errors.push("room status refresh must not import @tanstack/react-query");
}

const card = read("src/components/domain/room-status-card.tsx");
for (const required of [
  "RoomStatusDto",
  "StatusBadge",
  "variant?: \"default\" | \"tv\"",
  "variant === \"tv\"",
  "text-[40px]",
  "text-[28px]",
  "text-[22px]",
  "status.displayStatus",
  "status.remainingMinutes",
  "status.expectedEndAt",
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

const statusBadge = read("src/components/domain/status-badge.tsx");
for (const required of ["●", "◷", "◐", "⚠", "○", "상태:"]) {
  if (!statusBadge.includes(required)) errors.push(`status-badge.tsx missing status label/glyph ${required}`);
}

const authorization = read("src/lib/authorization.ts");
for (const required of [
  "administrator: [\"/live\", \"/calls\", \"/rooms\", \"/settlements\", \"/closing\", \"/dashboard\", \"/masters\", \"/audit\", \"/tv\"]",
  "read_only_viewer: [\"/rooms\", \"/tv\", \"/dashboard/today\", \"/dashboard/monthly\"",
  "waiter: [\"/rooms\"]",
  "counter: [\"/live\", \"/calls\", \"/rooms\", \"/dashboard/today\", \"/dashboard/monthly\""
]) {
  if (!authorization.includes(required)) errors.push(`authorization.ts missing ${required}`);
}

const navigation = read("src/lib/navigation.ts");
for (const required of [
  "nav.item.tv",
  "href: \"/tv\"",
  "allowedRoles: [\"administrator\", \"read_only_viewer\"]",
  "getNavigationForRole"
]) {
  if (!navigation.includes(required)) errors.push(`navigation.ts missing ${required}`);
}
// i18n 전환: "TV 현황판" 한국어 문구는 messages/ko.ts로 이동.
if (!read("src/lib/i18n/messages/ko.ts").includes("TV 현황판")) {
  errors.push("messages/ko.ts missing nav label: TV 현황판");
}

const e2e = read("tests/e2e/story-3-4-tv-fullscreen-board.spec.ts");
for (const required of [
  "Story 3.4 TV fullscreen board",
  "story34_admin",
  "story34_readonly",
  "story34_waiter",
  "story34_counter",
  "story34_settlement",
  "settlement_manager",
  "/settlements",
  "/tv?operatingMonthId",
  "room-status-card",
  "toHaveCount(11)",
  "ERP 운영",
  "역할별 ERP 업무",
  "상태: 예약",
  "상태: 사용중",
  "상태: 종료확인",
  "상태: 청소중",
  "상태: 빈방",
  "결제·확인 필요",
  "실시간 갱신 상태",
  "갱신 지연",
  "fastForward(46_000)",
  "새로고침",
  "콜 원장 그리드",
  "저장중",
  "waiter",
  "counter"
]) {
  if (!e2e.includes(required)) errors.push(`story-3-4-tv-fullscreen-board.spec.ts missing ${required}`);
}
if (e2e.includes("waitForTimeout(")) {
  errors.push("story-3-4-tv-fullscreen-board.spec.ts must not use hardcoded waits");
}

const docs = `${read("_bmad-output/project-context.md")}\n${read("docs/modules/rooms.md")}\n${read("src/modules/rooms/README.md")}\n${read("docs/modules/calls.md")}`;
for (const required of [
  "Story 3.4",
  "/tv",
  "fullscreen",
  "ERP chrome 없음",
  "조회 전용",
  "읽기 전용",
  "RoomStatusDto",
  "RoomStatusCard",
  "listRoomStatuses",
  "15초",
  "갱신 지연",
  "UI 계산 재구현 금지",
  "mutation을 수행하지 않는다"
]) {
  if (!docs.includes(required)) errors.push(`docs/project context missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 3.4 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 3.4 validation passed.");
