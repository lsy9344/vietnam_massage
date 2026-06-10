import { expect, test, type Page } from "@playwright/test";
import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vietnam_massage";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);
const argon2idOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

type SeededData = {
  operatingMonthId: string;
  roomId: string;
  aCourseId: string;
  dCourseId: string;
  therapist1Id: string;
  therapist2Id: string;
  therapist3Id: string;
};

let seededData: SeededData;

async function login(page: Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(accountId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive: true },
    create: { staffCode, displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive: true }
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

async function upsertPolicy(courseId: string, name: string, basePrice: number, requiresSecondTherapist: boolean) {
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: "2034-02" } });
  const data = {
    name,
    durationMinutes: requiresSecondTherapist ? 90 : 60,
    basePrice,
    opsCallCredit: 1,
    earcarePoolAmount: 0,
    requiresSecondTherapist,
    tvDisplayName: name,
    effectiveToMonth: null,
    isActive: true
  };
  if (existing) {
    await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data });
    return;
  }
  await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: "2034-02", ...data } });
}

async function upsertRate(therapistId: string, courseId: string, amount: number) {
  const existing = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId, courseId, effectiveFromMonth: "2034-02" } });
  const data = { amount, effectiveToMonth: null, isActive: true };
  if (existing) {
    await (prisma as any).therapistCourseRate.update({ where: { id: existing.id }, data });
    return;
  }
  await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth: "2034-02", ...data } });
}

async function cleanupStoryCalls(operatingMonthId: string) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: {
      operatingMonthId,
      customerMemo: { startsWith: "Story 4.2" }
    },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length === 0) return;
  await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
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
      startTime: "14:00",
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

async function seedStoryData(): Promise<SeededData> {
  const settlementEmployee = await seedEmployee("E2E42-OPS-001", "E2E42 정산담당", "OPERATIONS", "정산", 94200);
  const counterEmployee = await seedEmployee("E2E42-OPS-002", "E2E42 카운터", "OPERATIONS", "카운터", 94201);
  await seedAuthAccount({ accountId: "story42_settlement", password: "Story42!settlement", role: "settlement_manager", employeeId: settlementEmployee.id });
  await seedAuthAccount({ accountId: "story42_counter", password: "Story42!counter", role: "counter", employeeId: counterEmployee.id });

  const operatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2034-02" },
    update: { startDate: new Date("2034-02-01T00:00:00.000Z"), endDate: new Date("2034-02-28T00:00:00.000Z"), status: "작성중" },
    create: { monthKey: "2034-02", startDate: new Date("2034-02-01T00:00:00.000Z"), endDate: new Date("2034-02-28T00:00:00.000Z"), status: "작성중" }
  });
  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 94201 },
    update: { displayName: "E2E42 호실", migrationReferenceName: "E2E42-ROOM", isActive: true },
    create: { displayName: "E2E42 호실", migrationReferenceName: "E2E42-ROOM", sortOrder: 94201, isActive: true }
  });
  const aCourse = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
  const dCourse = await (prisma as any).course.upsert({ where: { code: "D" }, update: { isActive: true }, create: { code: "D", isActive: true } });
  const therapist1 = await seedEmployee("E2E42-THR-001", "E2E42 마사지사1", "THERAPIST", "마사지사", 94201);
  const therapist2 = await seedEmployee("E2E42-THR-002", "E2E42 마사지사2", "THERAPIST", "마사지사", 94202);
  const therapist3 = await seedEmployee("E2E42-THR-003", "E2E42 마사지사3", "THERAPIST", "마사지사", 94203);
  await (prisma as any).timeSlot.upsert({
    where: { value: "14:00" },
    update: { sortOrder: 94201, isActive: true },
    create: { value: "14:00", sortOrder: 94201, isActive: true }
  });
  await upsertPolicy(aCourse.id, "Story42 A", 1500000, false);
  await upsertPolicy(dCourse.id, "Story42 D", 3200000, true);
  await upsertRate(therapist1.id, aCourse.id, 700000);
  await upsertRate(therapist2.id, aCourse.id, 0);
  await upsertRate(therapist1.id, dCourse.id, 900000);
  await upsertRate(therapist2.id, dCourse.id, 900000);
  await cleanupStoryCalls(operatingMonth.id);
  await createCall({
    operatingMonthId: operatingMonth.id,
    serviceDate: new Date("2034-02-12T00:00:00.000Z"),
    roomId: room.id,
    courseId: aCourse.id,
    memo: "Story 4.2 A complete",
    status: "VISIT_COMPLETE",
    therapist1Id: therapist1.id,
    therapist2Id: therapist2.id
  });
  await createCall({
    operatingMonthId: operatingMonth.id,
    serviceDate: new Date("2034-02-12T00:00:00.000Z"),
    roomId: room.id,
    courseId: dCourse.id,
    memo: "Story 4.2 D complete",
    status: "방문완료",
    therapist1Id: therapist1.id,
    therapist2Id: therapist2.id
  });
  await createCall({
    operatingMonthId: operatingMonth.id,
    serviceDate: new Date("2034-02-12T00:00:00.000Z"),
    roomId: room.id,
    courseId: aCourse.id,
    memo: "Story 4.2 missing therapist rate",
    status: "VISIT_COMPLETE",
    therapist1Id: therapist3.id
  });
  await createCall({
    operatingMonthId: operatingMonth.id,
    serviceDate: new Date("2034-02-12T00:00:00.000Z"),
    roomId: room.id,
    courseId: aCourse.id,
    memo: "Story 4.2 reserved excluded",
    status: "예약",
    therapist1Id: therapist1.id
  });

  return {
    operatingMonthId: operatingMonth.id,
    roomId: room.id,
    aCourseId: aCourse.id,
    dCourseId: dCourse.id,
    therapist1Id: therapist1.id,
    therapist2Id: therapist2.id,
    therapist3Id: therapist3.id
  };
}

