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
  "prisma/schema.prisma",
  "src/modules/masters/room-schema.ts",
  "src/modules/masters/room-service.ts",
  "src/modules/masters/room-service.test.ts",
  "src/app/(erp)/masters/rooms/actions.ts",
  "src/app/(erp)/masters/rooms/page.tsx",
  "src/app/(erp)/masters/rooms/room-forms.tsx",
  "src/lib/navigation.ts",
  "src/modules/masters/README.md",
  "docs/modules/masters.md",
  "_bmad-output/project-context.md",
  "tests/e2e/story-1-5-rooms-master.spec.ts"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-1-5.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-1-5.mjs");
}

const prismaSchema = read("prisma/schema.prisma");
for (const required of [
  "model Room",
  "displayName",
  "migrationReferenceName",
  "sortOrder",
  "isActive",
  "@map(\"display_name\")",
  "@map(\"migration_reference_name\")",
  "@map(\"sort_order\")",
  "@map(\"is_active\")",
  "@map(\"created_at\")",
  "@map(\"updated_at\")",
  "@unique",
  "@@map(\"rooms\")"
]) {
  if (!prismaSchema.includes(required)) {
    errors.push(`prisma/schema.prisma missing Room requirement: ${required}`);
  }
}

const schema = read("src/modules/masters/room-schema.ts");
for (const required of [
  "defaultRooms",
  "101 호실",
  "402 호실",
  "1번방",
  "11번방",
  "roomDisplayNameSchema",
  "roomSortOrderSchema",
  "updateRoomDisplayNameSchema",
  "updateRoomSortOrderSchema",
  "deactivateRoomSchema"
]) {
  if (!schema.includes(required)) {
    errors.push(`room-schema.ts missing ${required}`);
  }
}

const service = read("src/modules/masters/room-service.ts");
for (const required of [
  "ensureDefaultRooms",
  "listRooms",
  "listActiveRooms",
  "updateRoomDisplayName",
  "updateRoomSortOrder",
  "deactivateRoom",
  "RoomDomainError",
  "recordAuditEvent",
  "room.created",
  "room.display_name_changed",
  "room.sort_order_changed",
  "room.deactivated",
  "targetType: \"room\"",
  "$transaction",
  "findUnique",
  "updateMany",
  "isActive: false"
]) {
  if (!service.includes(required)) {
    errors.push(`room-service.ts missing ${required}`);
  }
}
for (const prohibited of [".delete(", ".deleteMany(", "where: { displayName", "where: { migrationReferenceName"]) {
  if (service.includes(prohibited)) {
    errors.push(`room-service.ts must not use physical delete or mutable label lookup: ${prohibited}`);
  }
}

const actions = read("src/app/(erp)/masters/rooms/actions.ts");
for (const required of [
  "\"use server\"",
  "requirePermission(\"employee:write\")",
  "ActionResult",
  "FormData",
  "safeParse",
  "updateRoomDisplayName",
  "updateRoomSortOrder",
  "deactivateRoom",
  "revalidatePath(\"/masters/rooms\")",
  "fieldErrors",
  "formError"
]) {
  if (!actions.includes(required)) {
    errors.push(`room actions missing ${required}`);
  }
}

const page = `${read("src/app/(erp)/masters/rooms/page.tsx")}\n${read("src/app/(erp)/masters/rooms/room-forms.tsx")}`;
for (const required of [
  "requireRouteAccess(\"/masters/rooms\")",
  "ensureDefaultRooms",
  "listRooms",
  "객실 마스터",
  "표시명",
  "이관 참조값",
  "정렬 순서",
  "활성 여부",
  "생성 시각",
  "수정 시각",
  "비활성 처리",
  "updateRoomDisplayNameAction",
  "updateRoomSortOrderAction",
  "deactivateRoomAction"
]) {
  if (!page.includes(required)) {
    errors.push(`rooms page missing ${required}`);
  }
}
if (page.includes("삭제")) {
  errors.push("/masters/rooms page must not present physical delete wording");
}

const navigation = read("src/lib/navigation.ts");
for (const required of ["객실", "/masters/rooms", "administrator"]) {
  if (!navigation.includes(required)) {
    errors.push(`navigation.ts missing ${required}`);
  }
}
if (navigation.includes("disabled")) {
  errors.push("navigation must hide unauthorized room links, not disable them");
}

const unitTest = read("src/modules/masters/room-service.test.ts");
for (const required of [
  "101 호실",
  "402 호실",
  "1번방",
  "11번방",
  "idempotent",
  "does not create duplicate",
  "preserves its stable id",
  "정렬 순서가 이미 사용 중입니다.",
  "isActive",
  "room.created",
  "room.display_name_changed",
  "room.sort_order_changed",
  "room.deactivated"
]) {
  if (!unitTest.includes(required)) {
    errors.push(`room service test missing ${required}`);
  }
}

const e2e = read("tests/e2e/story-1-5-rooms-master.spec.ts");
for (const required of [
  "mode: \"serial\"",
  "administrator",
  "counter",
  "settlement_manager",
  "waiter",
  "read_only_viewer",
  "/masters/rooms",
  "객실 마스터",
  "101 호실",
  "402 호실",
  "1번방",
  "표시명",
  "roomRowByDisplayValue",
  "getByDisplayValue",
  "비활성 처리",
  "room.display_name_changed",
  "room.deactivated",
  "direct /masters/rooms"
]) {
  if (!e2e.includes(required)) {
    errors.push(`Story 1.5 e2e missing ${required}`);
  }
}

const readme = read("src/modules/masters/README.md");
for (const required of ["객실", "ensureDefaultRooms", "listRooms", "room.created", "room.deactivated"]) {
  if (!readme.includes(required)) {
    errors.push(`masters README missing ${required}`);
  }
}

const mastersDoc = read("docs/modules/masters.md");
for (const required of ["Room", "displayName", "migrationReferenceName", "sortOrder", "비활성"]) {
  if (!mastersDoc.includes(required)) {
    errors.push(`docs/modules/masters.md missing ${required}`);
  }
}

const projectContext = read("_bmad-output/project-context.md");
for (const required of ["Room", "101 호실", "1번방", "Room.id", "sortOrder", "room.deactivated"]) {
  if (!projectContext.includes(required)) {
    errors.push(`project-context.md missing room fact: ${required}`);
  }
}

if (errors.length > 0) {
  console.error("Story 1.5 static validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Story 1.5 static validation passed.");
