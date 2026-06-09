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
  "src/modules/rooms/dtos.ts",
  "src/modules/rooms/room-status-service.ts",
  "src/modules/rooms/room-status-service.test.ts",
  "src/modules/rooms/README.md",
  "docs/modules/rooms.md",
  "tests/e2e/story-3-1-room-status-service.spec.ts",
  "_bmad-output/project-context.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-3-1.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-3-1.mjs");
}

const dtos = read("src/modules/rooms/dtos.ts");
for (const required of [
  "RoomDisplayStatus",
  '"사용중"',
  '"예약"',
  '"청소중"',
  '"종료확인"',
  '"빈방"',
  "RoomStatusDto",
  "roomId: string",
  "roomDisplayName: string",
  "roomSortOrder: number",
  "displayStatus: RoomDisplayStatus",
  "sourceCallStatus: string | null",
  "activeCallId: string | null",
  "serviceDate: string",
  "startTime: string | null",
  "expectedEndAt: string | null",
  "remainingMinutes: number | null",
  "course: RoomStatusCourseDto | null",
  "therapist1: RoomStatusAssigneeDto | null",
  "therapist2: RoomStatusAssigneeDto | null",
  "earcare: RoomStatusAssigneeDto | null",
  "guidanceText: string",
  "updatedAt: string"
]) {
  if (!dtos.includes(required)) errors.push(`dtos.ts missing ${required}`);
}

const service = read("src/modules/rooms/room-status-service.ts");
for (const required of [
  "listRoomStatuses",
  "operatingMonthId",
  "serviceDate",
  "now?: Date",
  "prismaClient?",
  "ACTIVE_ROOM_OCCUPANCY_STATUSES",
  "EXCLUDED_ROOM_OCCUPANCY_STATUSES",
  '"예약"',
  '"RESERVED"',
  '"사용중"',
  '"IN_USE"',
  '"USING"',
  '"청소중"',
  '"CLEANING"',
  '"방문완료"',
  '"VISIT_COMPLETE"',
  '"노쇼"',
  '"NO_SHOW"',
  '"취소"',
  '"CANCELED"',
  "normalizeOperatingDateTime",
  "OPERATING_DAY_START_HOUR",
  "Math.max(0",
  '"종료확인"',
  "ROOM_STATUS_GUIDANCE_TEXT",
  "assignments: { where: { isActive: true }, include: { employee: true } }",
  "orderBy: [{ sortOrder: \"asc\" }, { createdAt: \"asc\" }]"
]) {
  if (!service.includes(required)) errors.push(`room-status-service.ts missing ${required}`);
}
for (const forbidden of [".create(", ".update(", ".updateMany(", ".delete(", ".deleteMany(", ".upsert("]) {
  if (service.includes(forbidden)) errors.push(`room-status-service.ts must stay read-only and not include ${forbidden}`);
}

const unitTest = read("src/modules/rooms/room-status-service.test.ts");
for (const required of [
  "returns all 11 active rooms",
  "empty rooms as 빈방",
  "maps 예약, 청소중, 사용중",
  "excludes 방문완료, 노쇼, and 취소",
  "selects the latest active call",
  "normalized service date",
  "deterministic tie breaker",
  "cross-midnight expected end",
  "종료확인",
  "without negative remaining minutes",
  "course policy is missing",
  "rejects invalid service dates",
  "INVALID_SERVICE_DATE",
  "INVALID_START_TIME",
  "read-only queries",
  "writeOperations"
]) {
  if (!unitTest.includes(required)) errors.push(`room-status-service.test.ts missing ${required}`);
}

const e2eTest = read("tests/e2e/story-3-1-room-status-service.spec.ts");
for (const required of [
  "Story 3.1 room status DTO service",
  "listRoomStatuses",
  "RoomStatusDto",
  "returns consistent RoomStatusDto values",
  "RESERVED",
  "CLEANING",
  "VISIT_COMPLETE",
  "NO_SHOW",
  "CANCELED",
  "expectedEndAt",
  "2034-07-05T16:00:00.000Z",
  "remainingMinutes",
  "종료확인",
  "course: null",
  "writeOperations",
  "serviceCallStatusHistory.create",
  "auditLog.create",
  "dailyExpense.create"
]) {
  if (!e2eTest.includes(required)) errors.push(`story-3-1-room-status-service.spec.ts missing ${required}`);
}
if (e2eTest.includes("waitForTimeout(")) {
  errors.push("story-3-1-room-status-service.spec.ts must not use hardcoded waits");
}

const docs = `${read("src/modules/rooms/README.md")}\n${read("docs/modules/rooms.md")}\n${read("_bmad-output/project-context.md")}`;
for (const required of [
  "Story 3.1",
  "RoomStatusDto",
  "listRoomStatuses",
  "active call",
  "예약",
  "RESERVED",
  "사용중",
  "청소중",
  "방문완료",
  "VISIT_COMPLETE",
  "NO_SHOW",
  "CANCELED",
  "자정",
  "종료확인",
  "read-only",
  "조회 전용"
]) {
  if (!docs.includes(required)) errors.push(`rooms docs/project context missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 3.1 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 3.1 validation passed.");
