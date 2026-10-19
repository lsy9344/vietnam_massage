import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login as loginAccount } from "./support/auth";


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

// 공유 login 헬퍼는 credentials POST 응답과 landing navigation까지 기다린다. 직접 구현하면
// 클릭 직후의 page.goto가 그 POST를 취소해 세션 없이 /sign-in으로 튕긴다.
async function loginAsCounter(page: Page) {
  await loginAccount(page, "story26_counter", "Story26!counter");
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

function line(page: Page, callId: string) {
  return page.locator(`[data-ledger-line][data-service-call-id="${callId}"]`);
}

/** 티켓 03: type-ahead 콤보박스는 그리드 셀이 아니라 편집 패널의 칸으로 옮겨졌다. */
function panel(page: Page) {
  return page.getByRole("complementary", { name: /^콜 상세/ });
}

test.describe("Story 2.6 keyboard-first call ledger type-ahead", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    seededData = await seedStoryData();
    await createCallRow("Story 2.6 row one");
    await createCallRow("Story 2.6 row two");
  });

  // 티켓 03: 원장 표의 칸별 type-ahead(Story 2.6)는 없어지고 편집 패널의 칸으로 옮겼다. ARIA 계약
  // (aria-expanded·aria-activedescendant, ↓로 열기, ↑↓로 고르기, Enter로 정하기)은 그대로 지킨다.
  test("패널 콤보박스는 type-ahead ARIA 계약을 지키고 고른 값을 바로 저장한다", async ({ page }) => {
    await loginAsCounter(page);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${seededData.serviceDate}`);

    // Next.js의 로딩 스켈레톤이 아직 실제 콜 원장으로 바뀌기 전에 눌러도 재시도하도록, 줄이 실제로
    // 보일 때까지 먼저 기다린다.
    const firstRow = page.locator("[data-ledger-line]").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    const edit = panel(page);
    await expect(edit).toBeVisible();

    // 할인구분은 시드값이 비어 있어(null) 고르면 실제로 값이 바뀐다 — 저장 상태가 "idle"에서
    // "saved"로 실제로 넘어가는지까지 본다(객실처럼 이미 같은 값을 다시 고르면 바뀐 게 없어 보내지 않는다).
    const discountCombobox = edit.getByRole("combobox", { name: "할인구분" });
    await discountCombobox.focus();
    await expect(discountCombobox).toHaveAttribute("aria-expanded", "false");

    // focus 시 컴포넌트가 현재 라벨을 넣고 전체 선택하는데, 첫 글자가 그 선택보다 먼저 도착하면
    // 기존 라벨 뒤에 붙어 필터가 아무것도 못 찾는다. 직접 전체 선택한 뒤 타이핑한다.
    await discountCombobox.press("ControlOrMeta+a");
    await discountCombobox.pressSequentially("생일자");
    await expect(discountCombobox).toHaveAttribute("aria-expanded", "true");
    // 필터 결과가 렌더되기 전에 방향키를 누르면 활성 옵션이 잡히지 않는다.
    await expect(page.getByRole("listbox").getByRole("option")).not.toHaveCount(0);
    await discountCombobox.press("ArrowDown");
    await expect(discountCombobox).toHaveAttribute("aria-activedescendant", /option/);
    await discountCombobox.press("Enter");
    await expect(edit.locator('[data-save-state="saved"]')).toContainText("저장됨");
    await expect(discountCombobox).toHaveValue("생일자");
  });

  test("D코스로 바꾸면 패널 type-ahead로도 마사지사2 필수 오류와 저장 보류 계산 대기가 뜬다", async ({ page }) => {
    await loginAsCounter(page);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${seededData.serviceDate}`);

    // Next.js의 로딩 스켈레톤이 아직 실제 콜 원장으로 바뀌기 전에 눌러도 재시도하도록, 줄이 실제로
    // 보일 때까지 먼저 기다린다.
    const firstRow = page.locator("[data-ledger-line]").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    const edit = panel(page);
    await expect(edit).toBeVisible();

    const courseCombobox = edit.getByRole("combobox", { name: "코스" });
    await courseCombobox.focus();
    await courseCombobox.press("ControlOrMeta+a");
    await courseCombobox.pressSequentially("Story26 D");
    await expect(courseCombobox).toHaveAttribute("aria-expanded", "true");
    // 필터 결과가 렌더되기 전에 Enter를 누르면 일치 항목이 없다고 보고 값이 되돌아간다.
    await expect(page.getByRole("listbox").getByRole("option")).not.toHaveCount(0);
    await courseCombobox.press("Enter");

    // D코스로 바꾸는 순간 마사지사2가 없어 서버가 저장을 거부한다. 패널 맨 위 저장 실패 배너도 같은
    // 문구를 role=alert로 보이므로 첫 번째 요소로 특정한다.
    const error = edit.locator('[role="alert"]').filter({ hasText: "D코스는 마사지사2 필수입니다. 마사지사2를 배정해야 저장됩니다." }).first();
    await expect(error).toBeVisible();

    const statusCombobox = edit.getByRole("combobox", { name: "상태" });
    await expect(async () => {
      await statusCombobox.focus();
      await expect(statusCombobox).toBeFocused();
    }).toPass();
    await statusCombobox.press("ControlOrMeta+a");
    await statusCombobox.pressSequentially("방문완료");
    await statusCombobox.press("Enter");

    await expect(error).toBeVisible();
    const therapist2 = edit.getByRole("combobox", { name: "마사지사2" });
    await expect(therapist2).toHaveAttribute("aria-invalid", "true");
    await expect(therapist2).toHaveAttribute("aria-describedby", /error/);
    await expect(edit.getByRole("region", { name: "결제" }).getByText("저장 보류 계산 대기")).toBeVisible();
  });

  // 티켓 03: 원장은 Tab/Shift+Tab 칸 이동이 없어지고(스펙 D21, 보통 브라우저 탭 순서다), 대신 목록
  // ↑↓로 줄 이동, Enter로 패널 첫 칸, Esc로 그 줄로 복귀, N으로 빠른 예약을 쓴다.
  test("원장 목록 키보드: ↑↓ 줄 이동, Enter는 패널 시간 칸, Esc는 그 줄로, N은 빠른 예약", async ({ page }) => {
    await loginAsCounter(page);
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=${seededData.serviceDate}`);

    // Next.js의 로딩 스켈레톤이 아직 실제 콜 원장으로 바뀌기 전에 포커스를 줘도 재시도하도록, 줄이
    // 실제로 보일 때까지 먼저 기다린다.
    const opener = (id: string) => line(page, id).locator("[data-call-open]");
    const first = page.locator("[data-ledger-line]").first().locator("[data-call-open]");
    await expect(first).toBeVisible();
    await first.focus();
    await page.keyboard.press("ArrowDown");
    const secondId = await page.locator("[data-ledger-line]").nth(1).getAttribute("data-service-call-id");
    await expect(opener(secondId!)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(first).toBeFocused();

    await page.keyboard.press("Enter");
    const firstId = await page.locator("[data-ledger-line]").first().getAttribute("data-service-call-id");
    await expect(page).toHaveURL(new RegExp(`call=${firstId}$`));
    const startTime = panel(page).getByRole("combobox", { name: "시간" });
    await expect(startTime).toBeFocused();

    // 입력칸 안에서는 N이 글자로 들어가고 빠른 예약이 열리지 않는다.
    const note = panel(page).getByLabel("비고");
    await note.focus();
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog", { name: "빠른 예약" })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(opener(firstId!)).toBeFocused();
    await expect(panel(page)).toBeVisible();

    await page.keyboard.press("n");
    await expect(page.getByRole("dialog", { name: "빠른 예약" })).toBeVisible();
  });

  test.afterAll(async () => {
    // 이 스펙이 시드한 콜을 운영월 범위로 정리한 뒤 연결을 닫는다.
    await cleanupStoryData(seededData.openMonthId);
    await prisma.$disconnect();
  });
});
