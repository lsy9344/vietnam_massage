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

const expectedSheets = [
  "오늘대시보드",
  "실시간콜입력",
  "웨이터리스트",
  "TV현황판",
  "운영팀근무인센",
  "귀케어일정산",
  "마사지사일정산",
  "월마감",
  "직원DB",
  "TV설정",
  "설정_코스수당",
  "목록"
];

[
  "src/modules/migration/sheet-feature-mapping.ts",
  "src/modules/migration/sheet-feature-mapping.test.ts",
  "tests/e2e/story-7-1-sheet-mapping.spec.ts",
  "src/app/(erp)/masters/sheet-mapping/page.tsx",
  "src/lib/authorization.ts",
  "src/lib/authorization.test.ts",
  "src/lib/navigation.ts",
  "docs/modules/README.md",
  "docs/modules/migration-verification.md",
  "_bmad-output/project-context.md",
  "package.json"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-6-4.mjs && node scripts/validate-story-7-1.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-7-1.mjs immediately after validate-story-6-4.mjs");
}

const mapping = read("src/modules/migration/sheet-feature-mapping.ts");
for (const sheet of expectedSheets) {
  if (!mapping.includes(`sourceSheet: "${sheet}"`) && !mapping.includes(`name: "${sheet}"`)) {
    errors.push(`sheet-feature-mapping.ts missing expected source sheet: ${sheet}`);
  }
}
for (const field of [
  "sourceSheet",
  "visibility",
  "workbookEvidence",
  "erpSurfaces",
  "settings",
  "calculationEngines",
  "verificationItems",
  "preservedRules",
  "sourceReferences"
]) {
  if (!mapping.includes(field)) errors.push(`sheet-feature-mapping.ts missing mapping field: ${field}`);
}
for (const required of [
  "visibility: \"hidden\"",
  "A:S",
  "U:X",
  "방문완료",
  "RoomStatusDto",
  "listRoomStatuses()",
  "Room.id",
  "Employee.id",
  "Course.id",
  "CodeItem.id",
  "TimeSlot.value",
  "SERVICE_STATUS: 예약, 사용중, 청소중, 방문완료, 노쇼, 취소",
  "PAYMENT_METHOD: 현금, 카드, 계좌, 기타",
  "DISCOUNT_TYPE: 일주일내방문, 생일자, 후기작성",
  "ATTENDANCE_STATUS: 정상, 휴무, 지각, 조퇴, 결근",
  "CONFIRMATION: Y, N, null 선택 없음",
  "11:00~01:00 29개",
  "100,000 VND"
]) {
  if (!mapping.includes(required)) errors.push(`sheet-feature-mapping.ts missing Story 7.1 marker: ${required}`);
}
if (mapping.includes("workbookEvidence: [\"이관됨\"]") || mapping.includes("preservedRules: [\"이관됨\"]")) {
  errors.push("sheet-feature-mapping.ts must not use vague migrated-only mapping text");
}

const page = read("src/app/(erp)/masters/sheet-mapping/page.tsx");
// i18n 전환: 화면 문구는 t() key로 참조하고 한국어 원문은 messages/ko.ts에 보존한다.
const koMessages71 = read("src/lib/i18n/messages/ko.ts");
for (const required of [
  "requireRouteAccess(\"/masters/sheet-mapping\")",
  "getSheetMappingSummary()",
  "masters.sheetMapping.meta.preservationGoal",
  "masters.sheetMapping.summary.missingItemsNote",
  "masters.sheetMapping.description",
  "StatusBadge",
  "masters.sheetMapping.evidence.workbook",
  "masters.sheetMapping.evidence.erpSurfaces",
  "masters.sheetMapping.evidence.preservedRules",
  "masters.sheetMapping.evidence.verificationItems",
  "masters.sheetMapping.meta.noWriteNote"
]) {
  if (!page.includes(required)) errors.push(`sheet mapping page missing required marker: ${required}`);
}
for (const ko of [
  "기능 보존율 100%",
  "누락된 시트",
  "visible sheet와 숨김 목록 sheet",
  "원본 근거",
  "ERP 연결",
  "보존 규칙",
  "검증 항목",
  "쓰기 작업 없음",
  "DB 변경 없음"
]) {
  if (!koMessages71.includes(ko)) errors.push(`messages/ko.ts missing sheet-mapping string: ${ko}`);
}
for (const forbidden of ["\"use server\"", "recordAuditEvent", "createDailyExpense", "updateDailyExpense", "deactivateDailyExpense"]) {
  if (page.includes(forbidden)) errors.push(`sheet mapping page must stay read-only and not include: ${forbidden}`);
}

