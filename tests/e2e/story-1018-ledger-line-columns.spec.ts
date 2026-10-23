import { testEmployees } from "./support/test-employees";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";
import { chooseConditions, quickBookingPanel } from "./support/quick-booking";

// 1018 후속: 원장 줄의 칸은 열에 맞춘다. 예약자·코스·입장 글자 길이가 줄마다 달라도 상태·Therapist·객실·결제·할인 칸이
// 모든 줄에서 같은 가로 위치에 있다(넓으면 한 줄 11칸, 좁으면 두 줄).
const account = { accountId: "t1018_columns_counter", password: "Ticket1018-columns!counter" };
const monthKey = "2041-07";
const serviceDate = "2041-07-14";
const policyNames = { A: "T1018열 A 60분", D: "T1018열 D 120분 아로마 전신 마사지 스페셜" } as const;

let monthId = "";
let roomId = "";
const therapistIds: string[] = [];

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

async function coursePolicy(code: "A" | "D", durationMinutes: number) {
  const course = await (prisma as any).course.upsert({ where: { code }, update: { isActive: true }, create: { code, isActive: true } });
  const name = policyNames[code];
  const policy = { name, durationMinutes, basePrice: 1500000, requiresSecondTherapist: false, tvDisplayName: name, effectiveToMonth: monthKey, isActive: true };
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
  if (existing) await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data: policy });
  else await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policy } });
  return course.id as string;
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

/** 보이는 원장 줄마다 칸의 왼쪽 x. 칸이 없는 줄(주 버튼이 없는 줄 등)은 null이다. */
async function pickerColumns(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-ledger-line]")]
      .filter((line) => line.offsetParent !== null)
      .map((line) => {
        const left = (field: string) => {
          const picker = line.querySelector(`[data-cell-picker="${field}"]`);
          return picker ? Math.round(picker.getBoundingClientRect().left) : null;
        };
        return { status: left("status"), therapist: left("therapist1Id"), room: left("roomId"), payment: left("paymentMethodCode"), discount: left("discountTypeCode") };
      })
  );
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectAlignedColumns(page: Page) {
  const columns = await pickerColumns(page);
  expect(columns.length).toBe(6);
  for (const field of ["status", "therapist", "room", "payment", "discount"] as const) {
    const lefts = columns.map((column) => column[field]);
    expect(lefts, `${field} 칸이 모든 줄에 있다`).not.toContain(null);
    expect(new Set(lefts), `${field} 칸의 왼쪽 x: ${JSON.stringify(lefts)}`).toEqual(new Set([lefts[0]]));
  }
  await expectNoPageOverflow(page);
}

async function openLedger(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await login(page, account.accountId, account.password);
  await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
  await expect(page.getByRole("list", { name: "콜 원장 목록" })).toBeVisible();
}

