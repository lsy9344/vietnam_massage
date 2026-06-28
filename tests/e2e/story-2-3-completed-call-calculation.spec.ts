import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, setLocaleCookie } from "./support/auth";
import { restoreUserAccount } from "./support/cleanup";


type SeededData = {
  openMonthId: string;
  roomId: string;
  courseId: string;
  missingRateCourseId: string;
  therapist1Id: string;
  therapist2Id: string;
  noRateTherapistId: string;
  earcareEmployeeId: string;
};

let seededData: SeededData;

async function login(page: Page) {
  await page.goto("/sign-in");
  await setLocaleCookie(page, "ko");
  await page.reload().catch(() => undefined);
  await page.getByLabel("이메일 또는 계정 ID").fill("story23_counter");
  await page.getByLabel("비밀번호").fill("Story23!counter");
  await page.getByRole("button", { name: "로그인" }).click();
}

async function seedAuthAccount() {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E23-COUNTER" },
    update: {
      displayName: "story23_counter",
      employeeGroup: "OPERATIONS",
      position: "카운터",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 92300,
      isActive: true
    },
    create: {
      staffCode: "E2E23-COUNTER",
      displayName: "story23_counter",
      employeeGroup: "OPERATIONS",
      position: "카운터",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 92300,
      isActive: true
    }
  });
  const passwordHash = await hash("Story23!counter", argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: "story23_counter" },
    update: {
      email: "story23_counter@example.local",
      passwordHash,
      role: "counter",
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: "story23_counter@example.local",
      accountId: "story23_counter",
      passwordHash,
      role: "counter",
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function upsertCodeItem(codeType: string, code: string, displayName: string, sortOrder: number, isActive = true) {
  await (prisma as any).codeItem.upsert({
    where: { codeType_code: { codeType, code } },
    update: { displayName, sortOrder, isActive },
    create: { codeType, code, displayName, sortOrder, isSystemDefault: false, isActive }
  });
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

async function upsertCoursePolicy(input: {
  courseId: string;
  effectiveFromMonth: string;
  name: string;
  basePrice: number;
  earcarePoolAmount: number;
}) {
  const existing = await (prisma as any).coursePolicy.findFirst({
    where: { courseId: input.courseId, effectiveFromMonth: input.effectiveFromMonth }
  });
  const data = {
    name: input.name,
    durationMinutes: 60,
    basePrice: input.basePrice,
    opsCallCredit: 1,
    earcarePoolAmount: input.earcarePoolAmount,
    requiresSecondTherapist: false,
    tvDisplayName: input.name,
    effectiveToMonth: null,
    isActive: true
  };
  if (existing) {
    await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data });
    return;
  }
  await (prisma as any).coursePolicy.create({
    data: { courseId: input.courseId, effectiveFromMonth: input.effectiveFromMonth, ...data }
  });
}

async function upsertTherapistCourseRate(input: { therapistId: string; courseId: string; amount: number; isActive?: boolean }) {
  const existing = await (prisma as any).therapistCourseRate.findFirst({
    where: { therapistId: input.therapistId, courseId: input.courseId, effectiveFromMonth: "2032-05" }
  });
  const data = {
    amount: input.amount,
    effectiveToMonth: null,
    isActive: input.isActive ?? true
  };
  if (existing) {
    await (prisma as any).therapistCourseRate.update({ where: { id: existing.id }, data });
    return;
  }
  await (prisma as any).therapistCourseRate.create({
    data: {
      therapistId: input.therapistId,
      courseId: input.courseId,
      effectiveFromMonth: "2032-05",
      ...data
    }
  });
}

async function seedStoryData(): Promise<SeededData> {
  const openMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2032-05" },
    update: {
      startDate: new Date("2032-05-01T00:00:00.000Z"),
      endDate: new Date("2032-05-31T00:00:00.000Z"),
      status: "작성중"
    },
    create: {
      monthKey: "2032-05",
      startDate: new Date("2032-05-01T00:00:00.000Z"),
      endDate: new Date("2032-05-31T00:00:00.000Z"),
      status: "작성중"
    }
  });
  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 92301 },
    update: { displayName: "E2E 923 호실", migrationReferenceName: "E2E23-ROOM", isActive: true },
    create: { displayName: "E2E 923 호실", migrationReferenceName: "E2E23-ROOM", sortOrder: 92301, isActive: true }
  });
  const course = await (prisma as any).course.upsert({
    where: { code: "E2E23A" },
    update: { isActive: true },
    create: { code: "E2E23A", isActive: true }
  });
  const missingRateCourse = await (prisma as any).course.upsert({
    where: { code: "E2E23B" },
    update: { isActive: true },
    create: { code: "E2E23B", isActive: true }
  });
  await upsertCoursePolicy({
    courseId: course.id,
    effectiveFromMonth: "2032-05",
    name: "E2E 계산60",
    basePrice: 1500000,
    earcarePoolAmount: 100000
  });
  await upsertCoursePolicy({
    courseId: missingRateCourse.id,
    effectiveFromMonth: "2032-05",
    name: "E2E 수당누락60",
    basePrice: 1800000,
    earcarePoolAmount: 200000
  });

  const therapist1 = await seedEmployee("E2E23-THR-001", "E2E23 마사지사1", "THERAPIST", 92301);
  const therapist2 = await seedEmployee("E2E23-THR-002", "E2E23 마사지사2", "THERAPIST", 92302);
  const noRateTherapist = await seedEmployee("E2E23-THR-NORATE", "E2E23 수당누락", "THERAPIST", 92303);
  const earcare = await seedEmployee("E2E23-EAR-001", "E2E23 귀케어1", "EARCARE", 92301);

  await upsertTherapistCourseRate({ therapistId: therapist1.id, courseId: course.id, amount: 700000 });
  await upsertTherapistCourseRate({ therapistId: therapist2.id, courseId: course.id, amount: 300000 });
  await upsertTherapistCourseRate({ therapistId: noRateTherapist.id, courseId: missingRateCourse.id, amount: 0, isActive: false });

  await (prisma as any).timeSlot.upsert({
    where: { value: "13:00" },
    update: { sortOrder: 92301, isActive: true },
    create: { value: "13:00", sortOrder: 92301, isActive: true }
  });
  await upsertCodeItem("SERVICE_STATUS", "RESERVED", "예약", 92301);
  await upsertCodeItem("SERVICE_STATUS", "VISIT_COMPLETE", "방문완료", 92302);
  await upsertCodeItem("SERVICE_STATUS", "CANCELED", "취소", 92303);
  await upsertCodeItem("DISCOUNT_TYPE", "BIRTHDAY", "생일자", 92301);
  await upsertCodeItem("PAYMENT_METHOD", "CASH", "현금", 92301);
  await upsertCodeItem("CONFIRMATION", "Y", "Y", 92301);

  return {
    openMonthId: openMonth.id,
    roomId: room.id,
    courseId: course.id,
    missingRateCourseId: missingRateCourse.id,
    therapist1Id: therapist1.id,
    therapist2Id: therapist2.id,
    noRateTherapistId: noRateTherapist.id,
    earcareEmployeeId: earcare.id
  };
}