const authorization = read("src/lib/authorization.ts");
if (!authorization.includes("read_only_viewer: [\"/masters/sheet-mapping\"]")) {
  errors.push("authorization.ts must allow read_only_viewer exact access to /masters/sheet-mapping");
}
if (!authorization.includes("roleExactRoutes[role].includes(normalizedPath)")) {
  errors.push("authorization.ts must use exact-route handling for read_only_viewer sheet mapping access");
}
if (authorization.includes("read_only_viewer: [\"/rooms\", \"/tv\", \"/dashboard/today\", \"/dashboard/monthly\", \"/dashboard/reports\", \"/masters")) {
  errors.push("authorization.ts must not open /masters prefix to read_only_viewer");
}

const authorizationTest = read("src/lib/authorization.test.ts");
for (const required of [
  "Story 7.1 sheet mapping route access",
  "read_only_viewer\", \"/masters/sheet-mapping\"",
  "read_only_viewer\", \"/masters\"",
  "read_only_viewer\", \"/masters/codes\"",
  "waiter\", \"/masters/sheet-mapping\""
]) {
  if (!authorizationTest.includes(required)) errors.push(`authorization.test.ts missing Story 7.1 coverage marker: ${required}`);
}

const navigation = read("src/lib/navigation.ts");
for (const required of ["nav.item.mastersSheetMapping", "/masters/sheet-mapping", "\"administrator\", \"read_only_viewer\""]) {
  if (!navigation.includes(required)) errors.push(`navigation.ts missing Story 7.1 sidebar marker: ${required}`);
}

const unitTest = read("src/modules/migration/sheet-feature-mapping.test.ts");
for (const required of ["EXPECTED_SOURCE_SHEETS", "SHEET_FEATURE_MAPPINGS", "A:S", "U:X", "RoomStatusDto", "preservationRate"]) {
  if (!unitTest.includes(required)) errors.push(`sheet-feature-mapping.test.ts missing invariant marker: ${required}`);
}

const e2eTest = read("tests/e2e/story-7-1-sheet-mapping.spec.ts");
for (const required of [
  "Story 7.1 sheet mapping source guardrails",
  "Story 7.1 sheet mapping browser access",
  "read_only_viewer has exact access",
  "waiter is redirected away",
  "검증 실패: 누락된 시트",
  "쓰기 작업 없음",
  "A:S",
  "U:X",
  "목록",
  "StatusBadge"
]) {
  if (!e2eTest.includes(required)) errors.push(`story-7-1-sheet-mapping.spec.ts missing E2E marker: ${required}`);
}

for (const [label, contents] of [
  ["docs modules README", read("docs/modules/README.md")],
  ["migration verification docs", read("docs/modules/migration-verification.md")],
  ["project-context", read("_bmad-output/project-context.md")]
]) {
  for (const required of [
    "Story 7.1",
    "숨김",
    "목록",
    "12개",
    "source of truth",
    "stable ID",
    "셀 좌표",
    "기능 보존율 100%"
  ]) {
    if (!contents.includes(required)) errors.push(`${label} missing Story 7.1 documentation marker: ${required}`);
  }
}

if (errors.length > 0) {
  console.error("Story 7.1 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 7.1 validation passed.");
