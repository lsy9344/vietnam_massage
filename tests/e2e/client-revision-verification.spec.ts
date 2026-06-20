import { expect, test, type Locator, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { defaultRooms } from "@/modules/masters/room-schema";

const monthKey = "2032-07";
const assignedDate = "2032-07-05";
const unassignedDate = "2032-07-06";
const paymentSummaryDate = "2032-07-07";

type Role = "administrator" | "counter" | "settlement_manager" | "read_only_viewer";

type SeededData = {
  openMonthId: string;
  roomId: string;
  courseId: string;
  therapist1Id: string;
  therapist2Id: string;
  earcareEmployeeId: string;
  accounts: Record<Role, { accountId: string; password: string }>;
};

let seededData: SeededData;

async function seedAccount(input: { accountId: string; password: string; role: Role; staffCode: string; displayName: string; sortOrder: number }) {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: input.displayName,
      employeeGroup: "OPERATIONS",
      position: input.role === "counter" ? "카운터" : input.role === "settlement_manager" ? "정산" : "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: input.sortOrder,
      isActive: true
    },
    create: {
      staffCode: input.staffCode,
      displayName: input.displayName,
      employeeGroup: "OPERATIONS",
      position: input.role === "counter" ? "카운터" : input.role === "settlement_manager" ? "정산" : "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: input.sortOrder,
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

async function upsertCodeItem(codeType: string, code: string, displayName: string, sortOrder: number) {
  await (prisma as any).codeItem.upsert({
    where: { codeType_code: { codeType, code } },
    update: { displayName, sortOrder, isActive: true },
    create: { codeType, code, displayName, sortOrder, isSystemDefault: false, isActive: true }
  });
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: {
      displayName,
      employeeGroup,
      position,
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position,
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

async function upsertPolicy(courseId: string) {
  const data = {
    name: "WO 검증60",
    durationMinutes: 60,
    basePrice: 1500000,
    opsCallCredit: 1,
    earcarePoolAmount: 100000,
    requiresSecondTherapist: false,
    tvDisplayName: "WO 미배정60",
    effectiveToMonth: null,
    isActive: true
  };
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
  if (existing) {
    await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data });
    return;
  }
  await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...data } });
}

async function upsertRate(therapistId: string, courseId: string, amount: number) {
  const data = { amount, effectiveToMonth: null, isActive: true };
  const existing = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId, courseId, effectiveFromMonth: monthKey } });
  if (existing) {
    await (prisma as any).therapistCourseRate.update({ where: { id: existing.id }, data });
    return;
  }
  await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth: monthKey, ...data } });
}

async function cleanupStoryCalls(openMonthId: string) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: { operatingMonthId: openMonthId, customerMemo: { startsWith: "WO Verify" } },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length === 0) return;

  await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
}

