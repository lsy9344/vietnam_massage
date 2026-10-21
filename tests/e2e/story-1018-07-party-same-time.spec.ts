import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { checkInTherapist, chooseConditions, goToCustomerStep, pickGuest, quickBookingPanel, saveQuickBooking } from "./support/quick-booking";

// 1018 티켓 07: 일행은 같은 예약 시각인 콜만이다(스펙 D29). "1명 추가"에서 시각을 바꾸면 일행이 아닌 별도 예약으로 저장하고
// 예약 경로·예약자명만 이어받는다. 별도 예약의 고객은 보통 예약과 같다(D21–D22). 원장은 같은 시각의 같은 일행 id만 묶는다.
// 먼 뒤 날짜를 써서 자동 청소 중(D14)이 끼어들지 않고, 만든 운영월·정책·고객은 afterAll에서 지운다.
const account = { accountId: "t1807_counter", password: "Ticket1807!counter", staffCode: "E2E-T1807-OPS", sortOrder: 97701 };
const MONTH_KEY = "2041-05";
const MONTH_START = "2041-05-01";
const MONTH_END = "2041-05-31";
const SERVICE_DATE = "2041-05-07";
const BOOKER = "T1807 정 대표";

let monthId = "";
let courseId = "";
let customerId = "";
const therapists = { first: "", second: "", added: "" };
const jung = { partyId: "t1807-party-jung", ids: [] as string[] };
const park = { partyId: "t1807-party-park", memo: "T1807 박 대표", ids: [] as string[] };

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, sortOrder: number) {
  return testEmployees.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, isActive: true, sortOrder },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position: employeeGroup === "THERAPIST" ? "마사지사" : "카운터",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

async function createPartyCall(input: {
  partyId: string;
  position: number;
  startTime: string;
  customerMemo: string;
  bookingChannelCode?: string;
  bookerName?: string;
  customerId?: string;
  therapistId?: string;
}) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${SERVICE_DATE}T00:00:00.000Z`),
      startTime: input.startTime,
      courseId,
      customerMemo: input.customerMemo,
      bookingChannelCode: input.bookingChannelCode ?? null,
      bookerName: input.bookerName ?? null,
      customerId: input.customerId ?? null,
      status: "RESERVED",
      partyId: input.partyId,
      partyPosition: input.position
    }
  });
  if (input.therapistId) {
    await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId } });
  }
  return call.id as string;
}

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
  await (prisma as any).customer.deleteMany({ where: { name: BOOKER } });
}

function line(page: Page, callId: string) {
  return page.locator(`[data-ledger-line][data-service-call-id="${callId}"]`);
}

function partyHead(page: Page, partyId: string) {
  return page.locator(`[data-ledger-party="${partyId}"][data-ledger-party-part="open"]`);
}

async function openLedger(page: Page) {
  await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${SERVICE_DATE}`);
  await expect(page.getByRole("list", { name: "콜 원장 목록" })).toBeVisible();
}

