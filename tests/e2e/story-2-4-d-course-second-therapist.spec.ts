import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login as loginAccount } from "./support/auth";
import { selectGridOption, selectGridOptionByValue } from "./support/call-grid";
import { restoreUserAccount } from "./support/cleanup";


type SeededData = {
  openMonthId: string;
  roomId: string;
  aCourseId: string;
  dCourseId: string;
  therapist1Id: string;
  therapist2Id: string;
};

let seededData: SeededData;

// 공유 login 헬퍼는 credentials POST 응답과 landing navigation까지 기다린다. 직접 구현하면
// 클릭 직후의 page.goto가 그 POST를 취소해 세션 없이 /sign-in으로 튕긴다.
async function login(page: Page) {
  await loginAccount(page, "story24_counter", "Story24!counter");
}

async function seedAuthAccount() {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E24-COUNTER" },
    update: {
      displayName: "story24_counter",
      employeeGroup: "OPERATIONS",
      position: "카운터",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 92400,
      isActive: true
    },
    create: {
      staffCode: "E2E24-COUNTER",
      displayName: "story24_counter",
      employeeGroup: "OPERATIONS",
      position: "카운터",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 92400,
      isActive: true
    }
  });
  const passwordHash = await hash("Story24!counter", argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: "story24_counter" },
    update: {
      email: "story24_counter@example.local",
      passwordHash,
      role: "counter",
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: "story24_counter@example.local",
      accountId: "story24_counter",
      passwordHash,
      role: "counter",
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

async function seedEmployee(staffCode: string, displayName: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: {
      displayName,
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    },
    create: {
      staffCode,
      displayName,
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

async function upsertPolicy(input: {
  courseId: string;
  name: string;
  basePrice: number;
  requiresSecondTherapist: boolean;
}) {
  const existing = await (prisma as any).coursePolicy.findFirst({
    where: { courseId: input.courseId, effectiveFromMonth: "2032-06" }
  });
  const data = {
    name: input.name,
    durationMinutes: input.requiresSecondTherapist ? 90 : 60,
    basePrice: input.basePrice,
    requiresSecondTherapist: input.requiresSecondTherapist,
    tvDisplayName: input.name,
    effectiveToMonth: null,
    isActive: true
  };
  if (existing) {
    await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data });
    return;
  }
  await (prisma as any).coursePolicy.create({ data: { courseId: input.courseId, effectiveFromMonth: "2032-06", ...data } });
}

async function upsertRate(therapistId: string, courseId: string, amount: number) {
  const existing = await (prisma as any).therapistCourseRate.findFirst({
    where: { therapistId, courseId, effectiveFromMonth: "2032-06" }
  });
  const data = { amount, effectiveToMonth: null, isActive: true };
  if (existing) {
    await (prisma as any).therapistCourseRate.update({ where: { id: existing.id }, data });
    return;
  }
  await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth: "2032-06", ...data } });
}

