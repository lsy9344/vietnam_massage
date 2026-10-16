import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { selectGridOption } from "./support/call-grid";
import { openEmployeePanel } from "./support/settlement";

/**
 * 티켓 36: 전체 흐름 교차 검증. 각 티켓이 이미 확인한 검사(09–35의 `## Comments`)는 되풀이하지 않고,
 * 실제 통합에서만 드러나는 연결과 교차 상황을 확인한다(스펙 V01–V14, 스토리 136–142).
 *
 * - 중심 흐름: 전화로 고객 검색 → 빠른 예약 → 입장·객실 확인 → 완료·수납 → 지급 확인 → 마감·월 명세서.
 * - 지급 확인 뒤 콜 정정 → 지급 재확인 필요 → 마감 거절(→ 해결 뒤 통과까지).
 * - 재오픈 뒤 고객 연결 정정과 재확정(이전 마감 버전 보존).
 *
 * 근무표 변경과 가능 후보(27–29), 겹친 콜과 객실 화면(14), 동시 저장과 응답 유실(15–18)은 각 티켓의
 * 스펙이 이미 충분히 확인했으므로 여기서 다시 쓰지 않는다(이 파일의 "## 반복하지 않은 것" 참고, 보고에도 남긴다).
 *
 * 서버 액션의 역할 재검사(V12)는 모든 새 서버 액션이 `requirePermission`/`requireRouteAccess`를 호출하는지
 * 코드로 전부 대조했고(보고 참고), 그중 기존 E2E가 "호출 시점의 역할 재검사"까지는 다루지 않은 두 가지
 * (payout:write의 재확인, closing:reopen)를 아래 두 교차 시나리오에 자연스럽게 끼워 확인한다(티켓 27의
 * 역할 바꿔치기 기법을 재사용한다).
 */

const admin = { accountId: "t36_admin", password: "Ticket36!admin", staffCode: "E2E-T36-ADMIN", sortOrder: 93600 };
const counter = { accountId: "t36_counter", password: "Ticket36!counter", staffCode: "E2E-T36-COUNTER", sortOrder: 93601 };
const settlementManager = {
  accountId: "t36_settlement",
  password: "Ticket36!settlement",
  staffCode: "E2E-T36-SETTLEMENT",
  sortOrder: 93602
};

const createdOperatingMonthIds: string[] = [];
const createdRoomIds: string[] = [];

async function seedAccount(input: { accountId: string; password: string; staffCode: string; sortOrder: number; role: string }) {
  const employee = await testEmployees.upsert({
    where: { staffCode: input.staffCode },
    update: { displayName: `T36 ${input.role}`, employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: input.staffCode,
      displayName: `T36 ${input.role}`,
      employeeGroup: "OPERATIONS",
      position: input.role,
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: input.sortOrder,
      isActive: true
    }
  });
  const passwordHash = await hash(input.password, argon2idOptions);
  const data = {
    email: `${input.accountId}@example.local`,
    passwordHash,
    role: input.role,
    employeeId: employee.id,
    isActive: true,
    lockedUntil: null,
    failedLoginCount: 0
  };
  return (prisma as any).userAccount.upsert({ where: { accountId: input.accountId }, update: data, create: { ...data, accountId: input.accountId } });
}

async function seedOperatingMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDate = `${monthKey}-01`;
  const endDate = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
  const operatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { status: "작성중", startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date(`${endDate}T00:00:00.000Z`) },
    create: { monthKey, startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date(`${endDate}T00:00:00.000Z`), status: "작성중" }
  });
  createdOperatingMonthIds.push(operatingMonth.id);
  return operatingMonth;
}

async function seedRoom(displayName: string, migrationReferenceName: string, sortOrder: number) {
  const room = await (prisma as any).room.upsert({
    where: { sortOrder },
    update: { displayName, isActive: true },
    create: { displayName, migrationReferenceName, sortOrder, isActive: true }
  });
  createdRoomIds.push(room.id);
  return room;
}

