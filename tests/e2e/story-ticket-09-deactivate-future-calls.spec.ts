import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { addDaysToIsoDate, businessTodayIsoDate } from "@/lib/operating-date";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";
import { masterPanel } from "./support/masters";

/**
 * 티켓 09: 오늘 이후의 노쇼·취소가 아닌 콜에 배정된 직원은 비활성으로 바꿀 수 없다(HAS_FUTURE_CALLS).
 * 메모리 Prisma 단위 테스트가 판정 규칙을 확인하고, 여기서는 실제 DB 쿼리와 직원 패널의 거절 표시(두 언어)를 확인한다.
 */

const admin = { accountId: "ticket09_admin", password: "Ticket09!admin", staffCode: "E2E-T09-ADM", sortOrder: 94900 };
const target = { staffCode: "E2E-T09-THR", displayName: "T09 마사지사", sortOrder: 94901 };

const tomorrow = addDaysToIsoDate(businessTodayIsoDate(), 1);
const yesterday = addDaysToIsoDate(businessTodayIsoDate(), -1);

let targetId = "";
let reservedCallId = "";

// 직원은 (직군, 정렬 순서)가 겹치면 안 되고 다른 스펙도 같은 DB에 직원을 넣으므로, 비어 있는 정렬 순서를 찾는다.
async function freeEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({ where: { employeeGroup, sortOrder, NOT: { staffCode } }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }
  throw new Error(`No Ticket 09 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function upsertEmployee(input: { staffCode: string; displayName: string; employeeGroup: string; position: string; sortOrder: number }) {
  return (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: { displayName: input.displayName, isActive: true },
    create: {
      staffCode: input.staffCode,
      displayName: input.displayName,
      employeeGroup: input.employeeGroup,
      position: input.position,
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await freeEmployeeSortOrder(input.employeeGroup, input.staffCode, input.sortOrder),
      isActive: true
    }
  });
}

async function seedAdmin() {
  const employee = await upsertEmployee({ staffCode: admin.staffCode, displayName: "E2E T09 administrator", employeeGroup: "OPERATIONS", position: "팀장", sortOrder: admin.sortOrder });
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

async function removeTargetCalls() {
  const assignments = await (prisma as any).serviceCallAssignment.findMany({ where: { employeeId: targetId }, select: { serviceCallId: true } });
  const callIds = assignments.map((assignment: { serviceCallId: string }) => assignment.serviceCallId);
  await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
}

async function createCall(input: { serviceDate: string; startTime: string; status: string; assignmentRole: string }) {
  // 비활성 판정은 콜의 날짜·상태·배정만 본다. 운영월과 코스는 다른 스펙의 월 집계와 코스 선택지에 끼어들지 않게
  // 이 스펙 전용(먼 운영월, 비활성 코스)으로 둔다.
  const operatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2039-09" },
    update: {},
    create: { monthKey: "2039-09", startDate: new Date("2039-09-01T00:00:00.000Z"), endDate: new Date("2039-09-30T00:00:00.000Z") }
  });
  const course = await (prisma as any).course.upsert({ where: { code: "T09" }, update: {}, create: { code: "T09", isActive: false } });
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: operatingMonth.id,
      serviceDate: new Date(`${input.serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      courseId: course.id,
      customerMemo: "T09 콜",
      status: input.status
    }
  });
  await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: call.id, assignmentRole: input.assignmentRole, employeeId: targetId } });
  return call;
}

async function targetIsActive() {
  return (await (prisma as any).employee.findUnique({ where: { id: targetId }, select: { isActive: true } }))?.isActive;
}

test.describe("티켓 09 앞으로 콜이 잡힌 직원의 비활성 거절", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAdmin();
    targetId = (await upsertEmployee({ ...target, employeeGroup: "THERAPIST", position: "마사지사" })).id;
    await removeTargetCalls();
    reservedCallId = (await createCall({ serviceDate: tomorrow, startTime: "14:00", status: "예약", assignmentRole: "THERAPIST_2" })).id;
    await createCall({ serviceDate: tomorrow, startTime: "15:00", status: "노쇼", assignmentRole: "THERAPIST_1" });
    await createCall({ serviceDate: yesterday, startTime: "14:00", status: "방문완료", assignmentRole: "THERAPIST_1" });
  });

  test.afterAll(async () => {
    await removeTargetCalls();
    // 운영월 기본값은 가장 늦은 운영월이라, 남겨 두면 다른 스펙의 원장·정산 기본 운영월이 2039-09가 된다.
    await (prisma as any).operatingMonth.deleteMany({ where: { monthKey: "2039-09" } });
    await (prisma as any).course.deleteMany({ where: { code: "T09" } });
    await prisma.$disconnect();
  });

  test("내일 콜이 있으면 거절과 콜 목록을 두 언어로 보이고, 콜을 취소하면 비활성으로 바뀐다", async ({ page }) => {
    const deactivatedAudits = () => (prisma as any).auditLog.count({ where: { action: "employee.deactivated", targetId } });
    const auditsBefore = await deactivatedAudits();
    await login(page, admin.accountId, admin.password);
    await page.goto(`/masters/employees?item=${targetId}`);

    let panel = masterPanel(page);
    await panel.getByRole("button", { name: "비활성 처리" }).click();
    let rejection = panel.getByRole("alert");
    await expect(rejection).toContainText("오늘 이후 콜 1건에 배정돼 있어 비활성으로 바꿀 수 없습니다.");
    const calls = rejection.getByRole("list", { name: "비활성을 막은 콜" }).getByRole("listitem");
    await expect(calls).toHaveCount(1);
    await expect(calls.first()).toContainText(tomorrow);
    await expect(calls.first()).toContainText("14:00");
    expect(await targetIsActive()).toBe(true);
    expect(await deactivatedAudits()).toBe(auditsBefore);

    await setLocaleCookie(page, "vi");
    await page.goto(`/masters/employees?item=${targetId}`);
    panel = masterPanel(page);
    await panel.getByRole("button", { name: "Vô hiệu hóa" }).click();
    rejection = panel.getByRole("alert");
    await expect(rejection).toContainText("Không thể vô hiệu hóa vì nhân viên được phân công ở 1 cuộc gọi từ hôm nay trở đi.");
    await expect(rejection.getByRole("listitem").first()).toContainText(tomorrow);

    await (prisma as any).serviceCall.update({ where: { id: reservedCallId }, data: { status: "취소" } });
    await page.goto(`/masters/employees?item=${targetId}`);
    panel = masterPanel(page);
    await panel.getByRole("button", { name: "Vô hiệu hóa" }).click();
    await expect.poll(targetIsActive).toBe(false);
    expect(await deactivatedAudits()).toBe(auditsBefore + 1);
    // 어제의 방문완료 콜은 비활성을 막지 않았고, 그 배정은 그대로 남는다.
    const pastAssignments = await (prisma as any).serviceCallAssignment.count({
      where: { employeeId: targetId, isActive: true, serviceCall: { serviceDate: new Date(`${yesterday}T00:00:00.000Z`) } }
    });
    expect(pastAssignments).toBe(1);
  });
});
