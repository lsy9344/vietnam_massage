import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { createDailyExpense, ServiceCallDomainError } from "@/modules/calls/service-call-service";


type SeededData = {
  adminConfirmedMonth: { id: string; monthKey: string };
  counterLockedMonth: { id: string; monthKey: string };
  settlementConfirmedMonth: { id: string; monthKey: string };
  accounts: {
    admin: string;
    settlement: string;
    counter: string;
  };
  accountRecordIds: {
    admin: string;
    settlement: string;
    counter: string;
  };
};

let seededData: SeededData;


function story54WorkerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

function story54MonthKey(workerIndex: number, offset: number) {
  const monthNumber = workerIndex * 3 + offset;
  const year = 2058 + Math.floor((monthNumber - 1) / 12);
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

async function seedClosedMonth(monthKey: string, status: "마감확정" | "잠금", confirmedByAccountId: string) {
  const month = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { startDate: utcDate(monthKey), endDate: utcDate(monthKey), status },
    create: { monthKey, startDate: utcDate(monthKey), endDate: utcDate(monthKey), status }
  });
  const existingClosing = await (prisma as any).monthlyClosing.findFirst({ where: { operatingMonthId: month.id }, orderBy: { closeVersion: "desc" } });
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
        id: "story54-snapshot",
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
  const suffix = story54WorkerSuffix(workerIndex);
  const sortBase = 95400 + workerIndex * 100;
  const accounts = {
    admin: `story54_admin_${suffix.toLowerCase()}`,
    settlement: `story54_settlement_${suffix.toLowerCase()}`,
    counter: `story54_counter_${suffix.toLowerCase()}`
  };

  const adminEmployee = await seedEmployee(`E2E54-${suffix}-AUTH-ADMIN`, "E2E54 관리자", "BACKOFFICE", "관리자", sortBase);
  const settlementEmployee = await seedEmployee(`E2E54-${suffix}-AUTH-SETTLE`, "E2E54 정산담당", "BACKOFFICE", "정산", sortBase + 1);
  const counterEmployee = await seedEmployee(`E2E54-${suffix}-AUTH-COUNTER`, "E2E54 카운터", "BACKOFFICE", "카운터", sortBase + 2);

  const adminAccount = await seedAuthAccount({ accountId: accounts.admin, password: "Story54!admin", role: "administrator", employeeId: adminEmployee.id });
  const settlementAccount = await seedAuthAccount({ accountId: accounts.settlement, password: "Story54!settlement", role: "settlement_manager", employeeId: settlementEmployee.id });
  const counterAccount = await seedAuthAccount({ accountId: accounts.counter, password: "Story54!counter", role: "counter", employeeId: counterEmployee.id });

  const adminConfirmed = await seedClosedMonth(story54MonthKey(workerIndex, 1), "마감확정", adminAccount.id);
  const counterLocked = await seedClosedMonth(story54MonthKey(workerIndex, 2), "잠금", adminAccount.id);
  const settlementConfirmed = await seedClosedMonth(story54MonthKey(workerIndex, 3), "마감확정", settlementAccount.id);

  return {
    adminConfirmedMonth: { id: adminConfirmed.month.id, monthKey: adminConfirmed.month.monthKey },
    counterLockedMonth: { id: counterLocked.month.id, monthKey: counterLocked.month.monthKey },
    settlementConfirmedMonth: { id: settlementConfirmed.month.id, monthKey: settlementConfirmed.month.monthKey },
    accounts,
    accountRecordIds: {
      admin: adminAccount.id,
      settlement: settlementAccount.id,
      counter: counterAccount.id
    }
  };
}

