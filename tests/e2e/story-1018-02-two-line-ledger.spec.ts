import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 1018 티켓 02: 두 줄 원장. 칸 안 Therapist·객실 목록(가능한 사람·빈 객실이 위, 불가한 사람은 경고 후 배정, 키보드),
// 옛 콜의 고객 이름 대체, 편집 패널의 상세 시각 여섯 개, 휴대폰 폭 읽기 전용.
const account = { accountId: "t1018_02_counter", password: "Ticket1018-02!counter" };
// 1018 티켓 03: 지난 날짜의 사용중 콜은 읽을 때 자동 청소 중이 끝내므로, 원장 동작은 먼 뒤 날짜에서 본다.
const monthKey = "2040-10";
const serviceDate = "2040-10-14";

let monthId = "";
let courseId = "";
let busyRoomId = "";
let freeRoomId = "";
let callId = "";
let busyCallId = "";
let legacyCallId = "";
let customerId = "";
const therapistIds: Record<"own" | "free" | "busy" | "notYet", string> = { own: "", free: "", busy: "", notYet: "" };

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
      create: { displayName, migrationReferenceName: `T1018-${sortOrder}`, sortOrder, isActive: true }
    })
  ).id as string;
}

async function createCall(input: { therapistId: string; roomId: string | null; memo: string; status: string; startTime: string; actualEntryTime?: string; customerId?: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      actualEntryTime: input.actualEntryTime ?? null,
      roomId: input.roomId,
      courseId,
      customerMemo: input.memo,
      customerId: input.customerId ?? null,
      status: input.status
    }
  });
  await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId } });
  return call.id as string;
}

async function cleanup() {
  if (!monthId) return;
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length === 0) return;
  await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
  await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
  await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
}

function line(page: Page, id: string) {
  return page.locator(`[data-ledger-line][data-service-call-id="${id}"]`);
}

function panel(page: Page) {
  return page.getByRole("complementary", { name: /^콜 상세/ });
}

