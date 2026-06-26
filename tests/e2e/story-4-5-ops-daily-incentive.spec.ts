import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";


type SeededData = {
  writableOperatingMonthId: string;
  lockedOperatingMonthId: string;
  missingPolicyOperatingMonthId: string;
};

let seededData: SeededData;


async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, sortOrder: number, isActive = true) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive },
    create: { staffCode, displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive }
  });
}

async function seedAuthAccount(input: { accountId: string; password: string; role: string; employeeId: string }) {
  const passwordHash = await hash(input.password, argon2idOptions);
  return (prisma as any).userAccount.upsert({
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

async function seedAttendanceCode(code: string, displayName: string, sortOrder: number) {
  return (prisma as any).codeItem.upsert({
    where: { codeType_code: { codeType: "ATTENDANCE_STATUS", code } },
    update: { displayName, sortOrder, isActive: true },
    create: { codeType: "ATTENDANCE_STATUS", code, displayName, sortOrder, isSystemDefault: true, isActive: true }
  });
}

async function upsertCoursePolicy(courseId: string, effectiveFromMonth: string, name: string, opsCallCredit: number) {
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth } });
  const data = {
    name,
    durationMinutes: 60,
    basePrice: 1500000,
    opsCallCredit,
    earcarePoolAmount: 0,
    requiresSecondTherapist: false,
    tvDisplayName: name,
    effectiveToMonth: null,
    isActive: true
  };
  if (existing) return (prisma as any).coursePolicy.update({ where: { id: existing.id }, data });
  return (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth, ...data } });
}

async function upsertRate(therapistId: string, courseId: string, effectiveFromMonth: string, amount: number) {
  const existing = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId, courseId, effectiveFromMonth } });
  const data = { amount, effectiveToMonth: null, isActive: true };
  if (existing) return (prisma as any).therapistCourseRate.update({ where: { id: existing.id }, data });
  return (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth, ...data } });
}

async function upsertDailyRule(thresholdCallCount: number, personalAmount: number, effectiveFromMonth: string) {
  const existing = await (prisma as any).opsDailyIncentiveRule.findFirst({ where: { thresholdCallCount, effectiveFromMonth } });
  const data = { personalAmount, effectiveToMonth: null, isActive: true };
  if (existing) return (prisma as any).opsDailyIncentiveRule.update({ where: { id: existing.id }, data });
  return (prisma as any).opsDailyIncentiveRule.create({ data: { thresholdCallCount, effectiveFromMonth, ...data } });
}

async function cleanupStoryData(operatingMonthIds: string[]) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: { operatingMonthId: { in: operatingMonthIds }, customerMemo: { startsWith: "Story 4.5" } },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
  }
  await (prisma as any).opsAttendance.deleteMany({ where: { operatingMonthId: { in: operatingMonthIds } } });
}

async function createCall(input: {
  operatingMonthId: string;
  serviceDate: Date;
  roomId: string;
  courseId: string;
  memo: string;
  status: string;
  therapist1Id: string;
}) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: input.operatingMonthId,
      serviceDate: input.serviceDate,
      startTime: "16:00",
      roomId: input.roomId,
      courseId: input.courseId,
      customerMemo: input.memo,
      status: input.status,
      discountTypeCode: null,
      paymentMethodCode: "CASH",
      confirmationCode: null
    }
  });

  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapist1Id, isActive: true }
  });
}

async function seedAttendance(operatingMonthId: string, attendanceDate: string, employeeId: string, statusCode: string) {
  return (prisma as any).opsAttendance.upsert({
    where: {
      operatingMonthId_attendanceDate_employeeId: {
        operatingMonthId,
        attendanceDate: new Date(`${attendanceDate}T00:00:00.000Z`),
        employeeId
      }
    },
    update: { statusCode, isActive: true },
    create: { operatingMonthId, attendanceDate: new Date(`${attendanceDate}T00:00:00.000Z`), employeeId, statusCode, isActive: true }
  });
}