async function seedStoryData(): Promise<SeededData> {
  const openMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2032-06" },
    update: {
      startDate: new Date("2032-06-01T00:00:00.000Z"),
      endDate: new Date("2032-06-30T00:00:00.000Z"),
      status: "작성중"
    },
    create: {
      monthKey: "2032-06",
      startDate: new Date("2032-06-01T00:00:00.000Z"),
      endDate: new Date("2032-06-30T00:00:00.000Z"),
      status: "작성중"
    }
  });
  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 92401 },
    update: { displayName: "E2E 924 호실", migrationReferenceName: "E2E24-ROOM", isActive: true },
    create: { displayName: "E2E 924 호실", migrationReferenceName: "E2E24-ROOM", sortOrder: 92401, isActive: true }
  });
  const aCourse = await (prisma as any).course.upsert({
    where: { code: "A" },
    update: { isActive: true },
    create: { code: "A", isActive: true }
  });
  const dCourse = await (prisma as any).course.upsert({
    where: { code: "D" },
    update: { isActive: true },
    create: { code: "D", isActive: true }
  });
  await upsertPolicy({ courseId: aCourse.id, name: "Story24 A 선택", basePrice: 1500000, requiresSecondTherapist: false });
  await upsertPolicy({ courseId: dCourse.id, name: "Story24 D 2:1", basePrice: 3200000, requiresSecondTherapist: true });

  const therapist1 = await seedEmployee("E2E24-THR-001", "E2E24 마사지사1", 92401);
  const therapist2 = await seedEmployee("E2E24-THR-002", "E2E24 마사지사2", 92402);
  await upsertRate(therapist1.id, aCourse.id, 700000);
  await upsertRate(therapist1.id, dCourse.id, 900000);
  await upsertRate(therapist2.id, dCourse.id, 900000);

  await (prisma as any).timeSlot.upsert({
    where: { value: "13:30" },
    update: { sortOrder: 92401, isActive: true },
    create: { value: "13:30", sortOrder: 92401, isActive: true }
  });
  await upsertCodeItem("SERVICE_STATUS", "RESERVED", "예약", 92401);
  await upsertCodeItem("SERVICE_STATUS", "VISIT_COMPLETE", "방문완료", 92402);

  return {
    openMonthId: openMonth.id,
    roomId: room.id,
    aCourseId: aCourse.id,
    dCourseId: dCourse.id,
    therapist1Id: therapist1.id,
    therapist2Id: therapist2.id
  };
}

async function createCallRow(input: { memo: string; courseId: string; therapist2Id?: string | null; status?: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: seededData.openMonthId,
      serviceDate: new Date("2032-06-05T00:00:00.000Z"),
      startTime: "13:30",
      roomId: seededData.roomId,
      courseId: input.courseId,
      customerMemo: input.memo,
      status: input.status ?? "RESERVED",
      // REQ-007: 결제수단이 있어야 결제금액이 매출로 잡힌다. 방문완료 후 코스 금액을 확인하려면 필요하다.
      paymentMethodCode: "CASH"
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: seededData.therapist1Id }
  });
  if (input.therapist2Id) {
    await (prisma as any).serviceCallAssignment.create({
      data: { serviceCallId: call.id, assignmentRole: "THERAPIST_2", employeeId: input.therapist2Id }
    });
  }
  return call;
}

function line(page: Page, callId: string) {
  return page.locator(`tr[data-service-call-id="${callId}"]`);
}

/** 티켓 03: 칸은 더 이상 행에 없다. 줄을 눌러 연 편집 패널이 같은 필드/계산값을 보인다. */
function panel(page: Page) {
  return page.getByRole("complementary", { name: /^콜 상세/ });
}

async function openPanel(page: Page, callId: string) {
  // Next.js의 로딩 스켈레톤이 아직 실제 콜 원장으로 바뀌기 전에 눌러도 재시도하도록, 줄이 실제로
  // 보일 때까지 먼저 기다린 뒤 연다.
  const row = line(page, callId);
  await expect(row).toBeVisible();
  await row.locator("[data-call-open]").click();
  const edit = panel(page);
  await expect(edit).toBeVisible();
  return edit;
}

