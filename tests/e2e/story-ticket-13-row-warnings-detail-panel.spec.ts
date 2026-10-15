import { testEmployees } from "./support/test-employees";
import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 티켓 13: 원장 행 경고 목록(첫 경고와 +N), 콜 상세 패널(주소의 콜 id, 관련 콜 이동, 포커스 복귀)과 접근 권한.
// 날짜를 한참 과거로 두어 "지금"이 모든 표시 종료보다 늦다(시계를 흉내 내지 않는다).
const accounts = {
  counter: { accountId: "t13_counter", password: "Ticket13!counter" },
  waiter: { accountId: "t13_waiter", password: "Ticket13!waiter" }
} as const;
type Role = keyof typeof accounts;

const monthKey = "2025-05";
const serviceDate = "2025-05-16";

let monthId = "";
let frontCallId = "";
let backCallId = "";
let thirdCallId = "";
let createdMonth = false;

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, sortOrder: number) {
  return testEmployees.upsert({
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

async function seedAccount(role: Role, sortOrder: number) {
  const account = accounts[role];
  const employee = await seedEmployee(`E2E-T13-${role.toUpperCase()}`, `T13 ${role}`, "OPERATIONS", sortOrder);
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

async function createCall(input: { therapistId: string; roomId: string; courseId: string; memo: string; status: string; startTime: string; actualEntryTime?: string; paymentMethodCode?: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      actualEntryTime: input.actualEntryTime ?? null,
      roomId: input.roomId,
      courseId: input.courseId,
      customerMemo: input.memo,
      status: input.status,
      paymentMethodCode: input.paymentMethodCode ?? null
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId }
  });
  return call.id as string;
}

// 코스 정책과 운영월은 다른 스펙의 화면에도 보인다(코스 화면은 가장 이른 운영월의 정책을 보인다).
// 이 스펙이 만든 것은 끝나면 지운다.
async function removeSeededMasters() {
  await (prisma as any).coursePolicy.deleteMany({ where: { name: "T13 A", effectiveFromMonth: monthKey } });
  if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
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

test.describe("티켓 13 원장 행 경고와 콜 상세 패널", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount("counter", 9401);
    await seedAccount("waiter", 9402);
    createdMonth = !(await (prisma as any).operatingMonth.findUnique({ where: { monthKey } }));
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
      where: { sortOrder: 94001 },
      update: { displayName: "T13 호실", isActive: true },
      create: { displayName: "T13 호실", migrationReferenceName: "T13-ROOM", sortOrder: 94001, isActive: true }
    });
    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
    const policy = {
      name: "T13 A",
      durationMinutes: 60,
      basePrice: 1500000,
      opsCallCredit: 1,
      earcarePoolAmount: 0,
      requiresSecondTherapist: false,
      tvDisplayName: "T13 A",
      effectiveToMonth: null,
      isActive: true
    };
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policy } });
    }
    // 수당이 없는 마사지사라 방문완료 콜이 계산 오류 경고가 된다.
    const therapist = await seedEmployee("E2E-T13-THR-1", "T13 마사지사", "THERAPIST", 9411);
    for (const [value, sortOrder] of [["15:00", 94015], ["16:00", 94016], ["17:00", 94017]] as const) {
      await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
    }

    // 15:00 사용중 콜은 16:00 예약에 양보해 표시 종료가 16:00이고 끝나지 않았다.
    frontCallId = await createCall({ therapistId: therapist.id, roomId: room.id, courseId: course.id, memo: "T13 앞 콜", status: "IN_USE", startTime: "15:00", actualEntryTime: "15:20" });
    backCallId = await createCall({ therapistId: therapist.id, roomId: room.id, courseId: course.id, memo: "T13 뒤 콜", status: "RESERVED", startTime: "16:00" });
    thirdCallId = await createCall({
      therapistId: therapist.id,
      roomId: room.id,
      courseId: course.id,
      memo: "T13 수당 없음",
      status: "VISIT_COMPLETE",
      startTime: "17:00",
      paymentMethodCode: "CASH"
    });
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await removeSeededMasters();
    await prisma.$disconnect();
  });

  test("행에는 첫 경고와 나머지 건수만 보이고, 저장 상태는 다른 칸에 있다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    const back = page.locator(`tr[data-service-call-id="${backCallId}"]`);
    await expect(back.locator('[data-call-cell-column="warnings"]')).toContainText("앞 시술이 아직 끝나지 않았습니다");
    await expect(back.locator('[data-call-cell-column="warnings"]')).not.toContainText("+");

    const third = page.locator(`tr[data-service-call-id="${thirdCallId}"]`);
    const thirdWarnings = third.locator('[data-call-cell-column="warnings"]');
    await expect(thirdWarnings).toContainText("앞 시술이 아직 끝나지 않았습니다");
    await expect(thirdWarnings).toContainText("+1");
    await expect(thirdWarnings).not.toContainText("저장");

    // 앞 콜에는 양보 경고가 그대로 남는다.
    const front = page.locator(`tr[data-service-call-id="${frontCallId}"]`);
    await expect(front.locator('[data-call-cell-column="warnings"]')).toContainText("4:00 예약이 있습니다");
  });

  test("경고를 누르면 패널이 열리고 주소에 콜 id가 남으며, 닫으면 포커스가 그 행으로 돌아온다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    const third = page.locator(`tr[data-service-call-id="${thirdCallId}"]`);
    await third.locator('[data-call-cell-column="warnings"] button').click();

    await expect(page).toHaveURL(new RegExp(`call=${thirdCallId}$`));
    const panel = page.getByRole("complementary", { name: /^콜 상세 · 17:00/ });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("list").first().getByRole("listitem")).toHaveCount(2);
    await expect(panel.getByText("앞 시술이 아직 끝나지 않았습니다")).toBeVisible();
    await expect(panel.getByText("계산 오류")).toBeVisible();
    await expect(third).toHaveAttribute("data-selected", "true");
    // 원장의 날짜는 그대로다.
    await expect(page).toHaveURL(new RegExp(`serviceDate=${serviceDate}`));

    await panel.getByRole("button", { name: "닫기" }).click();
    await expect(panel).toHaveCount(0);
    await expect(page).not.toHaveURL(/call=/);
    await expect(third.locator('[data-call-cell-column="warnings"] button')).toBeFocused();
  });

  test("주소의 콜 id로 바로 열리고, 관련 콜을 누르면 같은 원장의 그 콜로 옮겨 간다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}&call=${backCallId}`);

    const panel = page.getByRole("complementary", { name: /^콜 상세 · 16:00/ });
    await expect(panel).toBeVisible();
    await expect(page.locator(`tr[data-service-call-id="${backCallId}"]`)).toHaveAttribute("data-selected", "true");

    await panel.locator(`[data-related-call="${frontCallId}"]`).click();
    await expect(page).toHaveURL(new RegExp(`serviceDate=${serviceDate}&call=${frontCallId}$`));
    await expect(page.getByRole("complementary", { name: /^콜 상세 · 15:00/ })).toBeVisible();
    await expect(page.locator(`tr[data-service-call-id="${frontCallId}"]`)).toHaveAttribute("data-selected", "true");

    // 관련 콜로 옮겨 다녀도 닫으면 패널을 처음 연 행으로 돌아간다.
    await page.getByRole("complementary", { name: /^콜 상세/ }).getByRole("button", { name: "닫기" }).click();
    await expect(page).not.toHaveURL(/call=/);
    await expect(page.locator(`tr[data-service-call-id="${frontCallId}"]`)).toHaveAttribute("data-selected", "false");
  });

  test("행의 경고 버튼으로 열고 관련 콜로 옮긴 뒤 닫으면 처음 연 행의 버튼에 포커스가 돌아온다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    await page.locator(`tr[data-service-call-id="${backCallId}"] [data-call-cell-column="warnings"] button`).click();
    const panel = page.getByRole("complementary", { name: /^콜 상세 · 16:00/ });
    await panel.locator(`[data-related-call="${frontCallId}"]`).click();
    await expect(page.getByRole("complementary", { name: /^콜 상세 · 15:00/ })).toBeVisible();

    await page.getByRole("complementary", { name: /^콜 상세/ }).getByRole("button", { name: "닫기" }).click();
    await expect(page.locator(`tr[data-service-call-id="${backCallId}"] [data-call-cell-column="warnings"] button`)).toBeFocused();
  });

  for (const width of [1440, 1024, 390]) {
    test(`패널이 열려도 ${width}px에서 문서가 가로로 넘치지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await login(page, accounts.counter.accountId, accounts.counter.password);
      await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}&call=${thirdCallId}`);

      await expect(page.getByRole("complementary", { name: /^콜 상세/ })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("웨이터는 콜 원장과 콜 상세 주소에 들어가지 못한다", async ({ page }) => {
    await login(page, accounts.waiter.accountId, accounts.waiter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}&call=${backCallId}`);
    await expect(page).toHaveURL(/\/rooms$/);
    await expect(page.getByRole("complementary", { name: /콜 상세/ })).toHaveCount(0);
  });
});
