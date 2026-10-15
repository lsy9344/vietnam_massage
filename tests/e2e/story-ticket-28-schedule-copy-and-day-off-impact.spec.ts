import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";

/**
 * 티켓 28: 근무표 지난주 복사(스토리 101)와 휴무 영향 콜(스토리 102, 148).
 * 근무표 서비스 테스트(메모리 Prisma)는 schedule-service.test.ts가 복사 결과와 영향받는 콜을
 * 이미 확인했으므로, 여기서는 실제 화면 흐름과 역할별 링크/요약 분기만 확인한다.
 *
 * 이 DB는 티켓 28 전용(vietnam_aesthetic_t28)이라 다른 스펙과 직원·날짜가 겹칠 걱정이 적지만,
 * 같은 실행에 story-ticket-27-schedule.spec.ts(THR-001)도 함께 돌리므로, 이 스펙은 전용 직원
 * (E2E-T28-THR-1)과 복사 결과 문구는 "숫자 형식"만 확인해 다른 활성 직원의 칸 수에 영향받지 않는다.
 */

const admin = { accountId: "t28_admin", password: "Ticket28!admin" };
const settlementManager = { accountId: "t28_settlement", password: "Ticket28!settlement" };

const monthKey = "2026-11";
// 이번 주 2026-11-09(월)~11-15(일), 지난주 2026-11-02(월)~11-08(일)
const thisWeekMonday = "2026-11-09";
const thisWeekTuesday = "2026-11-10";
const thisWeekThursday = "2026-11-12";
const lastWeekMonday = "2026-11-02";
const lastWeekTuesday = "2026-11-03";

let monthId = "";
let impactedCallId = "";
let createdMonth = false;
let therapistId = "";