test.describe("Story 5.4 monthly close lock", () => {
  test.beforeAll(async ({}, workerInfo) => {
    seededData = await seedStoryData(workerInfo.workerIndex);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("administrator locks a confirmed close and the snapshot remains visible", async ({ page }) => {
    await login(page, seededData.accounts.admin, "Story54!admin");

    await page.goto(`/closing?operatingMonthId=${seededData.adminConfirmedMonth.id}`);
    await expect(page.getByText("확정 스냅샷")).toBeVisible();
    await expect(page.getByRole("button", { name: "잠금" })).toBeEnabled();
    await page.getByRole("button", { name: "잠금" }).click();
    await expect(page.getByText("운영월 상태: 잠금").first()).toBeVisible();
    await expect(page.getByText("확정 스냅샷")).toBeVisible();
    await page.goto(`/settlements/operations/monthly?operatingMonthId=${seededData.adminConfirmedMonth.id}`);
    await expect(page.getByText("운영팀 확정 지급값")).toBeVisible();
    await expect(page.getByText("현재 기준 미리보기")).toBeVisible();

    const month = await (prisma as any).operatingMonth.findUnique({ where: { id: seededData.adminConfirmedMonth.id }, select: { status: true } });
    expect(month?.status).toBe("잠금");

    const closing = await (prisma as any).monthlyClosing.findFirst({
      where: { operatingMonthId: seededData.adminConfirmedMonth.id },
      orderBy: { closeVersion: "desc" }
    });
    const audits = await (prisma as any).auditLog.findMany({
      where: { action: "monthly_close.locked", targetType: "monthly_close", targetId: closing.id }
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].actorId).toBe(seededData.accountRecordIds.admin);
    expect((audits[0].beforeValue as any).status).toBe("마감확정");
    expect((audits[0].afterValue as any).status).toBe("잠금");
    expect((audits[0].afterValue as any).lockedByAccountId).toBe(seededData.accountRecordIds.admin);
  });

  test("counter sees locked calls UI as read-only and server write stays blocked with OPERATING_MONTH_LOCKED", async ({ page }) => {
    await login(page, seededData.accounts.counter, "Story54!counter");

    await page.goto(`/calls?operatingMonthId=${seededData.counterLockedMonth.id}`);
    await expect(page.getByText("마감확정 또는 잠금 운영월입니다.").first()).toBeVisible();
    await expect(page.getByText("마감확정 또는 잠금 운영월입니다. 지출 입력과 수정이 차단됩니다.")).toBeVisible();
    await expect(page.getByRole("button", { name: "새 콜 행 추가" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "지출 추가" })).toBeDisabled();

    await expect(
      createDailyExpense({
        operatingMonthId: seededData.counterLockedMonth.id,
        expenseDate: `${seededData.counterLockedMonth.monthKey}-01`,
        amount: 1000,
        description: "locked e2e write probe",
        handledByEmployeeId: "handler-check-is-after-lock",
        actorId: seededData.accountRecordIds.counter
      })
    ).rejects.toMatchObject({
      code: "OPERATING_MONTH_LOCKED"
    } satisfies Partial<ServiceCallDomainError>);
  });

  test("settlement manager locks a separate confirmed month without depending on administrator flow", async ({ page }) => {
    await login(page, seededData.accounts.settlement, "Story54!settlement");

    await page.goto(`/closing?operatingMonthId=${seededData.settlementConfirmedMonth.id}`);
    await expect(page.getByText("확정 스냅샷")).toBeVisible();
    await expect(page.getByRole("button", { name: "잠금" })).toBeEnabled();
    await page.getByRole("button", { name: "잠금" }).click();
    await expect(page.getByText("운영월 상태: 잠금").first()).toBeVisible();

    const closing = await (prisma as any).monthlyClosing.findFirst({
      where: { operatingMonthId: seededData.settlementConfirmedMonth.id },
      orderBy: { closeVersion: "desc" }
    });
    const audit = await (prisma as any).auditLog.findFirst({
      where: { action: "monthly_close.locked", targetType: "monthly_close", targetId: closing.id }
    });
    expect(audit?.actorId).toBe(seededData.accountRecordIds.settlement);
  });
});
