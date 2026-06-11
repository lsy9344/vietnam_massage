import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vietnam_massage";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);
const argon2idOptions = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

type StoryAccount = {
  accountId: string;
  password: string;
};

type SeededAccounts = Record<"administrator" | "read_only_viewer" | "waiter", StoryAccount>;

let seededAccounts: SeededAccounts;

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

  throw new Error(`No Story 7.1 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedAccount(input: { role: keyof SeededAccounts; accountId: string; password: string; staffCode: string; sortOrder: number }) {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: `E2E71 ${input.role}`,
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
      displayName: `E2E71 ${input.role}`,
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
      accountId: `story71_${suffix}_${role}`.toLowerCase(),
      password: `Story71!${role}`
    };
    await seedAccount({
      role,
      ...accounts[role],
      staffCode: `E2E71-${suffix}-${role}`,
      sortOrder: 97100 + workerIndex * 100 + index
    });
  }

  return accounts;
}

async function login(page: Page, account: StoryAccount) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(account.accountId);
  await page.getByLabel("비밀번호").fill(account.password);
  await page.getByRole("button", { name: "로그인" }).click();
}

test.describe("Story 7.1 sheet mapping source guardrails", () => {
  test("route stays read-only and exposes mapping failure copy without requiring a database", async () => {
    const pageSource = readFileSync("src/app/(erp)/masters/sheet-mapping/page.tsx", "utf8");

    expect(pageSource).toContain('requireRouteAccess("/masters/sheet-mapping")');
    expect(pageSource).toContain("검증 실패: 누락된 시트");
    expect(pageSource).toContain("검증 통과: 숨김 목록 포함 12개 원본 시트가 모두 매핑됐습니다.");
    expect(pageSource).toContain("쓰기 작업 없음 · 감사 로그 없음 · DB 변경 없음");
    expect(pageSource).toContain("<StatusBadge state=\"사용중\"");
    expect(pageSource).not.toContain('"use server"');
    expect(pageSource).not.toContain("recordAuditEvent");
    expect(pageSource).not.toContain("createDailyExpense");
    expect(pageSource).not.toContain("updateDailyExpense");
    expect(pageSource).not.toContain("deactivateDailyExpense");
  });

  test("mapping source covers hidden 목록, critical workbook distinctions, and stable ID principles", async () => {
    const mappingSource = readFileSync("src/modules/migration/sheet-feature-mapping.ts", "utf8");

    for (const sheet of [
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
    ]) {
      expect(mappingSource).toContain(`sourceSheet: "${sheet}"`);
    }

    expect(mappingSource).toContain('visibility: "hidden"');
    expect(mappingSource).toContain("A:S");
    expect(mappingSource).toContain("U:X");
    expect(mappingSource).toContain("방문완료");
    expect(mappingSource).toContain("RoomStatusDto");
    expect(mappingSource).toContain("listRoomStatuses()");
    expect(mappingSource).toContain("Room.id");
    expect(mappingSource).toContain("Employee.id");
    expect(mappingSource).toContain("Course.id");
    expect(mappingSource).toContain("CodeItem.id");
    expect(mappingSource).toContain("TimeSlot.value");
    expect(mappingSource).not.toContain('workbookEvidence: ["이관됨"]');
    expect(mappingSource).not.toContain('preservedRules: ["이관됨"]');
  });
});

test.describe("Story 7.1 sheet mapping browser access", () => {
  test.beforeAll(async ({}, testInfo) => {
    seededAccounts = await seedStoryAccounts(testInfo.workerIndex);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("administrator can inspect all 12 source sheets and expand concrete verification evidence", async ({ page }) => {
    await login(page, seededAccounts.administrator);
    await page.goto("/masters/sheet-mapping");

    await expect(page.getByRole("heading", { name: "시트 기능 매핑표", level: 1 })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("숨김 목록 포함 12개 원본 시트");
    await expect(page.getByText("기능 보존율 100%")).toBeVisible();
    await expect(page.getByRole("cell", { name: "목록" })).toBeVisible();
    await expect(page.getByText("hidden 목록")).toBeVisible();
    await expect(page.getByRole("region", { name: "원본 시트 기능 매핑표" })).toContainText("매핑 완료");

    await page.getByRole("button", { name: "원본 근거, ERP 연결, 보존 규칙, 검증 항목 보기" }).nth(1).click();
    await expect(page.getByText("A:S 콜 원장 입력/계산 구조와 U:X 지출/요약 구조를 별도로 검증한다.")).toBeVisible();
    await expect(page.getByText("방문완료 또는 VISIT_COMPLETE 상태만 결제, 수당, 귀케어 풀, 콜인정 계산에 포함한다.")).toBeVisible();
  });

  test("read_only_viewer has exact access and does not get the broader masters prefix", async ({ page }) => {
    await login(page, seededAccounts.read_only_viewer);

    await page.goto("/masters/sheet-mapping");
    await expect(page.getByRole("heading", { name: "시트 기능 매핑표", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: "시트 기능 매핑표" })).toBeVisible();

    await page.goto("/masters/codes");
    await expect(page).toHaveURL(/\/rooms$/);
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: "코드\/시간 슬롯" })).toHaveCount(0);
  });

  test("waiter is redirected away from the QA-only mapping page", async ({ page }) => {
    await login(page, seededAccounts.waiter);
    await page.goto("/masters/sheet-mapping");

    await expect(page).toHaveURL(/\/rooms$/);
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: "시트 기능 매핑표" })).toHaveCount(0);
  });
});