test.describe("1018 후속 원장 줄의 칸 열 맞춤", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const operations = await seedEmployee("E2E-T1018-COL-COUNTER", "T1018열 카운터", "OPERATIONS", 97811);
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

    const courseA = await coursePolicy("A", 60);
    const courseD = await coursePolicy("D", 120);
    for (const [index, name] of ["T1018열 일", "T1018열 아주 긴 이름의 마사지사"].entries()) {
      therapistIds.push((await seedEmployee(`E2E-T1018-COL-${index}`, name, "THERAPIST", 97821 + index)).id);
    }

    roomId = (
      await (prisma as any).room.upsert({
        where: { sortOrder: 97831 },
        update: { displayName: "T1018열 객실", isActive: true },
        create: { displayName: "T1018열 객실", migrationReferenceName: "T1018-COL-97831", sortOrder: 97831, isActive: true }
      })
    ).id;

    // 줄마다 예약자·코스·입장 글자 길이가 다르다. 사용중(입장 → 예상)·청소중(입장 → 종료, 주 버튼 둘)·예약(미입장) 줄이
    // 섞여 윗줄 앞 칸과 주 버튼 길이도 다르다. 11:00과 11:30은 같은 객실이 겹쳐 경고가 붙는다.
    const calls = [
      { startTime: "11:00", courseId: courseA, bookingChannelCode: "WALK_IN", bookerName: "김", status: "IN_USE", actualEntryTime: "11:05", roomId, therapist: 0 },
      { startTime: "11:30", courseId: courseD, bookingChannelCode: "PHONE", bookerName: "아주 긴 예약자 이름 홍길동 사장님", status: "RESERVED", roomId, therapist: null },
      { startTime: "13:00", courseId: courseA, bookingChannelCode: null, bookerName: null, customerMemo: "몰라", status: "RESERVED", therapist: 1 },
      { startTime: "14:00", courseId: courseD, bookingChannelCode: "KAKAOTALK", bookerName: "몰라", status: "IN_USE", actualEntryTime: "14:00", therapist: 1, paymentMethodCode: "CARD" },
      { startTime: "15:00", courseId: courseA, bookingChannelCode: "TELEGRAM", bookerName: "Nguyen Van A", status: "RESERVED", therapist: 0 },
      { startTime: "16:00", courseId: courseA, bookingChannelCode: "ZALO", bookerName: "정 대표", status: "CLEANING", actualEntryTime: "16:00", actualEndTime: "16:58", therapist: 0 }
    ];
    for (const { therapist, ...call } of calls) {
      const created = await (prisma as any).serviceCall.create({
        data: { operatingMonthId: monthId, serviceDate: new Date(`${serviceDate}T00:00:00.000Z`), roomId: null, ...call }
      });
      if (therapist !== null) {
        await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: created.id, assignmentRole: "THERAPIST_1", employeeId: therapistIds[therapist] } });
      }
    }
  });

  test.afterAll(async () => {
    await cleanup();
    await (prisma as any).coursePolicy.deleteMany({ where: { name: { in: Object.values(policyNames) } } });
    await (prisma as any).room.updateMany({ where: { id: roomId }, data: { isActive: false } });
    await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  // 1600px은 한 줄 11칸(2026-10-22 시안 111.png), 그보다 좁으면 두 줄로 접힌다.
  for (const width of [1600, 1280, 1024, 700]) {
    test(`${width}px: 상태·Therapist·객실·결제 칸이 모든 줄에서 같은 가로 위치에 있다`, async ({ page }) => {
      await openLedger(page, width);
      await expectAlignedColumns(page);
    });
  }

  test("1280px에서 편집 패널을 열어 원장이 좁아져도 칸이 모든 줄에서 같은 가로 위치에 있다", async ({ page }) => {
    await openLedger(page, 1280);
    await page.locator("[data-call-open]").first().click();
    await expect(page.getByRole("complementary", { name: /^콜 상세/ })).toBeVisible();
    await expectAlignedColumns(page);
  });

  // 2026-10-22: 입장 시각을 눌러 뜬 입력칸(112px 고정)이 5rem 입장 칸을 넘어 종료 칸을 덮었다. 입력칸은 자기 칸 폭을 채운다.
  const timeEditCases = [
    { width: 1920, panel: false },
    { width: 1600, panel: false },
    { width: 1366, panel: false },
    { width: 1280, panel: true },
    { width: 1024, panel: false }
  ];
  for (const { width, panel } of timeEditCases) {
    test(`${width}px${panel ? "(편집 패널 열림)" : ""}: 입장·종료 시각 입력칸이 자기 칸 안에 들어가 옆 칸을 덮지 않는다`, async ({ page }) => {
      await openLedger(page, width);
      if (panel) {
        await page.locator("[data-call-open]").first().click();
        await expect(page.getByRole("complementary", { name: /^콜 상세/ })).toBeVisible();
      }
      const rects = (line: Locator, kind: "entry" | "end") =>
        line.evaluate(
          (element, field) => {
            const box = (selector: string) => {
              const target = element.querySelector(selector);
              if (!target) return null;
              const { left, right, top, bottom } = target.getBoundingClientRect();
              return { left, right, top, bottom };
            };
            return {
              input: box(`[data-line-cell="${field}"] input[type="time"]`),
              cell: box(`[data-line-cell="${field}"]`),
              next: box(`[data-line-cell="${field === "entry" ? "end" : "pay"}"]`)
            };
          },
          kind
        );
      const lineAt = (time: string) =>
        page.locator("[data-ledger-line]:visible").filter({ has: page.locator('[data-line-cell="time"]', { hasText: time }) });

      // 입장: 11:00 줄(사용중, 입장 11:05) → 종료 칸 앞에서 끝난다.
      const using = lineAt("11:00");
      await using.locator('[data-line-cell="entry"] button').click();
      await expect(using.locator('[data-line-cell="entry"] input[type="time"]')).toBeFocused();
      const entry = await rects(using, "entry");
      expect(entry.input!.right, "입장 입력칸의 오른쪽 끝이 입장 칸 안이다").toBeLessThanOrEqual(entry.cell!.right + 0.5);
      expect(entry.input!.left, "입장 입력칸의 왼쪽 끝이 입장 칸 안이다").toBeGreaterThanOrEqual(entry.cell!.left - 0.5);
      expect(entry.input!.right, "입장 입력칸이 종료 칸을 덮지 않는다").toBeLessThanOrEqual(entry.next!.left);
      // 값이 칸 안에서 잘리지 않는다(12시간제 "오전 11:05"가 가장 넓다).
      expect(await using.locator('[data-line-cell="entry"] input[type="time"]').evaluate((input) => input.scrollWidth - input.clientWidth)).toBeLessThanOrEqual(0);
      await page.keyboard.press("Escape");

      // 종료: 16:00 줄(청소중, 종료 16:58) → 결제 칸(한 줄 11칸일 때)을 덮지 않는다.
      const cleaning = lineAt("16:00");
      await cleaning.locator('[data-line-cell="end"] button').click();
      await expect(cleaning.locator('[data-line-cell="end"] input[type="time"]')).toBeFocused();
      const end = await rects(cleaning, "end");
      expect(end.input!.right, "종료 입력칸의 오른쪽 끝이 종료 칸 안이다").toBeLessThanOrEqual(end.cell!.right + 0.5);
      expect(end.input!.right, "종료 입력칸이 옆 칸을 덮지 않는다").toBeLessThanOrEqual(end.next!.left);
      await page.keyboard.press("Escape");
      await expectNoPageOverflow(page);
    });
  }

  test("한 줄 11칸은 열의 최소 폭 합계(81rem) 이상일 때만 쓴다: 경계 폭에서 줄이 옆으로 넘치지 않는다", async ({ page }) => {
    await openLedger(page, 1400);
    // 컨테이너 쿼리가 폭 변화를 바로 따른다. 11칸이 시작하는 폭 앞뒤를 훑는다.
    for (const width of [1330, 1340, 1350, 1360, 1366, 1380, 1400]) {
      await page.setViewportSize({ width, height: 900 });
      const overflows = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("[data-ledger-line]")]
          .filter((line) => line.offsetParent !== null)
          .map((line) => line.scrollWidth - line.clientWidth)
      );
      expect(overflows.length, `${width}px에 보이는 줄이 있다`).toBeGreaterThan(0);
      for (const overflow of overflows) expect(overflow, `${width}px: 줄이 옆으로 ${overflow}px 넘친다`).toBeLessThanOrEqual(0);
    }
  });

  // 같은 날의 편집 패널: 코스·Therapist 두 칸 나란히는 패널이 넓을 때만이다(좁으면 값이 끝까지 안 보였다).
  for (const { width, sideBySide } of [
    { width: 1280, sideBySide: false },
    { width: 1920, sideBySide: true }
  ]) {
    test(`${width}px: 편집 패널의 시간·코스, Therapist 두 칸은 ${sideBySide ? "나란히" : "한 칸씩 위아래로"} 놓인다`, async ({ page }) => {
      await openLedger(page, width);
      await page.locator("[data-call-open]").first().click();
      const panel = page.getByRole("complementary", { name: /^콜 상세/ });
      await expect(panel).toBeVisible();
      for (const [first, second] of [
        ["startTime", "courseId"],
        ["therapist1Id", "therapist2Id"]
      ]) {
        const a = (await panel.locator(`[data-call-field="${first}"]`).boundingBox())!;
        const b = (await panel.locator(`[data-call-field="${second}"]`).boundingBox())!;
        if (sideBySide) {
          expect(Math.abs(a.y - b.y), `${first}·${second}가 같은 줄이다`).toBeLessThan(4);
          expect(b.x, `${second}가 ${first} 오른쪽이다`).toBeGreaterThan(a.x + a.width - 1);
        } else {
          expect(Math.abs(a.x - b.x), `${first}·${second}의 왼쪽 끝이 같다(위아래)`).toBeLessThan(2);
          expect(b.y, `${second}가 ${first} 아래다`).toBeGreaterThan(a.y + a.height - 1);
        }
      }
    });
  }

  // 2026-10-23 고객 요청: 표처럼 칸 사이에 세로줄을 긋는다. 선은 줄 높이를 다 채우고 머리 줄의 선과 같은 자리에 있다.
  test("1600px 한 줄 표: 칸 사이 세로줄이 줄 높이를 다 채우고 머리 줄의 선과 같은 x에 있다", async ({ page }) => {
    await openLedger(page, 1600);
    const geometry = await page.evaluate(() => {
      const dividers = (cells: Element[]) =>
        cells.map((cell) => {
          const before = getComputedStyle(cell, "::before");
          const rect = cell.getBoundingClientRect();
          return { width: before.width, x: Math.round(rect.left + parseFloat(before.left)), top: rect.top, bottom: rect.bottom };
        });
      const line = [...document.querySelectorAll<HTMLElement>("[data-ledger-line]")].find((candidate) => candidate.offsetParent !== null)!;
      const head = document.querySelector<HTMLElement>("[data-ledger-head]")!;
      const lineRect = line.getBoundingClientRect();
      return {
        lineTop: lineRect.top,
        lineBottom: lineRect.bottom - 1,
        line: dividers([...line.querySelectorAll(":scope > [data-line-cell]")].slice(1)),
        head: dividers([...head.children].slice(1))
      };
    });
    expect(geometry.line).toHaveLength(10);
    expect(geometry.head).toHaveLength(10);
    for (const [index, divider] of geometry.line.entries()) {
      expect(divider.width, `${index + 2}번째 칸 앞의 선`).toBe("1px");
      expect(Math.abs(divider.top - geometry.lineTop), "선이 줄 위끝까지 닿는다").toBeLessThanOrEqual(1);
      expect(Math.abs(divider.bottom - geometry.lineBottom), "선이 줄 아래끝까지 닿는다").toBeLessThanOrEqual(1);
      expect(Math.abs(divider.x - geometry.head[index].x), "머리 줄의 선과 같은 x").toBeLessThanOrEqual(1);
    }
  });

  // 2026-10-23: 결제 칸의 "Chưa xác nhận thanh toán"이 잘리고 상태 칩 "Đang sử dụng"이 말줄임이 됐다. 가장 긴 베트남어도 다 보인다.
  for (const width of [1366, 1600]) {
    test(`${width}px 베트남어: 상태·결제 칩 글자가 칸 안에서 잘리지 않는다`, async ({ page }) => {
      await openLedger(page, width);
      await setLocaleCookie(page, "vi");
      await page.reload();
      await expect(page.getByRole("list", { name: "Danh sách sổ cuộc gọi" })).toBeVisible();
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-ledger-line] [data-line-cell="status"] .truncate, [data-ledger-line] [data-line-cell="pay"] .truncate')]
          .filter((element) => element.offsetParent !== null && element.scrollWidth > element.clientWidth)
          .map((element) => element.textContent)
      );
      expect(clipped).toEqual([]);
      await expect(page.locator('[data-ledger-line] [data-line-cell="pay"]').filter({ hasText: "Chưa xác nhận" }).first()).toBeVisible();
      // 같은 요청의 상태 카드: 일곱 장이 한 줄로 나눠도 가장 긴 베트남어 상태 이름이 말줄임이 되지 않는다.
      const clippedCards = await page
        .getByRole("list", { name: "Số ca theo trạng thái" })
        .locator("li .truncate")
        .evaluateAll((labels) => labels.filter((label) => label.scrollWidth > label.clientWidth).map((label) => label.textContent));
      expect(clippedCards).toEqual([]);
      await expectNoPageOverflow(page);
    });
  }

  // 1366px 노트북(가장 흔한 매장 PC 폭)도 원장이 81rem을 넘어 한 줄 11칸과 머리 줄을 쓴다(2026-10-23 열 폭 재조정).
  test("1366px: 머리 줄이 보이고 줄마다 11칸이 한 줄에 놓인다", async ({ page }) => {
    await openLedger(page, 1366);
    await expect(page.locator("[data-ledger-head]")).toBeVisible();
    const lines = await page.locator("[data-ledger-line]:visible").evaluateAll((items) =>
      items.map((line) => new Set([...line.querySelectorAll<HTMLElement>("[data-line-cell]")].filter((cell) => cell.offsetParent !== null).map((cell) => Math.round(cell.getBoundingClientRect().top))).size)
    );
    expect(lines.length).toBeGreaterThan(0);
    expect(new Set(lines), "모든 칸의 윗변이 같다").toEqual(new Set([1]));
    await expectNoPageOverflow(page);
  });

  // 2026-10-23 "드롭다운 여백": 줄 안 ▾ 목록은 256px 고정이라 짧은 목록의 오른쪽이 비었다. 이제 칸 폭 이상, 가장 긴 항목만큼이다.
  test("1600px: 줄 안 ▾ 목록은 칸 폭에 맞고, 항목 글자가 잘리지 않는다", async ({ page }) => {
    await openLedger(page, 1600);
    const line = page.locator("[data-ledger-line]:visible").first();
    const measure = async (field: string) => {
      const trigger = line.locator(`[data-cell-picker="${field}"]`);
      await trigger.click();
      const list = page.locator(`[data-cell-picker-list="${field}"]`);
      await expect(list.getByRole("option").first()).toBeVisible();
      const result = await list.evaluate((element, triggerBox) => ({
        width: element.getBoundingClientRect().width,
        trigger: triggerBox,
        truncated: [...element.querySelectorAll<HTMLElement>('[role="option"] .truncate')].filter((label) => label.scrollWidth > label.clientWidth).map((label) => label.textContent)
      }), (await trigger.boundingBox())!.width);
      await page.keyboard.press("Escape");
      return result;
    };
    // 할인 항목은 모두 칸보다 짧다: 목록이 칸과 같은 폭이다(오른쪽에 빈 띠가 없다).
    const discount = await measure("discountTypeCode");
    expect(Math.abs(discount.width - discount.trigger)).toBeLessThanOrEqual(1);
    expect(discount.truncated).toEqual([]);
    // Therapist 목록은 이름 옆에 부가 정보가 붙는다: 칸보다 넓어질 수 있지만 24rem을 넘지 않고 글자가 다 보인다.
    const therapist = await measure("therapist1Id");
    expect(therapist.width).toBeGreaterThanOrEqual(therapist.trigger - 1);
    expect(therapist.width).toBeLessThanOrEqual(384);
    expect(therapist.truncated).toEqual([]);
  });

  // 2026-10-23 고객 요청: 줄을 누르면 콜 상세가 뜨고, 같은 줄을 다시 누르면 닫힌다.
  test("줄을 누르면 콜 상세가 열리고, 같은 줄을 다시 누르면 닫힌다", async ({ page }) => {
    await openLedger(page, 1600);
    const detail = page.getByRole("complementary", { name: /^콜 상세/ });
    const line = page.locator("[data-ledger-line]:visible").filter({ has: page.locator('[data-line-cell="time"]', { hasText: "13:00" }) });
    // 버튼이 아닌 자리(코스 칸)를 누른다.
    await line.locator('[data-line-cell="course"]').click();
    await expect(detail).toBeVisible();
    await expect(page).toHaveURL(/[?&]call=/);
    await line.locator('[data-line-cell="course"]').click();
    await expect(detail).toBeHidden();
    await expect(page).not.toHaveURL(/[?&]call=/);
    // 예약시간 버튼도 같다.
    const opener = line.locator("[data-call-open]");
    await opener.click();
    await expect(detail).toBeVisible();
    await expect(opener).toHaveAttribute("aria-expanded", "true");
    await opener.click();
    await expect(detail).toBeHidden();
    await expect(opener).toHaveAttribute("aria-expanded", "false");
  });

  // 2026-10-23 고객 요청: 빠른 예약 버튼으로 열고 같은 버튼으로 닫는다. 쓰던 입력이 있으면 닫기 전에 묻는다.
  test("빠른 예약 버튼을 다시 누르면 패널이 닫히고, 쓰던 입력이 있으면 먼저 묻는다", async ({ page }) => {
    await openLedger(page, 1600);
    const trigger = page.locator("[data-quick-booking-trigger]");
    const panel = quickBookingPanel(page);
    await trigger.click();
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await trigger.click();
    await expect(panel).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await trigger.click();
    await expect(panel).toBeVisible();
    await chooseConditions(panel, { partySize: 2 });
    await trigger.click();
    const guard = page.getByRole("alertdialog", { name: "저장하지 않은 입력이 있습니다" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "취소" }).click();
    await expect(panel).toBeVisible();
    await trigger.click();
    await guard.getByRole("button", { name: "나가기" }).click();
    await expect(panel).toBeHidden();
  });

  // 2026-10-23 고객 요청: 상태 카드 7장이 빠른 예약 앞의 가로를 같은 폭으로 나눠 채운다. 고객 화면 버튼은 없다.
  for (const width of [1920, 1366]) {
    test(`${width}px: 상태 카드 7장이 같은 폭으로 빠른 예약 버튼 앞까지 채우고, 고객 화면 버튼이 없다`, async ({ page }) => {
      await openLedger(page, width);
      const cards = await page
        .getByRole("list", { name: "상태별 건수" })
        .locator("li")
        .evaluateAll((items) => items.map((item) => item.getBoundingClientRect()).map(({ left, right, top, width }) => ({ left, right, top, width })));
      expect(cards).toHaveLength(7);
      const widths = cards.map((card) => card.width);
      expect(Math.max(...widths) - Math.min(...widths), "카드 폭이 같다").toBeLessThanOrEqual(1);
      expect(new Set(cards.map((card) => Math.round(card.top))).size, "한 줄이다").toBe(1);
      const trigger = (await page.locator("[data-quick-booking-trigger]").boundingBox())!;
      expect(trigger.x - cards[6].right, "마지막 카드가 빠른 예약 버튼 바로 앞까지 온다").toBeLessThanOrEqual(13);
      await expect(page.getByRole("link", { name: "고객 화면" })).toHaveCount(0);
    });
  }

  test("휴대폰 폭(360px)의 읽기 전용 줄도 경고 칩이 줄 안에 다 보인다", async ({ page }) => {
    await openLedger(page, 360);
    await expect(page.getByRole("button", { name: /^경고 / }).first()).toBeVisible();
    // 경고 버튼의 오른쪽 끝이 그 줄 안에 있는지 한 번에 잰다(목록이 다시 그려지는 사이에 재지 않게).
    const overhangs = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-ledger-line] button[aria-label^="경고 "]')]
        .filter((warning) => warning.offsetParent !== null)
        .map((warning) => Math.round(warning.getBoundingClientRect().right - warning.closest("[data-ledger-line]")!.getBoundingClientRect().right))
    );
    expect(overhangs.length).toBeGreaterThan(0);
    for (const overhang of overhangs) expect(overhang).toBeLessThanOrEqual(0);
    await expectNoPageOverflow(page);
  });
});
