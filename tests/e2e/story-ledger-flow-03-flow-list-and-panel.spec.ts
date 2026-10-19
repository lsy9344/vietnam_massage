import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { quickBookingPanel } from "./support/quick-booking";

// 콜 원장 흐름 재구성 티켓 03: 원장 목록, 줄 끝 입장·결제, 오른쪽 편집 패널, 키보드 동선, 보기 전환·새 행 입력 없음,
// 1280·1024px 가로 스크롤 없음, 운영월 잠금. 1018 티켓 02에서 흐름 묶음 대신 예약시각순 두 줄 행 목록 하나가 됐다.
const account = { accountId: "lf03_counter", password: "LedgerFlow03!counter" };
// 1018 티켓 03: 지난 날짜의 사용중 콜은 읽을 때 자동 청소 중이 끝내므로, 원장 동작은 먼 뒤 날짜에서 본다.
const monthKey = "2040-03";
const lockedMonthKey = "2040-02";
const serviceDate = "2040-03-12";
const lockedDate = "2040-02-12";

let monthId = "";
let lockedMonthId = "";
let busyRoomId = "";
let freeRoomId = "";
let otherRoomId = "";
let inUseCallId = "";
let reservedNoRoomId = "";
let reservedWithRoomId = "";
let paidCallId = "";
let doneCallId = "";
let lockedCallId = "";

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

async function upsertMonth(key: string, status: string) {
  return (prisma as any).operatingMonth.upsert({
    where: { monthKey: key },
    update: { status },
    create: { monthKey: key, startDate: new Date(`${key}-01T00:00:00.000Z`), endDate: new Date(`${key}-28T00:00:00.000Z`), status }
  });
}

async function createCall(input: {
  monthId: string;
  date: string;
  therapistId: string;
  roomId: string | null;
  courseId: string;
  memo: string;
  status: string;
  startTime: string;
  actualEntryTime?: string;
}) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: input.monthId,
      serviceDate: new Date(`${input.date}T00:00:00.000Z`),
      startTime: input.startTime,
      actualEntryTime: input.actualEntryTime ?? null,
      roomId: input.roomId,
      courseId: input.courseId,
      customerMemo: input.memo,
      status: input.status
    }
  });
  await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId } });
  return call.id as string;
}

async function cleanup() {
  const months = [monthId, lockedMonthId].filter(Boolean);
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: { in: months } }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
}

function line(page: Page, callId: string) {
  return page.locator(`[data-ledger-line][data-service-call-id="${callId}"]`);
}

function panel(page: Page) {
  return page.getByRole("complementary", { name: /^콜 상세/ });
}

