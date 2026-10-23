import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";
import {
  checkInTherapist,
  chooseConditions,
  fillBooking,
  goToCustomerStep,
  openQuickBooking,
  pickGuest,
  quickBookingLine,
  quickBookingPanel,
  saveQuickBooking
} from "./support/quick-booking";

// 1018 티켓 05: 빠른 예약을 5단계 모달에서 원장 옆 패널의 2단계(① 조건, ② 고객)로 바꾼다(스펙 D19–D23).
// 객실 단계와 확인 단계는 없고, 저장한 뒤에는 새 행이 골라진다. 먼 뒤 날짜를 써서 자동 청소 중(D14)이
// 끼어들지 않는다. 시나리오마다 날짜를 분리해 "그날" 기준인 워크인 번호·출근 전 보기가 서로 영향받지 않는다.
const account = { accountId: "t1805_counter", password: "Ticket1805!counter", staffCode: "E2E-T1805-OPS", sortOrder: 95501 };
const MONTH_KEY = "2041-01";
const MONTH_START = "2041-01-01";
const MONTH_END = "2041-01-31";
const DATE_PANEL = "2041-01-05";
const DATE_AVAIL = "2041-01-06";
const DATE_PARTY = "2041-01-07";
const DATE_WALKIN = "2041-01-08";
const DATE_CLOSE = "2041-01-09";
const DATE_VI = "2041-01-10";
const DATE_HANDLE = "2041-01-11";
const NEW_CUSTOMER_PREFIX = "T1805 새손님";

let monthId = "";
let courseId = "";
const employees = { avail: "", planned: "", dayOff: "", unscheduled: "", busy: "" };

async function seedTherapist(staffCode: string, displayName: string, sortOrder: number) {
  return testEmployees.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup: "THERAPIST", isActive: true, sortOrder },
    create: {
      staffCode,
      displayName,
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

async function seedAccount() {
  const operations = await testEmployees.upsert({
    where: { staffCode: account.staffCode },
    update: { displayName: "T1805 카운터", employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: account.staffCode,
      displayName: "T1805 카운터",
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
    employeeId: operations.id,
    isActive: true,
    lockedUntil: null,
    failedLoginCount: 0
  };
  await (prisma as any).userAccount.upsert({ where: { accountId: account.accountId }, update: data, create: { ...data, accountId: account.accountId } });
}

async function setPlanned(employeeId: string, date: string, planStatus: "근무 예정" | "휴무") {
  await (prisma as any).plannedWorkingDay.create({ data: { employeeId, workDate: new Date(`${date}T00:00:00.000Z`), planStatus } });
}

/** 정리: 이 스펙이 만든 콜·출근·근무표·고객을 지운다. 세 번 반복 실행해도 깨끗해야 한다. */
async function cleanupData() {
  if (!monthId) return;
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
  await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: monthId } });
  await (prisma as any).plannedWorkingDay.deleteMany({
    where: { workDate: { gte: new Date(`${MONTH_START}T00:00:00.000Z`), lte: new Date(`${MONTH_END}T00:00:00.000Z`) } }
  });
  await (prisma as any).customer.deleteMany({ where: { name: { startsWith: NEW_CUSTOMER_PREFIX } } });
  await (prisma as any).customer.deleteMany({ where: { name: { in: ["워크인 1", "워크인 2"] } } });
}

const ledgerUrl = (date: string) => `/calls?operatingMonthId=${monthId}&serviceDate=${date}`;

// 콜이 없는 날은 "콜 원장 목록"(ol)이 hidden이라 그리드 제목으로 로딩을 확인한다. 목록 자체가 보이는지는
// 콜이 있는 날짜(①의 DATE_PANEL, ②의 DATE_AVAIL)를 쓰는 테스트가 따로 확인한다.
async function openLedger(page: Page, date: string) {
  await page.goto(ledgerUrl(date));
  await expect(page.getByRole("heading", { name: "콜 원장 그리드" })).toBeVisible();
}

async function assertNoHorizontalScroll(page: Page) {
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
}

