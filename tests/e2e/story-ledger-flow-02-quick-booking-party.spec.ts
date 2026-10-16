import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { businessTodayIsoDate } from "@/lib/operating-date";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 콜 원장 흐름 재구성 티켓 02: 빠른 예약에서 인원 수를 받아 손님마다 Therapist·코스·객실을 고르고, 일행 콜 N건을
// 한 번에 만든다(스펙 D10–D13). 티켓 20·21과 같은 이유로 실제 오늘을 덮는 운영월을 쓴다.
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

function panel(page: Page) {
  return page.getByRole("dialog", { name: "빠른 예약" });
}

/** 가능 코스 목록에서 그 Therapist의 줄. has의 안쪽 locator는 줄 안에서 찾으므로 page에서 만든다. */
function availabilityRow(page: Page, name: string) {
  return panel(page).locator("[data-availability-row]").filter({ has: page.getByText(name, { exact: true }) });
}

/** 손님 한 명의 Therapist를 그 사람의 "가능" 칩으로 고른다. */
async function chooseTherapist(page: Page, name: string) {
  await availabilityRow(page, name).getByRole("button", { name: /LF02A 60분 가능/ }).click();
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
    }
  });

  // 두 테스트가 같은 세 Therapist·같은 "지금" 슬롯을 쓰므로, 앞 테스트의 콜이 다음 테스트의 "가능" 판정을 막지 않게 지운다.
  test.beforeEach(cleanup);

  test.afterAll(async () => {
    await cleanup();
    await testEmployees.deactivateAll();
    await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId: { in: therapistIds }, courseId } });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "LF02 1인", effectiveFromMonth: monthKey } });
    await (prisma as any).course.update({ where: { id: courseId }, data: { isActive: false } });
    await (prisma as any).room.update({ where: { id: roomId }, data: { isActive: false } });
    if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  for (const width of [1280, 1024]) {
    test(`${width}px: 3인 일행을 저장하면 원장에 같은 시각·메모, 서로 다른 Therapist의 콜 3건이 생긴다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const memo = `LF02 일행 ${width} ${Date.now().toString(36)}`;
      await login(page, account.accountId, account.password);
      await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${today}`);
      await page.getByRole("button", { name: "빠른 예약" }).click();
      const dialog = panel(page);
      await expect(dialog).toBeVisible();

      await dialog.getByLabel("고객/메모").fill(memo);
      await dialog.getByLabel("인원").selectOption("3");
      await dialog.getByRole("button", { name: "다음" }).click();
      await dialog.getByRole("button", { name: "지금" }).click();
      // 다른 스펙이 오늘 출근을 넣어 두었으면 출근 전인 이 스펙의 Therapist는 숨는다. 함께 보이게 한다.
      const showBeforeCheckIn = dialog.getByRole("checkbox", { name: /출근 전 Therapist/ });
      if (await showBeforeCheckIn.isVisible()) await showBeforeCheckIn.check();

      const guests = dialog.getByRole("group", { name: "일행 손님" });
      await expect(guests.getByRole("button", { name: /^손님 1/ })).toHaveAttribute("aria-pressed", "true");
      await chooseTherapist(page, therapistNames[0]);
      // 한 손님을 고르면 다음 손님으로 넘어가고, 이미 고른 Therapist는 목록에서 빠진다.
      await expect(guests.getByRole("button", { name: /^손님 2/ })).toHaveAttribute("aria-pressed", "true");
      await expect(availabilityRow(page, therapistNames[0])).toHaveCount(0);
      await chooseTherapist(page, therapistNames[1]);
      await expect(guests.getByRole("button", { name: /^손님 3/ })).toHaveAttribute("aria-pressed", "true");
      await chooseTherapist(page, therapistNames[2]);
      await expect(guests.getByRole("button", { name: new RegExp(`^손님 3 · .*LF02 1인 · ${therapistNames[2]}`) })).toBeVisible();

      await dialog.getByRole("button", { name: "다음" }).click();
      await dialog.getByLabel("손님 1 객실").selectOption({ label: "LF02 호실" });
      await dialog.getByRole("button", { name: "다음" }).click();
      await expect(dialog.getByText("3명", { exact: true })).toBeVisible();
      await expect(dialog.getByText(new RegExp(`LF02 1인 · ${therapistNames[1]} .* · 미배정$`))).toBeVisible();
      await dialog.getByRole("button", { name: "예약 저장" }).click();
      await expect(dialog).toBeHidden();

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
      expect(created.map((call: { roomId: string | null }) => call.roomId)).toEqual([roomId, null, null]);
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