async function createCallRow(input: { serviceDate: string; memo: string; status?: string; discountTypeCode?: string | null; missingRate?: boolean }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: seededData.openMonthId,
      serviceDate: new Date(`${input.serviceDate}T00:00:00.000Z`),
      startTime: "13:00",
      roomId: seededData.roomId,
      courseId: input.missingRate ? seededData.missingRateCourseId : seededData.courseId,
      customerMemo: input.memo,
      status: input.status ?? "RESERVED",
      discountTypeCode: input.discountTypeCode ?? null,
      paymentMethodCode: "CASH",
      note: "E2E23 비고",
      confirmationCode: "Y"
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: {
      serviceCallId: call.id,
      assignmentRole: "THERAPIST_1",
      employeeId: input.missingRate ? seededData.noRateTherapistId : seededData.therapist1Id
    }
  });
  if (!input.missingRate) {
    await (prisma as any).serviceCallAssignment.create({
      data: { serviceCallId: call.id, assignmentRole: "THERAPIST_2", employeeId: seededData.therapist2Id }
    });
  }
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "EARCARE", employeeId: seededData.earcareEmployeeId }
  });
  return call;
}

function rowByText(page: Page, text: string) {
  return page.getByRole("row", { name: new RegExp(text) });
}

test.describe("Story 2.3 방문완료 기준 계산 표시", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAuthAccount();
    seededData = await seedStoryData();
  });

  test("방문완료 전환 후 서버 계산값을 readonly 셀에 표시하고 할인 변경을 즉시 반영한다", async ({ page }) => {
    const memo = `E2E23 calculation ${Date.now().toString(36)}`;
    await createCallRow({ serviceDate: "2032-05-05", memo });

    await login(page);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-05-05`);

    const row = rowByText(page, memo);
    await expect(row).toBeVisible();
    await expect(row.getByText("비완료 제외")).toBeVisible();
    await expect(row.getByText("1,500,000")).toHaveCount(0);

    await row.getByLabel("상태").selectOption({ label: "방문완료" });
    await row.getByLabel("상태").blur();
    await expect(row.getByText("계산됨")).toBeVisible();
    await expect(row.getByText("1,500,000")).toBeVisible();
    await expect(row.getByText("700,000")).toBeVisible();
    await expect(row.getByText("300,000")).toBeVisible();
    await expect(row.getByText(/^100,000$/)).toHaveCount(1);
    await expect(row.getByText(/^1$/)).toHaveCount(1);

    await row.getByLabel("할인구분").selectOption({ label: "생일자" });
    await row.getByLabel("할인구분").blur();
    await expect(row.getByText("1,400,000")).toBeVisible();
    await expect(row.getByText(/^100,000$/)).toHaveCount(2);
  });

  test("비완료 행은 계산 집계에서 제외된 상태로 표시한다", async ({ page }) => {
    const memo = `E2E23 not completed ${Date.now().toString(36)}`;
    await createCallRow({ serviceDate: "2032-05-06", memo, status: "CANCELED", discountTypeCode: "BIRTHDAY" });

    await login(page);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-05-06`);

    const row = rowByText(page, memo);
    await expect(row.getByText("비완료 제외")).toBeVisible();
    await expect(row.getByText("계산됨")).toHaveCount(0);
    await expect(row.getByText("1,400,000")).toHaveCount(0);
  });

  test("수당 정책이 없으면 성공 계산처럼 보이지 않고 정책 없음 상태를 표시한다", async ({ page }) => {
    const memo = `E2E23 missing rate ${Date.now().toString(36)}`;
    await createCallRow({ serviceDate: "2032-05-07", memo, status: "VISIT_COMPLETE", missingRate: true });

    await login(page);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-05-07`);

    const row = rowByText(page, memo);
    await expect(row.getByText("마사지사1 수당 정책을 찾을 수 없습니다.")).toBeVisible();
    await expect(row.getByText("계산됨")).toHaveCount(0);
    await expect(row.getByText("1,800,000")).toHaveCount(0);
  });

  test.afterAll(async () => {
    await restoreUserAccount("story23_counter", "counter");
    await prisma.$disconnect();
  });
});
