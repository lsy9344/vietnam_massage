import { testEmployees } from "./support/test-employees";
import { pickListboxOptionByValue } from "./support/listbox-select";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import {
  checkInTherapist,
  chooseConditions,
  fillBooking,
  openQuickBooking,
  quickBookingLine,
  quickBookingPanel,
  saveQuickBooking,
  SEAT_SHORTAGE_DIALOG
} from "./support/quick-booking";

// 1018 티켓 06: 근무표의 출근 예정 시각(스펙 D28)과 빠른 예약 ①의 남은 자리(D24–D27).
// 자리 계산 규칙(고객 예시, D코스, 90분 걸침, 배정 전환)은 seat-capacity.test.ts와 service-call-service.test.ts가 본다.
// 여기서는 화면 흐름을 본다. 근무표를 고치려면 정산 권한이, 원장을 보려면 원장 권한이 있어야 해서 관리자 계정을 쓴다.
// 다른 스펙이 시간 슬롯 순서를 옮겨 영업 마감이 16:00이 될 수 있으니 12:00–13:00만 쓴다.
const account = { accountId: "t1806_admin", password: "Ticket1806!admin", staffCode: "E2E-T1806-ADMIN", sortOrder: 97601 };
const MONTH_KEY = "2041-03";
const MONTH_START = "2041-03-01";
const MONTH_END = "2041-03-31";
const DATE_PLANNED = "2041-03-06";
const DATE_SEATS = "2041-03-13";
const BOOKER = "T1806 손님";

let monthId = "";
let courseId = "";
let unassignedCallId = "";
const employees = { early: "", together: "", evening: "" };

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, sortOrder: number) {
  return testEmployees.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, isActive: true },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position: employeeGroup === "THERAPIST" ? "마사지사" : "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

async function seedAccount() {
  const operations = await seedEmployee(account.staffCode, "T1806 관리자", "OPERATIONS", account.sortOrder);
  const data = {
    email: `${account.accountId}@example.local`,
    passwordHash: await hash(account.password, argon2idOptions),
    role: "administrator",
    employeeId: operations.id,
    isActive: true,
    lockedUntil: null,
    failedLoginCount: 0
  };
  await (prisma as any).userAccount.upsert({ where: { accountId: account.accountId }, update: data, create: { ...data, accountId: account.accountId } });
}

/** 정리: 이 스펙이 만든 콜·출근·근무표·고객을 지운다. 반복 실행해도 깨끗해야 한다. */
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
    where: {
      employeeId: { in: Object.values(employees).filter(Boolean) },
      workDate: { gte: new Date(`${MONTH_START}T00:00:00.000Z`), lte: new Date(`${MONTH_END}T00:00:00.000Z`) }
    }
  });
  await (prisma as any).customer.deleteMany({ where: { name: BOOKER } });
}

const ledgerUrl = (date: string) => `/calls?operatingMonthId=${monthId}&serviceDate=${date}`;

function chip(page: Page, therapistId: string | null) {
  return quickBookingLine(quickBookingPanel(page), therapistId).locator(`[data-course-id="${courseId}"]`);
}

