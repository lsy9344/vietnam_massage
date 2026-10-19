import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 빠른 예약 카드의 Therapist별 "한 것 +예약"(한 것은 사용중·청소중·방문완료, 예약은 예약 상태)과, 같은 콜 수로 그리는
// 원장 Therapist 현황 줄(1018 티켓 04, "완료"는 청소중·방문완료). 현황 줄 자체의 대상·정렬·동작은
// story-1018-04-header-cards-therapist-strip.spec.ts가 본다.
const account = { accountId: "tcc_counter", password: "TherapistCount!counter" };
// 1018 티켓 03: 지난 날짜의 사용중 콜은 읽을 때 자동 청소 중이 끝내므로, 원장 동작은 먼 뒤 날짜에서 본다.
const monthKey = "2040-09";
const serviceDate = "2040-09-16";
const policyName = "TCC A";

let monthId = "";
let busyId = "";
let idleId = "";
let outId = "";
let beforeId = "";
let reservedCallId = "";

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

async function seedRoom(name: string, sortOrder: number) {
  return (
    await (prisma as any).room.upsert({
      where: { sortOrder },
      update: { displayName: name, isActive: true },
      create: { displayName: name, migrationReferenceName: name, sortOrder, isActive: true }
    })
  ).id as string;
}

async function createCall(input: {
  courseId: string;
  therapistId: string | null;
  roomId: string | null;
  memo: string;
  status: string;
  startTime: string;
  actualEntryTime?: string;
}) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      actualEntryTime: input.actualEntryTime ?? null,
      roomId: input.roomId,
      courseId: input.courseId,
      customerMemo: input.memo,
      status: input.status
    }
  });
  if (input.therapistId) {
    await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId } });
  }
  return call.id as string;
}

async function checkIn(employeeId: string, checkOutMinute: number | null) {
  await (prisma as any).therapistAttendance.create({
    data: {
      operatingMonthId: monthId,
      attendanceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      employeeId,
      checkInMinute: 600,
      checkOutMinute,
      // 퇴근 방식 CHECK 제약(check_out_minute IS NULL = check_out_method IS NULL, 티켓 04)을 맞춘다.
      checkOutMethod: checkOutMinute === null ? null : "대리 입력",
      isFullAttendanceRecognized: false
    }
  });
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
  await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: monthId } });
}

function strip(page: Page) {
  return page.getByRole("region", { name: "Therapist 현황" });
}

function stripItem(page: Page, therapistId: string) {
  return strip(page).locator(`[data-therapist-status="${therapistId}"]`);
}

async function openLedger(page: Page) {
  await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
  await expect(page.getByRole("list", { name: "콜 원장 목록" })).toBeVisible();
}

