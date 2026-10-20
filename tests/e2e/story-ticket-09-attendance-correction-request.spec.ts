import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

/**
 * 티켓 09: 출퇴근 정정 요청(스펙 D23, D24, D28, M23, M24, ADR 0004).
 *
 * 06과 같은 이유로 "지금"의 영업일을 기준으로 데이터를 심는다 — 요청으로 이어지는 두 자리(05의
 * "이미 찍음"은 오늘에만, 06의 "퇴근 미입력"은 최근 31일 돌아보기만)가 모두 "지금"에 매여 있어
 * 08처럼 먼 미래 월(2042-NN)을 쓸 수 없다.
 */

const DAY_START_CLOCK = "11:00"; // scripts/seed-master-data.ts의 defaultTimeSlots[0]과 같다.

function businessTodayServiceDate(now: Date): string {
  const calendarToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const clockNow = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now);
  if (clockNow < DAY_START_CLOCK) return addDaysToIsoDate(calendarToday, -1);
  return calendarToday;
}

function addDaysToIsoDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function monthKeyOf(isoDate: string) {
  return isoDate.slice(0, 7);
}

function monthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  return { startDate, endDate };
}

const TODAY_DATE = businessTodayServiceDate(new Date());
// 출근만 있고 퇴근이 없다 — "퇴근 미입력 — 정정 요청" 안내(06)의 대상(최근 31일 안).
const MISSING_CHECKOUT_DATE = addDaysToIsoDate(TODAY_DATE, -1);

const STAFF_CODE = "E2E09-THR-001";
const ACCOUNT_ID = "story09_mine";
const PASSWORD = "Story09!mine";
const DISPLAY_NAME = "E2E09 정정 Therapist";

const ADMIN_ACCOUNT_ID = "administrator";
const ADMIN_PASSWORD = "Story12!administrator";
const SETTLEMENT_ACCOUNT_ID = "settlement_manager";
const SETTLEMENT_PASSWORD = "Story12!settlement_manager";

// src/components/therapist/therapist-attendance-calendar.tsx의 formatFullDate와 같은 모양(로그인은
// ko 쿠키를 강제한다). aria-label이 이 문자열로 시작하므로 ^로 앵커한다.
function formatFullDateKo(isoDate: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(
    new Date(`${isoDate}T00:00:00.000Z`)
  );
}

function dayCellName(isoDate: string): RegExp {
  return new RegExp(`^${formatFullDateKo(isoDate)}`);
}

