import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 티켓 03: 원장 탭 / 하루 수납·지출 탭 분리, 탭의 주소 복원, 계산 경고 → 원장 콜, 고객 화면과 접근 권한.
const roles = ["administrator", "counter", "settlement_manager", "waiter", "read_only_viewer"] as const;
type Role = (typeof roles)[number];

const accounts: Record<Role, { accountId: string; password: string }> = {
  administrator: { accountId: "t03_admin", password: "Ticket03!admin" },
  counter: { accountId: "t03_counter", password: "Ticket03!counter" },
  settlement_manager: { accountId: "t03_settlement", password: "Ticket03!settlement" },
  waiter: { accountId: "t03_waiter", password: "Ticket03!waiter" },
  read_only_viewer: { accountId: "t03_viewer", password: "Ticket03!viewer" }
};

const monthKey = "2034-03";
const serviceDate = "2034-03-14";
const customerName = "T03 민아";

let monthId = "";
let customerId = "";
let rateMissingCallId = "";
let customerCallId = "";

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, isActive: true },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position: employeeGroup === "THERAPIST" ? "마사지사" : "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

async function seedAccount(role: Role) {
  const account = accounts[role];
  const employee = await seedEmployee(`E2E-T03-${role.toUpperCase()}`, `T03 ${role}`, "OPERATIONS", 9300 + roles.indexOf(role));
  const data = {
    email: `${account.accountId}@example.local`,
    passwordHash: await hash(account.password, argon2idOptions),
    role,
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

async function upsertPolicy(courseId: string) {
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
  const data = {
    name: "T03 A",
    durationMinutes: 60,
    basePrice: 1500000,
    opsCallCredit: 1,
    earcarePoolAmount: 0,
    requiresSecondTherapist: false,
    tvDisplayName: "T03 A",
    effectiveToMonth: null,
    isActive: true
  };
  if (existing) {
    await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data });
  } else {
    await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...data } });
  }
}

async function createCall(input: { therapistId: string; roomId: string; courseId: string; memo: string; status: string; startTime: string; paymentMethodCode?: string; customerId?: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      roomId: input.roomId,
      courseId: input.courseId,
      customerMemo: input.memo,
      customerId: input.customerId ?? null,
      status: input.status,
      paymentMethodCode: input.paymentMethodCode ?? null
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId }
  });
  return call.id as string;
}

async function cleanup() {
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
  await (prisma as any).dailyExpense.deleteMany({ where: { operatingMonthId: monthId } });
  await (prisma as any).customer.deleteMany({ where: { name: { startsWith: "T03 " } } });
}

function toolbarTabs(page: Page) {
  return page.getByRole("navigation", { name: "콜 원장 보기" });
}

