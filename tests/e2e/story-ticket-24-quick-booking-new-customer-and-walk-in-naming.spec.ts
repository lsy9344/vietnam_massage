import { testEmployees } from "./support/test-employees";
import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { checkInTherapist, chooseConditions, fillBooking, goToCustomerStep, openQuickBooking, pickGuest, saveQuickBooking } from "./support/quick-booking";

/**
 * 티켓 24: 빠른 예약 ②의 고객 연결 규칙(1018 스펙 D21–D22). 과거의 "새 고객 만들기" 전용 폼과 "최근 방문
 * 가져오기"는 없어졌다 — 예약자명 칸 하나로 고객을 잇거나 새로 만든다. 같은 요청 id로 다시 보내도 고객이 두
 * 번 생기지 않는 것은 단위 테스트(service-call-service.test.ts의 "quick booking: new customer saved with
 * the call"·"names a walk-in without a name 워크인 N")가 이미 확인하므로, 여기서는 화면에서 실제로
 * 새 고객이 콜과 함께 만들어지는지, 같은 이름 후보를 고르면 중복 없이 연결되는지, 워크인에 이름이 없으면
 * 고객 없이 번호 이름이 붙는지만 본다.
 */
const account = { accountId: "t24_counter", password: "Ticket24!counter", staffCode: "E2E-T24-COUNTER", sortOrder: 92400 };
const monthKey = "2040-05";
const serviceDate = "2040-05-15";

let monthId = "";
let courseId = "";
let therapistId = "";
let existingCustomerId = "";

async function seedAccount() {
  const employee = await testEmployees.upsert({
    where: { staffCode: account.staffCode },
    update: { displayName: "T24 카운터", employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: account.staffCode,
      displayName: "T24 카운터",
      employeeGroup: "OPERATIONS",
      position: "카운터",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: account.sortOrder,
      isActive: true
    }
  });
  const data = {
    email: `${account.accountId}@example.local`,
    passwordHash: await hash(account.password, argon2idOptions),
    role: "counter",
    employeeId: employee.id,
    isActive: true,
    lockedUntil: null,
    failedLoginCount: 0
  };
  await (prisma as any).userAccount.upsert({
    where: { accountId: account.accountId },
    update: data,
    create: { ...data, accountId: account.accountId }
  });
}

async function cleanup() {
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
  await (prisma as any).customer.deleteMany({ where: { name: { startsWith: "T24 " } } });
}

