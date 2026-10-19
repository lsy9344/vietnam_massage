import { testEmployees } from "./support/test-employees";
import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { businessTodayIsoDate } from "@/lib/operating-date";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { checkInTherapist, goToCustomerStep, openQuickBooking, pickGuest, quickBookingLine, saveQuickBooking } from "./support/quick-booking";

// 콜 원장 흐름 재구성 티켓 02: 빠른 예약 ①에서 인원 수를 받아 코스 칩으로 손님마다 Therapist를 담고, 일행 콜 N건을
// 한 번에 만든다(스펙 D10–D13, 1018 스펙 D19–D20). 티켓 20·21과 같은 이유로 실제 오늘을 덮는 운영월을 쓴다. 객실은
// 더 이상 빠른 예약에서 고르지 않는다(1018 스펙 D19) — 원장의 객실 칸에서 나중에 고른다.
const account = { accountId: "lf02_counter", password: "LedgerFlow02!counter", staffCode: "E2E-LF02-COUNTER", sortOrder: 96201 };
const today = businessTodayIsoDate();

function currentMonthRange() {
  const [year, month] = today.split("-").map(Number);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { monthKey, startDate: `${monthKey}-01`, endDate: `${monthKey}-${String(lastDay).padStart(2, "0")}` };
}

const { monthKey, startDate, endDate } = currentMonthRange();
const therapistNames = ["LF02 마사지사1", "LF02 마사지사2", "LF02 마사지사3"];

let monthId = "";
let roomId = "";
let courseId = "";
let therapistIds: string[] = [];
let createdMonth = false;

