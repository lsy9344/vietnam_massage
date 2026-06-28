import { readFileSync } from "node:fs";
import { expect, test, type Locator } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";


type SeededData = {
  monthId: string;
  serviceDate: string;
  emptyDate: string;
  accounts: Record<"administrator" | "counter" | "settlement_manager" | "read_only_viewer" | "waiter", { accountId: string; password: string }>;
};

let seededData: SeededData;

function workerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

function monthKeyForWorker(workerIndex: number) {
  const monthNumber = workerIndex + 1;
  const year = 2046 + Math.floor((monthNumber - 1) / 12);
  const month = ((monthNumber - 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function isoDate(monthKey: string, day: number) {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function utcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function kpiTile(region: Locator, label: string) {
  return region.locator(":scope > div").filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*`) }).first();
}

async function expectStrongTone(region: Locator, label: string) {
  const tile = kpiTile(region, label);
  await expect(tile).toHaveClass(/border-2/);
  await expect(tile).toHaveClass(/border-brand/);
  const value = tile.locator("p").nth(1);
  await expect(value).toHaveClass(/text-3xl/);
  await expect(value).toHaveClass(/font-bold/);
  await expect(value).toHaveClass(/text-brand/);
}

async function expectCostTone(region: Locator, label: string) {
  const value = kpiTile(region, label).locator("p").nth(1);
  await expect(value).toHaveClass(/text-2xl/);
  await expect(value).toHaveClass(/font-semibold/);
  await expect(value).toHaveClass(/text-danger/);
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

  throw new Error(`No Story 6.1 employee sortOrder available for ${employeeGroup}:${staffCode}`);
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

  throw new Error(`No Story 6.1 room sortOrder available for ${migrationReferenceName}`);
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

async function upsertCodeItem(codeType: string, code: string, displayName: string, sortOrder: number) {
  await (prisma as any).codeItem.upsert({
    where: { codeType_code: { codeType, code } },
    update: { displayName, sortOrder, isActive: true },
    create: { codeType, code, displayName, sortOrder, isSystemDefault: false, isActive: true }
  });
}

async function upsertCoursePolicy(courseId: string, monthKey: string, code: string, basePrice: number, earcarePoolAmount: number, requiresSecondTherapist = false) {
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
  const data = {
    name: `Story 6.1 ${code}`,
    durationMinutes: requiresSecondTherapist ? 90 : 60,
    basePrice,
    opsCallCredit: 1,
    earcarePoolAmount,
    requiresSecondTherapist,
    tvDisplayName: `S61 ${code}`,
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
    where: { operatingMonthId: monthId, customerMemo: { startsWith: "Story 6.1" } },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
  }
  await (prisma as any).dailyExpense.deleteMany({ where: { operatingMonthId: monthId, description: { startsWith: "Story 6.1" } } });
}

async function seedStoryData(workerIndex: number): Promise<SeededData> {
  const suffix = workerSuffix(workerIndex);
  const monthKey = monthKeyForWorker(workerIndex);
  const serviceDate = isoDate(monthKey, 10);
  const emptyDate = isoDate(monthKey, 11);
  const sortBase = 96100 + workerIndex * 100;

  const accountRoles = ["administrator", "counter", "settlement_manager", "read_only_viewer", "waiter"] as const;
  const accounts = {} as SeededData["accounts"];
  for (const [index, role] of accountRoles.entries()) {
    const employee = await seedEmployee(`E2E61-${suffix}-${role}`, `E2E61 ${role}`, "OPERATIONS", role, sortBase + index);
    accounts[role] = { accountId: `story61_${suffix}_${role}`.toLowerCase(), password: `Story61!${role}` };
    await seedAccount({ ...accounts[role], role, employeeId: employee.id });
  }
  await upsertCodeItem("ATTENDANCE_STATUS", "NORMAL", "정상", sortBase + 30);
  await upsertCodeItem("ATTENDANCE_STATUS", "DAY_OFF", "휴무", sortBase + 31);

  const operatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { startDate: utcDate(isoDate(monthKey, 1)), endDate: utcDate(isoDate(monthKey, 28)), status: "작성중" },
    create: { monthKey, startDate: utcDate(isoDate(monthKey, 1)), endDate: utcDate(isoDate(monthKey, 28)), status: "작성중" }
  });
  await cleanupStoryData(operatingMonth.id);

  const room =
    (await (prisma as any).room.findFirst({ where: { migrationReferenceName: `E2E61-${suffix}-ROOM` } })) ??
    (await (prisma as any).room.create({
      data: {
        displayName: `E2E61 ${suffix} 101`,
        migrationReferenceName: `E2E61-${suffix}-ROOM`,
        sortOrder: await safeRoomSortOrder(`E2E61-${suffix}-ROOM`, sortBase + 50),
        isActive: true
      }
    }));
  await (prisma as any).room.update({ where: { id: room.id }, data: { displayName: `E2E61 ${suffix} 101`, isActive: true } });

  const therapist1 = await seedEmployee(`E2E61-${suffix}-THR-1`, `E2E61 ${suffix} 마사지사1`, "THERAPIST", "마사지사", sortBase + 20);
  const therapist2 = await seedEmployee(`E2E61-${suffix}-THR-2`, `E2E61 ${suffix} 마사지사2`, "THERAPIST", "마사지사", sortBase + 21);
  const handler = await seedEmployee(`E2E61-${suffix}-OPS`, `E2E61 ${suffix} 지출담당`, "OPERATIONS", "팀장", sortBase + 22);

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
  await upsertTherapistRate(therapist1.id, courses.D.id, monthKey, 900000);
  await upsertTherapistRate(therapist1.id, courses.E.id, monthKey, 0);
  await upsertTherapistRate(therapist2.id, courses.D.id, monthKey, 900000);

  async function createCall(input: {
    id: string;
    courseId: string;
    status: string;
    assignments: Array<["THERAPIST_1" | "THERAPIST_2", string]>;
    discountTypeCode?: string | null;
  }) {
    return (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: operatingMonth.id,
        serviceDate: utcDate(serviceDate),
        startTime: "12:00",
        roomId: room.id,
        courseId: input.courseId,
        customerMemo: `Story 6.1 ${suffix} ${input.id}`,
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

  await createCall({ id: "reserved", courseId: courses.A.id, status: "예약", assignments: [["THERAPIST_1", therapist1.id]] });
  await createCall({ id: "complete-a", courseId: courses.A.id, status: "VISIT_COMPLETE", assignments: [["THERAPIST_1", therapist1.id]], discountTypeCode: "생일자" });
  await createCall({
    id: "complete-b-same",
    courseId: courses.B.id,
    status: "방문완료",
    assignments: [
      ["THERAPIST_1", therapist1.id],
      ["THERAPIST_2", therapist1.id]
    ]
  });
  await createCall({
    id: "complete-d",
    courseId: courses.D.id,
    status: "VISIT_COMPLETE",
    assignments: [
      ["THERAPIST_1", therapist1.id],
      ["THERAPIST_2", therapist2.id]
    ]
  });
  await createCall({ id: "missing-rate", courseId: courses.C.id, status: "VISIT_COMPLETE", assignments: [["THERAPIST_1", therapist2.id]] });
  await createCall({ id: "invalid-d", courseId: courses.D.id, status: "VISIT_COMPLETE", assignments: [["THERAPIST_1", therapist1.id]] });
  await createCall({ id: "complete-e", courseId: courses.E.id, status: "방문완료", assignments: [["THERAPIST_1", therapist1.id]] });
  await createCall({ id: "noshow", courseId: courses.A.id, status: "노쇼", assignments: [["THERAPIST_1", therapist1.id]] });
  await createCall({ id: "canceled", courseId: courses.A.id, status: "CANCELED", assignments: [["THERAPIST_1", therapist1.id]] });

  await (prisma as any).dailyExpense.create({
    data: {
      operatingMonthId: operatingMonth.id,
      expenseDate: utcDate(serviceDate),
      amount: 300000,
      description: `Story 6.1 ${suffix} expense`,
      handledByEmployeeId: handler.id,
      isActive: true
    }
  });

  return { monthId: operatingMonth.id, serviceDate, emptyDate, accounts };
}

test.describe("Story 6.1 today dashboard", () => {
  test.beforeAll(async ({}, testInfo) => {
    seededData = await seedStoryData(testInfo.workerIndex);
  });

  test.afterAll(async () => {
    // 이 스펙이 시드한 콜/데이터를 운영월 범위로 정리한 뒤 연결을 닫는다.
    await cleanupStoryData(seededData.monthId);
    await prisma.$disconnect();
  });

  for (const role of ["administrator", "counter", "settlement_manager", "read_only_viewer"] as const) {
    test(`${role} can access /dashboard/today`, async ({ page }) => {
      const account = seededData.accounts[role];
      await login(page, account.accountId, account.password);
      await page.goto(`/dashboard/today?operatingMonthId=${seededData.monthId}&serviceDate=${seededData.serviceDate}`);
      await expect(page).toHaveURL(/\/dashboard\/today/);
      await expect(page.getByRole("heading", { name: "오늘 KPI 대시보드" })).toBeVisible();
    });
  }

  test("waiter is redirected away from /dashboard/today", async ({ page }) => {
    const account = seededData.accounts.waiter;
    await login(page, account.accountId, account.password);
    await page.goto(`/dashboard/today?operatingMonthId=${seededData.monthId}&serviceDate=${seededData.serviceDate}`);
    await expect(page).toHaveURL(/\/rooms$/);
  });

  test("운영월/날짜 선택과 KPI 카드, 코스별 완료, 마사지사 정산 요약을 표시한다", async ({ page }) => {
    const account = seededData.accounts.administrator;
    await login(page, account.accountId, account.password);
    await page.goto(`/dashboard/today?operatingMonthId=${seededData.monthId}&serviceDate=${seededData.serviceDate}`);

    await expect(page.getByRole("region", { name: "오늘 상태 건수", exact: true })).toContainText("예약");
    await expect(page.getByRole("region", { name: "오늘 상태 건수", exact: true })).toContainText("1건");
    await expect(page.getByRole("region", { name: "오늘 상태 건수", exact: true })).toContainText("방문완료");
    await expect(page.getByRole("region", { name: "오늘 상태 건수", exact: true })).toContainText("6건");
    await expect(page.getByRole("region", { name: "오늘 금액 KPI", exact: true })).toContainText("10,900,000 VND");
    await expect(page.getByRole("region", { name: "오늘 금액 KPI", exact: true })).toContainText("6,000,000 VND");
    const details = page.getByRole("region", { name: "상세 요약", exact: true });
    await expect(details).toContainText("코스별 방문완료");
    await expect(details).toContainText("A");
    await expect(page.getByLabel("B 코스 방문완료")).toContainText("담당 2건");
    await expect(page.getByLabel("D 코스 방문완료")).toContainText("담당 2건");
    await expect(details).toContainText("마사지사 담당콜/정산");
    await expect(details).toContainText("E2E61");
    await expect(page.getByRole("alert").filter({ hasText: "집계 제외 항목이 있습니다" })).toBeVisible();
  });

  test("결제합계와 순이익은 strong tone, 비용 항목은 cost tone으로 유지한다", async ({ page }) => {
    const account = seededData.accounts.administrator;
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, account.accountId, account.password);
    await page.goto(`/dashboard/today?operatingMonthId=${seededData.monthId}&serviceDate=${seededData.serviceDate}`);

    const money = page.getByRole("region", { name: "오늘 금액 KPI", exact: true });
    await expectStrongTone(money, "결제합계");
    await expectStrongTone(money, "순이익");
    for (const label of ["일일인센 합계", "지출합계", "마사지사 정산", "귀케어 정산", "일일비용 합계"]) {
      await expectCostTone(money, label);
    }
  });

  test("조회날짜 변경은 URL search params와 서버 데이터 기준 empty state를 갱신한다", async ({ page }) => {
    const account = seededData.accounts.administrator;
    await login(page, account.accountId, account.password);
    await page.goto(`/dashboard/today?operatingMonthId=${seededData.monthId}&serviceDate=${seededData.serviceDate}`);

    await page.getByLabel("조회날짜").fill(seededData.emptyDate);
    await page.getByRole("button", { name: "조회" }).click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/today\\?operatingMonthId=${seededData.monthId}&serviceDate=${seededData.emptyDate}`));
    await expect(page.getByText("이 날짜의 콜이 없습니다")).toBeVisible();
    await expect(page.getByRole("region", { name: "오늘 상태 건수", exact: true })).toContainText("예약");
    await expect(page.getByRole("region", { name: "오늘 상태 건수", exact: true })).toContainText("0건");
  });

  test("데이터 없는 날짜는 empty state를 표시한다", async ({ page }) => {
    const account = seededData.accounts.administrator;
    await login(page, account.accountId, account.password);
    await page.goto(`/dashboard/today?operatingMonthId=${seededData.monthId}&serviceDate=${seededData.emptyDate}`);

    await expect(page.getByText("이 날짜의 콜이 없습니다")).toBeVisible();
    await expect(page.getByRole("link", { name: "콜 원장으로 이동" })).toBeVisible();
  });

  test("loading UI presence and retry/error affordance are wired", async () => {
    const loading = readFileSync("src/app/(erp)/dashboard/today/loading.tsx", "utf8");
    const errorBoundary = readFileSync("src/app/(erp)/dashboard/today/error.tsx", "utf8");
    // i18n 전환: 한국어 문구는 messages/ko.ts로 이동했고 컴포넌트는 t() key로 참조한다.
    const koMessages = readFileSync("src/lib/i18n/messages/ko.ts", "utf8");

    expect(loading).toContain("dashboard.today.loading.aria");
    expect(koMessages).toContain("오늘 KPI 대시보드 로딩 중");
    expect(loading).toContain("Skeleton");
    expect(errorBoundary).toContain("dashboard.today.error.title");
    expect(koMessages).toContain("오늘 KPI를 불러오지 못했습니다");
    expect(errorBoundary).toContain("dashboard.error.retry");
    expect(koMessages).toContain("다시 시도");
    expect(errorBoundary).toContain("role=\"alert\"");
    expect(errorBoundary.includes("error.message")).toBe(false);
  });
});
