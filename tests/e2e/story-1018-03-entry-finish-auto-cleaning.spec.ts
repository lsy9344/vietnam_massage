import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 1018 티켓 03: 행 버튼 입장 → 종료 → 청소 끝(+종료 취소), 객실 화면이 따라가는 청소중, 결제 배지, 상태 칩의 시각 규칙,
// 줄 안 시각 고치기, 자동 청소 중. 버튼 흐름은 표시 종료가 아직 오지 않은 먼 뒤 날짜에서 하고(자동 청소 중이 끼어들지
// 않게), 자동 청소 중은 지난 날짜에서 본다.
const account = { accountId: "t1018_03_counter", password: "Ticket1018-03!counter" };
const months = {
  future: { key: "2038-11", date: "2038-11-12" },
  past: { key: "2025-11", date: "2025-11-12" }
} as const;
type MonthName = keyof typeof months;

const monthIds: Record<MonthName, string> = { future: "", past: "" };
let courseId = "";
let therapistId = "";
const roomIds: string[] = [];

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

async function room(sortOrder: number, displayName: string) {
  return (
    await (prisma as any).room.upsert({
      where: { sortOrder },
      update: { displayName, isActive: true },
      create: { displayName, migrationReferenceName: `T1018-03-${sortOrder}`, sortOrder, isActive: true }
    })
  ).id as string;
}

async function createCall(month: MonthName, input: { roomId: string; status: string; startTime: string; actualEntryTime?: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthIds[month],
      serviceDate: new Date(`${months[month].date}T00:00:00.000Z`),
      startTime: input.startTime,
      actualEntryTime: input.actualEntryTime ?? null,
      roomId: input.roomId,
      courseId,
      customerMemo: `T1018-03 ${input.startTime} 손님`,
      status: input.status
    }
  });
  await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: therapistId } });
  return call.id as string;
}

async function cleanupCalls() {
  const ids = (
    await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: { in: Object.values(monthIds).filter(Boolean) } }, select: { id: true } })
  ).map((call: { id: string }) => call.id);
  if (ids.length === 0) return;
  await (prisma as any).auditLog.deleteMany({ where: { targetType: "service_call", targetId: { in: ids } } });
  await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
  await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
  await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
}

function line(page: Page, id: string) {
  return page.locator(`[data-ledger-line][data-service-call-id="${id}"]`);
}

async function openLedger(page: Page, month: MonthName) {
  await page.goto(`/calls?operatingMonthId=${monthIds[month]}&serviceDate=${months[month].date}`);
  await expect(page.getByRole("list", { name: "콜 원장 목록" })).toBeVisible();
}

async function roomCard(page: Page, month: MonthName, name: string) {
  await page.goto(`/rooms?operatingMonthId=${monthIds[month]}&serviceDate=${months[month].date}`);
  return page.getByRole("article", { name: new RegExp(`^${name} `) });
}

async function stored(id: string) {
  return (prisma as any).serviceCall.findUnique({ where: { id } });
}

