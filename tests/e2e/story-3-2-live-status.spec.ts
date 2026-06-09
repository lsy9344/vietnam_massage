import { expect, test, type Locator, type Page } from "@playwright/test";
import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { defaultRooms } from "@/modules/masters/room-schema";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vietnam_massage";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);
const argon2idOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

const monthKey = "2026-06";
const serviceDate = "2026-06-09";

type SeededData = {
  openMonthId: string;
  courseId: string;
  therapistId: string;
  roomIds: string[];
};

let seededData: SeededData;

async function loginAsAdmin(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill("story32_admin");
  await page.getByLabel("비밀번호").fill("Story32!admin");
  await page.getByRole("button", { name: "로그인" }).click();
}

function summaryTile(region: Locator, label: string, count: number) {
  return region.locator(":scope > div").filter({ hasText: new RegExp(`${label}\\s*${count}건`) });
}

function kpiTile(region: Locator, label: string, value: string) {
  return region.locator(":scope > div").filter({ hasText: new RegExp(`${label}\\s*${value}`) });
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
  const openMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { startDate: new Date("2026-06-01T00:00:00.000Z"), endDate: new Date("2026-06-30T00:00:00.000Z"), status: "작성중" },
    create: { monthKey, startDate: new Date("2026-06-01T00:00:00.000Z"), endDate: new Date("2026-06-30T00:00:00.000Z"), status: "작성중" }
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
  const policy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
  const policyData = {
    name: "Story32 A",
    durationMinutes: 60,
    basePrice: 1500000,
    opsCallCredit: 1,
    earcarePoolAmount: 0,
    requiresSecondTherapist: false,
    tvDisplayName: "S32 A60",
    effectiveToMonth: null,
    isActive: true
  };
  if (policy) {
    await (prisma as any).coursePolicy.update({ where: { id: policy.id }, data: policyData });
  } else {
    await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policyData } });
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

  return { openMonthId: openMonth.id, courseId: course.id, therapistId: therapist.id, roomIds: rooms.map((room: { id: string }) => room.id) };
}

async function createCall(input: { roomId: string; status: string; startTime: string; memo: string; paymentMethodCode?: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: seededData.openMonthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      roomId: input.roomId,
      courseId: seededData.courseId,
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
    await createCall({ roomId: seededData.roomIds[0], status: "예약", startTime: "12:00", memo: "Story 3.2 reserved" });
    await createCall({ roomId: seededData.roomIds[1], status: "사용중", startTime: "11:00", memo: "Story 3.2 attention" });
    await createCall({ roomId: seededData.roomIds[2], status: "청소중", startTime: "13:00", memo: "Story 3.2 cleaning" });
    await createCall({ roomId: seededData.roomIds[3], status: "VISIT_COMPLETE", startTime: "12:00", memo: "Story 3.2 completed", paymentMethodCode: "CASH" });
    await createCall({ roomId: seededData.roomIds[4], status: "NO_SHOW", startTime: "12:00", memo: "Story 3.2 no show" });
    await createCall({ roomId: seededData.roomIds[5], status: "CANCELED", startTime: "12:00", memo: "Story 3.2 canceled" });
    await createCall({ roomId: seededData.roomIds[6], status: "사용중", startTime: "23:00", memo: "Story 3.2 in use" });
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
    await expect(page.getByTestId("room-status-card")).toHaveCount(11);
  });

  test("renders /live as a read-only first screen with rooms, status summary, KPIs, and refresh state", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/live?operatingMonthId=${seededData.openMonthId}&serviceDate=${serviceDate}`);

    await expect(page.getByRole("heading", { name: "첫화면 실시간 현황" })).toBeVisible();
    await expect(page.getByTestId("room-status-card")).toHaveCount(11);
    await expect(page.getByLabel("상태: 예약").filter({ hasText: "◷" })).toBeVisible();
    await expect(page.getByLabel("상태: 사용중").filter({ hasText: "●" })).toBeVisible();
    await expect(page.getByLabel("상태: 종료확인").filter({ hasText: "⚠" })).toBeVisible();
    await expect(page.getByText("결제·확인 필요")).toBeVisible();
    await expect(page.getByLabel("상태: 청소중").filter({ hasText: "◐" })).toBeVisible();
    await expect(page.getByLabel("상태: 빈방").filter({ hasText: "○" }).first()).toBeVisible();
    await expect(page.getByText("S32 A60").first()).toBeVisible();
    await expect(page.getByText("E2E32 마사지사").first()).toBeVisible();

    const statusSummary = page.getByRole("region", { name: "오늘 상태 요약" });
    await expect(summaryTile(statusSummary, "예약", 1)).toBeVisible();
    await expect(summaryTile(statusSummary, "사용중", 2)).toBeVisible();
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
    await prisma.$disconnect();
  });
});
