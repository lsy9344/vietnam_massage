import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";


type SeededData = {
  writableOperatingMonthId: string;
  lockedOperatingMonthId: string;
  earcareEmployeeIds: string[];
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

async function upsertPolicy(courseId: string, effectiveFromMonth: string, name: string, earcarePoolAmount: number, requiresSecondTherapist: boolean) {
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth } });
  const data = {
    name,
    durationMinutes: requiresSecondTherapist ? 90 : 60,
    basePrice: 1500000,
    opsCallCredit: 1,
    earcarePoolAmount,
    requiresSecondTherapist,
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

async function cleanupStoryData(operatingMonthIds: string[]) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: { operatingMonthId: { in: operatingMonthIds }, customerMemo: { startsWith: "Story 4.4" } },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
  }
  await (prisma as any).earcareAttendance.deleteMany({ where: { operatingMonthId: { in: operatingMonthIds } } });
}

async function createCall(input: {
  operatingMonthId: string;
  serviceDate: Date;
  roomId: string;
  courseId: string;
  memo: string;
  status: string;
  therapist1Id: string;
  therapist2Id?: string | null;
}) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: input.operatingMonthId,
      serviceDate: input.serviceDate,
      startTime: "15:00",
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
  if (input.therapist2Id) {
    await (prisma as any).serviceCallAssignment.create({
      data: { serviceCallId: call.id, assignmentRole: "THERAPIST_2", employeeId: input.therapist2Id, isActive: true }
    });
  }
}