// 직원은 (직군, 정렬 순서)가 유일하다. 다른 스펙과 겹치지 않게 비어 있는 순서를 찾는다.
async function freeEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;
  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({ where: { employeeGroup, sortOrder, NOT: { staffCode } }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }
  throw new Error(`No ledger-flow 02 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedAccount() {
  const employee = await testEmployees.upsert({
    where: { staffCode: account.staffCode },
    update: { displayName: "LF02 카운터", employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: account.staffCode,
      displayName: "LF02 카운터",
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

/** 이 스펙의 Therapist가 맡은 콜만 지운다. 같은 운영월의 다른 스펙 콜은 건드리지 않는다. */
async function cleanup() {
  if (therapistIds.length === 0) return;
  const assignments = await (prisma as any).serviceCallAssignment.findMany({
    where: { employeeId: { in: therapistIds } },
    select: { serviceCallId: true }
  });
  const ids = [...new Set(assignments.map((assignment: { serviceCallId: string }) => assignment.serviceCallId))];
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
}

test.describe("콜 원장 흐름 티켓 02 빠른 예약: 일행 예약", () => {
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

    const room = await (prisma as any).room.upsert({
      where: { sortOrder: 96221 },
      update: { displayName: "LF02 호실", isActive: true },
      create: { displayName: "LF02 호실", migrationReferenceName: "LF02-ROOM", sortOrder: 96221, isActive: true }
    });
    roomId = room.id;

    const course = await (prisma as any).course.upsert({ where: { code: "LF02A" }, update: { isActive: true }, create: { code: "LF02A", isActive: true } });
    courseId = course.id;
    const policy = {
      name: "LF02 1인",
      durationMinutes: 60,
      basePrice: 1500000,
      requiresSecondTherapist: false,
      tvDisplayName: "LF02A",
      effectiveToMonth: monthKey,
      isActive: true
    };
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...policy } });
    }

    therapistIds = [];
    for (const [index, displayName] of therapistNames.entries()) {
      const staffCode = `E2E-LF02-THR-${index + 1}`;
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
          sortOrder: await freeEmployeeSortOrder("THERAPIST", staffCode, 96202 + index),
          isActive: true
        }
      });
      const rate = { amount: 500000, effectiveToMonth: monthKey, isActive: true };
      const existingRate = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId: employee.id, courseId, effectiveFromMonth: monthKey } });
      if (existingRate) {
        await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
      } else {
        await (prisma as any).therapistCourseRate.create({ data: { therapistId: employee.id, courseId, effectiveFromMonth: monthKey, ...rate } });
      }
      therapistIds.push(employee.id);
      // Therapist 줄은 그날 출근 기록이 있는 사람만 기본으로 보인다(1018 스펙 D23).
      await checkInTherapist({ operatingMonthId: monthId, serviceDate: today, employeeId: employee.id });
    }
  });

  // 두 테스트가 같은 세 Therapist·같은 "지금" 슬롯을 쓰므로, 앞 테스트의 콜이 다음 테스트의 "가능" 판정을 막지 않게 지운다.
  test.beforeEach(cleanup);

  test.afterAll(async () => {
    await cleanup();
    await testEmployees.deactivateAll();
    await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId: { in: therapistIds }, courseId } });
    // 출근 기록(checkInTherapist)이 운영월을 참조하므로 운영월을 지우기 전에 먼저 지운다(1018 스펙 D23).
    await (prisma as any).therapistAttendance.deleteMany({ where: { employeeId: { in: therapistIds } } });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "LF02 1인", effectiveFromMonth: monthKey } });
    await (prisma as any).course.update({ where: { id: courseId }, data: { isActive: false } });
    await (prisma as any).room.update({ where: { id: roomId }, data: { isActive: false } });
    // 예약자명을 적으면 저장할 때 새 고객이 자동으로 생긴다(1018 스펙 D22). 이 스펙이 만든 고객만 지운다.
    await (prisma as any).customer.deleteMany({ where: { name: { startsWith: "LF02 일행" } } });
    if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  for (const width of [1280, 1024]) {
    test(`${width}px: 3인 일행을 저장하면 원장에 같은 시각·메모, 서로 다른 Therapist의 콜 3건이 생긴다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const memo = `LF02 일행 ${width} ${Date.now().toString(36)}`;
      await login(page, account.accountId, account.password);
      await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${today}`);

      // ①: 인원 3명을 고르고 "지금"으로 시각을 채운 뒤, 세 Therapist의 코스 칩을 눌러 손님을 담는다(1018 스펙 D19–D20).
      // "인원" select는 <option> 텍스트가 겹쳐 helper의 getByLabel(exact)이 못 찾는다(아래 보고 참고). 느슨한 매칭으로 고른다.
      const panel = await openQuickBooking(page);
      await panel.getByLabel("인원").selectOption("3");
      await panel.getByRole("button", { name: "지금" }).click();

      await pickGuest(page, panel, { therapistId: therapistIds[0], courseId });
      // 담은 Therapist는 목록에서 빠지지 않고 "담음" 표시로 남아, 두 번째 손님에게 다시 고르지 못한다.
      await expect(quickBookingLine(panel, therapistIds[0])).toContainText("담음");
      await pickGuest(page, panel, { therapistId: therapistIds[1], courseId });
      await pickGuest(page, panel, { therapistId: therapistIds[2], courseId });
      await expect(panel.locator("[data-quick-booking-guest]")).toHaveCount(3);
      await expect(panel.getByText(new RegExp(`손님 3 · ${therapistNames[2]}`))).toBeVisible();

      // ②: 예약자명을 적으면 저장할 때 그 이름의 고객 기록이 생기고, 같은 이름이 고객/메모에도 들어간다(1018 스펙 D21–D22).
      await goToCustomerStep(panel);
      await panel.getByLabel("예약자명", { exact: true }).fill(memo);
      await saveQuickBooking(page, panel);

      const created = await (prisma as any).serviceCall.findMany({
        where: { customerMemo: memo },
        include: { assignments: true },
        orderBy: { partyPosition: "asc" }
      });
      expect(created).toHaveLength(3);
      expect(new Set(created.map((call: { startTime: string }) => call.startTime)).size).toBe(1);
      expect(new Set(created.map((call: { partyId: string | null }) => call.partyId)).size).toBe(1);
      expect(created[0].partyId).toBeTruthy();
      expect(created.map((call: { partyPosition: number }) => call.partyPosition)).toEqual([1, 2, 3]);
      // 객실은 더 이상 빠른 예약에서 고르지 않는다(1018 스펙 D19). 세 콜 모두 객실이 비어 있다.
      expect(created.map((call: { roomId: string | null }) => call.roomId)).toEqual([null, null, null]);
      expect(
        created.map((call: { assignments: Array<{ assignmentRole: string; employeeId: string }> }) =>
          call.assignments.find((assignment) => assignment.assignmentRole === "THERAPIST_1")?.employeeId
        )
      ).toEqual(therapistIds);

      // 원장에 세 콜이 모두 보인다. 저장 뒤 자동 새로고침은 운영 빌드에서 늦을 때가 있어 다시 불러와 본다.
      await page.reload();
      for (const call of created) {
        await expect(page.locator(`[data-service-call-id="${call.id}"]`).first()).toBeAttached();
      }
    });
  }
});
