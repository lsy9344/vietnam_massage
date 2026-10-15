import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

/**
 * 티켓 24: 빠른 예약 고객 단계의 새 고객 함께 저장과 최근 방문 가져오기(스펙 F01·F06, 스토리 57·68·71-73,
 * 91). 같은 요청 id로 다시 보내도 고객이 두 번 생기지 않는 것은 콜 서비스 단위 테스트
 * (service-call-service.test.ts의 "quick booking: new customer saved with the call")가 확인하므로,
 * 여기서는 화면에서 실제로 새 고객이 콜과 함께 만들어지는지, 체크한 항목만 가져와지는지, 패널에서
 * 고객 화면으로 바로 갈 수 있는지만 본다.
 */

const operatingMonthKey = "2040-05";
const serviceDate = "2040-05-15";

const account = { accountId: "t24_counter", password: "Ticket24!counter", staffCode: "E2E-T24-COUNTER", sortOrder: 92400 };

let monthId = "";
let roomId = "";
let courseId = "";
let therapistId = "";
let existingCustomerId = "";

async function seedAccount() {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: account.staffCode },
    update: { displayName: "T24 카운터", employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: account.staffCode,
      displayName: "T24 카운터",
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
  await (prisma as any).customer.deleteMany({ where: { name: { startsWith: "T24 " } } });
}

function panel(page: Page) {
  return page.getByRole("dialog", { name: "빠른 예약" });
}

async function openQuickBooking(page: Page) {
  await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
  await page.getByRole("button", { name: "빠른 예약" }).click();
  await expect(panel(page)).toBeVisible();
}