async function seedStoryData(): Promise<SeededData> {
  const accountRoles = ["administrator", "counter", "settlement_manager", "read_only_viewer"] as const;
  const accounts = {} as SeededData["accounts"];
  for (const [index, role] of accountRoles.entries()) {
    accounts[role] = { accountId: `wo_verify_${role}`, password: `WoVerify!${role}` };
    await seedAccount({
      ...accounts[role],
      role,
      staffCode: `WO-VFY-${role.toUpperCase()}`,
      displayName: `WO 검증 ${role}`,
      sortOrder: 98700 + index
    });
  }

  const openMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: {
      startDate: new Date(`${monthKey}-01T00:00:00.000Z`),
      endDate: new Date(`${monthKey}-31T00:00:00.000Z`),
      status: "작성중"
    },
    create: {
      monthKey,
      startDate: new Date(`${monthKey}-01T00:00:00.000Z`),
      endDate: new Date(`${monthKey}-31T00:00:00.000Z`),
      status: "작성중"
    }
  });
  await cleanupStoryCalls(openMonth.id);

  const rooms = await Promise.all(
    defaultRooms.map((room) =>
      (prisma as any).room.upsert({
        where: { sortOrder: room.sortOrder },
        update: { displayName: room.displayName, migrationReferenceName: room.migrationReferenceName, isActive: true },
        create: { displayName: room.displayName, migrationReferenceName: room.migrationReferenceName, sortOrder: room.sortOrder, isActive: true }
      })
    )
  );
  const room = rooms[0];
  const course = await (prisma as any).course.upsert({ where: { code: "WOVFY" }, update: { isActive: true }, create: { code: "WOVFY", isActive: true } });
  await upsertPolicy(course.id);

  const therapist1 = await seedEmployee("WO-VFY-THR-1", "WO 검증 마사지사1", "THERAPIST", "마사지사", 98710);
  const therapist2 = await seedEmployee("WO-VFY-THR-2", "WO 검증 마사지사2", "THERAPIST", "마사지사", 98711);
  const earcare = await seedEmployee("WO-VFY-EAR-1", "WO 검증 귀케어", "EARCARE", "귀케어", 98712);
  await upsertRate(therapist1.id, course.id, 700000);
  await upsertRate(therapist2.id, course.id, 300000);

  await (prisma as any).timeSlot.upsert({
    where: { value: "11:00" },
    update: { sortOrder: 98701, isActive: true },
    create: { value: "11:00", sortOrder: 98701, isActive: true }
  });
  await upsertCodeItem("SERVICE_STATUS", "예약", "예약", 98701);
  await upsertCodeItem("SERVICE_STATUS", "사용중", "사용중", 98702);
  await upsertCodeItem("SERVICE_STATUS", "VISIT_COMPLETE", "방문완료", 98703);
  await upsertCodeItem("PAYMENT_METHOD", "CASH", "현금", 98701);
  await upsertCodeItem("PAYMENT_METHOD", "CARD", "카드", 98702);
  await upsertCodeItem("PAYMENT_METHOD", "BANK_TRANSFER", "계좌", 98703);
  await upsertCodeItem("PAYMENT_METHOD", "OTHER", "기타", 98704);
  await upsertCodeItem("CONFIRMATION", "Y", "Y", 98701);

  return {
    openMonthId: openMonth.id,
    roomId: room.id,
    courseId: course.id,
    therapist1Id: therapist1.id,
    therapist2Id: therapist2.id,
    earcareEmployeeId: earcare.id,
    accounts
  };
}

async function createCompletedCall(memo: string, input?: { serviceDate?: string; paymentMethodCode?: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: seededData.openMonthId,
      serviceDate: new Date(`${input?.serviceDate ?? assignedDate}T00:00:00.000Z`),
      startTime: "11:00",
      roomId: seededData.roomId,
      courseId: seededData.courseId,
      customerMemo: memo,
      status: "VISIT_COMPLETE",
      paymentMethodCode: input?.paymentMethodCode ?? "CASH",
      confirmationCode: "Y"
    }
  });
  await (prisma as any).serviceCallAssignment.createMany({
    data: [
      { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: seededData.therapist1Id },
      { serviceCallId: call.id, assignmentRole: "THERAPIST_2", employeeId: seededData.therapist2Id },
      { serviceCallId: call.id, assignmentRole: "EARCARE", employeeId: seededData.earcareEmployeeId }
    ]
  });
  return call;
}

function addRowCell(page: Page, columnId: string) {
  return page.locator(`[data-call-cell-row="0"][data-call-cell-column="${columnId}"]`);
}

async function selectCombobox(page: Page, columnId: string, value: string) {
  const combobox = addRowCell(page, columnId);
  await combobox.click();
  await page.locator(`[role="option"][id$="-option-${value}"]`).click();
}

async function selectRowCombobox(row: Locator, label: string, value: string) {
  const combobox = row.getByRole("combobox", { name: label });
  await combobox.click();
  await combobox.fill(value);
  await combobox.press("Enter");
}

function rowByText(page: Page, text: string) {
  return page.getByRole("row", { name: new RegExp(text) });
}

