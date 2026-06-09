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
  accountId: string;
  openMonthId: string;
  roomId: string;
  aCourseId: string;
  dCourseId: string;
  therapist1Id: string;
  therapist2Id: string;
  serviceDate: string;
};

let seededData: SeededData;

async function loginAsCounter(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill("story26_counter");
  await page.getByLabel("비밀번호").fill("Story26!counter");
  await page.getByRole("button", { name: "로그인" }).click();
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive: true },
    create: { staffCode, displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive: true }
  });
}

async function seedAuthAccount(handlerId: string) {
  const passwordHash = await hash("Story26!counter", argon2idOptions);
  return (prisma as any).userAccount.upsert({
    where: { accountId: "story26_counter" },
    update: {
      email: "story26_counter@example.local",
      passwordHash,
      role: "counter",
      employeeId: handlerId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: "story26_counter@example.local",
      accountId: "story26_counter",
      passwordHash,
      role: "counter",
      employeeId: handlerId,
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

async function upsertPolicy(courseId: string, name: string, basePrice: number, requiresSecondTherapist: boolean) {
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: "2034-06" } });
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
  await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: "2034-06", ...data } });
}

async function upsertRate(therapistId: string, courseId: string, amount: number) {
  const existing = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId, courseId, effectiveFromMonth: "2034-06" } });
  const data = { amount, effectiveToMonth: null, isActive: true };
  if (existing) {
    await (prisma as any).therapistCourseRate.update({ where: { id: existing.id }, data });
    return;
  }
  await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth: "2034-06", ...data } });
}

async function cleanupStoryData(openMonthId: string) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: { operatingMonthId: openMonthId, customerMemo: { startsWith: "Story 2.6" } },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length === 0) return;

  await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
}

async function seedStoryData(): Promise<SeededData> {
  const handler = await seedEmployee("E2E26-OPS-001", "E2E26 카운터", "OPERATIONS", "카운터", 92600);
  const account = await seedAuthAccount(handler.id);
  const openMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2034-06" },
    update: { startDate: new Date("2034-06-01T00:00:00.000Z"), endDate: new Date("2034-06-30T00:00:00.000Z"), status: "작성중" },
    create: { monthKey: "2034-06", startDate: new Date("2034-06-01T00:00:00.000Z"), endDate: new Date("2034-06-30T00:00:00.000Z"), status: "작성중" }
  });
  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 92601 },
    update: { displayName: "E2E26 호실", migrationReferenceName: "E2E26-ROOM", isActive: true },
    create: { displayName: "E2E26 호실", migrationReferenceName: "E2E26-ROOM", sortOrder: 92601, isActive: true }
  });
  const aCourse = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
  const dCourse = await (prisma as any).course.upsert({ where: { code: "D" }, update: { isActive: true }, create: { code: "D", isActive: true } });
  const therapist1 = await seedEmployee("E2E26-THR-001", "E2E26 마사지사1", "THERAPIST", "마사지사", 92601);
  const therapist2 = await seedEmployee("E2E26-THR-002", "E2E26 마사지사2", "THERAPIST", "마사지사", 92602);

  await upsertPolicy(aCourse.id, "Story26 A", 1500000, false);
  await upsertPolicy(dCourse.id, "Story26 D", 3200000, true);
  await upsertRate(therapist1.id, aCourse.id, 700000);
  await upsertRate(therapist1.id, dCourse.id, 900000);
  await upsertRate(therapist2.id, dCourse.id, 900000);
  await (prisma as any).timeSlot.upsert({
    where: { value: "16:00" },
    update: { sortOrder: 92601, isActive: true },
    create: { value: "16:00", sortOrder: 92601, isActive: true }
  });
  await upsertCodeItem("SERVICE_STATUS", "RESERVED", "예약", 92601);
  await upsertCodeItem("SERVICE_STATUS", "VISIT_COMPLETE", "방문완료", 92602);
  await upsertCodeItem("PAYMENT_METHOD", "CARD", "카드", 92601);
  await upsertCodeItem("CONFIRMATION", "Y", "Y", 92601);
  await cleanupStoryData(openMonth.id);

  return {
    accountId: account.id,
    openMonthId: openMonth.id,
    roomId: room.id,
    aCourseId: aCourse.id,
    dCourseId: dCourse.id,
    therapist1Id: therapist1.id,
    therapist2Id: therapist2.id,
    serviceDate: "2034-06-05"
  };
}

