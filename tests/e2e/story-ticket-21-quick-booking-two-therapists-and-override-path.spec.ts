import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { businessTodayIsoDate } from "@/lib/operating-date";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 티켓 21: 빠른 예약에서 두 명 코스의 Therapist 1·2를 고르고, 시간이 겹치거나 수당이 없는 배정은
// "경고 확인 후 배정" 경로로만 받는다(스펙 F01). 티켓 20과 같은 이유로 실제 오늘을 덮는 운영월을 쓴다.
const account = { accountId: "t21_counter", password: "Ticket21!counter", staffCode: "E2E-T21-COUNTER", sortOrder: 92101 };
const today = businessTodayIsoDate();

function currentMonthRange() {
  const [year, month] = today.split("-").map(Number);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { monthKey, startDate: `${monthKey}-01`, endDate: `${monthKey}-${String(lastDay).padStart(2, "0")}` };
}

const { monthKey, startDate, endDate } = currentMonthRange();

let monthId = "";
let roomId = "";
let courseId = "";
let therapist1Id = "";
let therapist2Id = "";
let therapist3NoRateId = "";
let createdMonth = false;

// 직원은 (직군, 정렬 순서)가 유일하다. story-2-1이 같은 92101·92102를 쓰므로 비어 있는 순서를 찾는다.
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

function panel(page: Page) {
  return page.getByRole("dialog", { name: "빠른 예약" });
}

async function openQuickBooking(page: Page, operatingMonthId: string, serviceDate: string) {
  await page.goto(`/calls?operatingMonthId=${operatingMonthId}&serviceDate=${serviceDate}`);
  await page.getByRole("button", { name: "빠른 예약" }).click();
  await expect(panel(page)).toBeVisible();
}

/** Therapist·코스 단계까지 진행하고 "지금"으로 가능 목록을 연다. */
async function goToTherapistStep(page: Page, dialog: ReturnType<typeof panel>, memo: string) {
  await dialog.getByLabel("고객/메모").fill(memo);
  await dialog.getByRole("button", { name: "다음" }).click();
  await dialog.getByRole("button", { name: "지금" }).click();
}

