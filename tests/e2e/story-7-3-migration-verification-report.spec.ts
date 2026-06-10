import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vietnam_massage";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);
const argon2idOptions = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

const story73OpenIssueKey = "calculation:earcare.zero-worker-pool:earcare-zero-worker";

type StoryAccount = {
  accountId: string;
  password: string;
};

type SeededAccounts = Record<"administrator" | "read_only_viewer" | "waiter", StoryAccount>;

let seededAccounts: SeededAccounts;

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

function workerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

async function safeEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({
    where: { staffCode },
    select: { sortOrder: true }
  });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({
      where: { employeeGroup, sortOrder, NOT: { staffCode } },
      select: { id: true }
    });
    if (!conflicting) return sortOrder;
  }

  throw new Error(`No Story 7.3 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedAccount(input: { role: keyof SeededAccounts; accountId: string; password: string; staffCode: string; sortOrder: number }) {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: `E2E73 ${input.role}`,
      employeeGroup: "OPERATIONS",
      position: input.role === "waiter" ? "웨이터" : "검증",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await safeEmployeeSortOrder("OPERATIONS", input.staffCode, input.sortOrder),
      isActive: true
    },
    create: {
      staffCode: input.staffCode,
      displayName: `E2E73 ${input.role}`,
      employeeGroup: "OPERATIONS",
      position: input.role === "waiter" ? "웨이터" : "검증",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await safeEmployeeSortOrder("OPERATIONS", input.staffCode, input.sortOrder),
      isActive: true
    }
  });
  const passwordHash = await hash(input.password, argon2idOptions);

  await (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: {
      email: `${input.accountId}@example.local`,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: `${input.accountId}@example.local`,
      accountId: input.accountId,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function seedStoryAccounts(workerIndex: number): Promise<SeededAccounts> {
  const suffix = workerSuffix(workerIndex);
  const roles = ["administrator", "read_only_viewer", "waiter"] as const;
  const accounts = {} as SeededAccounts;

  for (const [index, role] of roles.entries()) {
    accounts[role] = {
      accountId: `story73_${suffix}_${role}`,
      password: `Story73!${role}`
    };
    await seedAccount({
      role,
      ...accounts[role],
      staffCode: `E2E73-${suffix}-${role}`,
      sortOrder: 97300 + workerIndex * 100 + index
    });
  }

  return accounts;
}

async function seedOpenTrackingIssue() {
  await (prisma as any).migrationVerificationIssue.upsert({
    where: { itemKey: story73OpenIssueKey },
    update: {
      kind: "calculation_comparison",
      sourceSheet: "귀케어일정산",
      relatedRequirement: "FR-37",
      relatedStory: "Story 7.2",
      status: "재검증 필요",
      assigneeName: null,
      note: "수정 배포 후 재검증 예정"
    },
    create: {
      itemKey: story73OpenIssueKey,
      kind: "calculation_comparison",
      sourceSheet: "귀케어일정산",
      relatedRequirement: "FR-37",
      relatedStory: "Story 7.2",
      status: "재검증 필요",
      note: "수정 배포 후 재검증 예정"
    }
  });
}

async function login(page: Page, account: StoryAccount) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(account.accountId);
  await page.getByLabel("비밀번호").fill(account.password);
  await page.getByRole("button", { name: "로그인" }).click();
}

test.describe("Story 7.3 migration verification report source guardrails", () => {
  test("source guardrails: report service reuses Story 7.1 mapping and Story 7.2 fixture contracts", async () => {
    const service = readSource("src/modules/migration/migration-verification-report.ts");

    for (const required of [
      "SHEET_FEATURE_MAPPINGS",
      "EXPECTED_SOURCE_SHEETS",
      "getSheetMappingSummary",
      "MIGRATION_EXPECTED_RESULTS",
      "MIGRATION_SOURCE_REFERENCES",
      "MigrationMismatchReport",
      "summary",
      "sheetRows",
      "calculationRows",
      "openIssueRows",
      "filters",
      "generatedAt",
      "sheet:목록",
      "calculation:calls.payment:call-complete-a-discount",
      "미확인",
      "수정중",
      "재검증 필요",
      "통과"
    ]) {
      expect(service).toContain(required);
    }

    for (const forbidden of ["readFileSync(\"sheet.xlsx\"", "xlsx.read", "parseCell", "workbookRange.split", "new MigrationCalculationEngine"]) {
      expect(service).not.toContain(forbidden);
    }
  });

  test("source guardrails: sheet-mapping route renders report DTO and keeps exact read-only access boundary", async () => {
    const page = readSource("src/app/(erp)/masters/sheet-mapping/page.tsx");
    const action = readSource("src/app/(erp)/masters/sheet-mapping/actions.ts");
    const auth = readSource("src/lib/authorization.ts");
    const nav = readSource("src/lib/navigation.ts");

    for (const required of [
      "requireRouteAccess(\"/masters/sheet-mapping\")",
      "buildMigrationVerificationReport",
      "listMigrationVerificationIssues",
      "parseMigrationVerificationFilters",
      "MigrationIssueStatusForm",
      "기능 보존율",
      "누락 항목",
      "계산 불일치",
      "열린 추적",
      "숨김 목록 100% gate"
    ]) {
      expect(page).toContain(required);
    }

    expect(action).toContain("requirePermission(\"migration:write\")");
    expect(action).toContain("updateMigrationVerificationIssueStatus");
    expect(auth).toContain("\"migration:write\"");
    expect(auth).toContain("read_only_viewer: [\"/masters/sheet-mapping\"]");
    expect(auth).not.toContain("read_only_viewer: [\"/rooms\", \"/tv\", \"/dashboard/today\", \"/dashboard/monthly\", \"/dashboard/reports\", \"/masters");
    expect(nav).toContain("{ label: \"시트 기능 매핑표\", href: \"/masters/sheet-mapping\", allowedRoles: [\"administrator\", \"read_only_viewer\"] }");
  });

  test("source guardrails: Prisma tracking tables and validator are wired", async () => {
    const schema = readSource("prisma/schema.prisma");
    const migration = readSource("prisma/migrations/20260610203000_add_migration_verification_issues/migration.sql");
    const validator = readSource("scripts/validate-story-7-3.mjs");
    const packageJson = readSource("package.json");
    const docs = `${readSource("docs/modules/migration-verification.md")}\n${readSource("docs/modules/README.md")}\n${readSource("_bmad-output/project-context.md")}`;

    for (const required of [
      "model MigrationVerificationIssue",
      "model MigrationVerificationIssueHistory",
      "@@map(\"migration_verification_issues\")",
      "@@map(\"migration_verification_issue_histories\")"
    ]) {
      expect(schema).toContain(required);
    }

    for (const required of [
      "migration_verification_issues",
      "migration_verification_issue_histories",
      "CHECK (\"status\" IN ('미확인', '수정중', '재검증 필요', '통과'))",
      "changed_by_account_id"
    ]) {
      expect(migration).toContain(required);
    }

    expect(validator).toContain("Story 7.3 validation passed.");
    expect(packageJson).toContain("validate-story-7-2.mjs && node scripts/validate-story-7-3.mjs");

    for (const required of ["Story 7.3", "report DTO", "persisted QA tracking", "숨김 목록", "no runtime Excel parsing", "read-only viewer exact access"]) {
      expect(docs).toContain(required);
    }
  });
});

test.describe("Story 7.3 migration verification report browser access", () => {
  test.skip(
    process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1",
    "DB-backed browser access tests require a running dev server and migrated local database."
  );

  test.beforeAll(async ({}, testInfo) => {
    seededAccounts = await seedStoryAccounts(testInfo.workerIndex);
    await seedOpenTrackingIssue();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("administrator can inspect summary, filter open risks, and see status tracking controls", async ({ page }) => {
    await login(page, seededAccounts.administrator);
    await page.goto("/masters/sheet-mapping");

    await expect(page.getByRole("heading", { name: "시트 기능 매핑표", level: 1 })).toBeVisible();
    await expect(page.getByLabel("이관 검증 요약")).toContainText("기능 보존율");
    await expect(page.getByLabel("이관 검증 요약")).toContainText("계산 불일치");
    await expect(page.getByRole("status")).toContainText("숨김 시트 목록은 visible sheet와 동일 가중치");
    await expect(page.getByText("관리자 상태 변경 가능")).toBeVisible();

    await page.getByLabel("상태").selectOption("재검증 필요");
    await page.getByLabel("종류").selectOption("calculation_comparison");
    await page.getByRole("button", { name: "필터 적용" }).click();

    await expect(page).toHaveURL(/status=%EC%9E%AC%EA%B2%80%EC%A6%9D\+%ED%95%84%EC%9A%94/);
    await expect(page).toHaveURL(/kind=calculation_comparison/);

    const issueRow = page.getByRole("row").filter({ hasText: story73OpenIssueKey });
    await expect(issueRow).toContainText("수정 배포 후 재검증 예정");
    await expect(issueRow.getByLabel("추적 상태")).toHaveValue("재검증 필요");
    await expect(issueRow.getByLabel("담당자 메모")).toHaveValue("수정 배포 후 재검증 예정");
    await expect(issueRow.getByRole("button", { name: "저장" })).toBeVisible();
  });

  test("read_only_viewer can inspect the report but cannot mutate tracking status", async ({ page }) => {
    await login(page, seededAccounts.read_only_viewer);
    await page.goto("/masters/sheet-mapping?status=%EC%9E%AC%EA%B2%80%EC%A6%9D+%ED%95%84%EC%9A%94&kind=calculation_comparison");

    await expect(page.getByRole("heading", { name: "시트 기능 매핑표", level: 1 })).toBeVisible();
    await expect(page.getByText("조회 전용")).toBeVisible();

    const issueRow = page.getByRole("row").filter({ hasText: story73OpenIssueKey });
    await expect(issueRow).toContainText("수정 배포 후 재검증 예정");
    await expect(issueRow.getByRole("button", { name: "저장" })).toHaveCount(0);
    await expect(issueRow.getByLabel("추적 상태")).toHaveCount(0);

    await page.goto("/masters/codes");
    await expect(page).toHaveURL(/\/rooms$/);
  });

  test("waiter is redirected away from the migration verification report", async ({ page }) => {
    await login(page, seededAccounts.waiter);
    await page.goto("/masters/sheet-mapping");

    await expect(page).toHaveURL(/\/rooms$/);
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: "시트 기능 매핑표" })).toHaveCount(0);
  });
});