test.describe("Client revision browser verification", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    seededData = await seedStoryData();
    await createCompletedCall("WO Verify completed settlement redaction");
  });

  test("counter call ledger hides settlement columns while admin can see settlement amounts", async ({ page }) => {
    await login(page, seededData.accounts.counter.accountId, seededData.accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${assignedDate}`);

    for (const header of ["마사지사1수당", "마사지사2수당", "귀케어풀", "콜인정"]) {
      await expect(page.getByRole("columnheader", { name: header })).toHaveCount(0);
    }
    await expect(page.getByText("마사지사정산")).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "마사지사 담당 수" })).toHaveCount(0);

    const counterRow = rowByText(page, "WO Verify completed settlement redaction");
    await selectRowCombobox(counterRow, "결제수단", "카드");
    await expect(counterRow.getByText("저장됨")).toBeVisible();

    await login(page, seededData.accounts.administrator.accountId, seededData.accounts.administrator.password);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${assignedDate}`);

    await expect(page.getByRole("columnheader", { name: "마사지사1수당" }).first()).toBeVisible();
    await expect(page.locator('[data-call-cell-column="therapist1Commission"]').first()).toContainText("700,000");
    await expect(page.locator('[data-call-cell-column="therapist2Commission"]').first()).toContainText("300,000");
    await expect(page.locator('[data-call-cell-column="earcarePoolAmount"]').first()).toContainText("100,000");
    await expect(page.locator('[data-call-cell-column="opsCallCredit"]').first()).toContainText("1");

    await login(page, seededData.accounts.settlement_manager.accountId, seededData.accounts.settlement_manager.password);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${assignedDate}`);
    await expect(page).toHaveURL(/\/settlements(?:\?|$)/);
  });

  test("unassigned reservation can be saved, later assigned, and stays out of room occupancy until assigned", async ({ page }) => {
    const memo = `WO Verify unassigned ${Date.now().toString(36)}`;

    await login(page, seededData.accounts.counter.accountId, seededData.accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${unassignedDate}`);

    await selectCombobox(page, "startTime", "11:00");
    await selectCombobox(page, "courseId", seededData.courseId);
    await addRowCell(page, "customerMemo").fill(memo);
    await selectCombobox(page, "status", "예약");
    await page.getByRole("button", { name: "새 콜 행 추가" }).click();

    await expect(page.getByText("저장됨").first()).toBeVisible();
    const savedRow = rowByText(page, memo);
    await expect(savedRow.getByRole("combobox", { name: "객실" })).toHaveValue("미배정");

    const call = await (prisma as any).serviceCall.findFirst({ where: { customerMemo: memo } });
    expect(call?.roomId).toBeNull();

    for (const path of ["/rooms", "/live"] as const) {
      await page.goto(`${path}?operatingMonthId=${seededData.openMonthId}&serviceDate=${unassignedDate}`);
      await expect(page.getByTestId("room-status-card").first()).toBeVisible();
      await expect(page.getByTestId("room-status-card").filter({ hasText: "WO 미배정60" })).toHaveCount(0);
    }

    await login(page, seededData.accounts.read_only_viewer.accountId, seededData.accounts.read_only_viewer.password);
    await page.goto(`/tv?operatingMonthId=${seededData.openMonthId}&serviceDate=${unassignedDate}`);
    await expect(page.getByTestId("room-status-card").filter({ hasText: "WO 미배정60" })).toHaveCount(0);

    await login(page, seededData.accounts.counter.accountId, seededData.accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${unassignedDate}`);
    const stableRow = page.locator(`tr[data-service-call-id="${call.id}"]`);
    await selectRowCombobox(stableRow, "객실", "401 호실");
    await expect(stableRow.getByText("저장됨")).toBeVisible();

    await expect
      .poll(async () => {
        const updated = await (prisma as any).serviceCall.findUnique({ where: { id: call.id } });
        return updated?.roomId;
      })
      .toBe(seededData.roomId);
  });

  test("payment method summary remains readable on a narrow call ledger viewport", async ({ page }) => {
    await cleanupStoryCalls(seededData.openMonthId);
    await createCompletedCall("WO Verify payment summary card", { serviceDate: paymentSummaryDate, paymentMethodCode: "CARD" });

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, seededData.accounts.counter.accountId, seededData.accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${paymentSummaryDate}`);

    const summary = page.getByLabel("일별 요약");
    await expect(summary.locator("div.grid").filter({ hasText: /현금\s*0 VND/ }).first()).toBeVisible();
    await expect(summary.locator("div.grid").filter({ hasText: /카드\s*1,500,000 VND/ }).first()).toBeVisible();
    await expect(summary.locator("div.grid").filter({ hasText: /계좌\s*0 VND/ }).first()).toBeVisible();
    await expect(summary.locator("div.grid").filter({ hasText: /기타\s*0 VND/ }).first()).toBeVisible();
  });

  test.afterAll(async () => {
    if (seededData) {
      await cleanupStoryCalls(seededData.openMonthId);
    }
    await prisma.$disconnect();
  });
});
