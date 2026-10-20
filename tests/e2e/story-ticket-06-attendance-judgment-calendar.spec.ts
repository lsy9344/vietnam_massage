import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

/**
 * 티켓 06: 근태 판정과 근태 달력 — 지각, 결근, 퇴근 미입력, 예정 없는 출근(스펙 D15–D18, M12).
 *
 * 03과 같은 이유로 "지금"의 영업일을 기준으로 데이터를 심는다(05가 아직 없어 Playwright 시계를 쓰지
 * 않는다). 과거로 며칠 되돌아가는 날짜들은 달이 바뀔 수 있어(예: 오늘이 매달 초) 각 날짜가 속한
 * monthKey로 ?month=를 직접 지정해 달력을 연다 — 기본 보기(이번 달)에만 기대지 않는다.
 */

const DAY_START_CLOCK = "03:00"; // 영업일 전환은 베트남 시각 03:00이다.

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

// src/components/therapist/therapist-attendance-calendar.tsx의 formatFullDate와 같은 모양(로그인은
// ko 쿠키를 강제한다). 칸의 aria-label은 이 문자열로 시작하므로 ^로 앵커해 "1일"이 "19일"과 섞이지
// 않게 한다.
function formatFullDateKo(isoDate: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(
    new Date(`${isoDate}T00:00:00.000Z`)
  );
}

function dayCellName(isoDate: string): RegExp {
  return new RegExp(`^${formatFullDateKo(isoDate)}`);
}

function monthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  return { startDate, endDate };
}

const TODAY_DATE = businessTodayServiceDate(new Date());
// 지각 + 퇴근 미입력(운영일이 끝남) — "오늘" 탭·근태 탭 공통 안내의 대상이기도 하다.
const LATE_AND_MISSING_CHECKOUT_DATE = addDaysToIsoDate(TODAY_DATE, -1);
// 휴무인 날의 출근(예정 없는 출근), 대리 입력 방식.
const UNSCHEDULED_DATE = addDaysToIsoDate(TODAY_DATE, -2);
// 근무 예정인데 출근 기록이 전혀 없음 — 결근.
const ABSENT_DATE = addDaysToIsoDate(TODAY_DATE, -3);
// 정시 출근 + 만근 인정, 특이사항 없음.
const FULL_ATTENDANCE_DATE = addDaysToIsoDate(TODAY_DATE, -5);

const STAFF_CODE = "E2E06-THR-001";
const ACCOUNT_ID = "story06_mine";

async function ensureOperatingMonth(monthKey: string) {
  const { startDate, endDate } = monthRange(monthKey);
  return (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: {},
    create: { monthKey, startDate, endDate, status: "작성중" }
  });
}