async function freeEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;
  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({ where: { employeeGroup, sortOrder, NOT: { staffCode } }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }
  throw new Error(`No Ticket 28 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, preferredSortOrder: number) {
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
      sortOrder: await freeEmployeeSortOrder(employeeGroup, staffCode, preferredSortOrder),
      isActive: true
    }
  });
}

async function seedAccount(input: { accountId: string; password: string; staffCode: string; sortOrder: number; role: string }) {
  const employee = await seedEmployee(input.staffCode, `E2E T28 ${input.role}`, "OPERATIONS", input.sortOrder);
  const data = {
    email: `${input.accountId}@example.local`,
    passwordHash: await hash(input.password, argon2idOptions),
    role: input.role,
    employeeId: employee.id,
    isActive: true,
    lockedUntil: null,
    failedLoginCount: 0
  };
  await (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: data,
    create: { ...data, accountId: input.accountId }
  });
}

async function setCell(employeeId: string, date: string, planStatus: string) {
  await (prisma as any).plannedWorkingDay.upsert({
    where: { employeeId_workDate: { employeeId, workDate: new Date(`${date}T00:00:00.000Z`) } },
    update: { planStatus },
    create: { employeeId, workDate: new Date(`${date}T00:00:00.000Z`), planStatus }
  });
}

async function cellStatus(employeeId: string, date: string) {
  const row = await (prisma as any).plannedWorkingDay.findUnique({
    where: { employeeId_workDate: { employeeId, workDate: new Date(`${date}T00:00:00.000Z`) } }
  });
  return row?.planStatus ?? "미입력";
}

async function cleanupPlannedWorkingDays() {
  await (prisma as any).plannedWorkingDay.deleteMany({ where: { employeeId: therapistId } });
}

async function cleanupCalls() {
  if (!impactedCallId) return;
  await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: impactedCallId } });
  await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: impactedCallId } });
  await (prisma as any).serviceCall.deleteMany({ where: { id: impactedCallId } });
}

async function removeSeededMasters() {
  await (prisma as any).coursePolicy.deleteMany({ where: { name: "T28 A", effectiveFromMonth: monthKey } });
  if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
}

test.describe("티켓 28 근무표 지난주 복사·휴무 영향 콜", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount({ ...admin, staffCode: "E2E-T28-ADM", sortOrder: 94800, role: "administrator" });
    await seedAccount({ ...settlementManager, staffCode: "E2E-T28-SET", sortOrder: 94801, role: "settlement_manager" });
    const therapist = await seedEmployee("E2E-T28-THR-1", "T28 마사지사1", "THERAPIST", 94812);
    therapistId = therapist.id;
    await cleanupPlannedWorkingDays();

    createdMonth = !(await (prisma as any).operatingMonth.findUnique({ where: { monthKey } }));
    const month = await (prisma as any).operatingMonth.upsert({
      where: { monthKey },
      update: { status: "작성중" },
      create: { monthKey, startDate: new Date(`${monthKey}-01T00:00:00.000Z`), endDate: new Date(`${monthKey}-30T00:00:00.000Z`), status: "작성중" }
    });
    monthId = month.id;

    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
    const policy = {
      name: "T28 A",
      durationMinutes: 60,
      basePrice: 1500000,
      opsCallCredit: 1,
      earcarePoolAmount: 0,
      requiresSecondTherapist: false,
      tvDisplayName: "T28 A",
      effectiveToMonth: null,
      isActive: true
    };
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policy } });
    }

    const call = await (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: monthId,
        serviceDate: new Date(`${thisWeekThursday}T00:00:00.000Z`),
        startTime: "14:00",
        courseId: course.id,
        status: "예약"
      }
    });
    impactedCallId = call.id;
    await (prisma as any).serviceCallAssignment.create({
      data: { serviceCallId: impactedCallId, assignmentRole: "THERAPIST_1", employeeId: therapistId }
    });
  });

  test.afterAll(async () => {
    await cleanupCalls();
    await cleanupPlannedWorkingDays();
    await removeSeededMasters();
    await prisma.$disconnect();
  });

  test("관리자가 콜이 배정된 칸을 휴무로 바꾸면 영향받는 콜 안내와 원장 링크가 보이고, 콜은 그대로 둔다", async ({ page }) => {
    await login(page, admin.accountId, admin.password);
    await page.goto(`/settlements/schedule?date=${thisWeekThursday}`);
    await expect(page.getByRole("heading", { name: "근무표" })).toBeVisible();

    const row = page.locator("tr", { hasText: "T28 마사지사1" });
    await row.getByRole("button", { name: /T28 마사지사1/ }).click();
    const panel = page.getByRole("complementary");
    const dayForm = panel.locator("form").filter({ hasText: thisWeekThursday.slice(5) });
    await dayForm.getByRole("combobox").selectOption("휴무");
    await dayForm.getByRole("button", { name: "저장" }).click();
    await expect(dayForm.getByText("저장됨")).toBeVisible();

    await expect(dayForm.getByText("영향받는 콜 1건")).toBeVisible();
    await expect(dayForm.getByText(/재배정/)).toBeVisible();
    const link = dayForm.getByRole("link", { name: /원장에서 보기/ });
    await expect(link).toBeVisible();
    await expect(link).toContainText("14:00");
    await expect(link).toContainText("A");
    await expect(link).toContainText("예약");

    await link.click();
    await expect(page).toHaveURL(new RegExp(`/calls\\?operatingMonthId=${monthId}&serviceDate=${thisWeekThursday}&call=${impactedCallId}$`));
    await expect(page.getByRole("complementary", { name: /^콜 상세 · 14:00/ })).toBeVisible();

    expect(await cellStatus(therapistId, thisWeekThursday)).toBe("휴무");
    const call = await (prisma as any).serviceCall.findUnique({ where: { id: impactedCallId } });
    expect(call.startTime).toBe("14:00");
    expect(call.status).toBe("예약");
    const assignment = await (prisma as any).serviceCallAssignment.findFirst({ where: { serviceCallId: impactedCallId } });
    expect(assignment.employeeId).toBe(therapistId);
    expect(assignment.isActive).not.toBe(false);
  });

  test("정산 담당에게는 같은 영향받는 콜이 링크 없이 요약으로만 보인다", async ({ page }) => {
    await login(page, settlementManager.accountId, settlementManager.password);
    await page.goto(`/settlements/schedule?date=${thisWeekThursday}`);

    const row = page.locator("tr", { hasText: "T28 마사지사1" });
    await row.getByRole("button", { name: /T28 마사지사1/ }).click();
    const panel = page.getByRole("complementary");
    const dayForm = panel.locator("form").filter({ hasText: thisWeekThursday.slice(5) });
    // 이미 휴무이지만 다시 저장해도 같은 영향받는 콜 안내가 보여야 한다.
    await dayForm.getByRole("combobox").selectOption("휴무");
    await dayForm.getByRole("button", { name: "저장" }).click();
    await expect(dayForm.getByText("저장됨")).toBeVisible();

    await expect(dayForm.getByText("영향받는 콜 1건")).toBeVisible();
    await expect(dayForm.getByText("14:00")).toBeVisible();
    await expect(dayForm.getByRole("link", { name: /원장에서 보기/ })).toHaveCount(0);
    await expect(dayForm.locator("a")).toHaveCount(0);
  });

  test("지난주 복사는 미입력 칸만 채우고, 이미 입력된 칸은 덮지 않으며 채운 칸 수를 알려준다", async ({ page }) => {
    await setCell(therapistId, lastWeekMonday, "근무 예정");
    await setCell(therapistId, lastWeekTuesday, "휴무");
    await setCell(therapistId, thisWeekTuesday, "근무 예정"); // 이번 주 화요일은 이미 입력됨 — 지난주 화(휴무)로 덮이지 않아야 한다.

    await login(page, admin.accountId, admin.password);
    await page.goto(`/settlements/schedule?date=${thisWeekMonday}`);
    await expect(page.getByText(`${thisWeekMonday} ~ 2026-11-15`)).toBeVisible();

    await page.getByRole("button", { name: "지난주 복사" }).click();
    await expect(page.getByText(/\d+칸을 채웠습니다\./)).toBeVisible();

    expect(await cellStatus(therapistId, thisWeekMonday)).toBe("근무 예정");
    expect(await cellStatus(therapistId, thisWeekTuesday)).toBe("근무 예정"); // 덮이지 않음

    const row = page.locator("tr", { hasText: "T28 마사지사1" });
    await expect(row.getByText("근무 예정").first()).toBeVisible();
  });

  test("베트남어 화면에서는 지난주 복사 버튼과 영향받는 콜 안내가 번역된다", async ({ page }) => {
    await login(page, admin.accountId, admin.password);
    await setLocaleCookie(page, "vi");
    await page.goto(`/settlements/schedule?date=${thisWeekMonday}`);

    await expect(page.getByRole("button", { name: "Sao chép tuần trước" })).toBeVisible();

    const row = page.locator("tr", { hasText: "T28 마사지사1" });
    await row.getByRole("button", { name: /T28 마사지사1/ }).click();
    const panel = page.getByRole("complementary");
    const dayForm = panel.locator("form").filter({ hasText: thisWeekThursday.slice(5) });
    // 영향받는 콜 안내는 저장 응답으로 오는 상태라, 다시 저장해야 그려진다.
    await dayForm.getByRole("combobox").selectOption("휴무");
    await dayForm.getByRole("button", { name: "Lưu" }).click();
    await expect(dayForm.getByText("Đã lưu")).toBeVisible();
    await expect(dayForm.getByText("cuộc gọi bị ảnh hưởng")).toBeVisible();
    await expect(dayForm.getByText(/phân công lại/)).toBeVisible();
  });
});
