import { testEmployees } from "./support/test-employees";
import { expect, test, type Browser, type Locator } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { selectGridOption } from "./support/call-grid";

// 티켓 17: 저장 충돌(STALE_CALL) 비교와 다시 반영. 티켓 15의 두 브라우저 문맥 패턴을 그대로 쓴다.
// 13:00은 공용 시드(defaultTimeSlots)의 활성 슬롯이다.
const accounts = {
  counterA: { accountId: "t17_counter_a", password: "Ticket17!counterA", staffCode: "E2E-T17-COUNTER-A", sortOrder: 9451 },
  counterB: { accountId: "t17_counter_b", password: "Ticket17!counterB", staffCode: "E2E-T17-COUNTER-B", sortOrder: 9452 }
} as const;
type AccountKey = keyof typeof accounts;

const monthKey = "2077-04";
const serviceDate = "2077-04-10";

let monthId = "";
let roomId = "";
let courseId = "";
let therapistId = "";
let createdMonth = false;

async function seedAccount(key: AccountKey) {
  const account = accounts[key];
  const employee = await testEmployees.upsert({
    where: { staffCode: account.staffCode },
    update: { displayName: `T17 ${key}`, employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: account.staffCode,
      displayName: `T17 ${key}`,
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
  await (prisma as any).userAccount.upsert({
    where: { accountId: account.accountId },
    update: data,
    create: { ...data, accountId: account.accountId }
  });
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

async function openLedger(browser: Browser, key: AccountKey) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, accounts[key].accountId, accounts[key].password);
  await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
  return { context, page };
}

function saveState(row: Locator) {
  return row.locator("[data-save-state]");
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

test.describe("티켓 17 저장 충돌 비교와 다시 반영", () => {
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
        endDate: new Date(`${monthKey}-30T00:00:00.000Z`),
        status: "작성중"
      }
    });
    monthId = month.id;
    await cleanup();

    const room = await (prisma as any).room.upsert({
      where: { sortOrder: 94005 },
      update: { displayName: "T17 호실", isActive: true },
      create: { displayName: "T17 호실", migrationReferenceName: "T17-ROOM", sortOrder: 94005, isActive: true }
    });
    roomId = room.id;
    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    courseId = course.id;
    const policy = {
      name: "T17 A",
      durationMinutes: 60,
      basePrice: 1500000,
      requiresSecondTherapist: false,
      tvDisplayName: "T17 A",
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
      where: { staffCode: "E2E-T17-THR-1" },
      update: { displayName: "T17 마사지사", employeeGroup: "THERAPIST", isActive: true },
      create: {
        staffCode: "E2E-T17-THR-1",
        displayName: "T17 마사지사",
        employeeGroup: "THERAPIST",
        position: "마사지사",
        shiftType: "전체",
        baseSalary: 0,
        employmentStatus: "재직",
        sortOrder: 9453,
        isActive: true
      }
    });
    therapistId = therapist.id;
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T17 A", effectiveFromMonth: monthKey } });
    // 활성 객실은 모두 객실 화면에 나온다(support/README). 이 스펙의 객실은 끈다.
    await (prisma as any).room.update({ where: { id: roomId }, data: { isActive: false } });
    if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  test("다른 화면이 먼저 저장하면 충돌 확인 필요가 되어 콜 상세 패널에 비교가 자동으로 열리고, 고른 필드만 다시 반영해 저장한다", async ({ browser }) => {
    const callId = await createCall("T17 원본");
    const a = await openLedger(browser, "counterA");
    const b = await openLedger(browser, "counterB");

    try {
      const aRow = a.page.locator(`tr[data-service-call-id="${callId}"]`);
      const bRow = b.page.locator(`tr[data-service-call-id="${callId}"]`);
      await expect(saveState(aRow)).toHaveAttribute("data-save-state", "idle");
      await expect(saveState(bRow)).toHaveAttribute("data-save-state", "idle");

      // 화면 A가 결제수단을 먼저 고르고 저장을 마친다.
      await selectGridOption(a.page, aRow, "결제수단", "카드");
      await expect(saveState(aRow)).toHaveAttribute("data-save-state", "saved", { timeout: 20_000 });

      // 화면 B는 그 사이 저장된 것을 모른 채(옛 updatedAt을 그대로 들고) 다른 칸(고객/메모)을 고친다.
      const bMemo = bRow.getByLabel("고객/메모");
      await bMemo.fill("T17 B의 초안");
      await bMemo.press("Enter");

      // 충돌 확인 필요가 되고, 콜 상세 패널에 비교가 저절로 열린다(체크 1).
      await expect(saveState(bRow)).toHaveAttribute("data-save-state", "conflict", { timeout: 20_000 });
      const dialog = b.page.getByRole("region", { name: "저장 충돌 비교" });
      await expect(dialog).toBeVisible();

      // 내가 고친 필드(고객/메모)와, 다른 화면이 고친 필드(결제수단) 둘 다 "다르다"로 보인다 — 원장 필드 순서대로.
      const memoRow = dialog.getByRole("row", { name: /^고객\/메모 / });
      await expect(memoRow).toContainText("T17 B의 초안");
      await expect(memoRow).toContainText("T17 원본");
      const paymentRow = dialog.getByRole("row", { name: /^결제수단 / });
      await expect(paymentRow).toContainText("카드");
      const memoIndex = await dialog.getByRole("rowheader").allTextContents().then((labels) => labels.indexOf("고객/메모"));
      const paymentIndex = await dialog.getByRole("rowheader").allTextContents().then((labels) => labels.indexOf("결제수단"));
      expect(memoIndex).toBeGreaterThanOrEqual(0);
      expect(memoIndex).toBeLessThan(paymentIndex);

      // 강제 덮어쓰기 버튼은 없다 — 비교 구역에는 다시 불러오기·다시 반영뿐이다(체크 2).
      await expect(dialog.getByRole("button")).toHaveText(["최신 내용으로 다시 불러오기", "다시 반영하고 저장"]);
      await expect(dialog.getByRole("button", { name: "다시 반영하고 저장" })).toBeDisabled();

      // 비교는 비모달 상세 구역이다(S2). 원장 입력을 계속 쓸 수 있고 비교가 포커스를 가두지 않는다.
      await bMemo.focus();
      await expect(bMemo).toBeFocused();
      await expect(dialog).toBeVisible();

      // 결제수단은 고르지 않고(최신 값 "카드" 그대로 둔다), 고객/메모만 내 값 쓰기로 고른다 — 키보드로.
      const memoCheckbox = memoRow.getByRole("checkbox", { name: "고객/메모 내 값 쓰기" });
      await memoCheckbox.focus();
      await b.page.keyboard.press("Space");
      await expect(memoCheckbox).toBeChecked();
      // 결제수단도 다르지만(카드 vs 빈칸) 체크하지 않았다 — 고르지 않은 필드는 최신 값 그대로 저장된다.
      await expect(paymentRow.getByRole("checkbox")).not.toBeChecked();

      const reapplyButton = dialog.getByRole("button", { name: "다시 반영하고 저장" });
      await reapplyButton.focus();
      await b.page.keyboard.press("Enter");

      // 다시 반영한 저장이 받아들여진다. 비교는 치워지고, 고른 필드만 반영되고 나머지는 최신 값 그대로다.
      await expect(saveState(bRow)).toHaveAttribute("data-save-state", "saved", { timeout: 20_000 });
      await expect(dialog).toBeHidden();
      await expect(bMemo).toHaveValue("T17 B의 초안");
      await expect(bRow.getByRole("combobox", { name: "결제수단" })).toHaveValue("카드");

      const stored = await (prisma as any).serviceCall.findUnique({ where: { id: callId } });
      expect(stored.customerMemo).toBe("T17 B의 초안");
      expect(stored.paymentMethodCode).toBe("CARD"); // A가 고른 값이 강제로 덮이지 않았다.
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test("\"최신 내용으로 다시 불러오기\"는 비교 중인 초안을 통째로 최신 행으로 바꾼다", async ({ page }) => {
    const callId = await createCall("T17 두 번째 원본");
    await login(page, accounts.counterA.accountId, accounts.counterA.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    const row = page.locator(`tr[data-service-call-id="${callId}"]`);
    const memo = row.getByLabel("고객/메모");
    const note = row.getByLabel("비고");
    await expect(saveState(row)).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });

    // 입력만 해 두고(아직 커밋하지 않음) 다른 화면이 적어 둔 것처럼 비고를 직접 바꿔 버전을 올린다.
    await memo.fill("T17 내가 고친 값");
    await (prisma as any).serviceCall.update({ where: { id: callId }, data: { note: "T17 다른 화면이 적은 비고" } });
    await memo.press("Enter");

    await expect(saveState(row)).toHaveAttribute("data-save-state", "conflict", { timeout: 20_000 });
    const dialog = page.getByRole("region", { name: "저장 충돌 비교" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("T17 내가 고친 값");
    await expect(dialog).toContainText("T17 다른 화면이 적은 비고");

    await dialog.getByRole("button", { name: "최신 내용으로 다시 불러오기" }).click();

    // 초안이 통째로 최신 행으로 바뀐다 — 내가 고치던 메모도 되돌아간다. 강제 덮어쓰기가 아니라 다시 불러오기다.
    await expect(dialog).toBeHidden();
    await expect(saveState(row)).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
    await expect(memo).toHaveValue("T17 두 번째 원본");
    await expect(note).toHaveValue("T17 다른 화면이 적은 비고");

    const stored = await (prisma as any).serviceCall.findUnique({ where: { id: callId } });
    expect(stored.customerMemo).toBe("T17 두 번째 원본");
    expect(stored.note).toBe("T17 다른 화면이 적은 비고");
  });
});