async function seedAttendance(operatingMonthId: string, attendanceDate: string, employeeId: string, statusCode: string) {
  return (prisma as any).earcareAttendance.upsert({
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
  const settlementEmployee = await seedEmployee("E2E44-OPS-001", "E2E44 정산담당", "OPERATIONS", "정산", 94400);
  const counterEmployee = await seedEmployee("E2E44-OPS-002", "E2E44 카운터", "OPERATIONS", "카운터", 94401);
  await seedAuthAccount({ accountId: "story44_settlement", password: "Story44!settlement", role: "settlement_manager", employeeId: settlementEmployee.id });
  await seedAuthAccount({ accountId: "story44_counter", password: "Story44!counter", role: "counter", employeeId: counterEmployee.id });

  await seedAttendanceCode("NORMAL", "정상", 10);
  await seedAttendanceCode("DAY_OFF", "휴무", 20);
  await seedAttendanceCode("LATE", "지각", 30);

  const earcare1 = await seedEmployee("E2E44-EAR-001", "E2E44 귀케어1", "EARCARE", "귀케어", 94401);
  const earcare2 = await seedEmployee("E2E44-EAR-002", "E2E44 귀케어2", "EARCARE", "귀케어", 94402);
  const earcare3 = await seedEmployee("E2E44-EAR-003", "E2E44 귀케어3", "EARCARE", "귀케어", 94403);
  const therapist1 = await seedEmployee("E2E44-THR-001", "E2E44 마사지사1", "THERAPIST", "마사지사", 94411);
  const therapist2 = await seedEmployee("E2E44-THR-002", "E2E44 마사지사2", "THERAPIST", "마사지사", 94412);

  const writableOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2034-05" },
    update: { startDate: new Date("2034-05-01T00:00:00.000Z"), endDate: new Date("2034-05-31T00:00:00.000Z"), status: "작성중" },
    create: { monthKey: "2034-05", startDate: new Date("2034-05-01T00:00:00.000Z"), endDate: new Date("2034-05-31T00:00:00.000Z"), status: "작성중" }
  });
  const lockedOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2034-06" },
    update: { startDate: new Date("2034-06-01T00:00:00.000Z"), endDate: new Date("2034-06-30T00:00:00.000Z"), status: "잠금" },
    create: { monthKey: "2034-06", startDate: new Date("2034-06-01T00:00:00.000Z"), endDate: new Date("2034-06-30T00:00:00.000Z"), status: "잠금" }
  });
  await cleanupStoryData([writableOperatingMonth.id, lockedOperatingMonth.id]);

  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 94401 },
    update: { displayName: "E2E44 호실", migrationReferenceName: "E2E44-ROOM", isActive: true },
    create: { displayName: "E2E44 호실", migrationReferenceName: "E2E44-ROOM", sortOrder: 94401, isActive: true }
  });
  await (prisma as any).timeSlot.upsert({
    where: { value: "15:00" },
    update: { sortOrder: 94401, isActive: true },
    create: { value: "15:00", sortOrder: 94401, isActive: true }
  });
  const aCourse = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
  const bCourse = await (prisma as any).course.upsert({ where: { code: "B" }, update: { isActive: true }, create: { code: "B", isActive: true } });
  const dCourse = await (prisma as any).course.upsert({ where: { code: "D" }, update: { isActive: true }, create: { code: "D", isActive: true } });
  await upsertPolicy(aCourse.id, "2034-05", "Story44 A", 300001, false);
  await upsertPolicy(bCourse.id, "2034-05", "Story44 B", 200000, false);
  await upsertPolicy(dCourse.id, "2034-05", "Story44 D", 400000, true);
  await upsertPolicy(aCourse.id, "2034-06", "Story44 A locked", 300001, false);
  await upsertRate(therapist1.id, aCourse.id, "2034-05", 700000);
  await upsertRate(therapist1.id, bCourse.id, "2034-05", 900000);
  await upsertRate(therapist1.id, dCourse.id, "2034-05", 900000);
  await upsertRate(therapist1.id, aCourse.id, "2034-06", 700000);

  for (const serviceDate of ["2034-05-12", "2034-05-13"]) {
    await createCall({
      operatingMonthId: writableOperatingMonth.id,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      roomId: room.id,
      courseId: aCourse.id,
      memo: `Story 4.4 A complete ${serviceDate}`,
      status: "VISIT_COMPLETE",
      therapist1Id: therapist1.id
    });
    await createCall({
      operatingMonthId: writableOperatingMonth.id,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      roomId: room.id,
      courseId: bCourse.id,
      memo: `Story 4.4 B complete ${serviceDate}`,
      status: "방문완료",
      therapist1Id: therapist1.id
    });
  }
  await createCall({
    operatingMonthId: writableOperatingMonth.id,
    serviceDate: new Date("2034-05-12T00:00:00.000Z"),
    roomId: room.id,
    courseId: aCourse.id,
    memo: "Story 4.4 reserved excluded",
    status: "예약",
    therapist1Id: therapist1.id
  });
  await createCall({
    operatingMonthId: writableOperatingMonth.id,
    serviceDate: new Date("2034-05-12T00:00:00.000Z"),
    roomId: room.id,
    courseId: bCourse.id,
    memo: "Story 4.4 missing rate excluded",
    status: "VISIT_COMPLETE",
    therapist1Id: therapist2.id
  });
  await createCall({
    operatingMonthId: writableOperatingMonth.id,
    serviceDate: new Date("2034-05-12T00:00:00.000Z"),
    roomId: room.id,
    courseId: dCourse.id,
    memo: "Story 4.4 invalid d excluded",
    status: "VISIT_COMPLETE",
    therapist1Id: therapist1.id
  });
  await createCall({
    operatingMonthId: lockedOperatingMonth.id,
    serviceDate: new Date("2034-06-12T00:00:00.000Z"),
    roomId: room.id,
    courseId: aCourse.id,
    memo: "Story 4.4 locked readable",
    status: "VISIT_COMPLETE",
    therapist1Id: therapist1.id
  });

  await seedAttendance(writableOperatingMonth.id, "2034-05-12", earcare1.id, "NORMAL");
  await seedAttendance(writableOperatingMonth.id, "2034-05-12", earcare2.id, "NORMAL");
  await seedAttendance(writableOperatingMonth.id, "2034-05-12", earcare3.id, "DAY_OFF");
  await seedAttendance(writableOperatingMonth.id, "2034-05-13", earcare1.id, "DAY_OFF");
  await seedAttendance(writableOperatingMonth.id, "2034-05-13", earcare2.id, "LATE");
  await seedAttendance(writableOperatingMonth.id, "2034-05-13", earcare3.id, "DAY_OFF");
  await seedAttendance(lockedOperatingMonth.id, "2034-06-12", earcare1.id, "NORMAL");

  return {
    writableOperatingMonthId: writableOperatingMonth.id,
    lockedOperatingMonthId: lockedOperatingMonth.id,
    earcareEmployeeIds: [earcare1.id, earcare2.id, earcare3.id]
  };
}

