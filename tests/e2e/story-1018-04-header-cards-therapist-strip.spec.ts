import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { quickBookingLine, quickBookingPanel } from "./support/quick-booking";
import { pickListboxOptionByValue } from "./support/listbox-select";

// 1018 티켓 04: 원장 머리의 상태 카드 7개, Therapist 현황 줄(대상·숫자·정렬·빠른 예약·걸러 보기·접기 기억·미지명),
// 하루 수납 화면에는 누구에게도 이번 달 숫자가 없다. 지금 상태(지금 가능/사용 중)의 시각 계산은 단위 테스트가 보고, 여기서는
// 출근 기록으로 정해지는 출근 전·퇴근과 화면 동작을 본다. 먼 뒤 날짜라 자동 청소 중이 끼어들지 않는다.
const accounts = {
  counter: { accountId: "t1018_04_counter", password: "Ticket1018-04!counter", role: "counter" },
  admin: { accountId: "t1018_04_admin", password: "Ticket1018-04!admin", role: "administrator" }
} as const;
const monthKey = "2041-03";
const serviceDate = "2041-03-14";
const policyName = "T1018-04 A";
const monthOnlyExpense = 123457;

let monthId = "";
const therapists = { one: "", two: "", three: "", four: "", five: "" };
const callIds = { oneReserved: "", unassigned: "" };

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, sortOrder: number) {
  return testEmployees.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, isActive: true, sortOrder },
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

async function seedAccount(account: (typeof accounts)[keyof typeof accounts], employeeId: string) {
  const data = {
    email: `${account.accountId}@example.local`,
    passwordHash: await hash(account.password, argon2idOptions),
    role: account.role,
    employeeId,
    isActive: true,
    lockedUntil: null,
    failedLoginCount: 0
  };
  await (prisma as any).userAccount.upsert({ where: { accountId: account.accountId }, update: data, create: { ...data, accountId: account.accountId } });
}

async function createCall(input: { courseId: string; therapistId: string | null; status: string; startTime: string; actualEntryTime?: string; actualEndTime?: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      actualEntryTime: input.actualEntryTime ?? null,
      actualEndTime: input.actualEndTime ?? null,
      courseId: input.courseId,
      customerMemo: `T1018-04 ${input.startTime} 손님`,
      status: input.status
    }
  });
  if (input.therapistId) {
    await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId } });
  }
  return call.id as string;
}

async function checkIn(employeeId: string, checkOutMinute: number | null) {
  await (prisma as any).therapistAttendance.create({
    data: {
      operatingMonthId: monthId,
      attendanceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      employeeId,
      checkInMinute: 600,
      checkOutMinute,
      // 퇴근 방식 CHECK 제약(check_out_minute IS NULL = check_out_method IS NULL, 티켓 04)을 맞춘다.
      checkOutMethod: checkOutMinute === null ? null : "대리 입력",
      isFullAttendanceRecognized: false
    }
  });
}

async function cleanup() {
  if (!monthId) return;
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
  await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: monthId } });
  await (prisma as any).dailyExpense.deleteMany({ where: { operatingMonthId: monthId } });
  await (prisma as any).plannedWorkingDay.deleteMany({ where: { workDate: new Date(`${serviceDate}T00:00:00.000Z`) } });
}

const ledgerUrl = () => `/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`;

async function openLedger(page: Page) {
  await page.goto(ledgerUrl());
  await expect(page.getByRole("list", { name: "콜 원장 목록" })).toBeVisible();
}

function strip(page: Page) {
  return page.getByRole("region", { name: "Therapist 현황" });
}

function card(page: Page, therapistId: string) {
  return strip(page).locator(`[data-therapist-status="${therapistId}"]`);
}

async function stripOrder(page: Page) {
  return strip(page).locator("[data-therapist-status]").evaluateAll((items) => items.map((item) => item.getAttribute("data-therapist-status")));
}

