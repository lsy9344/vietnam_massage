import { testEmployees } from "./support/test-employees";
import { openListbox, pickListboxOptionByValue } from "./support/listbox-select";
import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
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

// 티켓 21: 빠른 예약에서 두 명 코스의 Therapist 1·2를 고르고, 시간이 겹치거나 수당이 없는 배정은 "경고 확인 후
// 배정" 경로로만 받는다(스펙 F01, 1018 스펙 D20). 5단계 모달의 객실·확인 단계는 없어져 옆 패널 2단계로 다시
// 쓴다. 과거(지금)에 매달린 이유가 없어 먼 미래 날짜를 써 다른 스펙과 간섭하지 않는다. 같은 Therapist를 90분
// 코스로 여러 테스트가 쓰므로, 테스트마다 앞 테스트의 콜을 지워 겹치지 않게 한다. 스토리 2-6이 16:00 슬롯을 맨
// 뒤 순서로 옮겨 두면 영업 마감이 16:00이 되어 늦은 시각의 90분 코스는 "비어 있지 않음"이 되므로 이른 시각만 쓴다.
const account = { accountId: "t21_counter", password: "Ticket21!counter", staffCode: "E2E-T21-COUNTER", sortOrder: 92101 };
const monthKey = "2040-11";
const serviceDate = "2040-11-18";

let monthId = "";
let courseId = "";
let therapist1Id = "";
let therapist2Id = "";
let therapist3NoRateId = "";

