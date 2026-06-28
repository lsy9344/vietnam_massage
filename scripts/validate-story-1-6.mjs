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
  "src/modules/masters/code-schema.ts",
  "src/modules/masters/code-service.ts",
  "src/modules/masters/code-service.test.ts",
  "src/app/(erp)/masters/codes/actions.ts",
  "src/app/(erp)/masters/codes/page.tsx",
  "src/app/(erp)/masters/codes/code-forms.tsx",
  "src/lib/navigation.ts",
  "src/modules/masters/README.md",
  "docs/modules/masters.md",
  "_bmad-output/project-context.md",
  "tests/e2e/story-1-6-codes-time-slots.spec.ts"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-1-6.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-1-6.mjs");
}

const prismaSchema = read("prisma/schema.prisma");
for (const required of [
  "model CodeItem",
  "codeType",
  "displayName",
  "sortOrder",
  "isSystemDefault",
  "isActive",
  "@map(\"code_type\")",
  "@map(\"display_name\")",
  "@map(\"sort_order\")",
  "@map(\"is_system_default\")",
  "@map(\"is_active\")",
  "@map(\"created_at\")",
  "@map(\"updated_at\")",
  "@@unique([codeType, code]",
  "@@unique([codeType, sortOrder]",
  "@@map(\"code_items\")",
  "model TimeSlot",
  "value",
  "@@map(\"time_slots\")"
]) {
  if (!prismaSchema.includes(required)) {
    errors.push(`prisma/schema.prisma missing Story 1.6 requirement: ${required}`);
  }
}

const schema = read("src/modules/masters/code-schema.ts");
for (const required of [
  "SERVICE_STATUS",
  "PAYMENT_METHOD",
  "DISCOUNT_TYPE",
  "ATTENDANCE_STATUS",
  "CONFIRMATION",
  "예약",
  "방문완료",
  "현금",
  "일주일내방문",
  "정상",
  "Y",
  "N",
  "defaultTimeSlots",
  "11:00",
  "01:00",
  "createCodeItemSchema",
  "updateCodeItemDisplayNameSchema",
  "updateCodeItemSortOrderSchema",
  "deactivateCodeItemSchema",
  "createTimeSlotSchema",
  "updateTimeSlotValueSchema",
  "updateTimeSlotSortOrderSchema",
  "deactivateTimeSlotSchema"
]) {
  if (!schema.includes(required)) {
    errors.push(`code-schema.ts missing ${required}`);
  }
}
for (const prohibited of ["01:30", "02:00", "02:30"]) {
  if (schema.includes(`value: "${prohibited}"`)) {
    errors.push(`defaultTimeSlots must not seed ${prohibited}`);
  }
}

const service = read("src/modules/masters/code-service.ts");
for (const required of [
  "ensureDefaultCodeItems",
  "ensureDefaultTimeSlots",
  "listCodeItems",
  "listActiveCodeItems",
  "listTimeSlots",
  "listActiveTimeSlots",
  "createCodeItem",
  "updateCodeItemDisplayName",
  "updateCodeItemSortOrder",
  "deactivateCodeItem",
  "createTimeSlot",
  "updateTimeSlotValue",
  "updateTimeSlotSortOrder",
  "deactivateTimeSlot",
  "CodeDomainError",
  "recordAuditEvent",
  "code_item.created",
  "code_item.display_name_changed",
  "code_item.sort_order_changed",
  "code_item.deactivated",
  "time_slot.created",
  "time_slot.value_changed",
  "time_slot.sort_order_changed",
  "time_slot.deactivated",
  "targetType: \"code_item\"",
  "targetType: \"time_slot\"",
  "$transaction",
  "findUnique",
  "updateMany",
  "isActive: false"
]) {
  if (!service.includes(required)) {
    errors.push(`code-service.ts missing ${required}`);
  }
}
for (const prohibited of [".delete(", ".deleteMany(", "where: { displayName", "where: { value: parsed.data.displayName"]) {
  if (service.includes(prohibited)) {
    errors.push(`code-service.ts must not use physical delete or mutable label lookup: ${prohibited}`);
  }
}

const actions = read("src/app/(erp)/masters/codes/actions.ts");
for (const required of [
  "\"use server\"",
  "requirePermission(\"employee:write\")",
  "ActionResult",
  "FormData",
  "safeParse",
  "createCodeItem",
  "updateCodeItemDisplayName",
  "updateCodeItemSortOrder",
  "deactivateCodeItem",
  "createTimeSlot",
  "updateTimeSlotValue",
  "updateTimeSlotSortOrder",
  "deactivateTimeSlot",
  "revalidatePath(\"/masters/codes\")",
  "fieldErrors",
  "formError"
]) {
  if (!actions.includes(required)) {
    errors.push(`code actions missing ${required}`);
  }
}

