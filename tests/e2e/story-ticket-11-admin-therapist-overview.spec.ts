import { expect, test } from "@playwright/test";
import { testEmployees } from "./support/test-employees";
import { prisma } from "./support/db";
import { login } from "./support/auth";

/**
 * 티켓 11: 관리자 Therapist 현황(스펙 D26, M12, M18).
 *
 * 06의 근태 판정·좁은 조회와 월마감 미리보기 행을 그대로 옮긴 화면이라, 숫자 계산 자체는 06의
 * story-ticket-06-attendance-judgment-calendar.spec.ts가 이미 검증했다. 여기서는 그 데이터가
 * 관리자 현황 화면(오늘·운영월 영역)에 올바르게 옮겨지는지와, `therapist:manage`가 없는 역할이
 * 들어갈 수 없는지만 본다.
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

function monthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  return { startDate, endDate };
}

const TODAY_DATE = businessTodayServiceDate(new Date());
// (알려진 좁은 위험) 오늘이 매달 2일이면 ABSENT_DATE·UNSCHEDULED_DATE가 서로 다른 달로 갈라져
// 운영월 영역 한 화면의 집계가 어긋난다(06의 근태 달력 스펙이 겪는 것과 같은 종류의 월경계 문제,
// 거기는 날짜마다 ?month=를 따로 지정해 피한다). 1/30 수준의 좁은 창이라 다른 흔들림과 같게 둔다.
// 근무 예정인데 출근 기록이 전혀 없음 → 결근(운영일이 끝났다).
const ABSENT_DATE = addDaysToIsoDate(TODAY_DATE, -1);
// 휴무인 날의 출근(대리 입력) → 예정 없는 출근 + 대리 입력 집계.
const UNSCHEDULED_DATE = addDaysToIsoDate(TODAY_DATE, -2);

const STAFF_CODE = "E2E11-THR-001";
const ADMIN_ACCOUNT_ID = "administrator";
const ADMIN_PASSWORD = "Story12!administrator";
const SETTLEMENT_ACCOUNT_ID = "settlement_manager";
const SETTLEMENT_PASSWORD = "Story12!settlement_manager";
const COUNTER_ACCOUNT_ID = "counter";
const COUNTER_PASSWORD = "Story12!counter";
const THERAPIST_ACCOUNT_ID = "therapist";
const THERAPIST_PASSWORD = "Story12!therapist";

async function ensureOperatingMonth(monthKey: string) {
  const { startDate, endDate } = monthRange(monthKey);
  return (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: {},
    create: { monthKey, startDate, endDate, status: "작성중" }
  });
}

async function seedStoryData() {
  // E2E 데이터(공유 자원 규칙): 직원 정렬 순서 98110대(티켓 11). testEmployees.upsert()(01·02·10·12와
  // 같은 헬퍼)가 공유 DB에서 그 자리가 이미 쓰였으면 빈 자리를 찾는다(R27, P2002 방지).
  const employee = await testEmployees.upsert({
    where: { staffCode: STAFF_CODE },
    update: { displayName: "E2E11 현황 Therapist", employeeGroup: "THERAPIST", employmentStatus: "재직", isActive: true },
    create: {
      staffCode: STAFF_CODE,
      displayName: "E2E11 현황 Therapist",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: null,
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 98110,
      isActive: true
    }
  });

  const monthKeys = [...new Set([TODAY_DATE, ABSENT_DATE, UNSCHEDULED_DATE].map(monthKeyOf))];
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

  // 오늘: 근무 예정(09:00)인데 09:15에 출근(직접) → 15분 지각. 운영일이 끝나지 않아 결근이 아니다.
  await setSchedule(TODAY_DATE, "근무 예정", "09:00");
  await setAttendance(TODAY_DATE, { checkInMinute: 555, checkInMethod: "직접", checkOutMinute: null, checkOutMethod: null });

  // 근무 예정인데 출근 기록이 전혀 없음 → 결근.
  await setSchedule(ABSENT_DATE, "근무 예정", "09:00");

  // 휴무인 날의 출근(대리 입력) → 예정 없는 출근 + 대리 입력 집계.
  await setSchedule(UNSCHEDULED_DATE, "휴무", null);
  await setAttendance(UNSCHEDULED_DATE, { checkInMinute: 600, checkInMethod: "대리 입력", checkOutMinute: 1140, checkOutMethod: "대리 입력" });

  return { employeeId: employee.id, operatingMonthId: operatingMonthByKey.get(monthKeyOf(TODAY_DATE))!.id };
}

async function cleanupStoryData() {
  const employee = await (prisma as any).employee.findUnique({ where: { staffCode: STAFF_CODE } });
  if (employee) {
    await (prisma as any).therapistAttendance.deleteMany({ where: { employeeId: employee.id } });
    await (prisma as any).plannedWorkingDay.deleteMany({ where: { employeeId: employee.id } });
  }
  await (prisma as any).employee.updateMany({ where: { staffCode: STAFF_CODE }, data: { isActive: false } });
}

let operatingMonthId = "";

test.describe("티켓 11 관리자 Therapist 현황", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const seeded = await seedStoryData();
    operatingMonthId = seeded.operatingMonthId;
  });

  test.afterAll(async () => {
    await cleanupStoryData();
    await prisma.$disconnect();
  });

  test("관리자: 오늘 영역에 출근 여부·시각·방식·지각이, 운영월 영역에 결근·예정 없는 출근·대리 입력·완료 콜 수·순위가 06의 데이터 그대로 보인다", async ({
    page
  }) => {
    await login(page, ADMIN_ACCOUNT_ID, ADMIN_PASSWORD);
    await page.goto(`/settlements/therapist-overview?operatingMonthId=${operatingMonthId}`);
    await expect(page.getByRole("heading", { name: "Therapist 현황", level: 1 })).toBeVisible();

    const todayTable = page.getByRole("table", { name: "오늘" });
    const todayRow = todayTable.getByRole("row").filter({ hasText: STAFF_CODE });
    await expect(todayRow).toBeVisible();
    await expect(todayRow).toContainText("09:15");
    await expect(todayRow).toContainText("직접");
    await expect(todayRow).toContainText("15분 지각");

    const monthlyTable = page.getByRole("table", { name: "운영월" });
    const monthlyRow = monthlyTable.getByRole("row").filter({ hasText: STAFF_CODE });
    await expect(monthlyRow).toBeVisible();
    // 첫 칸(Therapist 이름)은 th(rowheader)라 getByRole("cell")에는 안 잡힌다 — td 7개만 남는다:
    // 지각·결근·퇴근 미입력·예정 없는 출근·대리 입력·완료 콜 수·순위.
    const cells = monthlyRow.getByRole("cell");
    await expect(cells.nth(0)).toHaveText("1회 · 15분"); // 지각 1회·15분(오늘)
    await expect(cells.nth(1)).toHaveText("1회"); // 결근 1회
    await expect(cells.nth(2)).toHaveText("0회"); // 퇴근 미입력 0회(그날 퇴근까지 찍혔다)
    await expect(cells.nth(3)).toHaveText("1회"); // 예정 없는 출근 1회
    await expect(cells.nth(4)).toHaveText("2회"); // 대리 입력 2회(그 날 출근·퇴근 모두 대리 입력)
    await expect(cells.nth(5)).toHaveText("0콜"); // 완료 콜 수 0콜(서비스 콜을 심지 않았다)
    await expect(cells.nth(6)).toContainText("위"); // 순위는 매겨진다(40콜 미달도 포함)
  });

  for (const denied of [
    { label: "정산 담당", accountId: SETTLEMENT_ACCOUNT_ID, password: SETTLEMENT_PASSWORD, landingUrl: /\/settlements$/ },
    { label: "카운터", accountId: COUNTER_ACCOUNT_ID, password: COUNTER_PASSWORD, landingUrl: /\/calls$/ },
    { label: "therapist", accountId: THERAPIST_ACCOUNT_ID, password: THERAPIST_PASSWORD, landingUrl: /\/therapist$/ }
  ]) {
    test(`${denied.label} 역할은 이 화면에 들어갈 수 없다(M18, therapist:manage 없음)`, async ({ page }) => {
      await login(page, denied.accountId, denied.password);
      await page.goto("/settlements/therapist-overview");
      await expect(page).toHaveURL(denied.landingUrl);
    });
  }
});
