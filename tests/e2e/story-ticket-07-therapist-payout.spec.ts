import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { confirmPayoutConfirmation } from "@/modules/settlements/payout-confirmation-service";
import { listTherapistDailySettlements } from "@/modules/settlements/therapist-daily-settlement-service";
import { prisma } from "./support/db";
import { argon2idOptions, login, setLocaleCookie } from "./support/auth";

/**
 * 티켓 07: 수당 탭 — 날짜별, 이번 달, 확정 월 명세서(스펙 D19–D21, M8–M10, ADR 0004·0010).
 *
 * 계산 자체(코스 수당, 지급 확인 상태 전이, 월 마감 미리보기 순위)는 각 서비스의 메모리 Prisma
 * 단위 테스트가 이미 확인했으므로, 여기서는 이 화면 고유의 것만 본다: 미확정/마감 금액의 분리 표시,
 * 날짜별 지급 확인 세 상태, 코스 수당 없는 콜의 "금액 확인 중", 그리고 가장 중요한 것 —
 * 함께한 Therapist·다른 Therapist의 이름과 금액이 어디에도 없다는 것(M6, M9).
 *
 * 월은 먼 고정 달(2042-07 미확정, 2042-08 마감확정)을 써서 "지금" 영업일에 매이지 않는다
 * (05가 아직 없는 이 시점엔 그래도 되고, 다른 스펙과 날짜가 겹치지 않는다).
 *
 * 이 DB는 티켓 07 전용(vietnam_aesthetic_th07)이라 다른 스펙과 직원·운영월이 겹칠 걱정이 없다.
 */

const mineAccount = { accountId: "story07_mine", password: "Story07!mine" };

const draftMonthKey = "2042-07";
const draftDate = "2042-07-10";
const closedMonthKey = "2042-08";

const RATE_AMOUNT = 123000;

type Seeded = {
  draftOperatingMonthId: string;
  closedOperatingMonthId: string;
  mineEmployeeId: string;
  adminAccountId: string;
};

let seeded: Seeded;

function monthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  return { startDate, endDate };
}

async function ensureOperatingMonth(monthKey: string, status: string) {
  const { startDate, endDate } = monthRange(monthKey);
  return (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { status, startDate, endDate },
    create: { monthKey, startDate, endDate, status }
  });
}

async function seedEmployee(staffCode: string, displayName: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup: "THERAPIST", employmentStatus: "재직", sortOrder, isActive: true },
    create: {
      staffCode,
      displayName,
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: null,
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

async function seedAuthAccount(input: { accountId: string; password: string; employeeId: string }) {
  const passwordHash = await hash(input.password, argon2idOptions);
  return (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: { passwordHash, role: "therapist", employeeId: input.employeeId, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      email: `${input.accountId}@example.local`,
      accountId: input.accountId,
      passwordHash,
      role: "therapist",
      employeeId: input.employeeId,
      isActive: true
    }
  });
}

