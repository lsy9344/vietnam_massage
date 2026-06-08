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
  "src/modules/audit/audit-event.ts",
  "src/modules/audit/audit-service.ts",
  "src/modules/audit/README.md",
  "src/app/(erp)/audit/page.tsx",
  "src/lib/authorization.ts",
  "src/lib/navigation.ts",
  "tests/e2e/story-1-3-audit-log.spec.ts"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-1-3.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-1-3.mjs");
}

const prismaSchema = read("prisma/schema.prisma");
for (const required of [
  "model AuditLog",
  "actorId",
  "action",
  "targetType",
  "targetId",
  "beforeValue Json?",
  "afterValue  Json?",
  "@map(\"actor_id\")",
  "@map(\"target_type\")",
  "@map(\"target_id\")",
  "@map(\"before_value\")",
  "@map(\"after_value\")",
  "@map(\"created_at\")",
  "@@map(\"audit_logs\")",
  "idx_audit_logs_created_at",
  "idx_audit_logs_target_type_target_id",
  "idx_audit_logs_action"
]) {
  if (!prismaSchema.includes(required)) {
    errors.push(`prisma/schema.prisma missing AuditLog requirement: ${required}`);
  }
}

const auditEvent = read("src/modules/audit/audit-event.ts");
for (const required of [
  "auditActionPattern",
  "^[a-z]+(_[a-z]+)*\\.[a-z]+(_[a-z]+)*$",
  "AuditDomainError",
  "assertValidAuditAction",
  "AuditJsonSnapshot",
  "RecordAuditEventInput",
  "AuditLogQuery"
]) {
  if (!auditEvent.includes(required)) {
    errors.push(`audit-event.ts missing ${required}`);
  }
}

const auditService = read("src/modules/audit/audit-service.ts");
for (const required of [
  "recordAuditEvent",
  "listAuditLogs",
  "assertValidAuditAction(action)",
  "INVALID_AUDIT_JSON",
  "assertJsonSnapshot",
  "prismaClient",
  "beforeSummary",
  "afterSummary",
  "orderBy: { createdAt: \"desc\" }",
  "where.targetType",
  "where.createdAt"
]) {
  if (!auditService.includes(required)) {
    errors.push(`audit-service.ts missing ${required}`);
  }
}
for (const prohibited of [
  ".auditLog.update",
  ".auditLog.delete",
  ".auditLog.deleteMany",
  "deleteAudit",
  "removeAudit",
  "eventBus",
  "globalThis.audit"
]) {
  if (auditService.includes(prohibited)) {
    errors.push(`audit-service.ts contains prohibited mutable/global audit path: ${prohibited}`);
  }
}

const auditPage = read("src/app/(erp)/audit/page.tsx");
for (const required of [
  "requireRouteAccess(\"/audit\")",
  "requirePermission(\"audit:read\")",
  "listAuditLogs",
  "targetType",
  "from",
  "to",
  "type=\"date\"",
  "lastDayOfMonth",
  "종료일은 시작일과 같거나 이후여야 합니다.",
  "감사 로그를 불러오지 못했습니다.",
  "변경 이력 조회",
  "변경 전",
  "변경 후",
  "<details>"
]) {
  if (!auditPage.includes(required)) {
    errors.push(`audit page missing ${required}`);
  }
}
if (auditPage.includes("ErpEmptyState") || auditPage.includes("Story 1.3에서 연결")) {
  errors.push("/audit page placeholder must be removed");
}

const authorization = read("src/lib/authorization.ts");
if (!authorization.includes("\"audit:read\"") || !authorization.includes("\"/audit\"")) {
  errors.push("authorization.ts must preserve administrator audit:read and /audit access");
}
if (/counter:[^\n]+\baudit:read\b/.test(authorization)) {
  errors.push("counter must not have audit:read permission");
}

const navigation = read("src/lib/navigation.ts");
if (!navigation.includes("감사 로그") || !navigation.includes("administrator")) {
  errors.push("navigation.ts must keep administrator-only audit sidebar entry");
}
if (navigation.includes("disabled")) {
  errors.push("navigation must hide unauthorized audit links, not disable them");
}

const e2e = read("tests/e2e/story-1-3-audit-log.spec.ts");
for (const required of [
  "administrator",
  "counter",
  "settlement_manager",
  "waiter",
  "read_only_viewer",
  "/audit",
  "service_call.status_changed",
  "감사 로그",
  "direct /audit"
]) {
  if (!e2e.includes(required)) {
    errors.push(`Story 1.3 e2e missing ${required}`);
  }
}
for (const required of [
  "recordAuditEvent",
  "2026-02-31",
  "종료일은 시작일과 같거나 이후여야 합니다.",
  "Number.NaN"
]) {
  if (!e2e.includes(required)) {
    errors.push(`Story 1.3 e2e missing review coverage: ${required}`);
  }
}

if (errors.length > 0) {
  console.error("Story 1.3 static validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Story 1.3 static validation passed.");
