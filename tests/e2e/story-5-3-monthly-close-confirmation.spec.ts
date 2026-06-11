import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";


type SeededData = {
  draftOperatingMonthId: string;
  reviewOperatingMonthId: string;
  accounts: {
    admin: string;
    settlement: string;
    counter: string;
    waiter: string;
    readOnly: string;
  };
  accountRecordIds: {
    admin: string;
    settlement: string;
  };
};

let seededData: SeededData;


async function confirmMonthlyCloseThroughDialog(page: Page) {
  await expect(page.getByRole("button", { name: "마감 확정" })).toBeEnabled();
  await page.getByRole("button", { name: "마감 확정" }).click();
  const dialog = page.getByRole("alertdialog", { name: /월마감을 확정할까요/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("확정 시 스냅샷이 고정되어 이후 설정 변경으로 재계산되지 않습니다.");
  await expect(dialog.getByRole("button", { name: "지급 스냅샷 확정" })).toBeEnabled();
  await dialog.getByRole("button", { name: "지급 스냅샷 확정" }).click();
}

function story53WorkerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

function story53MonthKey(workerIndex: number, offset: number) {
  const monthNumber = workerIndex * 2 + offset;
  const year = 2048 + Math.floor((monthNumber - 1) / 12);
  const month = ((monthNumber - 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function utcDate(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00.000Z`);
}

async function storyEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
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

  throw new Error(`No Story 5.3 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, sortOrder: number) {
  const safeSortOrder = await storyEmployeeSortOrder(employeeGroup, staffCode, sortOrder);
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder: safeSortOrder, isActive: true },
    create: { staffCode, displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder: safeSortOrder, isActive: true }
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

async function seedOperatingMonth(monthKey: string, status: string) {
  const existing = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { startDate: utcDate(monthKey), endDate: utcDate(monthKey), status },
    create: { monthKey, startDate: utcDate(monthKey), endDate: utcDate(monthKey), status }
  });
  await (prisma as any).monthlyClosing.deleteMany({ where: { operatingMonthId: existing.id } });
  await (prisma as any).auditLog.deleteMany({
    where: {
      targetId: existing.id,
      action: { in: ["operating_month.status_changed", "monthly_close.confirmed"] }
    }
  });
  return existing;
}

async function seedStoryData(workerIndex: number): Promise<SeededData> {
  const suffix = story53WorkerSuffix(workerIndex);
  const sortBase = 95300 + workerIndex * 100;
  const accounts = {
    admin: `story53_admin_${suffix.toLowerCase()}`,
    settlement: `story53_settlement_${suffix.toLowerCase()}`,
    counter: `story53_counter_${suffix.toLowerCase()}`,
    waiter: `story53_waiter_${suffix.toLowerCase()}`,
    readOnly: `story53_readonly_${suffix.toLowerCase()}`
  };

  const adminEmployee = await seedEmployee(`E2E53-${suffix}-AUTH-ADMIN`, "E2E53 관리자", "BACKOFFICE", "관리자", sortBase);
  const settlementEmployee = await seedEmployee(`E2E53-${suffix}-AUTH-SETTLE`, "E2E53 정산담당", "BACKOFFICE", "정산", sortBase + 1);
  const counterEmployee = await seedEmployee(`E2E53-${suffix}-AUTH-COUNTER`, "E2E53 카운터", "BACKOFFICE", "카운터", sortBase + 2);
  const waiterEmployee = await seedEmployee(`E2E53-${suffix}-AUTH-WAITER`, "E2E53 웨이터", "BACKOFFICE", "웨이터", sortBase + 3);
  const readOnlyEmployee = await seedEmployee(`E2E53-${suffix}-AUTH-READONLY`, "E2E53 조회", "BACKOFFICE", "조회", sortBase + 4);

  const adminAccount = await seedAuthAccount({ accountId: accounts.admin, password: "Story53!admin", role: "administrator", employeeId: adminEmployee.id });
  const settlementAccount = await seedAuthAccount({ accountId: accounts.settlement, password: "Story53!settlement", role: "settlement_manager", employeeId: settlementEmployee.id });
  await seedAuthAccount({ accountId: accounts.counter, password: "Story53!counter", role: "counter", employeeId: counterEmployee.id });
  await seedAuthAccount({ accountId: accounts.waiter, password: "Story53!waiter", role: "waiter", employeeId: waiterEmployee.id });
  await seedAuthAccount({ accountId: accounts.readOnly, password: "Story53!readonly", role: "read_only_viewer", employeeId: readOnlyEmployee.id });

  await (prisma as any).auditLog.deleteMany({
    where: {
      actorId: { in: [adminAccount.id, settlementAccount.id] },
      action: { in: ["operating_month.status_changed", "monthly_close.confirmed"] }
    }
  });

  const draftMonth = await seedOperatingMonth(story53MonthKey(workerIndex, 1), "작성중");
  const reviewMonth = await seedOperatingMonth(story53MonthKey(workerIndex, 2), "검토중");

  return {
    draftOperatingMonthId: draftMonth.id,
    reviewOperatingMonthId: reviewMonth.id,
    accounts,
    accountRecordIds: {
      admin: adminAccount.id,
      settlement: settlementAccount.id
    }
  };
}

test.describe("Story 5.3 monthly close confirmation snapshot", () => {
  test.beforeAll(async ({}, workerInfo) => {
    seededData = await seedStoryData(workerInfo.workerIndex);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("administrator can start review, confirm monthly close, and see persisted snapshot label", async ({ page }) => {
    await login(page, seededData.accounts.admin, "Story53!admin");

    await page.goto(`/closing?operatingMonthId=${seededData.draftOperatingMonthId}`);

    await expect(page.getByLabel("월마감 상태 단계")).toContainText("작성중");
    await expect(page.getByRole("button", { name: "검토 시작" })).toBeEnabled();
    await page.getByRole("button", { name: "검토 시작" }).click();
    await expect(page.getByText("운영월 상태: 검토중").first()).toBeVisible();

    await confirmMonthlyCloseThroughDialog(page);

    await expect(page.getByText("확정 스냅샷")).toBeVisible();
    await expect(page.getByText("현재 기준 미리보기").first()).toBeVisible();
    await expect(page.getByText(/snapshot id/)).toBeVisible();
    await expect(page.getByRole("button", { name: "잠금" })).toBeEnabled();

    const operatingMonth = await (prisma as any).operatingMonth.findUnique({
      where: { id: seededData.draftOperatingMonthId },
      select: { status: true }
    });
    expect(operatingMonth?.status).toBe("마감확정");

    const persistedClosings = await (prisma as any).monthlyClosing.findMany({
      where: { operatingMonthId: seededData.draftOperatingMonthId }
    });
    expect(persistedClosings).toHaveLength(1);

    const persistedClosing = persistedClosings[0];
    const snapshot = persistedClosing.snapshotJson as any;
    expect(snapshot.id).toBe(persistedClosing.id);
    expect(snapshot.month.operatingMonthId).toBe(seededData.draftOperatingMonthId);
    expect(snapshot.month.statusAtConfirmation).toBe("검토중");
    expect(snapshot.month.confirmedStatus).toBe("마감확정");
    expect(snapshot.month.confirmedByAccountId).toBe(seededData.accountRecordIds.admin);
    expect(snapshot.source.serviceVersion).toBe("monthly-closing-service:5.3");
    expect(typeof snapshot.totals.grandPayoutAmount).toBe("number");

    const statusAudit = await (prisma as any).auditLog.findFirst({
      where: {
        action: "operating_month.status_changed",
        targetType: "operating_month",
        targetId: seededData.draftOperatingMonthId
      }
    });
    expect(statusAudit?.actorId).toBe(seededData.accountRecordIds.admin);
    expect((statusAudit?.beforeValue as any)?.status).toBe("작성중");
    expect((statusAudit?.afterValue as any)?.status).toBe("검토중");

    const confirmAudits = await (prisma as any).auditLog.findMany({
      where: {
        action: "monthly_close.confirmed",
        targetType: "monthly_close",
        targetId: persistedClosing.id
      }
    });
    expect(confirmAudits).toHaveLength(1);
    expect(confirmAudits[0].actorId).toBe(seededData.accountRecordIds.admin);
    expect((confirmAudits[0].beforeValue as any)?.status).toBe("검토중");
    expect((confirmAudits[0].afterValue as any)?.status).toBe("마감확정");
    expect((confirmAudits[0].afterValue as any)?.snapshotId).toBe(persistedClosing.id);

    await page.reload();
    await expect(page.getByRole("button", { name: "마감 확정" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "잠금" })).toBeEnabled();
    const closingCountAfterReload = await (prisma as any).monthlyClosing.count({ where: { operatingMonthId: seededData.draftOperatingMonthId } });
    expect(closingCountAfterReload).toBe(1);
  });

  test("settlement manager can request confirmation from review status", async ({ page }) => {
    await login(page, seededData.accounts.settlement, "Story53!settlement");

    await page.goto(`/closing?operatingMonthId=${seededData.reviewOperatingMonthId}`);

    await confirmMonthlyCloseThroughDialog(page);
    await expect(page.getByText("확정 스냅샷")).toBeVisible();
    await expect(page.getByText("확정 전체 지급 합계")).toBeVisible();

    const closing = await (prisma as any).monthlyClosing.findFirst({
      where: { operatingMonthId: seededData.reviewOperatingMonthId },
      orderBy: { closeVersion: "desc" }
    });
    expect(closing?.confirmedByAccountId).toBe(seededData.accountRecordIds.settlement);
    expect((closing?.snapshotJson as any)?.month.confirmedByAccountId).toBe(seededData.accountRecordIds.settlement);
  });

  test("counter, waiter, and read-only roles cannot access /closing", async ({ page }) => {
    await login(page, seededData.accounts.counter, "Story53!counter");
    await page.goto(`/closing?operatingMonthId=${seededData.reviewOperatingMonthId}`);
    await expect(page).toHaveURL(/\/calls/);

    await page.context().clearCookies();
    await login(page, seededData.accounts.waiter, "Story53!waiter");
    await page.goto(`/closing?operatingMonthId=${seededData.reviewOperatingMonthId}`);
    await expect(page).toHaveURL(/\/rooms/);

    await page.context().clearCookies();
    await login(page, seededData.accounts.readOnly, "Story53!readonly");
    await page.goto(`/closing?operatingMonthId=${seededData.reviewOperatingMonthId}`);
    await expect(page).toHaveURL(/\/rooms/);
  });
});
