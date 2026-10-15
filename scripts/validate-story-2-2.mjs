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
  // i18n 전환: 액션 에러 문구는 t() key로 참조하고 한국어 원문은 messages/ko.ts에 보존한다.
  "action.error.noPermission"
]) {
  if (!actions.includes(required)) errors.push(`calls actions missing ${required}`);
}

// 행 저장 순서와 저장 상태 표시는 티켓 15에서 call-row-save.ts·call-row-save-status.tsx·공통 SaveStatus로 옮겼다.
const grid = [
  "src/app/(erp)/calls/editable-call-grid.tsx",
  "src/app/(erp)/calls/call-row-save.ts",
  "src/app/(erp)/calls/call-row-save-status.tsx",
  "src/components/ui/save-status.tsx"
]
  .map(read)
  .join("\n");
for (const required of [
  "autosaveServiceCallRowAction",
  "idle",
  "saving",
  "saved",
  "failed",
  "conflict",
  // i18n 전환: 저장 상태 문구는 t() key로 참조하고, 원문은 messages/ko.ts에 보존한다.
  // 티켓 15: 저장 중·저장됨·저장 실패·충돌 확인 필요는 공통 SaveStatus의 common.saveState.* 문구다.
  "SaveStatus",
  "common.saveState.",
  "calls.save.retry",
  "calls.save.reloadLatest",
  "onBlur",
  "serviceCallId",
  "disabled={isLocked",
  "aria-live"
]) {
  if (!grid.includes(required)) errors.push(`editable-call-grid.tsx missing ${required}`);
}
const koMessages = read("src/lib/i18n/messages/ko.ts");
for (const label of ["저장 중", "저장됨", "저장 실패", "충돌 확인 필요", "재시도", "최신 내용으로 다시 불러오기"]) {
  if (!koMessages.includes(label)) errors.push(`messages/ko.ts missing call save label: ${label}`);
}
// i18n 전환: 액션 에러 한국어 원문은 messages/ko.ts에 보존한다.
if (!koMessages.includes("권한이 없습니다.")) {
  errors.push("messages/ko.ts missing action error original 권한이 없습니다.");
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
  // 티켓 15: 저장이 끝났는지는 잠깐 보이는 "저장 중" 대신 data-save-state로 기다린다.
  "data-save-state",
  "저장됨",
  "저장 실패",
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
  // 티켓 15: 문서는 Story 2.2 문구(저장중·저장 보류)가 바뀐 것과 새 문구를 함께 적는다.
  "저장 중",
  "저장됨",
  "저장 실패",
  "충돌 확인 필요",
  "STALE_CALL"
]) {
  if (!docs.includes(required)) errors.push(`calls docs/project context missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 2.2 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 2.2 validation passed.");