test.describe("1018 티켓 06: 미지명 자리와 근무표 출근 예정 시각", () => {
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

    const course = await (prisma as any).course.upsert({ where: { code: "T1806" }, update: { isActive: true }, create: { code: "T1806", isActive: true } });
    courseId = course.id;
    const policy = { name: "T1806 코스", durationMinutes: 60, basePrice: 1500000, requiresSecondTherapist: false, tvDisplayName: "T1806", effectiveToMonth: MONTH_KEY, isActive: true };
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: MONTH_KEY } });
    if (existingPolicy) await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    else await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: MONTH_KEY, ...policy } });

    employees.early = (await seedEmployee("E2E-T1806-EARLY", "T1806 일찍", "THERAPIST", 97602)).id;
    employees.together = (await seedEmployee("E2E-T1806-TOGETHER", "T1806 함께", "THERAPIST", 97603)).id;
    employees.evening = (await seedEmployee("E2E-T1806-EVENING", "T1806 늦게", "THERAPIST", 97604)).id;
    await cleanupData();
    for (const therapistId of Object.values(employees)) {
      const rate = { amount: 500000, effectiveFromMonth: MONTH_KEY, effectiveToMonth: MONTH_KEY, isActive: true };
      const existingRate = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId, courseId } });
      if (existingRate) await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
      else await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, ...rate } });
    }

    // 남은 자리 날: 두 사람이 출근해 자리가 2개이고, 12:00에 미지명 예약 하나가 한 자리를 잡는다.
    await checkInTherapist({ operatingMonthId: monthId, serviceDate: DATE_SEATS, employeeId: employees.early });
    await checkInTherapist({ operatingMonthId: monthId, serviceDate: DATE_SEATS, employeeId: employees.together });
    const unassigned = await (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: monthId,
        serviceDate: new Date(`${DATE_SEATS}T00:00:00.000Z`),
        startTime: "12:00",
        courseId,
        customerMemo: "T1806 미지명 예약",
        status: "RESERVED"
      }
    });
    unassignedCallId = unassigned.id;
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

  test("근무표에 적은 출근 예정 시각이 현황 줄에 보이고, 빠른 예약은 그 시각 전을 비는 시간으로 보지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);

    await page.goto(`/settlements/schedule?date=${DATE_PLANNED}`);
    await expect(page.getByRole("heading", { name: "근무표" })).toBeVisible();
    const row = page.getByRole("row").filter({ has: page.getByText("E2E-T1806-EVENING", { exact: true }) });
    await row.getByRole("button", { name: /T1806 늦게/ }).click();
    const dayForm = page.getByRole("complementary").locator("form").filter({ hasText: DATE_PLANNED.slice(5) });
    const startTime = dayForm.getByLabel(`T1806 늦게의 ${DATE_PLANNED} 출근 예정 시각`);
    // 근무 예정이 아니면 시각을 적을 수 없다.
    await expect(startTime).toBeDisabled();
    await pickListboxOptionByValue(dayForm.getByRole("combobox"), "근무 예정");
    await startTime.fill("13:00");
    await dayForm.getByRole("button", { name: "저장" }).click();
    await expect(dayForm).toContainText("저장됨");
    const stored = await (prisma as any).plannedWorkingDay.findFirst({
      where: { employeeId: employees.evening, workDate: new Date(`${DATE_PLANNED}T00:00:00.000Z`) }
    });
    expect(stored).toMatchObject({ planStatus: "근무 예정", plannedStartTime: "13:00" });
    await page.reload();
    await expect(page.getByRole("row").filter({ has: page.getByText("E2E-T1806-EVENING", { exact: true }) })).toContainText("13:00");

    await page.goto(ledgerUrl(DATE_PLANNED));
    const card = page.locator(`[data-therapist-status="${employees.evening}"]`);
    await expect(card).toHaveAttribute("data-therapist-status-state", "before_check_in");
    await expect(card).toContainText("출근 전");
    await expect(card).toContainText("13:00");

    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "12:00" });
    await panel.getByLabel(/출근 전 보기/).check();
    await panel.locator("[data-quick-booking-unavailable] > summary").click();
    await expect(quickBookingLine(panel, employees.evening)).toContainText("13:00부터");
    await expect(chip(page, employees.evening)).toHaveAttribute("aria-label", /불가/);

    await chooseConditions(panel, { time: "13:00" });
    await expect(chip(page, employees.evening)).toHaveAttribute("aria-label", "T1806 늦게 T180660 담기");
  });

  test("미지명 콜에 원장 Therapist 칸에서 배정해도 남은 자리는 두 번 빠지지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    await page.goto(ledgerUrl(DATE_SEATS));

    let panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "12:00" });
    await expect(panel.locator("[data-quick-booking-seats]")).toHaveText("12:00 남은 자리 1 / 2");
    // 시각을 바꾼 초안이라 닫을 때 떠나기 확인을 거친다.
    await panel.getByRole("button", { name: "닫기" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "나가기" }).click();
    await expect(quickBookingPanel(page)).toBeHidden();

    const ledgerLine = page.locator(`[data-ledger-line][data-service-call-id="${unassignedCallId}"]`);
    await ledgerLine.getByRole("button", { name: "12:00 콜 Therapist 고르기" }).click();
    await page.getByRole("listbox", { name: "12:00 콜 Therapist 고르기" }).getByRole("option", { name: /T1806 함께/ }).click();
    await expect
      .poll(async () => (await (prisma as any).serviceCallAssignment.findMany({ where: { serviceCallId: unassignedCallId } })).map((a: { employeeId: string }) => a.employeeId))
      .toEqual([employees.together]);

    panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "12:00" });
    await expect(panel.locator("[data-quick-booking-seats]")).toHaveText("12:00 남은 자리 1 / 2");
    // 배정받은 사람은 12:00에 바쁘니 접어 둔 "안 되는 N명"으로 간다.
    await expect(panel.locator("[data-quick-booking-unavailable]").locator(`[data-quick-booking-line="${employees.together}"]`)).toHaveCount(1);
  });

  test("담은 손님이 남은 자리를 넘으면 경고가 보이고, ② 고객으로 넘어가려면 그래도 예약을 눌러야 한다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    await page.goto(ledgerUrl(DATE_SEATS));

    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "12:00", partySize: 2 });
    await expect(panel.locator("[data-quick-booking-seats]")).toHaveText("12:00 남은 자리 1 / 2");

    // 남은 자리 1에 미지명 한 명은 경고가 없다. 지명 줄도 막지 않아, 두 번째 손님을 담으면 경고가 보인다.
    await chip(page, null).click();
    await expect(panel.locator("[data-quick-booking-seat-shortage]")).toHaveCount(0);
    await chip(page, employees.early).click();
    await expect(panel.locator("[data-quick-booking-picked]")).toHaveAttribute("data-quick-booking-picked", "2/2");
    await expect(panel.locator("[data-quick-booking-seat-shortage]")).toContainText("자리가 모자랍니다: 12:00 남은 자리 1, 담은 손님 2자리");

    // ②로 넘어가려 하면 확인 창이 뜨고, 취소하면 ①에 남는다.
    const seatDialog = page.getByRole("alertdialog", { name: SEAT_SHORTAGE_DIALOG });
    await panel.getByRole("button", { name: "다음", exact: true }).click();
    await expect(seatDialog).toContainText("12:00에 남은 자리는 1인데 담은 손님은 2자리가 필요합니다.");
    await seatDialog.getByRole("button", { name: "취소" }).click();
    await expect(seatDialog).toBeHidden();
    await expect(panel.getByRole("group", { name: "예약 경로" })).toHaveCount(0);

    await panel.getByRole("button", { name: "다음", exact: true }).click();
    await seatDialog.getByRole("button", { name: "그래도 예약" }).click();
    await expect(panel.getByRole("group", { name: "예약 경로" })).toBeVisible();
    await fillBooking(panel, { channel: "전화", bookerName: BOOKER });
    await saveQuickBooking(page, panel);

    const created = await (prisma as any).serviceCall.findMany({
      where: { operatingMonthId: monthId, serviceDate: new Date(`${DATE_SEATS}T00:00:00.000Z`), startTime: "12:00", NOT: { id: unassignedCallId } },
      include: { assignments: true }
    });
    expect(created).toHaveLength(2);
    expect(created.map((call: { assignments: Array<{ employeeId: string }> }) => call.assignments.map((a) => a.employeeId)).sort()).toEqual([[], [employees.early]].sort());
  });
});