async function openLedger(page: Page, query = "") {
  await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}${query}`);
  await expect(page.getByRole("list", { name: "콜 원장 목록" })).toBeVisible();
}

test.describe("콜 원장 흐름 재구성 티켓 03 흐름별 목록과 편집 패널", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const operations = await seedEmployee("E2E-LF03-COUNTER", "LF03 카운터", "OPERATIONS", 95301);
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

    monthId = (await upsertMonth(monthKey, "작성중")).id;
    lockedMonthId = (await upsertMonth(lockedMonthKey, "잠금")).id;
    await cleanup();

    busyRoomId = (
      await (prisma as any).room.upsert({
        where: { sortOrder: 95301 },
        update: { displayName: "LF03 사용 객실", isActive: true },
        create: { displayName: "LF03 사용 객실", migrationReferenceName: "LF03-BUSY", sortOrder: 95301, isActive: true }
      })
    ).id;
    freeRoomId = (
      await (prisma as any).room.upsert({
        where: { sortOrder: 95302 },
        update: { displayName: "LF03 빈 객실", isActive: true },
        create: { displayName: "LF03 빈 객실", migrationReferenceName: "LF03-FREE", sortOrder: 95302, isActive: true }
      })
    ).id;
    otherRoomId = (
      await (prisma as any).room.upsert({
        where: { sortOrder: 95303 },
        update: { displayName: "LF03 다른 객실", isActive: true },
        create: { displayName: "LF03 다른 객실", migrationReferenceName: "LF03-OTHER", sortOrder: 95303, isActive: true }
      })
    ).id;
    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    for (const key of [monthKey, lockedMonthKey]) {
      const policy = { name: "LF03 A", durationMinutes: 60, basePrice: 1500000, requiresSecondTherapist: false, tvDisplayName: "LF03 A", effectiveToMonth: key, isActive: true };
      const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: key } });
      if (existing) await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data: policy });
      else await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: key, ...policy } });
    }
    const therapist = await seedEmployee("E2E-LF03-THR-1", "LF03 마사지사", "THERAPIST", 95311);
    for (const [value, sortOrder] of [["13:00", 95013], ["14:00", 95014], ["15:00", 95015], ["16:00", 95016], ["17:00", 95017]] as const) {
      await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
    }

    const base = { monthId, date: serviceDate, therapistId: therapist.id, courseId: course.id };
    doneCallId = await createCall({ ...base, roomId: freeRoomId, memo: "LF03 끝난 손님", status: "VISIT_COMPLETE", startTime: "13:00", actualEntryTime: "13:00" });
    inUseCallId = await createCall({ ...base, roomId: busyRoomId, memo: "LF03 이용 손님", status: "IN_USE", startTime: "14:00", actualEntryTime: "14:00" });
    paidCallId = await createCall({ ...base, roomId: otherRoomId, memo: "LF03 결제 손님", status: "IN_USE", startTime: "15:00", actualEntryTime: "15:00" });
    reservedNoRoomId = await createCall({ ...base, roomId: null, memo: "LF03 객실 없는 예약", status: "RESERVED", startTime: "16:00" });
    reservedWithRoomId = await createCall({ ...base, roomId: otherRoomId, memo: "LF03 객실 있는 예약", status: "RESERVED", startTime: "17:00" });
    lockedCallId = await createCall({
      monthId: lockedMonthId,
      date: lockedDate,
      therapistId: therapist.id,
      courseId: course.id,
      roomId: freeRoomId,
      memo: "LF03 잠긴 예약",
      status: "RESERVED",
      startTime: "16:00"
    });
  });

  test.afterAll(async () => {
    await cleanup();
    // 코스 화면은 가장 이른 운영월의 정책을 보인다. 이 스펙이 만든 과거 운영월과 정책은 지운다.
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "LF03 A" } });
    await (prisma as any).operatingMonth.deleteMany({ where: { id: { in: [monthId, lockedMonthId] } } });
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("하루 콜이 묶음 없이 한 목록이고, 완료·취소·노쇼는 하단에 접혀 있다가 펼친 상태를 기억한다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);

    // 순서는 시간 슬롯 순서다. 공유 DB에서는 다른 스펙이 슬롯 순서를 바꾸므로 위 목록과 하단 영역만 본다(1018 스펙 D3·D9).
    const parts = await page.locator("[data-call-ledger-list] > li").evaluateAll((items) => {
      const result: Record<string, string[]> = { open: [], done: [] };
      let part = "open";
      for (const item of items) {
        if (item.hasAttribute("data-ledger-done-toggle")) part = "done";
        else if (item.hasAttribute("data-ledger-line")) result[part].push(item.getAttribute("data-service-call-id") ?? "");
      }
      return result;
    });
    expect(parts.open.sort()).toEqual([inUseCallId, paidCallId, reservedNoRoomId, reservedWithRoomId].sort());
    expect(parts.done).toEqual([doneCallId]);
    await expect(page.getByText("지금 이용 중")).toHaveCount(0);
    await expect(line(page, doneCallId)).toBeHidden();

    const toggle = page.getByRole("button", { name: "완료·취소·노쇼 1건" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(line(page, doneCallId)).toBeVisible();

    await page.reload();
    await expect(line(page, doneCallId)).toBeVisible();
    await page.getByRole("button", { name: "완료·취소·노쇼 1건" }).click();
    await expect(line(page, doneCallId)).toBeHidden();
  });

  test("보기 전환과 표 아래 새 행 입력이 없고, 옛 주소의 view는 무시한다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page, "&view=settlement");
    await expect(page.getByRole("navigation", { name: "원장 표 보기" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "새 콜 행 추가" })).toHaveCount(0);
    await expect(line(page, inUseCallId)).toContainText("LF03 이용 손님");
    await expect(page.locator("[data-ledger-line] input")).toHaveCount(0);
  });

  test("입장: 객실이 있으면 지금 시각과 사용중으로 바로 저장하고, 없으면 빈 객실만 골라 저장한다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);

    await line(page, reservedWithRoomId).getByRole("button", { name: "17:00 콜 입장" }).click();
    await expect.poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: reservedWithRoomId } })).status).toBe("IN_USE");
    const entered = await (prisma as any).serviceCall.findUnique({ where: { id: reservedWithRoomId } });
    // 1018 티켓 03: 입장은 분 단위 지금 시각이다(10분 맞춤 없음).
    expect(entered.actualEntryTime).toMatch(/^\d{2}:\d{2}$/);

    await line(page, reservedNoRoomId).getByRole("button", { name: "16:00 콜 입장" }).click();
    const picker = page.getByRole("group", { name: "16:00 콜 입장 객실 고르기" });
    await expect(picker).toBeVisible();
    await expect(picker.locator(`[data-entry-room="${busyRoomId}"]`)).toHaveCount(0);
    await picker.locator(`[data-entry-room="${freeRoomId}"]`).click();
    await expect.poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: reservedNoRoomId } })).roomId).toBe(freeRoomId);
    expect((await (prisma as any).serviceCall.findUnique({ where: { id: reservedNoRoomId } })).status).toBe("IN_USE");

    await page.reload();
    await expect(line(page, reservedNoRoomId)).toContainText("사용중");
    await expect(line(page, reservedWithRoomId)).toContainText("사용중");
  });

  // 1018 스펙 D12: 결제수단을 고르는 것은 상태를 바꾸지 않는다. "결제 완료 → 방문완료" 버튼은 없다.
  test("결제: 패널의 결제수단 알약은 결제수단만 저장하고 상태는 그대로 둔다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page, `&call=${paidCallId}`);

    const payment = panel(page).getByRole("region", { name: "결제" });
    await expect(payment).toBeVisible();
    const before = (await (prisma as any).serviceCall.findUnique({ where: { id: paidCallId } })).status;
    await payment.getByText("카드", { exact: true }).click();
    await expect.poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: paidCallId } })).paymentMethodCode).toBe("CARD");
    expect((await (prisma as any).serviceCall.findUnique({ where: { id: paidCallId } })).status).toBe(before);
    await expect(payment.getByRole("button", { name: "결제 완료" })).toHaveCount(0);
    await expect(panel(page).locator('[data-save-state="saved"]')).toContainText("저장됨");
  });

  test("편집 패널은 칸마다 자동 저장하고, 더 보기에 방문별 요청·확인값·고객 연결 정정이 있다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page, `&call=${inUseCallId}`);

    const edit = panel(page);
    await expect(edit).toBeVisible();
    await expect(line(page, inUseCallId)).toHaveAttribute("data-selected", "true");
    const note = edit.getByLabel("비고");
    await note.fill("LF03 비고");
    await note.press("Tab");
    await expect.poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: inUseCallId } })).note).toBe("LF03 비고");

    await edit.getByText("더 보기").click();
    await expect(edit.getByLabel("방문별 요청")).toBeVisible();
    await expect(edit.getByRole("combobox", { name: "확인값" })).toBeVisible();
    await expect(edit.getByRole("region", { name: "고객 연결 정정" })).toBeVisible();
  });

  test("키보드: ↑↓ 줄 이동, Enter 패널 첫 칸, Esc 그 줄로, N 빠른 예약, 입력칸 안에서는 단축키가 없다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);

    const opener = (id: string) => line(page, id).locator("[data-call-open]");
    const first = page.locator("[data-ledger-line]").first().locator("[data-call-open]");
    await first.focus();
    await page.keyboard.press("ArrowDown");
    const secondId = await page.locator("[data-ledger-line]").nth(1).getAttribute("data-service-call-id");
    await expect(opener(secondId!)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(first).toBeFocused();

    await page.keyboard.press("Enter");
    const firstId = await page.locator("[data-ledger-line]").first().getAttribute("data-service-call-id");
    await expect(page).toHaveURL(new RegExp(`call=${firstId}$`));
    const startTime = panel(page).getByRole("combobox", { name: "시간" });
    await expect(startTime).toBeFocused();

    // 입력칸 안에서는 N이 글자로 들어가고 빠른 예약이 열리지 않는다.
    const note = panel(page).getByLabel("비고");
    await note.focus();
    await page.keyboard.press("n");
    await expect(quickBookingPanel(page)).toHaveCount(0);

    // 칸 안의 Esc는 저장하지 않은 입력을 마지막으로 저장된 값으로 되돌리고 그 줄로 돌아간다.
    const savedNote = (await (prisma as any).serviceCall.findUnique({ where: { id: firstId } })).note as string | null;
    await page.keyboard.type("되돌릴 비고");
    await page.keyboard.press("Escape");
    await expect(opener(firstId!)).toBeFocused();
    await expect(note).toHaveValue(savedNote ?? "");
    await page.waitForTimeout(500);
    expect((await (prisma as any).serviceCall.findUnique({ where: { id: firstId } })).note).toBe(savedNote);

    await page.keyboard.press("n");
    await expect(quickBookingPanel(page)).toBeVisible();
  });

  for (const width of [1280, 1024]) {
    test(`${width}px에서 패널을 열어도 원장이 가로로 넘치지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await login(page, account.accountId, account.password);
      await openLedger(page, `&call=${inUseCallId}`);
      await expect(panel(page)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const table = page.getByRole("list", { name: "콜 원장 목록" });
      const box = await table.evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }));
      expect(box.scroll).toBeLessThanOrEqual(box.client);
    });
  }

  test("운영월 잠금이면 입장 버튼·상태 칩과 패널 칸이 잠긴다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${lockedMonthId}&serviceDate=${lockedDate}&call=${lockedCallId}`);
    await expect(page.getByText("잠긴 운영월입니다.")).toBeVisible();
    await expect(line(page, lockedCallId).getByRole("button", { name: "16:00 콜 입장" })).toBeDisabled();
    await expect(panel(page).getByRole("combobox", { name: "시간" })).toBeDisabled();
    await expect(line(page, lockedCallId).getByRole("button", { name: "16:00 콜 상태 고르기" })).toBeDisabled();
  });
});
