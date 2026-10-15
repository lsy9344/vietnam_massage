import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";

/**
 * 티켓 32: 월 명세서와 인쇄(F05, 스토리 118-121, V08·V11).
 *
 * 지급 확인·일별 정산 계산 자체는 payout-confirmation-service.test.ts·therapist-daily-settlement-service.test.ts
 * 등 메모리 Prisma 테스트가 이미 확인했으므로, 여기서는 이 화면 고유의 것만 본다: 미확정/마감 버전 표시,
 * 마감 버전 스냅샷에는 날짜별 근거가 없다는 안내(다시 계산해 만들어 내지 않음), 인쇄 화면의 필수 항목과
 * print:hidden 숨김, 역할별 접근.
 *
 * 이 DB는 티켓 32 전용(vietnam_aesthetic_t32)이라 다른 스펙과 직원·운영월이 겹칠 걱정이 없다.
 */

const settlementManager = { accountId: "t32_settlement", password: "Ticket32!settlement" };
const counter = { accountId: "t32_counter", password: "Ticket32!counter" };

const monthKey = "2034-05";
const serviceDate = "2034-05-10";

let operatingMonthId = "";
let therapistId = "";
let opsEmployeeId = "";
let settlementManagerAccountId = "";

async function freeEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;
  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({ where: { employeeGroup, sortOrder, NOT: { staffCode } }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }
  throw new Error(`No Ticket 32 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, preferredSortOrder: number) {
  const sortOrder = await freeEmployeeSortOrder(employeeGroup, staffCode, preferredSortOrder);
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, position, isActive: true },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position,
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

async function seedAccount(input: { accountId: string; password: string; role: string; employeeId: string }) {
  const passwordHash = await hash(input.password, argon2idOptions);
  const data = { email: `${input.accountId}@example.local`, passwordHash, role: input.role, employeeId: input.employeeId, isActive: true, lockedUntil: null, failedLoginCount: 0 };
  return (prisma as any).userAccount.upsert({ where: { accountId: input.accountId }, update: data, create: { ...data, accountId: input.accountId } });
}

async function seedStoryData() {
  const operatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { startDate: new Date(`${serviceDate}T00:00:00.000Z`), endDate: new Date(`${serviceDate}T00:00:00.000Z`), status: "작성중" },
    create: { monthKey, startDate: new Date(`${serviceDate}T00:00:00.000Z`), endDate: new Date(`${serviceDate}T00:00:00.000Z`), status: "작성중" }
  });

  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 94320 },
    update: { displayName: "T32 호실", migrationReferenceName: "T32-ROOM", isActive: true },
    create: { displayName: "T32 호실", migrationReferenceName: "T32-ROOM", sortOrder: 94320, isActive: true }
  });
  const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
  const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
  const policyData = {
    name: "T32 A",
    durationMinutes: 60,
    basePrice: 1500000,
    opsCallCredit: 1,
    earcarePoolAmount: 0,
    requiresSecondTherapist: false,
    tvDisplayName: "T32 A",
    effectiveToMonth: null,
    isActive: true
  };
  if (existingPolicy) await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policyData });
  else await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policyData } });

  const settlementEmployee = await seedEmployee("T32-OPS-SET", "T32 정산담당", "OPERATIONS", "정산", 94321);
  const counterEmployee = await seedEmployee("T32-OPS-CNT", "T32 카운터", "OPERATIONS", "카운터", 94322);
  const opsEmployee = await seedEmployee("T32-OPS-STAFF", "T32 운영팀원", "OPERATIONS", "팀장", 94323);
  const therapist = await seedEmployee("T32-THR-001", "T32 마사지사", "THERAPIST", "마사지사", 94324);

  const settlementAccount = await seedAccount({ accountId: settlementManager.accountId, password: settlementManager.password, role: "settlement_manager", employeeId: settlementEmployee.id });
  await seedAccount({ accountId: counter.accountId, password: counter.password, role: "counter", employeeId: counterEmployee.id });

  const existingRate = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId: therapist.id, courseId: course.id, effectiveFromMonth: monthKey } });
  const rateData = { amount: 700000, effectiveToMonth: null, isActive: true };
  if (existingRate) await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rateData });
  else await (prisma as any).therapistCourseRate.create({ data: { therapistId: therapist.id, courseId: course.id, effectiveFromMonth: monthKey, ...rateData } });

  await (prisma as any).timeSlot.upsert({ where: { value: "14:00" }, update: { sortOrder: 94324, isActive: true }, create: { value: "14:00", sortOrder: 94324, isActive: true } });

  await (prisma as any).payoutConfirmationEvent.deleteMany({ where: { operatingMonthId: operatingMonth.id } });
  await (prisma as any).monthlyClosing.deleteMany({ where: { operatingMonthId: operatingMonth.id } });
  const existingCalls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: operatingMonth.id, customerMemo: { startsWith: "T32" } }, select: { id: true } });
  const existingCallIds = existingCalls.map((call: { id: string }) => call.id);
  if (existingCallIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: existingCallIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: existingCallIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: existingCallIds } } });
  }

  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: operatingMonth.id,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: "14:00",
      roomId: room.id,
      courseId: course.id,
      customerMemo: "T32 완료콜",
      status: "VISIT_COMPLETE",
      discountTypeCode: null,
      paymentMethodCode: "CASH",
      confirmationCode: null
    }
  });
  await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: therapist.id, isActive: true } });

  await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: operatingMonth.id, employeeId: therapist.id } });
  await (prisma as any).therapistAttendance.create({
    data: {
      operatingMonthId: operatingMonth.id,
      attendanceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      employeeId: therapist.id,
      checkInMinute: 9 * 60,
      checkOutMinute: 19 * 60,
      standbyMinutes: 600,
      isFullAttendanceRecognized: true,
      isActive: true
    }
  });

  return { operatingMonthId: operatingMonth.id, therapistId: therapist.id, opsEmployeeId: opsEmployee.id, settlementManagerAccountId: settlementAccount.id };
}

test.describe("티켓 32 월 명세서", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const seeded = await seedStoryData();
    operatingMonthId = seeded.operatingMonthId;
    therapistId = seeded.therapistId;
    opsEmployeeId = seeded.opsEmployeeId;
    settlementManagerAccountId = seeded.settlementManagerAccountId;
  });

  test.afterAll(async () => {
    await (prisma as any).monthlyClosing.deleteMany({ where: { operatingMonthId } });
    await (prisma as any).operatingMonth.update({ where: { id: operatingMonthId }, data: { status: "작성중" } });
  });

  test("정산 담당이 미확정 월 명세서를 열면 출근·콜 목록·금액·지급 확인 근거가 보이고 인쇄 버튼이 있다", async ({ page }) => {
    await login(page, settlementManager.accountId, settlementManager.password);
    await setLocaleCookie(page, "ko");
    await page.goto(`/settlements/statement?operatingMonthId=${operatingMonthId}&employee=${therapistId}`);

    await expect(page.getByText("미확정")).toBeVisible();
    await expect(page.getByRole("heading", { name: /T32 마사지사/ })).toBeVisible();
    await expect(page.getByText("09:00–19:00")).toBeVisible();
    // 근거 콜 목록에는 고객 메모가 아니라 예약시각·코스·마사지사·상태만 보인다(민감정보 제외).
    await expect(page.getByText("14:00")).toBeVisible();
    await expect(page.getByRole("button", { name: /인쇄/ })).toBeVisible();
    await expect(page.getByText("이 문서는 수당 명세이며 송금 영수증이 아닙니다.")).toBeVisible();
  });

  test("운영팀 직원도 월 명세서를 볼 수 있다(세 직군 모두 지원)", async ({ page }) => {
    await login(page, settlementManager.accountId, settlementManager.password);
    await setLocaleCookie(page, "ko");
    await page.goto(`/settlements/statement?operatingMonthId=${operatingMonthId}&employee=${opsEmployeeId}`);

    await expect(page.getByRole("heading", { name: /T32 운영팀원/ })).toBeVisible();
    await expect(page.getByText("운영팀").first()).toBeVisible();
  });

  test("카운터 역할은 월 명세서 화면에 들어갈 수 없다(역할 접근 거절)", async ({ page }) => {
    await login(page, counter.accountId, counter.password);
    await page.goto(`/settlements/statement?operatingMonthId=${operatingMonthId}&employee=${therapistId}`);

    // 카운터 접근 거절 시 그 역할의 첫 화면(원장)으로 돌아간다(requireRouteAccess → getRoleLandingPath).
    await expect(page).toHaveURL(/\/calls/);
  });

  test("마감 버전을 보는 중에는 날짜별 근거를 다시 계산해 만들어 내지 않고 '저장되지 않았습니다' 안내로 대신한다", async ({ page }) => {
    await (prisma as any).operatingMonth.update({ where: { id: operatingMonthId }, data: { status: "마감확정" } });
    await (prisma as any).monthlyClosing.create({
      data: {
        operatingMonthId,
        closeVersion: 1,
        confirmedByAccountId: settlementManagerAccountId,
        confirmedAt: new Date("2034-06-01T09:00:00.000Z"),
        snapshotJson: {
          therapists: {
            rows: [
              {
                employeeId: therapistId,
                staffCode: "T32-THR-001",
                displayName: "T32 마사지사",
                totalCallCount: 1,
                monthlySettlementAmount: 700000,
                fullAttendanceDays: 25,
                fullAttendanceAllowanceAmount: 2000000,
                countKingRank: null,
                countKingBonusAmount: 0,
                finalPayoutAmount: 2700000
              }
            ]
          },
          operations: { rows: [] },
          earcare: { rows: [] }
        }
      }
    });

    await login(page, settlementManager.accountId, settlementManager.password);
    await setLocaleCookie(page, "ko");
    await page.goto(`/settlements/statement?operatingMonthId=${operatingMonthId}&employee=${therapistId}`);

    // 버전 고르기 select에도 같은 글자의 option이 있어, 상태 칩(마지막으로 그려지는 쪽)을 가리킨다.
    await expect(page.getByText("마감 버전 1").last()).toBeVisible();
    await expect(page.getByText("2,700,000")).toBeVisible();
    await expect(page.getByText("이 마감 버전에는 해당 근거가 저장되지 않았습니다.")).toBeVisible();
    // 마감 버전 스냅샷에는 날짜별 출근 시각이 없으므로, 미확정일 때 보였던 출근 시각이 다시 계산되어 나타나지 않아야 한다.
    await expect(page.getByText("09:00–19:00")).toHaveCount(0);
  });

  test("인쇄 매체로 바꾸면 도구줄·고르기 폼은 숨고 명세서 본문은 그대로 보인다", async ({ page }) => {
    await login(page, settlementManager.accountId, settlementManager.password);
    await setLocaleCookie(page, "ko");
    await page.goto(`/settlements/statement?operatingMonthId=${operatingMonthId}&employee=${therapistId}`);
    await expect(page.getByRole("button", { name: /인쇄/ })).toBeVisible();

    await page.emulateMedia({ media: "print" });

    await expect(page.getByRole("button", { name: /인쇄/ })).toBeHidden();
    await expect(page.getByRole("heading", { name: /T32 마사지사/ })).toBeVisible();
    await expect(page.getByText(/출력 시각/)).toBeVisible();
  });
});
