import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

/**
 * 티켓 22: 고객 화면의 방문완료·노쇼·취소 건수(0건 포함)와, 검색 후보 중 숫자만 비교한 연락처가 둘 이상
 * 같을 때의 경고 + 후보 비교 표. 건수와 경고 반환값 자체는 콜 서비스 단위 테스트
 * (service-call-service.test.ts)가 가리므로, 여기서는 화면에서 실제로 그 값을 보여 주는지와
 * 고르기 전까지 어떤 콜도 자동으로 연결되지 않는지만 확인한다.
 */

const operatingMonthKey = "2035-10";
const serviceDate = "2035-10-16";
const sharedPhone = "0901112222";

const admin = { accountId: "t22_admin", password: "Ticket22!admin" };

let monthId = "";
let minaId = "";
let suaId = "";

async function seedEmployee(staffCode: string, displayName: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, isActive: true },
    create: {
      staffCode,
      displayName,
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

async function seedAdmin() {
  const employee = await seedEmployee("E2E-T22-ADM", "T22 관리자", 92200);
  const passwordHash = await hash(admin.password, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: admin.accountId },
    update: { passwordHash, role: "administrator", employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      email: `${admin.accountId}@example.local`,
      accountId: admin.accountId,
      passwordHash,
      role: "administrator",
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function createCall(input: { customerId: string; customerMemo: string; serviceDate: string; startTime: string; status: string }) {
  const course = await (prisma as any).course.upsert({ where: { code: "T22" }, update: {}, create: { code: "T22", isActive: true } });
  return (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${input.serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      courseId: course.id,
      customerId: input.customerId,
      customerMemo: input.customerMemo,
      status: input.status
    }
  });
}

async function cleanup() {
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
  await (prisma as any).customer.deleteMany({ where: { name: { startsWith: "T22 " } } });
}

test.describe("티켓 22 방문 건수와 같은 연락처 후보 비교", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAdmin();
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

    const mina = await (prisma as any).customer.create({ data: { name: "T22 민아", phone: sharedPhone, memo: null } });
    minaId = mina.id;
    const sua = await (prisma as any).customer.create({ data: { name: "T22 수아", phone: sharedPhone, memo: null } });
    suaId = sua.id;
    await (prisma as any).customer.create({ data: { name: "T22 Lan", phone: "0902223333", memo: null } });

    // 민아는 방문완료·노쇼·취소가 각 1건, 예약은 그 건수에 들어가지 않지만 이력 표에는 남는다.
    await createCall({ customerId: minaId, customerMemo: "T22 민아 완료", serviceDate, startTime: "11:00", status: "방문완료" });
    await createCall({ customerId: minaId, customerMemo: "T22 민아 노쇼", serviceDate, startTime: "13:00", status: "노쇼" });
    await createCall({ customerId: minaId, customerMemo: "T22 민아 취소", serviceDate, startTime: "15:00", status: "취소" });
    await createCall({ customerId: minaId, customerMemo: "T22 민아 예약", serviceDate, startTime: "17:00", status: "예약" });
    // 수아는 방문완료 1건뿐이라, 노쇼·취소는 0건으로 보여야 한다.
    await createCall({ customerId: suaId, customerMemo: "T22 수아 완료", serviceDate, startTime: "11:00", status: "방문완료" });
  });

  test.afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  test("연락처가 숫자만 같은 후보가 둘 이상이면 경고와 비교 표를 보이고, 고르기 전에는 콜이 연결되지 않으며 고른 뒤에는 0건 포함 건수가 보인다", async ({ page }) => {
    await login(page, admin.accountId, admin.password);
    await page.goto("/customers");

    await page.getByRole("combobox", { name: "고객 검색" }).fill(sharedPhone);
    await expect(page).toHaveURL(new RegExp(`customerQuery=${sharedPhone}`));

    await expect(page.getByText("같은 연락처의 고객이 여러 명입니다")).toBeVisible();
    const compare = page.getByRole("listbox", { name: "고객 검색" });
    await expect(compare.getByRole("columnheader", { name: "이름" })).toBeVisible();
    await expect(compare.getByRole("columnheader", { name: "연락처" })).toBeVisible();
    await expect(compare.getByRole("columnheader", { name: "최근 방문일" })).toBeVisible();
    await expect(compare.getByRole("columnheader", { name: "방문완료 건수" })).toBeVisible();

    // 후보 표기는 가장 최근 방문의 고객/메모다(ADR 0003) — 민아는 17:00 예약이 가장 늦다.
    const minaRow = compare.getByRole("row", { name: /T22 민아 예약/ });
    await expect(minaRow).toContainText(sharedPhone);
    const suaRow = compare.getByRole("row", { name: /T22 수아 완료/ });
    await expect(suaRow).toContainText(sharedPhone);

    // 고르기 전에는 어떤 콜도 고객에 다시 연결되지 않는다(검색은 읽기만 한다).
    await expect
      .poll(async () => (await (prisma as any).serviceCall.findMany({ where: { customerId: minaId } })).length)
      .toBe(4);
    await expect
      .poll(async () => (await (prisma as any).serviceCall.findMany({ where: { customerId: suaId } })).length)
      .toBe(1);

    await suaRow.getByRole("option", { name: "T22 수아 완료" }).click();
    await expect(page).toHaveURL(new RegExp(`visitCustomer=${suaId}`));

    const panel = page.getByRole("complementary", { name: "T22 수아" });
    await expect(panel.getByLabel("연락처")).toHaveValue(sharedPhone);
    const counts = panel.getByRole("list", { name: "방문완료·노쇼·취소 건수" });
    await expect(counts).toContainText("방문완료1건");
    await expect(counts).toContainText("노쇼0건");
    await expect(counts).toContainText("취소0건");

    await page.getByRole("combobox", { name: "고객 검색" }).fill(sharedPhone);
    await minaRow.getByRole("option", { name: "T22 민아 예약" }).click();
    await expect(page).toHaveURL(new RegExp(`visitCustomer=${minaId}`));

    const minaPanel = page.getByRole("complementary", { name: "T22 민아" });
    const minaCounts = minaPanel.getByRole("list", { name: "방문완료·노쇼·취소 건수" });
    await expect(minaCounts).toContainText("방문완료1건");
    await expect(minaCounts).toContainText("노쇼1건");
    await expect(minaCounts).toContainText("취소1건");
    // 예약은 그 건수에 들어가지 않지만 이력 표에는 그대로 남는다.
    const history = minaPanel.getByRole("region", { name: "방문 이력" });
    await expect(history.getByRole("row", { name: /T22 민아 예약/ })).toBeVisible();
  });

  test("연락처가 겹치지 않는 검색은 경고 없이 바로 고르는 목록으로 보인다", async ({ page }) => {
    await login(page, admin.accountId, admin.password);
    await page.goto("/customers");

    await page.getByRole("combobox", { name: "고객 검색" }).fill("T22 Lan");
    await expect(page.getByText("같은 연락처의 고객이 여러 명입니다")).toHaveCount(0);
    await expect(page.getByRole("option", { name: "T22 Lan" })).toBeVisible();
  });
});
