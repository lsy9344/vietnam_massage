import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

/**
 * 티켓 25: 콜 상세 패널의 고객 연결 정정(F06, ADR 0003). 사유 필수·STALE_CALL·잠금 거절과 감사 내용은
 * 콜 서비스 단위 테스트(service-call-service.test.ts의 "customer link correction")가 가리므로,
 * 여기서는 화면에서 실제로 그 작업을 끝까지 할 수 있는지, 사유 없이는 거절되는지, 잠금 운영월에서는
 * 폼 대신 안내만 보이는지, 고객 화면으로 바로 갈 수 있는지만 확인한다.
 */

const counter = { accountId: "t25_counter", password: "Ticket25!counter" };
const admin = { accountId: "t25_admin", password: "Ticket25!admin" };

const monthKey = "2036-03";
const serviceDate = "2036-03-16";
const lockedMonthKey = "2036-04";
const lockedServiceDate = "2036-04-16";

let monthId = "";
let lockedMonthId = "";
let wrongCustomerId = "";
let rightCustomerId = "";
let roomId = "";
let courseId = "";

function auditRow(page: Page, targetId: string) {
  return page.getByRole("row").filter({ hasText: targetId });
}

async function seedAccount(accountId: string, password: string, role: "counter" | "administrator", staffCode: string, sortOrder: number) {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName: `T25 ${role}`, isActive: true },
    create: {
      staffCode,
      displayName: `T25 ${role}`,
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
  const passwordHash = await hash(password, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId },
    update: { passwordHash, role, employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      email: `${accountId}@example.local`,
      accountId,
      passwordHash,
      role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function createCall(input: { operatingMonthId: string; serviceDate: string; startTime: string; customerId: string | null; memo: string }) {
  return (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: input.operatingMonthId,
      serviceDate: new Date(`${input.serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      roomId,
      courseId,
      customerId: input.customerId,
      customerMemo: input.memo,
      status: "예약"
    }
  });
}

async function cleanup() {
  const months = [monthId, lockedMonthId].filter(Boolean);
  if (months.length === 0) return;
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: { in: months } }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).auditLog.deleteMany({ where: { targetId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
  await (prisma as any).customer.deleteMany({ where: { name: { startsWith: "T25 " } } });
}

test.describe("티켓 25 콜 상세 패널의 고객 연결 정정", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount(counter.accountId, counter.password, "counter", "E2E-T25-COUNTER", 94250);
    await seedAccount(admin.accountId, admin.password, "administrator", "E2E-T25-ADMIN", 94251);

    const month = await (prisma as any).operatingMonth.upsert({
      where: { monthKey },
      update: { status: "작성중" },
      create: { monthKey, startDate: new Date(`${monthKey}-01T00:00:00.000Z`), endDate: new Date(`${monthKey}-31T00:00:00.000Z`), status: "작성중" }
    });
    monthId = month.id;
    const locked = await (prisma as any).operatingMonth.upsert({
      where: { monthKey: lockedMonthKey },
      update: { status: "마감확정" },
      create: {
        monthKey: lockedMonthKey,
        startDate: new Date(`${lockedMonthKey}-01T00:00:00.000Z`),
        endDate: new Date(`${lockedMonthKey}-30T00:00:00.000Z`),
        status: "마감확정"
      }
    });
    lockedMonthId = locked.id;
    await cleanup();

    const room = await (prisma as any).room.upsert({
      where: { sortOrder: 94250 },
      update: { displayName: "T25 호실", isActive: true },
      create: { displayName: "T25 호실", migrationReferenceName: "T25-ROOM", sortOrder: 94250, isActive: true }
    });
    roomId = room.id;
    const course = await (prisma as any).course.upsert({ where: { code: "T25" }, update: { isActive: true }, create: { code: "T25", isActive: true } });
    courseId = course.id;
    for (const [value, sortOrder] of [["15:00", 94250], ["16:00", 94251]] as const) {
      await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
    }

    const wrong = await (prisma as any).customer.create({ data: { name: "T25 민아", phone: "0901112222", memo: null } });
    wrongCustomerId = wrong.id;
    const right = await (prisma as any).customer.create({ data: { name: "T25 수아", phone: "0903334444", memo: null } });
    rightCustomerId = right.id;
  });

  test.afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  test("사유와 함께 고객 연결을 정정하면 패널에 바로 보이고, 감사에 이전 고객·새 고객·사유·처리자가 남는다", async ({ page }) => {
    const call = await createCall({ operatingMonthId: monthId, serviceDate, startTime: "15:00", customerId: wrongCustomerId, memo: "T25 정정 대상" });

    await login(page, counter.accountId, counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    await page.locator(`tr[data-service-call-id="${call.id}"] td`).first().click();

    const panel = page.getByRole("complementary", { name: /^콜 상세 · 15:00/ });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("지금 연결")).toBeVisible();
    await expect(panel).toContainText("T25 민아");

    await panel.getByRole("combobox", { name: "새로 연결할 고객 검색" }).fill("T25 수아");
    await panel.getByRole("option", { name: "T25 수아" }).click();
    await expect(panel.getByText("바꿀 고객: T25 수아")).toBeVisible();

    await panel.getByLabel("정정 사유").fill("T25 다른 손님 전화로 잘못 연결됨");
    await panel.getByRole("button", { name: "고객 연결 정정" }).click();

    await expect(panel.getByText("고객 연결을 정정했습니다.")).toBeVisible();
    await expect(panel.getByText("지금 연결")).toBeVisible();
    await expect(panel).toContainText("T25 수아");
    await expect(panel).not.toContainText("T25 민아");

    await expect.poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: call.id } })).customerId).toBe(rightCustomerId);

    await login(page, admin.accountId, admin.password);
    await page.goto("/audit?targetType=service_call");
    const row = auditRow(page, call.id);
    await expect(row).toContainText(`customerId: ${wrongCustomerId} → ${rightCustomerId}`);
    await expect(row).toContainText("T25 다른 손님 전화로 잘못 연결됨");
    await expect(row).toContainText("T25 counter");
  });

  test("사유가 없으면 거절되고, 고객 화면으로 바로 갈 수 있다", async ({ page }) => {
    const call = await createCall({ operatingMonthId: monthId, serviceDate, startTime: "16:00", customerId: wrongCustomerId, memo: "T25 사유 없음" });

    await login(page, counter.accountId, counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    await page.locator(`tr[data-service-call-id="${call.id}"] td`).first().click();

    const panel = page.getByRole("complementary", { name: /^콜 상세 · 16:00/ });
    await panel.getByRole("button", { name: "고객 연결 정정" }).click();
    await expect(panel.getByText("정정 사유를 입력하세요.")).toBeVisible();
    await expect.poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: call.id } })).customerId).toBe(wrongCustomerId);

    const goToCustomer = panel.getByRole("link", { name: "고객 화면으로 이동" });
    await expect(goToCustomer).toHaveAttribute("href", new RegExp(`visitCustomer=${wrongCustomerId}$`));
    await goToCustomer.click();
    await expect(page).toHaveURL(new RegExp(`visitCustomer=${wrongCustomerId}`));
    await expect(page.getByRole("complementary", { name: "T25 민아" })).toBeVisible();
  });

  test("마감확정 운영월의 콜은 정정 폼 대신 안내만 보인다", async ({ page }) => {
    const call = await createCall({ operatingMonthId: lockedMonthId, serviceDate: lockedServiceDate, startTime: "15:00", customerId: wrongCustomerId, memo: "T25 잠긴 달" });

    await login(page, counter.accountId, counter.password);
    await page.goto(`/calls?operatingMonthId=${lockedMonthId}&serviceDate=${lockedServiceDate}`);
    await page.locator(`tr[data-service-call-id="${call.id}"] td`).first().click();

    const panel = page.getByRole("complementary", { name: /^콜 상세 · 15:00/ });
    await expect(panel.getByText("마감확정 또는 잠금 운영월입니다. 관리자가 재오픈해야 고객 연결을 정정할 수 있습니다.")).toBeVisible();
    await expect(panel.getByLabel("정정 사유")).toHaveCount(0);
  });
});
