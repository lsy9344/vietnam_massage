import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";
import { restoreUserAccount } from "./support/cleanup";

/**
 * 티켓 27: 근무표 기본(F04). 근무표 서비스 테스트(메모리 Prisma)는 schedule-service.test.ts가 확인했으므로,
 * 여기서는 실제 화면 흐름, 감사 기록, 권한 거절, 두 언어 문구를 확인한다.
 *
 * 지난주 복사와 휴무 영향 콜(28), 가능 코스의 근무 예정 표시(29)는 이 스펙의 범위가 아니다.
 */

const settlementManager = { accountId: "ticket27_settlement", password: "Ticket27!settlement", staffCode: "E2E-T27-SET", sortOrder: 94700 };
const counter = { accountId: "ticket27_counter", password: "Ticket27!counter", staffCode: "E2E-T27-CNT", sortOrder: 94701 };

// 이 DB는 티켓 27 전용(vietnam_aesthetic_t27)이라 다른 스펙과 날짜가 겹칠 걱정이 없다.
const targetDate = "2026-11-04"; // 수요일, 그 주는 2026-11-02(월) ~ 2026-11-08(일)

let settlementManagerDbId = "";

async function freeEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;
  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({ where: { employeeGroup, sortOrder, NOT: { staffCode } }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }
  throw new Error(`No Ticket 27 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedAccount(input: { accountId: string; password: string; staffCode: string; sortOrder: number; role: string }) {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: { isActive: true },
    create: {
      staffCode: input.staffCode,
      displayName: `E2E T27 ${input.role}`,
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await freeEmployeeSortOrder("OPERATIONS", input.staffCode, input.sortOrder),
      isActive: true
    }
  });
  const passwordHash = await hash(input.password, argon2idOptions);
  const account = await (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: { passwordHash, role: input.role, employeeId: employee.id, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      email: `${input.accountId}@example.local`,
      accountId: input.accountId,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
  return account;
}

async function cellStatus() {
  const row = await (prisma as any).plannedWorkingDay.findFirst({
    where: { employee: { staffCode: "THR-001" }, workDate: new Date(`${targetDate}T00:00:00.000Z`) }
  });
  return row?.planStatus ?? null;
}

test.describe("티켓 27 근무표", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const settlementAccount = await seedAccount({ ...settlementManager, role: "settlement_manager" });
    await seedAccount({ ...counter, role: "counter" });
    settlementManagerDbId = settlementAccount.id;
    await (prisma as any).plannedWorkingDay.deleteMany({ where: { employee: { staffCode: "THR-001" } } });
  });

  test.afterAll(async () => {
    await (prisma as any).plannedWorkingDay.deleteMany({ where: { employee: { staffCode: "THR-001" } } });
    await prisma.$disconnect();
  });

  test("기록이 없는 칸은 미입력이고, 근무 예정으로 설정하면 칸과 감사 기록이 바뀐다", async ({ page }) => {
    const auditCountBefore = await (prisma as any).auditLog.count({ where: { targetType: "planned_working_day" } });

    await login(page, settlementManager.accountId, settlementManager.password);
    await page.goto("/settlements/schedule?date=" + targetDate);
    await expect(page.getByRole("heading", { name: "근무표" })).toBeVisible();

    const row = page.locator("tr", { hasText: "THR-001" });
    await row.getByRole("button", { name: /마사지사1/ }).click();

    const panel = page.getByRole("complementary");
    await expect(panel.getByRole("heading", { name: /THR-001/ })).toBeVisible();

    const dayForm = panel.locator("form").filter({ hasText: targetDate.slice(5) });
    await dayForm.getByRole("combobox").selectOption("근무 예정");
    await dayForm.getByRole("button", { name: "저장" }).click();
    await expect(dayForm.getByText("저장됨")).toBeVisible();

    // 메인 표 셀도 같은 값으로 갱신된다(서버 액션의 revalidatePath).
    await expect(row.getByText("근무 예정")).toBeVisible();

    expect(await cellStatus()).toBe("근무 예정");
    const audit = await (prisma as any).auditLog.findFirst({
      where: { targetType: "planned_working_day", action: "planned_working_day.created" },
      orderBy: { createdAt: "desc" }
    });
    expect(audit).not.toBeNull();
    expect(audit.actorId).toBe(settlementManagerDbId);
    expect(audit.afterValue).toMatchObject({ date: targetDate, status: "근무 예정" });
    expect(audit.beforeValue).toMatchObject({ date: targetDate, status: "미입력" });
    expect(await (prisma as any).auditLog.count({ where: { targetType: "planned_working_day" } })).toBe(auditCountBefore + 1);
  });

  test("근무 예정을 휴무로 바꾸면 변경 감사 기록을 남기고, 출퇴근·콜 테이블은 건드리지 않는다", async ({ page }) => {
    const therapistAttendanceCountBefore = await (prisma as any).therapistAttendance.count();
    const serviceCallCountBefore = await (prisma as any).serviceCall.count();

    await login(page, settlementManager.accountId, settlementManager.password);
    await page.goto("/settlements/schedule?date=" + targetDate);

    const row = page.locator("tr", { hasText: "THR-001" });
    await row.getByRole("button", { name: /마사지사1/ }).click();
    const panel = page.getByRole("complementary");
    const dayForm = panel.locator("form").filter({ hasText: targetDate.slice(5) });
    await dayForm.getByRole("combobox").selectOption("휴무");
    await dayForm.getByRole("button", { name: "저장" }).click();
    await expect(dayForm.getByText("저장됨")).toBeVisible();
    await expect(row.getByText("휴무")).toBeVisible();

    expect(await cellStatus()).toBe("휴무");
    const audit = await (prisma as any).auditLog.findFirst({
      where: { targetType: "planned_working_day", action: "planned_working_day.changed" },
      orderBy: { createdAt: "desc" }
    });
    expect(audit.beforeValue).toMatchObject({ status: "근무 예정" });
    expect(audit.afterValue).toMatchObject({ status: "휴무" });

    expect(await (prisma as any).therapistAttendance.count()).toBe(therapistAttendanceCountBefore);
    expect(await (prisma as any).serviceCall.count()).toBe(serviceCallCountBefore);
  });

  test("카운터는 근무표 화면에 들어갈 수 없다", async ({ page }) => {
    await login(page, counter.accountId, counter.password);
    await page.goto("/settlements/schedule");
    await expect(page).not.toHaveURL(/\/settlements\/schedule/);
  });

  test("편집 서버 액션은 호출 시점의 역할을 다시 검사해 권한 없는 역할을 거절한다", async ({ page }) => {
    await login(page, settlementManager.accountId, settlementManager.password);
    await page.goto("/settlements/schedule?date=" + targetDate);
    const row = page.locator("tr", { hasText: "THR-001" });
    await row.getByRole("button", { name: /마사지사1/ }).click();
    const panel = page.getByRole("complementary");
    const dayForm = panel.locator("form").filter({ hasText: targetDate.slice(5) });

    const beforeStatus = await cellStatus();
    // 화면은 정산 담당 권한으로 열어 둔 채, 실제 호출 시점의 역할만 카운터로 바꾼다
    // (다른 역할이 이 편집 서버 액션을 직접 호출한 상황과 같은 서버 재검사를 확인한다).
    await (prisma as any).userAccount.update({ where: { accountId: settlementManager.accountId }, data: { role: "counter" } });
    try {
      await dayForm.getByRole("combobox").selectOption("근무 예정");
      await dayForm.getByRole("button", { name: "저장" }).click();
      await expect(dayForm.getByText("권한이 없습니다.")).toBeVisible();
      expect(await cellStatus()).toBe(beforeStatus);
    } finally {
      await restoreUserAccount(settlementManager.accountId, "settlement_manager");
    }
  });

  test("베트남어 화면에서는 근무표 제목과 상태 문구가 번역된다", async ({ page }) => {
    await login(page, settlementManager.accountId, settlementManager.password);
    await setLocaleCookie(page, "vi");
    await page.goto("/settlements/schedule?date=" + targetDate);

    await expect(page.getByRole("heading", { name: "Lịch làm việc" })).toBeVisible();
    const row = page.locator("tr", { hasText: "THR-001" });
    await expect(row.getByText("Nghỉ")).toBeVisible();
  });
});
