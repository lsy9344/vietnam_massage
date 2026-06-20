import { readFileSync } from "node:fs";
import { expect, test, type Locator } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";


type SeededData = {
  months: {
    draft: string;
    reviewReopened: string;
    closed: string;
    lockedMissing: string;
  };
  accounts: Record<"administrator" | "counter" | "settlement_manager" | "read_only_viewer" | "waiter", { accountId: string; password: string }>;
};

let seededData: SeededData;

function workerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

function monthKeyForWorker(workerIndex: number, offset: number) {
  const monthNumber = workerIndex * 4 + offset + 1;
  const year = 2056 + Math.floor((monthNumber - 1) / 12);
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

  throw new Error(`No Story 6.2 employee sortOrder available for ${employeeGroup}:${staffCode}`);
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

  throw new Error(`No Story 6.2 room sortOrder available for ${migrationReferenceName}`);
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
    name: `Story 6.2 ${code}`,
    durationMinutes: requiresSecondTherapist ? 90 : 60,
    basePrice,
    opsCallCredit: 1,
    earcarePoolAmount,
    requiresSecondTherapist,
    tvDisplayName: `S62 ${code}`,
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

async function cleanupStoryData(monthIds: string[]) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: { operatingMonthId: { in: monthIds }, customerMemo: { startsWith: "Story 6.2" } },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
  }
  await (prisma as any).dailyExpense.deleteMany({ where: { operatingMonthId: { in: monthIds }, description: { startsWith: "Story 6.2" } } });
}

function snapshotJson(input: { id: string; operatingMonthId: string; monthKey: string; confirmedAt: string; confirmedByAccountId: string }) {
  return {
    id: input.id,
    month: {
      operatingMonthId: input.operatingMonthId,
      monthKey: input.monthKey,
      startDate: isoDate(input.monthKey, 1),
      endDate: isoDate(input.monthKey, 28),
      statusAtConfirmation: "검토중",
      confirmedStatus: "마감확정",
      confirmedAt: input.confirmedAt,
      confirmedByAccountId: input.confirmedByAccountId
    },
    therapists: { rows: [], payoutAmount: 9100000, totalCallCount: 12 },
    operations: {
      dailyIncentiveAmount: 300000,
      monthlyIncentiveAmount: 500000,
      totalOpsPayoutAmount: 800000,
      monthlyOpsCallCredit: 12,
      appliedThresholdCallCount: null,
      ruleStatus: "not_applicable",
      warningMessages: [],
      rows: []
    },
    earcare: {
      earcarePoolTotal: 600000,
      distributedAmount: 600000,
      undistributedAmount: 0,
      sourceCallCount: 4,
      eligibleDayCount: 2,
      rows: []
    },
    financials: {
      paymentTotal: 10900000,
      netSales: 10650000,
      discountTotal: 100000,
      expenseTotal: 250000,
      earcarePoolTotal: 600000,
      therapistCommissionTotal: 4350000
    },
    totals: {
      therapistPayoutAmount: 9100000,
      opsDailyIncentiveAmount: 300000,
      opsMonthlyIncentiveAmount: 500000,
      earcarePayoutAmount: 600000,
      grandPayoutAmount: 10500000
    },
    warningCounts: { total: 1 },
    evidence: {
      period: `${isoDate(input.monthKey, 1)}~${isoDate(input.monthKey, 28)}`,
      sourceDayCount: 28,
      includedCallCount: 12,
      excludedCallCount: 1,
      fullAttendanceSourceStatus: "missing_story_4_1_source",
      fullAttendanceSourceDayCount: 0,
      countKingEligibleCount: 0,
      countKingExcludedCount: 0,
      countKingTieBreaker: "story-6-2-e2e",
      policyWarningCount: 0,
      warningCount: 1,
      representativeEvidence: {
        therapist: [],
        operationsDaily: [],
        operationsMonthly: [],
        earcare: []
      }
    },
    source: {
      serviceVersion: "monthly-closing-service:5.3",
      previewBasis: "listMonthlyClosingPreview",
      snapshotCreatedAt: input.confirmedAt
    }
  };
}