test.afterAll(async () => {
  // 이 스펙이 시드한 콜/출퇴근 데이터를 운영월 범위로 정리한 뒤 연결을 닫는다.
  await cleanupStoryData([seededData.writableOperatingMonthId, seededData.lockedOperatingMonthId]);
  await prisma.$disconnect();
});

test.describe("Story 4.4 earcare daily settlement", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    seededData = await seedStoryData();
  });

  test("settlement manager can query pool, payout rows, evidence, and warnings", async ({ page }) => {
    await login(page, "story44_settlement", "Story44!settlement");
    await page.goto(`/settlements/earcare?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2034-05-12`);

    await expect(page.getByRole("heading", { name: "귀케어 일일정산" })).toBeVisible();
    await expect(page.getByLabel("운영월")).toHaveValue(seededData.writableOperatingMonthId);
    await expect(page.getByLabel("조회날짜")).toHaveValue("2034-05-12");
    await expect(page.getByText("방문완료 풀")).toBeVisible();
    await expect(page.getByText("500,001 VND")).toBeVisible();
    await expect(page.getByText("정상 근무자")).toBeVisible();
    await expect(page.getByText("2명")).toBeVisible();
    await expect(page.getByText("잔여 배분 1 VND")).toBeVisible();
    await expect(page.getByText("귀케어사별 지급액")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "E2E44 귀케어1" }).getByText("250,001 VND")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "E2E44 귀케어2" }).getByText("250,000 VND")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "E2E44 귀케어3" }).getByText("제외: 휴무")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "E2E44 귀케어1" }).getByText("잔여 1 VND 배분")).toBeVisible();
    await expect(page.getByText("풀 산출 근거")).toBeVisible();
    await expect(page.getByText("비완료 1, 정책없음 0, 수당없음 1, D코스누락 1")).toBeVisible();
    await expect(page.getByRole("button", { name: /지급/ })).toHaveCount(0);
  });

  test("attendance status change updates payout after requery", async ({ page }) => {
    await login(page, "story44_settlement", "Story44!settlement");
    await page.goto(`/settlements/earcare?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2034-05-12`);

    const earcare2Row = page.getByRole("row").filter({ hasText: "E2E44 귀케어2" }).last();
    await earcare2Row.getByLabel("E2E44 귀케어2 근무상태").selectOption("DAY_OFF");
    await earcare2Row.getByRole("button", { name: "저장" }).click();
    await expect(earcare2Row.getByText("저장됨")).toBeVisible();

    await page.goto(`/settlements/earcare?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2034-05-12`);
    await expect(page.getByText("정상 근무자")).toBeVisible();
    await expect(page.getByText("1명")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "E2E44 귀케어1" }).first().getByText("500,001 VND")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "E2E44 귀케어2" }).first().getByText("제외: 휴무")).toBeVisible();
  });

  test("zero normal earcare workers keeps the pool undistributed", async ({ page }) => {
    await login(page, "story44_settlement", "Story44!settlement");
    await page.goto(`/settlements/earcare?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2034-05-13`);

    await expect(page.getByText("정상 근무자")).toBeVisible();
    await expect(page.getByText("0명")).toBeVisible();
    await expect(page.getByText("500,001 VND /")).toBeVisible();
    await expect(page.getByText("정상 근무자 0명")).toBeVisible();
  });

  test("locked operating month still shows read-only payout calculation", async ({ page }) => {
    await login(page, "story44_settlement", "Story44!settlement");
    await page.goto(`/settlements/earcare?operatingMonthId=${seededData.lockedOperatingMonthId}&attendanceDate=2034-06-12`);

    await expect(page.getByText("잠긴 운영월입니다")).toBeVisible();
    await expect(page.getByText("방문완료 풀")).toBeVisible();
    await expect(page.getByText("300,001 VND")).toBeVisible();
    await expect(page.getByLabel("E2E44 귀케어1 근무상태")).toBeDisabled();
  });

  test("counter direct access redirects away from earcare settlements", async ({ page }) => {
    await login(page, "story44_counter", "Story44!counter");
    await page.goto(`/settlements/earcare?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2034-05-12`);

    await expect(page).toHaveURL(/\/calls/);
  });
});
