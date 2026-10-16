import { testEmployees } from "./support/test-employees";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 티켓 15: 기존 행 저장의 버전 검사(STALE_CALL)와 행 저장 상태. 두 브라우저 문맥이 실제 Postgres에 함께 저장한다.
// 13:00은 공용 시드(defaultTimeSlots)의 활성 슬롯이다. 티켓 03 이후 원장 행에는 입력칸이 없어 저장은 편집
// 패널에서 하고, 행은 저장 상태 표시(`data-line-save-state`)만 들고 있다 — 계약은 그대로 패널로 옮겨졌다.
const accounts = {
  counterA: { accountId: "t15_counter_a", password: "Ticket15!counterA", staffCode: "E2E-T15-COUNTER-A", sortOrder: 9431 },
  counterB: { accountId: "t15_counter_b", password: "Ticket15!counterB", staffCode: "E2E-T15-COUNTER-B", sortOrder: 9432 }
} as const;
type AccountKey = keyof typeof accounts;

const monthKey = "2075-03";
const serviceDate = "2075-03-10";
const staleMessage = "다른 화면에서 이 콜이 바뀌었습니다. 다시 불러온 뒤에 저장하세요.";

let monthId = "";
let roomId = "";
let courseId = "";
let therapistId = "";
let createdMonth = false;
const accountDbIds: Record<AccountKey, string> = { counterA: "", counterB: "" };

async function seedAccount(key: AccountKey) {
  const account = accounts[key];
  const employee = await testEmployees.upsert({
    where: { staffCode: account.staffCode },
    update: { displayName: `T15 ${key}`, employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: account.staffCode,
      displayName: `T15 ${key}`,
      employeeGroup: "OPERATIONS",
      position: "카운터",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: account.sortOrder,
      isActive: true
    }
  });
  const data = {
    email: `${account.accountId}@example.local`,
    passwordHash: await hash(account.password, argon2idOptions),
    role: "counter",
    employeeId: employee.id,
    isActive: true,
    lockedUntil: null,
    failedLoginCount: 0
  };
  const saved = await (prisma as any).userAccount.upsert({
    where: { accountId: account.accountId },
    update: data,
    create: { ...data, accountId: account.accountId }
  });
  accountDbIds[key] = saved.id;
}

async function createCall(memo: string) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: "13:00",
      roomId,
      courseId,
      customerMemo: memo,
      status: "RESERVED"
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: therapistId }
  });
  return call.id as string;
}