test.describe("1018 티켓 07: 일행은 같은 시각만", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const operations = await seedEmployee(account.staffCode, "T1807 카운터", "OPERATIONS", account.sortOrder);
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

    monthId = (
      await (prisma as any).operatingMonth.upsert({
        where: { monthKey: MONTH_KEY },
        update: { status: "작성중" },
        create: { monthKey: MONTH_KEY, startDate: new Date(`${MONTH_START}T00:00:00.000Z`), endDate: new Date(`${MONTH_END}T00:00:00.000Z`), status: "작성중" }
      })
    ).id;
    await cleanupData();

    courseId = (await (prisma as any).course.upsert({ where: { code: "T1807" }, update: { isActive: true }, create: { code: "T1807", isActive: true } })).id;
    const policy = { name: "T1807 코스", durationMinutes: 60, basePrice: 1500000, requiresSecondTherapist: false, tvDisplayName: "T1807", effectiveToMonth: MONTH_KEY, isActive: true };
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: MONTH_KEY } });
    if (existingPolicy) await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    else await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: MONTH_KEY, ...policy } });

    therapists.first = (await seedEmployee("E2E-T1807-THR-1", "T1807 마사지사1", "THERAPIST", 97702)).id;
    therapists.second = (await seedEmployee("E2E-T1807-THR-2", "T1807 마사지사2", "THERAPIST", 97703)).id;
    therapists.added = (await seedEmployee("E2E-T1807-THR-3", "T1807 마사지사3", "THERAPIST", 97704)).id;
    for (const therapistId of Object.values(therapists)) {
      const rate = { amount: 500000, effectiveFromMonth: MONTH_KEY, effectiveToMonth: MONTH_KEY, isActive: true };
      const existingRate = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId, courseId } });
      if (existingRate) await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
      else await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, ...rate } });
    }
    // Therapist 줄은 그날 출근 기록이 있는 사람만 기본으로 보인다(스펙 D23).
    await checkInTherapist({ operatingMonthId: monthId, serviceDate: SERVICE_DATE, employeeId: therapists.added });

    // 정 대표 일행 2명(11:00): 텔레그램으로 들어온 예약. 고객은 대표 콜(1번)에만 이어져 있다(ADR 0007).
    customerId = (await (prisma as any).customer.create({ data: { name: BOOKER } })).id;
    jung.ids = [];
    for (const [index, therapistId] of [therapists.first, therapists.second].entries()) {
      jung.ids.push(
        await createPartyCall({
          partyId: jung.partyId,
          position: index + 1,
          startTime: "11:00",
          customerMemo: BOOKER,
          bookingChannelCode: "TELEGRAM",
          bookerName: BOOKER,
          customerId: index === 0 ? customerId : undefined,
          therapistId
        })
      );
    }
    // 박 대표 일행: 옛 "1명 추가"가 시각을 바꿔도 붙였던 데이터. 11:00에 두 명, 12:00에 세 번째 손님.
    park.ids = [];
    for (const [index, startTime] of ["11:00", "11:00", "12:00"].entries()) {
      park.ids.push(await createPartyCall({ partyId: park.partyId, position: index + 1, startTime, customerMemo: park.memo }));
    }
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

  test("원장은 같은 시각의 같은 일행 id만 일행으로 묶고, 시각이 다른 손님은 일행이 아닌 줄로 보인다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);

    await expect(partyHead(page, park.partyId)).toHaveCount(1);
    await expect(partyHead(page, park.partyId)).toContainText("T1807 박 대표 일행 2명");
    await expect(line(page, park.ids[1])).toContainText("일행 2/2");
    const apart = line(page, park.ids[2]);
    await expect(apart).toBeVisible();
    await expect(apart).not.toHaveAttribute("data-ledger-party-member", /.*/);
    await expect(apart).not.toContainText("일행 3/");
  });

  test("1명 추가에서 시각을 바꾸면 별도 예약으로 저장하고 예약 경로·예약자명만 이어받으며, 고객은 같은 이름 후보에서 잇는다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);

    await partyHead(page, jung.partyId).getByRole("button", { name: `${BOOKER} 일행 2명에 1명 추가` }).click();
    const panel = quickBookingPanel(page);
    await expect(panel.locator(`[data-quick-booking-join-party="${jung.partyId}"]`)).toContainText(`${BOOKER} 일행(2명)에 1명을 더합니다`);

    await chooseConditions(panel, { time: "12:00" });
    await expect(panel.locator(`[data-quick-booking-join-party]`)).toHaveCount(0);
    await expect(panel.locator("[data-quick-booking-separate-booking]")).toContainText("시각이 일행과 달라 별도 예약으로 저장합니다");

    await pickGuest(page, panel, { therapistId: therapists.added, courseId });
    await goToCustomerStep(panel);
    await expect(panel.getByRole("group", { name: "예약 경로" }).getByRole("button", { name: "텔레그램", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByLabel("예약자명", { exact: true })).toHaveValue(BOOKER);
    // 별도 예약은 보통 예약처럼 같은 이름 고객이 후보로 보인다. 고르지 않으면 예약자명으로 새 고객을 만드므로 그 고객을 고른다.
    await panel.locator(`[data-booker-candidate="${customerId}"]`).click();
    await saveQuickBooking(page, panel);

    const added = await (prisma as any).serviceCall.findFirst({ where: { operatingMonthId: monthId, startTime: "12:00", partyId: null } });
    expect(added).not.toBeNull();
    expect([added.bookingChannelCode, added.bookerName, added.customerMemo, added.customerId]).toEqual(["TELEGRAM", BOOKER, BOOKER, customerId]);
    expect(await (prisma as any).serviceCall.count({ where: { partyId: jung.partyId } })).toBe(2);
    expect(await (prisma as any).customer.count({ where: { name: BOOKER } })).toBe(1);

    // 저장 뒤 자동 새로고침은 운영 빌드에서 늦을 때가 있어 다시 불러와 본다.
    await page.reload();
    await expect(partyHead(page, jung.partyId)).toContainText(`${BOOKER} 일행 2명`);
    await expect(line(page, added.id)).toContainText(BOOKER);
    await expect(line(page, added.id)).not.toHaveAttribute("data-ledger-party-member", /.*/);
  });
});
