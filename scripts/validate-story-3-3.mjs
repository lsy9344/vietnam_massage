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
  "src/app/(erp)/rooms/page.tsx",
  "src/app/(erp)/rooms/loading.tsx",
  "src/components/domain/room-status-refresh-controller.tsx",
  "src/components/domain/room-status-card.tsx",
  "src/components/domain/status-badge.tsx",
  "src/lib/authorization.ts",
  "src/lib/navigation.ts",
  "src/modules/rooms/room-status-service.ts",
  "tests/e2e/story-3-3-rooms-waiter-guidance.spec.ts",
  "_bmad-output/project-context.md",
  "docs/modules/rooms.md",
  "src/modules/rooms/README.md",
  "docs/modules/calls.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-3-3.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-3-3.mjs");
}

const koMessagesRooms = read("src/lib/i18n/messages/ko.ts");
const roomsPage = read("src/app/(erp)/rooms/page.tsx");
for (const required of [
  "requireRouteAccess(\"/rooms\")",
  "listOperatingMonths",
  "selectedOperatingMonthFor",
  "clampDateToOperatingMonth",
  "Promise.all",
  "listRoomStatuses",
  "RoomStatusCard",
  "RoomStatusRefreshController",
  // i18n 전환: 한국어 UI 문구는 t() key로 참조하고, 원문은 messages/ko.ts에 보존한다.
  "common.goToOperatingMonths",
  "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4",
  "common.roomStatusAria",
  "nav.item.rooms",
  "rooms.description.full"
]) {
  if (!roomsPage.includes(required)) errors.push(`rooms/page.tsx missing ${required}`);
}
for (const label of ["운영월 관리로 이동", "객실 상태", "객실 현황", "읽기 전용"]) {
  if (!koMessagesRooms.includes(label)) errors.push(`messages/ko.ts missing rooms label: ${label}`);
}
for (const forbidden of [
  "ErpEmptyState",
  "getDailyCallLedgerSummary",
  "EditableCallGrid",
  "DailyExpensePanel",
  "autosaveServiceCallRow",
  "saveBasicServiceCallRow",
  "createDailyExpense",
  "updateDailyExpense",
  "deactivateDailyExpense"
]) {
  if (roomsPage.includes(forbidden)) errors.push(`rooms/page.tsx must stay room-status read-only and not include ${forbidden}`);
}

const loading = read("src/app/(erp)/rooms/loading.tsx");
for (const required of ["Skeleton", "rooms.loading.roomsAria", "Array.from({ length: 11 }", "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"]) {
  if (!loading.includes(required)) errors.push(`rooms/loading.tsx missing ${required}`);
}
if (!koMessagesRooms.includes("객실 상태 로딩")) errors.push("messages/ko.ts missing rooms loading label: 객실 상태 로딩");

// i18n 전환: 컴포넌트 한국어 문구는 messages/ko.ts로 이동, 컴포넌트는 t() key로 참조.
const koMessages = read("src/lib/i18n/messages/ko.ts");
const refresh = read("src/components/domain/room-status-refresh-controller.tsx");
for (const required of [
  "useRouter",
  "router.refresh",
  "setInterval",
  "15_000",
  "45_000",
  "roomRefresh.lastUpdated",
  "roomRefresh.refreshing",
  "roomRefresh.stale",
  "roomRefresh.refresh",
  "roomRefresh.aria"
]) {
  if (!refresh.includes(required)) errors.push(`room-status-refresh-controller.tsx missing ${required}`);
}
for (const label of ["마지막 갱신", "갱신 중", "갱신 지연", "새로고침", "실시간 갱신 상태"]) {
  if (!koMessages.includes(label)) errors.push(`messages/ko.ts missing refresh label: ${label}`);
}
if (refresh.includes("@tanstack/react-query")) {
  errors.push("room status refresh must not import @tanstack/react-query");
}

const livePage = read("src/app/(erp)/live/page.tsx");
if (!livePage.includes("RoomStatusRefreshController")) {
  errors.push("live/page.tsx must use the route-neutral RoomStatusRefreshController");
}
if (existsSync("src/app/(erp)/live/live-refresh-controller.tsx")) {
  errors.push("legacy live-refresh-controller.tsx should be removed after route-neutral extraction");
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
  "roomCard.guidance.empty",
  "status-attention",
  "data-testid=\"room-status-card\""
]) {
  if (!card.includes(required)) errors.push(`room-status-card.tsx missing ${required}`);
}
if (!koMessages.includes("즉시 가능")) errors.push("messages/ko.ts missing room-card label: 즉시 가능");

const guidance = read("src/modules/rooms/room-status-service.ts");
for (const required of ["ROOM_STATUS_GUIDANCE_TEXT", "예약", "사용중", "청소중", "종료확인", "빈방"]) {
  if (!guidance.includes(required)) errors.push(`room-status-service.ts missing guidance source ${required}`);
}

const authorization = read("src/lib/authorization.ts");
for (const required of [
  "waiter: \"/rooms\"",
  "read_only_viewer: \"/rooms\"",
  "waiter: [\"/rooms\"]",
  "read_only_viewer: [\"/rooms\", \"/tv\", \"/dashboard/today\", \"/dashboard/monthly\""
]) {
  if (!authorization.includes(required)) errors.push(`authorization.ts missing ${required}`);
}

const navigation = read("src/lib/navigation.ts");
for (const required of [
  "nav.item.rooms",
  "allowedRoles: [\"administrator\", \"counter\", \"waiter\", \"read_only_viewer\"]",
  "getNavigationForRole",
  ".filter((group) => group.items.length > 0)"
]) {
  if (!navigation.includes(required)) errors.push(`navigation.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-3-3-rooms-waiter-guidance.spec.ts");
for (const required of [
  "Story 3.3 rooms waiter guidance",
  "story33_waiter",
  "story33_readonly",
  "/rooms?operatingMonthId",
  "room-status-card",
  "toHaveCount(11)",
  "상태: 예약",
  "상태: 사용중",
  "상태: 종료확인",
  "상태: 청소중",
  "상태: 빈방",
  "남은분",
  "종료예정",
  "실시간 갱신 상태",
  "/calls",
  "/settlements",
  "/masters/rooms",
  "콜 원장 그리드",
  "저장중"
]) {
  if (!e2e.includes(required)) errors.push(`story-3-3-rooms-waiter-guidance.spec.ts missing ${required}`);
}
if (e2e.includes("waitForTimeout(")) {
  errors.push("story-3-3-rooms-waiter-guidance.spec.ts must not use hardcoded waits");
}
if (e2e.includes("Algorithm.Argon2id")) {
  errors.push("story-3-3-rooms-waiter-guidance.spec.ts must not reference @node-rs/argon2 ambient const enum directly");
}

const docs = `${read("_bmad-output/project-context.md")}\n${read("docs/modules/rooms.md")}\n${read("src/modules/rooms/README.md")}\n${read("docs/modules/calls.md")}`;
for (const required of [
  "Story 3.3",
  "/rooms",
  "웨이터",
  "조회 전용",
  "읽기 전용",
  "RoomStatusDto",
  "RoomStatusCard",
  "ROOM_STATUS_GUIDANCE_TEXT",
  "listRoomStatuses",
  "15초",
  "갱신 지연",
  "UI 계산 재구현 금지"
]) {
  if (!docs.includes(required)) errors.push(`docs/project context missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 3.3 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 3.3 validation passed.");
