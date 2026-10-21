import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { selectGridOption } from "./support/call-grid";
import { restoreUserAccount, setCodeItemActive } from "./support/cleanup";


const users = [
  { accountId: "story22_administrator", role: "administrator", password: "Story22!administrator" },
  { accountId: "story22_counter", role: "counter", password: "Story22!counter" },
  { accountId: "story22_waiter", role: "waiter", password: "Story22!waiter" }
];

type SeededData = {
  openMonthId: string;
  lockedMonthId: string;
  roomId: string;
  courseId: string;
  therapist1Id: string;
  therapist2Id: string;
  counterAccountDbId: string;
};

let seededData: SeededData;


async function seedAuthAccount(input: { accountId: string; email: string; staffCode: string; role: string; secret: string }) {
  const sortOrder = 92200 + [...input.staffCode].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: input.accountId,
      employeeGroup: "OPERATIONS",
      position: input.role === "waiter" ? "웨이터" : input.role === "counter" ? "카운터" : "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    },
    create: {
      staffCode: input.staffCode,
      displayName: input.accountId,
      employeeGroup: "OPERATIONS",
      position: input.role === "waiter" ? "웨이터" : input.role === "counter" ? "카운터" : "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
  const passwordHash = await hash(input.secret, argon2idOptions);
  return (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: {
      email: input.email,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: input.email,
      accountId: input.accountId,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}


async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: {
      displayName,
      employeeGroup,
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

async function seedStoryData(): Promise<SeededData> {
  const openMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2032-03" },
    update: {
      startDate: new Date("2032-03-01T00:00:00.000Z"),
      endDate: new Date("2032-03-31T00:00:00.000Z"),
      status: "작성중"
    },
    create: {
      monthKey: "2032-03",
      startDate: new Date("2032-03-01T00:00:00.000Z"),
      endDate: new Date("2032-03-31T00:00:00.000Z"),
      status: "작성중"
    }
  });
  const lockedMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2032-04" },
    update: {
      startDate: new Date("2032-04-01T00:00:00.000Z"),
      endDate: new Date("2032-04-30T00:00:00.000Z"),
      status: "잠금"
    },
    create: {
      monthKey: "2032-04",
      startDate: new Date("2032-04-01T00:00:00.000Z"),
      endDate: new Date("2032-04-30T00:00:00.000Z"),
      status: "잠금"
    }
  });
  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 92201 },
    update: {
      displayName: "E2E 922 호실",
      migrationReferenceName: "E2E22-ROOM",
      isActive: true
    },
    create: {
      displayName: "E2E 922 호실",
      migrationReferenceName: "E2E22-ROOM",
      sortOrder: 92201,
      isActive: true
    }
  });
  const course = await (prisma as any).course.upsert({
    where: { code: "E2E22A" },
    update: { isActive: true },
    create: { code: "E2E22A", isActive: true }
  });
  const existingPolicy = await (prisma as any).coursePolicy.findFirst({
    where: { courseId: course.id, effectiveFromMonth: "2032-03" }
  });
  if (existingPolicy) {
    await (prisma as any).coursePolicy.update({
      where: { id: existingPolicy.id },
      data: {
        name: "E2E 자동저장60",
        durationMinutes: 60,
        basePrice: 1500000,
        requiresSecondTherapist: false,
        tvDisplayName: "E2E 자동저장60",
        effectiveToMonth: null,
        isActive: true
      }
    });
  } else {
    await (prisma as any).coursePolicy.create({
      data: {
        courseId: course.id,
        name: "E2E 자동저장60",
        durationMinutes: 60,
        basePrice: 1500000,
        requiresSecondTherapist: false,
        tvDisplayName: "E2E 자동저장60",
        effectiveFromMonth: "2032-03",
        effectiveToMonth: null,
        isActive: true
      }
    });
  }

  const therapist1 = await seedEmployee("E2E22-THR-001", "E2E22 마사지사1", "THERAPIST", 92201);
  const therapist2 = await seedEmployee("E2E22-THR-002", "E2E22 마사지사2", "THERAPIST", 92202);

  await (prisma as any).timeSlot.upsert({
    where: { value: "12:00" },
    update: { sortOrder: 92201, isActive: true },
    create: { value: "12:00", sortOrder: 92201, isActive: true }
  });
  // 상태/결제수단/할인/확인값 코드는 공용 마스터 시드(defaultCodeItems)가 제공한다. 여기서 같은
  // 표시명으로 한국어 code를 또 만들면 콤보박스에 같은 라벨이 두 개 뜨고, 이 스펙이 고른 항목이
  // 마스터 코드인지 이 스펙 코드인지 알 수 없어진다(다른 스펙 드롭다운도 함께 오염된다).

  const counter = await (prisma as any).userAccount.findUniqueOrThrow({ where: { accountId: "story22_counter" } });
  return {
    openMonthId: openMonth.id,
    lockedMonthId: lockedMonth.id,
    roomId: room.id,
    courseId: course.id,
    therapist1Id: therapist1.id,
    therapist2Id: therapist2.id,
    counterAccountDbId: counter.id
  };
}