async function seedStoryData(): Promise<SeededData> {
  const settlementEmployee = await seedEmployee("E2E45-AUTH-001", "E2E45 정산담당", "BACKOFFICE", "정산", 94500);
  const counterEmployee = await seedEmployee("E2E45-AUTH-002", "E2E45 카운터", "BACKOFFICE", "카운터", 94501);
  await seedAuthAccount({ accountId: "story45_settlement", password: "Story45!settlement", role: "settlement_manager", employeeId: settlementEmployee.id });
  await seedAuthAccount({ accountId: "story45_counter", password: "Story45!counter", role: "counter", employeeId: counterEmployee.id });

  await seedAttendanceCode("NORMAL", "정상", 10);
  await seedAttendanceCode("DAY_OFF", "휴무", 20);
  await seedAttendanceCode("LATE", "지각", 30);
  await seedAttendanceCode("EARLY_LEAVE", "조퇴", 40);
  await seedAttendanceCode("ABSENT", "결근", 50);

  const opsLead = await seedEmployee("E2E45-OPS-001", "E2E45 팀장", "OPERATIONS", "팀장", 94510);
  const opsCounter1 = await seedEmployee("E2E45-OPS-002", "E2E45 카운터1", "OPERATIONS", "카운터", 94511);
  const opsCounter2 = await seedEmployee("E2E45-OPS-003", "E2E45 카운터2", "OPERATIONS", "카운터", 94512);
  const opsWaiter1 = await seedEmployee("E2E45-OPS-004", "E2E45 웨이터1", "OPERATIONS", "웨이터", 94513);
  const opsWaiter2 = await seedEmployee("E2E45-OPS-005", "E2E45 웨이터2", "OPERATIONS", "웨이터", 94514);
  const therapist = await seedEmployee("E2E45-THR-001", "E2E45 마사지사", "THERAPIST", "마사지사", 94520);

  const writableOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2035-05" },
    update: { startDate: new Date("2035-05-01T00:00:00.000Z"), endDate: new Date("2035-05-31T00:00:00.000Z"), status: "작성중" },
    create: { monthKey: "2035-05", startDate: new Date("2035-05-01T00:00:00.000Z"), endDate: new Date("2035-05-31T00:00:00.000Z"), status: "작성중" }
  });
  const lockedOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2035-06" },
    update: { startDate: new Date("2035-06-01T00:00:00.000Z"), endDate: new Date("2035-06-30T00:00:00.000Z"), status: "잠금" },
    create: { monthKey: "2035-06", startDate: new Date("2035-06-01T00:00:00.000Z"), endDate: new Date("2035-06-30T00:00:00.000Z"), status: "잠금" }
  });
  const missingPolicyOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "1999-01" },
    update: { startDate: new Date("1999-01-01T00:00:00.000Z"), endDate: new Date("1999-01-31T00:00:00.000Z"), status: "작성중" },
    create: { monthKey: "1999-01", startDate: new Date("1999-01-01T00:00:00.000Z"), endDate: new Date("1999-01-31T00:00:00.000Z"), status: "작성중" }
  });
  await cleanupStoryData([writableOperatingMonth.id, lockedOperatingMonth.id, missingPolicyOperatingMonth.id]);

  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 94501 },
    update: { displayName: "E2E45 호실", migrationReferenceName: "E2E45-ROOM", isActive: true },
    create: { displayName: "E2E45 호실", migrationReferenceName: "E2E45-ROOM", sortOrder: 94501, isActive: true }
  });
  await (prisma as any).timeSlot.upsert({
    where: { value: "16:00" },
    update: { sortOrder: 94501, isActive: true },
    create: { value: "16:00", sortOrder: 94501, isActive: true }
  });
  const aCourse = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
  const bCourse = await (prisma as any).course.upsert({ where: { code: "B" }, update: { isActive: true }, create: { code: "B", isActive: true } });
  const cCourse = await (prisma as any).course.upsert({ where: { code: "C" }, update: { isActive: true }, create: { code: "C", isActive: true } });
  await upsertCoursePolicy(aCourse.id, "2035-05", "Story45 A", 20);
  await upsertCoursePolicy(bCourse.id, "2035-05", "Story45 B", 20);
  await upsertCoursePolicy(cCourse.id, "2035-05", "Story45 C", 10);
  await upsertCoursePolicy(aCourse.id, "2035-06", "Story45 A locked", 50);
  await upsertCoursePolicy(aCourse.id, "1999-01", "Story45 A missing policy", 50);
  await upsertRate(therapist.id, aCourse.id, "2035-05", 700000);
  await upsertRate(therapist.id, bCourse.id, "2035-05", 900000);
  await upsertRate(therapist.id, cCourse.id, "2035-05", 900000);
  await upsertRate(therapist.id, aCourse.id, "2035-06", 700000);
  await upsertRate(therapist.id, aCourse.id, "1999-01", 700000);
  await upsertDailyRule(30, 50000, "2035-05");
  await upsertDailyRule(40, 100000, "2035-05");
  await upsertDailyRule(50, 200000, "2035-05");
  await upsertDailyRule(30, 50000, "2035-06");
  await upsertDailyRule(40, 100000, "2035-06");
  await upsertDailyRule(50, 200000, "2035-06");

  for (const [serviceDate, courses] of [
    ["2035-05-11", [aCourse, cCourse]],
    ["2035-05-12", [aCourse, bCourse]],
    ["2035-05-13", [aCourse]],
    ["2035-05-14", [aCourse, bCourse, cCourse]]
  ] as const) {
    for (const course of courses) {
      await createCall({
        operatingMonthId: writableOperatingMonth.id,
        serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
        roomId: room.id,
        courseId: course.id,
        memo: `Story 4.5 complete ${serviceDate} ${course.code}`,
        status: "VISIT_COMPLETE",
        therapist1Id: therapist.id
      });
    }
  }
  await createCall({
    operatingMonthId: writableOperatingMonth.id,
    serviceDate: new Date("2035-05-12T00:00:00.000Z"),
    roomId: room.id,
    courseId: aCourse.id,
    memo: "Story 4.5 reserved excluded",
    status: "예약",
    therapist1Id: therapist.id
  });
  await createCall({
    operatingMonthId: lockedOperatingMonth.id,
    serviceDate: new Date("2035-06-12T00:00:00.000Z"),
    roomId: room.id,
    courseId: aCourse.id,
    memo: "Story 4.5 locked readable",
    status: "VISIT_COMPLETE",
    therapist1Id: therapist.id
  });
  await createCall({
    operatingMonthId: missingPolicyOperatingMonth.id,
    serviceDate: new Date("1999-01-12T00:00:00.000Z"),
    roomId: room.id,
    courseId: aCourse.id,
    memo: "Story 4.5 missing policy readable",
    status: "VISIT_COMPLETE",
    therapist1Id: therapist.id
  });

  for (const [operatingMonthId, date] of [
    [writableOperatingMonth.id, "2035-05-11"],
    [writableOperatingMonth.id, "2035-05-12"],
    [writableOperatingMonth.id, "2035-05-13"],
    [writableOperatingMonth.id, "2035-05-14"],
    [lockedOperatingMonth.id, "2035-06-12"],
    [missingPolicyOperatingMonth.id, "1999-01-12"]
  ] as const) {
    await seedAttendance(operatingMonthId, date, opsLead.id, "NORMAL");
    await seedAttendance(operatingMonthId, date, opsCounter1.id, "NORMAL");
    await seedAttendance(operatingMonthId, date, opsCounter2.id, "DAY_OFF");
    await seedAttendance(operatingMonthId, date, opsWaiter1.id, "LATE");
    await seedAttendance(operatingMonthId, date, opsWaiter2.id, "NORMAL");
  }

  return {
    writableOperatingMonthId: writableOperatingMonth.id,
    lockedOperatingMonthId: lockedOperatingMonth.id,
    missingPolicyOperatingMonthId: missingPolicyOperatingMonth.id
  };
}

