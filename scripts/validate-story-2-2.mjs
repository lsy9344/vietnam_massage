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
  "src/modules/calls/service-call-schema.ts",
  "src/modules/calls/service-call-service.ts",
  "src/modules/calls/service-call-service.test.ts",
  "src/app/(erp)/calls/actions.ts",
  "src/app/(erp)/calls/editable-call-grid.tsx",
  "tests/e2e/story-2-2-call-ledger-autosave.spec.ts",
  "src/modules/calls/README.md",
  "docs/modules/calls.md",
  "_bmad-output/project-context.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-2-2.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-2-2.mjs");
}

const prismaSchema = read("prisma/schema.prisma");
for (const required of [
  "model ServiceCallStatusHistory",
  "@@map(\"service_call_status_histories\")",
  "statusHistories   ServiceCallStatusHistory[]",
  "changedServiceCallStatusHistories ServiceCallStatusHistory[]",
  "previousStatus",
  "newStatus",
  "changedByAccountId",
  "@@index([serviceCallId, changedAt]",
  "@@index([changedByAccountId, changedAt]",
  "isActive       Boolean    @default(true) @map(\"is_active\")"
]) {
  if (!prismaSchema.includes(required)) errors.push(`prisma/schema.prisma missing ${required}`);
}

const schema = read("src/modules/calls/service-call-schema.ts");
for (const required of [
  "serviceCallAutosaveInputSchema",
  "serviceCallId: z.string().trim().min(1",
  "ServiceCallAutosaveInput",
  "serviceCallInputSchema.extend"
]) {
  if (!schema.includes(required)) errors.push(`service-call-schema.ts missing ${required}`);
}

const service = read("src/modules/calls/service-call-service.ts");
for (const required of [
  "autosaveServiceCallRow",
  "listServiceCallStatusHistory",
  "ServiceCallStatusHistoryDto",
  "serviceCallStatusHistory.create",
  "recordAuditEvent",
  "service_call.status_changed",
  "service_call.row_changed",
  "changedByAccountId: actorId",
  "orderBy: { changedAt: \"asc\" }",
  "isActive: false",
  "toAuditSnapshot",
  "toISOString"
]) {
  if (!service.includes(required)) errors.push(`service-call-service.ts missing ${required}`);
}
if (service.includes(".delete(") || service.includes(".deleteMany(")) {
  errors.push("service-call-service.ts must not physically delete assignment rows for autosave clear behavior");
}

const actions = read("src/app/(erp)/calls/actions.ts");
for (const required of [
  "\"use server\"",
  "autosaveServiceCallRowAction",
  "autosaveServiceCallRow",
  "serviceCallAutosaveInputSchema",
  "requirePermission(\"call:write\")",
  "actorId: account.id",
  "ActionResult",
  "safeParse",
  "revalidatePath(\"/calls\")",
  "AuthorizationError",
  "ServiceCallDomainError",
  "domainErrorCode",
  "권한이 없습니다."
]) {
  if (!actions.includes(required)) errors.push(`calls actions missing ${required}`);
}

const grid = read("src/app/(erp)/calls/editable-call-grid.tsx");
for (const required of [
  "autosaveServiceCallRowAction",
  "idle",
  "saving",
  "saved",
  "error",
  "저장중",
  "저장됨",
  "저장 보류",
  "재시도",
  "onBlur",
  "serviceCallId",
  "disabled={isLocked",
  "aria-live"
]) {
  if (!grid.includes(required)) errors.push(`editable-call-grid.tsx missing ${required}`);
}

const unitTest = read("src/modules/calls/service-call-service.test.ts");
for (const required of [
  "autosaves one existing row",
  "status history",
  "service_call.status_changed",
  "service_call.row_changed",
  "clears optional assignments",
  "locked months",
  "inactive employees",
  "listServiceCallStatusHistory"
]) {
  if (!unitTest.includes(required)) errors.push(`service-call-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-2-2-call-ledger-autosave.spec.ts");
for (const required of [
  "Story 2.2",
  "저장중",
  "저장됨",
  "저장 보류",
  "재시도",
  "serviceCallStatusHistory",
  "service_call.status_changed",
  "service_call.row_changed",
  "권한이 없습니다.",
  "잠긴 운영월입니다."
]) {
  if (!e2e.includes(required)) errors.push(`story-2-2 e2e missing ${required}`);
}

const docs = `${read("src/modules/calls/README.md")}\n${read("docs/modules/calls.md")}\n${read("_bmad-output/project-context.md")}`;
for (const required of [
  "ServiceCallStatusHistory",
  "service_call_status_histories",
  "row autosave",
  "service_call.status_changed",
  "service_call.row_changed",
  "저장중",
  "저장됨",
  "저장 보류"
]) {
  if (!docs.includes(required)) errors.push(`calls docs/project context missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 2.2 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 2.2 validation passed.");
