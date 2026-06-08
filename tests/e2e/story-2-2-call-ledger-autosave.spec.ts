import { expect, test, type Page } from "@playwright/test";
import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vietnam_massage";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);
const argon2idOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

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
  earcareEmployeeId: string;
  counterAccountDbId: string;
};

let seededData: SeededData;

async function login(page: Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(accountId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

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

async function upsertCodeItem(codeType: string, code: string, displayName: string, sortOrder: number, isActive = true) {
  await (prisma as any).codeItem.upsert({
    where: { codeType_code: { codeType, code } },
    update: { displayName, sortOrder, isActive },
    create: { codeType, code, displayName, sortOrder, isSystemDefault: false, isActive }
  });
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: {
      displayName,
      employeeGroup,
      position: employeeGroup === "EARCARE" ? "귀케어" : "마사지사",
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
      position: employeeGroup === "EARCARE" ? "귀케어" : "마사지사",
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
        opsCallCredit: 1,
        earcarePoolAmount: 0,
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
        opsCallCredit: 1,
        earcarePoolAmount: 0,
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
  const earcare = await seedEmployee("E2E22-EAR-001", "E2E22 귀케어1", "EARCARE", 92201);

  await (prisma as any).timeSlot.upsert({
    where: { value: "12:00" },
    update: { sortOrder: 92201, isActive: true },
    create: { value: "12:00", sortOrder: 92201, isActive: true }
  });
  await upsertCodeItem("SERVICE_STATUS", "예약", "예약", 92201);
  await upsertCodeItem("SERVICE_STATUS", "사용중", "사용중", 92202);
  await upsertCodeItem("SERVICE_STATUS", "취소", "취소", 92203);
  await upsertCodeItem("DISCOUNT_TYPE", "생일자", "생일자", 92201);
  await upsertCodeItem("PAYMENT_METHOD", "현금", "현금", 92201);
  await upsertCodeItem("PAYMENT_METHOD", "카드", "카드", 92202);
  await upsertCodeItem("CONFIRMATION", "Y", "Y", 92201);

  const counter = await (prisma as any).userAccount.findUniqueOrThrow({ where: { accountId: "story22_counter" } });
  return {
    openMonthId: openMonth.id,
    lockedMonthId: lockedMonth.id,
    roomId: room.id,
    courseId: course.id,
    therapist1Id: therapist1.id,
    therapist2Id: therapist2.id,
    earcareEmployeeId: earcare.id,
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
      status: input.status ?? "예약",
      discountTypeCode: null,
      paymentMethodCode: "현금",
      note: "E2E22 초기 비고",
      confirmationCode: "Y"
    }
  });
  await (prisma as any).serviceCallAssignment.createMany({
    data: [
      { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: seededData.therapist1Id },
      { serviceCallId: call.id, assignmentRole: "THERAPIST_2", employeeId: seededData.therapist2Id },
      { serviceCallId: call.id, assignmentRole: "EARCARE", employeeId: seededData.earcareEmployeeId }
    ]
  });
  return call;
}

function rowByText(page: Page, text: string) {
  return page.getByRole("row", { name: new RegExp(text) });
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

  test("counter는 기존 행을 blur로 자동저장하고 상태 변경 이력과 감사 로그를 남긴다", async ({ page }) => {
    const originalMemo = `E2E22 autosave original ${Date.now().toString(36)}`;
    const updatedMemo = `E2E22 autosave updated ${Date.now().toString(36)}`;
    const call = await createCallRow({ operatingMonthId: seededData.openMonthId, serviceDate: "2032-03-05", memo: originalMemo });

    await login(page, "story22_counter", "Story22!counter");
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-03-05`);

    const row = rowByText(page, originalMemo);
    await expect(row).toBeVisible();
    await row.getByLabel("고객/메모").fill(updatedMemo);
    await row.getByLabel("고객/메모").blur();
    await expect(rowByText(page, updatedMemo).getByText(/저장중|저장됨/)).toBeVisible();
    await expect(rowByText(page, updatedMemo).getByText("저장됨")).toBeVisible();

    const updatedRow = rowByText(page, updatedMemo);
    await updatedRow.getByLabel("상태").selectOption("사용중");
    await updatedRow.getByLabel("상태").blur();
    await expect(updatedRow.getByText("저장됨")).toBeVisible();
    await updatedRow.getByLabel("결제수단").selectOption("카드");
    await updatedRow.getByLabel("결제수단").blur();
    await expect(updatedRow.getByText("저장됨")).toBeVisible();

    await expect
      .poll(async () => {
        const saved = await (prisma as any).serviceCall.findUnique({ where: { id: call.id } });
        return `${saved?.customerMemo}:${saved?.status}:${saved?.paymentMethodCode}`;
      })
      .toBe(`${updatedMemo}:사용중:카드`);

    const histories = await (prisma as any).serviceCallStatusHistory.findMany({
      where: { serviceCallId: call.id },
      orderBy: { changedAt: "asc" }
    });
    expect(histories).toHaveLength(1);
    expect(histories[0]).toMatchObject({
      previousStatus: "예약",
      newStatus: "사용중",
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

  test("자동저장 실패는 입력값을 유지하고 저장 보류 상태에서 같은 draft로 재시도한다", async ({ page }) => {
    const originalMemo = `E2E22 retry original ${Date.now().toString(36)}`;
    const retryMemo = `E2E22 retry kept ${Date.now().toString(36)}`;
    const call = await createCallRow({ operatingMonthId: seededData.openMonthId, serviceDate: "2032-03-06", memo: originalMemo });

    await login(page, "story22_counter", "Story22!counter");
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-03-06`);

    await upsertCodeItem("PAYMENT_METHOD", "카드", "카드", 92202, false);
    const row = rowByText(page, originalMemo);
    await row.getByLabel("고객/메모").fill(retryMemo);
    await row.getByLabel("결제수단").selectOption("카드");
    await row.getByLabel("결제수단").blur();

    await expect(rowByText(page, retryMemo).getByText("저장 보류")).toBeVisible();
    await expect(rowByText(page, retryMemo).getByRole("button", { name: /재시도|retry/i })).toBeVisible();
    await expect(rowByText(page, retryMemo).getByLabel("고객/메모")).toHaveValue(retryMemo);

    await upsertCodeItem("PAYMENT_METHOD", "카드", "카드", 92202, true);
    await rowByText(page, retryMemo).getByRole("button", { name: /재시도|retry/i }).click();
    await expect(rowByText(page, retryMemo).getByText("저장됨")).toBeVisible();

    const saved = await (prisma as any).serviceCall.findUnique({ where: { id: call.id } });
    expect(saved).toMatchObject({ customerMemo: retryMemo, paymentMethodCode: "카드" });
  });

  test("잠금 운영월의 기존 콜 행은 read-only이며 autosave retry 동작이 노출되지 않는다", async ({ page }) => {
    const memo = `E2E22 locked ${Date.now().toString(36)}`;
    await createCallRow({ operatingMonthId: seededData.lockedMonthId, serviceDate: "2032-04-05", memo });

    await login(page, "story22_counter", "Story22!counter");
    await page.goto(`/calls?operatingMonthId=${seededData.lockedMonthId}&serviceDate=2032-04-05`);

    const row = rowByText(page, memo);
    await expect(page.getByText("잠긴 운영월입니다.")).toBeVisible();
    await expect(row.getByLabel("고객/메모")).toBeDisabled();
    await expect(row.getByLabel("상태")).toBeDisabled();
    await expect(row.getByRole("button", { name: /재시도|retry/i })).toHaveCount(0);
  });

  test("권한이 사라진 사용자의 autosave는 서버에서 차단되고 안전한 한국어 오류로 보류된다", async ({ page }) => {
    const memo = `E2E22 permission ${Date.now().toString(36)}`;
    const draftMemo = `E2E22 permission draft ${Date.now().toString(36)}`;
    const call = await createCallRow({ operatingMonthId: seededData.openMonthId, serviceDate: "2032-03-07", memo });

    await login(page, "story22_counter", "Story22!counter");
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-03-07`);

    await (prisma as any).userAccount.update({
      where: { accountId: "story22_counter" },
      data: { role: "read_only_viewer" }
    });
    const row = rowByText(page, memo);
    await row.getByLabel("고객/메모").fill(draftMemo);
    await row.getByLabel("고객/메모").blur();

    await expect(rowByText(page, draftMemo).getByText("저장 보류")).toBeVisible();
    await expect(page.getByText("권한이 없습니다.")).toBeVisible();
    await expect(rowByText(page, draftMemo).getByLabel("고객/메모")).toHaveValue(draftMemo);

    const saved = await (prisma as any).serviceCall.findUnique({ where: { id: call.id } });
    expect(saved?.customerMemo).toBe(memo);

    await (prisma as any).userAccount.update({
      where: { accountId: "story22_counter" },
      data: { role: "counter" }
    });
  });

  test("non-write role은 /calls direct access와 sidebar 콜 원장에서 제외된다", async ({ page }) => {
    await login(page, "story22_waiter", "Story22!waiter");
    await page.goto("/calls");

    await expect(page).toHaveURL(/\/rooms$/);
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: /콜\/예약 입력 원장/ })).toHaveCount(0);
  });

  test.afterAll(async () => {
    await upsertCodeItem("PAYMENT_METHOD", "카드", "카드", 92202, true);
    await (prisma as any).userAccount.update({
      where: { accountId: "story22_counter" },
      data: { role: "counter", isActive: true, lockedUntil: null, failedLoginCount: 0 }
    });
    await prisma.$disconnect();
  });
});