async function seedCoursePolicy(monthKey: string, name: string, basePrice: number) {
  const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
  const policy = {
    name,
    durationMinutes: 60,
    basePrice,
    opsCallCredit: 1,
    earcarePoolAmount: 0,
    requiresSecondTherapist: false,
    tvDisplayName: name,
    effectiveToMonth: monthKey,
    isActive: true
  };
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
  if (existing) {
    await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data: policy });
  } else {
    await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policy } });
  }
  return course;
}

async function seedTherapist(staffCode: string, displayName: string, sortOrder: number, courseId: string, monthKey: string, rateAmount: number) {
  const employee = await testEmployees.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup: "THERAPIST", isActive: true },
    create: {
      staffCode,
      displayName,
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
  const existingRate = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId: employee.id, courseId, effectiveFromMonth: monthKey } });
  const rate = { amount: rateAmount, effectiveToMonth: monthKey, isActive: true };
  if (existingRate) {
    await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
  } else {
    await (prisma as any).therapistCourseRate.create({ data: { therapistId: employee.id, courseId, effectiveFromMonth: monthKey, ...rate } });
  }
  return employee;
}

function quickBookingDialog(page: Page) {
  return page.getByRole("dialog", { name: "빠른 예약" });
}

/** 역할 바꿔치기 기법(티켓 27): 화면은 권한 있는 역할로 열어 둔 채, 호출 시점의 계정 역할만 바꿔 "다른 역할이
 * 이 서버 액션을 직접 호출한" 상황을 흉내낸다. 서버는 요청마다 계정의 지금 역할을 다시 조회하므로
 * 화면이 숨기는 것과는 별개로 서버 재검사가 통하는지 확인할 수 있다. */
async function withTemporaryRole<T>(accountId: string, temporaryRole: string, restoreRole: string, fn: () => Promise<T>): Promise<T> {
  await (prisma as any).userAccount.update({ where: { accountId }, data: { role: temporaryRole } });
  try {
    return await fn();
  } finally {
    await (prisma as any).userAccount.update({ where: { accountId }, data: { role: restoreRole } });
  }
}