async function seedStoryData(workerIndex: number): Promise<SeededData> {
  const suffix = workerSuffix(workerIndex);
  const sortBase = 96200 + workerIndex * 100;
  const accountRoles = ["administrator", "counter", "settlement_manager", "read_only_viewer", "waiter"] as const;
  const accounts = {} as SeededData["accounts"];

  for (const [index, role] of accountRoles.entries()) {
    const employee = await seedEmployee(`E2E62-${suffix}-${role}`, `E2E62 ${role}`, "OPERATIONS", role, sortBase + index);
    accounts[role] = { accountId: `story62_${suffix}_${role}`.toLowerCase(), password: `Story62!${role}` };
    await seedAccount({ ...accounts[role], role, employeeId: employee.id });
  }
  await upsertCodeItem("ATTENDANCE_STATUS", "NORMAL", "정상", sortBase + 30);
  await upsertCodeItem("ATTENDANCE_STATUS", "DAY_OFF", "휴무", sortBase + 31);

  const monthKeys = {
    draft: monthKeyForWorker(workerIndex, 0),
    reviewReopened: monthKeyForWorker(workerIndex, 1),
    closed: monthKeyForWorker(workerIndex, 2),
    lockedMissing: monthKeyForWorker(workerIndex, 3)
  };
  const draft = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: monthKeys.draft },
    update: { startDate: utcDate(isoDate(monthKeys.draft, 1)), endDate: utcDate(isoDate(monthKeys.draft, 28)), status: "작성중" },
    create: { monthKey: monthKeys.draft, startDate: utcDate(isoDate(monthKeys.draft, 1)), endDate: utcDate(isoDate(monthKeys.draft, 28)), status: "작성중" }
  });
  const reviewReopened = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: monthKeys.reviewReopened },
    update: { startDate: utcDate(isoDate(monthKeys.reviewReopened, 1)), endDate: utcDate(isoDate(monthKeys.reviewReopened, 28)), status: "검토중" },
    create: {
      monthKey: monthKeys.reviewReopened,
      startDate: utcDate(isoDate(monthKeys.reviewReopened, 1)),
      endDate: utcDate(isoDate(monthKeys.reviewReopened, 28)),
      status: "검토중"
    }
  });
  const closed = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: monthKeys.closed },
    update: { startDate: utcDate(isoDate(monthKeys.closed, 1)), endDate: utcDate(isoDate(monthKeys.closed, 28)), status: "마감확정" },
    create: { monthKey: monthKeys.closed, startDate: utcDate(isoDate(monthKeys.closed, 1)), endDate: utcDate(isoDate(monthKeys.closed, 28)), status: "마감확정" }
  });
  const lockedMissing = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: monthKeys.lockedMissing },
    update: { startDate: utcDate(isoDate(monthKeys.lockedMissing, 1)), endDate: utcDate(isoDate(monthKeys.lockedMissing, 28)), status: "잠금" },
    create: {
      monthKey: monthKeys.lockedMissing,
      startDate: utcDate(isoDate(monthKeys.lockedMissing, 1)),
      endDate: utcDate(isoDate(monthKeys.lockedMissing, 28)),
      status: "잠금"
    }
  });

  await cleanupStoryData([draft.id, reviewReopened.id, closed.id, lockedMissing.id]);
  await (prisma as any).monthlyClosing.deleteMany({ where: { operatingMonthId: { in: [draft.id, reviewReopened.id, closed.id, lockedMissing.id] } } });
  await (prisma as any).monthlyClosing.create({
    data: {
      operatingMonthId: closed.id,
      closeVersion: 2,
      snapshotJson: snapshotJson({
        id: "story-6-2-snapshot",
        operatingMonthId: closed.id,
        monthKey: monthKeys.closed,
        confirmedAt: "2056-02-28T15:00:00.000Z",
        confirmedByAccountId: accounts.administrator.accountId
      }),
      confirmedByAccountId: (
        await (prisma as any).userAccount.findUnique({
          where: { accountId: accounts.administrator.accountId },
          select: { id: true }
        })
      ).id,
      confirmedAt: new Date("2056-02-28T15:00:00.000Z")
    }
  });
  await (prisma as any).monthlyClosing.create({
    data: {
      operatingMonthId: reviewReopened.id,
      closeVersion: 1,
      snapshotJson: snapshotJson({
        id: `story-6-2-previous-snapshot-${suffix}`,
        operatingMonthId: reviewReopened.id,
        monthKey: monthKeys.reviewReopened,
        confirmedAt: "2056-02-28T15:00:00.000Z",
        confirmedByAccountId: accounts.administrator.accountId
      }),
      confirmedByAccountId: (
        await (prisma as any).userAccount.findUnique({
          where: { accountId: accounts.administrator.accountId },
          select: { id: true }
        })
      ).id,
      confirmedAt: new Date("2056-02-28T15:00:00.000Z"),
      reopenedAt: new Date("2056-03-01T01:00:00.000Z"),
      reopenedByAccountId: (
        await (prisma as any).userAccount.findUnique({
          where: { accountId: accounts.administrator.accountId },
          select: { id: true }
        })
      ).id,
      reopenReason: "Story 6.2 reopened current source separation"
    }
  });

  const room =
    (await (prisma as any).room.findFirst({ where: { migrationReferenceName: `E2E62-${suffix}-ROOM` } })) ??
    (await (prisma as any).room.create({
      data: {
        displayName: `E2E62 ${suffix} 101`,
        migrationReferenceName: `E2E62-${suffix}-ROOM`,
        sortOrder: await safeRoomSortOrder(`E2E62-${suffix}-ROOM`, sortBase + 50),
        isActive: true
      }
    }));
  await (prisma as any).room.update({ where: { id: room.id }, data: { displayName: `E2E62 ${suffix} 101`, isActive: true } });

  const therapist1 = await seedEmployee(`E2E62-${suffix}-THR-1`, `E2E62 ${suffix} 마사지사1`, "THERAPIST", "마사지사", sortBase + 20);
  const therapist2 = await seedEmployee(`E2E62-${suffix}-THR-2`, `E2E62 ${suffix} 마사지사2`, "THERAPIST", "마사지사", sortBase + 21);
  const handler = await seedEmployee(`E2E62-${suffix}-OPS`, `E2E62 ${suffix} 지출담당`, "OPERATIONS", "팀장", sortBase + 22);

  const courses: Record<"A" | "B" | "C" | "D" | "E", { id: string }> = {} as any;
  for (const code of ["A", "B", "C", "D", "E"] as const) {
    courses[code] = await (prisma as any).course.upsert({ where: { code }, update: { isActive: true }, create: { code, isActive: true } });
  }
  await upsertCoursePolicy(courses.A.id, monthKeys.draft, "A", 1500000, 100000);
  await upsertCoursePolicy(courses.B.id, monthKeys.draft, "B", 1800000, 200000);
  await upsertCoursePolicy(courses.C.id, monthKeys.draft, "C", 2000000, 0);
  await upsertCoursePolicy(courses.D.id, monthKeys.draft, "D", 3200000, 0, true);
  await upsertCoursePolicy(courses.E.id, monthKeys.draft, "E", 3000000, 0);
  await upsertTherapistRate(therapist1.id, courses.A.id, monthKeys.draft, 700000);
  await upsertTherapistRate(therapist1.id, courses.B.id, monthKeys.draft, 900000);
  await upsertTherapistRate(therapist1.id, courses.D.id, monthKeys.draft, 900000);
  await upsertTherapistRate(therapist1.id, courses.E.id, monthKeys.draft, 0);
  await upsertTherapistRate(therapist2.id, courses.D.id, monthKeys.draft, 900000);

  async function createDraftCall(input: {
    id: string;
    day: number;
    courseId: string;
    status: string;
    assignments: Array<["THERAPIST_1" | "THERAPIST_2", string]>;
    discountTypeCode?: string | null;
  }) {
    return (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: draft.id,
        serviceDate: utcDate(isoDate(monthKeys.draft, input.day)),
        startTime: "12:00",
        roomId: room.id,
        courseId: input.courseId,
        customerMemo: `Story 6.2 ${suffix} ${input.id}`,
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

  await createDraftCall({ id: "reserved", day: 2, courseId: courses.A.id, status: "예약", assignments: [["THERAPIST_1", therapist1.id]] });
  await createDraftCall({
    id: "complete-a",
    day: 3,
    courseId: courses.A.id,
    status: "VISIT_COMPLETE",
    assignments: [["THERAPIST_1", therapist1.id]],
    discountTypeCode: "생일자"
  });
  await createDraftCall({
    id: "complete-b-same",
    day: 11,
    courseId: courses.B.id,
    status: "방문완료",
    assignments: [
      ["THERAPIST_1", therapist1.id],
      ["THERAPIST_2", therapist1.id]
    ]
  });
  await createDraftCall({
    id: "complete-d",
    day: 20,
    courseId: courses.D.id,
    status: "VISIT_COMPLETE",
    assignments: [
      ["THERAPIST_1", therapist1.id],
      ["THERAPIST_2", therapist2.id]
    ]
  });
  await createDraftCall({ id: "missing-rate", day: 21, courseId: courses.C.id, status: "VISIT_COMPLETE", assignments: [["THERAPIST_1", therapist2.id]] });
  await createDraftCall({ id: "invalid-d", day: 22, courseId: courses.D.id, status: "VISIT_COMPLETE", assignments: [["THERAPIST_1", therapist1.id]] });
  await createDraftCall({ id: "complete-e", day: 27, courseId: courses.E.id, status: "방문완료", assignments: [["THERAPIST_1", therapist1.id]] });
  await createDraftCall({ id: "noshow", day: 28, courseId: courses.A.id, status: "노쇼", assignments: [["THERAPIST_1", therapist1.id]] });
  await createDraftCall({ id: "canceled", day: 28, courseId: courses.A.id, status: "CANCELED", assignments: [["THERAPIST_1", therapist1.id]] });

  await (prisma as any).dailyExpense.create({
    data: {
      operatingMonthId: draft.id,
      expenseDate: utcDate(isoDate(monthKeys.draft, 12)),
      amount: 300000,
      description: `Story 6.2 ${suffix} expense`,
      handledByEmployeeId: handler.id,
      isActive: true
    }
  });

  return {
    months: { draft: draft.id, reviewReopened: reviewReopened.id, closed: closed.id, lockedMissing: lockedMissing.id },
    accounts
  };
}

test.describe("Story 6.2 monthly dashboard", () => {
  test.beforeAll(async ({}, testInfo) => {
    seededData = await seedStoryData(testInfo.workerIndex);
  });

  test.afterAll(async () => {
    if (!seededData) {
      await prisma.$disconnect();
      return;
    }

    // 이 스펙이 시드한 4개 운영월의 콜/데이터를 범위로 정리한 뒤 연결을 닫는다.
    try {
      await cleanupStoryData([
        seededData.months.draft,
        seededData.months.reviewReopened,
        seededData.months.closed,
        seededData.months.lockedMissing
      ]);
    } finally {
      await prisma.$disconnect();
    }
  });

  for (const role of ["administrator", "counter", "settlement_manager", "read_only_viewer"] as const) {
    test(`${role} can access /dashboard/monthly`, async ({ page }) => {
      const account = seededData.accounts[role];
      await login(page, account.accountId, account.password);
      await page.goto(`/dashboard/monthly?operatingMonthId=${seededData.months.closed}`);
      await expect(page).toHaveURL(/\/dashboard\/monthly/);
      await expect(page.getByRole("heading", { name: "월간 KPI 대시보드" })).toBeVisible();
    });
  }

  test("waiter is redirected away from /dashboard/monthly", async ({ page }) => {
    const account = seededData.accounts.waiter;
    await login(page, account.accountId, account.password);
    await page.goto(`/dashboard/monthly?operatingMonthId=${seededData.months.closed}`);
    await expect(page).toHaveURL(/\/rooms$/);
  });

  test("확정 월은 URL search params를 유지하고 확정 스냅샷 KPI를 표시한다", async ({ page }) => {
    const account = seededData.accounts.administrator;
    await login(page, account.accountId, account.password);
    await page.goto(`/dashboard/monthly?operatingMonthId=${seededData.months.closed}`);

    await expect(page).toHaveURL(new RegExp(`/dashboard/monthly\\?operatingMonthId=${seededData.months.closed}`));
    await expect(page.getByRole("region", { name: "월간 KPI 기준", exact: true })).toContainText("확정 스냅샷 기준");
    await expect(page.getByRole("region", { name: "월간 KPI 기준", exact: true })).toContainText("closeVersion 2");
    await expect(page.getByRole("region", { name: "월간 지급 정산 KPI", exact: true })).toContainText("10,500,000 VND");
    await expect(page.getByRole("region", { name: "월간 상태 건수", exact: true })).toContainText("예약");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("결제합계");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("운영팀 월인센");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("만근수당");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("갯수왕");
    await expect(page.getByRole("region", { name: "월간 코스별 방문완료", exact: true })).toContainText("A");
  });

  test("운영월 선택 변경은 URL search params와 서버 데이터 기준 KPI를 갱신한다", async ({ page }) => {
    const account = seededData.accounts.administrator;
    await login(page, account.accountId, account.password);
    await page.goto(`/dashboard/monthly?operatingMonthId=${seededData.months.closed}`);

    await page.getByLabel("운영월").selectOption(seededData.months.draft);
    await page.getByRole("button", { name: "조회" }).click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/monthly\\?operatingMonthId=${seededData.months.draft}`));
    await expect(page.getByRole("region", { name: "월간 KPI 기준", exact: true })).toContainText("미확정 현재 기준", { timeout: 45000 });
    await expect(page.getByRole("region", { name: "월간 상태 건수", exact: true })).toContainText("방문완료");
    await expect(page.getByRole("region", { name: "월간 상태 건수", exact: true })).toContainText("6건");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("10,900,000 VND");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("6,000,000 VND");
  });

  test("작성중 운영월은 월 전체 날짜 범위의 current KPI와 warning state를 표시한다", async ({ page }) => {
    const account = seededData.accounts.administrator;
    await login(page, account.accountId, account.password);
    await page.goto(`/dashboard/monthly?operatingMonthId=${seededData.months.draft}`);

    await expect(page.getByRole("region", { name: "월간 KPI 기준", exact: true })).toContainText("미확정 현재 기준");
    await expect(page.getByRole("region", { name: "월간 상태 건수", exact: true })).toContainText("예약");
    await expect(page.getByRole("region", { name: "월간 상태 건수", exact: true })).toContainText("1건");
    await expect(page.getByRole("region", { name: "월간 상태 건수", exact: true })).toContainText("방문완료");
    await expect(page.getByRole("region", { name: "월간 상태 건수", exact: true })).toContainText("6건");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("결제합계");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("10,900,000 VND");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("월간 순이익");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("6,000,000 VND");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("운영팀 월인센");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("만근수당");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toContainText("갯수왕");
    await expect(page.getByLabel("A 코스 방문완료")).toContainText("1");
    await expect(page.getByLabel("B 코스 방문완료")).toContainText("담당 2건");
    await expect(page.getByLabel("D 코스 방문완료")).toContainText("담당 2건");
    const warning = page.getByRole("alert").filter({ hasText: "집계 제외 항목이 있습니다" });
    await expect(warning).toContainText("집계 제외 항목이 있습니다");
    await expect(warning).toContainText("수당 누락 1건");
    await expect(warning).toContainText("D코스 마사지사2 필요 1건");
  });

  test("월간 금액 KPI는 순이익/비용 구분과 월간 비용 라벨을 브라우저 DOM class로 유지한다", async ({ page }) => {
    const account = seededData.accounts.administrator;
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, account.accountId, account.password);
    await page.goto(`/dashboard/monthly?operatingMonthId=${seededData.months.draft}`);

    const money = page.getByRole("region", { name: "월간 금액 KPI", exact: true });
    await expectStrongTone(money, "결제합계");
    await expectStrongTone(money, "월간 순이익");
    for (const label of ["일일비용 합계", "월간비용 합계", "운영팀 월인센", "만근수당", "갯수왕"]) {
      await expect(money).toContainText(label);
      await expectCostTone(money, label);
    }
  });

  test("재오픈 검토중 월은 current source와 이전 확정 스냅샷을 분리 표시한다", async ({ page }) => {
    const account = seededData.accounts.administrator;
    await login(page, account.accountId, account.password);
    await page.goto(`/dashboard/monthly?operatingMonthId=${seededData.months.reviewReopened}`);

    await expect(page.getByRole("region", { name: "월간 KPI 기준", exact: true })).toContainText("미확정 현재 기준");
    await expect(page.getByRole("region", { name: "이전 확정 스냅샷", exact: true })).toContainText("현재 KPI 기준에는 섞지 않습니다");
    await expect(page.getByRole("region", { name: "이전 확정 스냅샷", exact: true })).toContainText("closeVersion 1");
    await expect(page.getByRole("region", { name: "이전 확정 스냅샷", exact: true })).toContainText("10,500,000 VND");
    await expect(page.getByText("이 운영월의 콜이 없습니다")).toBeVisible();
  });

  test("잠금 월에 snapshot이 없으면 current 지급값으로 대체하지 않는 별도 상태를 표시한다", async ({ page }) => {
    const account = seededData.accounts.administrator;
    await login(page, account.accountId, account.password);
    await page.goto(`/dashboard/monthly?operatingMonthId=${seededData.months.lockedMissing}`);

    await expect(page.getByRole("alert").filter({ hasText: "확정 스냅샷을 찾을 수 없습니다" })).toBeVisible();
    await expect(page.getByRole("region", { name: "지급 요약 없음" })).toContainText("현재 지급 계산값으로 대체하지 않았습니다");
    // 잠금 월에 스냅샷이 없으면 금액 KPI(결제합계/순이익/비용)도 현재 재계산값으로 대체하지 않는다.
    await expect(page.getByRole("alert", { name: "월간 금액 KPI 표시 보류" })).toContainText("확정 스냅샷에서만 산출합니다");
    await expect(page.getByRole("region", { name: "월간 금액 KPI", exact: true })).toHaveCount(0);
  });

  test("loading UI presence and retry/error affordance are wired", async () => {
    const loading = readFileSync("src/app/(erp)/dashboard/monthly/loading.tsx", "utf8");
    const errorBoundary = readFileSync("src/app/(erp)/dashboard/monthly/error.tsx", "utf8");

    expect(loading).toContain("월간 KPI 대시보드 로딩 중");
    expect(loading).toContain("Skeleton");
    expect(errorBoundary).toContain("월간 KPI를 불러오지 못했습니다");
    expect(errorBoundary).toContain("다시 시도");
    expect(errorBoundary).toContain("role=\"alert\"");
    expect(errorBoundary.includes("error.message")).toBe(false);
  });
});
