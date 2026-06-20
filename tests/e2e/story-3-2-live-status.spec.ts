import { expect, test, type Locator, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { defaultRooms } from "@/modules/masters/room-schema";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const OPERATING_DAY_START_MINUTES = 11 * 60;

const expectedRoomOrder = ["401 호실", "402 호실", "301 호실", "302 호실", "303 호실", "201 호실", "202 호실", "203 호실", "101 호실", "102 호실", "103 호실"];
const expectedRoomNamePattern = new RegExp(expectedRoomOrder.join("|"));

function isoDateFromKst(date: Date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addIsoDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function currentOperatingServiceDate(now = new Date()) {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const calendarDate = isoDateFromKst(now);
  return kst.getUTCHours() < 11 ? addIsoDays(calendarDate, -1) : calendarDate;
}

function currentOperatingMinutes(now = new Date()) {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const wallMinutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return wallMinutes < OPERATING_DAY_START_MINUTES ? wallMinutes + 24 * 60 : wallMinutes;
}

function operatingMinutesToTime(value: number) {
  const minutes = ((value % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function monthBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${monthKey}-01`,
    endDate: `${monthKey}-${String(lastDay).padStart(2, "0")}`
  };
}

const serviceDate = currentOperatingServiceDate();
const monthKey = serviceDate.slice(0, 7);

type SeededData = {
  openMonthId: string;
  courseId: string;
  attentionCourseId: string;
  endingSoonCourseId: string;
  therapistId: string;
  roomIds: string[];
};

let seededData: SeededData;

async function loginAsAdmin(page: Page) {
  await login(page, "story32_admin", "Story32!admin");
}

function summaryTile(region: Locator, label: string, count: number) {
  return region.locator(":scope > div").filter({ hasText: new RegExp(`${label}\\s*${count}건`) });
}

function kpiTile(region: Locator, label: string, value: string) {
  return region.locator(":scope > div").filter({ hasText: new RegExp(`${label}\\s*${value}`) });
}

async function expectRoomOrder(page: Page) {
  const defaultRoomCards = page.getByTestId("room-status-card").filter({ hasText: expectedRoomNamePattern });
  await expect(defaultRoomCards).toHaveCount(11);
  await expect(defaultRoomCards.locator("h2")).toHaveText(expectedRoomOrder);
}

async function expectEndingSoonCard(page: Page) {
  const endingSoonCard = page.getByTestId("room-status-card").filter({ hasText: "종료임박" }).first();
  await expect(page.getByLabel("상태: 종료임박").filter({ hasText: "◴" })).toBeVisible();
  await expect(endingSoonCard).toHaveClass(/status-attention/);
  await expect(endingSoonCard).toHaveClass(/border-status-ending-soon/);
  await expect(endingSoonCard).toContainText("곧 종료");
  await expect(endingSoonCard).not.toContainText("결제·확인 필요");

  const completeCheckCard = page.getByTestId("room-status-card").filter({ hasText: "종료확인" }).first();
  await expect(completeCheckCard).toHaveClass(/border-status-complete-check/);
  await expect(completeCheckCard).toContainText("결제·확인 필요");
}

async function seedAdmin() {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E32-ADM-001" },
    update: {
      displayName: "E2E32 관리자",
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 93200,
      isActive: true
    },
    create: {
      staffCode: "E2E32-ADM-001",
      displayName: "E2E32 관리자",
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 93200,
      isActive: true
    }
  });
  const passwordHash = await hash("Story32!admin", argon2idOptions);

  return (prisma as any).userAccount.upsert({
    where: { accountId: "story32_admin" },
    update: {
      email: "story32_admin@example.local",
      passwordHash,
      role: "administrator",
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: "story32_admin@example.local",
      accountId: "story32_admin",
      passwordHash,
      role: "administrator",
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function upsertCodeItem(codeType: string, code: string, displayName: string, sortOrder: number) {
  await (prisma as any).codeItem.upsert({
    where: { codeType_code: { codeType, code } },
    update: { displayName, sortOrder, isActive: true },
    create: { codeType, code, displayName, sortOrder, isSystemDefault: false, isActive: true }
  });
}

async function cleanupStoryCalls(openMonthId: string) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: { operatingMonthId: openMonthId, customerMemo: { startsWith: "Story 3.2" } },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
  }
  await (prisma as any).dailyExpense.deleteMany({ where: { operatingMonthId: openMonthId, description: { startsWith: "Story 3.2" } } });
}

async function seedStoryData(): Promise<SeededData> {
  await seedAdmin();
  const { startDate, endDate } = monthBounds(monthKey);
  const openMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date(`${endDate}T00:00:00.000Z`), status: "작성중" },
    create: { monthKey, startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date(`${endDate}T00:00:00.000Z`), status: "작성중" }
  });
  await cleanupStoryCalls(openMonth.id);

  await (prisma as any).room.updateMany({
    where: { migrationReferenceName: { startsWith: "E2E32-" } },
    data: { isActive: false }
  });

  const rooms = await Promise.all(
    defaultRooms.map((room) =>
      (prisma as any).room.upsert({
        where: { sortOrder: room.sortOrder },
        update: {
          displayName: room.displayName,
          migrationReferenceName: room.migrationReferenceName,
          isActive: true
        },
        create: {
          displayName: room.displayName,
          migrationReferenceName: room.migrationReferenceName,
          sortOrder: room.sortOrder,
          isActive: true
        }
      })
    )
  );
  const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
  const attentionCourse = await (prisma as any).course.upsert({ where: { code: "E2E32-Z" }, update: { isActive: true }, create: { code: "E2E32-Z", isActive: true } });
  const endingSoonCourse = await (prisma as any).course.upsert({ where: { code: "E2E32-Y" }, update: { isActive: true }, create: { code: "E2E32-Y", isActive: true } });
  for (const [targetCourse, policyData] of [
    [
      course,
      {
        name: "Story32 A",
        durationMinutes: 60,
        basePrice: 1500000,
        opsCallCredit: 1,
        earcarePoolAmount: 0,
        requiresSecondTherapist: false,
        tvDisplayName: "S32 A60",
        effectiveToMonth: null,
        isActive: true
      }
    ],
    [
      attentionCourse,
      {
        name: "Story32 종료확인",
        durationMinutes: 0,
        basePrice: 0,
        opsCallCredit: 0,
        earcarePoolAmount: 0,
        requiresSecondTherapist: false,
        tvDisplayName: "S32 종료",
        effectiveToMonth: null,
        isActive: true
      }
    ],
    [
      endingSoonCourse,
      {
        name: "Story32 종료임박",
        durationMinutes: 10,
        basePrice: 0,
        opsCallCredit: 0,
        earcarePoolAmount: 0,
        requiresSecondTherapist: false,
        tvDisplayName: "S32 임박",
        effectiveToMonth: null,
        isActive: true
      }
    ]
  ] as const) {
    const policy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: targetCourse.id, effectiveFromMonth: monthKey } });
    if (policy) {
      await (prisma as any).coursePolicy.update({ where: { id: policy.id }, data: policyData });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId: targetCourse.id, effectiveFromMonth: monthKey, ...policyData } });
    }
  }

  const therapist = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E32-THR-001" },
    update: {
      displayName: "E2E32 마사지사",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 93201,
      isActive: true
    },
    create: {
      staffCode: "E2E32-THR-001",
      displayName: "E2E32 마사지사",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 93201,
      isActive: true
    }
  });
  const rate = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId: therapist.id, courseId: course.id, effectiveFromMonth: monthKey } });
  if (rate) {
    await (prisma as any).therapistCourseRate.update({ where: { id: rate.id }, data: { amount: 700000, effectiveToMonth: null, isActive: true } });
  } else {
    await (prisma as any).therapistCourseRate.create({
      data: { therapistId: therapist.id, courseId: course.id, amount: 700000, effectiveFromMonth: monthKey, effectiveToMonth: null, isActive: true }
    });
  }

  for (const [code, label, sortOrder] of [
    ["예약", "예약", 93201],
    ["사용중", "사용중", 93202],
    ["청소중", "청소중", 93203],
    ["VISIT_COMPLETE", "방문완료", 93204],
    ["NO_SHOW", "노쇼", 93205],
    ["CANCELED", "취소", 93206]
  ] as const) {
    await upsertCodeItem("SERVICE_STATUS", code, label, sortOrder);
  }
  await upsertCodeItem("PAYMENT_METHOD", "CASH", "현금", 93201);
  await upsertCodeItem("CONFIRMATION", "Y", "Y", 93201);
  for (const [value, sortOrder] of [
    ["01:00", 93201],
    ["12:00", 93202],
    ["13:00", 93203]
  ] as const) {
    await (prisma as any).timeSlot.upsert({ where: { value }, update: { sortOrder, isActive: true }, create: { value, sortOrder, isActive: true } });
  }

  return {
    openMonthId: openMonth.id,
    courseId: course.id,
    attentionCourseId: attentionCourse.id,
    endingSoonCourseId: endingSoonCourse.id,
    therapistId: therapist.id,
    roomIds: rooms.map((room: { id: string }) => room.id)
  };
}

async function createCall(input: { roomId: string; status: string; startTime: string; memo: string; paymentMethodCode?: string; courseId?: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: seededData.openMonthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      roomId: input.roomId,
      courseId: input.courseId ?? seededData.courseId,
      customerMemo: input.memo,
      status: input.status,
      paymentMethodCode: input.paymentMethodCode ?? null,
      confirmationCode: input.paymentMethodCode ? "Y" : null
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: seededData.therapistId }
  });
}

test.describe("Story 3.2 live room and call status", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    seededData = await seedStoryData();
    const operatingMinutes = currentOperatingMinutes();
    const activeStart = operatingMinutesToTime(Math.max(operatingMinutes - 30, OPERATING_DAY_START_MINUTES));
    const endingSoonStart = operatingMinutesToTime(Math.max(operatingMinutes - 5, OPERATING_DAY_START_MINUTES));
    const futureStart = operatingMinutesToTime(operatingMinutes + 60);

    await createCall({ roomId: seededData.roomIds[0], status: "예약", startTime: futureStart, memo: "Story 3.2 reserved" });
    await createCall({ roomId: seededData.roomIds[1], status: "사용중", startTime: activeStart, memo: "Story 3.2 in use" });
    await createCall({ roomId: seededData.roomIds[2], status: "청소중", startTime: activeStart, memo: "Story 3.2 cleaning" });
    await createCall({
      roomId: seededData.roomIds[3],
      status: "사용중",
      startTime: activeStart,
      memo: "Story 3.2 attention",
      courseId: seededData.attentionCourseId
    });
    await createCall({ roomId: seededData.roomIds[4], status: "VISIT_COMPLETE", startTime: activeStart, memo: "Story 3.2 completed", paymentMethodCode: "CASH" });
    await createCall({ roomId: seededData.roomIds[5], status: "NO_SHOW", startTime: activeStart, memo: "Story 3.2 no show" });
    await createCall({ roomId: seededData.roomIds[6], status: "CANCELED", startTime: activeStart, memo: "Story 3.2 canceled" });
    await createCall({
      roomId: seededData.roomIds[7],
      status: "사용중",
      startTime: endingSoonStart,
      memo: "Story 3.2 ending soon",
      courseId: seededData.endingSoonCourseId
    });
    await (prisma as any).dailyExpense.create({
      data: {
        operatingMonthId: seededData.openMonthId,
        expenseDate: new Date(`${serviceDate}T00:00:00.000Z`),
        amount: 100000,
        description: "Story 3.2 expense",
        handledByEmployeeId: seededData.therapistId,
        isActive: true
      }
    });
  });

  test("lands administrators on /live after login", async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page).toHaveURL(/\/live(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "첫화면 실시간 현황" })).toBeVisible();
    await expectRoomOrder(page);
  });

  test("renders /live as a read-only first screen with rooms, status summary, KPIs, and refresh state", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/live?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`);

    await expect(page.getByRole("heading", { name: "첫화면 실시간 현황" })).toBeVisible();
    await expectRoomOrder(page);
    await expect(page.getByLabel("상태: 예약").filter({ hasText: "◷" })).toBeVisible();
    await expect(page.getByLabel("상태: 사용중").filter({ hasText: "●" })).toBeVisible();
    await expectEndingSoonCard(page);
    await expect(page.getByLabel("상태: 종료확인").filter({ hasText: "⚠" })).toBeVisible();
    await expect(page.getByText("결제·확인 필요")).toBeVisible();
    await expect(page.getByLabel("상태: 청소중").filter({ hasText: "◐" })).toBeVisible();
    await expect(page.getByLabel("상태: 빈방").filter({ hasText: "○" }).first()).toBeVisible();
    await expect(page.getByText("S32 A60").first()).toBeVisible();
    await expect(page.getByText("E2E32 마사지사").first()).toBeVisible();

    const statusSummary = page.getByRole("region", { name: "오늘 상태 요약" });
    await expect(summaryTile(statusSummary, "예약건수", 8)).toBeVisible();
    await expect(summaryTile(statusSummary, "사용중", 3)).toBeVisible();
    await expect(summaryTile(statusSummary, "청소중", 1)).toBeVisible();
    await expect(summaryTile(statusSummary, "방문완료", 1)).toBeVisible();
    await expect(summaryTile(statusSummary, "노쇼", 1)).toBeVisible();
    await expect(summaryTile(statusSummary, "취소", 1)).toBeVisible();

    const kpi = page.getByRole("region", { name: "오늘 KPI" });
    await expect(kpiTile(kpi, "결제합계", "1,500,000 VND")).toBeVisible();
    await expect(kpiTile(kpi, "순매출", "1,400,000 VND")).toBeVisible();
    await expect(kpi.getByText("코스별 방문완료")).toBeVisible();
    await expect(kpi.locator("div").filter({ hasText: /A\s*1/ }).first()).toBeVisible();
    await expect(page.getByLabel("실시간 갱신 상태")).toContainText(/마지막 갱신|갱신 중|갱신 지연/);

    await expect(page.getByRole("heading", { name: "콜 원장 그리드" })).toHaveCount(0);
    await expect(page.getByText("저장중")).toHaveCount(0);
    await expect(page.getByText("autosave", { exact: false })).toHaveCount(0);
  });

  test.afterAll(async () => {
    // 이 스펙이 시드한 콜/지출을 메모 prefix 범위로 정리한 뒤 연결을 닫는다.
    await cleanupStoryCalls(seededData.openMonthId);
    await prisma.$disconnect();
  });
});
