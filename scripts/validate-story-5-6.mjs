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

[
  "src/components/ui/alert-dialog.tsx",
  "src/app/(erp)/closing/closing-action-panel.tsx",
  "src/app/(erp)/closing/page.tsx",
  "src/app/(erp)/closing/actions.ts",
  "src/modules/closing/monthly-closing-service.ts",
  "tests/e2e/story-5-6-monthly-close-confirm-dialog.spec.ts",
  "tests/e2e/story-5-3-monthly-close-confirmation.spec.ts",
  "tests/e2e/story-5-5-monthly-close-reopen.spec.ts",
  "src/modules/closing/README.md",
  "docs/modules/closing.md",
  "_bmad-output/project-context.md",
  "_bmad-output/implementation-artifacts/5-6-월마감-이중확인-모달과-접근성.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (packageJson.dependencies?.["@radix-ui/react-alert-dialog"] !== "1.1.15") {
  errors.push("package.json must declare @radix-ui/react-alert-dialog 1.1.15");
}
if (!packageJson.scripts?.lint?.includes("validate-story-5-5.mjs && node scripts/validate-story-5-6.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-5-6.mjs immediately after validate-story-5-5.mjs");
}

read("pnpm-lock.yaml");

const alertDialog = read("src/components/ui/alert-dialog.tsx");
for (const required of [
  "@radix-ui/react-alert-dialog",
  "AlertDialogPrimitive.Root",
  "AlertDialogPrimitive.Trigger",
  "AlertDialogPrimitive.Content",
  "AlertDialogPrimitive.Title",
  "AlertDialogPrimitive.Description",
  "AlertDialogAction",
  "AlertDialogCancel"
]) {
  if (!alertDialog.includes(required)) errors.push(`alert-dialog.tsx missing ${required}`);
}

// ko/vi i18n migration: closing UI strings moved to t() keys in the ko catalog.
const koCatalog = read("src/lib/i18n/messages/ko.ts");
function requireMoved(contents, fileLabel, key, korean) {
  if (!contents.includes(key)) errors.push(`${fileLabel} missing t() key ${key}`);
  if (!koCatalog.includes(korean)) errors.push(`ko.ts missing ${korean}`);
}

const panel = read("src/app/(erp)/closing/closing-action-panel.tsx");
for (const required of [
  "AlertDialog",
  "AlertDialogTrigger asChild",
  "AlertDialogContent",
  "AlertDialogTitle",
  "AlertDialogDescription",
  "AlertDialogCancel",
  "AlertDialogAction",
  "confirmSummary",
  "type=\"button\"",
  "requestSubmit()",
  "role=\"alert\"",
  "confirmCancelRef",
  "onOpenAutoFocus",
  "confirmState?.ok"
]) {
  if (!panel.includes(required)) errors.push(`closing-action-panel.tsx missing ${required}`);
}
requireMoved(panel, "closing-action-panel.tsx", "closing.action.close", "닫기");
requireMoved(panel, "closing-action-panel.tsx", "closing.confirmDialog.description", "확정 시 스냅샷이 고정되어 이후 설정 변경으로 재계산되지 않습니다.");
requireMoved(panel, "closing-action-panel.tsx", "closing.action.confirmSnapshot", "지급 스냅샷 확정");
if (panel.includes("<form action={confirmAction} className=\"grid gap-1\">")) {
  errors.push("ClosingActionPanel must not keep the old direct confirm submit form");
}
if (panel.includes("therapists.rows.reduce") || panel.includes("operations.rows.reduce") || panel.includes("earcare.rows.reduce")) {
  errors.push("ClosingActionPanel must not recalculate closing summary totals from rows");
}

const page = read("src/app/(erp)/closing/page.tsx");
for (const required of [
  "confirmSummaryFor",
  "ConfirmDialogSummary",
  "grandPayoutAmount: result.totals.grandPayoutAmount",
  "therapistPayoutAmount: result.totals.therapistPayoutAmount",
  "therapistCount: result.therapists.rows.length",
  "operationsPayoutAmount: result.operations.totalOpsPayoutAmount",
  "operationsCount: result.operations.rows.length",
  "earcarePayoutAmount: result.totals.earcarePayoutAmount",
  "earcareCount: result.earcare.rows.length",
  "warningCount: result.warningCounts.total",
  "confirmSummary={result ? confirmSummaryFor(result) : null}"
]) {
  if (!page.includes(required)) errors.push(`closing page.tsx missing ${required}`);
}

const actions = read("src/app/(erp)/closing/actions.ts");
for (const required of ["confirmMonthlyCloseAction", "requirePermission(\"closing:write\")", "confirmMonthlyClose", "revalidatePath(\"/closing\")"]) {
  if (!actions.includes(required)) errors.push(`closing actions.ts missing ${required}`);
}
if (actions.includes("monthly_close.confirmed") || actions.includes("recordAuditEvent(")) {
  errors.push("closing actions.ts must not implement confirmation audit directly");
}

const service = read("src/modules/closing/monthly-closing-service.ts");
for (const required of ["export async function confirmMonthlyClose", "monthly_close.confirmed", "closeVersion", "listMonthlyClosingPreview"]) {
  if (!service.includes(required)) errors.push(`monthly-closing-service.ts missing existing confirmation contract ${required}`);
}

const story56E2e = read("tests/e2e/story-5-6-monthly-close-confirm-dialog.spec.ts");
for (const required of [
  "Story 5.6 monthly close double-confirm dialog",
  "getByRole(\"alertdialog\"",
  "getByRole(\"button\", { name: \"마감 확정\" })",
  "지급 스냅샷 확정",
  "확정 시 스냅샷이 고정되어 이후 설정 변경으로 재계산되지 않습니다.",
  "monthlyClosing.count",
  "monthly_close.confirmed",
  "keyboard.press(\"Escape\")",
  "getByRole(\"button\", { name: \"닫기\" })",
  "toBeFocused()",
  "closest('[role=\"alertdialog\"]')",
  "aria-labelledby",
  "aria-describedby",
  "assertAlertDialogLabeling",
  "명 \\/ 일일",
  "await dialog.getByRole(\"button\", { name: \"취소\" }).click()",
  "현재 상태에서는 마감 확정할 수 없습니다.",
  "getByRole(\"alert\")"
]) {
  if (!story56E2e.includes(required)) errors.push(`story-5-6 e2e missing ${required}`);
}

const story53E2e = read("tests/e2e/story-5-3-monthly-close-confirmation.spec.ts");
if (!story53E2e.includes("confirmMonthlyCloseThroughDialog") || !story53E2e.includes("지급 스냅샷 확정")) {
  errors.push("Story 5.3 E2E must use the new second-confirm dialog flow");
}

const story55E2e = read("tests/e2e/story-5-5-monthly-close-reopen.spec.ts");
if (!story55E2e.includes("confirmMonthlyCloseThroughDialog") || !story55E2e.includes("지급 스냅샷 확정")) {
  errors.push("Story 5.5 E2E must use the new second-confirm dialog flow for reconfirm");
}

const readme = read("src/modules/closing/README.md");
const docs = read("docs/modules/closing.md");
const projectContext = read("_bmad-output/project-context.md");
for (const [label, contents] of [
  ["closing README", readme],
  ["closing docs", docs],
  ["project-context", projectContext]
]) {
  for (const required of ["Story 5.6", "AlertDialog", "role=\"alertdialog\"", "focus", "confirmMonthlyCloseAction"]) {
    if (!contents.includes(required)) errors.push(`${label} missing ${required}`);
  }
}

if (errors.length > 0) {
  console.error("Story 5.6 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 5.6 validation passed.");
