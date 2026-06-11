import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";


type SeededData = {
  monthId: string;
  monthKey: string;
  serviceDate: string;
  endDate: string;
  therapist1Name: string;
  accounts: Record<"administrator" | "counter" | "settlement_manager" | "read_only_viewer" | "waiter", { accountId: string; password: string }>;
};

let seededData: SeededData;

function workerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

function monthKeyForWorker(workerIndex: number) {
  const monthNumber = workerIndex + 1;
  const year = 2066 + Math.floor((monthNumber - 1) / 12);
  const month = ((monthNumber - 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function isoDate(monthKey: string, day: number) {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function utcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}


async function safeEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({
    where: { staffCode },
    select: { sortOrder: true }
  });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({
      where: { employeeGroup, sortOrder, NOT: { staffCode } },
      select: { id: true }
    });
    if (!conflicting) return sortOrder;
  }

  throw new Error(`No Story 6.3 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function safeRoomSortOrder(migrationReferenceName: string, preferredSortOrder: number) {
  const existing = await (prisma as any).room.findFirst({
    where: { migrationReferenceName },
    select: { sortOrder: true }
  });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).room.findUnique({
      where: { sortOrder },
      select: { id: true }
    });
    if (!conflicting) return sortOrder;
  }

  throw new Error(`No Story 6.3 room sortOrder available for ${migrationReferenceName}`);
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, roleHint: string, sortOrder: number) {
  const reservedSortOrder = await safeEmployeeSortOrder(employeeGroup, staffCode, sortOrder);
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: {
      displayName,
      employeeGroup,
      position: roleHint,
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: reservedSortOrder,
      isActive: true
    },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position: roleHint,
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: reservedSortOrder,
      isActive: true
    }
  });
}

async function seedAccount(input: { accountId: string; password: string; role: string; employeeId: string }) {
  const passwordHash = await hash(input.password, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: {
      email: `${input.accountId}@example.local`,
      passwordHash,
      role: input.role,
      employeeId: input.employeeId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: `${input.accountId}@example.local`,
      accountId: input.accountId,
      passwordHash,
      role: input.role,
      employeeId: input.employeeId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function upsertCoursePolicy(courseId: string, monthKey: string, code: string, basePrice: number, earcarePoolAmount: number, requiresSecondTherapist = false) {
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
  const data = {
    name: `Story 6.3 ${code}`,
    durationMinutes: requiresSecondTherapist ? 90 : 60,
    basePrice,
    opsCallCredit: 1,
    earcarePoolAmount,
    requiresSecondTherapist,
    tvDisplayName: `S63 ${code}`,
    effectiveToMonth: null,
    isActive: true
  };
  if (existing) return (prisma as any).coursePolicy.update({ where: { id: existing.id }, data });
  return (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...data } });
}

async function upsertTherapistRate(therapistId: string, courseId: string, monthKey: string, amount: number) {
  const existing = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId, courseId, effectiveFromMonth: monthKey } });
  const data = { amount, effectiveToMonth: null, isActive: true };
  if (existing) return (prisma as any).therapistCourseRate.update({ where: { id: existing.id }, data });
  return (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth: monthKey, ...data } });
}

async function cleanupStoryData(monthId: string) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: { operatingMonthId: monthId, customerMemo: { startsWith: "Story 6.3" } },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
  }
  await (prisma as any).dailyExpense.deleteMany({ where: { operatingMonthId: monthId, description: { startsWith: "Story 6.3" } } });
}

async function seedRoom(migrationReferenceName: string, displayName: string, sortOrder: number) {
  const room =
    (await (prisma as any).room.findFirst({ where: { migrationReferenceName } })) ??
    (await (prisma as any).room.create({
      data: {
        displayName,
        migrationReferenceName,
        sortOrder: await safeRoomSortOrder(migrationReferenceName, sortOrder),
        isActive: true
      }
    }));
  return (prisma as any).room.update({ where: { id: room.id }, data: { displayName, isActive: true } });
}

async function seedStoryData(workerIndex: number): Promise<SeededData> {
  const suffix = workerSuffix(workerIndex);
  const monthKey = monthKeyForWorker(workerIndex);
  const serviceDate = isoDate(monthKey, 10);
  const endDate = isoDate(monthKey, 28);
  const sortBase = 96300 + workerIndex * 100;
  const accountRoles = ["administrator", "counter", "settlement_manager", "read_only_viewer", "waiter"] as const;
  const accounts = {} as SeededData["accounts"];

  for (const [index, role] of accountRoles.entries()) {
    const employee = await seedEmployee(`E2E63-${suffix}-${role}`, `E2E63 ${role}`, "OPERATIONS", role, sortBase + index);
    accounts[role] = { accountId: `story63_${suffix}_${role}`.toLowerCase(), password: `Story63!${role}` };
    await seedAccount({ ...accounts[role], role, employeeId: employee.id });
  }

  const operatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { startDate: utcDate(isoDate(monthKey, 1)), endDate: utcDate(endDate), status: "작성중" },
    create: { monthKey, startDate: utcDate(isoDate(monthKey, 1)), endDate: utcDate(endDate), status: "작성중" }
  });

  await cleanupStoryData(operatingMonth.id);

  const room = await seedRoom(`E2E63-${suffix}-ROOM`, `E2E63 ${suffix} 101`, sortBase + 50);
  const cleaningRoom = await seedRoom(`E2E63-${suffix}-CLEANING`, `E2E63 ${suffix} 102`, sortBase + 51);
  const therapist1 = await seedEmployee(`E2E63-${suffix}-THR-1`, `E2E63 ${suffix} 마사지사1`, "THERAPIST", "마사지사", sortBase + 20);
  const therapist2 = await seedEmployee(`E2E63-${suffix}-THR-2`, `E2E63 ${suffix} 마사지사2`, "THERAPIST", "마사지사", sortBase + 21);
  const handler = await seedEmployee(`E2E63-${suffix}-OPS`, `E2E63 ${suffix} 지출담당`, "OPERATIONS", "팀장", sortBase + 22);

  const courses: Record<"A" | "B" | "C" | "D" | "E", { id: string }> = {} as any;
  for (const code of ["A", "B", "C", "D", "E"] as const) {
    courses[code] = await (prisma as any).course.upsert({ where: { code }, update: { isActive: true }, create: { code, isActive: true } });
  }
  await upsertCoursePolicy(courses.A.id, monthKey, "A", 1500000, 100000);
  await upsertCoursePolicy(courses.B.id, monthKey, "B", 1800000, 200000);
  await upsertCoursePolicy(courses.C.id, monthKey, "C", 2000000, 0);
  await upsertCoursePolicy(courses.D.id, monthKey, "D", 3200000, 0, true);
  await upsertCoursePolicy(courses.E.id, monthKey, "E", 3000000, 0);
  await upsertTherapistRate(therapist1.id, courses.A.id, monthKey, 700000);
  await upsertTherapistRate(therapist1.id, courses.B.id, monthKey, 900000);
  await upsertTherapistRate(therapist2.id, courses.A.id, monthKey, 700000);
  await upsertTherapistRate(therapist2.id, courses.B.id, monthKey, 900000);

  async function createCall(input: {
    id: string;
    day: number;
    startTime: string;
    roomId: string;
    courseId: string;
    status: string;
    assignments: Array<["THERAPIST_1" | "THERAPIST_2", string]>;
    discountTypeCode?: string | null;
  }) {
    return (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: operatingMonth.id,
        serviceDate: utcDate(isoDate(monthKey, input.day)),
        startTime: input.startTime,
        roomId: input.roomId,
        courseId: input.courseId,
        customerMemo: `Story 6.3 ${suffix} ${input.id}`,
        status: input.status,
        discountTypeCode: input.discountTypeCode ?? null,
        paymentMethodCode: "CASH",
        confirmationCode: "Y",
        assignments: {
          create: input.assignments.map(([assignmentRole, employeeId]) => ({
            assignmentRole,
            employeeId,
            isActive: true
          }))
        }
      }
    });
  }

  await createCall({
    id: "complete-a-selected",
    day: 10,
    startTime: "12:00",
    roomId: room.id,
    courseId: courses.A.id,
    status: "VISIT_COMPLETE",
    assignments: [["THERAPIST_1", therapist1.id]],
    discountTypeCode: "생일자"
  });
  await createCall({
    id: "in-use-room-status",
    day: 10,
    startTime: "20:00",
    roomId: room.id,
    courseId: courses.A.id,
    status: "사용중",
    assignments: [["THERAPIST_1", therapist1.id]]
  });
  await createCall({
    id: "cleaning-room-status",
    day: 10,
    startTime: "19:00",
    roomId: cleaningRoom.id,
    courseId: courses.B.id,
    status: "청소중",
    assignments: [["THERAPIST_1", therapist2.id]]
  });
  await createCall({
    id: "complete-b-same-therapist",
    day: 11,
    startTime: "12:00",
    roomId: room.id,
    courseId: courses.B.id,
    status: "방문완료",
    assignments: [
      ["THERAPIST_1", therapist1.id],
      ["THERAPIST_2", therapist1.id]
    ]
  });
  await createCall({ id: "noshow", day: 12, startTime: "12:00", roomId: room.id, courseId: courses.A.id, status: "노쇼", assignments: [["THERAPIST_1", therapist1.id]] });
  await createCall({
    id: "canceled",
    day: 12,
    startTime: "12:30",
    roomId: cleaningRoom.id,
    courseId: courses.A.id,
    status: "CANCELED",
    assignments: [["THERAPIST_1", therapist2.id]]
  });

  await (prisma as any).dailyExpense.create({
    data: {
      operatingMonthId: operatingMonth.id,
      expenseDate: utcDate(serviceDate),
      amount: 300000,
      description: `Story 6.3 ${suffix} expense`,
      handledByEmployeeId: handler.id,
      isActive: true
    }
  });

  return {
    monthId: operatingMonth.id,
    monthKey,
    serviceDate,
    endDate,
    therapist1Name: therapist1.displayName,
    accounts
  };
}

test.describe("Story 6.3 graph report", () => {
  test.beforeAll(async ({}, testInfo) => {
    seededData = await seedStoryData(testInfo.workerIndex);
  });

  test.afterAll(async () => {
    // 이 스펙이 시드한 콜/데이터를 운영월 범위로 정리한 뒤 연결을 닫는다.
    await cleanupStoryData(seededData.monthId);
    await prisma.$disconnect();
  });

  test("administrator sees canonical URL, chart labels, visible values, and table fallback", async ({ page }) => {
    await login(page, seededData.accounts.administrator.accountId, seededData.accounts.administrator.password);
    await page.goto(`/dashboard/reports?operatingMonthId=${seededData.monthId}&serviceDate=${seededData.serviceDate}`);

    await expect(page).toHaveURL(new RegExp(`/dashboard/reports\\?operatingMonthId=${seededData.monthId}&serviceDate=${seededData.serviceDate}`));
    await expect(page.getByRole("heading", { name: "그래프 리포트" })).toBeVisible();
    await expect(page.getByText("일별 매출 추이")).toBeVisible();
    await expect(page.getByText("코스별 콜/매출 비중")).toBeVisible();
    await expect(page.getByText("마사지사 담당 콜 순위")).toBeVisible();
    await expect(page.getByText("마사지사 정산 순위")).toBeVisible();
    await expect(page.getByText("객실 상태 분포")).toBeVisible();
    await expect(page.getByText("노쇼/취소 추이")).toBeVisible();
    await expect(page.getByText("운영팀 인센/월마감 지급 구성")).toBeVisible();
    await expect(page.getByRole("img", { name: "일별 방문완료 매출과 순매출 추이" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "방문완료 매출" })).toBeVisible();
    const selectedDateRevenueRow = page.getByRole("row").filter({ hasText: seededData.serviceDate }).first();
    await expect(selectedDateRevenueRow).toContainText("1,400,000 VND");
    await expect(selectedDateRevenueRow).toContainText("1,100,000 VND");
    await expect(selectedDateRevenueRow).toContainText("1건");
    await expect(page.getByText("A 코스")).toBeVisible();
    await expect(page.getByText("1건 · 1,400,000 VND · 콜 50% · 매출 43.8%")).toBeVisible();
    await expect(page.getByText("B 코스")).toBeVisible();
    await expect(page.getByText("1건 · 1,800,000 VND · 콜 50% · 매출 56.3%")).toBeVisible();
    await expect(page.getByText(seededData.therapist1Name)).toBeVisible();
    await expect(page.getByText("담당 3건 · 1번 2 · 2번 1")).toBeVisible();
    await expect(page.getByText("사용중")).toBeVisible();
    await expect(page.getByText("청소중")).toBeVisible();
    await expect(page.getByText("1개").first()).toBeVisible();
    const noShowCancelRow = page.getByRole("row").filter({ hasText: isoDate(seededData.monthKey, 12) }).last();
    await expect(noShowCancelRow).toContainText("1건");
  });

  test("out-of-range serviceDate is canonicalized to the selected operating month range", async ({ page }) => {
    await login(page, seededData.accounts.administrator.accountId, seededData.accounts.administrator.password);
    await page.goto(`/dashboard/reports?operatingMonthId=${seededData.monthId}&serviceDate=${isoDate(seededData.monthKey, 31)}`);

    await expect(page).toHaveURL(new RegExp(`/dashboard/reports\\?operatingMonthId=${seededData.monthId}&serviceDate=${seededData.endDate}`));
    await expect(page.getByLabel("조회날짜")).toHaveValue(seededData.endDate);
  });

  for (const role of ["counter", "settlement_manager", "read_only_viewer"] as const) {
    test(`${role} can access graph report`, async ({ page }) => {
      await login(page, seededData.accounts[role].accountId, seededData.accounts[role].password);
      await page.goto(`/dashboard/reports?operatingMonthId=${seededData.monthId}&serviceDate=${seededData.serviceDate}`);
      await expect(page.getByRole("heading", { name: "그래프 리포트" })).toBeVisible();
    });
  }

  test("waiter is redirected to rooms and does not see graph report nav", async ({ page }) => {
    await login(page, seededData.accounts.waiter.accountId, seededData.accounts.waiter.password);
    await page.goto(`/dashboard/reports?operatingMonthId=${seededData.monthId}&serviceDate=${seededData.serviceDate}`);
    await expect(page).toHaveURL(/\/rooms/);
    await expect(page.getByRole("link", { name: "그래프 리포트" })).toHaveCount(0);
  });

  test("loading and error files keep safe Korean copy and do not expose error.message", async () => {
    const loading = readFileSync("src/app/(erp)/dashboard/reports/loading.tsx", "utf8");
    const errorBoundary = readFileSync("src/app/(erp)/dashboard/reports/error.tsx", "utf8");

    expect(loading).toContain("그래프 리포트 로딩 중");
    expect(errorBoundary).toContain("그래프 리포트를 불러오지 못했습니다");
    expect(errorBoundary).not.toContain("error.message");
    expect(errorBoundary).toContain("다시 시도");
  });
});
