import { expect, test, type Page } from "@playwright/test";
import { prisma } from "./support/db";
import { login } from "./support/auth";
import { clockCodeMinuteNow, computeClockInCode, deriveClockCodeDaySecretHex } from "@/modules/therapists/therapist-clock-code";
import { expectTherapistCenterPopup } from "./support/therapist-popup";

/**
 * 티켓 05: 출근 코드와 직접 출퇴근(스펙 D13–D15, D28, M4, M11, M23).
 *
 * 매장 화면(TV)과 Therapist 화면은 서로 다른 세션(컨텍스트)이라 TV에서 읽은 코드를 Therapist 쪽에
 * 그대로 입력해 서버가 같은 값으로 검증하는지 본다. 지금 시각(Asia/Ho_Chi_Minh)의 달력월에 운영월이
 * 없으면 출근 코드 서비스가 OPERATING_MONTH_NOT_FOUND를 내므로, 그 달의 운영월을 먼저 만든다.
 *
 * 시드 Therapist 계정은 01이 scripts/seed-dev-accounts.ts에 이미 둔 공용 계정(accountId "therapist",
 * staffCode "THR-E2E-001")을 그대로 쓴다 — 이 스펙은 전용 DB(vietnam_aesthetic_th05)에서만 돌아
 * 다른 스펙과 공유되지 않는다.
 */

function businessTodayServiceDate(now: Date): string {
  const DAY_START_CLOCK = "03:00"; // 영업일 전환은 베트남 시각 03:00이다.
  const calendarToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const clockNow = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  if (clockNow < DAY_START_CLOCK) return addIsoDays(calendarToday, -1);
  return calendarToday;
}

function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function monthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  return { startDate, endDate };
}

const TODAY_DATE = businessTodayServiceDate(new Date());
const MONTH_KEY = TODAY_DATE.slice(0, 7);
const THERAPIST_STAFF_CODE = "THR-E2E-001";

let operatingMonthId: string;
let therapistEmployeeId: string;

async function readClockCodeFromTv(page: Page): Promise<string> {
  await login(page, "administrator", "Story12!administrator");
  await page.goto("/tv");
  // 코드는 화면이 Web Crypto로 비동기 계산한다(서버가 바로 숫자를 내려주지 않는다) — 자리표시자
  // "····"가 실제 코드로 바뀔 때까지 기다린다.
  const digits = page.getByTestId("clock-code-digits");
  await expect(digits).toHaveText(/^\d{4}$/);
  return digits.innerText();
}

async function enterCodeAndSubmit(page: Page, code: string) {
  for (const digit of code) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  const submitted = page.waitForResponse((response) => response.request().method() === "POST" && Boolean(response.request().headers()["next-action"]));
  await page.getByRole("button", { name: "확인" }).click();
  await submitted;
}

function wrongCodeFrom(code: string) {
  return String((Number(code) + 1) % 10000).padStart(4, "0");
}

