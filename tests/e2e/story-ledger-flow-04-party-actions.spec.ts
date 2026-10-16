import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 콜 원장 흐름 재구성 티켓 04: 원장에서 일행이 머리 줄 아래 붙어 보이고, 일행 전체 입장·전체 취소·1명 추가를 한다.
// 결제·노쇼는 사람별이다(스펙 D14). 다른 스펙이 쓰지 않는 과거 운영월을 쓰고, 만든 운영월·정책은 afterAll에서 지운다.
const account = { accountId: "lf04_counter", password: "LedgerFlow04!counter", staffCode: "E2E-LF04-COUNTER" };
const monthKey = "2025-07";
const serviceDate = "2025-07-15";
const therapistNames = ["LF04 마사지사1", "LF04 마사지사2", "LF04 마사지사3", "LF04 마사지사4"];

let monthId = "";
let courseId = "";
let roomIds: string[] = [];
let therapistIds: string[] = [];
const jung = { partyId: "lf04-party-jung", memo: "LF04 정 대표", ids: [] as string[] };
const park = { partyId: "lf04-party-park", memo: "LF04 박 대표", ids: [] as string[] };
const choi = { partyId: "lf04-party-choi", memo: "LF04 최 대표", ids: [] as string[] };
const startTimes: Record<string, string> = { [jung.partyId]: "13:00", [park.partyId]: "14:00", [choi.partyId]: "15:00" };