test.describe("1018 티켓 05: 빠른 예약 옆 패널과 2단계", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount();
    monthId = (
      await (prisma as any).operatingMonth.upsert({
        where: { monthKey: MONTH_KEY },
        update: { status: "작성중" },
        create: { monthKey: MONTH_KEY, startDate: new Date(`${MONTH_START}T00:00:00.000Z`), endDate: new Date(`${MONTH_END}T00:00:00.000Z`), status: "작성중" }
      })
    ).id;
    await cleanupData();

    const course = await (prisma as any).course.upsert({ where: { code: "Q" }, update: { isActive: true }, create: { code: "Q", isActive: true } });
    courseId = course.id;
    const policy = { name: "T1805 Q코스", durationMinutes: 60, basePrice: 1500000, requiresSecondTherapist: false, tvDisplayName: "Q", effectiveToMonth: MONTH_KEY, isActive: true };
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: MONTH_KEY } });
    if (existingPolicy) await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    else await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: MONTH_KEY, ...policy } });

    employees.avail = (await seedTherapist("E2E-T1805-AVAIL", "T1805 체크인", 95502)).id;
    employees.planned = (await seedTherapist("E2E-T1805-PLANNED", "T1805 출근전", 95503)).id;
    employees.dayOff = (await seedTherapist("E2E-T1805-DAYOFF", "T1805 휴무", 95504)).id;
    employees.unscheduled = (await seedTherapist("E2E-T1805-UNSCHED", "T1805 미설정", 95505)).id;
    employees.busy = (await seedTherapist("E2E-T1805-BUSY", "T1805 바쁨", 95506)).id;

    const rate = { amount: 500000, effectiveFromMonth: MONTH_KEY, effectiveToMonth: MONTH_KEY, isActive: true };
    const existingRate = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId: employees.avail, courseId } });
    if (existingRate) await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
    else await (prisma as any).therapistCourseRate.create({ data: { therapistId: employees.avail, courseId, ...rate } });

    // ② 출근·근무표 시나리오는 DATE_AVAIL 하루에만 둔다(D23).
    await checkInTherapist({ operatingMonthId: monthId, serviceDate: DATE_AVAIL, employeeId: employees.avail });
    await checkInTherapist({ operatingMonthId: monthId, serviceDate: DATE_AVAIL, employeeId: employees.busy });
    await setPlanned(employees.planned, DATE_AVAIL, "근무 예정");
    await setPlanned(employees.dayOff, DATE_AVAIL, "휴무");
    // T1805 바쁨은 13:30~14:30(Q코스 60분) 예약이 있어 14:00에는 안 된다.
    const busyCall = await (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: monthId,
        serviceDate: new Date(`${DATE_AVAIL}T00:00:00.000Z`),
        startTime: "13:30",
        courseId,
        customerMemo: "T1805 바쁨 콜",
        status: "RESERVED"
      }
    });
    await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: busyCall.id, assignmentRole: "THERAPIST_1", employeeId: employees.busy } });

    // ③ 일행 저장은 DATE_PARTY에, T1805 체크인은 여기서도 출근해 있다.
    await checkInTherapist({ operatingMonthId: monthId, serviceDate: DATE_PARTY, employeeId: employees.avail });

    // ① 비모달 패널 테스트는 "원장 목록이 그대로 보인다"를 확인하므로, 목록(ol)이 hidden이 되지 않게 콜 1건을 둔다.
    await (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: monthId,
        serviceDate: new Date(`${DATE_PANEL}T00:00:00.000Z`),
        startTime: "11:00",
        courseId,
        customerMemo: "T1805 패널 콜",
        status: "RESERVED"
      }
    });
  });

  test.afterAll(async () => {
    await cleanupData();
    await (prisma as any).therapistCourseRate.deleteMany({ where: { courseId } });
    await (prisma as any).coursePolicy.deleteMany({ where: { courseId } });
    await (prisma as any).course.update({ where: { id: courseId }, data: { isActive: false } });
    await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  for (const width of [1280, 1024]) {
    test(`${width}px: 비모달 옆 패널이라 원장 목록이 그대로 보이고 가로 스크롤이 생기지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await login(page, account.accountId, account.password);
      await openLedger(page, DATE_PANEL);

      const panel = await openQuickBooking(page);
      await expect(page.getByRole("list", { name: "콜 원장 목록" })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await assertNoHorizontalScroll(page);

      await pickGuest(page, panel, { therapistId: null, courseId });
      await goToCustomerStep(panel);
      await expect(page.getByRole("list", { name: "콜 원장 목록" })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await assertNoHorizontalScroll(page);
    });
  }

  test("① 목록은 출근한 사람만 기본으로 보이고, 출근 전 보기는 근무표가 근무 예정인 사람만 더하며, 바쁜 사람은 접어 둔다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    await openLedger(page, DATE_AVAIL);
    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "14:00" });

    // 기본: 출근한 T1805 체크인만 보이고, 출근 전(근무표 근무 예정이든 휴무든 미설정이든)은 보이지 않는다.
    await expect(quickBookingLine(panel, employees.avail)).toBeVisible();
    await expect(quickBookingLine(panel, employees.planned)).toHaveCount(0);
    await expect(quickBookingLine(panel, employees.dayOff)).toHaveCount(0);
    await expect(quickBookingLine(panel, employees.unscheduled)).toHaveCount(0);

    // 바쁜 사람은 접어 둔 "이 시각에 안 되는 N명" 안에서 다음 가능 시각과 함께 보인다.
    const fold = panel.locator("[data-quick-booking-unavailable]");
    await expect(fold.locator("summary")).toHaveText("이 시각에 안 되는 1명");
    await fold.locator("summary").click();
    await expect(quickBookingLine(panel, employees.busy)).toBeVisible();
    await expect(quickBookingLine(panel, employees.busy)).toContainText("14:30부터");

    // 출근 전 보기를 켜면 근무표가 근무 예정인 사람만 더해진다. 휴무·미설정은 그래도 나오지 않는다.
    const showBeforeCheckIn = panel.getByRole("checkbox", { name: "출근 전 보기 (1명)" });
    await expect(showBeforeCheckIn).toBeVisible();
    await showBeforeCheckIn.check();
    await expect(quickBookingLine(panel, employees.planned)).toBeVisible();
    await expect(quickBookingLine(panel, employees.dayOff)).toHaveCount(0);
    await expect(quickBookingLine(panel, employees.unscheduled)).toHaveCount(0);
  });

  test("지명 1명과 미지명 1명을 텔레그램·새 이름으로 저장하면 콜 2건과 새 고객 1명이 생기고, 저장 뒤 새 줄이 열린다", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const bookerName = `${NEW_CUSTOMER_PREFIX} ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await openLedger(page, DATE_PARTY);
    const panel = await openQuickBooking(page);

    await chooseConditions(panel, { time: "13:00", partySize: 2 });
    await pickGuest(page, panel, { therapistId: employees.avail, courseId });
    await pickGuest(page, panel, { therapistId: null, courseId });
    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "텔레그램", bookerName });

    await expect(panel.locator("[data-quick-booking-summary]")).toHaveText(`13:00 · 2명 · T1805 체크인 Q60, 미지명 Q60 · 텔레그램 ${bookerName}`);

    await saveQuickBooking(page, panel);

    const calls = await (prisma as any).serviceCall.findMany({
      where: { operatingMonthId: monthId, serviceDate: new Date(`${DATE_PARTY}T00:00:00.000Z`), customerMemo: bookerName },
      include: { assignments: true },
      orderBy: { partyPosition: "asc" }
    });
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.bookingChannelCode).toBe("TELEGRAM");
      expect(call.bookerName).toBe(bookerName);
      expect(call.customerMemo).toBe(bookerName);
    }
    expect(calls[0].assignments.find((a: { assignmentRole: string }) => a.assignmentRole === "THERAPIST_1")?.employeeId).toBe(employees.avail);
    expect(calls[1].assignments).toHaveLength(0);

    const customers = await (prisma as any).customer.findMany({ where: { name: bookerName } });
    expect(customers).toHaveLength(1);
    expect(calls[0].customerId).toBe(customers[0].id);
    expect(calls[1].customerId).toBeNull();

    // 저장 뒤 새 줄 자동 선택(스펙 D19): 패널은 새 콜의 call 매개변수로 주소를 옮겨 원장을 다시 받고 그 줄을 연다.
    await expect(page).toHaveURL(new RegExp(`call=${calls[0].id}`), { timeout: 10_000 });
  });

  test("이름 없는 워크인은 워크인 N으로 저장되고 고객을 만들지 않는다", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    for (const expectedName of ["워크인 1", "워크인 2"]) {
      // 이 테스트는 저장 뒤 새 줄 자동 선택이 아니라 워크인 번호만 보므로, 매번 원장에 새로 들어가 빈 패널로 시작한다.
      await openLedger(page, DATE_WALKIN);
      const panel = await openQuickBooking(page);
      await pickGuest(page, panel, { therapistId: null, courseId });
      await goToCustomerStep(panel);
      await fillBooking(panel, { channel: "워크인" });
      await saveQuickBooking(page, panel);

      const call = await (prisma as any).serviceCall.findFirst({
        where: { operatingMonthId: monthId, serviceDate: new Date(`${DATE_WALKIN}T00:00:00.000Z`), bookerName: expectedName }
      });
      expect(call).not.toBeNull();
      expect(call.customerMemo).toBe(expectedName);
    }

    expect(await (prisma as any).customer.count({ where: { name: { in: ["워크인 1", "워크인 2"] } } })).toBe(0);
  });

  // 2026-10-23 고객 요청: 예약 경로에 위챗을 더하고, 예약자명 아래 ID / 연락처 칸에 메신저 ID를 적는다. 같은 날 후속 요청으로
  // 전화·워크인도 같은 칸을 보이고 전화 예약은 번호를 적는다. 저장한 값은 원장 줄 고객 칸 둘째 줄에 보인다.
  test("모든 경로에서 예약자명 아래 ID / 연락처 칸이 있고, 전화 예약의 번호와 위챗 ID가 저장되어 원장 줄 고객 칸에 보인다", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    const bookerName = `${NEW_CUSTOMER_PREFIX} 위챗 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);

    // 전화 예약도 같은 칸에 번호를 적어 저장한다.
    await openLedger(page, DATE_HANDLE);
    let panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "13:00" });
    await pickGuest(page, panel, { therapistId: null, courseId });
    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "전화", bookerName: `${bookerName} 전화` });
    const handle = panel.getByLabel("ID / 연락처", { exact: true });
    await handle.fill("+62 811-3116-8866");
    await saveQuickBooking(page, panel);
    const phoneCall = await (prisma as any).serviceCall.findFirst({ where: { operatingMonthId: monthId, bookerName: `${bookerName} 전화` } });
    expect(phoneCall.bookingChannelCode).toBe("PHONE");
    expect(phoneCall.bookerHandle).toBe("+62 811-3116-8866");

    await openLedger(page, DATE_HANDLE);
    panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "14:00" });
    await pickGuest(page, panel, { therapistId: null, courseId });
    await goToCustomerStep(panel);
    // 경로를 고르기 전에도 예약자명 바로 아래에 ID / 연락처 칸이 있다.
    await expect(handle).toBeVisible();
    await fillBooking(panel, { channel: "위챗", bookerName });
    const nameBox = (await panel.getByLabel("예약자명", { exact: true }).boundingBox())!;
    const handleBox = (await handle.boundingBox())!;
    expect(handleBox.y).toBeGreaterThan(nameBox.y + nameBox.height);
    await handle.fill("minsu88");
    await saveQuickBooking(page, panel);

    const call = await (prisma as any).serviceCall.findFirst({ where: { operatingMonthId: monthId, bookerName } });
    expect(call.bookingChannelCode).toBe("WECHAT");
    expect(call.bookerHandle).toBe("minsu88");
    const who = page.locator(`[data-ledger-line][data-service-call-id="${call.id}"] [data-line-cell="who"]`);
    await expect(who).toContainText(bookerName);
    await expect(who).toContainText("minsu88");
    await expect(who.locator('svg[aria-label="위챗"]')).toBeVisible();
  });

  test("담은 손님이 있는 채로 닫으려 하면 안내하고, 취소하면 남고 확정하면 닫히며 포커스가 빠른 예약 버튼으로 돌아온다(열린 동안 머리 버튼은 테두리 버튼)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    await openLedger(page, DATE_CLOSE);
    const trigger = page.locator("[data-quick-booking-trigger]");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toHaveClass(/bg-brand/);
    const panel = await openQuickBooking(page);
    // 화면의 주 버튼은 하나다(design.md). 패널이 보이는 동안 머리 버튼은 테두리 버튼이다.
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).not.toHaveClass(/bg-brand/);

    await pickGuest(page, panel, { therapistId: null, courseId });
    await expect(panel.locator("[data-quick-booking-picked]")).toHaveAttribute("data-quick-booking-picked", "1/1");

    await panel.getByRole("button", { name: "닫기" }).click();
    const confirmDialog = page.getByRole("alertdialog", { name: "저장하지 않은 입력이 있습니다" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "취소" }).click();
    await expect(confirmDialog).toBeHidden();
    await expect(panel).toBeVisible();
    await expect(panel.locator("[data-quick-booking-picked]")).toHaveAttribute("data-quick-booking-picked", "1/1");

    await panel.getByRole("button", { name: "닫기" }).click();
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "나가기" }).click();
    await expect(quickBookingPanel(page)).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toHaveClass(/bg-brand/);
  });

  test("vi 로캘 쿠키에서는 미지명과 ② 예약 경로 그룹 이름이 베트남어로 보인다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    await setLocaleCookie(page, "vi");
    await page.goto(ledgerUrl(DATE_VI));

    await page.locator("[data-quick-booking-trigger]").click();
    const panel = page.getByRole("complementary", { name: "Đặt lịch nhanh" });
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-quick-booking-line="unassigned"]')).toContainText("Chưa chỉ định");

    await panel.locator('[data-quick-booking-line="unassigned"]').locator(`[data-course-id="${courseId}"]`).click();
    await panel.getByRole("button", { name: "Tiếp" }).click();
    // 이날은 출근 기록도 근무표도 없어 남은 자리가 0이다. 남은 자리 확인(1018 티켓 06)을 베트남어 버튼으로 넘긴다.
    await page.getByRole("alertdialog", { name: "Không đủ chỗ. Vẫn đặt lịch?" }).getByRole("button", { name: "Vẫn đặt lịch" }).click();
    await expect(panel.getByRole("group", { name: "Kênh đặt chỗ" })).toBeVisible();
  });
});