test.describe("티켓 03 콜 원장 화면 분리", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const role of roles) {
      await seedAccount(role);
    }
    const month = await (prisma as any).operatingMonth.upsert({
      where: { monthKey },
      update: { status: "작성중" },
      create: {
        monthKey,
        startDate: new Date(`${monthKey}-01T00:00:00.000Z`),
        endDate: new Date(`${monthKey}-31T00:00:00.000Z`),
        status: "작성중"
      }
    });
    monthId = month.id;
    await cleanup();

    const room = await (prisma as any).room.upsert({
      where: { sortOrder: 93001 },
      update: { displayName: "T03 호실", isActive: true },
      create: { displayName: "T03 호실", migrationReferenceName: "T03-ROOM", sortOrder: 93001, isActive: true }
    });
    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    await upsertPolicy(course.id);
    const ratedTherapist = await seedEmployee("E2E-T03-THR-1", "T03 마사지사1", "THERAPIST", 9311);
    // 이 마사지사는 수당이 없어 방문완료 콜이 계산 경고(수당 없음)가 된다.
    const unratedTherapist = await seedEmployee("E2E-T03-THR-2", "T03 마사지사2", "THERAPIST", 9312);
    const existingRate = await (prisma as any).therapistCourseRate.findFirst({
      where: { therapistId: ratedTherapist.id, courseId: course.id, effectiveFromMonth: monthKey }
    });
    if (!existingRate) {
      await (prisma as any).therapistCourseRate.create({
        data: { therapistId: ratedTherapist.id, courseId: course.id, effectiveFromMonth: monthKey, amount: 700000, effectiveToMonth: null, isActive: true }
      });
    }
    for (const [value, sortOrder] of [["11:00", 93011], ["13:00", 93013], ["15:00", 93015]] as const) {
      await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
    }

    const customer = await (prisma as any).customer.create({ data: { name: customerName, phone: "0901230303", memo: "T03 단골" } });
    customerId = customer.id;

    customerCallId = await createCall({
      therapistId: ratedTherapist.id,
      roomId: room.id,
      courseId: course.id,
      memo: "T03 방문완료 현금",
      status: "VISIT_COMPLETE",
      startTime: "11:00",
      paymentMethodCode: "CASH",
      customerId
    });
    rateMissingCallId = await createCall({
      therapistId: unratedTherapist.id,
      roomId: room.id,
      courseId: course.id,
      memo: "T03 수당 없음",
      status: "VISIT_COMPLETE",
      startTime: "13:00",
      paymentMethodCode: "CASH"
    });
    await createCall({ therapistId: ratedTherapist.id, roomId: room.id, courseId: course.id, memo: "T03 예약", status: "RESERVED", startTime: "15:00" });
  });

  test.afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  test("원장 탭은 날짜, 상태별 건수, 원장 표만 두고 원장 표가 첫 화면에 보인다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    await expect(toolbarTabs(page).getByRole("link", { name: "원장", exact: true })).toHaveAttribute("aria-current", "page");
    const counts = page.getByRole("list", { name: "상태별 건수" });
    await expect(counts).toContainText("전체 3건");
    await expect(counts).toContainText("예약 1건");
    await expect(counts).toContainText("방문완료 2건");
    await expect(page.getByRole("heading", { name: "콜 원장 그리드" })).toBeInViewport();
    await expect(page.locator(`tr[data-service-call-id="${customerCallId}"]`)).toBeInViewport();

    await expect(page.getByLabel("일별 지출")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "지출 추가" })).toHaveCount(0);
    await expect(page.getByLabel("하루 수납 요약")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "고객 등록" })).toHaveCount(0);
    await expect(page.getByLabel("고객 검색")).toHaveCount(0);

    await page.getByRole("link", { name: "고객 화면" }).click();
    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.getByRole("heading", { name: "고객", level: 1 })).toBeVisible();
  });

  test("하루 수납·지출 탭은 같은 날짜의 금액과 지출을 보이고, 고른 탭이 주소에 남아 새로고침과 뒤로 가기에서 복원된다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    const ledgerUrl = `/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`;
    await page.goto(ledgerUrl);

    await toolbarTabs(page).getByRole("link", { name: "하루 수납·지출" }).click();
    await expect(page).toHaveURL(`${ledgerUrl}&tab=cashbook`);
    await expect(toolbarTabs(page).getByRole("link", { name: "하루 수납·지출" })).toHaveAttribute("aria-current", "page");
    const cards = page.getByLabel("하루 수납 요약");
    await expect(cards.locator("div").filter({ hasText: /^결제합계/ })).toContainText("1,500,000 VND");
    await expect(cards.locator("div").filter({ hasText: /^순매출/ })).toContainText("1,500,000 VND");
    await expect(cards.locator("div").filter({ hasText: /^현금 잔액/ })).toContainText("1,500,000 VND");
    // 지출 추가는 이 탭 도구줄의 주요 행동이다.
    await expect(page.locator("header").getByRole("button", { name: "지출 추가" })).toBeVisible();
    await expect(page.getByRole("list", { name: "상태별 건수" })).toHaveCount(0);
    await expect(page.getByLabel("조회날짜")).toHaveValue(serviceDate);

    await page.reload();
    await expect(toolbarTabs(page).getByRole("link", { name: "하루 수납·지출" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByLabel("일별 지출")).toBeVisible();

    // 날짜를 옮겨도 탭이 남는다.
    await page.getByRole("link", { name: "다음 날" }).click();
    await expect(page).toHaveURL(`/calls?operatingMonthId=${monthId}&serviceDate=2034-03-15&tab=cashbook`);
    await page.goBack();
    await expect(page).toHaveURL(`${ledgerUrl}&tab=cashbook`);

    await toolbarTabs(page).getByRole("link", { name: "원장", exact: true }).click();
    await expect(page).toHaveURL(ledgerUrl);
    await expect(page.getByRole("heading", { name: "콜 원장 그리드" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(`${ledgerUrl}&tab=cashbook`);
    await expect(page.getByLabel("일별 지출")).toBeVisible();

    // 도크로 원장 구역에 들어가면 늘 원장 탭이다.
    await page.getByRole("navigation", { name: "업무 이동" }).getByRole("link", { name: "원장", exact: true }).click();
    await expect(page).toHaveURL(ledgerUrl);
  });

  test("계산 경고 건수를 펼치면 계산 오류 콜이 보이고, 그 항목에서 원장의 그 날짜와 콜로 간다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}&tab=cashbook`);

    await page.getByText("계산 경고 1건").click();
    const warnings = page.getByRole("table", { name: "계산 경고 콜" });
    await expect(warnings.getByRole("row", { name: /13:00 T03 수당 없음 마사지사 수당 정책을 찾을 수 없습니다/ })).toBeVisible();
    await warnings.getByRole("link", { name: "원장에서 보기" }).click();

    await expect(page).toHaveURL(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}&call=${rateMissingCallId}`);
    await expect(toolbarTabs(page).getByRole("link", { name: "원장", exact: true })).toHaveAttribute("aria-current", "page");
    const target = page.locator(`tr#call-${rateMissingCallId}`);
    await expect(target).toBeInViewport();
    await expect(target).toHaveAttribute("data-selected", "true");
    await expect(page.getByRole("complementary", { name: /^콜 상세/ })).toBeVisible();
  });

  for (const role of ["administrator", "counter"] as const) {
    test(`${role}는 고객 화면을 연다`, async ({ page }) => {
      await login(page, accounts[role].accountId, accounts[role].password);
      await page.goto("/customers");
      await expect(page).toHaveURL(/\/customers$/);
      await expect(page.getByRole("heading", { name: "고객", level: 1 })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "업무 이동" }).getByRole("link", { name: "고객", exact: true })).toHaveAttribute(
        "aria-current",
        "page"
      );
    });
  }

  for (const [role, landing] of [
    ["settlement_manager", /\/settlements$/],
    ["waiter", /\/rooms$/],
    ["read_only_viewer", /\/rooms$/]
  ] as const) {
    test(`${role}는 고객 화면에 들어가지 못하고 자기 첫 화면으로 돌아간다`, async ({ page }) => {
      await login(page, accounts[role].accountId, accounts[role].password);
      await page.goto("/customers");
      await expect(page).toHaveURL(landing);
      await expect(page.getByRole("heading", { name: "고객", level: 1 })).toHaveCount(0);
    });
  }

  test("고객 화면에서 검색해 고르면 공통 정보와 방문 이력이 보이고, 이력 행에서 그 날짜 원장의 콜로 간다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto("/customers");

    await page.getByRole("combobox", { name: "고객 검색" }).fill("T03 민");
    await expect(page).toHaveURL(/customerQuery=T03/);
    await page.getByRole("option", { name: /T03 방문완료 현금/ }).click();
    await expect(page).toHaveURL(new RegExp(`visitCustomer=${customerId}`));

    const panel = page.getByRole("complementary", { name: customerName });
    await expect(panel.getByLabel("이름")).toHaveValue(customerName);
    await expect(panel.getByLabel("연락처")).toHaveValue("0901230303");
    const history = panel.getByRole("region", { name: "방문 이력" });
    await expect(history.getByRole("row", { name: /2034-03-14 11:00/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("complementary", { name: customerName })).toBeVisible();

    await history.getByRole("link", { name: serviceDate }).click();
    await expect(page).toHaveURL(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}&call=${customerCallId}`);
    await expect(page.locator(`tr#call-${customerCallId}`)).toBeInViewport();
    await expect(page.locator(`tr#call-${customerCallId}`)).toHaveAttribute("data-selected", "true");
  });

  test("고객 등록과 정정은 고객 화면에서 저장된다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto("/customers");

    await page.getByRole("button", { name: "고객 등록" }).click();
    const drawer = page.getByRole("dialog", { name: "고객 등록" });
    await drawer.getByLabel("이름").fill("T03 신규");
    await drawer.getByLabel("연락처").fill("0907770303");
    await drawer.getByRole("button", { name: "고객 등록" }).click();
    await expect(drawer).toHaveCount(0);

    const created = await (prisma as any).customer.findFirst({ where: { name: "T03 신규" } });
    expect(created?.phone).toBe("0907770303");
    await expect(page).toHaveURL(new RegExp(`visitCustomer=${created.id}`));
    const panel = page.getByRole("complementary", { name: "T03 신규" });
    await expect(panel.getByText("방문 이력이 없습니다.")).toBeVisible();

    await panel.getByLabel("메모").fill("T03 정정 메모");
    await panel.getByRole("button", { name: "고치기" }).click();
    await expect(panel.getByText("저장됨")).toBeVisible();
    await expect
      .poll(async () => (await (prisma as any).customer.findUnique({ where: { id: created.id } }))?.memo)
      .toBe("T03 정정 메모");
    await expect
      .poll(async () => (prisma as any).auditLog.count({ where: { targetType: "customer", targetId: created.id } }))
      .toBe(2);
  });
});
