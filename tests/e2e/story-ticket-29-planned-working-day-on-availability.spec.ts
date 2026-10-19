import { testEmployees } from "./support/test-employees";
import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";
import {
  checkInTherapist,
  chooseConditions,
  chooseSecondTherapist,
  fillBooking,
  goToCustomerStep,
  openQuickBooking,
  pickGuest,
  quickBookingLine,
  saveQuickBooking
} from "./support/quick-booking";

/**
 * 티켓 29: 가능 코스에 근무 예정 표시(스펙 D23, 스토리 12–13, 60, 104, V07). 빠른 예약 ①의 Therapist 목록은
 * 그날 출근 기록이 있는 사람이 기본이고, "출근 전 보기"를 켜면 근무표가 근무 예정인데 아직 출근하지 않은
 * 사람만 더 보인다. 근무표가 없거나 휴무인 사람은 켜도 나오지 않는다. 그 사람을 담아 저장해도 막히지 않는다.
 * 콜 원장 흐름 재구성(티켓 01)부터 가능 코스는 Therapist 한 줄이라, 줄 안에 근무표 칸은 따로 없다 —
 * "출근 전" 꼬리표와 "출근 전 보기" 토글이 근무표 신호가 보이는 유일한 자리다.
 */
const account = { accountId: "t29_counter", password: "Ticket29!counter", staffCode: "E2E-T29-COUNTER", sortOrder: 92901 };
const monthKey = "2040-12";
const serviceDate = "2040-12-11";

let monthId = "";
let courseId = "";
let therapist1Id = ""; // 휴무, 출근 전
let therapist2Id = ""; // 근무 예정, 출근 전
let therapist3Id = ""; // 출근함

