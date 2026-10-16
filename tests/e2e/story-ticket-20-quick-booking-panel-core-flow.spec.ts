import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { businessTodayIsoDate } from "@/lib/operating-date";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 티켓 20: 빠른 예약 패널 기본 흐름. "지금"(B05)은 실제 오늘 날짜를 쓰므로, 이 스펙은 운영월을 실제
// 오늘을 덮는 범위로 시드한다. 가능 코스는 이 스펙이 만든 Therapist 혼자뿐이라 "지금"이 어떤 슬롯을
// 고르든(영업일 슬롯이 01:00~11:00은 비어 있어 그 사이에는 첫 슬롯 11:00을 고른다, B05) 겹치는 콜이
// 없어 항상 가능으로 보인다.
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
let roomId = "";
let courseId = "";
let therapistId = "";
let therapistId2 = "";
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

function panel(page: Page) {
  return page.getByRole("dialog", { name: "빠른 예약" });
}

async function openQuickBooking(page: Page, operatingMonthId: string, serviceDate: string) {
  await page.goto(`/calls?operatingMonthId=${operatingMonthId}&serviceDate=${serviceDate}`);
  await page.getByRole("button", { name: "빠른 예약" }).click();
  await expect(panel(page)).toBeVisible();
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

    const room = await (prisma as any).room.upsert({
      where: { sortOrder: 92001 },
      update: { displayName: "T20 호실", isActive: true },
      create: { displayName: "T20 호실", migrationReferenceName: "T20-ROOM", sortOrder: 92001, isActive: true }
    });
    roomId = room.id;
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
    // 둘 다 같은 코스 수당을 둔다. 두 테스트(PC·태블릿)가 "지금"으로 같은 실제 시각 근처를 고를 수 있어,
    // 한 명뿐이면 뒤 테스트의 가능 코스가 앞 테스트가 만든 콜로 막힐 수 있다(B01, 두 번째 Therapist로 비껴간다).
    async function seedTherapist(staffCode: string, displayName: string, sortOrder: number) {
      const employee = await testEmployees.upsert({
        where: { staffCode },
        update: { displayName, employeeGroup: "THERAPIST", isActive: true },
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
      const existingRate = await (prisma as any).therapistCourseRate.findFirst({
        where: { therapistId: employee.id, courseId, effectiveFromMonth: monthKey }
      });
      const rate = { amount: 300000, effectiveToMonth: monthKey, isActive: true };
      if (existingRate) {
        await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
      } else {
        await (prisma as any).therapistCourseRate.create({ data: { therapistId: employee.id, courseId, effectiveFromMonth: monthKey, ...rate } });
      }
      return employee.id as string;
    }

    therapistId = await seedTherapist("E2E-T20-THR-1", "T20 마사지사", 92002);
    therapistId2 = await seedTherapist("E2E-T20-THR-2", "T20 마사지사2", 92003);
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId: { in: [therapistId, therapistId2] }, courseId } });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T20 A", effectiveFromMonth: monthKey } });
    await (prisma as any).room.update({ where: { id: roomId }, data: { isActive: false } });
    if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  test("PC 폭: 고객 → 날짜·예약시각(지금) → Therapist·코스(가능) → 객실·메모 → 확인 순서로 예약을 만들고, 가능 버튼과 지금만으로는 저장되지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const memo = `T20 PC ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await openQuickBooking(page, monthId, today);
    const dialog = panel(page);

    // 1단계: 고객. 고르지 않고 고객/메모만 적는다(스토리 58).
    await dialog.getByLabel("고객/메모").fill(memo);
    await dialog.getByRole("button", { name: "다음" }).click();

    // 2단계: 날짜·예약시각. "지금"은 오늘 날짜를 고르고 가능 목록이 있는 단계로 넘어간다(B05).
    await expect(dialog.getByLabel("조회날짜")).toBeVisible();
    await dialog.getByRole("button", { name: "지금" }).click();
    // "지금"은 가능 목록이 있는 다음 단계로 바로 넘어간다(B05). 한 단계 돌아가 날짜가 오늘로 맞춰졌는지 본다.
    await dialog.getByRole("button", { name: "이전" }).click();
    await expect(dialog.getByLabel("조회날짜")).toHaveValue(today);
    await dialog.getByRole("button", { name: "다음" }).click();

    // 3단계: Therapist·코스. 가능 버튼은 Therapist와 코스만 채우고 아직 저장하지 않는다(스토리 59).
    // 두 번째 Therapist("T20 마사지사2")와 행이 섞이지 않게, 정확히 이 이름의 행 안에서 가능 버튼을 고른다.
    const therapistRow = dialog.locator("[data-availability-row]").filter({ has: page.getByText("T20 마사지사", { exact: true }) });
    const courseButton = therapistRow.getByRole("button", { name: /A 60분 가능/ });
    await expect(courseButton).toBeVisible({ timeout: 10_000 });
    await courseButton.click();
    await expect(dialog.getByText("A T20 A · T20 마사지사")).toBeVisible();
    expect(await (prisma as any).serviceCall.count({ where: { customerMemo: memo } })).toBe(0);
    await dialog.getByRole("button", { name: "다음" }).click();

    // 4단계: 객실·메모.
    await dialog.getByLabel("객실").selectOption({ label: "T20 호실" });
    await dialog.getByLabel("비고").fill("조용한 방 부탁드립니다");
    await dialog.getByRole("button", { name: "다음" }).click();

    // 5단계: 확인. 고른 값이 요약에 보이고, 명시적인 저장 버튼으로만 저장된다(스토리 64).
    await expect(dialog.getByText(memo)).toBeVisible();
    await expect(dialog.getByText("A T20 A")).toBeVisible();
    await expect(dialog.getByText("T20 마사지사")).toBeVisible();
    await expect(dialog.getByText("T20 호실")).toBeVisible();
    expect(await (prisma as any).serviceCall.count({ where: { customerMemo: memo } })).toBe(0);

    await dialog.getByRole("button", { name: "예약 저장" }).click();

    // 저장하면 빠른 예약 패널이 닫히고, 그 콜이 원장 표에 나타나며 그 줄이 선택돼 편집 패널이 열린다
    // (주소에 call=<id>). 포커스는 그 줄을 여는 버튼으로 간다(스토리 65, 티켓 03).
    await expect(dialog).toBeHidden();
    await expect(page.getByText("이미 저장된 콜입니다.", { exact: true })).toBeHidden();
    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: memo } });
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe("RESERVED");
    expect(created[0].roomId).toBe(roomId);
    expect(created[0].note).toBe("조용한 방 부탁드립니다");
    const assignments = await (prisma as any).serviceCallAssignment.findMany({ where: { serviceCallId: created[0].id } });
    expect(assignments.map((a: { assignmentRole: string; employeeId: string }) => [a.assignmentRole, a.employeeId])).toContainEqual([
      "THERAPIST_1",
      therapistId
    ]);

    const row = page.locator(`tr[data-service-call-id="${created[0].id}"]`);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(new RegExp(`call=${created[0].id}$`));
    await expect(row.locator(`[data-call-open="${created[0].id}"]`)).toBeFocused({ timeout: 10_000 });
  });

  test("응답 유실 뒤 같은 요청으로 재시도하면 패널 밖에 이미 저장 안내가 남고 저장된 행으로 포커스가 간다 (티켓 38)", async ({ page }) => {
    const memo = `T38-lost-${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await openQuickBooking(page, monthId, today);
    const dialog = panel(page);
    await dialog.getByLabel("고객/메모").fill(memo);
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByLabel("시간").selectOption("15:00");
    await dialog.getByRole("button", { name: "다음" }).click();
    const therapist = dialog.locator("[data-availability-row]").filter({ has: page.getByText("T20 마사지사", { exact: true }) });
    await therapist.getByRole("button", { name: /A 60분 가능/ }).click();
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "다음" }).click();
    let dropped = false;
    await page.route((url) => url.pathname === "/calls", async (route) => {
      const request = route.request();
      if (!dropped && request.method() === "POST" && request.headers()["next-action"] && request.postData()?.includes(memo)) {
        dropped = true;
        await route.fetch();
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await dialog.getByRole("button", { name: "예약 저장" }).click();
    await expect(dialog.locator("[data-save-state]")).toHaveAttribute("data-save-state", "checking");
    await dialog.getByRole("button", { name: "재시도" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "이미 저장된 콜입니다." })).toBeVisible();
    const calls = await prisma.serviceCall.findMany({ where: { customerMemo: memo } });
    expect(calls).toHaveLength(1);
    const row = page.locator(`tr[data-service-call-id="${calls[0].id}"]`);
    await expect(page).toHaveURL(new RegExp(`call=${calls[0].id}$`));
    await expect(row.locator(`[data-call-open="${calls[0].id}"]`)).toBeFocused();
  });

  test("태블릿 폭(768px): 같은 흐름으로 예약을 만들 수 있다", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const memo = `T20 태블릿 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await openQuickBooking(page, monthId, today);
    const dialog = panel(page);

    await dialog.getByLabel("고객/메모").fill(memo);
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "지금" }).click();
    // 어느 Therapist든 상관없다(가능 코스 둘 중 비어 있는 쪽을 쓴다).
    const courseButton = dialog.getByRole("button", { name: /A 60분 가능/ }).first();
    await expect(courseButton).toBeVisible({ timeout: 10_000 });
    await courseButton.click();
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "예약 저장" }).click();

    await expect(dialog).toBeHidden();
    expect(await (prisma as any).serviceCall.count({ where: { customerMemo: memo } })).toBe(1);
  });

  test("코스를 고르지 않고 저장하면 그 단계로 돌아가 필드 옆과 패널 요약에 함께 오류가 보인다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const memo = `T20 검증 오류 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await openQuickBooking(page, monthId, today);
    const dialog = panel(page);

    await dialog.getByLabel("고객/메모").fill(memo);
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByLabel("시간").selectOption("11:00");
    await dialog.getByRole("button", { name: "다음" }).click();
    // Therapist·코스 단계에서 아무 것도 고르지 않고 끝까지 간다.
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "예약 저장" }).click();

    // 저장이 거절되면 그 필드가 있는 단계로 돌아가고, 필드 옆과 패널 요약에 함께 오류가 보인다.
    await expect(dialog.getByText("저장하기 전에 확인하세요")).toBeVisible();
    await expect(dialog.getByText("코스를 선택하세요.")).toHaveCount(2); // 요약과 필드 옆.
    await expect(dialog.getByRole("button", { name: "Therapist·코스" })).toHaveAttribute("aria-current", "step");
    expect(await (prisma as any).serviceCall.count({ where: { customerMemo: memo } })).toBe(0);
  });

  test("휴대폰 폭(390px)에서는 빠른 예약 버튼을 제공하지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${today}`);
    await expect(page.getByRole("button", { name: "빠른 예약" })).toBeHidden();
  });

  test("저장하지 않은 값이 있는 채로 패널을 닫으려 하면 안내하고, 취소하면 값이 그대로 남는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const memo = `T20 이탈 안내 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await openQuickBooking(page, monthId, today);
    const dialog = panel(page);

    await dialog.getByLabel("고객/메모").fill(memo);
    await dialog.getByRole("button", { name: "닫기" }).click();

    const confirmDialog = page.getByRole("alertdialog", { name: "저장하지 않은 입력이 있습니다" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "취소" }).click();
    await expect(confirmDialog).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("고객/메모")).toHaveValue(memo);

    await dialog.getByRole("button", { name: "닫기" }).click();
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "나가기" }).click();
    await expect(dialog).toBeHidden();
    expect(await (prisma as any).serviceCall.count({ where: { customerMemo: memo } })).toBe(0);
  });

  // S2(코드 리뷰)·스토리 70: 카운터가 키보드만으로 패널을 끝까지 쓸 수 있고, 패널을 닫으면 포커스가
  // 원장의 원래 자리(패널을 연 "빠른 예약" 버튼)로 돌아와야 한다. 특히 ConfirmDialog "나가기" 확인 →
  // 패널 닫힘(quick-booking-panel.tsx의 requestClose/setOpen(false)) 경로를 본다 — ModalPanel과
  // ConfirmDialog가 같은 타이밍에 함께 닫혀 포커스 복귀가 꼬일 수 있는 자리다.
  test("키보드만으로 패널 전체를 쓸 수 있고, 닫으면 포커스가 빠른 예약 버튼으로 돌아온다 (S3, 스토리 70)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const memo = `T20 키보드 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${today}`);

    const openButton = page.getByRole("button", { name: "빠른 예약" });
    await openButton.focus();
    await page.keyboard.press("Enter");
    const dialog = panel(page);
    await expect(dialog).toBeVisible();

    // 1단계: 고객. 마우스 없이 포커스를 옮기고 입력한다.
    await dialog.getByLabel("고객/메모").focus();
    await page.keyboard.type(memo);
    await dialog.getByRole("button", { name: "다음" }).focus();
    await page.keyboard.press("Enter");

    // 2단계: 날짜·예약시각. 앞선 테스트들이 "지금" 시각 슬롯을 이미 채워 뒀을 수 있어, 네이티브 select를
    // 키보드로 다뤄 비어 있는 다른 시간을 고른다("지금" 버튼 자체는 PC 폭 테스트가 이미 본다, B05).
    await dialog.getByLabel("시간").focus();
    await dialog.getByLabel("시간").selectOption("16:00");
    await dialog.getByRole("button", { name: "다음" }).focus();
    await page.keyboard.press("Enter");

    // 3단계: Therapist·코스. 어느 Therapist든 상관없다(가능 코스 둘 중 비어 있는 쪽을 쓴다, 태블릿 테스트와 같은 방식).
    const courseButton = dialog.getByRole("button", { name: /A 60분 가능/ }).first();
    await expect(courseButton).toBeVisible({ timeout: 10_000 });
    await courseButton.focus();
    await page.keyboard.press("Enter");
    await dialog.getByRole("button", { name: "다음" }).focus();
    await page.keyboard.press("Enter");

    // 4단계: 객실·메모. 네이티브 select·textarea는 항상 키보드로 다룰 수 있다.
    await dialog.getByLabel("객실").selectOption({ label: "T20 호실" });
    await dialog.getByLabel("비고").focus();
    await page.keyboard.type("키보드로만 적은 비고");
    await dialog.getByRole("button", { name: "다음" }).focus();
    await page.keyboard.press("Enter");

    // 5단계: 확인. 고른 값이 요약에 보인다. 여기서는 저장하지 않고 Esc로 닫는 경로를 본다.
    await expect(dialog.getByText(memo)).toBeVisible();

    await page.keyboard.press("Escape");
    const confirmDialog = page.getByRole("alertdialog", { name: "저장하지 않은 입력이 있습니다" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "나가기" }).focus();
    await page.keyboard.press("Enter");

    // 패널이 닫히면 포커스가 원장의 원래 자리로 돌아온다(스토리 70).
    await expect(dialog).toBeHidden();
    await expect(openButton).toBeFocused();
    expect(await (prisma as any).serviceCall.count({ where: { customerMemo: memo } })).toBe(0);
  });
});