test.describe("빠른 예약 카드의 한 것 +예약과 원장 현황 줄의 콜 수", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const operations = await seedEmployee("E2E-TCC-COUNTER", "TCC 카운터", "OPERATIONS", 95401);
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
        create: { monthKey, startDate: new Date(`${monthKey}-01T00:00:00.000Z`), endDate: new Date(`${monthKey}-30T00:00:00.000Z`), status: "작성중" }
      })
    ).id;
    await cleanup();

    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    const policy = { name: policyName, durationMinutes: 60, basePrice: 1500000, requiresSecondTherapist: false, tvDisplayName: policyName, effectiveToMonth: monthKey, isActive: true };
    const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
    if (existing) await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data: policy });
    else await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policy } });
    for (const [value, sortOrder] of [["11:00", 95411], ["12:00", 95412], ["13:00", 95413], ["14:00", 95414], ["16:00", 95416], ["17:00", 95417], ["18:00", 95418]] as const) {
      await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
    }

    busyId = (await seedEmployee("E2E-TCC-THR-BUSY", "TCC 린", "THERAPIST", 95411)).id;
    idleId = (await seedEmployee("E2E-TCC-THR-IDLE", "TCC 마이", "THERAPIST", 95412)).id;
    outId = (await seedEmployee("E2E-TCC-THR-OUT", "TCC 투", "THERAPIST", 95413)).id;
    beforeId = (await seedEmployee("E2E-TCC-THR-BEFORE", "TCC 미출근", "THERAPIST", 95414)).id;
    await checkIn(busyId, null);
    await checkIn(idleId, null);
    await checkIn(outId, 900);

    const [usingRoom, doneRoom, reservedRoom, outRoom] = [
      await seedRoom("TCC 사용 객실", 95411),
      await seedRoom("TCC 완료 객실", 95412),
      await seedRoom("TCC 예약 객실", 95413),
      await seedRoom("TCC 퇴근 객실", 95414)
    ];
    const base = { courseId: course.id };
    await createCall({ ...base, therapistId: busyId, roomId: usingRoom, memo: "TCC 이용 손님", status: "IN_USE", startTime: "13:00", actualEntryTime: "13:00" });
    await createCall({ ...base, therapistId: busyId, roomId: doneRoom, memo: "TCC 끝난 손님", status: "VISIT_COMPLETE", startTime: "11:00", actualEntryTime: "11:00" });
    reservedCallId = await createCall({ ...base, therapistId: busyId, roomId: reservedRoom, memo: "TCC 예약 손님", status: "RESERVED", startTime: "16:00" });
    await createCall({ ...base, therapistId: busyId, roomId: null, memo: "TCC 노쇼 손님", status: "NO_SHOW", startTime: "14:00" });
    await createCall({ ...base, therapistId: outId, roomId: outRoom, memo: "TCC 퇴근 전 손님", status: "VISIT_COMPLETE", startTime: "12:00", actualEntryTime: "12:00" });
    await createCall({ ...base, therapistId: beforeId, roomId: null, memo: "TCC 출근 전 예약", status: "RESERVED", startTime: "17:00" });
    await createCall({ ...base, therapistId: null, roomId: null, memo: "TCC 미배정 예약", status: "RESERVED", startTime: "18:00" });
  });

  test.afterAll(async () => {
    await cleanup();
    // 코스 화면은 가장 이른 운영월의 정책을 보인다. 이 스펙이 만든 과거 운영월과 정책은 지운다.
    await (prisma as any).coursePolicy.deleteMany({ where: { name: policyName } });
    await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("빠른 예약의 Therapist 줄에도 이름 옆에 같은 숫자가 붙는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, account.accountId, account.password);
    await openLedger(page);
    await page.getByRole("button", { name: "빠른 예약" }).click();
    // 빠른 예약은 원장 옆 패널이다(1018 스펙 D19). ① 조건에서 시각을 고르면 Therapist 줄이 그 시각으로 다시 그려진다.
    const panel = page.getByRole("complementary", { name: "빠른 예약" });
    await expect(panel).toBeVisible();
    await panel.getByLabel("시간").selectOption("18:00");

    const line = (therapistId: string) => panel.locator(`[data-quick-booking-line="${therapistId}"]`);
    await expect(line(busyId).locator("[data-therapist-call-count]")).toContainText("한 것 2, 예약 1");
    await expect(line(idleId).locator("[data-therapist-call-count][data-idle]")).toContainText("콜 없음");
    // 퇴근한 사람은 접어 둔 "이 시각에 안 되는 N명" 안에 있다.
    await panel.getByText(/이 시각에 안 되는 \d+명/).click();
    await expect(line(outId).locator("[data-therapist-call-count]")).toContainText("한 것 1, 예약 0");
  });

  test("예약을 입장시키면 남은 예약에서 빠지고, 종료해 청소중이 되면 현황 줄의 완료로 들어가 방문완료에도 남는다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, account.accountId, account.password);
    await openLedger(page);
    const reservedLine = page.locator(`[data-ledger-line][data-service-call-id="${reservedCallId}"]`);

    await reservedLine.getByRole("button", { name: "16:00 콜 입장" }).click();
    await expect.poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: reservedCallId } })).status).toBe("IN_USE");
    await openLedger(page);
    // 사용중은 완료가 아니다. 이용 중 1 + 방문완료 1 중 완료는 방문완료 1이다.
    await expect(stripItem(page, busyId)).toContainText("완료 1 · 예약 0");

    await reservedLine.getByRole("button", { name: "16:00 콜 결제수단 고르기" }).click();
    await page.getByRole("listbox", { name: "16:00 콜 결제수단 고르기" }).getByRole("option", { name: "카드" }).click();
    await expect.poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: reservedCallId } })).paymentMethodCode).toBe("CARD");
    await reservedLine.getByRole("button", { name: "16:00 콜 종료" }).click();
    await expect.poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: reservedCallId } })).status).toBe("CLEANING");
    await openLedger(page);
    await expect(stripItem(page, busyId)).toContainText("완료 2 · 예약 0");
    await reservedLine.getByRole("button", { name: "16:00 콜 청소 끝" }).click();
    await expect.poll(async () => (await (prisma as any).serviceCall.findUnique({ where: { id: reservedCallId } })).status).toBe("VISIT_COMPLETE");
    await openLedger(page);
    await expect(stripItem(page, busyId)).toContainText("완료 2 · 예약 0");
  });

  test("휴대폰 폭에서도 현황 줄이 보이고, 줄 안에서만 옆으로 넘겨 화면을 옆으로 밀지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    await expect(strip(page)).toBeVisible();
    await expect(stripItem(page, idleId)).toBeVisible();
    const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  });
});
