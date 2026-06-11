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

type SeededData = {
  months: {
    draft: string;
    lockedMissing: string;
  };
  draftDate: string;
  lockedDate: string;
  accounts: Record<"administrator" | "counter" | "settlement_manager" | "read_only_viewer" | "waiter", { accountId: string; password: string }>;
};

let seededData: SeededData;

function workerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

function monthKeyForWorker(workerIndex: number, offset: number) {
  const monthNumber = workerIndex * 2 + offset + 1;
  const year = 2076 + Math.floor((monthNumber - 1) / 12);
  const month = ((monthNumber - 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function isoDate(monthKey: string, day: number) {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function utcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function login(page: Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(accountId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
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

  throw new Error(`No Story 6.4 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, roleHint: string, sortOrder: number) {
  const reservedSortOrder = await safeEmployeeSortOrder(employeeGroup, staffCode, sortOrder);
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: {
      displayName,
      employeeGroup,
      position: roleHint,
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: reservedSortOrder,
      isActive: true
    },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position: roleHint,
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: reservedSortOrder,
      isActive: true
    }
  });
}

async function seedAccount(input: { accountId: string; password: string; role: string; employeeId: string }) {
  const passwordHash = await hash(input.password, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: {
      email: `${input.accountId}@example.local`,
      passwordHash,
      role: input.role,
      employeeId: input.employeeId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: `${input.accountId}@example.local`,
      accountId: input.accountId,
      passwordHash,
      role: input.role,
      employeeId: input.employeeId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function seedStoryData(workerIndex: number): Promise<SeededData> {
  const suffix = workerSuffix(workerIndex);
  const sortBase = 96400 + workerIndex * 100;
  const accountRoles = ["administrator", "counter", "settlement_manager", "read_only_viewer", "waiter"] as const;
  const accounts = {} as SeededData["accounts"];

  for (const [index, role] of accountRoles.entries()) {
    const employee = await seedEmployee(`E2E64-${suffix}-${role}`, `E2E64 ${role}`, "OPERATIONS", role, sortBase + index);
    accounts[role] = { accountId: `story64_${suffix}_${role}`.toLowerCase(), password: `Story64!${role}` };
    await seedAccount({ ...accounts[role], role, employeeId: employee.id });
  }

  const draftKey = monthKeyForWorker(workerIndex, 0);
  const lockedKey = monthKeyForWorker(workerIndex, 1);
  const draft = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: draftKey },
    update: { startDate: utcDate(isoDate(draftKey, 1)), endDate: utcDate(isoDate(draftKey, 28)), status: "작성중" },
    create: { monthKey: draftKey, startDate: utcDate(isoDate(draftKey, 1)), endDate: utcDate(isoDate(draftKey, 28)), status: "작성중" }
  });
  const lockedMissing = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: lockedKey },
    update: { startDate: utcDate(isoDate(lockedKey, 1)), endDate: utcDate(isoDate(lockedKey, 28)), status: "잠금" },
    create: { monthKey: lockedKey, startDate: utcDate(isoDate(lockedKey, 1)), endDate: utcDate(isoDate(lockedKey, 28)), status: "잠금" }
  });

  await (prisma as any).monthlyClosing.deleteMany({ where: { operatingMonthId: { in: [draft.id, lockedMissing.id] } } });

  return {
    months: { draft: draft.id, lockedMissing: lockedMissing.id },
    draftDate: isoDate(draftKey, 10),
    lockedDate: isoDate(lockedKey, 10),
    accounts
  };
}

test.describe("Story 6.4 dashboard source guardrails", () => {
  test("all dashboard loading and error boundaries keep safe Korean affordances", async () => {
    const routes = [
      ["today", "오늘 KPI 대시보드 로딩 중", "오늘 KPI를 불러오지 못했습니다"],
      ["monthly", "월간 KPI 대시보드 로딩 중", "월간 KPI를 불러오지 못했습니다"],
      ["reports", "그래프 리포트 로딩 중", "그래프 리포트를 불러오지 못했습니다"]
    ] as const;

    for (const [route, loadingLabel, errorHeading] of routes) {
      const loading = readFileSync(`src/app/(erp)/dashboard/${route}/loading.tsx`, "utf8");
      const errorBoundary = readFileSync(`src/app/(erp)/dashboard/${route}/error.tsx`, "utf8");

      expect(loading).toContain("Skeleton");
      expect(loading).toContain('aria-busy="true"');
      expect(loading).toContain(loadingLabel);
      expect(errorBoundary).toContain('role="alert"');
      expect(errorBoundary).toContain(errorHeading);
      expect(errorBoundary).toContain("다시 시도");
      expect(errorBoundary).toContain("현재 조건 새로고침");
      expect(errorBoundary).not.toContain("error.message");
      expect(errorBoundary).not.toContain("error.stack");
    }
  });

  test("reports chart source keeps status tokens out of non-status series", async () => {
    const reportsPage = readFileSync("src/app/(erp)/dashboard/reports/page.tsx", "utf8");

    expect(reportsPage).toContain("StatusBadge state={row.displayStatus}");
    expect(reportsPage).toContain("role=\"img\"");
    expect(reportsPage).toContain("<table");
    expect(reportsPage).toContain("범례: 노쇼는 브랜드색, 취소는 위험색");
    expect(reportsPage).toContain("bg-brand");
    expect(reportsPage).toContain("bg-danger");
    expect(reportsPage).toContain("var(--color-brand)");
    expect(reportsPage).toContain("var(--color-danger)");
    expect(reportsPage).not.toContain("bg-status-");
    expect(reportsPage).not.toContain("text-status-");
    expect(reportsPage).not.toContain("border-status-");
    expect(reportsPage).not.toContain("var(--color-status-");
    expect(reportsPage).not.toContain("0으로 표시됩니다");
  });

  test("missing calculated completed calls do not render revenue or course charts as successful zero graphs", async () => {
    const reportsPage = readFileSync("src/app/(erp)/dashboard/reports/page.tsx", "utf8");

    expect(reportsPage).toContain("완료 콜 그래프 없음");
    expect(reportsPage).toContain("누락된 완료 데이터를 0값 매출 또는 0값 코스 비중 그래프로 꾸미지 않습니다.");
    expect(reportsPage).toContain("report.emptyStates.noCalculatedCompletedCalls ? <CompletedChartEmptyPanel /> : <RevenueTrendChart report={report} />");
    expect(reportsPage).toContain("report.emptyStates.noCalculatedCompletedCalls ? (");
  });
});

test.describe("Story 6.4 dashboard browser states and route access", () => {
  test.beforeAll(async ({}, testInfo) => {
    seededData = await seedStoryData(testInfo.workerIndex);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("empty today state uses canonical params and does not fake successful data", async ({ page }) => {
    await login(page, seededData.accounts.administrator.accountId, seededData.accounts.administrator.password);
    await page.goto(`/dashboard/today?operatingMonthId=${seededData.months.draft}&serviceDate=${seededData.draftDate}`);

    await expect(page).toHaveURL(new RegExp(`/dashboard/today\\?operatingMonthId=${seededData.months.draft}&serviceDate=${seededData.draftDate}`));
    await expect(page.getByText("이 날짜의 콜이 없습니다")).toBeVisible();
    await expect(page.getByRole("link", { name: "콜 원장으로 이동" })).toBeVisible();
    await expect(page.getByRole("region", { name: "오늘 상태 건수" })).toContainText("0건");
  });

  test("snapshot-missing monthly and reports states do not fall back to current payout values", async ({ page }) => {
    await login(page, seededData.accounts.administrator.accountId, seededData.accounts.administrator.password);

    await page.goto(`/dashboard/monthly?operatingMonthId=${seededData.months.lockedMissing}`);
    await expect(page.getByRole("alert")).toContainText("확정 스냅샷을 찾을 수 없습니다");
    await expect(page.getByRole("region", { name: "지급 요약 없음" })).toContainText("현재 지급 계산값으로 대체하지 않았습니다");

    await page.goto(`/dashboard/reports?operatingMonthId=${seededData.months.lockedMissing}&serviceDate=${seededData.lockedDate}`);
    await expect(page.getByRole("alert")).toContainText("확정 스냅샷을 찾을 수 없습니다");
    await expect(page.getByText("정산 source가 없어 순위를 표시하지 않습니다.")).toBeVisible();
    await expect(page.getByText("확정 스냅샷이 없어 지급 구성 그래프를 표시하지 않습니다.")).toBeVisible();
  });

  for (const route of ["today", "monthly", "reports"] as const) {
    test(`waiter is redirected away from /dashboard/${route}`, async ({ page }) => {
      await login(page, seededData.accounts.waiter.accountId, seededData.accounts.waiter.password);
      const query =
        route === "monthly"
          ? `operatingMonthId=${seededData.months.draft}`
          : `operatingMonthId=${seededData.months.draft}&serviceDate=${seededData.draftDate}`;

      await page.goto(`/dashboard/${route}?${query}`);

      await expect(page).toHaveURL(/\/rooms$/);
      await expect(page.getByRole("link", { name: "대시보드" })).toHaveCount(0);
    });
  }

  for (const role of ["counter", "settlement_manager", "read_only_viewer"] as const) {
    test(`${role} can still access dashboard reports`, async ({ page }) => {
      await login(page, seededData.accounts[role].accountId, seededData.accounts[role].password);
      await page.goto(`/dashboard/reports?operatingMonthId=${seededData.months.draft}&serviceDate=${seededData.draftDate}`);

      await expect(page.getByRole("heading", { name: "그래프 리포트" })).toBeVisible();
      await expect(page.getByRole("region", { name: "데이터 없음 상태" })).toContainText("정산 source가 없어 정산 순위와 지급 구성을 표시하지 않습니다.");
    });
  }
});