async function createCallRow(input: { operatingMonthId: string; serviceDate: string; memo: string; status?: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: input.operatingMonthId,
      serviceDate: new Date(`${input.serviceDate}T00:00:00.000Z`),
      startTime: "12:00",
      roomId: seededData.roomId,
      courseId: seededData.courseId,
      customerMemo: input.memo,
      status: input.status ?? "RESERVED",
      discountTypeCode: null,
      paymentMethodCode: "CASH",
      note: "E2E22 초기 비고",
      confirmationCode: "Y"
    }
  });
  await (prisma as any).serviceCallAssignment.createMany({
    data: [
      { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: seededData.therapist1Id },
      { serviceCallId: call.id, assignmentRole: "THERAPIST_2", employeeId: seededData.therapist2Id }
    ]
  });
  return call;
}

function line(page: Page, callId: string) {
  return page.locator(`[data-ledger-line][data-service-call-id="${callId}"]`);
}

/** 티켓 03: 칸은 더 이상 행에 있지 않다. 줄을 눌러 연 편집 패널이 자동저장 칸을 쥔다. */
function panel(page: Page) {
  return page.getByRole("complementary", { name: /^콜 상세/ });
}

async function openPanel(page: Page, callId: string) {
  // Next.js의 로딩 스켈레톤이 아직 실제 콜 원장으로 바뀌기 전에 눌러도 재시도하도록, 줄이 실제로
  // 보일 때까지 먼저 기다린 뒤 연다.
  const row = line(page, callId);
  await expect(row).toBeVisible();
  await row.locator("[data-call-open]").click();
  const edit = panel(page);
  await expect(edit).toBeVisible();
  return edit;
}