test.beforeAll(async () => {
  seededData = await seedStoryData();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("Story 4.2 therapist daily settlement", () => {
  test("settlement manager can query therapist totals and assignment evidence", async ({ page }) => {
    await login(page, "story42_settlement", "Story42!settlement");
    await page.goto(`/settlements?operatingMonthId=${seededData.operatingMonthId}&serviceDate=2034-02-12`);

    await expect(page.getByRole("heading", { name: "마사지사 일일정산" })).toBeVisible();
    await expect(page.getByLabel("운영월")).toHaveValue(seededData.operatingMonthId);
    await expect(page.getByLabel("조회날짜")).toHaveValue("2034-02-12");
    await expect(page.getByText("E2E42 마사지사1")).toBeVisible();
    await expect(page.getByText("1,600,000 VND")).toBeVisible();
    await expect(page.getByText("E2E42 마사지사2")).toBeVisible();
    await expect(page.getByText("900,000 VND")).toBeVisible();
    await expect(page.getByText("E2E42 마사지사3")).toBeVisible();
    await expect(page.getByText("정책 warning / 제외 콜")).toBeVisible();
    await expect(page.getByText("1건 / 1건")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "A 수량/금액" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "B 수량/금액" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "C 수량/금액" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "D 수량/금액" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "E 수량/금액" })).toBeVisible();

    const therapist1Summary = page.getByRole("row").filter({ hasText: "E2E42 마사지사1" }).first();
    await expect(therapist1Summary).toContainText("2건");
    await expect(therapist1Summary).toContainText("700,000 VND");
    await expect(therapist1Summary).toContainText("900,000 VND");

    await expect(page.getByRole("heading", { name: "콜별 산출 근거" })).toBeVisible();
    await expect(page.getByText("마사지사2")).toBeVisible();
    await expect(page.getByText("0원 정책")).toBeVisible();
    await expect(page.getByText("정책 적용")).toBeVisible();
    await expect(page.getByText("정책 없음")).toBeVisible();
  });

  test("empty date shows explicit empty state", async ({ page }) => {
    await login(page, "story42_settlement", "Story42!settlement");
    await page.goto(`/settlements?operatingMonthId=${seededData.operatingMonthId}&serviceDate=2034-02-13`);

    await expect(page.getByText("이 날짜의 방문완료 콜이 없습니다")).toBeVisible();
    await expect(page.getByText("운영월 또는 조회날짜를 변경해 다시 조회하세요.")).toBeVisible();
  });

  test("counter direct access redirects away from settlements", async ({ page }) => {
    await login(page, "story42_counter", "Story42!counter");
    await page.goto(`/settlements?operatingMonthId=${seededData.operatingMonthId}&serviceDate=2034-02-12`);

    await expect(page).toHaveURL(/\/calls/);
  });
});
