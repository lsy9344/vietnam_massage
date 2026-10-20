import { testEmployees } from "./support/test-employees";
import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { businessTodayIsoDate } from "@/lib/operating-date";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import {
  checkInTherapist,
  chooseConditions,
  fillBooking,
  goToCustomerStep,
  openQuickBooking,
  pickGuest,
  quickBookingLine,
  saveQuickBooking
} from "./support/quick-booking";

// 티켓 20: 빠른 예약 패널 기본 흐름(1018 스펙 D19·D20). 고객 → 날짜·예약시각 → Therapist·코스 → 객실·메모 → 확인의
// 5단계 모달은 없어지고, 원장 옆 비모달 패널(aside, "빠른 예약")의 2단계(① 조건, ② 고객)로 바뀌었다. 객실 단계와
// 확인 단계는 없다. "지금"(B05)은 실제 오늘 날짜를 쓰므로 이 스펙은 운영월을 실제 오늘을 덮는 범위로 시드한다.
const account = { accountId: "t20_counter", password: "Ticket20!counter", staffCode: "E2E-T20-COUNTER", sortOrder: 92001 };
const today = businessTodayIsoDate();

function currentMonthRange() {
  const [year, month] = today.split("-").map(Number);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { monthKey, startDate: `${monthKey}-01`, endDate: `${monthKey}-${String(lastDay).padStart(2, "0")}` };
}

const { monthKey, startDate, endDate } = currentMonthRange();

let monthId = "";
let courseId = "";
let therapistId = "";
let createdMonth = false;

async function seedAccount() {
  const employee = await testEmployees.upsert({
    where: { staffCode: account.staffCode },
    update: { displayName: "T20 카운터", employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: account.staffCode,
      displayName: "T20 카운터",
      employeeGroup: "OPERATIONS",
      position: "카운터",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: account.sortOrder,
      isActive: true
    }
  });
  const data = {
    email: `${account.accountId}@example.local`,
    passwordHash: await hash(account.password, argon2idOptions),
    role: "counter",
    employeeId: employee.id,
    isActive: true,
    lockedUntil: null,
    failedLoginCount: 0
  };
  await (prisma as any).userAccount.upsert({
    where: { accountId: account.accountId },
    update: data,
    create: { ...data, accountId: account.accountId }
  });
}

async function cleanup() {
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
}