test.describe("Story 2.2 콜 행 자동저장과 상태 변경 이력", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const user of users) {
      await seedAuthAccount({
        accountId: user.accountId,
        email: `${user.accountId}@example.local`,
        staffCode: `E2E22-${user.role.toUpperCase()}`,
        role: user.role,
        secret: user.password
      });
    }
    seededData = await seedStoryData();
  });

  test("counter는 패널에서 기존 행을 blur·고르기로 자동저장하고 상태 변경 이력과 감사 로그를 남긴다", async ({ page }) => {
    const originalMemo = `E2E22 autosave original ${Date.now().toString(36)}`;
    const updatedMemo = `E2E22 autosave updated ${Date.now().toString(36)}`;
    const call = await createCallRow({ operatingMonthId: seededData.openMonthId, serviceDate: "2032-03-05", memo: originalMemo });

    await login(page, "story22_counter", "Story22!counter");
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-03-05`);

    await expect(line(page, call.id)).toContainText(originalMemo);
    const edit = await openPanel(page, call.id);
    const memo = edit.getByLabel("고객/메모");
    await memo.fill(updatedMemo);
    await memo.blur();
    // 처음 불러온 행도 "저장됨"으로 보이므로(티켓 15) 이 화면의 저장이 끝났는지는 data-save-state로 본다.
    const saveState = edit.locator("[data-save-state]");
    await expect(saveState).toHaveAttribute("data-save-state", "saved");
    await expect(saveState).toContainText("저장됨");
    await expect(line(page, call.id)).toContainText(updatedMemo);

    await selectGridOption(page, edit, "상태", "사용중");
    const payment = edit.getByRole("region", { name: "결제" });
    await payment.getByText("카드", { exact: true }).click();
    await expect(saveState).toHaveAttribute("data-save-state", "saved");

    await expect
      .poll(async () => {
        const saved = await (prisma as any).serviceCall.findUnique({ where: { id: call.id } });
        return `${saved?.customerMemo}:${saved?.status}:${saved?.paymentMethodCode}`;
      })
      .toBe(`${updatedMemo}:IN_USE:CARD`);

    const histories = await (prisma as any).serviceCallStatusHistory.findMany({
      where: { serviceCallId: call.id },
      orderBy: { changedAt: "asc" }
    });
    expect(histories).toHaveLength(1);
    expect(histories[0]).toMatchObject({
      previousStatus: "RESERVED",
      newStatus: "IN_USE",
      changedByAccountId: seededData.counterAccountDbId
    });

    const auditActions = await (prisma as any).auditLog.findMany({
      where: { targetType: "service_call", targetId: call.id },
      orderBy: { createdAt: "asc" }
    });
    expect(auditActions.map((event: any) => event.action)).toEqual(
      expect.arrayContaining(["service_call.status_changed", "service_call.row_changed"])
    );
  });

  test("자동저장 실패는 패널의 입력값을 유지하고 저장 실패 상태에서 같은 draft로 재시도한다", async ({ page }) => {
    const originalMemo = `E2E22 retry original ${Date.now().toString(36)}`;
    const retryMemo = `E2E22 retry kept ${Date.now().toString(36)}`;
    const call = await createCallRow({ operatingMonthId: seededData.openMonthId, serviceDate: "2032-03-06", memo: originalMemo });

    await login(page, "story22_counter", "Story22!counter");
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-03-06`);

    try {
      const edit = await openPanel(page, call.id);
      const memo = edit.getByLabel("고객/메모");
      await memo.fill(retryMemo);
      await memo.blur();
      const saveState = edit.locator("[data-save-state]");
      await expect(saveState).toHaveAttribute("data-save-state", "saved");

      // 저장 성공은 패널/목록을 다시 불러온다. 그 뒤에 코드를 비활성화해야 화면에는 "카드"가 남아 있고
      // 서버만 거부하는 상태가 되어, 자동저장 실패 경로를 재현할 수 있다.
      await setCodeItemActive("PAYMENT_METHOD", "CARD", false);
      const payment = edit.getByRole("region", { name: "결제" });
      await payment.getByText("카드", { exact: true }).click();

      // 저장 상태 칩은 기호와 글자가 한 요소라 정확히 일치시키지 않는다. 결제 묶음의 계산 줄에는
      // "저장 보류 계산 대기"가 뜬다.
      await expect(saveState).toHaveAttribute("data-save-state", "failed");
      await expect(saveState).toContainText("저장 실패");
      await expect(payment.getByText("저장 보류 계산 대기")).toBeVisible();
      await expect(edit.getByRole("button", { name: "재시도" })).toBeVisible();
      await expect(memo).toHaveValue(retryMemo);

      await setCodeItemActive("PAYMENT_METHOD", "CARD", true);
      await edit.getByRole("button", { name: "재시도" }).click();
      await expect(saveState).toHaveAttribute("data-save-state", "saved");
      await expect(saveState).toContainText("저장됨");

      const saved = await (prisma as any).serviceCall.findUnique({ where: { id: call.id } });
      expect(saved).toMatchObject({ customerMemo: retryMemo, paymentMethodCode: "CARD" });
    } finally {
      // 본문 단언이 실패해도 카드 결제수단 코드를 다시 활성화해 serial 후속 테스트 오염을 막는다.
      await setCodeItemActive("PAYMENT_METHOD", "CARD", true);
    }
  });

  test("잠금 운영월의 기존 콜 패널은 read-only이며 재시도 동작이 노출되지 않는다", async ({ page }) => {
    const memo = `E2E22 locked ${Date.now().toString(36)}`;
    const call = await createCallRow({ operatingMonthId: seededData.lockedMonthId, serviceDate: "2032-04-05", memo });

    await login(page, "story22_counter", "Story22!counter");
    await page.goto(`/calls?operatingMonthId=${seededData.lockedMonthId}&serviceDate=2032-04-05&call=${call.id}`);

    // 잠금 안내는 콜 그리드와 지출 패널 두 곳에 뜬다.
    await expect(page.getByText("잠긴 운영월입니다.").first()).toBeVisible();
    const edit = panel(page);
    await expect(edit).toBeVisible();
    await expect(edit.getByLabel("고객/메모")).toBeDisabled();
    await expect(edit.getByRole("combobox", { name: "상태" })).toBeDisabled();
    await expect(edit.getByRole("button", { name: "재시도" })).toHaveCount(0);
  });

  test("권한이 사라진 사용자의 패널 자동저장은 서버에서 차단되고 안전한 한국어 오류로 저장 실패가 된다", async ({ page }) => {
    const memo = `E2E22 permission ${Date.now().toString(36)}`;
    const draftMemo = `E2E22 permission draft ${Date.now().toString(36)}`;
    const call = await createCallRow({ operatingMonthId: seededData.openMonthId, serviceDate: "2032-03-07", memo });

    await login(page, "story22_counter", "Story22!counter");
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-03-07`);

    await (prisma as any).userAccount.update({
      where: { accountId: "story22_counter" },
      data: { role: "read_only_viewer" }
    });
    try {
      const edit = await openPanel(page, call.id);
      const memoField = edit.getByLabel("고객/메모");
      await memoField.fill(draftMemo);
      await memoField.blur();

      const saveState = edit.locator("[data-save-state]");
      await expect(saveState).toHaveAttribute("data-save-state", "failed");
      await expect(saveState).toContainText("저장 실패");
      await expect(page.getByText("권한이 없습니다.")).toBeVisible();
      await expect(memoField).toHaveValue(draftMemo);

      const saved = await (prisma as any).serviceCall.findUnique({ where: { id: call.id } });
      expect(saved?.customerMemo).toBe(memo);
    } finally {
      // 본문 단언이 실패해도 계정 role을 즉시 복구해 serial 후속 테스트 오염을 막는다.
      await restoreUserAccount("story22_counter", "counter");
    }
  });

  test("non-write role은 /calls direct access와 원장 링크에서 제외된다", async ({ page }) => {
    await login(page, "story22_waiter", "Story22!waiter");
    await page.goto("/calls");

    await expect(page).toHaveURL(/\/rooms$/);
    await expect(page.locator('a[href^="/calls"]')).toHaveCount(0);
  });

  test.afterAll(async () => {
    // 본문 try/finally가 1차 복구를 보장하지만, 방어적으로 기본 상태를 한 번 더 확정한다.
    await setCodeItemActive("PAYMENT_METHOD", "CARD", true);
    await restoreUserAccount("story22_counter", "counter");
    await prisma.$disconnect();
  });
});
