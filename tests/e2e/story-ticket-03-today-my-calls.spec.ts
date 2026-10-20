import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

/**
 * 티켓 03: "오늘" 탭 — 내 콜과 오늘 현황(스펙 D10–D12).
 *
 * 이 화면은 날짜를 고르지 않고 언제나 "지금"의 영업일을 보여준다(05가 아직 없어 Playwright 시계를
 * 쓰지 않는다 — 코드베이스 지도 14절). 그래서 2034-xx처럼 멀리 고정한 달을 쓸 수 없고, 테스트를 돌리는
 * 바로 그 순간의 영업일(Asia/Ho_Chi_Minh, 첫 활성 슬롯 "11:00" 전은 전날)을 그대로 계산해 그 날짜에
 * 콜을 심는다(src/lib/operating-date.ts의 businessTodayServiceDate와 같은 규칙).
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
const FUTURE_DATE = addDaysToIsoDate(TODAY_DATE, 2);

type SeededData = {
  operatingMonthIds: Record<string, string>;
  roomId: string;
  courseId: string;
  mineEmployeeId: string;
  partnerEmployeeId: string;
  otherEmployeeId: string;
};

let seeded: SeededData;

async function seedEmployee(staffCode: string, displayName: string, sortOrder: number, phone: string | null = null) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup: "THERAPIST", position: "마사지사", employmentStatus: "재직", sortOrder, isActive: true, phone },
    create: {
      staffCode,
      displayName,
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: null,
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true,
      phone
    }
  });
}

async function seedAuthAccount(input: { accountId: string; password: string; employeeId: string }) {
  const passwordHash = await hash(input.password, argon2idOptions);
  return (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: { passwordHash, role: "therapist", employeeId: input.employeeId, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      email: `${input.accountId}@example.local`,
      accountId: input.accountId,
      passwordHash,
      role: "therapist",
      employeeId: input.employeeId,
      isActive: true
    }
  });
}

async function ensureOperatingMonth(monthKey: string) {
  const { startDate, endDate } = monthRange(monthKey);
  return (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: {},
    create: { monthKey, startDate, endDate, status: "작성중" }
  });
}

async function createCall(input: {
  operatingMonthId: string;
  serviceDate: string;
  startTime: string;
  roomId: string;
  courseId: string;
  status: string;
  customerMemo?: string | null;
  bookerName?: string | null;
  visitRequest?: string | null;
  therapistIds: string[];
}) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: input.operatingMonthId,
      serviceDate: new Date(`${input.serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      roomId: input.roomId,
      courseId: input.courseId,
      status: input.status,
      customerMemo: input.customerMemo ?? null,
      bookerName: input.bookerName ?? null,
      visitRequest: input.visitRequest ?? null,
      discountTypeCode: null,
      paymentMethodCode: null,
      confirmationCode: null
    }
  });
  for (const [index, employeeId] of input.therapistIds.entries()) {
    await (prisma as any).serviceCallAssignment.create({
      data: { serviceCallId: call.id, assignmentRole: index === 0 ? "THERAPIST_1" : "THERAPIST_2", employeeId, isActive: true }
    });
  }
  return call;
}

async function seedStoryData(): Promise<SeededData> {
  // E2E 데이터(공유 자원 규칙): 직원 정렬 순서 98030대(티켓 03). 날짜는 "지금"의 영업일에 매여 있어
  // 고정 먼 달을 쓸 수 없다(위 주석).
  const mine = await seedEmployee("E2E03-THR-001", "E2E03 내 Therapist", 98030, "0901112222");
  const partner = await seedEmployee("E2E03-THR-002", "E2E03 함께 Therapist", 98031);
  const other = await seedEmployee("E2E03-THR-003", "E2E03 다른 Therapist", 98032);
  await seedAuthAccount({ accountId: "story03_mine", password: "Story03!mine", employeeId: mine.id });

  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 98030 },
    update: { displayName: "E2E03 호실", migrationReferenceName: "E2E03-ROOM", isActive: true },
    create: { displayName: "E2E03 호실", migrationReferenceName: "E2E03-ROOM", sortOrder: 98030, isActive: true }
  });
  const course = await (prisma as any).course.upsert({ where: { code: "E03" }, update: { isActive: true }, create: { code: "E03", isActive: true } });
  // 효력 범위를 넓게 둬 테스트를 돌리는 실제 달이 몇 월이든 코스 정책이 걸린다.
  const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: "2000-01" } });
  const policyData = {
    name: "E2E03 코스",
    durationMinutes: 60,
    basePrice: 100000,
    requiresSecondTherapist: false,
    tvDisplayName: "E2E03 코스",
    effectiveToMonth: null,
    isActive: true
  };
  if (existingPolicy) {
    await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policyData });
  } else {
    await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: "2000-01", ...policyData } });
  }

  const monthKeys = [...new Set([monthKeyOf(TODAY_DATE), monthKeyOf(FUTURE_DATE)])];
  const operatingMonthIds: Record<string, string> = {};
  for (const monthKey of monthKeys) {
    operatingMonthIds[monthKey] = (await ensureOperatingMonth(monthKey)).id;
  }

  await createCall({
    operatingMonthId: operatingMonthIds[monthKeyOf(TODAY_DATE)]!,
    serviceDate: TODAY_DATE,
    startTime: "11:30",
    roomId: room.id,
    courseId: course.id,
    status: "사용중",
    customerMemo: "E2E03 민호손님",
    therapistIds: [mine.id]
  });
  await createCall({
    operatingMonthId: operatingMonthIds[monthKeyOf(TODAY_DATE)]!,
    serviceDate: TODAY_DATE,
    startTime: "20:00",
    roomId: room.id,
    courseId: course.id,
    status: "예약",
    bookerName: "E2E03 함께손님",
    therapistIds: [mine.id, partner.id]
  });
  await createCall({
    operatingMonthId: operatingMonthIds[monthKeyOf(TODAY_DATE)]!,
    serviceDate: TODAY_DATE,
    startTime: "21:00",
    roomId: room.id,
    courseId: course.id,
    status: "취소",
    bookerName: "E2E03 취소손님",
    therapistIds: [mine.id]
  });
  // 다른 Therapist만의 콜: 내 "오늘" 화면에 전혀 보이면 안 된다(M6, D11).
  await createCall({
    operatingMonthId: operatingMonthIds[monthKeyOf(TODAY_DATE)]!,
    serviceDate: TODAY_DATE,
    startTime: "12:00",
    roomId: room.id,
    courseId: course.id,
    status: "방문완료",
    customerMemo: "E2E03 비밀손님 0911112222",
    visitRequest: "다른사람전용요청",
    therapistIds: [other.id]
  });
  // 오늘이 아닌 날(오늘+2)의 내 콜: 날짜별 묶음에 따로 나와야 한다.
  await createCall({
    operatingMonthId: operatingMonthIds[monthKeyOf(FUTURE_DATE)]!,
    serviceDate: FUTURE_DATE,
    startTime: "13:00",
    roomId: room.id,
    courseId: course.id,
    status: "예약",
    bookerName: "E2E03 미래손님",
    therapistIds: [mine.id]
  });

  return { operatingMonthIds, roomId: room.id, courseId: course.id, mineEmployeeId: mine.id, partnerEmployeeId: partner.id, otherEmployeeId: other.id };
}

async function cleanupStoryData() {
  const calls = await (prisma as any).serviceCall.findMany({ where: { customerMemo: { startsWith: "E2E03 " } }, select: { id: true } });
  const bookedCalls = await (prisma as any).serviceCall.findMany({ where: { bookerName: { startsWith: "E2E03 " } }, select: { id: true } });
  const callIds = [...new Set([...calls, ...bookedCalls].map((call: { id: string }) => call.id))];
  if (callIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
  }
  await (prisma as any).userAccount.updateMany({ where: { accountId: "story03_mine" }, data: { isActive: false, lockedUntil: null, failedLoginCount: 0 } });
  await (prisma as any).employee.updateMany({ where: { staffCode: { startsWith: "E2E03-" } }, data: { isActive: false } });
}

test.describe("티켓 03 오늘 탭 — 내 콜과 오늘 현황", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    seeded = await seedStoryData();
  });

  test.afterAll(async () => {
    await cleanupStoryData();
    await prisma.$disconnect();
  });

  test("내 콜만 날짜별로 보이고, 다른 Therapist의 콜·이름·메모·연락처는 화면에 없다", async ({ page }) => {
    await login(page, "story03_mine", "Story03!mine");
    await page.goto("/therapist");
    await expect(page.getByRole("heading", { name: "오늘", level: 1 })).toBeVisible();

    // 오늘 현황: 오늘 한 것 1(사용중만 해당, 예약·취소는 아니다).
    await expect(page.getByText("오늘 한 것")).toBeVisible();

    // 내 콜 세 개가 보인다.
    await expect(page.getByText("E2E03 민호손님")).toBeVisible();
    await expect(page.getByText("E2E03 함께손님")).toBeVisible();
    await expect(page.getByText("E2E03 함께 Therapist님과 함께")).toBeVisible();
    await expect(page.getByText("E2E03 취소손님")).toBeVisible();

    // 오늘이 아닌 날(오늘+2)의 콜도 그 날짜 묶음에 보인다.
    await expect(page.getByText("E2E03 미래손님")).toBeVisible();

    // 다른 Therapist의 콜·이름·메모·연락처 숫자는 어디에도 없다(M6, D11) — 화면 전체 텍스트로 확인한다.
    const bodyText = (await page.locator("body").innerText()).normalize();
    expect(bodyText).not.toContain("E2E03 다른 Therapist");
    expect(bodyText).not.toContain("E2E03 비밀손님");
    expect(bodyText).not.toContain("다른사람전용요청");
    expect(bodyText).not.toContain("0911112222");
  });

  test("취소된 콜은 흐리게 남고, 상태 칩이 보인다", async ({ page }) => {
    await login(page, "story03_mine", "Story03!mine");
    await page.goto("/therapist");
    const canceledCard = page.locator("li", { hasText: "E2E03 취소손님" });
    await expect(canceledCard).toBeVisible();
    await expect(canceledCard.getByText("취소", { exact: true })).toBeVisible();
    await expect(canceledCard).toHaveCSS("opacity", /0\.6/);
  });

  test("390px 폭에서 가로 스크롤이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, "story03_mine", "Story03!mine");
    await page.goto("/therapist");
    await expect(page.getByText("E2E03 민호손님")).toBeVisible();
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalScroll).toBe(false);
  });
});