test.describe("1018 티켓 04: 상태 카드와 Therapist 현황 줄, 하루 수납은 오늘 숫자만", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const operations = await seedEmployee("E2E-T1018-04-OPS", "T04 운영", "OPERATIONS", 96401);
    await seedAccount(accounts.counter, operations.id);
    await seedAccount(accounts.admin, (await seedEmployee("E2E-T1018-04-ADMIN", "T04 관리", "OPERATIONS", 96402)).id);

    monthId = (
      await (prisma as any).operatingMonth.upsert({
        where: { monthKey },
        update: { status: "작성중" },
        create: { monthKey, startDate: new Date(`${monthKey}-01T00:00:00.000Z`), endDate: new Date(`${monthKey}-31T00:00:00.000Z`), status: "작성중" }
      })
    ).id;
    await cleanup();

    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    const policy = { name: policyName, durationMinutes: 60, basePrice: 1500000, requiresSecondTherapist: false, tvDisplayName: policyName, effectiveToMonth: monthKey, isActive: true };
    const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
    if (existing) await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data: policy });
    else await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policy } });
    for (const [value, sortOrder] of [["11:00", 96411], ["12:00", 96412], ["16:00", 96416], ["18:00", 96418]] as const) {
      await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
    }

    // 이름이 번호다. 직원 정렬 순서는 번호순과 일부러 다르게 둔다.
    therapists.one = (await seedEmployee("E2E-T1018-04-THR-1", "T04 1", "THERAPIST", 96415)).id;
    therapists.two = (await seedEmployee("E2E-T1018-04-THR-2", "T04 2", "THERAPIST", 96411)).id;
    therapists.three = (await seedEmployee("E2E-T1018-04-THR-3", "T04 3", "THERAPIST", 96412)).id;
    therapists.four = (await seedEmployee("E2E-T1018-04-THR-4", "T04 4", "THERAPIST", 96413)).id;
    therapists.five = (await seedEmployee("E2E-T1018-04-THR-5", "T04 5", "THERAPIST", 96414)).id;
    await checkIn(therapists.one, null);
    await checkIn(therapists.two, null);
    await checkIn(therapists.five, 900);
    // 3은 근무표에 18:00 출근 예정, 4는 근무표도 출근도 콜도 없다(줄에 없다).
    await (prisma as any).plannedWorkingDay.create({
      data: { employeeId: therapists.three, workDate: new Date(`${serviceDate}T00:00:00.000Z`), planStatus: "근무 예정", plannedStartTime: "18:00" }
    });

    const base = { courseId: course.id };
    await createCall({ ...base, therapistId: therapists.one, status: "VISIT_COMPLETE", startTime: "11:00", actualEntryTime: "11:00", actualEndTime: "12:00" });
    await createCall({ ...base, therapistId: therapists.one, status: "CLEANING", startTime: "12:00", actualEntryTime: "12:00", actualEndTime: "13:00" });
    callIds.oneReserved = await createCall({ ...base, therapistId: therapists.one, status: "RESERVED", startTime: "16:00" });
    await createCall({ ...base, therapistId: therapists.five, status: "VISIT_COMPLETE", startTime: "11:00", actualEntryTime: "11:00", actualEndTime: "12:00" });
    callIds.unassigned = await createCall({ ...base, therapistId: null, status: "RESERVED", startTime: "18:00" });
    // 그 달 다른 날의 현금 지출. 이번 달 시재에만 들어가는 알아보기 쉬운 숫자다.
    await (prisma as any).dailyExpense.create({
      data: { operatingMonthId: monthId, expenseDate: new Date(`${monthKey}-13T00:00:00.000Z`), amount: monthOnlyExpense, description: "T1018-04 지난날 지출", method: "cash", handledByEmployeeId: operations.id }
    });
  });

  test.afterAll(async () => {
    await cleanup();
    await (prisma as any).coursePolicy.deleteMany({ where: { name: policyName } });
    await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("상태 카드 7개가 한 줄에 놓이고 전체 숫자가 가장 크다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await openLedger(page);

    const cards = page.getByRole("list", { name: "상태별 건수" }).getByRole("listitem");
    await expect(cards).toHaveCount(7);
    await expect(cards.nth(0)).toHaveText(/전체\s*5건/);
    await expect(cards.nth(1)).toHaveText(/예약\s*2건/);
    await expect(cards.nth(3)).toHaveText(/청소중\s*1건/);
    await expect(cards.nth(4)).toHaveText(/방문완료\s*2건/);
    const tops = await cards.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    const sizes = await cards.evaluateAll((items) => items.map((item) => parseFloat(getComputedStyle(item.lastElementChild as Element).fontSize)));
    expect(Math.max(...sizes.slice(1))).toBeLessThan(sizes[0]);
  });

  test("현황 줄은 출근·근무 예정·콜 있는 퇴근자를 보이고, 숫자·지금 상태·출근 예정 시각과 끝의 미지명을 보인다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await openLedger(page);

    // 기본은 지금 가능 순이다. 먼 뒤 날짜라 출근한 1·2는 첫 시각 기준이고, 출근 전(3)·퇴근(5)이 뒤에 온다.
    await expect(strip(page).getByLabel("정렬")).toContainText("지금 가능 순");
    expect(await stripOrder(page)).toEqual([therapists.two, therapists.one, therapists.three, therapists.five]);
    await expect(card(page, therapists.four)).toHaveCount(0);

    // 완료는 청소중·방문완료, 예약은 남은 예약이다.
    await expect(card(page, therapists.one)).toContainText("완료 2 · 예약 1");
    await expect(card(page, therapists.three)).toContainText("출근 전");
    await expect(card(page, therapists.three)).toContainText("18:00");
    await expect(card(page, therapists.five)).toHaveAttribute("data-therapist-status-state", "checked_out");
    await expect(card(page, therapists.five)).toContainText("퇴근");
    await expect(strip(page).locator("li").last()).toHaveText("미지명 1");
    await expect(strip(page)).not.toContainText(/객실|청소/);

    await pickListboxOptionByValue(strip(page).getByLabel("정렬"), "number");
    expect(await stripOrder(page)).toEqual([therapists.one, therapists.two, therapists.three, therapists.five]);
    await pickListboxOptionByValue(strip(page).getByLabel("정렬"), "finished");
    expect(await stripOrder(page)).toEqual([therapists.two, therapists.three, therapists.five, therapists.one]);
  });

  // 1018 티켓 05: 5단계 모달의 "Therapist·코스" 단계 대신 2단계(조건 → 고객)다. 현황 줄 카드는
  // ①의 Therapist 목록 맨 위에 그 Therapist를 aria-current="true"로 미리 고르고, 손님으로는 담지 않는다.
  test("카드를 누르면 그 Therapist를 미리 고른 빠른 예약이 열리고, 머리 버튼은 빈 예약으로 연다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await openLedger(page);

    await card(page, therapists.one).locator("[data-therapist-status-book]").click();
    const panel = quickBookingPanel(page);
    await expect(panel).toBeVisible();
    // ①에서 바로 열리고, 그 Therapist 줄이 맨 위에 미리 고른 채(가능 코스를 불러 둔다) 보인다.
    await expect(quickBookingLine(panel, therapists.one)).toHaveAttribute("aria-current", "true");

    // 고친 것이 없으니 묻지 않고 닫힌다. 머리 버튼으로 다시 열면 미리 고른 Therapist가 남지 않는다.
    await panel.getByRole("button", { name: "닫기" }).click();
    await expect(panel).toBeHidden();
    // 빠른 예약 버튼은 상태 카드 줄 오른쪽에 있다(2026-10-22 고객 요청).
    await page.locator("[data-quick-booking-trigger]").click();
    await expect(panel).toBeVisible();
    await expect(quickBookingLine(panel, therapists.one)).not.toHaveAttribute("aria-current", "true");
  });

  test("카드의 콜만 버튼은 원장을 그 Therapist의 콜만 보이게 거르고, 모두 보기로 되돌린다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await openLedger(page);
    const lineOf = (callId: string) => page.locator(`[data-ledger-line][data-service-call-id="${callId}"]`);
    await expect(lineOf(callIds.unassigned)).toBeVisible();

    await card(page, therapists.one).getByRole("button", { name: "T04 1 콜만 보기" }).click();
    await expect(page).toHaveURL(new RegExp(`therapist=${therapists.one}`));
    await expect(card(page, therapists.one).getByRole("button", { name: "T04 1 콜만 보기" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("T04 1 콜만 보는 중")).toBeVisible();
    // 다른 Therapist의 콜은 빼지 않고 숨긴다(줄의 저장 상태가 남는다). 완료 접기는 그 Therapist의 완료 콜만 센다.
    await expect(lineOf(callIds.unassigned)).toBeHidden();
    await expect(lineOf(callIds.unassigned)).toHaveCount(1);
    await expect(lineOf(callIds.oneReserved)).toBeVisible();
    await expect(page.locator("[data-ledger-done-toggle]")).toContainText("1");

    await page.getByRole("button", { name: "모두 보기" }).click();
    await expect(page).not.toHaveURL(/therapist=/);
    await expect(lineOf(callIds.unassigned)).toBeVisible();
    await expect(page.locator("[data-ledger-done-toggle]")).toContainText("2");
  });

  test("현황 줄을 접으면 기기에 기억해 다시 열어도 접혀 있다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await openLedger(page);

    await strip(page).getByRole("button", { name: "현황 접기" }).click();
    await expect(card(page, therapists.one)).toHaveCount(0);
    await openLedger(page);
    await expect(strip(page).getByRole("button", { name: "현황 펼치기" })).toHaveAttribute("aria-expanded", "false");
    await expect(card(page, therapists.one)).toHaveCount(0);

    await strip(page).getByRole("button", { name: "현황 펼치기" }).click();
    await expect(card(page, therapists.one)).toBeVisible();
    await openLedger(page);
    await expect(card(page, therapists.one)).toBeVisible();
  });

  test("휴대폰 폭에서도 카드와 현황 줄이 화면을 옆으로 밀지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await openLedger(page);
    await expect(strip(page)).toBeVisible();
    await expect(page.getByRole("list", { name: "상태별 건수" }).getByRole("listitem")).toHaveCount(7);
    const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  });

  // 1018 스펙 D18(2026-10-19 고침): 월간 숫자는 마감·보고 화면에서 본다. 관리자에게도 하루 수납 화면에는 오늘만 보인다.
  test("하루 수납 화면은 카운터에게도 관리자에게도 이번 달 숫자를 보내지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const cashbookUrl = `${ledgerUrl()}&tab=cashbook`;

    for (const account of [accounts.counter, accounts.admin]) {
      await page.context().clearCookies();
      await login(page, account.accountId, account.password);
      await page.goto(cashbookUrl);
      await expect(page.getByLabel("하루 수납 요약")).toBeVisible();
      await expect(page.getByRole("table", { name: "시재" })).toContainText("오늘");
      await expect(page.locator("main")).not.toContainText("이번 달");
      // 화면에서 숨긴 것이 아니라 서버가 보내지 않는다. 받은 HTML(RSC 데이터 포함)에 그 달 숫자가 없다.
      const html = await page.content();
      expect(html, account.role).not.toContain("123,457");
      expect(html, account.role).not.toContain(String(monthOnlyExpense));
    }

    // 운영월 누적 시재는 관리자의 마감 화면에 그대로 남는다(ADR 0002).
    await page.goto(`/closing?operatingMonthId=${monthId}`);
    await expect(page.locator("main")).toContainText("123,457");
  });
});
