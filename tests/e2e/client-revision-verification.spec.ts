import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { defaultRooms } from "@/modules/masters/room-schema";
import { selectGridOption } from "./support/call-grid";

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
  await upsertRate(therapist1.id, course.id, 700000);
  await upsertRate(therapist2.id, course.id, 300000);

  // "11:00"은 기본 시드에 이미 sortOrder 10으로 있다. 그 sortOrder를 바꾸면 영업일 시작(dayStartFromSlots,
  // service-call-service.ts)이 전역으로 밀려 같은 DB의 다른 스펙(예: 티켓 26)의 날짜 경계 계산이 깨진다.
  // isActive만 보장한다.
  await (prisma as any).timeSlot.upsert({
    where: { value: "11:00" },
    update: { isActive: true },
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
      { serviceCallId: call.id, assignmentRole: "THERAPIST_2", employeeId: seededData.therapist2Id }
    ]
  });
  return call;
}

// 콜 원장 흐름 재구성(티켓 03)으로 표 아래 새 행 입력(data-call-cell-*)은 없어졌다. 줄은 입력칸이 없고,
// 모든 칸은 오른쪽 편집 패널에서 고친다.
function line(page: Page, serviceCallId: string) {
  return page.locator(`[data-ledger-line][data-service-call-id="${serviceCallId}"]`);
}

function panel(page: Page) {
  return page.getByRole("complementary", { name: /^콜 상세/ });
}

async function openPanel(page: Page, serviceCallId: string) {
  await line(page, serviceCallId).locator("[data-call-open]").click();
  const edit = panel(page);
  await expect(edit).toBeVisible();
  return edit;
}

test.describe("Client revision browser verification", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    seededData = await seedStoryData();
    await createCompletedCall("WO Verify completed settlement redaction");
  });

  test("counter call ledger hides settlement amounts while admin can see them in the panel's payment group", async ({ page }) => {
    const call = await (prisma as any).serviceCall.findFirst({ where: { customerMemo: "WO Verify completed settlement redaction" } });

    await login(page, seededData.accounts.counter.accountId, seededData.accounts.counter.password);
    // 완료된 콜은 흐름별 목록의 "완료·취소" 묶음에 들어가 기본으로 접혀 있다(스펙 D16, 티켓 03). 열린 콜(?call=)이
    // 그 묶음의 콜이면 화면이 자동으로 펼친다.
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${assignedDate}&call=${call.id}`);

    const counterPanel = panel(page);
    await expect(counterPanel).toBeVisible();
    const counterPayment = counterPanel.getByRole("region", { name: "결제" });
    await expect(counterPayment).toBeVisible();
    await expect(counterPayment.getByText("마사지사1수당")).toHaveCount(0);
    await expect(counterPayment.getByText("마사지사2수당")).toHaveCount(0);

    await counterPayment.getByText("카드", { exact: true }).click();
    await expect.poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: call.id } })).paymentMethodCode).toBe("CARD");
    await expect(counterPanel.locator('[data-save-state="saved"]')).toContainText("저장됨");

    await login(page, seededData.accounts.administrator.accountId, seededData.accounts.administrator.password);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${assignedDate}&call=${call.id}`);

    const adminPayment = panel(page).getByRole("region", { name: "결제" });
    await expect(adminPayment.getByText("마사지사1수당")).toBeVisible();
    const commission1 = adminPayment.locator("div").filter({ has: page.locator("dt", { hasText: "마사지사1수당" }) });
    const commission2 = adminPayment.locator("div").filter({ has: page.locator("dt", { hasText: "마사지사2수당" }) });
    await expect(commission1).toContainText("700,000");
    await expect(commission2).toContainText("300,000");

    await login(page, seededData.accounts.settlement_manager.accountId, seededData.accounts.settlement_manager.password);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${assignedDate}`);
    await expect(page).toHaveURL(/\/settlements(?:\?|$)/);
  });

  test("unassigned reservation stays out of room occupancy until assigned in the panel", async ({ page }) => {
    const memo = `WO Verify unassigned ${Date.now().toString(36)}`;

    // 새 콜은 빠른 예약으로만 만든다(스펙 D22) — 그 생성 흐름은 다른 스펙이 가린다. 이 테스트의 목적은
    // 미배정 콜이 객실 점유에서 빠졌다가 배정 뒤 반영되는지라, 콜은 DB로 바로 만든다.
    const call = await (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: seededData.openMonthId,
        serviceDate: new Date(`${unassignedDate}T00:00:00.000Z`),
        startTime: "11:00",
        roomId: null,
        courseId: seededData.courseId,
        customerMemo: memo,
        status: "예약"
      }
    });

    await login(page, seededData.accounts.counter.accountId, seededData.accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${unassignedDate}`);
    await expect(line(page, call.id)).toContainText("미배정");
    expect(call.roomId).toBeNull();

    await page.goto(`/rooms?operatingMonthId=${seededData.openMonthId}&serviceDate=${unassignedDate}`);
    await expect(page.getByTestId("room-status-card").first()).toBeVisible();
    await expect(page.getByTestId("room-status-card").filter({ hasText: "WO 미배정60" })).toHaveCount(0);
    // 실시간 객실판은 평면도라 코스 이름이 없다. 미배정 예약이 어느 방도 예약으로 차지하지 않는지 본다.
    await page.goto(`/live?operatingMonthId=${seededData.openMonthId}&serviceDate=${unassignedDate}`);
    await expect(page.getByTestId("floor-plan-room").first()).toBeVisible();
    await expect(page.getByTestId("floor-plan-room").filter({ has: page.getByLabel("상태: 예약") })).toHaveCount(0);

    await login(page, seededData.accounts.read_only_viewer.accountId, seededData.accounts.read_only_viewer.password);
    await page.goto(`/tv?operatingMonthId=${seededData.openMonthId}&serviceDate=${unassignedDate}`);
    await expect(page.getByTestId("room-status-card").filter({ hasText: "WO 미배정60" })).toHaveCount(0);

    await login(page, seededData.accounts.counter.accountId, seededData.accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${unassignedDate}`);
    const edit = await openPanel(page, call.id);
    await selectGridOption(page, edit, "객실", "401 호실");
    await expect(edit.locator('[data-save-state="saved"]')).toContainText("저장됨");

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
    // 티켓 03: 결제수단별 합계는 "하루 수납·지출" 탭에 있다.
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${paymentSummaryDate}&tab=cashbook`);

    const paymentMethods = page.getByLabel("일별 요약").getByRole("region", { name: "결제수단별 합계" });
    for (const [label, value] of [["현금", "0 VND"], ["카드", "1,500,000 VND"], ["계좌", "0 VND"], ["기타", "0 VND"]] as const) {
      const item = paymentMethods.locator("dl > div").filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) });
      await expect(item).toBeVisible();
      await expect(item.locator("dd")).toHaveText(value);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test.afterAll(async () => {
    if (seededData) {
      await cleanupStoryCalls(seededData.openMonthId);
    }
    await prisma.$disconnect();
  });
});