test.describe("1018 티켓 03 입장·종료·청소 끝과 자동 청소 중", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const operations = await seedEmployee("E2E-T1018-03-COUNTER", "T1018-03 카운터", "OPERATIONS", 97301);
    const data = {
      email: `${account.accountId}@example.local`,
      passwordHash: await hash(account.password, argon2idOptions),
      role: "counter",
      employeeId: operations.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    };
    await (prisma as any).userAccount.upsert({ where: { accountId: account.accountId }, update: data, create: { ...data, accountId: account.accountId } });

    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    courseId = course.id;
    therapistId = (await seedEmployee("E2E-T1018-03-THERAPIST", "T1018-03 담당", "THERAPIST", 97311)).id;
    for (const name of Object.keys(months) as MonthName[]) {
      const { key } = months[name];
      monthIds[name] = (
        await (prisma as any).operatingMonth.upsert({
          where: { monthKey: key },
          update: { status: "작성중" },
          create: { monthKey: key, startDate: new Date(`${key}-01T00:00:00.000Z`), endDate: new Date(`${key}-28T00:00:00.000Z`), status: "작성중" }
        })
      ).id;
      const policy = { name: "T1018-03 A", durationMinutes: 60, basePrice: 1500000, requiresSecondTherapist: false, tvDisplayName: "T1018-03 A", effectiveToMonth: key, isActive: true };
      const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: key } });
      if (existingPolicy) await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
      else await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: key, ...policy } });
      const rate = { amount: 300000, effectiveToMonth: key, isActive: true };
      const existingRate = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId, courseId, effectiveFromMonth: key } });
      if (existingRate) await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
      else await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth: key, ...rate } });
    }
    await cleanupCalls();
    for (const [index, sortOrder] of [97321, 97322, 97323].entries()) roomIds.push(await room(sortOrder, `T1018-03 객실${index + 1}`));
    for (const [value, sortOrder] of [["13:00", 95013], ["14:00", 95014], ["15:00", 95015]] as const) {
      await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
    }
  });

  test.afterAll(async () => {
    await cleanupCalls();
    await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId, effectiveFromMonth: { in: [months.future.key, months.past.key] } } });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T1018-03 A" } });
    await (prisma as any).room.updateMany({ where: { id: { in: roomIds } }, data: { isActive: false } });
    await (prisma as any).operatingMonth.deleteMany({ where: { id: { in: Object.values(monthIds).filter(Boolean) } } });
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("입장 → 종료 → 종료 취소 → 종료 → 청소 끝: 시각을 분 단위로 저장하고, 객실 화면의 청소중이 따라간다", async ({ page }) => {
    const callId = await createCall("future", { roomId: roomIds[0], status: "RESERVED", startTime: "13:00" });
    await login(page, account.accountId, account.password);
    await openLedger(page, "future");

    await line(page, callId).getByRole("button", { name: "13:00 콜 입장" }).click();
    await expect.poll(async () => (await stored(callId)).status).toBe("IN_USE");
    // 10분 맞춤 없이 지금 시각 그대로다.
    expect((await stored(callId)).actualEntryTime).toMatch(/^\d{2}:\d{2}$/);
    await expect(line(page, callId).getByRole("button", { name: "13:00 콜 종료" })).toBeVisible();

    await line(page, callId).getByRole("button", { name: "13:00 콜 종료" }).click();
    await expect.poll(async () => (await stored(callId)).status).toBe("CLEANING");
    const endTime = (await stored(callId)).actualEndTime;
    expect(endTime).toMatch(/^\d{2}:\d{2}$/);
    await expect(line(page, callId).locator("[data-line-top]")).toContainText(endTime);
    await expect(await roomCard(page, "future", "T1018-03 객실1")).toHaveAccessibleName("T1018-03 객실1 청소중");

    await openLedger(page, "future");
    await line(page, callId).getByRole("button", { name: "13:00 콜 종료 취소" }).click();
    await expect.poll(async () => (await stored(callId)).status).toBe("IN_USE");
    expect((await stored(callId)).actualEndTime).toBeNull();
    await expect(await roomCard(page, "future", "T1018-03 객실1")).toHaveAccessibleName(/^T1018-03 객실1 (사용중|종료임박)$/);

    await openLedger(page, "future");
    await line(page, callId).getByRole("button", { name: "13:00 콜 종료" }).click();
    await expect.poll(async () => (await stored(callId)).status).toBe("CLEANING");
    await line(page, callId).getByRole("button", { name: "13:00 콜 청소 끝" }).click();
    await expect.poll(async () => (await stored(callId)).status).toBe("VISIT_COMPLETE");
    // 방문완료는 하단 접기 영역으로 간다. 목록 묶음은 서버가 다시 준 행으로 나누므로 다시 읽어 본다.
    await openLedger(page, "future");
    await expect(line(page, callId)).toBeHidden();
    await expect(await roomCard(page, "future", "T1018-03 객실1")).toHaveAccessibleName("T1018-03 객실1 빈방");
  });

  test("결제 배지는 결제수단만 저장하고, 상태 칩은 시각 규칙을 따르고, 입장 시각은 줄에서 고친다", async ({ page }) => {
    const paidId = await createCall("future", { roomId: roomIds[1], status: "RESERVED", startTime: "14:00" });
    const doneId = await createCall("future", { roomId: roomIds[2], status: "RESERVED", startTime: "15:00" });
    await login(page, account.accountId, account.password);
    await openLedger(page, "future");

    await line(page, paidId).getByRole("button", { name: "14:00 콜 결제수단 고르기" }).click();
    await page.getByRole("listbox", { name: "14:00 콜 결제수단 고르기" }).getByRole("option", { name: "카드" }).click();
    await expect.poll(async () => (await stored(paidId)).paymentMethodCode).toBe("CARD");
    expect((await stored(paidId)).status).toBe("RESERVED");
    await expect(line(page, paidId).locator("[data-line-bottom]")).toContainText("결제완료");

    // 다른 날 원장에서 예약을 방문완료로 고르면 입장 = 예약시각, 종료 = 표시 종료다(스펙 D11).
    await line(page, doneId).getByRole("button", { name: "15:00 콜 상태 고르기" }).click();
    await page.getByRole("listbox", { name: "15:00 콜 상태 고르기" }).getByRole("option", { name: "방문완료" }).click();
    await expect.poll(async () => (await stored(doneId)).status).toBe("VISIT_COMPLETE");
    expect((await stored(doneId)).actualEntryTime).toBe("15:00");
    expect((await stored(doneId)).actualEndTime).toBe("16:00");

    // 예약으로 되돌리면 입장과 종료를 지운다.
    await openLedger(page, "future");
    await page.getByRole("button", { name: /^완료·취소·노쇼 \d+건$/ }).click();
    await line(page, doneId).getByRole("button", { name: "15:00 콜 상태 고르기" }).click();
    await page.getByRole("listbox", { name: "15:00 콜 상태 고르기" }).getByRole("option", { name: "예약" }).click();
    await expect.poll(async () => (await stored(doneId)).status).toBe("RESERVED");
    expect((await stored(doneId)).actualEntryTime).toBeNull();
    expect((await stored(doneId)).actualEndTime).toBeNull();

    // 상태 칩으로 사용중을 고르면 입장이 채워지고, 그 입장 시각은 줄에서 바로 고친다.
    await line(page, paidId).getByRole("button", { name: "14:00 콜 상태 고르기" }).click();
    await page.getByRole("listbox", { name: "14:00 콜 상태 고르기" }).getByRole("option", { name: "사용중" }).click();
    await expect.poll(async () => (await stored(paidId)).status).toBe("IN_USE");
    expect((await stored(paidId)).actualEntryTime).toBe("14:00");
    await line(page, paidId).getByRole("button", { name: "14:00 콜 실제입장 고치기" }).click();
    const entry = line(page, paidId).getByLabel("14:00 콜 실제입장 고치기");
    await entry.fill("14:07");
    await entry.press("Enter");
    await expect.poll(async () => (await stored(paidId)).actualEntryTime).toBe("14:07");
    // 같은 Therapist의 15:00 예약이 있어 표시 종료는 15:00에 양보한다(ADR 0001).
    await expect(line(page, paidId).locator("[data-line-top]")).toContainText("입장 14:07 → 예상 15:00");
  });

  test("자동 청소 중: 표시 종료가 지난 사용중 콜은 읽을 때 청소중이 되고 실제 종료 = 표시 종료이며, 감사는 한 번이고, 종료 취소한 콜은 다시 끝내지 않는다", async ({ page }) => {
    const overdueId = await createCall("past", { roomId: roomIds[0], status: "IN_USE", startTime: "13:00", actualEntryTime: "13:05" });
    const reservedId = await createCall("past", { roomId: roomIds[1], status: "RESERVED", startTime: "15:00" });
    await login(page, account.accountId, account.password);
    await openLedger(page, "past");

    await expect(line(page, overdueId).locator("[data-line-top]")).toContainText("청소중");
    await expect(line(page, overdueId).locator("[data-line-top]")).toContainText("입장 13:05 → 14:05");
    const finished = await stored(overdueId);
    expect(finished.status).toBe("CLEANING");
    expect(finished.actualEndTime).toBe("14:05");
    // 입장하지 않은 예약은 그대로다.
    expect((await stored(reservedId)).status).toBe("RESERVED");

    const audits = () => (prisma as any).auditLog.findMany({ where: { targetId: overdueId, action: "service_call.auto_finished" } });
    await openLedger(page, "past");
    await expect(await roomCard(page, "past", "T1018-03 객실1")).toHaveAccessibleName("T1018-03 객실1 청소중");
    const recorded = await audits();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].reason).toBe("자동 종료");

    await openLedger(page, "past");
    await line(page, overdueId).getByRole("button", { name: "13:00 콜 종료 취소" }).click();
    await expect.poll(async () => (await stored(overdueId)).status).toBe("IN_USE");
    await openLedger(page, "past");
    await expect(line(page, overdueId).locator("[data-line-top]")).toContainText("사용중");
    expect((await stored(overdueId)).status).toBe("IN_USE");
    expect(await audits()).toHaveLength(1);
  });
});