test.describe("티켓 20 빠른 예약 패널 기본 흐름", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount();
    createdMonth = !(await (prisma as any).operatingMonth.findUnique({ where: { monthKey } }));
    const month = await (prisma as any).operatingMonth.upsert({
      where: { monthKey },
      update: { status: "작성중", startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date(`${endDate}T00:00:00.000Z`) },
      create: {
        monthKey,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        status: "작성중"
      }
    });
    monthId = month.id;
    await cleanup();

    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    courseId = course.id;
    const policy = {
      name: "T20 A",
      durationMinutes: 60,
      basePrice: 1500000,
      requiresSecondTherapist: false,
      tvDisplayName: "T20 A",
      effectiveToMonth: monthKey,
      isActive: true
    };
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...policy } });
    }

    const therapist = await testEmployees.upsert({
      where: { staffCode: "E2E-T20-THR-1" },
      update: { displayName: "T20 마사지사", employeeGroup: "THERAPIST", isActive: true },
      create: {
        staffCode: "E2E-T20-THR-1",
        displayName: "T20 마사지사",
        employeeGroup: "THERAPIST",
        position: "마사지사",
        shiftType: "전체",
        baseSalary: 0,
        employmentStatus: "재직",
        sortOrder: 92002,
        isActive: true
      }
    });
    therapistId = therapist.id;
    const existingRate = await (prisma as any).therapistCourseRate.findFirst({
      where: { therapistId, courseId, effectiveFromMonth: monthKey }
    });
    const rate = { amount: 300000, effectiveToMonth: monthKey, isActive: true };
    if (existingRate) {
      await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
    } else {
      await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth: monthKey, ...rate } });
    }
    // Therapist 줄은 그날 출근 기록이 있는 사람만 기본으로 보인다(1018 스펙 D23).
    await checkInTherapist({ operatingMonthId: monthId, serviceDate: today, employeeId: therapistId });
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId, courseId } });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T20 A", effectiveFromMonth: monthKey } });
    await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: monthId } });
    if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  test("PC 폭: ①에서 미지명·Therapist 줄의 코스 칩으로 손님을 담거나 빼고, 인원만큼 담아야 다음이 켜진다. 미지명으로 저장하면 Therapist 배정 없이 콜이 생기고 그 줄이 선택된다", async ({ page }) => {
    // 이 워크트리는 여러 작업자가 동시에 쓴다. 저장 뒤 자동 새로고침이 다른 작업자의 부하로 늦을 때를 대비해 넉넉히 둔다.
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const name = `T20 PC ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${today}`);
    const panel = await openQuickBooking(page);

    await expect(panel.getByLabel("조회날짜")).toHaveValue(today);
    await chooseConditions(panel, { time: "11:00" });

    const nextButton = panel.getByRole("button", { name: "다음", exact: true });
    await expect(nextButton).toBeDisabled();

    // Therapist 줄의 칩으로 담고 뺀다.
    await expect(quickBookingLine(panel, therapistId)).toBeVisible({ timeout: 10_000 });
    await pickGuest(page, panel, { therapistId, courseId });
    const guest = panel.locator('[data-quick-booking-guest="1"]');
    await expect(guest).toContainText("손님 1 · T20 마사지사 A60");
    await expect(nextButton).toBeEnabled();

    await guest.getByRole("button", { name: "빼기" }).click();
    await expect(nextButton).toBeDisabled();
    await expect(panel.getByText("코스 칩을 눌러 손님을 담으세요.")).toBeVisible();

    // 맨 위 미지명 줄의 칩으로 다시 담는다.
    await pickGuest(page, panel, { therapistId: null, courseId });
    await expect(guest).toContainText("손님 1 · 미지명 A60");
    await expect(nextButton).toBeEnabled();

    expect(await (prisma as any).serviceCall.count({ where: { customerMemo: name } })).toBe(0);
    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "전화", bookerName: name, memo: "조용한 방 부탁드립니다" });
    await expect(panel.locator("[data-quick-booking-summary]")).toHaveText(`11:00 · 1명 · 미지명 A60 · 전화 ${name}`);

    await saveQuickBooking(page, panel);

    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: name } });
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe("RESERVED");
    expect(created[0].bookerName).toBe(name);
    expect(created[0].bookingChannelCode).toBe("PHONE");
    expect(created[0].visitRequest).toBe("조용한 방 부탁드립니다");
    const assignments = await (prisma as any).serviceCallAssignment.findMany({ where: { serviceCallId: created[0].id } });
    expect(assignments).toHaveLength(0);

    // 저장하면 빠른 예약 패널이 닫히고, 그 콜이 원장 표에 나타나며 그 줄이 선택돼 포커스도 그 줄의 여는 버튼으로 간다.
    // 운영 빌드의 첫 요청은(서버를 막 올린 뒤) 자동 새로고침이 늦게 끝날 때가 있어 넉넉한 시간을 둔다.
    const row = page.locator(`[data-ledger-line][data-service-call-id="${created[0].id}"]`);
    await expect(row).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(`call=${created[0].id}$`));
    await expect(row.locator(`[data-call-open="${created[0].id}"]`)).toBeFocused({ timeout: 10_000 });
  });

  test("Therapist 줄의 코스 칩으로 이름 있는 손님을 담아 저장하면 그 Therapist가 배정된다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const name = `T20 배정 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${today}`);
    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "12:00" });

    await expect(quickBookingLine(panel, therapistId)).toBeVisible({ timeout: 10_000 });
    await pickGuest(page, panel, { therapistId, courseId });
    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "카카오톡", bookerName: name });
    await saveQuickBooking(page, panel);

    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: name } });
    expect(created).toHaveLength(1);
    const assignments = await (prisma as any).serviceCallAssignment.findMany({ where: { serviceCallId: created[0].id } });
    expect(assignments.map((a: { assignmentRole: string; employeeId: string }) => [a.assignmentRole, a.employeeId])).toContainEqual([
      "THERAPIST_1",
      therapistId
    ]);
  });

  test("\"지금\"을 누르면 날짜가 오늘로, 시간이 지금 시각 칸으로 맞춰진다(B05)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${today}`);
    const panel = await openQuickBooking(page);

    await panel.getByRole("button", { name: "지금", exact: true }).click();
    await expect(panel.getByLabel("조회날짜")).toHaveValue(today);
    // 시간 칸은 공용 listbox(role=combobox)라 값 대신 고른 시각 글자를 보여 준다.
    await expect(panel.locator("#quick-booking-time")).not.toContainText("검색 결과 없음");
  });

  test("태블릿 폭(768px): 같은 흐름으로 예약을 만들 수 있다", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const name = `T20 태블릿 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${today}`);
    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "13:00" });

    await expect(quickBookingLine(panel, therapistId)).toBeVisible({ timeout: 10_000 });
    await pickGuest(page, panel, { therapistId, courseId });
    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "잘로", bookerName: name });
    await saveQuickBooking(page, panel);

    expect(await (prisma as any).serviceCall.count({ where: { customerMemo: name } })).toBe(1);
  });

  test("저장하지 않은 입력이 있는 채로 패널을 닫으려 하면 안내하고, 취소하면 값이 남고 나가기를 누르면 닫히며 값이 사라진다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${today}`);
    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "14:00" });
    await pickGuest(page, panel, { therapistId, courseId });

    await panel.getByRole("button", { name: "닫기" }).click();
    const confirmDialog = page.getByRole("alertdialog", { name: "저장하지 않은 입력이 있습니다" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "취소" }).click();
    await expect(confirmDialog).toBeHidden();
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-quick-booking-guest="1"]')).toContainText("T20 마사지사");

    await panel.getByRole("button", { name: "닫기" }).click();
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "나가기" }).click();
    await expect(panel).toBeHidden();

    expect(await (prisma as any).serviceCall.count({ where: { operatingMonthId: monthId, startTime: "14:00" } })).toBe(0);
  });

  test("응답 유실 뒤 같은 요청으로 재시도하면 패널 밖에 이미 저장 안내가 남고 저장된 행으로 포커스가 간다 (티켓 38)", async ({ page }) => {
    // 이 워크트리는 여러 작업자가 동시에 쓴다. 저장 뒤 자동 새로고침이 다른 작업자의 부하로 늦을 때를 대비해 넉넉히 둔다.
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const name = `T20 유실 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${today}`);
    const panel = await openQuickBooking(page);
    await chooseConditions(panel, { time: "15:00" });
    await pickGuest(page, panel, { therapistId, courseId });
    await goToCustomerStep(panel);
    await fillBooking(panel, { channel: "전화", bookerName: name });

    let dropped = false;
    await page.route((url) => url.pathname === "/calls", async (route) => {
      const request = route.request();
      if (!dropped && request.method() === "POST" && request.headers()["next-action"] && request.postData()?.includes(name)) {
        dropped = true;
        await route.fetch();
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await panel.getByRole("button", { name: "예약 저장" }).click();
    await expect(panel.locator("[data-save-state]")).toHaveAttribute("data-save-state", "checking");
    await panel.getByRole("button", { name: "재시도" }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "이미 저장된 콜입니다." })).toBeVisible();

    const calls = await prisma.serviceCall.findMany({ where: { customerMemo: name } });
    expect(calls).toHaveLength(1);
    const row = page.locator(`[data-ledger-line][data-service-call-id="${calls[0].id}"]`);
    await expect(row).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(`call=${calls[0].id}$`));
    await expect(row.locator(`[data-call-open="${calls[0].id}"]`)).toBeFocused({ timeout: 10_000 });
  });

  test("휴대폰 폭(390px)에서는 빠른 예약 버튼을 제공하지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${today}`);
    await expect(page.locator("[data-quick-booking-trigger]")).toBeHidden();
  });
});
