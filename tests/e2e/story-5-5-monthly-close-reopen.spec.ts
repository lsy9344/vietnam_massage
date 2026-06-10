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
  adminLockedMonth: { id: string; monthKey: string };
  blankReasonMonth: { id: string; monthKey: string };
  settlementLockedMonth: { id: string; monthKey: string };
  accounts: {
    admin: string;
    settlement: string;
  };
  accountRecordIds: {
    admin: string;
    settlement: string;
  };
};

let seededData: SeededData;

async function login(page: Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(accountId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

function story55WorkerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

function story55MonthKey(workerIndex: number, offset: number) {
  const monthNumber = workerIndex * 3 + offset;
  const year = 2062 + Math.floor((monthNumber - 1) / 12);
  const month = ((monthNumber - 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function utcDate(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00.000Z`);
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive: true },
    create: { staffCode, displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive: true }
  });
}

async function seedAuthAccount(input: { accountId: string; password: string; role: string; employeeId: string }) {
  const passwordHash = await hash(input.password, argon2idOptions);
  return (prisma as any).userAccount.upsert({
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

async function seedLockedMonth(monthKey: string, confirmedByAccountId: string) {
  const month = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { startDate: utcDate(monthKey), endDate: utcDate(monthKey), status: "잠금" },
    create: { monthKey, startDate: utcDate(monthKey), endDate: utcDate(monthKey), status: "잠금" }
  });
  const existingClosing = await (prisma as any).monthlyClosing.findFirst({
    where: { operatingMonthId: month.id },
    orderBy: { closeVersion: "desc" }
  });
  await (prisma as any).auditLog.deleteMany({
    where: {
      OR: existingClosing ? [{ targetId: month.id }, { targetId: existingClosing.id }] : [{ targetId: month.id }]
    }
  });
  await (prisma as any).monthlyClosing.deleteMany({ where: { operatingMonthId: month.id } });

  const closing = await (prisma as any).monthlyClosing.create({
    data: {
      operatingMonthId: month.id,
      closeVersion: 1,
      confirmedByAccountId,
      confirmedAt: new Date("2026-06-10T05:00:00.000Z"),
      snapshotJson: {
        id: `story55-${monthKey}-snapshot-v1`,
        month: {
          operatingMonthId: month.id,
          monthKey,
          startDate: `${monthKey}-01`,
          endDate: `${monthKey}-01`,
          statusAtConfirmation: "검토중",
          confirmedStatus: "마감확정",
          confirmedAt: "2026-06-10T05:00:00.000Z",
          confirmedByAccountId
        },
        therapists: { payoutAmount: 0, totalCallCount: 0, rows: [] },
        operations: {
          dailyIncentiveAmount: 0,
          monthlyIncentiveAmount: 0,
          totalOpsPayoutAmount: 0,
          monthlyOpsCallCredit: 0,
          appliedThresholdCallCount: null,
          ruleStatus: "missing_policy",
          warningMessages: [],
          rows: []
        },
        earcare: { earcarePoolTotal: 0, distributedAmount: 0, undistributedAmount: 0, sourceCallCount: 0, eligibleDayCount: 0, rows: [] },
        totals: { therapistPayoutAmount: 0, opsDailyIncentiveAmount: 0, opsMonthlyIncentiveAmount: 0, earcarePayoutAmount: 0, grandPayoutAmount: 0 },
        warningCounts: { total: 0 },
        evidence: { period: `${monthKey}-01 ~ ${monthKey}-01`, sourceDayCount: 1 },
        source: { serviceVersion: "monthly-closing-service:5.3", previewBasis: "listMonthlyClosingPreview", snapshotCreatedAt: "2026-06-10T05:00:00.000Z" }
      }
    }
  });

  return { month, closing };
}

async function seedStoryData(workerIndex: number): Promise<SeededData> {
  const suffix = story55WorkerSuffix(workerIndex);
  const sortBase = 95500 + workerIndex * 100;
  const accounts = {
    admin: `story55_admin_${suffix.toLowerCase()}`,
    settlement: `story55_settlement_${suffix.toLowerCase()}`
  };

  const adminEmployee = await seedEmployee(`E2E55-${suffix}-AUTH-ADMIN`, "E2E55 관리자", "BACKOFFICE", "관리자", sortBase);
  const settlementEmployee = await seedEmployee(`E2E55-${suffix}-AUTH-SETTLE`, "E2E55 정산담당", "BACKOFFICE", "정산", sortBase + 1);

  const adminAccount = await seedAuthAccount({ accountId: accounts.admin, password: "Story55!admin", role: "administrator", employeeId: adminEmployee.id });
  const settlementAccount = await seedAuthAccount({
    accountId: accounts.settlement,
    password: "Story55!settlement",
    role: "settlement_manager",
    employeeId: settlementEmployee.id
  });

  const adminLocked = await seedLockedMonth(story55MonthKey(workerIndex, 1), adminAccount.id);
  const blankReason = await seedLockedMonth(story55MonthKey(workerIndex, 2), adminAccount.id);
  const settlementLocked = await seedLockedMonth(story55MonthKey(workerIndex, 3), adminAccount.id);

  return {
    adminLockedMonth: { id: adminLocked.month.id, monthKey: adminLocked.month.monthKey },
    blankReasonMonth: { id: blankReason.month.id, monthKey: blankReason.month.monthKey },
    settlementLockedMonth: { id: settlementLocked.month.id, monthKey: settlementLocked.month.monthKey },
    accounts,
    accountRecordIds: {
      admin: adminAccount.id,
      settlement: settlementAccount.id
    }
  };
}

test.describe("Story 5.5 monthly close reopen", () => {
  test.beforeAll(async ({}, workerInfo) => {
    seededData = await seedStoryData(workerInfo.workerIndex);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("administrator reopens a locked month with reason and reconfirm creates closeVersion 2", async ({ page }) => {
    await login(page, seededData.accounts.admin, "Story55!admin");

    await page.goto(`/closing?operatingMonthId=${seededData.adminLockedMonth.id}`);
    await expect(page.getByText("확정 스냅샷")).toBeVisible();
    await expect(page.getByRole("button", { name: "재오픈" })).toBeEnabled();
    await page.getByLabel("재오픈 사유").fill("Story 5.5 관리자 사유 기반 재오픈");
    await page.getByRole("button", { name: "재오픈" }).click();
    await expect(page.getByText("운영월 상태: 검토중").first()).toBeVisible();
    await expect(page.getByText("이전 확정 스냅샷")).toBeVisible();
    await expect(page.getByText("현재 기준 미리보기").first()).toBeVisible();

    const reopenedMonth = await (prisma as any).operatingMonth.findUnique({ where: { id: seededData.adminLockedMonth.id }, select: { status: true } });
    expect(reopenedMonth?.status).toBe("검토중");
    const previousClosing = await (prisma as any).monthlyClosing.findFirst({
      where: { operatingMonthId: seededData.adminLockedMonth.id },
      orderBy: { closeVersion: "desc" }
    });
    expect(previousClosing?.closeVersion).toBe(1);
    expect(previousClosing?.reopenReason).toBe("Story 5.5 관리자 사유 기반 재오픈");

    const reopenAudit = await (prisma as any).auditLog.findFirst({
      where: { action: "monthly_close.reopened", targetType: "monthly_close", targetId: previousClosing.id }
    });
    expect(reopenAudit?.actorId).toBe(seededData.accountRecordIds.admin);
    expect((reopenAudit?.afterValue as any).reason).toBe("Story 5.5 관리자 사유 기반 재오픈");
    expect((reopenAudit?.afterValue as any).status).toBe("검토중");

    await page.getByRole("button", { name: "마감 확정" }).click();
    await expect(page.getByText("운영월 상태: 마감확정").first()).toBeVisible();
    const closings = await (prisma as any).monthlyClosing.findMany({
      where: { operatingMonthId: seededData.adminLockedMonth.id },
      orderBy: { closeVersion: "asc" }
    });
    expect(closings).toHaveLength(2);
    expect(closings[0].closeVersion).toBe(1);
    expect(closings[1].closeVersion).toBe(2);
  });

  test("blank reason is blocked without audit or status changes", async ({ page }) => {
    await login(page, seededData.accounts.admin, "Story55!admin");

    await page.goto(`/closing?operatingMonthId=${seededData.blankReasonMonth.id}`);
    const closingBefore = await (prisma as any).monthlyClosing.findFirst({
      where: { operatingMonthId: seededData.blankReasonMonth.id },
      orderBy: { closeVersion: "desc" }
    });
    const reopenAuditCountBefore = await (prisma as any).auditLog.count({
      where: { action: "monthly_close.reopened", targetType: "monthly_close", targetId: closingBefore.id }
    });
    await page.getByLabel("재오픈 사유").fill(" ");
    await page.getByRole("button", { name: "재오픈" }).click();
    await expect(page.getByText("재오픈 사유를 5자 이상 입력하세요.")).toBeVisible();

    const month = await (prisma as any).operatingMonth.findUnique({ where: { id: seededData.blankReasonMonth.id }, select: { status: true } });
    expect(month?.status).toBe("잠금");
    const closingAfter = await (prisma as any).monthlyClosing.findFirst({
      where: { operatingMonthId: seededData.blankReasonMonth.id },
      orderBy: { closeVersion: "desc" }
    });
    expect(closingAfter.id).toBe(closingBefore.id);
    expect(closingAfter.closeVersion).toBe(1);
    expect(closingAfter.reopenReason).toBeNull();
    expect(closingAfter.reopenedAt).toBeNull();
    expect(closingAfter.reopenedByAccountId).toBeNull();
    expect(closingAfter.snapshotJson).toEqual(closingBefore.snapshotJson);
    const reopenAuditCountAfter = await (prisma as any).auditLog.count({
      where: { action: "monthly_close.reopened", targetType: "monthly_close", targetId: closingBefore.id }
    });
    expect(reopenAuditCountAfter).toBe(reopenAuditCountBefore);
  });

  test("settlement_manager is blocked by disabled affordance and server-side closing:reopen guard", async ({ page }) => {
    await login(page, seededData.accounts.settlement, "Story55!settlement");

    await page.goto(`/closing?operatingMonthId=${seededData.settlementLockedMonth.id}`);
    await expect(page.getByLabel("재오픈 사유")).toBeDisabled();
    await expect(page.getByRole("button", { name: "재오픈" })).toBeDisabled();
    await expect(page.getByText("관리자만 재오픈할 수 있습니다.")).toBeVisible();

    const closingBefore = await (prisma as any).monthlyClosing.findFirst({
      where: { operatingMonthId: seededData.settlementLockedMonth.id },
      orderBy: { closeVersion: "desc" }
    });
    const reopenAuditCountBefore = await (prisma as any).auditLog.count({
      where: { action: "monthly_close.reopened", targetType: "monthly_close", targetId: closingBefore.id }
    });

    await page.getByLabel("재오픈 사유").evaluate((element) => element.removeAttribute("disabled"));
    await page.getByRole("button", { name: "재오픈" }).evaluate((element) => element.removeAttribute("disabled"));
    await page.getByLabel("재오픈 사유").fill("정산 담당자가 DOM 조작으로 서버 제출 시도");
    await page.getByRole("button", { name: "재오픈" }).click();
    await expect(page.getByText("권한이 없습니다.")).toBeVisible();

    const month = await (prisma as any).operatingMonth.findUnique({ where: { id: seededData.settlementLockedMonth.id }, select: { status: true } });
    expect(month?.status).toBe("잠금");
    const closingAfter = await (prisma as any).monthlyClosing.findFirst({
      where: { operatingMonthId: seededData.settlementLockedMonth.id },
      orderBy: { closeVersion: "desc" }
    });
    expect(closingAfter.id).toBe(closingBefore.id);
    expect(closingAfter.reopenReason).toBeNull();
    expect(closingAfter.reopenedAt).toBeNull();
    expect(closingAfter.reopenedByAccountId).toBeNull();
    const reopenAuditCountAfter = await (prisma as any).auditLog.count({
      where: { action: "monthly_close.reopened", targetType: "monthly_close", targetId: closingBefore.id }
    });
    expect(reopenAuditCountAfter).toBe(reopenAuditCountBefore);
  });
});
