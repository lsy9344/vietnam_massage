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

const users = [
  { accountId: "story21_administrator", role: "administrator", password: "Story21!administrator", landing: "/live" },
  { accountId: "story21_counter", role: "counter", password: "Story21!counter", landing: "/calls" },
  { accountId: "story21_waiter", role: "waiter", password: "Story21!waiter", landing: "/rooms" }
];

type SeededData = {
  openMonthId: string;
  lockedMonthId: string;
  roomId: string;
  courseId: string;
  therapist1Id: string;
  therapist2Id: string;
  earcareEmployeeId: string;
};

let seededData: SeededData;

async function login(page: Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(accountId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

async function seedAuthAccount(input: { accountId: string; email: string; staffCode: string; role: string; secret: string }) {
  const sortOrder = 92100 + [...input.staffCode].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: input.accountId,
      employeeGroup: "OPERATIONS",
      position: input.role === "waiter" ? "웨이터" : input.role === "counter" ? "카운터" : "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    },
    create: {
      staffCode: input.staffCode,
      displayName: input.accountId,
      employeeGroup: "OPERATIONS",
      position: input.role === "waiter" ? "웨이터" : input.role === "counter" ? "카운터" : "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
  const passwordHash = await hash(input.secret, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: {
      email: input.email,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: input.email,
      accountId: input.accountId,
      passwordHash,
      role: input.role,
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
    update: { displayName, isActive: true },
    create: { codeType, code, displayName, sortOrder, isSystemDefault: false, isActive: true }
  });
}

async function seedStoryData(): Promise<SeededData> {
  const openMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2032-01" },
    update: {
      startDate: new Date("2032-01-01T00:00:00.000Z"),
      endDate: new Date("2032-01-31T00:00:00.000Z"),
      status: "작성중"
    },
    create: {
      monthKey: "2032-01",
      startDate: new Date("2032-01-01T00:00:00.000Z"),
      endDate: new Date("2032-01-31T00:00:00.000Z"),
      status: "작성중"
    }
  });
  const lockedMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2032-02" },
    update: {
      startDate: new Date("2032-02-01T00:00:00.000Z"),
      endDate: new Date("2032-02-29T00:00:00.000Z"),
      status: "잠금"
    },
    create: {
      monthKey: "2032-02",
      startDate: new Date("2032-02-01T00:00:00.000Z"),
      endDate: new Date("2032-02-29T00:00:00.000Z"),
      status: "잠금"
    }
  });
  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 92101 },
    update: {
      displayName: "E2E 921 호실",
      migrationReferenceName: "E2E21-ROOM",
      isActive: true
    },
    create: {
      displayName: "E2E 921 호실",
      migrationReferenceName: "E2E21-ROOM",
      sortOrder: 92101,
      isActive: true
    }
  });
  const course = await (prisma as any).course.upsert({
    where: { code: "E2E21A" },
    update: { isActive: true },
    create: { code: "E2E21A", isActive: true }
  });
  const existingPolicy = await (prisma as any).coursePolicy.findFirst({
    where: { courseId: course.id, effectiveFromMonth: "2032-01" }
  });
  if (existingPolicy) {
    await (prisma as any).coursePolicy.update({
      where: { id: existingPolicy.id },
      data: {
        name: "E2E 기본60",
        durationMinutes: 60,
        basePrice: 1500000,
        opsCallCredit: 1,
        earcarePoolAmount: 0,
        requiresSecondTherapist: false,
        tvDisplayName: "E2E 기본60",
        effectiveToMonth: null,
        isActive: true
      }
    });
  } else {
    await (prisma as any).coursePolicy.create({
      data: {
        courseId: course.id,
        name: "E2E 기본60",
        durationMinutes: 60,
        basePrice: 1500000,
        opsCallCredit: 1,
        earcarePoolAmount: 0,
        requiresSecondTherapist: false,
        tvDisplayName: "E2E 기본60",
        effectiveFromMonth: "2032-01",
        effectiveToMonth: null,
        isActive: true
      }
    });
  }
  const therapist1 = await seedEmployee("E2E21-THR-001", "E2E 마사지사1", "THERAPIST", 92101);
  const therapist2 = await seedEmployee("E2E21-THR-002", "E2E 마사지사2", "THERAPIST", 92102);
  const earcare = await seedEmployee("E2E21-EAR-001", "E2E 귀케어1", "EARCARE", 92101);

  await (prisma as any).timeSlot.upsert({
    where: { value: "11:00" },
    update: { isActive: true },
    create: { value: "11:00", sortOrder: 92101, isActive: true }
  });
  await upsertCodeItem("SERVICE_STATUS", "예약", "예약", 92101);
  await upsertCodeItem("SERVICE_STATUS", "취소", "취소", 92102);
  await upsertCodeItem("DISCOUNT_TYPE", "생일자", "생일자", 92101);
  await upsertCodeItem("PAYMENT_METHOD", "현금", "현금", 92101);
  await upsertCodeItem("CONFIRMATION", "Y", "Y", 92101);

  return {
    openMonthId: openMonth.id,
    lockedMonthId: lockedMonth.id,
    roomId: room.id,
    courseId: course.id,
    therapist1Id: therapist1.id,
    therapist2Id: therapist2.id,
    earcareEmployeeId: earcare.id
  };
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: {
      displayName,
      employeeGroup,
      position: employeeGroup === "EARCARE" ? "귀케어" : "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position: employeeGroup === "EARCARE" ? "귀케어" : "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

async function fillBasicCallRow(page: Page, memo: string) {
  await page.getByLabel("시간").selectOption("11:00");
  await page.getByLabel("객실").selectOption(seededData.roomId);
  await page.getByLabel("코스").selectOption(seededData.courseId);
  await page.getByLabel("고객/메모").fill(memo);
  await page.getByLabel("마사지사1").selectOption(seededData.therapist1Id);
  await page.getByLabel("마사지사2").selectOption(seededData.therapist2Id);
  await page.getByLabel("귀케어 담당").selectOption(seededData.earcareEmployeeId);
  await page.getByLabel("상태").selectOption("예약");
  await page.getByLabel("할인구분").selectOption("생일자");
  await page.getByLabel("결제수단").selectOption("현금");
  await page.getByLabel("비고").fill("E2E 비고");
  await page.getByLabel("확인값").selectOption("Y");
}

test.describe("Story 2.1 날짜별 콜 원장 그리드 조회와 기본 입력", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const user of users) {
      await seedAuthAccount({
        accountId: user.accountId,
        email: `${user.accountId}@example.local`,
        staffCode: `E2E21-${user.role.toUpperCase()}`,
        role: user.role,
        secret: user.password
      });
    }
    seededData = await seedStoryData();
  });

  test("counter는 날짜별 빈 상태를 보고 기본 콜 행을 입력하면 stable ID와 담당자 row가 저장된다", async ({ page }) => {
    const memo = `E2E story 2.1 memo ${Date.now().toString(36)}`;

    await login(page, "story21_counter", "Story21!counter");
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-01-05`);

    await expect(page.getByRole("heading", { name: /콜|예약|원장/, level: 1 })).toBeVisible();
    await expect(page.getByText("이 날짜의 콜이 없습니다")).toBeVisible();
    await expect(page.getByRole("button", { name: "새 콜 행 추가" })).toBeEnabled();
    await expect(page.getByLabel("운영월")).toHaveValue(seededData.openMonthId);
    await expect(page.getByLabel("조회날짜")).toHaveValue("2032-01-05");

    await fillBasicCallRow(page, memo);
    await page.getByRole("button", { name: "새 콜 행 추가" }).click();

    await expect(page.getByText("저장됨").or(page.getByText(memo))).toBeVisible();
    await expect(page.getByText(memo)).toBeVisible();
    await expect(page.getByText("E2E 921 호실")).toBeVisible();
    await expect(page.getByText("E2E 마사지사1")).toBeVisible();
    await expect(page.getByText("E2E 귀케어1")).toBeVisible();
    await expect(page.getByText("결제/수당/콜인정 -")).toBeVisible();

    const savedCall = await (prisma as any).serviceCall.findFirst({
      where: { customerMemo: memo },
      include: { assignments: true }
    });
    expect(savedCall).toMatchObject({
      operatingMonthId: seededData.openMonthId,
      roomId: seededData.roomId,
      courseId: seededData.courseId,
      status: "예약",
      discountTypeCode: "생일자",
      paymentMethodCode: "현금",
      confirmationCode: "Y"
    });
    expect(savedCall.assignments.map((assignment: any) => assignment.assignmentRole).sort()).toEqual([
      "EARCARE",
      "THERAPIST_1",
      "THERAPIST_2"
    ]);
  });

  test("administrator는 운영월 범위를 벗어난 날짜 저장 오류를 한국어로 확인한다", async ({ page }) => {
    await login(page, "story21_administrator", "Story21!administrator");
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-02-01`);

    await fillBasicCallRow(page, `E2E out-of-range ${Date.now().toString(36)}`);
    await page.getByRole("button", { name: "새 콜 행 추가" }).click();

    await expect(page.getByText("운영월 범위를 벗어난 날짜입니다.")).toBeVisible();
  });

  test("잠금 운영월은 read-only로 보이고 새 콜 행 추가가 차단된다", async ({ page }) => {
    await login(page, "story21_counter", "Story21!counter");
    await page.goto(`/calls?operatingMonthId=${seededData.lockedMonthId}&serviceDate=2032-02-03`);

    await expect(page.getByText("잠긴 운영월입니다.")).toBeVisible();
    await expect(page.getByRole("button", { name: "새 콜 행 추가" })).toBeDisabled();
    await expect(page.getByLabel("시간")).toBeDisabled();
    await expect(page.getByLabel("객실")).toBeDisabled();
  });

  test("non-write role은 /calls direct access와 sidebar 콜 원장에서 제외된다", async ({ page }) => {
    await login(page, "story21_waiter", "Story21!waiter");
    await page.goto("/calls");

    await expect(page).toHaveURL(/\/rooms$/);
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: /콜\/예약 입력 원장/ })).toHaveCount(0);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });
});