async function createCallRow(memo: string) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: seededData.openMonthId,
      serviceDate: new Date(`${seededData.serviceDate}T00:00:00.000Z`),
      startTime: "16:00",
      roomId: seededData.roomId,
      courseId: seededData.aCourseId,
      customerMemo: memo,
      status: "RESERVED"
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: seededData.therapist1Id }
  });
}

test.describe("Story 2.6 keyboard-first call ledger type-ahead", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    seededData = await seedStoryData();
    await createCallRow("Story 2.6 row one");
    await createCallRow("Story 2.6 row two");
  });

  test("supports mouse-free navigation, combobox ARIA, Esc cancel, and computed readonly cells", async ({ page }) => {
    await loginAsCounter(page);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${seededData.serviceDate}`);

    const grid = page.getByRole("heading", { name: "콜 원장 그리드" }).locator("..").locator("..");
    const roomCombobox = grid.getByRole("combobox", { name: "객실" }).first();
    await roomCombobox.focus();
    await expect(roomCombobox).toHaveAttribute("aria-expanded", "false");

    await roomCombobox.pressSequentially("E2E26");
    await expect(roomCombobox).toHaveAttribute("aria-expanded", "true");
    await roomCombobox.press("ArrowDown");
    await expect(roomCombobox).toHaveAttribute("aria-activedescendant", /option/);
    await roomCombobox.press("Enter");
    await expect(grid.getByText(/저장됨/).first()).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(grid.getByRole("combobox", { name: "코스" }).first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(roomCombobox).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(grid.getByRole("combobox", { name: "객실" }).nth(1)).toBeFocused();

    const memoCell = grid.getByLabel("고객/메모").first();
    await memoCell.focus();
    await memoCell.fill("Story 2.6 cancel draft");
    await page.keyboard.press("Escape");
    await expect(memoCell).toHaveValue("Story 2.6 row one");
    await expect(grid.getByText("저장중")).toHaveCount(0);
    await expect(grid.getByText("저장 보류 계산 대기")).toHaveCount(0);

    const confirmationCombobox = grid.getByRole("combobox", { name: "확인값" }).first();
    await confirmationCombobox.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-call-cell-row="0"][data-call-cell-column="paymentAmount"]')).toBeFocused();
  });

  test("keeps D-course second therapist accessibility while using type-ahead cells", async ({ page }) => {
    await loginAsCounter(page);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${seededData.serviceDate}`);

    const grid = page.getByRole("heading", { name: "콜 원장 그리드" }).locator("..").locator("..");
    const courseCombobox = grid.getByRole("combobox", { name: "코스" }).first();
    await courseCombobox.focus();
    await courseCombobox.pressSequentially("Story26 D");
    await expect(courseCombobox).toHaveAttribute("aria-expanded", "true");
    await courseCombobox.press("Enter");
    await expect(grid.getByText(/저장됨/).first()).toBeVisible();

    const statusCombobox = grid.getByRole("combobox", { name: "상태" }).first();
    await statusCombobox.focus();
    await statusCombobox.pressSequentially("방문완료");
    await statusCombobox.press("Enter");

    await expect(grid.getByText("D코스는 마사지사2 필수입니다. 마사지사2를 배정해야 저장됩니다.")).toBeVisible();
    const therapist2 = grid.getByRole("combobox", { name: "마사지사2" }).first();
    await expect(therapist2).toHaveAttribute("aria-invalid", "true");
    await expect(therapist2).toHaveAttribute("aria-describedby", /therapist2-error/);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });
});
