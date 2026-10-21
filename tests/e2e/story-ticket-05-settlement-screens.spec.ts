import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";
import { employeeRow, openEmployeePanel } from "./support/settlement";

// 다른 스펙이 쓰지 않는 운영월. 끝나면 지워서 다른 스펙의 기본 운영월 선택에 끼어들지 않게 한다.
const monthKey = "2037-03";
const serviceDate = "2037-03-14";
const memoPrefix = "Ticket 05";
const courseCode = "E2E-T05";

const accounts = {
  admin: { accountId: "ticket05_admin", password: "Ticket05!admin", role: "administrator", staffCode: "E2E-T05-ADM" },
  settlement: { accountId: "ticket05_settlement", password: "Ticket05!settle", role: "settlement_manager", staffCode: "E2E-T05-SET" }
} as const;

const seeded = {
  monthId: "",
  maiId: "",
  callIds: [] as string[]
};

// 직원은 (직군, 정렬 순서)가 겹치면 안 되고 다른 스펙도 같은 DB에 직원을 넣으므로, 비어 있는 정렬 순서를 찾는다.
async function freeEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({ where: { employeeGroup, sortOrder, NOT: { staffCode } }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }
  throw new Error(`No Ticket 05 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string) {
  return testEmployees.upsert({
    where: { staffCode },
    update: { displayName, isActive: true },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position,
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await freeEmployeeSortOrder(employeeGroup, staffCode, 95050),
      isActive: true
    }
  });
}

async function seedAccount(account: (typeof accounts)[keyof typeof accounts]) {
  const employee = await seedEmployee(account.staffCode, `E2E T05 ${account.role}`, "OPERATIONS", "정산");
  const passwordHash = await hash(account.password, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: account.accountId },
    update: { passwordHash, role: account.role, employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      email: `${account.accountId}@example.local`,
      accountId: account.accountId,
      passwordHash,
      role: account.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function cleanup() {
  const month = await (prisma as any).operatingMonth.findUnique({ where: { monthKey }, select: { id: true } });
  if (month) {
    const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: month.id }, select: { id: true } });
    const callIds = calls.map((call: { id: string }) => call.id);
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
    await (prisma as any).payoutConfirmationEvent.deleteMany({ where: { operatingMonthId: month.id } });
    await (prisma as any).therapistDailySettlementPaymentHistory.deleteMany({ where: { operatingMonthId: month.id } });
    await (prisma as any).therapistDailySettlementPayment.deleteMany({ where: { operatingMonthId: month.id } });
    await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: month.id } });
    await (prisma as any).opsAttendance.deleteMany({ where: { operatingMonthId: month.id } });
    await (prisma as any).operatingMonth.delete({ where: { id: month.id } });
  }
  const course = await (prisma as any).course.findUnique({ where: { code: courseCode }, select: { id: true } });
  if (course) {
    await (prisma as any).therapistCourseRate.deleteMany({ where: { courseId: course.id } });
    await (prisma as any).coursePolicy.deleteMany({ where: { courseId: course.id } });
  }
}

async function seed() {
  await seedAccount(accounts.admin);
  await seedAccount(accounts.settlement);
  await cleanup();

  const month = await (prisma as any).operatingMonth.create({
    data: { monthKey, startDate: new Date(`${monthKey}-01T00:00:00.000Z`), endDate: new Date(`${monthKey}-31T00:00:00.000Z`), status: "작성중" }
  });
  seeded.monthId = month.id;

  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 95051 },
    update: { displayName: "E2E T05 호실", isActive: true },
    create: { displayName: "E2E T05 호실", migrationReferenceName: "E2E-T05-ROOM", sortOrder: 95051, isActive: true }
  });
  const course = await (prisma as any).course.upsert({ where: { code: courseCode }, update: { isActive: true }, create: { code: courseCode, isActive: true } });
  await (prisma as any).coursePolicy.create({
    data: {
      courseId: course.id,
      name: "Ticket05 A60",
      durationMinutes: 60,
      basePrice: 1000000,
      requiresSecondTherapist: false,
      tvDisplayName: "T05 A60",
      effectiveFromMonth: monthKey,
      effectiveToMonth: null,
      isActive: true
    }
  });

  const mai = await seedEmployee("E2E-T05-THR-1", "T05 Mai", "THERAPIST", "마사지사");
  const linh = await seedEmployee("E2E-T05-THR-2", "T05 Linh", "THERAPIST", "마사지사");
  await seedEmployee("E2E-T05-OPS-1", "T05 Minh", "OPERATIONS", "카운터");
  seeded.maiId = mai.id;
  for (const therapist of [mai, linh]) {
    await (prisma as any).therapistCourseRate.create({
      data: { therapistId: therapist.id, courseId: course.id, amount: 400000, effectiveFromMonth: monthKey, effectiveToMonth: null, isActive: true }
    });
  }

  seeded.callIds = [];
  for (const [startTime, assignees] of [
    ["14:00", [mai, linh]],
    ["16:30", [mai]]
  ] as const) {
    const call = await (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: month.id,
        serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
        startTime,
        roomId: room.id,
        courseId: course.id,
        customerMemo: `${memoPrefix} 단골 090111`,
        status: "방문완료",
        paymentMethodCode: "CASH"
      }
    });
    seeded.callIds.push(call.id);
    for (const [index, assignee] of assignees.entries()) {
      await (prisma as any).serviceCallAssignment.create({
        data: { serviceCallId: call.id, assignmentRole: index === 0 ? "THERAPIST_1" : "THERAPIST_2", employeeId: assignee.id, isActive: true }
      });
    }
  }
}

const screens = {
  therapist: () => `/settlements?operatingMonthId=${seeded.monthId}&serviceDate=${serviceDate}`,
  opsDaily: () => `/settlements/operations?operatingMonthId=${seeded.monthId}&attendanceDate=${serviceDate}`,
  opsMonthly: () => `/settlements/operations/monthly?operatingMonthId=${seeded.monthId}`
};

async function documentOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function height(locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  return box?.height ?? 0;
}

test.describe("Ticket 05 settlement screens", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seed();
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await prisma.$disconnect();
  });

  test("an administrator follows an evidence call to that date and call in the ledger", async ({ page }) => {
    await login(page, accounts.admin.accountId, accounts.admin.password);
    await page.goto(screens.therapist());

    await expect(employeeRow(page, "T05 Mai")).toContainText("800,000 VND");
    const panel = await openEmployeePanel(page, "T05 Mai");
    // 패널에는 근거 콜 링크(원장에서 보기) 둘 외에, 티켓 32가 더한 월 명세서 링크("월 명세서 보기")도 있다.
    // 이 테스트는 근거 콜 링크만 센다.
    await expect(panel.getByRole("link", { name: "원장에서 보기" })).toHaveCount(2);
    const firstCallLink = panel.getByRole("link", { name: "원장에서 보기" }).filter({ hasText: `${serviceDate} 14:00` });
    await expect(firstCallLink).toContainText("원장에서 보기");

    await firstCallLink.click();
    await expect(page).toHaveURL(new RegExp(`/calls\\?operatingMonthId=${seeded.monthId}&serviceDate=${serviceDate}&call=${seeded.callIds[0]}$`));
    await expect(page.locator(`[id="call-${seeded.callIds[0]}"]`)).toBeAttached();

    // 월 총콜 근거 콜도 관리자에게는 원장 링크다(도크의 원장 링크와 구분해 목록 안에서 센다).
    await page.goto(screens.opsMonthly());
    await expect(page.getByRole("list", { name: "월 총콜 산출 근거" }).getByRole("link")).toHaveCount(2);
  });

  test("a settlement manager sees the call summary in place, without a ledger link, on every settlement screen", async ({ page }) => {
    await login(page, accounts.settlement.accountId, accounts.settlement.password);

    await page.goto(screens.therapist());
    const therapistPanel = await openEmployeePanel(page, "T05 Mai");
    // 근거 콜 순서는 원장과 같다(시간 슬롯 순서). 다른 스펙이 슬롯 순서를 바꿀 수 있어 시각으로 고른다.
    const firstCall = therapistPanel.getByRole("listitem").filter({ hasText: `${serviceDate} 14:00` });
    await expect(firstCall).toContainText(courseCode);
    await expect(firstCall).toContainText("T05 Mai, T05 Linh");
    await expect(firstCall).toContainText("방문완료");
    await expect(therapistPanel.getByText("원장에서 보기")).toHaveCount(0);
    // 콜 요약에는 고객/메모와 연락처가 없다.
    await expect(page.getByText(memoPrefix)).toHaveCount(0);
    await expect(page.locator('a[href^="/calls"]')).toHaveCount(0);

    await page.goto(screens.opsDaily());
    const opsPanel = await openEmployeePanel(page, "T05 Minh");
    await expect(opsPanel.getByRole("heading", { name: "일 총콜 산출 근거" })).toBeVisible();
    await expect(opsPanel.getByRole("listitem").filter({ hasText: `${serviceDate} 14:00` })).toContainText("방문완료");
    await expect(page.locator('a[href^="/calls"]')).toHaveCount(0);

    await page.goto(screens.opsMonthly());
    await expect(page.getByRole("list", { name: "월 총콜 산출 근거" })).toContainText(`${serviceDate} 16:30`);
    await expect(page.locator('a[href^="/calls"]')).toHaveCount(0);
  });

  test("selects an employee from the keyboard, keeps the choice in the address, and uses 44px controls", async ({ page }) => {
    await login(page, accounts.settlement.accountId, accounts.settlement.password);
    await page.goto(screens.therapist());

    const maiButton = employeeRow(page, "T05 Mai").getByRole("button");
    await maiButton.focus();
    await page.keyboard.press("Enter");
    const panel = page.getByRole("complementary", { name: /^T05 Mai \(/ });
    await expect(panel).toBeVisible();
    await expect(maiButton).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(new RegExp(`[?&]employee=${seeded.maiId}`));

    expect(await height(maiButton)).toBeGreaterThanOrEqual(44);
    expect(await height(panel.getByRole("button", { name: "닫기" }))).toBeGreaterThanOrEqual(44);
    expect(await height(panel.getByRole("button", { name: "저장" }))).toBeGreaterThanOrEqual(44);
    expect(await height(panel.getByRole("button", { name: "지급 확인" }))).toBeGreaterThanOrEqual(44);
    expect(await height(panel.getByLabel("T05 Mai 출근시간"))).toBeGreaterThanOrEqual(44);

    await page.reload();
    await expect(page.getByRole("complementary", { name: /^T05 Mai \(/ })).toBeVisible();

    await page.getByRole("complementary", { name: /^T05 Mai \(/ }).getByRole("button", { name: "닫기" }).click();
    await expect(page.getByRole("complementary")).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]employee=/);
  });

  test("never scrolls the page sideways with a panel open, in both languages", async ({ page }) => {
    await login(page, accounts.admin.accountId, accounts.admin.password);

    for (const locale of ["ko", "vi"] as const) {
      await setLocaleCookie(page, locale);
      for (const width of [390, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [name, path] of Object.entries(screens)) {
          const employee = name === "therapist" ? `&employee=${seeded.maiId}` : "";
          await page.goto(`${path()}${employee}`);
          await expect(page.getByRole("table").first()).toBeVisible();
          if (employee) await expect(page.getByRole("complementary")).toBeVisible();
          if (employee && locale === "vi") await expect(page.getByText("Căn cứ tính theo cuộc gọi")).toBeVisible();
          expect(await documentOverflow(page), `${locale} ${name} @${width}`).toBe(0);
        }
      }
    }
  });
});