test.describe("Story ticket 05 clock-in code", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const range = monthRange(MONTH_KEY);
    const month = await (prisma as any).operatingMonth.upsert({
      where: { monthKey: MONTH_KEY },
      update: {},
      create: { monthKey: MONTH_KEY, startDate: range.startDate, endDate: range.endDate, status: "작성중" }
    });
    operatingMonthId = month.id;

    const employee = await (prisma as any).employee.findUnique({ where: { staffCode: THERAPIST_STAFF_CODE } });
    therapistEmployeeId = employee.id;

    // 깨끗한 상태로 시작: 이 운영월의 출퇴근 기록과 출근 코드 잠금을 지운다.
    await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId, employeeId: therapistEmployeeId } });
    await (prisma as any).userAccount.update({
      where: { accountId: "therapist" },
      data: { clockInCodeFailedCount: 0, clockInCodeLockedUntil: null }
    });
  });

  test.afterAll(async () => {
    await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId, employeeId: therapistEmployeeId } });
    await (prisma as any).userAccount.update({
      where: { accountId: "therapist" },
      data: { clockInCodeFailedCount: 0, clockInCodeLockedUntil: null }
    });
    await prisma.$disconnect();
  });

  test("locks after 5 wrong codes, then unlocked clocks in and out with method 직접", async ({ browser }) => {
    const tvContext = await browser.newContext();
    const tvPage = await tvContext.newPage();
    const code = await readClockCodeFromTv(tvPage);
    const wrongCode = wrongCodeFrom(code);

    const therapistContext = await browser.newContext();
    const page = await therapistContext.newPage();
    await login(page, "therapist", "Story12!therapist");
    await page.goto("/therapist");

    await page.getByRole("button", { name: "출근" }).click();
    await expectTherapistCenterPopup(page, page.getByRole("dialog", { name: "출근 코드 입력" }));

    // 틀린 코드 5번: 1~4번째는 남은 시도 횟수를, 5번째는 잠김과 풀리는 시각을 보인다(D14).
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await enterCodeAndSubmit(page, wrongCode);
      await expect(page.getByRole("alert")).toContainText(`남은 시도 ${5 - attempt}회`);
    }
    await enterCodeAndSubmit(page, wrongCode);
    await expect(page.getByRole("alert")).toContainText("잠겼습니다");

    // 잠긴 동안은 맞는 코드도 거절된다.
    await enterCodeAndSubmit(page, code);
    await expect(page.getByRole("alert")).toContainText("잠겼습니다");

    // 15분을 기다리지 않고 잠금을 바로 풀어(테스트 전용) 성공 흐름을 본다.
    await (prisma as any).userAccount.update({
      where: { accountId: "therapist" },
      data: { clockInCodeFailedCount: 0, clockInCodeLockedUntil: null }
    });

    const freshCheckInCode = await readClockCodeFromTv(tvPage);
    await enterCodeAndSubmit(page, freshCheckInCode);
    await expect(page.getByRole("button", { name: "퇴근" })).toBeVisible();

    const attendanceAfterCheckIn = await (prisma as any).therapistAttendance.findUnique({
      where: { operatingMonthId_attendanceDate_employeeId: { operatingMonthId, attendanceDate: new Date(`${TODAY_DATE}T00:00:00.000Z`), employeeId: therapistEmployeeId } }
    });
    expect(attendanceAfterCheckIn.checkInMethod).toBe("직접");
    expect(attendanceAfterCheckIn.checkOutMinute).toBeNull();

    // 퇴근
    const checkOutCode = await readClockCodeFromTv(tvPage);
    await page.getByRole("button", { name: "퇴근" }).click();
    await enterCodeAndSubmit(page, checkOutCode);
    await expect(page.getByText("이미 찍음 — 정정 요청")).toBeVisible();

    const attendanceAfterCheckOut = await (prisma as any).therapistAttendance.findUnique({
      where: { operatingMonthId_attendanceDate_employeeId: { operatingMonthId, attendanceDate: new Date(`${TODAY_DATE}T00:00:00.000Z`), employeeId: therapistEmployeeId } }
    });
    expect(attendanceAfterCheckOut.checkOutMethod).toBe("직접");
    expect(attendanceAfterCheckOut.checkOutMinute).not.toBeNull();

    // D28: 직접 찍기가 감사에 남는다.
    const audits = await (prisma as any).auditLog.findMany({
      where: { targetType: "therapist_attendance", targetId: attendanceAfterCheckOut.id },
      orderBy: { createdAt: "asc" }
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
    expect(audits.every((entry: any) => entry.actorId !== null)).toBe(true);

    await tvContext.close();
    await therapistContext.close();
  });

  test("ops and therapist roles are rejected from each other's screens and actions", async ({ page }) => {
    await login(page, "therapist", "Story12!therapist");
    await page.goto("/tv");
    await expect(page).toHaveURL(/\/therapist(?:\?|$)/);

    await login(page, "administrator", "Story12!administrator");
    await page.goto("/therapist");
    await expect(page).toHaveURL(/\/live(?:\?|$)/);

    await login(page, "counter", "Story12!counter");
    await page.goto("/clock-code");
    await expect(page).toHaveURL(/\/clock-code(?:\?|$)/);

    await login(page, "settlement_manager", "Story12!settlement_manager");
    await page.goto("/clock-code");
    await expect(page).toHaveURL(/\/settlements(?:\?|$)/);
  });
});

function hcmWallClock(reference: Date, hour: number, minute: number, second: number) {
  // Asia/Ho_Chi_Minh is a fixed UTC+7 offset (no DST), so the HCM calendar date of `reference`
  // at (hour:minute:second) HCM is UTC (hour-7):minute:second on that same date.
  const calendarDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(reference);
  const [year, month, day] = calendarDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
}

test.describe("Story ticket 05 clock code display — no server requests", () => {
  // /clock-code는 RoomStatusRefresh(30초 자동 갱신) 없는 bare 화면이라, TV의 기존 폴링과 섞이지 않고
  // "코드가 바뀌는 동안 서버 요청이 없는지"만 깨끗하게 본다(D13).
  test("updates the code across midnight purely client-side, with zero network requests", async ({ page }) => {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error("이 테스트는 NEXTAUTH_SECRET이 있어야 한다(서버와 같은 값).");

    const beforeMidnight = hcmWallClock(new Date(), 23, 59, 0);
    await page.clock.install({ time: beforeMidnight.getTime() });
    await login(page, "counter", "Story12!counter");
    await page.goto("/clock-code");

    const beforeMinute = clockCodeMinuteNow(beforeMidnight);
    const beforeDaySecret = await deriveClockCodeDaySecretHex(secret, beforeMinute.calendarDate);
    const expectedBefore = await computeClockInCode(beforeDaySecret, beforeMinute.minuteOfDay);
    await expect(page.getByTestId("clock-code-digits")).toHaveText(expectedBefore);

    const requestUrls: string[] = [];
    page.on("request", (request) => requestUrls.push(request.url()));

    // 2분을 건너뛰어 자정을 넘긴다(23:59 → 00:01, D13: 자정을 넘기면 다음 날 키로 넘어간다).
    await page.clock.fastForward(120_000);

    const afterInstant = new Date(beforeMidnight.getTime() + 120_000);
    const afterMinute = clockCodeMinuteNow(afterInstant);
    expect(afterMinute.calendarDate).not.toBe(beforeMinute.calendarDate);
    const afterDaySecret = await deriveClockCodeDaySecretHex(secret, afterMinute.calendarDate);
    const expectedAfter = await computeClockInCode(afterDaySecret, afterMinute.minuteOfDay);
    await expect(page.getByTestId("clock-code-digits")).toHaveText(expectedAfter);

    expect(requestUrls).toEqual([]);
  });
});