// 직원은 (직군, 정렬 순서)가 유일하다. 다른 스펙과 겹치지 않게 비어 있는 순서를 찾는다.
async function freeEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;
  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({ where: { employeeGroup, sortOrder, NOT: { staffCode } }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }
  throw new Error(`No Ticket 21 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedAccount() {
  const employee = await testEmployees.upsert({
    where: { staffCode: account.staffCode },
    update: { displayName: "T21 카운터", employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: account.staffCode,
      displayName: "T21 카운터",
      employeeGroup: "OPERATIONS",
      position: "카운터",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await freeEmployeeSortOrder("OPERATIONS", account.staffCode, account.sortOrder),
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

test.describe("티켓 21 빠른 예약: 두 명 코스와 경고 확인 후 배정", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount();
    const month = await (prisma as any).operatingMonth.upsert({
      where: { monthKey },
      update: { status: "작성중" },
      create: {
        monthKey,
        startDate: new Date(`${monthKey}-01T00:00:00.000Z`),
        endDate: new Date(`${monthKey}-30T00:00:00.000Z`),
        status: "작성중"
      }
    });
    monthId = month.id;
    await cleanup();

    const course = await (prisma as any).course.upsert({ where: { code: "T21D" }, update: { isActive: true }, create: { code: "T21D", isActive: true } });
    courseId = course.id;
    const policy = {
      name: "T21 2인",
      durationMinutes: 90,
      basePrice: 3200000,
      requiresSecondTherapist: true,
      tvDisplayName: "T21D",
      effectiveToMonth: monthKey,
      isActive: true
    };
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...policy } });
    }

    async function seedTherapist(staffCode: string, displayName: string, sortOrder: number, withRate: boolean) {
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
          sortOrder: await freeEmployeeSortOrder("THERAPIST", staffCode, sortOrder),
          isActive: true
        }
      });
      if (withRate) {
        const existingRate = await (prisma as any).therapistCourseRate.findFirst({
          where: { therapistId: employee.id, courseId, effectiveFromMonth: monthKey }
        });
        const rate = { amount: 900000, effectiveToMonth: monthKey, isActive: true };
        if (existingRate) {
          await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
        } else {
          await (prisma as any).therapistCourseRate.create({ data: { therapistId: employee.id, courseId, effectiveFromMonth: monthKey, ...rate } });
        }
      } else {
        await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId: employee.id, courseId } });
      }
      // Therapist 줄은 그날 출근 기록이 있는 사람만 기본으로 보인다(1018 스펙 D23).
      await checkInTherapist({ operatingMonthId: monthId, serviceDate, employeeId: employee.id });
      return employee.id as string;
    }

    // 1·2는 수당이 있고 비어 있어 서로 "가능" 짝이 된다. 3은 수당이 없어 "이 코스 불가"(rate_missing)다.
    therapist1Id = await seedTherapist("E2E-T21-THR-1", "T21 마사지사1", 92102, true);
    therapist2Id = await seedTherapist("E2E-T21-THR-2", "T21 마사지사2", 92103, true);
    therapist3NoRateId = await seedTherapist("E2E-T21-THR-3", "T21 마사지사3", 92104, false);
  });

  test.beforeEach(async () => {
    await cleanup();
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await (prisma as any).therapistCourseRate.deleteMany({
      where: { therapistId: { in: [therapist1Id, therapist2Id, therapist3NoRateId] }, courseId }
    });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T21 2인", effectiveFromMonth: monthKey } });
    await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: monthId } });
    await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  test("두 명 코스에서 두 Therapist를 모두 '가능'으로 고르면 둘 다 배정되어 저장된다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const name = `T21 두명 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "11:00" });

    await expect(quickBookingLine(panel, therapist1Id)).toBeVisible({ timeout: 10_000 });
    await pickGuest(page, panel, { therapistId: therapist1Id, courseId });
    const guest = panel.locator('[data-quick-booking-guest="1"]');
    await expect(guest).toContainText("T21 마사지사1 T21D90");

    // 두 번째 Therapist 선택이 보이고, 이미 고른 첫 번째 Therapist는 후보에서 빠진다.
    const secondSelect = guest.getByLabel("두 번째 Therapist");
    await expect(secondSelect).toBeVisible();
    const secondListbox = await openListbox(secondSelect);
    await expect(secondListbox.getByRole("option", { name: "T21 마사지사1" })).toHaveCount(0);
    await secondListbox.getByRole("option", { name: "T21 마사지사2" }).click();
    await expect(guest).toContainText("+ T21 마사지사2");

    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "전화", bookerName: name });
    await saveQuickBooking(page, panel);

    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: name } });
    expect(created).toHaveLength(1);
    const assignments = await (prisma as any).serviceCallAssignment.findMany({ where: { serviceCallId: created[0].id } });
    const roles = assignments.map((a: { assignmentRole: string; employeeId: string }) => [a.assignmentRole, a.employeeId]);
    expect(roles).toContainEqual(["THERAPIST_1", therapist1Id]);
    expect(roles).toContainEqual(["THERAPIST_2", therapist2Id]);
  });

  test("두 번째 Therapist로 수당 없는 사람을 고르면 경고 확인 후 배정 경로로만 받고, 취소하면 배정되지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const name = `T21 경고배정 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "13:00" });

    await expect(quickBookingLine(panel, therapist1Id)).toBeVisible({ timeout: 10_000 });
    await pickGuest(page, panel, { therapistId: therapist1Id, courseId });
    const guest = panel.locator('[data-quick-booking-guest="1"]');
    const secondSelect = guest.getByLabel("두 번째 Therapist");
    await expect(secondSelect).toBeVisible();
    // 수당 없는 후보는 선택지에 "불가" 표시와 함께 들어 있다.
    const secondListbox = await openListbox(secondSelect);
    await expect(secondListbox.getByRole("option", { name: "T21 마사지사3 · 불가" })).toHaveCount(1);
    await secondListbox.getByRole("option", { name: "T21 마사지사3 · 불가" }).click();

    const confirmDialog = page.getByRole("alertdialog", { name: "경고를 확인하고 배정하시겠습니까?" });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText("T21 마사지사3");
    await confirmDialog.getByRole("button", { name: "취소" }).click();
    await expect(confirmDialog).toBeHidden();
    // 취소하면 아직 배정되지 않아 선택 칸이 비어 있는 채로 남는다.
    await expect(secondSelect).toContainText("두 번째 Therapist를 고르세요.");

    // 다시 골라 확인하면 그제서야 배정된다.
    await pickListboxOptionByValue(secondSelect, therapist3NoRateId);
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "경고 확인 후 배정" }).click();
    await expect(confirmDialog).toBeHidden();
    await expect(secondSelect).toContainText("T21 마사지사3");

    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "전화", bookerName: name });
    await saveQuickBooking(page, panel);

    // 수당이 없어도 서버는 저장한다(경고는 저장을 막지 않는다).
    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: name } });
    expect(created).toHaveLength(1);
    const assignments = await (prisma as any).serviceCallAssignment.findMany({ where: { serviceCallId: created[0].id } });
    const roles = assignments.map((a: { assignmentRole: string; employeeId: string }) => [a.assignmentRole, a.employeeId]);
    expect(roles).toContainEqual(["THERAPIST_1", therapist1Id]);
    expect(roles).toContainEqual(["THERAPIST_2", therapist3NoRateId]);
  });

  test("불가 칩은 눌러도 바로 담기지 않고, 경고를 확인해야 첫 Therapist로 담기며, 취소하면 담기지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const name = `T21 첫담기경고 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "11:00" });

    const chip = quickBookingLine(panel, therapist3NoRateId).locator(`[data-course-id="${courseId}"]`);
    await expect(chip).toBeVisible({ timeout: 10_000 });
    await expect(chip).toHaveAttribute("aria-label", /불가, 경고 확인 후 담기/);

    const confirmDialog = page.getByRole("alertdialog", { name: "경고를 확인하고 배정하시겠습니까?" });
    await chip.click();
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText("T21 마사지사3");
    await confirmDialog.getByRole("button", { name: "취소" }).click();
    await expect(confirmDialog).toBeHidden();
    await expect(panel.locator("[data-quick-booking-picked]")).toHaveAttribute("data-quick-booking-picked", "0/1");

    await pickGuest(page, panel, { therapistId: therapist3NoRateId, courseId, confirmWarning: true });
    const guest = panel.locator('[data-quick-booking-guest="1"]');
    await expect(guest).toContainText("T21 마사지사3 T21D90");

    await chooseSecondTherapist(panel, 1, therapist1Id);
    await expect(guest).toContainText("+ T21 마사지사1");

    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "전화", bookerName: name });
    await saveQuickBooking(page, panel);

    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: name } });
    expect(created).toHaveLength(1);
    const assignments = await (prisma as any).serviceCallAssignment.findMany({ where: { serviceCallId: created[0].id } });
    const roles = assignments.map((a: { assignmentRole: string; employeeId: string }) => [a.assignmentRole, a.employeeId]);
    expect(roles).toContainEqual(["THERAPIST_1", therapist3NoRateId]);
    expect(roles).toContainEqual(["THERAPIST_2", therapist1Id]);
  });
});