async function openLedgerPanel(browser: Browser, key: AccountKey, callId: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, accounts[key].accountId, accounts[key].password);
  // 패널은 그 콜을 고쳐야 하므로(행에는 입력칸이 없다, 티켓 03) 바로 그 콜의 편집 패널을 연다.
  await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}&call=${callId}`);
  return { context, page };
}

function row(page: Page, callId: string) {
  return page.locator(`tr[data-service-call-id="${callId}"]`);
}

function lineSaveState(page: Page, callId: string) {
  return row(page, callId).locator("[data-line-save-state]");
}

function panel(page: Page) {
  return page.getByRole("complementary", { name: /^콜 상세/ });
}

function paymentRegion(panelLocator: Locator) {
  return panelLocator.getByRole("region", { name: "결제" });
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

test.describe("티켓 15 기존 행 저장 충돌 거절과 행 저장 상태", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount("counterA");
    await seedAccount("counterB");
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
      where: { sortOrder: 94004 },
      update: { displayName: "T15 호실", isActive: true },
      create: { displayName: "T15 호실", migrationReferenceName: "T15-ROOM", sortOrder: 94004, isActive: true }
    });
    roomId = room.id;
    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    courseId = course.id;
    const policy = {
      name: "T15 A",
      durationMinutes: 60,
      basePrice: 1500000,
      requiresSecondTherapist: false,
      tvDisplayName: "T15 A",
      effectiveToMonth: monthKey,
      isActive: true
    };
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...policy } });
    }
    const therapist = await testEmployees.upsert({
      where: { staffCode: "E2E-T15-THR-1" },
      update: { displayName: "T15 마사지사", employeeGroup: "THERAPIST", isActive: true },
      create: {
        staffCode: "E2E-T15-THR-1",
        displayName: "T15 마사지사",
        employeeGroup: "THERAPIST",
        position: "마사지사",
        shiftType: "전체",
        baseSalary: 0,
        employmentStatus: "재직",
        sortOrder: 9433,
        isActive: true
      }
    });
    therapistId = therapist.id;
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    // 코스 정책과 운영월은 다른 스펙의 화면에도 보인다. 이 스펙이 만든 것은 지운다.
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T15 A", effectiveFromMonth: monthKey } });
    // 활성 객실은 모두 객실 화면에 나온다(support/README). 이 스펙의 객실은 끈다.
    await (prisma as any).room.update({ where: { id: roomId }, data: { isActive: false } });
    if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  test("두 화면이 같은 콜을 함께 저장하면 하나만 저장되고, 다른 화면은 충돌 확인 필요와 자기 초안을 남긴다", async ({ browser }) => {
    const callId = await createCall("T15 동시 저장 원본");
    const a = await openLedgerPanel(browser, "counterA", callId);
    const b = await openLedgerPanel(browser, "counterB", callId);

    try {
      const screens = [
        { key: "counterA" as const, page: a.page, paymentLabel: "카드", payment: "CARD" },
        { key: "counterB" as const, page: b.page, paymentLabel: "계좌", payment: "BANK_TRANSFER" }
      ];
      for (const screen of screens) {
        await expect(lineSaveState(screen.page, callId)).toHaveAttribute("data-line-save-state", "idle");
        await expect(panel(screen.page).locator('[data-save-state="idle"]')).toContainText("저장됨");
      }

      // 두 화면 모두 같은 updatedAt을 들고 있다. 결제수단을 고르는 순간 각자 저장한다(결제수단 변경은 감사 대상이다).
      // 결제수단은 콤보박스가 아니라 알약 라디오라 그 글자를 누른다(스펙 D19).
      await Promise.all(
        screens.map((screen) => paymentRegion(panel(screen.page)).getByText(screen.paymentLabel, { exact: true }).click())
      );
      for (const screen of screens) {
        await expect(lineSaveState(screen.page, callId)).toHaveAttribute("data-line-save-state", /^(saved|conflict)$/);
      }
      const states = await Promise.all(screens.map((screen) => lineSaveState(screen.page, callId).getAttribute("data-line-save-state")));
      expect([...states].sort()).toEqual(["conflict", "saved"]);
      const winner = screens[states.indexOf("saved")];
      const loser = screens[states.indexOf("conflict")];

      // 저장된 것은 먼저 들어온 화면의 값이고, 감사 기록도 그 저장 하나뿐이다.
      const stored = await (prisma as any).serviceCall.findUnique({ where: { id: callId } });
      expect(stored).toMatchObject({ customerMemo: "T15 동시 저장 원본", paymentMethodCode: winner.payment });
      const audits = await (prisma as any).auditLog.findMany({ where: { targetType: "service_call", targetId: callId } });
      expect(audits.map((audit: { action: string }) => audit.action)).toEqual(["service_call.row_changed"]);
      expect(audits[0].actorId).toBe(accountDbIds[winner.key]);
      expect(audits[0].afterValue.paymentMethodCode).toBe(winner.payment);
      expect(await (prisma as any).serviceCallStatusHistory.count({ where: { serviceCallId: callId } })).toBe(0);

      // 거절된 화면은 충돌 확인 필요와 거절 문구를 보이고, 입력한 초안을 그대로 둔다. 강제 덮어쓰기 버튼은 없다.
      const loserStatus = panel(loser.page).locator('[data-save-state="conflict"]');
      await expect(loserStatus).toContainText("충돌 확인 필요");
      await expect(loserStatus).toContainText(staleMessage);
      await expect(loserStatus.getByRole("button")).toHaveText(["최신 내용으로 다시 불러오기"]);
      await expect(paymentRegion(panel(loser.page)).locator(`input[data-payment-method="${loser.payment}"]`)).toBeChecked();

      // 충돌 상태에서 더 고쳐도 다시 불러오기 전에는 저장하지 않는다. 초안은 남는다.
      const loserMemo = panel(loser.page).getByLabel("고객/메모", { exact: true });
      await loserMemo.fill("T15 거절된 화면 메모");
      await loserMemo.press("Tab");
      await expect(lineSaveState(loser.page, callId)).toHaveAttribute("data-line-save-state", "conflict");
      await expect(loserMemo).toHaveValue("T15 거절된 화면 메모");
      expect((await (prisma as any).serviceCall.findUnique({ where: { id: callId } })).customerMemo).toBe("T15 동시 저장 원본");

      // 먼저 저장한 화면이 그 사이 한 번 더 저장한다. 다시 불러오기는 거절 당시가 아니라 지금 저장된 행을 가져온다.
      const winnerMemo = panel(winner.page).getByLabel("고객/메모", { exact: true });
      await winnerMemo.fill("T15 먼저 저장한 화면 메모");
      await winnerMemo.press("Tab");
      await expect
        .poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: callId } })).customerMemo)
        .toBe("T15 먼저 저장한 화면 메모");

      await loserStatus.getByRole("button", { name: "최신 내용으로 다시 불러오기" }).click();
      await expect(lineSaveState(loser.page, callId)).toHaveAttribute("data-line-save-state", "idle");
      await expect(panel(loser.page).locator('[data-save-state="idle"]')).toContainText("저장됨");
      await expect(loserMemo).toHaveValue("T15 먼저 저장한 화면 메모");
      await expect(paymentRegion(panel(loser.page)).locator(`input[data-payment-method="${winner.payment}"]`)).toBeChecked();

      // 다시 불러온 뒤의 저장은 받아들여진다.
      await loserMemo.fill("T15 다시 불러온 뒤 저장");
      await loserMemo.press("Tab");
      await expect(lineSaveState(loser.page, callId)).toHaveAttribute("data-line-save-state", "saved");
      await expect
        .poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: callId } })).customerMemo)
        .toBe("T15 다시 불러온 뒤 저장");
      expect((await (prisma as any).serviceCall.findUnique({ where: { id: callId } })).paymentMethodCode).toBe(winner.payment);
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test("같은 콜을 빠르게 연달아 고치면 자기 저장끼리 충돌하지 않고 마지막 입력으로 끝나며, 늦게 온 응답이 입력을 되돌리지 않는다", async ({ page }) => {
    const callId = await createCall("T15 연속 저장 원본");
    await login(page, accounts.counterA.accountId, accounts.counterA.password);
    const isAutosave = (request: { method(): string; headers(): Record<string, string> }) =>
      request.method() === "POST" && Boolean(request.headers()["next-action"]);
    // 원장 자동 저장(서버 액션) 응답을 늦춰, 응답을 기다리는 동안 다음 수정이 들어오게 한다.
    await page.route(
      (url) => url.pathname === "/calls",
      async (route) => {
        if (isAutosave(route.request())) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        await route.continue();
      }
    );
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}&call=${callId}`);

    const edit = panel(page);
    const memo = edit.getByLabel("고객/메모", { exact: true });
    const payment = paymentRegion(edit);
    await memo.fill("T15 첫 입력");
    await memo.press("Tab");
    await expect(lineSaveState(page, callId)).toHaveAttribute("data-line-save-state", "saving");
    await expect(edit.locator('[data-save-state="saving"]')).toContainText("저장 중");
    const nextSave = page.waitForRequest(isAutosave);

    // 첫 저장의 응답을 기다리는 동안에도 입력칸은 열려 있다. 결제수단을 고르고(알약 라디오) 메모를 또 고친다(메모는 아직 확정하지 않는다).
    expect(await payment.locator('input[type="radio"]').first().isEnabled()).toBe(true);
    await payment.getByText("카드", { exact: true }).click();
    await memo.fill("T15 마지막 입력");

    // 다음 저장은 첫 응답을 받은 뒤에야 나간다. 그 늦은 응답이 화면의 최신 입력을 되돌리지 않았다.
    await nextSave;
    await expect(memo).toHaveValue("T15 마지막 입력");
    await expect(payment.locator('input[data-payment-method="CARD"]')).toBeChecked();
    await memo.press("Tab");

    await expect(lineSaveState(page, callId)).toHaveAttribute("data-line-save-state", "saved", { timeout: 15_000 });
    await expect(memo).toHaveValue("T15 마지막 입력");
    await expect(payment.locator('input[data-payment-method="CARD"]')).toBeChecked();
    await expect
      .poll(async () => {
        const stored = await (prisma as any).serviceCall.findUnique({ where: { id: callId } });
        return `${stored.customerMemo}:${stored.paymentMethodCode}`;
      })
      .toBe("T15 마지막 입력:CARD");
  });
});