/** 지급 확인·월마감 스냅샷의 행위자(UserAccount FK)로만 쓰는 관리자 계정. 로그인하지 않는다. */
async function seedAdminAccount(accountId: string) {
  const passwordHash = await hash("E2E07!admin", argon2idOptions);
  return (prisma as any).userAccount.upsert({
    where: { accountId },
    update: { passwordHash, role: "administrator", isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: { email: `${accountId}@example.local`, accountId, passwordHash, role: "administrator", isActive: true }
  });
}

async function createCall(input: {
  operatingMonthId: string;
  serviceDate: string;
  startTime: string;
  roomId: string;
  courseId: string;
  therapistIds: string[];
}) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: input.operatingMonthId,
      serviceDate: new Date(`${input.serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      roomId: input.roomId,
      courseId: input.courseId,
      status: "방문완료",
      discountTypeCode: null,
      paymentMethodCode: null,
      confirmationCode: null
    }
  });
  for (const [index, employeeId] of input.therapistIds.entries()) {
    await (prisma as any).serviceCallAssignment.create({
      data: { serviceCallId: call.id, assignmentRole: index === 0 ? "THERAPIST_1" : "THERAPIST_2", employeeId, isActive: true }
    });
  }
  return call;
}

async function seedStoryData(): Promise<Seeded> {
  const mine = await seedEmployee("E2E07-THR-001", "E2E07 내 Therapist", 98070);
  const partner = await seedEmployee("E2E07-THR-002", "E2E07 짝꿍 Therapist", 98071);
  const other = await seedEmployee("E2E07-THR-003", "E2E07 다른 Therapist", 98072);
  await seedAuthAccount({ accountId: mineAccount.accountId, password: mineAccount.password, employeeId: mine.id });
  const admin = await seedAdminAccount("e2e07_admin");

  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 98070 },
    update: { displayName: "E2E07 호실", migrationReferenceName: "E2E07-ROOM", isActive: true },
    create: { displayName: "E2E07 호실", migrationReferenceName: "E2E07-ROOM", sortOrder: 98070, isActive: true }
  });

  // E07A: 코스 수당이 있는 코스.
  const courseA = await (prisma as any).course.upsert({ where: { code: "E07A" }, update: { isActive: true }, create: { code: "E07A", isActive: true } });
  const existingPolicyA = await (prisma as any).coursePolicy.findFirst({ where: { courseId: courseA.id, effectiveFromMonth: "2000-01" } });
  const policyData = {
    name: "E2E07 코스A",
    durationMinutes: 60,
    basePrice: 500000,
    requiresSecondTherapist: false,
    tvDisplayName: "E2E07 코스A",
    effectiveToMonth: null,
    isActive: true
  };
  if (existingPolicyA) await (prisma as any).coursePolicy.update({ where: { id: existingPolicyA.id }, data: policyData });
  else await (prisma as any).coursePolicy.create({ data: { courseId: courseA.id, effectiveFromMonth: "2000-01", ...policyData } });

  const existingRate = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId: mine.id, courseId: courseA.id, effectiveFromMonth: "2000-01" } });
  const rateData = { amount: RATE_AMOUNT, effectiveToMonth: null, isActive: true };
  if (existingRate) await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rateData });
  else await (prisma as any).therapistCourseRate.create({ data: { therapistId: mine.id, courseId: courseA.id, effectiveFromMonth: "2000-01", ...rateData } });

  // E07B: 코스 정책 자체가 없는 코스("금액 확인 중" 케이스).
  const courseB = await (prisma as any).course.upsert({ where: { code: "E07B" }, update: { isActive: true }, create: { code: "E07B", isActive: true } });

  const draftOperatingMonth = await ensureOperatingMonth(draftMonthKey, "작성중");
  const closedOperatingMonth = await ensureOperatingMonth(closedMonthKey, "마감확정");

  // 기존 실행에서 남은 콜을 먼저 지운다(재실행 대비).
  const previousCalls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: draftOperatingMonth.id, roomId: room.id }, select: { id: true } });
  const previousCallIds = previousCalls.map((call: { id: string }) => call.id);
  if (previousCallIds.length > 0) {
    await (prisma as any).payoutConfirmationEvent.deleteMany({ where: { employeeId: mine.id, operatingMonthId: draftOperatingMonth.id } });
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: previousCallIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: previousCallIds } } });
  }
  await (prisma as any).monthlyClosing.deleteMany({ where: { operatingMonthId: closedOperatingMonth.id } });

  // 내 콜 1: 코스A 단독(수당 적용).
  await createCall({ operatingMonthId: draftOperatingMonth.id, serviceDate: draftDate, startTime: "09:00", roomId: room.id, courseId: courseA.id, therapistIds: [mine.id] });
  // 내 콜 2: 코스B 단독(코스 수당 없음 → 금액 확인 중).
  await createCall({ operatingMonthId: draftOperatingMonth.id, serviceDate: draftDate, startTime: "11:00", roomId: room.id, courseId: courseB.id, therapistIds: [mine.id] });
  // 내 콜 3: 코스A, 짝꿍 Therapist와 함께(짝꿍 이름이 수당 탭에 새면 안 된다).
  await createCall({ operatingMonthId: draftOperatingMonth.id, serviceDate: draftDate, startTime: "14:00", roomId: room.id, courseId: courseA.id, therapistIds: [mine.id, partner.id] });
  // 다른 Therapist만의 콜(그 사람의 이름·수당이 내 수당 탭에 보이면 안 된다).
  await createCall({ operatingMonthId: draftOperatingMonth.id, serviceDate: draftDate, startTime: "16:00", roomId: room.id, courseId: courseA.id, therapistIds: [other.id] });

  // 마감확정 달(2042-08)의 월마감 스냅샷: 다른 두 Therapist(1·3위)는 실제 직원을 만들지 않고 스냅샷
  // JSON에만 존재한다 — 숫자만 옮겨지는지 보는 것이 목적이라 실제 계정이 필요 없다.
  await (prisma as any).monthlyClosing.create({
    data: {
      operatingMonthId: closedOperatingMonth.id,
      closeVersion: 1,
      confirmedByAccountId: admin.id,
      confirmedAt: new Date("2042-09-01T00:00:00.000Z"),
      snapshotJson: {
        therapists: {
          rows: [
            {
              employeeId: "e2e07-ghost-rank1",
              staffCode: "E2E07-GHOST-1",
              displayName: "E2E07 보이면 안 되는 1위",
              totalCallCount: 55,
              monthlySettlementAmount: 0,
              fullAttendanceDays: null,
              fullAttendanceAllowanceAmount: 0,
              countKingRank: 1,
              countKingBonusAmount: 5000000,
              finalPayoutAmount: 9999999
            },
            {
              employeeId: mine.id,
              staffCode: "E2E07-THR-001",
              displayName: "E2E07 내 Therapist",
              totalCallCount: 45,
              monthlySettlementAmount: 1800000,
              fullAttendanceDays: 22,
              fullAttendanceAllowanceAmount: 2000000,
              countKingRank: 2,
              countKingBonusAmount: 3000000,
              finalPayoutAmount: 6800000
            },
            {
              employeeId: "e2e07-ghost-rank3",
              staffCode: "E2E07-GHOST-3",
              displayName: "E2E07 보이면 안 되는 3위",
              totalCallCount: 41,
              monthlySettlementAmount: 0,
              fullAttendanceDays: null,
              fullAttendanceAllowanceAmount: 0,
              countKingRank: 3,
              countKingBonusAmount: 1000000,
              finalPayoutAmount: 8888888
            }
          ]
        },
        operations: { rows: [] }
      }
    }
  });

  return { draftOperatingMonthId: draftOperatingMonth.id, closedOperatingMonthId: closedOperatingMonth.id, mineEmployeeId: mine.id, adminAccountId: admin.id };
}

async function cleanupStoryData() {
  const room = await (prisma as any).room.findUnique({ where: { sortOrder: 98070 } });
  if (room) {
    const calls = await (prisma as any).serviceCall.findMany({ where: { roomId: room.id }, select: { id: true } });
    const callIds = calls.map((call: { id: string }) => call.id);
    if (callIds.length > 0) {
      await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
      await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
    }
  }
  await (prisma as any).payoutConfirmationEvent.deleteMany({ where: { employeeId: seeded.mineEmployeeId } });
  await (prisma as any).monthlyClosing.deleteMany({ where: { operatingMonthId: seeded.closedOperatingMonthId } });
  await (prisma as any).userAccount.updateMany({ where: { accountId: mineAccount.accountId }, data: { isActive: false, lockedUntil: null, failedLoginCount: 0 } });
  await (prisma as any).userAccount.updateMany({ where: { accountId: "e2e07_admin" }, data: { isActive: false, lockedUntil: null, failedLoginCount: 0 } });
  await (prisma as any).employee.updateMany({ where: { staffCode: { startsWith: "E2E07-" } }, data: { isActive: false } });
  await (prisma as any).operatingMonth.update({ where: { id: seeded.draftOperatingMonthId }, data: { status: "작성중" } });
}

test.describe("티켓 07 수당 탭", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    seeded = await seedStoryData();
  });

  test.afterAll(async () => {
    await cleanupStoryData();
    await prisma.$disconnect();
  });

  test("미확정 달: 날짜별 코스 수당·금액 확인 중이 보이고, 짝꿍·다른 Therapist의 이름과 금액은 어디에도 없다", async ({ page }) => {
    await login(page, mineAccount.accountId, mineAccount.password);
    await setLocaleCookie(page, "ko");
    await page.goto(`/therapist/payout?operatingMonthId=${seeded.draftOperatingMonthId}`);

    await expect(page.getByRole("heading", { name: "수당", level: 1 })).toBeVisible();
    await expect(page.getByText("계산 중(미확정)").first()).toBeVisible();
    await expect(page.getByText(draftDate)).toBeVisible();
    await expect(page.getByText(RATE_AMOUNT.toLocaleString("ko-KR")).first()).toBeVisible();
    await expect(page.getByText("금액 확인 중")).toBeVisible();
    // StatusIndicator 칩은 기호(○)와 글자가 같은 요소라 exact 일치는 걸리지 않는다(부분 일치로 찾는다).
    await expect(page.getByText("아직").first()).toBeVisible();

    const bodyText = (await page.locator("body").innerText()).normalize();
    expect(bodyText).not.toContain("E2E07 짝꿍 Therapist");
    expect(bodyText).not.toContain("E2E07 다른 Therapist");
  });

  test("지급 확인: 확인하면 '확인됨', 그 뒤 콜이 추가돼 금액이 바뀌면 '관리자 확인 중'이다(ADR 0004)", async ({ page }) => {
    const before = await listTherapistDailySettlements({ operatingMonthId: seeded.draftOperatingMonthId, serviceDate: draftDate });
    const myRowBefore = before.settlements.find((row) => row.employeeId === seeded.mineEmployeeId);
    if (!myRowBefore) throw new Error("E2E07: 확인 대상 정산 행을 찾지 못했다");

    await confirmPayoutConfirmation({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: seeded.draftOperatingMonthId,
      serviceDate: draftDate,
      employeeId: seeded.mineEmployeeId,
      amount: myRowBefore.totalCommissionAmount,
      actorId: seeded.adminAccountId
    });

    await login(page, mineAccount.accountId, mineAccount.password);
    await setLocaleCookie(page, "ko");
    await page.goto(`/therapist/payout?operatingMonthId=${seeded.draftOperatingMonthId}`);
    await expect(page.getByText("확인됨").first()).toBeVisible();

    // 확인 뒤에 콜이 하나 더 생겨 그날 금액이 바뀌면 지급 재확인 필요다.
    const room = await (prisma as any).room.findUnique({ where: { sortOrder: 98070 } });
    const courseA = await (prisma as any).course.findUnique({ where: { code: "E07A" } });
    await createCall({ operatingMonthId: seeded.draftOperatingMonthId, serviceDate: draftDate, startTime: "18:00", roomId: room.id, courseId: courseA.id, therapistIds: [seeded.mineEmployeeId] });

    await page.goto(`/therapist/payout?operatingMonthId=${seeded.draftOperatingMonthId}`);
    await expect(page.getByText("관리자 확인 중").first()).toBeVisible();
  });

  test("마감확정 달: 확정 금액과 순위·기준선 숫자만 보이고, 1·3위 이름·금액은 어디에도 없다", async ({ page }) => {
    await login(page, mineAccount.accountId, mineAccount.password);
    await setLocaleCookie(page, "ko");
    await page.goto(`/therapist/payout?operatingMonthId=${seeded.closedOperatingMonthId}`);

    await expect(page.getByText("1차 마감 확정")).toBeVisible();
    await expect(page.getByText("6,800,000").first()).toBeVisible();
    await expect(page.getByText("2위", { exact: true }).first()).toBeVisible();
    // 기준선: 1위 55콜 · 2위(나) 45콜 · 3위 41콜 — 숫자만 보인다.
    await expect(page.getByText("1위 55콜")).toBeVisible();
    await expect(page.getByText("3위 41콜")).toBeVisible();
    // 마감 버전에는 날짜별 콜 근거가 저장되지 않는다는 안내가 보인다.
    await expect(page.getByText("이 마감 버전에는 해당 근거가 저장되지 않았습니다.")).toBeVisible();

    const bodyText = (await page.locator("body").innerText()).normalize();
    expect(bodyText).not.toContain("E2E07 보이면 안 되는 1위");
    expect(bodyText).not.toContain("E2E07 보이면 안 되는 3위");
    expect(bodyText).not.toContain("9999999");
    expect(bodyText).not.toContain("8888888");
    expect(bodyText).not.toContain("e2e07-ghost");
  });

  test("390px 폭에서 가로 스크롤이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, mineAccount.accountId, mineAccount.password);
    await setLocaleCookie(page, "ko");
    await page.goto(`/therapist/payout?operatingMonthId=${seeded.draftOperatingMonthId}`);
    await expect(page.getByText(draftDate)).toBeVisible();
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalScroll).toBe(false);
  });
});