// 직원은 (직군, 정렬 순서)가 유일하다. 다른 스펙과 겹치지 않게 비어 있는 순서를 찾는다.
async function freeEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;
  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({ where: { employeeGroup, sortOrder, NOT: { staffCode } }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }
  throw new Error(`No ledger-flow 04 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, preferredSortOrder: number) {
  return testEmployees.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, isActive: true },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position: employeeGroup === "THERAPIST" ? "마사지사" : "카운터",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: await freeEmployeeSortOrder(employeeGroup, staffCode, preferredSortOrder),
      isActive: true
    }
  });
}

async function createPartyCall(input: { partyId: string; memo: string; position: number; status: string; roomId: string | null; therapistId: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: startTimes[input.partyId],
      actualEntryTime: input.status === "IN_USE" ? startTimes[input.partyId] : null,
      roomId: input.roomId,
      courseId,
      customerMemo: input.memo,
      status: input.status,
      partyId: input.partyId,
      partyPosition: input.position
    }
  });
  await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId } });
  return call.id as string;
}

async function cleanup() {
  if (!monthId) return;
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
}

function call(id: string) {
  return (prisma as any).serviceCall.findUnique({ where: { id } });
}

function line(page: Page, callId: string) {
  return page.locator(`tr[data-service-call-id="${callId}"]`);
}

/** 그 흐름 묶음 안의 일행 머리 줄. 일행이 여러 묶음에 흩어지면 묶음마다 머리 줄이 있다. */
function partyHead(page: Page, flow: string, partyId: string) {
  return page.locator(`tr[data-ledger-party="${partyId}"][data-ledger-party-flow="${flow}"]`);
}

function panel(page: Page) {
  return page.getByRole("complementary", { name: /^콜 상세/ });
}

async function openLedger(page: Page) {
  await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
  await expect(page.getByRole("table", { name: "흐름별 콜 원장" })).toBeVisible();
}

test.describe("콜 원장 흐름 재구성 티켓 04 일행 묶음과 일행 동작", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const operations = await seedEmployee(account.staffCode, "LF04 카운터", "OPERATIONS", 97401);
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
        create: { monthKey, startDate: new Date(`${monthKey}-01T00:00:00.000Z`), endDate: new Date(`${monthKey}-31T00:00:00.000Z`), status: "작성중" }
      })
    ).id;
    await cleanup();

    roomIds = [];
    for (const index of [1, 2, 3, 4, 5, 6, 7]) {
      const room = await (prisma as any).room.upsert({
        where: { sortOrder: 97410 + index },
        update: { displayName: `LF04 객실${index}`, isActive: true },
        create: { displayName: `LF04 객실${index}`, migrationReferenceName: `LF04-ROOM-${index}`, sortOrder: 97410 + index, isActive: true }
      });
      roomIds.push(room.id);
    }

    courseId = (await (prisma as any).course.upsert({ where: { code: "LF04A" }, update: { isActive: true }, create: { code: "LF04A", isActive: true } })).id;
    const policy = { name: "LF04 1인", durationMinutes: 60, basePrice: 1500000, requiresSecondTherapist: false, tvDisplayName: "LF04A", effectiveToMonth: monthKey, isActive: true };
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
    if (existingPolicy) await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    else await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...policy } });
    for (const [value, sortOrder] of [["13:00", 95013], ["14:00", 95014], ["15:00", 95015]] as const) {
      await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
    }

    therapistIds = [];
    for (const [index, displayName] of therapistNames.entries()) {
      const employee = await seedEmployee(`E2E-LF04-THR-${index + 1}`, displayName, "THERAPIST", 97402 + index);
      const rate = { amount: 500000, effectiveToMonth: monthKey, isActive: true };
      const existingRate = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId: employee.id, courseId, effectiveFromMonth: monthKey } });
      if (existingRate) await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
      else await (prisma as any).therapistCourseRate.create({ data: { therapistId: employee.id, courseId, effectiveFromMonth: monthKey, ...rate } });
      therapistIds.push(employee.id);
    }

    // 정 대표 일행 3명(13:00): 모두 예약, 손님 1만 객실이 있다.
    jung.ids = [];
    for (const position of [1, 2, 3]) {
      jung.ids.push(
        await createPartyCall({
          partyId: jung.partyId,
          memo: jung.memo,
          position,
          status: "RESERVED",
          roomId: position === 1 ? roomIds[0] : null,
          therapistId: therapistIds[position - 1]
        })
      );
    }
    // 박 대표 일행 3명(14:00): 손님 1은 이미 입장, 손님 2·3은 예약.
    park.ids = [];
    for (const position of [1, 2, 3]) {
      park.ids.push(
        await createPartyCall({
          partyId: park.partyId,
          memo: park.memo,
          position,
          status: position === 1 ? "IN_USE" : "RESERVED",
          roomId: position === 1 ? roomIds[3] : null,
          therapistId: therapistIds[position - 1]
        })
      );
    }
    // 최 대표 일행 3명(15:00): 손님 1은 이미 입장, 손님 2·3은 객실이 있는 예약. 손님 3은 테스트 중에 다른 화면이 먼저 고친다.
    choi.ids = [];
    for (const position of [1, 2, 3]) {
      choi.ids.push(
        await createPartyCall({
          partyId: choi.partyId,
          memo: choi.memo,
          position,
          status: position === 1 ? "IN_USE" : "RESERVED",
          roomId: roomIds[position + 3],
          therapistId: therapistIds[position - 1]
        })
      );
    }
  });

  test.afterAll(async () => {
    await cleanup();
    await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId: { in: therapistIds }, courseId } });
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "LF04 1인" } });
    await (prisma as any).course.update({ where: { id: courseId }, data: { isActive: false } });
    await (prisma as any).room.updateMany({ where: { id: { in: roomIds } }, data: { isActive: false } });
    await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("3인 일행 전체 입장 → 1명 결제 → 1명 노쇼: 일행은 묶음마다 붙어 보이고 결제·노쇼는 사람별이다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);

    const head = partyHead(page, "reserved", jung.partyId);
    await expect(head).toContainText("LF04 정 대표 일행 3명");
    await expect(line(page, jung.ids[1])).toContainText("일행 2/3");

    // 객실이 빈 손님(2·3)만 객실을 고른다. 이미 고른 객실은 다른 손님의 선택지에서 빠진다.
    await head.getByRole("button", { name: "LF04 정 대표 일행 3명 전체 입장" }).click();
    const picker = page.getByRole("group", { name: "LF04 정 대표 일행 3명 입장 객실 고르기" });
    await expect(picker).toBeVisible();
    await expect(picker.locator(`[data-party-entry-room="${jung.ids[0]}"]`)).toHaveCount(0);
    await picker.locator(`[data-party-entry-room="${jung.ids[1]}"]`).selectOption(roomIds[1]);
    await expect(picker.locator(`[data-party-entry-room="${jung.ids[2]}"] option[value="${roomIds[1]}"]`)).toHaveCount(0);
    await picker.locator(`[data-party-entry-room="${jung.ids[2]}"]`).selectOption(roomIds[2]);
    await picker.getByRole("button", { name: "입장", exact: true }).click();

    for (const [index, id] of jung.ids.entries()) {
      await expect.poll(async () => (await call(id)).status).toBe("IN_USE");
      const entered = await call(id);
      expect(entered.roomId).toBe(roomIds[index]);
      expect(entered.actualEntryTime).toMatch(/^\d{2}:\d0$/);
    }

    // 결제는 사람별이다: 손님 1만 결제한다.
    await page.reload();
    await expect(partyHead(page, "active", jung.partyId)).toContainText("LF04 정 대표 일행 3명");
    await line(page, jung.ids[0]).getByRole("button", { name: "13:00 콜 결제" }).click();
    const payment = panel(page).getByRole("region", { name: "결제" });
    await expect(payment).toBeVisible();
    await payment.getByText("현금", { exact: true }).click();
    await expect.poll(async () => (await call(jung.ids[0])).paymentMethodCode).toBe("CASH");
    await payment.getByRole("button", { name: "결제 완료" }).click();
    await expect.poll(async () => (await call(jung.ids[0])).status).toBe("VISIT_COMPLETE");

    // 노쇼도 사람별이다: 손님 2의 상태만 바꾼다.
    await line(page, jung.ids[1]).locator("[data-call-open]").click();
    await expect(page).toHaveURL(new RegExp(`call=${jung.ids[1]}$`));
    const status = panel(page).getByRole("combobox", { name: "상태" });
    await expect(async () => {
      await status.focus();
      await expect(status).toBeFocused();
    }).toPass();
    await status.press("ControlOrMeta+a");
    await status.pressSequentially("노쇼");
    await expect(page.getByRole("listbox").getByRole("option")).not.toHaveCount(0);
    await status.press("Enter");
    await expect.poll(async () => (await call(jung.ids[1])).status).toBe("NO_SHOW");
    expect((await call(jung.ids[2])).status).toBe("IN_USE");

    // 흩어진 일행은 묶음마다 머리 줄 아래 붙고 "일행 N/3"이 남는다.
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    await expect(page.getByRole("table", { name: "흐름별 콜 원장" })).toBeVisible();
    await page.getByRole("button", { name: /^완료·취소·노쇼 \d+건$/ }).click();
    await expect(partyHead(page, "done", jung.partyId)).toContainText("LF04 정 대표 일행 3명");
    await expect(line(page, jung.ids[0])).toContainText("일행 1/3");
    await expect(line(page, jung.ids[1])).toContainText("일행 2/3");
    await expect(partyHead(page, "active", jung.partyId)).toBeVisible();
    await expect(line(page, jung.ids[2])).toContainText("일행 3/3");
  });

  test("일행 전체 입장에서 한 손님이 저장되지 않으면 누른 머리 줄이 그 손님과 이유를 보이고, 나머지는 입장한다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);
    // 화면이 읽은 뒤 다른 화면이 손님 3을 먼저 고쳤다. 이 화면의 저장은 낡은 저장으로 거절된다.
    await (prisma as any).serviceCall.update({ where: { id: choi.ids[2] }, data: { note: "LF04 다른 화면" } });

    const head = partyHead(page, "reserved", choi.partyId);
    await head.getByRole("button", { name: "LF04 최 대표 일행 3명 전체 입장" }).click();
    await expect.poll(async () => (await call(choi.ids[1])).status).toBe("IN_USE");
    const failure = head.getByRole("alert");
    await expect(failure).toContainText("저장하지 못한 손님이 있습니다");
    await expect(failure).toContainText("손님 3: 다른 화면에서 이 콜이 바뀌었습니다");
    await expect(partyHead(page, "active", choi.partyId).getByRole("alert")).toHaveCount(0);
    expect((await call(choi.ids[2])).status).toBe("RESERVED");
  });

  test("일행 전체 취소는 확인 창을 거쳐 남은 예약만 취소하고, 이미 입장한 손님은 그대로 둔다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);

    const head = partyHead(page, "reserved", park.partyId);
    await head.getByRole("button", { name: "LF04 박 대표 일행 3명 남은 예약 취소" }).click();
    const confirm = page.getByRole("alertdialog", { name: "일행 예약을 취소할까요?" });
    await expect(confirm).toContainText("남은 예약 2건");
    await confirm.getByRole("button", { name: "예약 취소" }).click();

    for (const id of park.ids.slice(1)) {
      await expect.poll(async () => (await call(id)).status).toBe("CANCELED");
    }
    expect((await call(park.ids[0])).status).toBe("IN_USE");
  });

  test("일행에 1명 추가는 같은 시각·메모로 빠른 예약을 열고, 저장하면 다음 순번으로 일행에 붙는다", async ({ page }) => {
    await login(page, account.accountId, account.password);
    await openLedger(page);

    await partyHead(page, "active", park.partyId).getByRole("button", { name: "LF04 박 대표 일행 3명에 1명 추가" }).click();
    const dialog = page.getByRole("dialog", { name: "빠른 예약" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("LF04 박 대표 일행(3명)에 1명을 더합니다");

    // Therapist·코스 단계에서 시작한다. 일행이 쓰지 않은 마사지사4를 고른다.
    await dialog
      .locator("[data-availability-row]")
      .filter({ has: page.getByText(therapistNames[3], { exact: true }) })
      .getByRole("button", { name: /LF04A 60분 가능/ })
      .click();
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "예약 저장" }).click();
    await expect(dialog).toBeHidden();

    const members = await (prisma as any).serviceCall.findMany({ where: { partyId: park.partyId }, orderBy: { partyPosition: "asc" } });
    expect(members.map((member: { partyPosition: number }) => member.partyPosition)).toEqual([1, 2, 3, 4]);
    const added = members[3];
    expect([added.startTime, added.customerMemo, added.customerId, added.status]).toEqual(["14:00", park.memo, null, "RESERVED"]);

    // 저장 뒤 자동 새로고침은 운영 빌드에서 늦을 때가 있어 다시 불러와 본다.
    await page.reload();
    await expect(partyHead(page, "reserved", park.partyId)).toContainText("LF04 박 대표 일행 4명");
    await expect(line(page, added.id)).toContainText("일행 4/4");
  });
});