test.describe("티켓 24 빠른 예약 고객 연결: 새 고객·같은 이름 후보·워크인 이름", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount();
    const month = await (prisma as any).operatingMonth.upsert({
      where: { monthKey },
      update: { status: "작성중" },
      create: {
        monthKey,
        startDate: new Date(`${monthKey}-01T00:00:00.000Z`),
        endDate: new Date(`${monthKey}-31T00:00:00.000Z`),
        status: "작성중"
      }
    });
    monthId = month.id;
    await cleanup();

    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    courseId = course.id;
    const policy = {
      name: "T24 A",
      durationMinutes: 60,
      basePrice: 1500000,
      requiresSecondTherapist: false,
      tvDisplayName: "T24 A",
      effectiveToMonth: monthKey,
      isActive: true
    };
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...policy } });
    }

    const therapist = await testEmployees.upsert({
      where: { staffCode: "E2E-T24-THR-1" },
      update: { displayName: "T24 마사지사", employeeGroup: "THERAPIST", isActive: true },
      create: {
        staffCode: "E2E-T24-THR-1",
        displayName: "T24 마사지사",
        employeeGroup: "THERAPIST",
        position: "마사지사",
        shiftType: "전체",
        baseSalary: 0,
        employmentStatus: "재직",
        sortOrder: 92401,
        isActive: true
      }
    });
    therapistId = therapist.id;
    const existingRate = await (prisma as any).therapistCourseRate.findFirst({
      where: { therapistId, courseId, effectiveFromMonth: monthKey }
    });
    const rate = { amount: 300000, effectiveToMonth: monthKey, isActive: true };
    if (existingRate) {
      await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
    } else {
      await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth: monthKey, ...rate } });
    }
    // Therapist 줄은 그날 출근 기록이 있는 사람만 기본으로 보인다(1018 스펙 D23).
    await checkInTherapist({ operatingMonthId: monthId, serviceDate, employeeId: therapistId });

    // 기존 고객: 완료된 방문 하나 — "같은 이름 고객" 후보로 뜬다(1018 스펙 D21).
    const existingCustomer = await (prisma as any).customer.create({
      data: { name: "T24 재방문", phone: "0907778889", memo: "단골" }
    });
    existingCustomerId = existingCustomer.id;
    await (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: monthId,
        serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
        startTime: "11:00",
        roomId: null,
        courseId,
        customerId: existingCustomerId,
        customerMemo: "T24 재방문",
        status: "방문완료"
      }
    });
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId, courseId } });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T24 A", effectiveFromMonth: monthKey } });
    await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: monthId } });
    await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  test("예약자명만 적어 저장하면 새 고객이 하나 생겨 콜에 연결되고, customerMemo도 같은 이름이다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const name = `T24 새손님 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "12:00" });
    await pickGuest(page, panel, { therapistId, courseId });
    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "전화", bookerName: name });
    await saveQuickBooking(page, panel);

    const createdCustomers = await (prisma as any).customer.findMany({ where: { name } });
    expect(createdCustomers).toHaveLength(1);
    expect(createdCustomers[0].phone).toBeNull();
    expect(createdCustomers[0].memo).toBeNull();
    expect(createdCustomers[0].preferenceNote).toBeNull();

    const createdCall = await (prisma as any).serviceCall.findFirst({ where: { customerId: createdCustomers[0].id } });
    expect(createdCall).not.toBeNull();
    expect(createdCall.bookerName).toBe(name);
    expect(createdCall.customerMemo).toBe(name);
  });

  test("같은 이름의 기존 고객 후보를 고르면 그 고객과 연결되고 새 고객은 생기지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "13:00" });
    await pickGuest(page, panel, { therapistId, courseId });
    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "카카오톡", bookerName: "T24 재방문" });

    const candidate = panel.locator(`[data-booker-candidate="${existingCustomerId}"]`);
    await expect(candidate).toBeVisible({ timeout: 10_000 });
    await expect(candidate).toContainText("최근");
    await candidate.click();

    await expect(panel.getByText("T24 재방문 · 0907778889")).toBeVisible();
    const counts = panel.getByRole("list", { name: "방문완료·노쇼·취소 건수" });
    await expect(counts).toContainText("방문완료 1건");

    await saveQuickBooking(page, panel);

    const linkedCalls = await (prisma as any).serviceCall.findMany({ where: { customerId: existingCustomerId, startTime: "13:00" } });
    expect(linkedCalls).toHaveLength(1);
    expect(linkedCalls[0].customerMemo).toBe("T24 재방문");
    const namedCustomers = await (prisma as any).customer.findMany({ where: { name: "T24 재방문" } });
    expect(namedCustomers).toHaveLength(1);
  });

  test("워크인이고 이름이 없으면 그날 다음 번호의 '워크인 N'이 붙고 고객은 만들지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    const customersBefore = await (prisma as any).customer.count();

    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    let panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "14:00" });
    await pickGuest(page, panel, { therapistId, courseId });
    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "워크인" });
    await saveQuickBooking(page, panel);

    const first = await (prisma as any).serviceCall.findFirst({ where: { operatingMonthId: monthId, startTime: "14:00" } });
    expect(first.bookerName).toBe("워크인 1");
    expect(first.customerMemo).toBe("워크인 1");
    expect(first.customerId).toBeNull();

    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "15:00" });
    await pickGuest(page, panel, { therapistId, courseId });
    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "워크인" });
    await saveQuickBooking(page, panel);

    const second = await (prisma as any).serviceCall.findFirst({ where: { operatingMonthId: monthId, startTime: "15:00" } });
    expect(second.bookerName).toBe("워크인 2");
    expect(second.customerId).toBeNull();

    const customersAfter = await (prisma as any).customer.count();
    expect(customersAfter).toBe(customersBefore);
  });
});