// 승인함 카드의 날짜 캡슐(request-workspace.tsx의 formatRequestDate)과 같은 모양(weekday 없음).
function requestCardDateLabel(isoDate: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${isoDate}T00:00:00.000Z`));
}

let employeeId = "";
const operatingMonthIdByKey = new Map<string, string>();

async function ensureOperatingMonth(monthKey: string) {
  const { startDate, endDate } = monthRange(monthKey);
  const month = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: {},
    create: { monthKey, startDate, endDate, status: "작성중" }
  });
  operatingMonthIdByKey.set(monthKey, month.id);
  return month;
}

async function seedTherapistAccount() {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: STAFF_CODE },
    update: { displayName: DISPLAY_NAME, employeeGroup: "THERAPIST", employmentStatus: "재직", isActive: true },
    create: {
      staffCode: STAFF_CODE,
      displayName: DISPLAY_NAME,
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: null,
      baseSalary: 0,
      employmentStatus: "재직",
      // 98090대(README 공통 규칙: 98NN0, 티켓 09).
      sortOrder: 98090,
      isActive: true
    }
  });
  const passwordHash = await hash(PASSWORD, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: ACCOUNT_ID },
    update: { passwordHash, role: "therapist", employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: { email: `${ACCOUNT_ID}@example.local`, accountId: ACCOUNT_ID, passwordHash, role: "therapist", employeeId: employee.id, isActive: true }
  });
  return employee.id;
}

async function setAttendance(
  date: string,
  input: { checkInMinute: number; checkInMethod: string; checkOutMinute: number | null; checkOutMethod: string | null }
) {
  const operatingMonthId = operatingMonthIdByKey.get(monthKeyOf(date))!;
  const standbyMinutes = input.checkOutMinute === null ? null : ((input.checkOutMinute - input.checkInMinute + 1440) % 1440);
  const isFullAttendanceRecognized = standbyMinutes !== null && standbyMinutes >= 600;
  await (prisma as any).therapistAttendance.upsert({
    where: { operatingMonthId_attendanceDate_employeeId: { operatingMonthId, attendanceDate: new Date(`${date}T00:00:00.000Z`), employeeId } },
    update: {
      checkInMinute: input.checkInMinute,
      checkInMethod: input.checkInMethod,
      checkOutMinute: input.checkOutMinute,
      checkOutMethod: input.checkOutMethod,
      standbyMinutes,
      isFullAttendanceRecognized,
      isActive: true
    },
    create: {
      operatingMonthId,
      attendanceDate: new Date(`${date}T00:00:00.000Z`),
      employeeId,
      checkInMinute: input.checkInMinute,
      checkInMethod: input.checkInMethod,
      checkOutMinute: input.checkOutMinute,
      checkOutMethod: input.checkOutMethod,
      standbyMinutes,
      isFullAttendanceRecognized,
      isActive: true
    }
  });
}

async function openAttendanceDay(page: import("@playwright/test").Page, isoDate: string) {
  await page.goto(`/therapist/attendance?month=${monthKeyOf(isoDate)}`);
  await page
    .getByRole("grid")
    .getByRole("button", { name: dayCellName(isoDate) })
    .click();
  return page.getByRole("dialog", { name: formatFullDateKo(isoDate) });
}

test.describe("티켓 09 출퇴근 정정 요청", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    employeeId = await seedTherapistAccount();
    await ensureOperatingMonth(monthKeyOf(TODAY_DATE));
    await ensureOperatingMonth(monthKeyOf(MISSING_CHECKOUT_DATE));
    // 어제: 출근만 있고 퇴근이 없다(09:00 출근, "직접" 방식) — 06의 퇴근 미입력 안내 대상.
    await setAttendance(MISSING_CHECKOUT_DATE, { checkInMinute: 9 * 60, checkInMethod: "직접", checkOutMinute: null, checkOutMethod: null });
  });

  test.afterAll(async () => {
    await (prisma as any).therapistRequest.deleteMany({ where: { employeeId } });
    await (prisma as any).therapistAttendance.deleteMany({ where: { employeeId } });
    await (prisma as any).userAccount.updateMany({ where: { accountId: ACCOUNT_ID }, data: { isActive: false, lockedUntil: null, failedLoginCount: 0 } });
    await (prisma as any).employee.updateMany({ where: { staffCode: STAFF_CODE }, data: { isActive: false } });
    await prisma.$disconnect();
  });

  test("퇴근 미입력 → 정정 요청(중복 요청은 거절) → 승인 → 근태 탭에 반영된다", async ({ browser }) => {
    const therapistContext = await browser.newContext();
    const therapistPage = await therapistContext.newPage();
    await login(therapistPage, ACCOUNT_ID, PASSWORD);
    await therapistPage.goto("/therapist");
    await expect(therapistPage.getByText("퇴근 미입력 — 정정 요청", { exact: true })).toBeVisible();

    const notice = therapistPage.getByRole("alert").filter({ hasText: "퇴근 미입력 — 정정 요청" });
    await notice.getByRole("button", { name: "정정 요청" }).click();
    const dialog = therapistPage.getByRole("dialog");
    await dialog.getByLabel("퇴근 시각(선택)").fill("20:30");
    await dialog.getByLabel("사유").fill("퇴근을 못 찍었습니다.");
    await dialog.getByRole("button", { name: "요청 보내기" }).click();
    await expect(dialog).toBeHidden();

    const pending = await (prisma as any).therapistRequest.findFirst({ where: { employeeId, kind: "정정", status: "대기" } });
    expect(pending?.requestedCheckOutTime).toBe("20:30");
    expect(pending?.reason).toBe("퇴근을 못 찍었습니다.");

    // 같은 날 대기 중인 정정 요청이 있으면 다시 요청할 수 없다(D23).
    await notice.getByRole("button", { name: "정정 요청" }).click();
    const secondDialog = therapistPage.getByRole("dialog");
    await secondDialog.getByLabel("퇴근 시각(선택)").fill("21:00");
    await secondDialog.getByLabel("사유").fill("다시 요청합니다.");
    await secondDialog.getByRole("button", { name: "요청 보내기" }).click();
    await expect(secondDialog.getByText("이미 대기 중인 정정 요청이 있습니다.")).toBeVisible();
    await secondDialog.getByRole("button", { name: "닫기" }).click();
    await therapistContext.close();

    // 승인함: payout:write라 settlement_manager도 연다(M18).
    const settlementContext = await browser.newContext();
    const settlementPage = await settlementContext.newPage();
    await login(settlementPage, SETTLEMENT_ACCOUNT_ID, SETTLEMENT_PASSWORD);
    await settlementPage.goto("/settlements/requests");
    const requestCard = settlementPage.locator("li").filter({ hasText: requestCardDateLabel(MISSING_CHECKOUT_DATE) });
    await expect(requestCard).toBeVisible();
    // StatusIndicator 칩은 기호+글자가 한 요소라 exact 매칭이 안 잡힌다(merged-07.md 함정) — 행 전체로 본다.
    await expect(requestCard).toContainText("정정");
    await expect(requestCard.getByText("20:30")).toBeVisible();
    await requestCard.getByRole("button", { name: "승인" }).click();
    await expect(requestCard.getByText("승인", { exact: true }).first()).toBeVisible();
    await settlementContext.close();

    // DB: 퇴근이 20:30·"정정 승인"으로 저장되고, 출근 방식("직접")은 바뀌지 않았다(M23).
    const operatingMonthId = operatingMonthIdByKey.get(monthKeyOf(MISSING_CHECKOUT_DATE))!;
    const attendance = await (prisma as any).therapistAttendance.findUnique({
      where: { operatingMonthId_attendanceDate_employeeId: { operatingMonthId, attendanceDate: new Date(`${MISSING_CHECKOUT_DATE}T00:00:00.000Z`), employeeId } }
    });
    expect(attendance?.checkOutMinute).toBe(20 * 60 + 30);
    expect(attendance?.checkOutMethod).toBe("정정 승인");
    expect(attendance?.checkInMethod).toBe("직접");

    // Therapist 근태 탭: 그 날짜가 퇴근 20:30·정정 승인, 신청 "정정 · 승인"으로 보인다.
    const recheckContext = await browser.newContext();
    const recheckPage = await recheckContext.newPage();
    await login(recheckPage, ACCOUNT_ID, PASSWORD);
    const recheckDialog = await openAttendanceDay(recheckPage, MISSING_CHECKOUT_DATE);
    await expect(recheckDialog.getByText("20:30 · 정정 승인")).toBeVisible();
    await expect(recheckDialog.getByText("정정 · 승인")).toBeVisible();
    await recheckContext.close();
  });

  test("이미 찍음 → 정정 요청(출근·퇴근 둘 다) → 거절되면 사유가 근태 탭에 보인다", async ({ browser }) => {
    // 오늘: 출근·퇴근이 모두 있다("이미 찍음" 안내 대상, 05).
    await setAttendance(TODAY_DATE, { checkInMinute: 9 * 60 + 10, checkInMethod: "직접", checkOutMinute: 18 * 60, checkOutMethod: "직접" });

    const therapistContext = await browser.newContext();
    const therapistPage = await therapistContext.newPage();
    await login(therapistPage, ACCOUNT_ID, PASSWORD);
    await therapistPage.goto("/therapist");
    await expect(therapistPage.getByText("이미 찍음 — 정정 요청", { exact: true })).toBeVisible();

    const alreadyClockedNotice = therapistPage.getByText("이미 찍음 — 정정 요청", { exact: true }).locator("..");
    await alreadyClockedNotice.getByRole("button", { name: "정정 요청" }).click();
    const dialog = therapistPage.getByRole("dialog");
    await dialog.getByLabel("출근 시각(선택)").fill("09:00");
    await dialog.getByLabel("퇴근 시각(선택)").fill("18:30");
    await dialog.getByLabel("사유").fill("실제보다 늦게 찍혔습니다.");
    await dialog.getByRole("button", { name: "요청 보내기" }).click();
    await expect(dialog).toBeHidden();
    await therapistContext.close();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN_ACCOUNT_ID, ADMIN_PASSWORD);
    await adminPage.goto("/settlements/requests");
    const requestCard = adminPage.locator("li").filter({ hasText: requestCardDateLabel(TODAY_DATE) }).filter({ hasText: "정정" });
    await requestCard.getByRole("button", { name: "거절" }).click();
    await requestCard.getByLabel("거절 사유").fill("다른 시각이 맞습니다. 대리 입력으로 고칩니다.");
    await requestCard.getByRole("button", { name: "거절 확정" }).click();
    await expect(requestCard.getByText("거절", { exact: true }).first()).toBeVisible();
    await adminContext.close();

    // 거절은 출퇴근을 바꾸지 않는다 — 기존 기록이 그대로 남는다.
    const operatingMonthId = operatingMonthIdByKey.get(monthKeyOf(TODAY_DATE))!;
    const attendance = await (prisma as any).therapistAttendance.findUnique({
      where: { operatingMonthId_attendanceDate_employeeId: { operatingMonthId, attendanceDate: new Date(`${TODAY_DATE}T00:00:00.000Z`), employeeId } }
    });
    expect(attendance?.checkInMinute).toBe(9 * 60 + 10);
    expect(attendance?.checkOutMinute).toBe(18 * 60);

    const recheckContext = await browser.newContext();
    const recheckPage = await recheckContext.newPage();
    await login(recheckPage, ACCOUNT_ID, PASSWORD);
    const recheckDialog = await openAttendanceDay(recheckPage, TODAY_DATE);
    await expect(recheckDialog.getByText("거절 사유: 다른 시각이 맞습니다. 대리 입력으로 고칩니다.")).toBeVisible();
    await recheckContext.close();
  });

  test("390px 폭에서 정정 요청 다이얼로그가 열려도 가로 스크롤이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNT_ID, PASSWORD);
    await page.goto("/therapist");
    // 거절된 뒤에도 출퇴근은 그대로 남아 "이미 찍음" 안내가 계속 보인다(앞 테스트에서 확인함).
    const alreadyClockedNotice = page.getByText("이미 찍음 — 정정 요청", { exact: true }).locator("..");
    await alreadyClockedNotice.getByRole("button", { name: "정정 요청" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalScroll).toBe(false);
  });
});