test.describe("티켓 21 빠른 예약: 두 명 코스와 경고 확인 후 배정", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount();
    createdMonth = !(await (prisma as any).operatingMonth.findUnique({ where: { monthKey } }));
    const month = await (prisma as any).operatingMonth.upsert({
      where: { monthKey },
      update: { status: "작성중", startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date(`${endDate}T00:00:00.000Z`) },
      create: {
        monthKey,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        status: "작성중"
      }
    });
    monthId = month.id;
    await cleanup();

    const room = await (prisma as any).room.upsert({
      where: { sortOrder: 92121 },
      update: { displayName: "T21 호실", isActive: true },
      create: { displayName: "T21 호실", migrationReferenceName: "T21-ROOM", sortOrder: 92121, isActive: true }
    });
    roomId = room.id;

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
      return employee.id as string;
    }

    // 둘 다 수당이 있고 비어 있어 서로 "가능" 짝이 된다. 세 번째는 수당이 없어 "이 코스 불가"(rate_missing)다.
    therapist1Id = await seedTherapist("E2E-T21-THR-1", "T21 마사지사1", 92102, true);
    therapist2Id = await seedTherapist("E2E-T21-THR-2", "T21 마사지사2", 92103, true);
    therapist3NoRateId = await seedTherapist("E2E-T21-THR-3", "T21 마사지사3", 92104, false);
  });

  // 테스트마다 같은 두 Therapist·같은 "지금" 슬롯을 쓰므로, 앞 테스트가 만든 콜이 다음 테스트의
  // "가능" 판정을 막지 않게 매 테스트 전에 지운다.
  test.beforeEach(cleanup);

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await (prisma as any).therapistCourseRate.deleteMany({
      where: { therapistId: { in: [therapist1Id, therapist2Id, therapist3NoRateId] }, courseId }
    });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T21 2인", effectiveFromMonth: monthKey } });
    await (prisma as any).room.update({ where: { id: roomId }, data: { isActive: false } });
    if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  test("두 명 코스에서 두 Therapist를 모두 '가능'으로 고르면 둘 다 배정되어 저장된다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const memo = `T21 두명 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await openQuickBooking(page, monthId, today);
    const dialog = panel(page);

    await goToTherapistStep(page, dialog, memo);

    const row1 = dialog.locator("[data-availability-row]").filter({ has: page.getByText("T21 마사지사1", { exact: true }) });
    await row1.getByRole("button", { name: /T21D 90분 가능/ }).click();
    await expect(dialog.getByText("T21 2인 · T21 마사지사1")).toBeVisible();

    // 두 번째 Therapist 영역이 보이고, 이미 고른 첫 번째 Therapist는 후보에서 빠진다.
    const secondHeading = dialog.getByRole("heading", { name: "두 번째 Therapist" });
    await expect(secondHeading).toBeVisible();
    const secondSection = secondHeading.locator("xpath=ancestor::div[1]");
    await expect(secondSection.getByText("T21 마사지사1")).toHaveCount(0);
    await secondSection.getByText("T21 마사지사2").locator("xpath=ancestor::li[1]").getByRole("button", { name: /T21D 90분 가능/ }).click();
    await expect(secondSection.getByText("T21 마사지사2")).toBeVisible();

    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByLabel("객실").selectOption({ label: "T21 호실" });
    await dialog.getByRole("button", { name: "다음" }).click();

    await expect(dialog.getByText("T21 마사지사2", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "예약 저장" }).click();
    await expect(dialog).toBeHidden();

    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: memo } });
    expect(created).toHaveLength(1);
    const assignments = await (prisma as any).serviceCallAssignment.findMany({ where: { serviceCallId: created[0].id } });
    const roles = assignments.map((a: { assignmentRole: string; employeeId: string }) => [a.assignmentRole, a.employeeId]);
    expect(roles).toContainEqual(["THERAPIST_1", therapist1Id]);
    expect(roles).toContainEqual(["THERAPIST_2", therapist2Id]);
  });

  test("두 번째 Therapist를 수당 없는 사람으로 고르면 경고 확인 후 배정 경로로만 받고, 취소하면 배정되지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const memo = `T21 경고배정 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await openQuickBooking(page, monthId, today);
    const dialog = panel(page);

    await goToTherapistStep(page, dialog, memo);

    const row1 = dialog.locator("[data-availability-row]").filter({ has: page.getByText("T21 마사지사1", { exact: true }) });
    await row1.getByRole("button", { name: /T21D 90분 가능/ }).click();

    const secondSection = dialog.getByRole("heading", { name: "두 번째 Therapist" }).locator("xpath=ancestor::div[1]");
    const overrideButton = secondSection
      .getByText("T21 마사지사3")
      .locator("xpath=ancestor::li[1]")
      .getByRole("button", { name: /경고 확인 후 배정/ });
    await expect(overrideButton).toBeVisible();
    // "가능"과는 다른 문구다(가능 버튼이 아니다).
    await expect(overrideButton).not.toHaveText(/^T21D 90분 가능$/);
    await overrideButton.click();

    // 경고 문장을 먼저 보여 준다(스펙 F01). 취소하면 아직 배정되지 않는다.
    const confirmDialog = page.getByRole("alertdialog", { name: "경고를 확인하고 배정하시겠습니까?" });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByText("T21 마사지사3")).toBeVisible();
    await confirmDialog.getByRole("button", { name: "취소" }).click();
    await expect(confirmDialog).toBeHidden();
    await expect(secondSection.getByText("T21 마사지사3", { exact: true })).toBeVisible(); // 후보 목록에 그대로 남아 있다(아직 고르지 않음).

    // 다시 눌러 확인하면 그제서야 배정된다.
    await overrideButton.click();
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "경고 확인 후 배정" }).click();
    await expect(confirmDialog).toBeHidden();

    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByLabel("객실").selectOption({ label: "T21 호실" });
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "예약 저장" }).click();
    await expect(dialog).toBeHidden();

    // 수당이 없어도 서버는 저장한다(경고는 저장을 막지 않는다).
    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: memo } });
    expect(created).toHaveLength(1);
    const assignments = await (prisma as any).serviceCallAssignment.findMany({ where: { serviceCallId: created[0].id } });
    const roles = assignments.map((a: { assignmentRole: string; employeeId: string }) => [a.assignmentRole, a.employeeId]);
    expect(roles).toContainEqual(["THERAPIST_1", therapist1Id]);
    expect(roles).toContainEqual(["THERAPIST_2", therapist3NoRateId]);
  });
});
