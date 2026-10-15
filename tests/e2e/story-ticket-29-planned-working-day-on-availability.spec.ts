import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { businessTodayIsoDate } from "@/lib/operating-date";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";

/**
 * 티켓 29: 가능 코스에 근무 예정 표시(F02, 스토리 12–13, 60, 104, V07). 가능 코스 행의 근무 예정 값
 * 자체는 service-call-service.test.ts(메모리 Prisma)가 확인했으므로, 여기서는 실제 화면(빠른 예약의
 * Therapist·코스 단계, 두 Therapist 모두)과 두 언어 문구, 그리고 휴무여도 저장이 막히지 않는 것을 확인한다.
 */
const account = { accountId: "t29_counter", password: "Ticket29!counter", staffCode: "E2E-T29-COUNTER", sortOrder: 92901 };
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
let createdMonth = false;

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

async function cleanupCalls() {
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
}

async function setSchedule(employeeId: string, status: "근무 예정" | "휴무" | null) {
  const workDate = new Date(`${today}T00:00:00.000Z`);
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

function panel(page: Page) {
  return page.getByRole("dialog", { name: /빠른 예약|Đặt lịch nhanh/ });
}

async function openQuickBooking(page: Page, operatingMonthId: string, serviceDate: string) {
  await page.goto(`/calls?operatingMonthId=${operatingMonthId}&serviceDate=${serviceDate}`);
  await page.getByRole("button", { name: /빠른 예약|Đặt lịch nhanh/ }).click();
  await expect(panel(page)).toBeVisible();
}

/** Therapist·코스 단계까지 진행하고 "지금"(또는 vi "Ngay bây giờ")으로 가능 목록을 연다. */
async function goToTherapistStep(page: Page, dialog: ReturnType<typeof panel>, memo: string) {
  await dialog.getByLabel(/고객\/메모|Khách\/Ghi chú/).fill(memo);
  await dialog.getByRole("button", { name: /^(다음|Tiếp)$/ }).click();
  await dialog.getByRole("button", { name: /지금|Ngay bây giờ/ }).click();
}

test.describe("티켓 29 가능 코스의 근무 예정 표시", () => {
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
    await cleanupCalls();

    const room = await (prisma as any).room.upsert({
      where: { sortOrder: 92901 },
      update: { displayName: "T29 호실", isActive: true },
      create: { displayName: "T29 호실", migrationReferenceName: "T29-ROOM", sortOrder: 92901, isActive: true }
    });
    roomId = room.id;

    const course = await (prisma as any).course.upsert({ where: { code: "T29D" }, update: { isActive: true }, create: { code: "T29D", isActive: true } });
    courseId = course.id;
    const policy = {
      name: "T29 2인",
      durationMinutes: 90,
      basePrice: 3200000,
      opsCallCredit: 1,
      earcarePoolAmount: 0,
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

    // 둘 다 수당이 있고 비어 있어 서로 "가능" 짝이 된다. 근무표 상태만 다르다.
    therapist1Id = await seedTherapist("E2E-T29-THR-1", "T29 마사지사1", 92902);
    therapist2Id = await seedTherapist("E2E-T29-THR-2", "T29 마사지사2", 92903);
  });

  test.beforeEach(async () => {
    await cleanupCalls();
    await setSchedule(therapist1Id, "휴무");
    await setSchedule(therapist2Id, "근무 예정");
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanupCalls();
    await setSchedule(therapist1Id, null);
    await setSchedule(therapist2Id, null);
    await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId: { in: [therapist1Id, therapist2Id] }, courseId } });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T29 2인", effectiveFromMonth: monthKey } });
    await (prisma as any).room.update({ where: { id: roomId }, data: { isActive: false } });
    if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  test("휴무인 첫 Therapist도 코스 버튼이 그대로 보이고, 근무 예정인 두 번째 Therapist도 가능 코스 목록에 근무 예정이 함께 보이며, 둘 다 배정해도 저장이 막히지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const memo = `T29 휴무도 저장 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await openQuickBooking(page, monthId, today);
    const dialog = panel(page);

    await goToTherapistStep(page, dialog, memo);

    // 첫 Therapist 표: 휴무인 마사지사1도 "근무표" 칸에 휴무가 보이고, 코스 버튼은 꺼지지 않는다.
    const row1 = dialog.getByRole("rowheader", { name: "T29 마사지사1", exact: true }).locator("xpath=ancestor::tr[1]");
    await expect(row1.getByText("휴무", { exact: true })).toBeVisible();
    await row1.getByRole("button", { name: /T29D 90분 가능/ }).click();
    await expect(dialog.getByText("T29 2인 · T29 마사지사1")).toBeVisible();

    // 두 번째 Therapist 후보 목록: 근무 예정인 마사지사2가 그 값과 함께 보인다.
    const secondHeading = dialog.getByRole("heading", { name: "두 번째 Therapist" });
    await expect(secondHeading).toBeVisible();
    const secondSection = secondHeading.locator("xpath=ancestor::div[1]");
    const candidate2 = secondSection.getByText("T29 마사지사2").locator("xpath=ancestor::li[1]");
    await expect(candidate2.getByText("근무 예정", { exact: false })).toBeVisible();
    await candidate2.getByRole("button", { name: /T29D 90분 가능/ }).click();
    await expect(secondSection.getByText("T29 마사지사2")).toBeVisible();

    // 근무 예정은 보장이 아니라는 안내가 패널에 함께 있다.
    await expect(dialog.getByText("근무표의 근무 예정은 그 시각까지 근무한다는 보장이 아닙니다.")).toBeVisible();

    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByLabel("객실").selectOption({ label: "T29 호실" });
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "예약 저장" }).click();
    await expect(dialog).toBeHidden();

    // 두 사람 중 한 명이 휴무라도 저장은 그대로 된다(근무표는 읽기만 한다).
    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: memo } });
    expect(created).toHaveLength(1);
    const assignments = await (prisma as any).serviceCallAssignment.findMany({ where: { serviceCallId: created[0].id } });
    const roles = assignments.map((a: { assignmentRole: string; employeeId: string }) => [a.assignmentRole, a.employeeId]);
    expect(roles).toContainEqual(["THERAPIST_1", therapist1Id]);
    expect(roles).toContainEqual(["THERAPIST_2", therapist2Id]);
  });

  test("베트남어 화면에서는 근무표 칸 제목과 상태, 보장이 아니라는 안내가 번역된다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await setLocaleCookie(page, "vi");
    await openQuickBooking(page, monthId, today);
    const dialog = panel(page);

    await goToTherapistStep(page, dialog, `T29 vi ${Date.now().toString(36)}`);

    await expect(dialog.getByText("Lịch làm việc", { exact: true })).toBeVisible();
    const row1 = dialog.getByRole("rowheader", { name: "T29 마사지사1", exact: true }).locator("xpath=ancestor::tr[1]");
    await expect(row1.getByText("Nghỉ", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Dự kiến làm việc trong lịch không đảm bảo có mặt đến giờ đó.")).toBeVisible();
  });
});