async function seedStoryData() {
  // E2E 데이터(공유 자원 규칙): 직원 정렬 순서 98060대(티켓 06).
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: STAFF_CODE },
    update: { displayName: "E2E06 근태 Therapist", employeeGroup: "THERAPIST", employmentStatus: "재직", sortOrder: 98060, isActive: true },
    create: {
      staffCode: STAFF_CODE,
      displayName: "E2E06 근태 Therapist",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: null,
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 98060,
      isActive: true
    }
  });

  const passwordHash = await hash("Story06!mine", argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: ACCOUNT_ID },
    update: { passwordHash, role: "therapist", employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: { email: `${ACCOUNT_ID}@example.local`, accountId: ACCOUNT_ID, passwordHash, role: "therapist", employeeId: employee.id, isActive: true }
  });

  const monthKeys = [...new Set([TODAY_DATE, LATE_AND_MISSING_CHECKOUT_DATE, UNSCHEDULED_DATE, ABSENT_DATE, FULL_ATTENDANCE_DATE].map(monthKeyOf))];
  const operatingMonthByKey = new Map<string, { id: string }>();
  for (const monthKey of monthKeys) {
    operatingMonthByKey.set(monthKey, await ensureOperatingMonth(monthKey));
  }

  async function setSchedule(date: string, planStatus: "근무 예정" | "휴무", plannedStartTime: string | null) {
    await (prisma as any).plannedWorkingDay.upsert({
      where: { employeeId_workDate: { employeeId: employee.id, workDate: new Date(`${date}T00:00:00.000Z`) } },
      update: { planStatus, plannedStartTime },
      create: { employeeId: employee.id, workDate: new Date(`${date}T00:00:00.000Z`), planStatus, plannedStartTime }
    });
  }

  async function setAttendance(
    date: string,
    input: { checkInMinute: number; checkInMethod: string; checkOutMinute: number | null; checkOutMethod: string | null }
  ) {
    const operatingMonthId = operatingMonthByKey.get(monthKeyOf(date))!.id;
    const standbyMinutes = input.checkOutMinute === null ? null : ((input.checkOutMinute - input.checkInMinute + 1440) % 1440);
    const isFullAttendanceRecognized = standbyMinutes !== null && standbyMinutes >= 600;
    await (prisma as any).therapistAttendance.upsert({
      where: { operatingMonthId_attendanceDate_employeeId: { operatingMonthId, attendanceDate: new Date(`${date}T00:00:00.000Z`), employeeId: employee.id } },
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
        employeeId: employee.id,
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

  // 오늘: 근무 예정, 출근 전(운영일이 끝나지 않아 결근이 아니다).
  await setSchedule(TODAY_DATE, "근무 예정", "09:00");

  // 지각 10분 + 퇴근 미입력(운영일이 끝났다).
  await setSchedule(LATE_AND_MISSING_CHECKOUT_DATE, "근무 예정", "09:00");
  await setAttendance(LATE_AND_MISSING_CHECKOUT_DATE, { checkInMinute: 550, checkInMethod: "직접", checkOutMinute: null, checkOutMethod: null });

  // 휴무인 날의 출근 → 예정 없는 출근, 대리 입력 방식.
  await setSchedule(UNSCHEDULED_DATE, "휴무", null);
  await setAttendance(UNSCHEDULED_DATE, { checkInMinute: 600, checkInMethod: "대리 입력", checkOutMinute: 1140, checkOutMethod: "대리 입력" });

  // 근무 예정인데 출근 기록이 전혀 없음 → 결근.
  await setSchedule(ABSENT_DATE, "근무 예정", "09:00");

  // 정시 출근(09:00) + 퇴근(20:00, 11시간 대기) → 만근 인정, 그 밖의 특이사항 없음.
  await setSchedule(FULL_ATTENDANCE_DATE, "근무 예정", "09:00");
  await setAttendance(FULL_ATTENDANCE_DATE, { checkInMinute: 540, checkInMethod: "직접", checkOutMinute: 1200, checkOutMethod: "직접" });

  return { employeeId: employee.id };
}

async function cleanupStoryData() {
  const employee = await (prisma as any).employee.findUnique({ where: { staffCode: STAFF_CODE } });
  if (employee) {
    await (prisma as any).therapistAttendance.deleteMany({ where: { employeeId: employee.id } });
    await (prisma as any).plannedWorkingDay.deleteMany({ where: { employeeId: employee.id } });
  }
  await (prisma as any).userAccount.updateMany({ where: { accountId: ACCOUNT_ID }, data: { isActive: false, lockedUntil: null, failedLoginCount: 0 } });
  await (prisma as any).employee.updateMany({ where: { staffCode: STAFF_CODE }, data: { isActive: false } });
}

test.describe("티켓 06 근태 판정과 근태 달력", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedStoryData();
  });

  test.afterAll(async () => {
    await cleanupStoryData();
    await prisma.$disconnect();
  });

  test("근태 탭에 월 달력이 보이고, 날짜를 누르면 근무표·출퇴근·방식·판정이 패널에 보인다", async ({ page }) => {
    await login(page, ACCOUNT_ID, "Story06!mine");
    await page.goto(`/therapist/attendance?month=${monthKeyOf(LATE_AND_MISSING_CHECKOUT_DATE)}`);
    await expect(page.getByRole("heading", { name: "근태", level: 1 })).toBeVisible();

    await page
      .getByRole("grid")
      .getByRole("button", { name: dayCellName(LATE_AND_MISSING_CHECKOUT_DATE) })
      .click();

    // StatusIndicator 배지(판정 줄)는 기호 글자와 라벨이 같은 노드라 exact로 못 찾는다 — 부분 일치로 본다.
    const panel = page.getByRole("dialog");
    await expect(panel.getByText("근무 예정", { exact: true })).toBeVisible();
    await expect(panel.getByText("09:00", { exact: true })).toBeVisible(); // 출근 예정
    await expect(panel.getByText("09:10")).toBeVisible(); // 출근 시각
    await expect(panel.getByText("직접")).toBeVisible(); // 출근 방식
    await expect(panel.getByText("지각 10분")).toBeVisible();
    await expect(panel.getByText("퇴근 미입력")).toBeVisible();
    await panel.getByRole("button", { name: "닫기" }).click();
  });

  test("휴무인 날의 출근은 예정 없는 출근으로, 결근인 날은 결근으로, 만근인 날은 만근 인정으로 보인다", async ({ page }) => {
    await login(page, ACCOUNT_ID, "Story06!mine");

    await page.goto(`/therapist/attendance?month=${monthKeyOf(UNSCHEDULED_DATE)}`);
    await page
      .getByRole("grid")
      .getByRole("button", { name: dayCellName(UNSCHEDULED_DATE) })
      .click();
    let panel = page.getByRole("dialog");
    await expect(panel.getByText("휴무", { exact: true })).toBeVisible();
    await expect(panel.getByText("예정 없는 출근")).toBeVisible();
    await expect(panel.getByText("대리 입력").first()).toBeVisible();
    await panel.getByRole("button", { name: "닫기" }).click();

    await page.goto(`/therapist/attendance?month=${monthKeyOf(ABSENT_DATE)}`);
    await page
      .getByRole("grid")
      .getByRole("button", { name: dayCellName(ABSENT_DATE) })
      .click();
    panel = page.getByRole("dialog");
    await expect(panel.getByText("결근")).toBeVisible();
    await expect(panel.getByText("기록 없음", { exact: true }).first()).toBeVisible();
    await panel.getByRole("button", { name: "닫기" }).click();

    await page.goto(`/therapist/attendance?month=${monthKeyOf(FULL_ATTENDANCE_DATE)}`);
    await page
      .getByRole("grid")
      .getByRole("button", { name: dayCellName(FULL_ATTENDANCE_DATE) })
      .click();
    panel = page.getByRole("dialog");
    await expect(panel.getByText("만근 인정")).toBeVisible();
    await panel.getByRole("button", { name: "닫기" }).click();
  });

  test("운영일이 끝난 뒤 퇴근 미입력이면 '오늘' 탭과 근태 탭에 정정 요청 안내가 뜬다", async ({ page }) => {
    await login(page, ACCOUNT_ID, "Story06!mine");

    await page.goto("/therapist");
    await expect(page.getByText("퇴근 미입력 — 정정 요청", { exact: true })).toBeVisible();

    await page.goto(`/therapist/attendance?month=${monthKeyOf(LATE_AND_MISSING_CHECKOUT_DATE)}`);
    await expect(page.getByText("퇴근 미입력 — 정정 요청", { exact: true })).toBeVisible();
  });

  test("390px 폭에서 근태 달력이 가로 스크롤 없이 보인다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNT_ID, "Story06!mine");
    await page.goto(`/therapist/attendance?month=${monthKeyOf(TODAY_DATE)}`);
    await expect(page.getByRole("grid")).toBeVisible();
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalScroll).toBe(false);
  });
});