test.afterAll(async () => {
  // 이 스펙이 시드한 콜/출퇴근 데이터를 운영월 범위로 정리한 뒤 연결을 닫는다.
  await cleanupStoryData([
    seededData.writableOperatingMonthId,
    seededData.lockedOperatingMonthId,
    seededData.missingPolicyOperatingMonthId
  ]);
  await prisma.$disconnect();
});

test.describe("Story 4.5 operations daily incentive", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    seededData = await seedStoryData();
  });

  test("settlement manager can query operations attendance, daily call credit, threshold, payout rows, evidence, and warnings", async ({ page }) => {
    await login(page, "story45_settlement", "Story45!settlement");
    await page.goto(`/settlements/operations?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2035-05-12`);

    await expect(page.getByRole("heading", { name: "운영팀 근무/일일인센" })).toBeVisible();
    await expect(page.getByLabel("운영월")).toHaveValue(seededData.writableOperatingMonthId);
    await expect(page.getByLabel("조회날짜")).toHaveValue("2035-05-12");
    await expect(page.getByText("일 총콜")).toBeVisible();
    await expect(page.getByText("40콜")).toBeVisible();
    await expect(page.getByText("40콜 이상")).toBeVisible();
    await expect(page.getByText("개인별 100,000 VND")).toBeVisible();
    await expect(page.getByText("지급 합계 300,000 VND")).toBeVisible();
    await expect(page.getByText("운영팀 직원별 일일 인센")).toBeVisible();
    await expect(page.getByLabel("E2E45 팀장 근무상태").locator("option")).toContainText(["정상", "휴무", "지각", "조퇴", "결근"]);
    await expect(page.getByRole("row").filter({ hasText: "E2E45 팀장" }).getByText("100,000 VND")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "E2E45 카운터2" }).getByText("제외: 휴무")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "E2E45 웨이터1" }).getByText("제외: 지각")).toBeVisible();
    await expect(page.getByText("일 총콜 산출 근거")).toBeVisible();
    await expect(page.getByText("비완료 1, 정책없음 0, 수당없음 0, D코스누락 0")).toBeVisible();
    await expect(page.getByRole("button", { name: /지급/ })).toHaveCount(0);
  });

  test("attendance status change refreshes same-route payout summary", async ({ page }) => {
    await login(page, "story45_settlement", "Story45!settlement");
    await page.goto(`/settlements/operations?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2035-05-12`);

    const counter1Row = page.getByRole("row").filter({ hasText: "E2E45 카운터1" }).last();
    await counter1Row.getByLabel("E2E45 카운터1 근무상태").selectOption("DAY_OFF");
    await counter1Row.getByRole("button", { name: "저장" }).click();
    await expect(counter1Row.getByText("저장됨")).toBeVisible();

    await expect(page.getByText("정상 지급 대상")).toBeVisible();
    await expect(page.getByText("2명")).toBeVisible();
    await expect(page.getByText("지급 합계 200,000 VND")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "E2E45 카운터1" }).first().getByText("제외: 휴무")).toBeVisible();
  });

  test("shows 30 미만, 30콜, and 50콜 threshold bands", async ({ page }) => {
    await login(page, "story45_settlement", "Story45!settlement");
    await page.goto(`/settlements/operations?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2035-05-13`);
    await expect(page.getByText("20콜")).toBeVisible();
    await expect(page.getByText("30콜 미만")).toBeVisible();
    await expect(page.getByText("지급 합계 0 VND")).toBeVisible();

    await page.goto(`/settlements/operations?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2035-05-11`);
    await expect(page.getByText("30콜")).toBeVisible();
    await expect(page.getByText("30콜 이상")).toBeVisible();
    await expect(page.getByText("개인별 50,000 VND")).toBeVisible();
    await expect(page.getByText("지급 합계 150,000 VND")).toBeVisible();

    await page.goto(`/settlements/operations?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2035-05-14`);
    await expect(page.getByText("50콜")).toBeVisible();
    await expect(page.getByText("50콜 이상")).toBeVisible();
    await expect(page.getByText("개인별 200,000 VND")).toBeVisible();
    await expect(page.getByText("지급 합계 600,000 VND")).toBeVisible();
  });

  test("locked operating month remains readable and disables attendance save", async ({ page }) => {
    await login(page, "story45_settlement", "Story45!settlement");
    await page.goto(`/settlements/operations?operatingMonthId=${seededData.lockedOperatingMonthId}&attendanceDate=2035-06-12`);

    await expect(page.getByText("잠긴 운영월입니다")).toBeVisible();
    await expect(page.getByText("50콜")).toBeVisible();
    await expect(page.getByLabel("E2E45 팀장 근무상태")).toBeDisabled();
  });

  test("missing daily incentive policy is shown as an explicit warning with zero payout", async ({ page }) => {
    await login(page, "story45_settlement", "Story45!settlement");
    await page.goto(`/settlements/operations?operatingMonthId=${seededData.missingPolicyOperatingMonthId}&attendanceDate=1999-01-12`);

    await expect(page.getByText("정책 없음")).toBeVisible();
    await expect(page.getByText("적용월에 활성 운영팀 일일 인센 정책이 없습니다.")).toBeVisible();
    await expect(page.getByText("개인별 0 VND")).toBeVisible();
    await expect(page.getByText("지급 합계 0 VND")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "E2E45 팀장" }).first().getByText("정책 없음")).toBeVisible();
  });

  test("counter direct access redirects away from operations settlements", async ({ page }) => {
    await login(page, "story45_counter", "Story45!counter");
    await page.goto(`/settlements/operations?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2035-05-12`);

    await expect(page).toHaveURL(/\/calls/);
  });
});