test.describe("티켓 24 빠른 예약 새 고객 함께 저장과 최근 방문 가져오기", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount();
    const month = await (prisma as any).operatingMonth.upsert({
      where: { monthKey: operatingMonthKey },
      update: { status: "작성중" },
      create: {
        monthKey: operatingMonthKey,
        startDate: new Date(`${operatingMonthKey}-01T00:00:00.000Z`),
        endDate: new Date(`${operatingMonthKey}-31T00:00:00.000Z`),
        status: "작성중"
      }
    });
    monthId = month.id;
    await cleanup();

    const room = await (prisma as any).room.upsert({
      where: { sortOrder: 92400 },
      update: { displayName: "T24 호실", isActive: true },
      create: { displayName: "T24 호실", migrationReferenceName: "T24-ROOM", sortOrder: 92400, isActive: true }
    });
    roomId = room.id;
    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    courseId = course.id;
    const policy = {
      name: "T24 A",
      durationMinutes: 60,
      basePrice: 1500000,
      opsCallCredit: 1,
      earcarePoolAmount: 0,
      requiresSecondTherapist: false,
      tvDisplayName: "T24 A",
      effectiveToMonth: operatingMonthKey,
      isActive: true
    };
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: operatingMonthKey } });
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: operatingMonthKey, ...policy } });
    }

    const therapist = await (prisma as any).employee.upsert({
      where: { staffCode: "E2E-T24-THR-1" },
      update: { displayName: "T24 마사지사", employeeGroup: "THERAPIST", isActive: true },
      create: {
        staffCode: "E2E-T24-THR-1",
        displayName: "T24 마사지사",
        employeeGroup: "THERAPIST",
        position: "마사지사",
        shiftType: "전체",
        baseSalary: 0,
        employmentStatus: "재직",
        sortOrder: 92401,
        isActive: true
      }
    });
    therapistId = therapist.id;
    const existingRate = await (prisma as any).therapistCourseRate.findFirst({
      where: { therapistId, courseId, effectiveFromMonth: operatingMonthKey }
    });
    const rate = { amount: 300000, effectiveToMonth: operatingMonthKey, isActive: true };
    if (existingRate) {
      await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
    } else {
      await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth: operatingMonthKey, ...rate } });
    }

    // 기존 고객: 완료된 방문 하나(코스·Therapist·방문별 요청을 담은) — 최근 방문 가져오기 대상.
    const existingCustomer = await (prisma as any).customer.create({
      data: { name: "T24 재방문", phone: "0907778889", memo: "단골" }
    });
    existingCustomerId = existingCustomer.id;
    const existingCall = await (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: monthId,
        serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
        startTime: "11:00",
        roomId,
        courseId,
        customerId: existingCustomerId,
        customerMemo: "T24 재방문",
        status: "방문완료",
        visitRequest: "조용한 방으로 부탁드립니다"
      }
    });
    await (prisma as any).serviceCallAssignment.create({
      data: { serviceCallId: existingCall.id, employeeId: therapistId, assignmentRole: "THERAPIST_1" }
    });
  });

  test.afterAll(async () => {
    await cleanup();
    await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId, courseId } });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T24 A", effectiveFromMonth: operatingMonthKey } });
    await (prisma as any).room.update({ where: { id: roomId }, data: { isActive: false } });
    await prisma.$disconnect();
  });

  test("새 고객을 만들어 콜과 함께 저장하면 고객이 하나 생기고 콜에 연결된다(스토리 57·68)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const name = `T24 새손님 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await openQuickBooking(page);
    const dialog = panel(page);

    await dialog.getByRole("button", { name: "새 고객 만들기" }).click();
    await dialog.getByLabel("이름").fill(name);
    await dialog.getByLabel("연락처").fill("0909998887");
    await dialog.getByLabel("공통 선호·주의사항").fill("창가 자리 선호");
    await dialog.getByRole("button", { name: "다음" }).click();

    await dialog.getByLabel("시간").selectOption("13:00");
    await dialog.getByRole("button", { name: "다음" }).click();

    const courseButton = dialog.getByRole("button", { name: /A 60분 가능/ }).first();
    await expect(courseButton).toBeVisible({ timeout: 10_000 });
    await courseButton.click();
    await dialog.getByRole("button", { name: "다음" }).click();

    await dialog.getByLabel("객실").selectOption({ label: "T24 호실" });
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "예약 저장" }).click();

    await expect(dialog).toBeHidden();

    const createdCustomers = await (prisma as any).customer.findMany({ where: { name } });
    expect(createdCustomers).toHaveLength(1);
    expect(createdCustomers[0].phone).toBe("0909998887");
    expect(createdCustomers[0].preferenceNote).toBe("창가 자리 선호");
    expect(createdCustomers[0].memo).toBeNull();

    const createdCall = await (prisma as any).serviceCall.findFirst({ where: { customerId: createdCustomers[0].id } });
    expect(createdCall).not.toBeNull();
    expect(createdCall.startTime).toBe("13:00");
  });

  test("기존 고객을 고르면 방문완료 건수와 최근 방문이 보이고, 체크한 항목만 가져온다(B09, 스토리 71-73)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    await openQuickBooking(page);
    const dialog = panel(page);

    await dialog.getByRole("combobox", { name: "고객 검색" }).fill("T24 재방문");
    const option = dialog.getByRole("option", { name: "T24 재방문" });
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    await expect(dialog.getByText("T24 재방문 · 0907778889")).toBeVisible();

    // 방문완료·노쇼·취소 건수(0건 포함)와 최근 방문의 코스·Therapist·방문별 요청이 보인다.
    const counts = dialog.getByRole("list", { name: "방문완료·노쇼·취소 건수" });
    await expect(counts).toContainText("방문완료1건");
    await expect(counts).toContainText("노쇼0건");
    await expect(counts).toContainText("취소0건");
    await expect(dialog.getByText(/코스 가져오기: A/)).toBeVisible();
    await expect(dialog.getByText("Therapist 가져오기: T24 마사지사")).toBeVisible();
    await expect(dialog.getByText("방문별 요청 가져오기: 조용한 방으로 부탁드립니다")).toBeVisible();

    // 코스와 방문별 요청만 체크한다(Therapist는 체크하지 않는다) — 자동 복사가 없고 체크한 것만 가져온다.
    await dialog.getByRole("checkbox", { name: /코스 가져오기/ }).check();
    await dialog.getByRole("checkbox", { name: /방문별 요청 가져오기/ }).check();

    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByLabel("시간").selectOption("15:00");
    await dialog.getByRole("button", { name: "다음" }).click();
    // 코스는 가져왔지만 Therapist는 체크하지 않아 여전히 고르지 않은 상태다(요약에 "—"로 보인다).
    await expect(dialog.getByText("A T24 A · —")).toBeVisible();
    const courseButton = dialog.getByRole("button", { name: /A 60분 가능/ }).first();
    await expect(courseButton).toBeVisible({ timeout: 10_000 });
    await courseButton.click();
    await dialog.getByRole("button", { name: "다음" }).click();

    await expect(dialog.getByLabel("방문별 요청")).toHaveValue("조용한 방으로 부탁드립니다");
    await dialog.getByLabel("객실").selectOption({ label: "T24 호실" });
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "예약 저장" }).click();
    await expect(dialog).toBeHidden();

    const createdCall = await (prisma as any).serviceCall.findFirst({
      where: { customerId: existingCustomerId, startTime: "15:00" }
    });
    expect(createdCall).not.toBeNull();
    expect(createdCall.courseId).toBe(courseId);
    expect(createdCall.visitRequest).toBe("조용한 방으로 부탁드립니다");
  });

  test("고객 단계에서 고객 화면으로 이동하는 링크를 그대로 따라가면 그 고객이 열린다(스토리 91)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    await openQuickBooking(page);
    const dialog = panel(page);

    await dialog.getByRole("combobox", { name: "고객 검색" }).fill("T24 재방문");
    const option = dialog.getByRole("option", { name: "T24 재방문" });
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    await expect(dialog.getByText("T24 재방문 · 0907778889")).toBeVisible();

    const goToCustomer = dialog.getByRole("link", { name: "고객 화면으로 이동" });
    await expect(goToCustomer).toHaveAttribute("href", new RegExp(`visitCustomer=${existingCustomerId}$`));
    await goToCustomer.click();

    // 고객을 고른 것은 저장하지 않은 입력이라(티켓 18), 이동을 가로채 먼저 안내한다. "나가기"를 고르면 이동한다.
    const confirmDialog = page.getByRole("alertdialog", { name: "저장하지 않은 입력이 있습니다" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "나가기" }).click();

    await expect(page).toHaveURL(new RegExp(`visitCustomer=${existingCustomerId}`));
    await expect(page.getByRole("complementary", { name: "T24 재방문" })).toBeVisible();
  });
});