async function seedAccount() {
  const employee = await testEmployees.upsert({
    where: { staffCode: account.staffCode },
    update: { displayName: "T29 카운터", employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: account.staffCode,
      displayName: "T29 카운터",
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
}

async function setSchedule(employeeId: string, status: "근무 예정" | "휴무" | null) {
  const workDate = new Date(`${serviceDate}T00:00:00.000Z`);
  if (status === null) {
    await (prisma as any).plannedWorkingDay.deleteMany({ where: { employeeId, workDate } });
    return;
  }
  await (prisma as any).plannedWorkingDay.upsert({
    where: { employeeId_workDate: { employeeId, workDate } },
    update: { planStatus: status },
    create: { employeeId, workDate, planStatus: status }
  });
}

test.describe("티켓 29 가능 코스의 근무 예정 표시", () => {
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

    const course = await (prisma as any).course.upsert({ where: { code: "T29D" }, update: { isActive: true }, create: { code: "T29D", isActive: true } });
    courseId = course.id;
    const policy = {
      name: "T29 2인",
      durationMinutes: 90,
      basePrice: 3200000,
      requiresSecondTherapist: true,
      tvDisplayName: "T29D",
      effectiveToMonth: monthKey,
      isActive: true
    };
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...policy } });
    }

    async function seedTherapist(staffCode: string, displayName: string, sortOrder: number) {
      const employee = await testEmployees.upsert({
        where: { staffCode },
        update: { displayName, employeeGroup: "THERAPIST", isActive: true },
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
      const existingRate = await (prisma as any).therapistCourseRate.findFirst({
        where: { therapistId: employee.id, courseId, effectiveFromMonth: monthKey }
      });
      const rate = { amount: 900000, effectiveToMonth: monthKey, isActive: true };
      if (existingRate) {
        await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
      } else {
        await (prisma as any).therapistCourseRate.create({ data: { therapistId: employee.id, courseId, effectiveFromMonth: monthKey, ...rate } });
      }
      return employee.id as string;
    }

    // 셋 다 수당이 있고 비어 있어 서로 "가능" 짝이 된다. 출근 기록·근무표 상태만 다르다.
    therapist1Id = await seedTherapist("E2E-T29-THR-1", "T29 마사지사1", 92902);
    therapist2Id = await seedTherapist("E2E-T29-THR-2", "T29 마사지사2", 92903);
    therapist3Id = await seedTherapist("E2E-T29-THR-3", "T29 마사지사3", 92904);
    await setSchedule(therapist1Id, "휴무");
    await setSchedule(therapist2Id, "근무 예정");
    await checkInTherapist({ operatingMonthId: monthId, serviceDate, employeeId: therapist3Id });
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await setSchedule(therapist1Id, null);
    await setSchedule(therapist2Id, null);
    await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId: { in: [therapist1Id, therapist2Id, therapist3Id] }, courseId } });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T29 2인", effectiveFromMonth: monthKey } });
    await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: monthId } });
    await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  test("휴무인 Therapist는 출근 전 보기를 켜도 보이지 않고, 근무 예정인 Therapist는 켜야 보이며 담아 저장해도 막히지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const name = `T29 출근전 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "11:00" });

    await expect(quickBookingLine(panel, therapist3Id)).toBeVisible({ timeout: 10_000 });
    await expect(quickBookingLine(panel, therapist1Id)).toHaveCount(0);
    await expect(quickBookingLine(panel, therapist2Id)).toHaveCount(0);
    // 안 되는 사람도 없어 "이 시각에 안 되는 N명" 접기 자체가 없다.
    await expect(panel.locator("[data-quick-booking-unavailable]")).toHaveCount(0);

    const showBeforeCheckIn = panel.getByRole("checkbox", { name: "출근 전 보기 (1명)" });
    await expect(showBeforeCheckIn).toBeVisible();
    await showBeforeCheckIn.check();

    // 휴무인 Therapist는 토글을 켜도 여전히 나오지 않는다.
    await expect(quickBookingLine(panel, therapist1Id)).toHaveCount(0);
    const line2 = quickBookingLine(panel, therapist2Id);
    await expect(line2).toBeVisible();
    await expect(line2).toContainText("출근 전");
    await expect(panel.locator("[data-quick-booking-unavailable]")).toHaveCount(0);

    await pickGuest(page, panel, { therapistId: therapist2Id, courseId });
    const guest = panel.locator('[data-quick-booking-guest="1"]');
    await expect(guest).toContainText("T29 마사지사2 T29D90");
    await chooseSecondTherapist(panel, 1, therapist3Id);
    await expect(guest).toContainText("+ T29 마사지사3");

    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "전화", bookerName: name });
    await saveQuickBooking(page, panel);

    // 출근 전이어도(근무표만 근무 예정) 저장은 그대로 된다.
    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: name } });
    expect(created).toHaveLength(1);
    const assignments = await (prisma as any).serviceCallAssignment.findMany({ where: { serviceCallId: created[0].id } });
    const roles = assignments.map((a: { assignmentRole: string; employeeId: string }) => [a.assignmentRole, a.employeeId]);
    expect(roles).toContainEqual(["THERAPIST_1", therapist2Id]);
    expect(roles).toContainEqual(["THERAPIST_2", therapist3Id]);
  });

  test("베트남어 화면에서도 출근 전 보기 문구와 꼬리표가 번역되고, 휴무인 Therapist는 보이지 않는다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await setLocaleCookie(page, "vi");
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    // 지원 헬퍼의 openQuickBooking/quickBookingPanel은 패널 이름을 "빠른 예약"(한국어)으로만 찾아, vi 로캘에서는
    // 패널이 "Đặt lịch nhanh"로 보여 찾지 못한다. 트리거는 data 속성(로캘 무관)으로 누르고, 패널은 두 언어 중
    // 하나로 찾는다.
    await page.locator("[data-quick-booking-trigger]").click();
    const panel = page.getByRole("complementary", { name: /빠른 예약|Đặt lịch nhanh/ });
    await expect(panel).toBeVisible();
    await chooseConditions(panel, { time: "13:00" });

    await expect(quickBookingLine(panel, therapist1Id)).toHaveCount(0);
    const showBeforeCheckIn = panel.getByRole("checkbox", { name: "Xem người chưa vào ca (1 người)" });
    await expect(showBeforeCheckIn).toBeVisible();
    await showBeforeCheckIn.check();
    await expect(quickBookingLine(panel, therapist1Id)).toHaveCount(0);

    const line2 = quickBookingLine(panel, therapist2Id);
    await expect(line2).toBeVisible();
    await expect(line2).toContainText("Chưa vào ca");
    await expect(line2.locator(`[data-course-id="${courseId}"]`)).toHaveText("T29D90");
  });
});