async function openLedger(page: Page, query = "") {
  await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}${query}`);
  await expect(page.getByRole("list", { name: "콜 원장 목록" })).toBeVisible();
}

async function stored(id: string) {
  return (prisma as any).serviceCall.findUnique({ where: { id }, include: { assignments: true } });
}

test.describe("1018 티켓 02 두 줄 원장", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const operations = await seedEmployee("E2E-T1018-02-COUNTER", "T1018 카운터", "OPERATIONS", 97201);
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

    monthId = (
      await (prisma as any).operatingMonth.upsert({
        where: { monthKey },
        update: { status: "작성중" },
        create: { monthKey, startDate: new Date(`${monthKey}-01T00:00:00.000Z`), endDate: new Date(`${monthKey}-28T00:00:00.000Z`), status: "작성중" }
      })
    ).id;
    await cleanup();

    busyRoomId = await room(97211, "T1018 사용 객실");
    freeRoomId = await room(97212, "T1018 빈 객실");
    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    courseId = course.id;
    const policy = { name: "T1018 A", durationMinutes: 60, basePrice: 1500000, requiresSecondTherapist: false, tvDisplayName: "T1018 A", effectiveToMonth: monthKey, isActive: true };
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
    if (existingPolicy) await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    else await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...policy } });

    for (const [key, name, sortOrder] of [
      ["own", "T1018 지금 담당", 97221],
      ["free", "T1018 빈 사람", 97222],
      ["busy", "T1018 바쁜 사람", 97223],
      ["notYet", "T1018 출근 전 사람", 97224]
    ] as const) {
      const therapist = await seedEmployee(`E2E-T1018-02-${key.toUpperCase()}`, name, "THERAPIST", sortOrder);
      therapistIds[key] = therapist.id;
      const rate = { amount: 300000, effectiveToMonth: monthKey, isActive: true };
      const existingRate = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId: therapist.id, courseId, effectiveFromMonth: monthKey } });
      if (existingRate) await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
      else await (prisma as any).therapistCourseRate.create({ data: { therapistId: therapist.id, courseId, effectiveFromMonth: monthKey, ...rate } });
    }
    for (const [value, sortOrder] of [["13:00", 95013], ["14:00", 95014], ["15:00", 95015], ["16:00", 95016], ["17:00", 95017]] as const) {
      await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
    }
    // 출근 전 사람만 출근 기록이 없다. 칸 목록의 위 묶음은 출근한 사람이다(빠른 예약 D23과 같다).
    await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: monthId } });
    for (const key of ["own", "free", "busy"] as const) {
      await (prisma as any).therapistAttendance.create({
        data: {
          operatingMonthId: monthId,
          attendanceDate: new Date(`${serviceDate}T00:00:00.000Z`),
          employeeId: therapistIds[key],
          checkInMinute: 12 * 60,
          checkOutMinute: null,
          isFullAttendanceRecognized: false
        }
      });
    }
    customerId = (
      await (prisma as any).customer.create({ data: { name: "T1018 김고객", phone: null } })
    ).id;

    // 빈 사람은 오늘 한 콜이 하나 있어 지금 담당(0)보다 아래, 바쁜 사람은 16:00에 다른 예약이 있어 불가다.
    await createCall({ therapistId: therapistIds.free, roomId: freeRoomId, memo: "T1018 끝난 손님", status: "VISIT_COMPLETE", startTime: "13:00", actualEntryTime: "13:00" });
    busyCallId = await createCall({ therapistId: therapistIds.busy, roomId: busyRoomId, memo: "T1018 사용 손님", status: "IN_USE", startTime: "15:30", actualEntryTime: "15:30" });
    callId = await createCall({ therapistId: therapistIds.own, roomId: null, memo: "T1018 예약 손님", status: "RESERVED", startTime: "16:00" });
    legacyCallId = await createCall({
      therapistId: therapistIds.own,
      roomId: null,
      memo: "T1018 옛 메모\n둘째 줄",
      status: "RESERVED",
      startTime: "17:00",
      customerId
    });
  });

  test.afterAll(async () => {
    await cleanup();
    await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: monthId } });
    await (prisma as any).customer.deleteMany({ where: { id: customerId } });
    await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId: { in: Object.values(therapistIds) }, effectiveFromMonth: monthKey } });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T1018 A" } });
    await (prisma as any).room.updateMany({ where: { id: { in: [busyRoomId, freeRoomId] } }, data: { isActive: false } });
    await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("두 줄 행: 윗줄은 예약시각·입장 → 종료·상태·주 버튼, 아랫줄은 예약자·코스·Therapist·객실·결제이고, 옛 콜은 고객 이름을 보인다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);

    const inUse = line(page, busyCallId);
    await expect(inUse.locator("[data-line-top]")).toContainText("15:30");
    await expect(inUse.locator("[data-line-top]")).toContainText("입장 15:30 → 예상 16:30");
    await expect(inUse.locator("[data-line-top]")).toContainText("사용중");
    await expect(inUse.locator("[data-line-top]").getByRole("button", { name: "15:30 콜 종료" })).toBeVisible();
    await expect(inUse.locator("[data-line-bottom]")).toContainText("T1018 사용 손님");
    await expect(inUse.locator("[data-line-bottom]")).toContainText("T1018 바쁜 사람");
    await expect(inUse.locator("[data-line-bottom]")).toContainText("T1018 사용 객실");
    await expect(inUse.locator("[data-line-bottom]")).toContainText("결제 미확인");

    await expect(line(page, callId).locator("[data-line-top]")).toContainText("미입장");
    // 예약자명이 없는 옛 콜은 연결된 고객 이름을 보인다(스펙 D10).
    await expect(line(page, legacyCallId).locator("[data-line-bottom]")).toContainText("T1018 김고객");
    await expect(line(page, legacyCallId).locator("[data-line-bottom]")).not.toContainText("T1018 옛 메모");
  });

  test("Therapist 칸: 출근해 있고 가능한 사람이 오늘 완료 적은 순으로 위, 출근 전·불가한 사람은 아래이고 불가는 경고를 확인하면 배정된다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);

    await line(page, callId).getByRole("button", { name: "16:00 콜 Therapist 고르기" }).click();
    const list = page.getByRole("listbox", { name: "16:00 콜 Therapist 고르기" });
    await expect(list).toBeFocused();
    await expect(list.getByRole("option", { name: /T1018 빈 사람/ })).toBeVisible();
    const names = await list.getByRole("option").allTextContents();
    const index = (name: string) => names.findIndex((text) => text.includes(name));
    // 지금 담당은 이 콜 자신의 점유를 빼고 보아 가능이고, 완료 0이라 완료 1인 빈 사람보다 위다.
    expect(index("T1018 지금 담당")).toBeLessThan(index("T1018 빈 사람"));
    expect(index("T1018 빈 사람")).toBeLessThan(index("T1018 바쁜 사람"));
    expect(index("T1018 빈 사람")).toBeLessThan(index("T1018 출근 전 사람"));
    await expect(list.getByRole("option", { name: /T1018 출근 전 사람/ })).toContainText("출근 전");
    await expect(list.getByRole("option", { name: /T1018 지금 담당/ })).toHaveAttribute("aria-selected", "true");
    await expect(list.getByRole("option", { name: /T1018 빈 사람/ })).toContainText("완료 1");
    await expect(list.getByRole("option", { name: /T1018 바쁜 사람/ })).toContainText("16:30부터");

    await list.getByRole("option", { name: /T1018 바쁜 사람/ }).click();
    const confirm = page.getByRole("alertdialog", { name: "경고를 확인하고 배정하시겠습니까?" });
    await expect(confirm).toContainText("T1018 바쁜 사람님은 이 시각에 코스 길이만큼 비어 있지 않습니다");
    await confirm.getByRole("button", { name: "경고 확인 후 배정" }).click();
    await expect
      .poll(async () => (await stored(callId)).assignments.find((assignment: any) => assignment.assignmentRole === "THERAPIST_1" && assignment.isActive !== false)?.employeeId)
      .toBe(therapistIds.busy);
    await expect(line(page, callId).locator("[data-line-bottom]")).toContainText("T1018 바쁜 사람");

    // 가능한 사람은 경고 없이 바로 배정된다.
    await line(page, callId).getByRole("button", { name: "16:00 콜 Therapist 고르기" }).click();
    await page.getByRole("listbox", { name: "16:00 콜 Therapist 고르기" }).getByRole("option", { name: /T1018 지금 담당/ }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect
      .poll(async () => (await stored(callId)).assignments.find((assignment: any) => assignment.assignmentRole === "THERAPIST_1" && assignment.isActive !== false)?.employeeId)
      .toBe(therapistIds.own);
  });

  test("객실 칸: 빈 객실이 먼저이고, 키보드로 열고 고르고 Esc로 닫으면 칸으로 돌아간다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);

    const trigger = line(page, callId).getByRole("button", { name: "16:00 콜 객실 고르기" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const list = page.getByRole("listbox", { name: "16:00 콜 객실 고르기" });
    await expect(list).toBeFocused();
    const names = await list.getByRole("option").allTextContents();
    expect(names.findIndex((text) => text.includes("T1018 빈 객실"))).toBeLessThan(names.findIndex((text) => text.includes("T1018 사용 객실")));
    await expect(list.getByRole("option", { name: /T1018 사용 객실/ })).toContainText("사용 중");

    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
    await expect(trigger).toBeFocused();
    // 칸 안 목록을 닫아도 패널은 열리지 않는다.
    await expect(page).not.toHaveURL(/call=/);

    await page.keyboard.press("Enter");
    await expect(list).toBeFocused();
    // 목록은 지금 값(미배정, 맨 아래)에서 시작한다. Home으로 맨 위에 가서 빈 객실까지 내려간다.
    await expect(list.getByRole("option", { name: "미배정" })).toHaveAttribute("aria-selected", "true");
    const freeIndex = (await list.getByRole("option").allTextContents()).findIndex((text) => text.includes("T1018 빈 객실"));
    await page.keyboard.press("Home");
    for (let step = 0; step < freeIndex; step += 1) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await stored(callId)).roomId).toBe(freeRoomId);
    await expect(trigger).toBeFocused();
    await expect(line(page, callId).locator("[data-line-bottom]")).toContainText("T1018 빈 객실");
  });

  test("행의 나머지를 누르면 편집 패널이 열리고, 입장 묶음에 상세 시각 여섯 개가 있다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);

    await line(page, busyCallId).locator("[data-line-bottom] [data-line-who]").click();
    await expect(page).toHaveURL(new RegExp(`call=${busyCallId}$`));
    const entry = panel(page).getByRole("region", { name: "입장" });
    for (const [label, value] of [
      ["예약 시각·코스", "15:30 · A T1018 A"],
      ["실제 입장", "15:30"],
      ["예약 기준 예상 종료", "16:30"],
      ["표시 종료", "16:30"],
      ["실제 종료", "-"],
      ["다음 가능 시각", "16:30"]
    ]) {
      // 시각 여섯 개는 입장 묶음의 정의 목록(dl)에 있다. 그 아래 실제입장·실제 종료 시각 칸(1018 티켓 03)과 이름이 겹친다.
      await expect(entry.locator("dl div", { has: page.getByText(label, { exact: true }) }).last()).toContainText(value);
    }
  });

  test("휴대폰 폭은 같은 두 줄 행을 읽기만 한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await login(page, account.accountId, account.password);
    await openLedger(page);
    const inUse = line(page, busyCallId);
    await expect(inUse.locator("[data-line-top]")).toContainText("입장 15:30");
    await expect(inUse.locator("[data-line-bottom]")).toContainText("T1018 바쁜 사람");
    await expect(page.locator("[data-call-ledger-list] [aria-haspopup=listbox]")).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