test.describe("Story 2.4 D코스 마사지사2 필수 검증", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAuthAccount();
    seededData = await seedStoryData();
  });

  test("D코스 + 마사지사2 빈칸 저장/방문완료를 field error와 alert로 차단하고 retry draft를 유지한다", async ({ page }) => {
    const memo = `E2E24 D missing ${Date.now().toString(36)}`;
    const call = await createCallRow({ memo, courseId: seededData.aCourseId });

    await login(page);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-06-05`);

    const edit = await openPanel(page, call.id);
    await selectGridOption(page, edit, "코스", "D Story24 D 2:1");

    const therapist2 = edit.getByLabel("마사지사2");
    // 같은 문구가 필드 오류와 패널 맨 위 저장 실패 배너 양쪽에 role=alert로 뜨므로 첫 번째로 특정한다.
    // (필드 오류 id는 이제 패널 안에서 useId()가 매번 새로 만드는 값이라 "-therapist2-error" 같은
    // 고정 접미사로는 찾을 수 없다.)
    const error = edit.locator('[role="alert"]').filter({ hasText: "D코스는 마사지사2 필수입니다. 마사지사2를 배정해야 저장됩니다." }).first();
    await expect(error).toBeVisible();
    // 저장 상태 칩은 기호와 글자가 한 요소라 정확히 일치시키지 않는다.
    await expect(line(page, call.id).getByText("저장 실패")).toBeVisible();
    await expect(edit.getByRole("button", { name: "재시도" })).toBeVisible();
    await expect(therapist2).toHaveAttribute("aria-invalid", "true");
    await expect(therapist2).toHaveAttribute("aria-describedby", /error/);

    await selectGridOptionByValue(page, edit, "상태", "VISIT_COMPLETE");
    await expect(error).toBeVisible();
    const payment = edit.getByRole("region", { name: "결제" });
    await expect(payment.getByText("계산됨")).toHaveCount(0);
    await expect(payment.getByText("저장 보류 계산 대기")).toBeVisible();

    await edit.getByRole("button", { name: "재시도" }).click();
    await expect(error).toBeVisible();
    // combobox 입력에는 저장값이 아니라 표시 라벨이 들어간다.
    await expect(edit.getByRole("combobox", { name: "상태" })).toHaveValue("방문완료");
    await expect(payment.getByText("저장 보류 계산 대기")).toBeVisible();

    await selectGridOptionByValue(page, edit, "마사지사2", seededData.therapist2Id);
    await expect(error).toHaveCount(0);
    await expect(therapist2).not.toHaveAttribute("aria-invalid", "true");
    await expect(edit.locator('[data-save-state="saved"]')).toContainText("저장됨");
    await expect(payment.getByText("계산됨")).toBeVisible();
    await expect(payment.getByText("3,200,000")).toBeVisible();
  });

  test("비필수 A코스는 마사지사2 없이 저장되고 D코스는 마사지사2 배정 후 계산된다", async ({ page }) => {
    const memo = `E2E24 D success ${Date.now().toString(36)}`;
    const call = await createCallRow({ memo, courseId: seededData.aCourseId });

    await login(page);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-06-05`);

    const edit = await openPanel(page, call.id);
    const payment = edit.getByRole("region", { name: "결제" });
    await selectGridOptionByValue(page, edit, "상태", "VISIT_COMPLETE");
    await expect(payment.getByText("계산됨")).toBeVisible();
    await expect(payment.getByText("1,500,000")).toBeVisible();

    await selectGridOption(page, edit, "코스", "D Story24 D 2:1");
    // 저장 실패의 일반 안내 배너도 role=alert라 같은 문구의 첫 번째 요소로 특정한다.
    await expect(edit.locator('[role="alert"]').filter({ hasText: "D코스는 마사지사2 필수" }).first()).toBeVisible();

    await selectGridOptionByValue(page, edit, "마사지사2", seededData.therapist2Id);
    await expect(payment.getByText("계산됨")).toBeVisible();
    await expect(payment.getByText("3,200,000")).toBeVisible();
    // 카운터에게는 수당이 가려지므로(마사지사 수당 900,000 포함) 결제금액만 확인한다 — 패널에는
    // 이제 그 줄 자체가 안 뜬다(옛 "마사지사1수당" 칼럼 헤더는 패널의 DetailRow로 바뀌었다).
    await expect(payment.getByText("900,000")).toHaveCount(0);
    await expect(payment.getByText("마사지사1수당")).toHaveCount(0);
  });

  // 티켓 03: 새 콜은 빠른 예약으로만 만든다(표 아래 AddRowForm은 없어졌다). 빠른 예약의 D코스·마사지사2
  // 필수 흐름(두 번째 Therapist 단계, 경고 확인 후 배정)은 티켓 21 스펙이 전담해서 본다.

  test.afterAll(async () => {
    await restoreUserAccount("story24_counter", "counter");
    await prisma.$disconnect();
  });
});