test.describe("티켓 36 전체 흐름 교차 검증", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount({ ...admin, role: "administrator" });
    await seedAccount({ ...counter, role: "counter" });
    await seedAccount({ ...settlementManager, role: "settlement_manager" });
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    if (createdOperatingMonthIds.length > 0) {
      const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: { in: createdOperatingMonthIds } }, select: { id: true } });
      const callIds = calls.map((call: { id: string }) => call.id);
      if (callIds.length > 0) {
        await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
        await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
        await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
      }
      await (prisma as any).payoutConfirmationEvent.deleteMany({ where: { operatingMonthId: { in: createdOperatingMonthIds } } });
      await (prisma as any).monthlyClosing.deleteMany({ where: { operatingMonthId: { in: createdOperatingMonthIds } } });
      await (prisma as any).operatingMonth.deleteMany({ where: { id: { in: createdOperatingMonthIds } } });
    }
    await (prisma as any).customer.deleteMany({ where: { name: { startsWith: "T36 " } } });
    for (const roomId of createdRoomIds) {
      await (prisma as any).room.update({ where: { id: roomId }, data: { isActive: false } });
    }
    await prisma.$disconnect();
  });

  test("중심 흐름: 전화로 고객 검색 → 빠른 예약 → 입장·객실 확인 → 완료·수납 → 지급 확인 → 마감·월 명세서", async ({ page }) => {
    const monthKey = "2039-06";
    const serviceDate = "2039-06-15";
    const phone = "0936011001";

    const month = await seedOperatingMonth(monthKey);
    const room = await seedRoom("T36 중심흐름 호실", "T36-CENTRAL-ROOM", 93610);
    const course = await seedCoursePolicy(monthKey, "T36 중심흐름 A", 1_500_000);
    const therapist = await seedTherapist("E2E-T36-CENTRAL-THR", "T36 중심흐름 마사지사", 93611, course.id, monthKey, 300_000);

    // 1) 전화로 고객 검색: 고객 화면에서 먼저 등록한다.
    await login(page, counter.accountId, counter.password);
    await page.goto("/customers");
    await page.getByRole("button", { name: "고객 등록" }).click();
    const createDrawer = page.getByRole("dialog", { name: "고객 등록" });
    await createDrawer.getByLabel("이름").fill("T36 중심흐름 손님");
    await createDrawer.getByLabel("연락처").fill(phone);
    await createDrawer.getByLabel("공통 선호·주의사항").fill("창가 자리 선호");
    await createDrawer.getByRole("button", { name: "고객 등록" }).click();
    await expect(createDrawer).toHaveCount(0);
    const customer = await (prisma as any).customer.findFirstOrThrow({ where: { name: "T36 중심흐름 손님" } });

    // 2) 빠른 예약: 원장에서 패널을 열고 전화번호로 그 고객을 찾아 고른다.
    await page.goto(`/calls?operatingMonthId=${month.id}&serviceDate=${serviceDate}`);
    await page.getByRole("button", { name: "빠른 예약" }).click();
    const dialog = quickBookingDialog(page);
    await expect(dialog).toBeVisible();

    await dialog.getByRole("combobox", { name: "고객 검색" }).fill(phone);
    const customerOption = dialog.getByRole("option", { name: /T36 중심흐름 손님/ });
    await expect(customerOption).toBeVisible({ timeout: 10_000 });
    await customerOption.click();
    await expect(dialog.getByText(`T36 중심흐름 손님 · ${phone}`)).toBeVisible();
    await dialog.getByRole("button", { name: "다음" }).click();

    await dialog.getByLabel("시간").selectOption("15:00");
    await dialog.getByRole("button", { name: "다음" }).click();

    const therapistRow = dialog.locator("[data-availability-row]").filter({ has: page.getByText("T36 중심흐름 마사지사", { exact: true }) });
    const courseButton = therapistRow.getByRole("button", { name: /A 60분 가능/ });
    await expect(courseButton).toBeVisible({ timeout: 10_000 });
    await courseButton.click();
    await dialog.getByRole("button", { name: "다음" }).click();

    await dialog.getByLabel("객실").selectOption({ label: "T36 중심흐름 호실" });
    await dialog.getByLabel("방문별 요청").fill("조용한 자리로 부탁드립니다");
    await dialog.getByRole("button", { name: "다음" }).click();
    await dialog.getByRole("button", { name: "예약 저장" }).click();
    await expect(dialog).toBeHidden();

    const call = await (prisma as any).serviceCall.findFirstOrThrow({ where: { customerId: customer.id } });
    expect(call.status).toBe("RESERVED"); // 빠른 예약 서버 액션은 영문 코드로 저장한다(티켓 20과 같다).
    expect(call.roomId).toBe(room.id);

    // 3) 입장·객실 확인: 상태를 사용중으로 바꾸고 객실 화면에 반영되는지 본다.
    // 운영 빌드에서는 서버 액션 뒤 원장 표 자동 갱신(revalidatePath)이 가끔 늦는다(e2e-environment 메모).
    // 새로고침을 곁들여 다시 시도한다.
    const row = page.locator(`tr[data-service-call-id="${call.id}"]`);
    await expect(async () => {
      await page.reload();
      await expect(row).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await row.scrollIntoViewIfNeeded();
    await selectGridOption(page, row, "상태", "사용중");
    await expect(row.locator('[data-save-state="saved"]')).toBeVisible();

    await page.goto(`/rooms?operatingMonthId=${month.id}&serviceDate=${serviceDate}`);
    const roomCard = page.getByTestId("room-status-card").filter({ hasText: "T36 중심흐름 호실" });
    await expect(async () => {
      await page.reload();
      await expect(roomCard).toContainText("사용중", { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await expect(roomCard).toContainText("T36 중심흐름 A");

    // 4) 완료·수납: 방문완료로 바꾸고 결제수단을 고르면, 같은 날짜의 "하루 수납·지출" 탭 합계에 반영된다.
    await page.goto(`/calls?operatingMonthId=${month.id}&serviceDate=${serviceDate}`);
    await expect(async () => {
      await page.reload();
      await expect(row).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await row.scrollIntoViewIfNeeded();
    await selectGridOption(page, row, "상태", "방문완료");
    await expect(row.locator('[data-save-state="saved"]')).toBeVisible();
    await selectGridOption(page, row, "결제수단", "현금");
    await expect(row.locator('[data-save-state="saved"]')).toBeVisible();

    const cashCards = page.getByLabel("하루 수납 요약");
    await expect(async () => {
      await page.goto(`/calls?operatingMonthId=${month.id}&serviceDate=${serviceDate}&tab=cashbook`);
      await expect(cashCards.locator("div").filter({ hasText: /^결제합계/ })).toContainText("1,500,000 VND", { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await expect(cashCards.locator("div").filter({ hasText: /^순매출/ })).toContainText("1,500,000 VND");

    // 보기 전환(F02, 티켓 19)이 권한을 넓히지 않는다: 카운터가 "수납·정산" 보기로 바꿔도 수당 열은 없다.
    await page.goto(`/calls?operatingMonthId=${month.id}&serviceDate=${serviceDate}&view=settlement`);
    await expect(page.getByRole("columnheader", { name: "마사지사1수당" })).toHaveCount(0);

    // 5) 지급 확인: 정산 담당이 그 콜의 수당을 확인한다.
    await login(page, settlementManager.accountId, settlementManager.password);
    await page.goto(`/settlements?operatingMonthId=${month.id}&serviceDate=${serviceDate}`);
    const therapistPanel = await openEmployeePanel(page, "T36 중심흐름 마사지사");
    await expect(therapistPanel).toContainText("미확인");
    await therapistPanel.getByRole("button", { name: "지급 확인" }).click();
    await expect(therapistPanel).toContainText("확인됨");
    await expect(therapistPanel).toContainText("300,000 VND");

    // 6) 마감·월 명세서: 검토 시작 → 마감 확정(점검 항목에 걸리는 것이 없다) → 월 명세서에서 마감 버전 확인.
    // 운영 빌드에서는 서버 액션이 200으로 끝나도 화면 안내 반영이 가끔 늦는다(e2e-prod-known-failures 메모와 같은 증상).
    // 결과는 DB로 확인한다.
    await page.goto(`/closing?operatingMonthId=${month.id}`);
    await page.getByRole("button", { name: "검토 시작" }).click();
    await expect(async () => {
      const latest = await (prisma as any).operatingMonth.findUnique({ where: { id: month.id }, select: { status: true } });
      expect(latest?.status).toBe("검토중");
    }).toPass({ timeout: 20_000 });
    await page.reload();

    await expect(page.getByText("계산 오류 없음")).toBeVisible();
    await expect(page.getByText("지급 재확인 미처리 없음")).toBeVisible();
    const confirmButton = page.getByRole("button", { name: "마감 확정" });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "지급 스냅샷 확정" }).click();

    await expect(async () => {
      const latest = await (prisma as any).operatingMonth.findUnique({ where: { id: month.id }, select: { status: true } });
      expect(latest?.status).toBe("마감확정");
    }).toPass({ timeout: 20_000 });

    await page.goto(`/settlements/statement?operatingMonthId=${month.id}&employee=${therapist.id}`);
    await expect(page.getByText("마감 버전 1").last()).toBeVisible();
    await expect(page.getByText("300,000").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /인쇄/ })).toBeVisible();
  });

  test("지급 확인 뒤 콜 정정 → 지급 재확인 필요 → 마감 거절(해결 뒤에는 통과한다)", async ({ page }) => {
    const monthKey = "2039-07";
    const serviceDate = "2039-07-10";

    const month = await seedOperatingMonth(monthKey);
    await (prisma as any).operatingMonth.update({ where: { id: month.id }, data: { status: "검토중" } });
    const room = await seedRoom("T36 재확인 호실", "T36-RECONFIRM-ROOM", 93620);
    const course = await seedCoursePolicy(monthKey, "T36 재확인 A", 1_000_000);
    const therapist = await seedTherapist("E2E-T36-RECONFIRM-THR", "T36 재확인 마사지사", 93621, course.id, monthKey, 300_000);

    async function completedCall(memo: string, startTime: string) {
      const created = await (prisma as any).serviceCall.create({
        data: {
          operatingMonthId: month.id,
          serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
          startTime,
          roomId: room.id,
          courseId: course.id,
          customerMemo: memo,
          status: "방문완료"
        }
      });
      await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: created.id, employeeId: therapist.id, assignmentRole: "THERAPIST_1" } });
      return created;
    }

    await completedCall("T36 재확인 콜1", "14:00");

    // 지급 확인: 현재 계산 금액(콜 1건 = 300,000)을 확인한다.
    await login(page, settlementManager.accountId, settlementManager.password);
    await page.goto(`/settlements?operatingMonthId=${month.id}&serviceDate=${serviceDate}`);
    let panel = await openEmployeePanel(page, "T36 재확인 마사지사");
    await expect(panel).toContainText("300,000 VND");
    await panel.getByRole("button", { name: "지급 확인" }).click();
    await expect(panel).toContainText("확인됨");

    // 다른 화면(예: 완료 콜 정정)에서 같은 날 같은 직원의 완료 콜이 늘어 금액이 달라진 상황을 흉내낸다.
    await completedCall("T36 재확인 콜2", "15:00");

    await page.reload();
    panel = await openEmployeePanel(page, "T36 재확인 마사지사");
    await expect(panel).toContainText("지급 재확인 필요");
    await expect(panel).toContainText("600,000 VND");
    await expect(panel).toContainText("300,000 VND");

    // 마감 점검에 지급 재확인 미처리가 걸려 확정이 막힌다.
    await page.goto(`/closing?operatingMonthId=${month.id}`);
    const reconfirmSection = page.getByRole("region", { name: "마감 전 점검" }).locator("section", { hasText: "지급 재확인 미처리" }).first();
    await expect(reconfirmSection).toContainText("1건 해결 필요");
    await expect(page.getByText("계산 오류와 지급 재확인을 먼저 해결하세요.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "마감 확정" })).toBeDisabled();
    expect(await (prisma as any).monthlyClosing.count({ where: { operatingMonthId: month.id } })).toBe(0);

    // V12: payout:write 재검사. 화면은 정산 담당 권한으로 열어 둔 채 호출 시점의 역할만 바꿔, 다른 역할이
    // 이 재확인 서버 액션을 직접 호출한 상황과 같은 서버 재검사를 확인한다(티켓 27의 방식을 재사용).
    await page.goto(`/settlements?operatingMonthId=${month.id}&serviceDate=${serviceDate}`);
    panel = await openEmployeePanel(page, "T36 재확인 마사지사");
    await panel.getByLabel("사유").first().fill("권한 없는 호출 시도");
    await withTemporaryRole(settlementManager.accountId, "counter", "settlement_manager", async () => {
      await panel.getByRole("button", { name: "재확인" }).click();
      await expect(panel.getByText("권한이 없습니다.")).toBeVisible();
    });
    await expect(panel).toContainText("지급 재확인 필요");

    // 정식 권한으로 사유와 함께 재확인하면 현재 금액이 새 기준이 되고 표시가 사라진다.
    await page.reload();
    panel = await openEmployeePanel(page, "T36 재확인 마사지사");
    await panel.getByLabel("사유").first().fill("두 번째 콜 추가로 다시 확인");
    await panel.getByRole("button", { name: "재확인" }).click();
    await expect(panel).toContainText("확인됨");
    await expect(panel).not.toContainText("지급 재확인 필요");

    // 해결됐으니 마감 확정이 통과한다.
    await page.goto(`/closing?operatingMonthId=${month.id}`);
    await expect(page.getByText("지급 재확인 미처리 없음")).toBeVisible();
    const confirmButton = page.getByRole("button", { name: "마감 확정" });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "지급 스냅샷 확정" }).click();

    await expect(async () => {
      const latest = await (prisma as any).operatingMonth.findUnique({ where: { id: month.id }, select: { status: true } });
      expect(latest?.status).toBe("마감확정");
    }).toPass({ timeout: 20_000 });
  });

  test("재오픈 뒤 고객 연결 정정과 재확정: 이전 마감 버전은 그대로 보존된다", async ({ page }) => {
    const monthKey = "2039-08";
    const serviceDate = "2039-08-05";

    const month = await seedOperatingMonth(monthKey);
    const room = await seedRoom("T36 재오픈 호실", "T36-REOPEN-ROOM", 93630);
    const course = await seedCoursePolicy(monthKey, "T36 재오픈 A", 1_000_000);
    const therapist = await seedTherapist("E2E-T36-REOPEN-THR", "T36 재오픈 마사지사", 93631, course.id, monthKey, 300_000);

    const originalCustomer = await (prisma as any).customer.create({ data: { name: "T36 재오픈 원고객", phone: "0936080001" } });
    const newCustomer = await (prisma as any).customer.create({ data: { name: "T36 재오픈 새고객", phone: "0936080002" } });

    const call = await (prisma as any).serviceCall.create({
      data: {
        operatingMonthId: month.id,
        serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
        startTime: "16:00",
        roomId: room.id,
        courseId: course.id,
        customerId: originalCustomer.id,
        customerMemo: "T36 재오픈 콜",
        status: "방문완료"
      }
    });
    await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: call.id, employeeId: therapist.id, assignmentRole: "THERAPIST_1" } });

    // 1) 마감 확정으로 closeVersion 1을 만든다.
    await login(page, admin.accountId, admin.password);
    await page.goto(`/closing?operatingMonthId=${month.id}`);
    await page.getByRole("button", { name: "검토 시작" }).click();
    await expect(async () => {
      const latest = await (prisma as any).operatingMonth.findUnique({ where: { id: month.id }, select: { status: true } });
      expect(latest?.status).toBe("검토중");
    }).toPass({ timeout: 20_000 });
    await page.reload();
    await page.getByRole("button", { name: "마감 확정" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "지급 스냅샷 확정" }).click();
    await expect(async () => {
      const latest = await (prisma as any).operatingMonth.findUnique({ where: { id: month.id }, select: { status: true } });
      expect(latest?.status).toBe("마감확정");
    }).toPass({ timeout: 20_000 });
    const firstClosing = await (prisma as any).monthlyClosing.findFirstOrThrow({ where: { operatingMonthId: month.id, closeVersion: 1 } });

    // 2) 마감확정 상태에서는 고객 연결 정정이 잠겨 있다(티켓 25와 같은 안내).
    await page.goto(`/calls?operatingMonthId=${month.id}&serviceDate=${serviceDate}&call=${call.id}`);
    const panel = page.getByRole("complementary", { name: /^콜 상세/ });
    await expect(panel.getByText("마감확정 또는 잠금 운영월입니다. 관리자가 재오픈해야 고객 연결을 정정할 수 있습니다.")).toBeVisible();

    // V12: closing:reopen 재검사. 관리자 화면을 열어 둔 채 호출 시점의 역할만 정산 담당으로 바꿔, 재오픈
    // 권한이 없는 역할이 이 서버 액션을 직접 호출해도 거절되는지 확인한다(정산 담당은 재오픈 권한이 없다, 스토리 134).
    await page.goto(`/closing?operatingMonthId=${month.id}`);
    await page.getByLabel("재오픈 사유").fill("권한 없는 호출 시도");
    await withTemporaryRole(admin.accountId, "settlement_manager", "administrator", async () => {
      await page.getByRole("button", { name: "재오픈" }).click();
      await expect(page.getByText("권한이 없습니다.")).toBeVisible();
    });
    expect(await (prisma as any).operatingMonth.findUnique({ where: { id: month.id }, select: { status: true } })).toMatchObject({ status: "마감확정" });

    // 3) 관리자가 정식으로 재오픈한다.
    await page.goto(`/closing?operatingMonthId=${month.id}`);
    await page.getByLabel("재오픈 사유").fill("고객 연결 정정을 위해 재오픈합니다");
    await page.getByRole("button", { name: "재오픈" }).click();
    await expect(async () => {
      const latest = await (prisma as any).operatingMonth.findUnique({ where: { id: month.id }, select: { status: true } });
      expect(latest?.status).toBe("검토중");
    }).toPass({ timeout: 20_000 });

    // 4) 재오픈 뒤에는 고객 연결 정정이 가능하다.
    await page.goto(`/calls?operatingMonthId=${month.id}&serviceDate=${serviceDate}&call=${call.id}`);
    await expect(panel.getByText("지금 연결")).toBeVisible();
    await panel.getByRole("combobox", { name: "새로 연결할 고객 검색" }).fill("T36 재오픈 새고객");
    await panel.getByRole("option", { name: "T36 재오픈 새고객" }).click();
    await panel.getByLabel("정정 사유").fill("전화번호 착오로 다른 고객에 연결되어 정정합니다");
    await panel.getByRole("button", { name: "고객 연결 정정" }).click();
    await expect(panel.getByText("고객 연결을 정정했습니다.")).toBeVisible();

    await expect.poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: call.id } })).customerId).toBe(newCustomer.id);
    const afterCorrection = await (prisma as any).serviceCall.findUnique({ where: { id: call.id } });
    expect(afterCorrection.customerMemo).toBe("T36 재오픈 콜"); // 고객/메모는 바뀌지 않는다.

    const correctionAudit = await (prisma as any).auditLog.findFirst({
      where: { action: "service_call.customer_link_corrected", targetType: "service_call", targetId: call.id },
      orderBy: { createdAt: "desc" }
    });
    expect(correctionAudit?.afterValue).toMatchObject({ customerId: newCustomer.id });
    expect(correctionAudit?.reason).toBe("전화번호 착오로 다른 고객에 연결되어 정정합니다");

    // 5) 재확정하면 새 버전이 만들어지고, 이전 버전의 스냅샷은 그대로 남는다.
    await page.goto(`/closing?operatingMonthId=${month.id}`);
    await page.getByRole("button", { name: "마감 확정" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "지급 스냅샷 확정" }).click();
    await expect(async () => {
      const count = await (prisma as any).monthlyClosing.count({ where: { operatingMonthId: month.id } });
      expect(count).toBe(2);
    }).toPass({ timeout: 20_000 });

    const firstClosingAfterReconfirm = await (prisma as any).monthlyClosing.findUniqueOrThrow({ where: { id: firstClosing.id } });
    expect(firstClosingAfterReconfirm.snapshotJson).toEqual(firstClosing.snapshotJson);
    expect(firstClosingAfterReconfirm.confirmedAt).toEqual(firstClosing.confirmedAt);

    await page.goto(`/settlements/statement?operatingMonthId=${month.id}&employee=${therapist.id}`);
    await expect(page.getByText("마감 버전 2").last()).toBeVisible();
  });
});
