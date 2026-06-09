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
  "pnpm-lock.yaml",
  "src/app/(erp)/calls/editable-call-grid.tsx",
  "src/app/(erp)/calls/call-ledger-keyboard.ts",
  "src/app/(erp)/calls/call-ledger-keyboard.test.ts",
  "tests/e2e/story-2-6-call-ledger-keyboard-typeahead.spec.ts",
  "src/modules/calls/README.md",
  "docs/modules/calls.md",
  "_bmad-output/project-context.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (packageJson.dependencies?.["@tanstack/react-table"] !== "8.21.3") {
  errors.push("package.json must pin @tanstack/react-table to exact 8.21.3");
}
if (!packageJson.scripts?.lint?.includes("validate-story-2-6.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-2-6.mjs");
}

const lockfile = read("pnpm-lock.yaml");
if (!lockfile.includes("'@tanstack/react-table'")) {
  errors.push("pnpm-lock.yaml importer must include @tanstack/react-table");
}

const grid = read("src/app/(erp)/calls/editable-call-grid.tsx");
for (const required of [
  "useReactTable",
  "getCoreRowModel",
  "role=\"combobox\"",
  "role=\"listbox\"",
  "role=\"option\"",
  "aria-expanded",
  "aria-controls",
  "aria-activedescendant",
  "moveTabCell",
  "moveEnterCell",
  "moveAdjacentCell",
  "cancelCellDraft",
  "focusLedgerCell",
  "event.currentTarget.select()",
  "data-call-cell-row",
  "data-call-cell-column",
  "bg-readonly",
  "aria-live=\"polite\"",
  "aria-invalid",
  "aria-describedby"
]) {
  if (!grid.includes(required)) errors.push(`editable-call-grid.tsx missing ${required}`);
}

const helper = read("src/app/(erp)/calls/call-ledger-keyboard.ts");
for (const required of [
  "EDITABLE_CALL_FIELDS",
  "READONLY_CALL_FIELDS",
  "moveTabCell",
  "moveEnterCell",
  "moveAdjacentCell",
  "cancelCellDraft",
  "paymentAmount",
  "earcarePoolAmount"
]) {
  if (!helper.includes(required)) errors.push(`call-ledger-keyboard.ts missing ${required}`);
}

const unitTest = read("src/app/(erp)/calls/call-ledger-keyboard.test.ts");
for (const required of ["Tab and Shift+Tab", "Enter commits", "Arrow movement", "computed cells", "Esc cancel"]) {
  if (!unitTest.includes(required)) errors.push(`call-ledger-keyboard.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-2-6-call-ledger-keyboard-typeahead.spec.ts");
for (const required of [
  "Story 2.6",
  "keyboard-first call ledger",
  "aria-expanded",
  "aria-activedescendant",
  "seedAuthAccount",
  "seedStoryData",
  "test.beforeAll",
  "operatingMonthId=${seededData.openMonthId}",
  "Tab",
  "Shift+Tab",
  "Escape",
  "D코스는 마사지사2 필수입니다",
  "저장 보류 계산 대기"
]) {
  if (!e2e.includes(required)) errors.push(`story-2-6 e2e missing ${required}`);
}

const docs = `${read("src/modules/calls/README.md")}\n${read("docs/modules/calls.md")}\n${read("_bmad-output/project-context.md")}`;
for (const required of [
  "Story 2.6",
  "TanStack Table",
  "type-ahead",
  "aria-activedescendant",
  "stable value",
  "computed readonly",
  "Esc"
]) {
  if (!docs.includes(required)) errors.push(`calls docs/project context missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 2.6 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 2.6 validation passed.");