const page = `${read("src/app/(erp)/masters/codes/page.tsx")}\n${read("src/app/(erp)/masters/codes/code-forms.tsx")}`;
// i18n 전환: 화면 문구는 t() key로 참조하고 한국어 원문은 messages/ko.ts에 보존한다.
const koMessages16 = read("src/lib/i18n/messages/ko.ts");
for (const required of [
  "requireRouteAccess(\"/masters/codes\")",
  "ensureDefaultCodeItems",
  "ensureDefaultTimeSlots",
  "listCodeItems",
  "listTimeSlots",
  "masters.codes.title",
  "masters.codes.type.SERVICE_STATUS",
  "masters.codes.type.PAYMENT_METHOD",
  "masters.codes.type.DISCOUNT_TYPE",
  "masters.codes.type.ATTENDANCE_STATUS",
  "masters.codes.type.CONFIRMATION",
  "masters.codes.timeSlot",
  "masters.codes.stableCode",
  "masters.common.displayName",
  "masters.common.sortOrder",
  "masters.codes.column.systemDefault",
  "masters.common.activeColumn",
  "masters.common.deactivate",
  "updateCodeItemDisplayNameAction",
  "updateCodeItemSortOrderAction",
  "deactivateCodeItemAction",
  "updateTimeSlotValueAction",
  "updateTimeSlotSortOrderAction",
  "deactivateTimeSlotAction"
]) {
  if (!page.includes(required)) {
    errors.push(`codes page missing ${required}`);
  }
}
for (const ko of ["코드/시간 슬롯", "상태", "결제수단", "할인구분", "근무상태", "확인값", "시간 슬롯", "안정 코드", "표시명", "정렬 순서", "시스템 기본", "활성 여부", "비활성 처리"]) {
  if (!koMessages16.includes(ko)) {
    errors.push(`messages/ko.ts missing codes string: ${ko}`);
  }
}
if (page.includes("삭제")) {
  errors.push("/masters/codes page must not present physical delete wording");
}

const navigation = read("src/lib/navigation.ts");
for (const required of ["nav.item.mastersCodes", "/masters/codes", "administrator"]) {
  if (!navigation.includes(required)) {
    errors.push(`navigation.ts missing ${required}`);
  }
}
if (navigation.includes("disabled")) {
  errors.push("navigation must hide unauthorized code links, not disable them");
}

const unitTest = read("src/modules/masters/code-service.test.ts");
for (const required of [
  "예약",
  "방문완료",
  "현금",
  "일주일내방문",
  "정상",
  "CONFIRMATION",
  "29",
  "11:00",
  "01:00",
  "01:30",
  "02:00",
  "02:30",
  "idempotent",
  "preserves",
  "같은 코드 유형에 이미 존재하는 코드입니다.",
  "이미 존재하는 시간 슬롯입니다.",
  "code_item.created",
  "code_item.display_name_changed",
  "code_item.sort_order_changed",
  "code_item.deactivated",
  "time_slot.created",
  "time_slot.value_changed",
  "time_slot.sort_order_changed",
  "time_slot.deactivated"
]) {
  if (!unitTest.includes(required)) {
    errors.push(`code service test missing ${required}`);
  }
}

const e2e = read("tests/e2e/story-1-6-codes-time-slots.spec.ts");
for (const required of [
  "mode: \"serial\"",
  "administrator",
  "counter",
  "settlement_manager",
  "waiter",
  "read_only_viewer",
  "/masters/codes",
  "코드/시간 슬롯",
  "예약",
  "방문완료",
  "현금",
  "Y",
  "N",
  "11:00",
  "01:00",
  "01:30",
  "code_item.display_name_changed",
  "time_slot.deactivated",
  "direct /masters/codes"
]) {
  if (!e2e.includes(required)) {
    errors.push(`Story 1.6 e2e missing ${required}`);
  }
}

const readme = read("src/modules/masters/README.md");
for (const required of ["ensureDefaultCodeItems", "ensureDefaultTimeSlots", "listActiveCodeItems", "code_item.created", "time_slot.deactivated"]) {
  if (!readme.includes(required)) {
    errors.push(`masters README missing ${required}`);
  }
}

const mastersDoc = read("docs/modules/masters.md");
for (const required of ["CodeItem", "TimeSlot", "codeType", "displayName", "sortOrder", "비활성", "11:00", "01:00"]) {
  if (!mastersDoc.includes(required)) {
    errors.push(`docs/modules/masters.md missing ${required}`);
  }
}

const projectContext = read("_bmad-output/project-context.md");
for (const required of ["CodeItem", "TimeSlot", "SERVICE_STATUS", "PAYMENT_METHOD", "DISCOUNT_TYPE", "ATTENDANCE_STATUS", "CONFIRMATION", "11:00", "01:00", "29개", "stable"]) {
  if (!projectContext.includes(required)) {
    errors.push(`project-context.md missing code/time-slot fact: ${required}`);
  }
}

if (errors.length > 0) {
  console.error("Story 1.6 static validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Story 1.6 static validation passed.");
