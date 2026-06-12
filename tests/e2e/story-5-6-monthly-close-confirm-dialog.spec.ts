import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";


type SeededData = {
  months: {
    success: string;
    cancel: string;
    focus: string;
    stale: string;
  };
  accountId: string;
  accountRecordId: string;
};

let seededData: SeededData;


function story56WorkerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

function story56MonthKey(workerIndex: number, offset: number) {
  const monthNumber = workerIndex * 4 + offset;
  const year = 2070 + Math.floor((monthNumber - 1) / 12);
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

  throw new Error(`No Story 5.6 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedEmployee(staffCode: string, displayName: string, sortOrder: number) {
  const safeSortOrder = await storyEmployeeSortOrder("BACKOFFICE", staffCode, sortOrder);
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup: "BACKOFFICE", position: "정산", shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder: safeSortOrder, isActive: true },
    create: { staffCode, displayName, employeeGroup: "BACKOFFICE", position: "정산", shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder: safeSortOrder, isActive: true }
  });
}

async function seedAuthAccount(input: { accountId: string; password: string; employeeId: string }) {
  const passwordHash = await hash(input.password, argon2idOptions);
  return (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: {
      email: `${input.accountId}@example.local`,
      passwordHash,
      role: "settlement_manager",
      employeeId: input.employeeId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: `${input.accountId}@example.local`,
      accountId: input.accountId,
      passwordHash,
      role: "settlement_manager",
      employeeId: input.employeeId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function seedReviewMonth(monthKey: string) {
  const month = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { startDate: utcDate(monthKey), endDate: utcDate(monthKey), status: "검토중" },
    create: { monthKey, startDate: utcDate(monthKey), endDate: utcDate(monthKey), status: "검토중" }
  });
  await (prisma as any).monthlyClosing.deleteMany({ where: { operatingMonthId: month.id } });
  await (prisma as any).auditLog.deleteMany({
    where: {
      OR: [{ targetId: month.id }, { action: "monthly_close.confirmed", beforeValue: { path: ["operatingMonthId"], equals: month.id } }]
    }
  });
  return month;
}

async function seedStoryData(workerIndex: number): Promise<SeededData> {
  const suffix = story56WorkerSuffix(workerIndex);
  const sortBase = 95600 + workerIndex * 100;
  const employee = await seedEmployee(`E2E56-${suffix}-AUTH-SETTLE`, "E2E56 정산담당", sortBase);
  const accountId = `story56_settlement_${suffix.toLowerCase()}`;
  const account = await seedAuthAccount({ accountId, password: "Story56!settlement", employeeId: employee.id });

  const [success, cancel, focus, stale] = await Promise.all([
    seedReviewMonth(story56MonthKey(workerIndex, 1)),
    seedReviewMonth(story56MonthKey(workerIndex, 2)),
    seedReviewMonth(story56MonthKey(workerIndex, 3)),
    seedReviewMonth(story56MonthKey(workerIndex, 4))
  ]);

  return {
    months: {
      success: success.id,
      cancel: cancel.id,
      focus: focus.id,
      stale: stale.id
    },
    accountId,
    accountRecordId: account.id
  };
}

async function openConfirmDialog(page: Page) {
  const trigger = page.getByRole("button", { name: "마감 확정" });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const dialog = page.getByRole("alertdialog", { name: /월마감을 확정할까요/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function assertAlertDialogLabeling(page: Page) {
  const labels = await page.getByRole("alertdialog").evaluate((element) => {
    const labelledBy = element.getAttribute("aria-labelledby");
    const describedBy = element.getAttribute("aria-describedby");
    return {
      labelledBy,
      describedBy,
      titleText: labelledBy ? document.getElementById(labelledBy)?.textContent ?? "" : "",
      descriptionText: describedBy ? document.getElementById(describedBy)?.textContent ?? "" : ""
    };
  });

  expect(labels.labelledBy).toBeTruthy();
  expect(labels.describedBy).toBeTruthy();
  expect(labels.titleText).toContain("월마감을 확정할까요");
  expect(labels.descriptionText).toContain("확정 시 스냅샷이 고정되어 이후 설정 변경으로 재계산되지 않습니다.");
}

async function confirmedAuditCount(operatingMonthId: string) {
  return (prisma as any).auditLog.count({
    where: {
      action: "monthly_close.confirmed",
      targetType: "monthly_close",
      beforeValue: { path: ["operatingMonthId"], equals: operatingMonthId }
    }
  });
}

test.describe("Story 5.6 monthly close double-confirm dialog", () => {
  test.beforeAll(async ({}, workerInfo) => {
    seededData = await seedStoryData(workerInfo.workerIndex);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("opens alertdialog first, shows preview summary, and confirms only from second action", async ({ page }) => {
    await login(page, seededData.accountId, "Story56!settlement");
    await page.goto(`/closing?operatingMonthId=${seededData.months.success}`);

    expect(await (prisma as any).monthlyClosing.count({ where: { operatingMonthId: seededData.months.success } })).toBe(0);
    expect(await confirmedAuditCount(seededData.months.success)).toBe(0);

    const dialog = await openConfirmDialog(page);
    await assertAlertDialogLabeling(page);
    await expect(dialog).toContainText("전체 지급 합계");
    await expect(dialog).toContainText("운영월");
    await expect(dialog).toContainText("마사지사");
    await expect(dialog).toContainText("운영팀");
    await expect(dialog).toContainText("귀케어");
    await expect(dialog).toContainText(/마사지사[\s\S]*[\d,]+ VND[\s\S]*\d+명/);
    await expect(dialog).toContainText(/운영팀[\s\S]*[\d,]+ VND[\s\S]*\d+명 \/ 일일 [\d,]+ VND \/ 월 [\d,]+ VND/);
    await expect(dialog).toContainText(/귀케어[\s\S]*[\d,]+ VND[\s\S]*\d+명/);
    await expect(dialog).toContainText(/warning[\s\S]*\d+건/);
    await expect(dialog).toContainText("확정 시 스냅샷이 고정되어 이후 설정 변경으로 재계산되지 않습니다.");
    expect(await (prisma as any).monthlyClosing.count({ where: { operatingMonthId: seededData.months.success } })).toBe(0);
    expect(await confirmedAuditCount(seededData.months.success)).toBe(0);

    await dialog.getByRole("button", { name: "지급 스냅샷 확정" }).click();
    await expect(page.getByText("확정 스냅샷", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "잠금" })).toBeEnabled();

    const month = await (prisma as any).operatingMonth.findUnique({ where: { id: seededData.months.success }, select: { status: true } });
    expect(month?.status).toBe("마감확정");
    expect(await (prisma as any).monthlyClosing.count({ where: { operatingMonthId: seededData.months.success } })).toBe(1);
    expect(await confirmedAuditCount(seededData.months.success)).toBe(1);
  });

  test("Esc and close affordance cancel without snapshot or audit side effects and return focus", async ({ page }) => {
    await login(page, seededData.accountId, "Story56!settlement");
    await page.goto(`/closing?operatingMonthId=${seededData.months.cancel}`);

    await openConfirmDialog(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(page.getByRole("button", { name: "마감 확정" })).toBeFocused();

    const dialog = await openConfirmDialog(page);
    await dialog.getByRole("button", { name: "닫기" }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(page.getByRole("button", { name: "마감 확정" })).toBeFocused();

    const month = await (prisma as any).operatingMonth.findUnique({ where: { id: seededData.months.cancel }, select: { status: true } });
    expect(month?.status).toBe("검토중");
    expect(await (prisma as any).monthlyClosing.count({ where: { operatingMonthId: seededData.months.cancel } })).toBe(0);
    expect(await confirmedAuditCount(seededData.months.cancel)).toBe(0);
  });

  test("uses safe initial focus, traps tab focus, labels alertdialog, and returns focus on cancel", async ({ page }) => {
    await login(page, seededData.accountId, "Story56!settlement");
    await page.goto(`/closing?operatingMonthId=${seededData.months.focus}`);

    const dialog = await openConfirmDialog(page);
    await assertAlertDialogLabeling(page);
    await expect(dialog).toContainText("확정 시 스냅샷이 고정되어 이후 설정 변경으로 재계산되지 않습니다.");
    await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
    await expect(dialog.getByRole("button", { name: "지급 스냅샷 확정" })).not.toBeFocused();

    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      const focusIsInsideDialog = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="alertdialog"]')));
      expect(focusIsInsideDialog).toBe(true);
    }

    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(page.getByRole("button", { name: "마감 확정" })).toBeFocused();

    const month = await (prisma as any).operatingMonth.findUnique({ where: { id: seededData.months.focus }, select: { status: true } });
    expect(month?.status).toBe("검토중");
    expect(await (prisma as any).monthlyClosing.count({ where: { operatingMonthId: seededData.months.focus } })).toBe(0);
    expect(await confirmedAuditCount(seededData.months.focus)).toBe(0);
  });

  test("shows Korean error and keeps dialog readable when server transition fails", async ({ page }) => {
    await login(page, seededData.accountId, "Story56!settlement");
    await page.goto(`/closing?operatingMonthId=${seededData.months.stale}`);

    const dialog = await openConfirmDialog(page);
    await (prisma as any).operatingMonth.update({
      where: { id: seededData.months.stale },
      data: { status: "작성중" }
    });
    await dialog.getByRole("button", { name: "지급 스냅샷 확정" }).click();
    await expect(dialog.getByRole("alert")).toContainText("현재 상태에서는 마감 확정할 수 없습니다.");
    await expect(dialog).toBeVisible();

    const month = await (prisma as any).operatingMonth.findUnique({ where: { id: seededData.months.stale }, select: { status: true } });
    expect(month?.status).toBe("작성중");
    expect(await (prisma as any).monthlyClosing.count({ where: { operatingMonthId: seededData.months.stale } })).toBe(0);
    expect(await confirmedAuditCount(seededData.months.stale)).toBe(0);
  });
});
