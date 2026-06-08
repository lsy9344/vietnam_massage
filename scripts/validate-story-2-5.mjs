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
  "prisma/migrations/20260609042000_add_daily_expenses/migration.sql",
  "src/modules/calls/service-call-schema.ts",
  "src/modules/calls/service-call-service.ts",
  "src/modules/calls/service-call-service.test.ts",
  "src/app/(erp)/calls/actions.ts",
  "src/app/(erp)/calls/page.tsx",
  "src/app/(erp)/calls/daily-summary-strip.tsx",
  "src/app/(erp)/calls/daily-expense-panel.tsx",
  "src/app/(erp)/calls/loading.tsx",
  "tests/e2e/story-2-5-daily-expense-summary.spec.ts",
  "src/modules/calls/README.md",
  "docs/modules/calls.md",
  "_bmad-output/project-context.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-2-5.mjs")) {
  errors.push("package.json lint script must include scripts/validate-story-2-5.mjs");
}

const schema = read("prisma/schema.prisma");
for (const required of [
  "model DailyExpense",
  "@@map(\"daily_expenses\")",
  "operatingMonthId",
  "expenseDate",
  "amount",
  "handledByEmployeeId",
  "isActive",
  "idx_daily_expenses_month_date",
  "idx_daily_expenses_handler_date"
]) {
  if (!schema.includes(required)) errors.push(`schema.prisma missing ${required}`);
}

const service = read("src/modules/calls/service-call-service.ts");
for (const required of [
  "createDailyExpense",
  "updateDailyExpense",
  "deactivateDailyExpense",
  "listDailyExpensesForDate",
  "getDailyCallLedgerSummary",
  "daily_expense.created",
  "daily_expense.changed",
  "daily_expense.deactivated",
  "netSales: paymentTotal - expenseTotal",
  "calculationStatus !== \"calculated\"",
  "courseCode",
  "RESERVED",
  "CANCELED"
]) {
  if (!service.includes(required)) errors.push(`service-call-service.ts missing ${required}`);
}

const actions = read("src/app/(erp)/calls/actions.ts");
for (const required of [
  "createDailyExpenseAction",
  "updateDailyExpenseAction",
  "deactivateDailyExpenseAction",
  "requirePermission(\"call:write\")",
  "revalidatePath(\"/calls\")",
  "amount",
  "description",
  "handledByEmployeeId",
  "expenseDate"
]) {
  if (!actions.includes(required)) errors.push(`calls actions missing ${required}`);
}

const page = read("src/app/(erp)/calls/page.tsx");
for (const required of ["DailySummaryStrip", "DailyExpensePanel", "getDailyCallLedgerSummary", "listDailyExpensesForDate"]) {
  if (!page.includes(required)) errors.push(`calls page missing ${required}`);
}

const unitTest = read("src/modules/calls/service-call-service.test.ts");
for (const required of [
  "creates, lists, updates, and deactivates active daily expenses",
  "without side effects",
  "summarizes a daily call ledger",
  "formatted string",
  "secondTherapistRequired",
  "netSales"
]) {
  if (!unitTest.includes(required)) errors.push(`service-call-service.test.ts missing ${required}`);
}

const e2e = read("tests/e2e/story-2-5-daily-expense-summary.spec.ts");
for (const required of ["Story 2.5", "지출 추가", "비활성", "일별 요약", "잠긴 운영월", "4,300,000", "daily_expense.created", "daily_expense.changed", "daily_expense.deactivated"]) {
  if (!e2e.includes(required)) errors.push(`story-2-5 e2e missing ${required}`);
}

const docs = `${read("src/modules/calls/README.md")}\n${read("docs/modules/calls.md")}\n${read("_bmad-output/project-context.md")}`;
for (const required of [
  "Story 2.5",
  "DailyExpense",
  "daily_expense.created",
  "daily_expense.changed",
  "daily_expense.deactivated",
  "netSales = paymentTotal - expenseTotal",
  "완료 콜",
  "Course.code"
]) {
  if (!docs.includes(required)) errors.push(`calls docs/project context missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 2.5 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 2.5 validation passed.");
