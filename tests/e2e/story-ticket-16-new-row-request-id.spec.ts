import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { createServiceCallRow } from "@/modules/calls/service-call-service";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { checkInTherapist, chooseConditions, fillBooking as fillBookingFields, goToCustomerStep, openQuickBooking, pickGuest } from "./support/quick-booking";

// 티켓 16: 새 콜 저장의 요청 id. 응답을 받지 못한 저장을 다시 보내도, 같은 요청이 동시에 들어와도 콜은 하나다.
// 티켓 03 이후 표 아래 "새 콜 행 추가"는 없고 새 콜은 빠른 예약으로만 만든다 — 이 계약은 이제 빠른 예약
// 패널에서 검증한다(call-new-row-save.ts를 그대로 쓴다). 저장 응답이 서버까지 닿았다가 돌아오지 못하는
// 경로는 티켓 20(story-ticket-20-*, "응답 유실 뒤 같은 요청으로 재시도" 테스트)이 이미 자세히 본다 —
// 여기서는 그 테스트가 보지 않는 것만 짧게 본다: 요청 id가 행에 남는지, 감사 기록이 저장 하나뿐인지,
// 서버에 닿지도 못한 요청의 재시도가 실제로 새 콜을 만드는지. 동시 생성(같은 요청 id가 겹쳐 들어오는
// 경우)은 화면 타이밍으로 흉내 내기 어려워 서버 함수를 직접 동시에 불러 본다.
const account = { accountId: "t16_counter", password: "Ticket16!counter", staffCode: "E2E-T16-COUNTER", sortOrder: 9441 };
const monthKey = "2076-04";
const serviceDate = "2076-04-10";
const alreadySaved = "이미 저장된 콜입니다.";

let monthId = "";
let roomId = "";
let courseId = "";
let therapistId = "";
let customerId = "";
let accountDbId = "";
let createdMonth = false;

async function seedAccount() {
  const employee = await testEmployees.upsert({
    where: { staffCode: account.staffCode },
    update: { displayName: "T16 카운터", employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: account.staffCode,
      displayName: "T16 카운터",
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
  accountDbId = saved.id;
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

function isServerAction(request: { method(): string; headers(): Record<string, string> }) {
  return request.method() === "POST" && Boolean(request.headers()["next-action"]);
}

/**
 * 빠른 예약을 열어 ①에서 그 Therapist의 코스 칩으로 손님 1명을 담고 ②에서 고객(검색해 연결)을 잇고
 * 예약자명에 memo를 넣어 저장 바로 전까지 채운다(1018 티켓 05). 예약자명이 customerMemo가 되므로(스펙
 * D21) memo를 거기 넣는다. 고객을 연결해야 생성 감사가 남는다(고객 연결이 바뀌는 저장만 감사 대상이다,
 * service-call-service.ts).
 */
async function fillBooking(page: Page, memo: string, time: string) {
  const panel = await openQuickBooking(page);
  await chooseConditions(panel, { time });
  await pickGuest(page, panel, { therapistId, courseId });
  await goToCustomerStep(panel);
  await panel.getByLabel("기존 고객 검색", { exact: true }).fill("T16 손님");
  // 후보 항목의 이름은 이 스펙이 호출될수록 그 고객의 가장 최근 콜 메모로 바뀐다(searchCustomerVisitCandidates의
  // label 규칙). 전화번호는 그대로라 그걸로 고른다.
  await panel.getByRole("option").filter({ hasText: "0900016016" }).click();
  await fillBookingFields(panel, { bookerName: memo });
  return panel;
}

test.describe("티켓 16 새 콜 요청 id로 중복 생성 막기", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount();
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
      where: { sortOrder: 94006 },
      update: { displayName: "T16 호실", isActive: true },
      create: { displayName: "T16 호실", migrationReferenceName: "T16-ROOM", sortOrder: 94006, isActive: true }
    });
    roomId = room.id;
    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    courseId = course.id;
    const policy = {
      name: "T16 A",
      durationMinutes: 60,
      basePrice: 1500000,
      requiresSecondTherapist: false,
      tvDisplayName: "T16 A",
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
      where: { staffCode: "E2E-T16-THR-1" },
      update: { displayName: "T16 마사지사", employeeGroup: "THERAPIST", isActive: true },
      create: {
        staffCode: "E2E-T16-THR-1",
        displayName: "T16 마사지사",
        employeeGroup: "THERAPIST",
        position: "마사지사",
        shiftType: "전체",
        baseSalary: 0,
        employmentStatus: "재직",
        sortOrder: 9443,
        isActive: true
      }
    });
    therapistId = therapist.id;
    // 빠른 예약의 "가능" 버튼은 Therapist에게 그 코스 수당이 있어야 뜬다(수당이 없으면 rate_missing).
    const existingRate = await (prisma as any).therapistCourseRate.findFirst({
      where: { therapistId, courseId, effectiveFromMonth: monthKey }
    });
    const rate = { amount: 300000, effectiveToMonth: monthKey, isActive: true };
    if (existingRate) {
      await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rate });
    } else {
      await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth: monthKey, ...rate } });
    }
    const customer =
      (await (prisma as any).customer.findFirst({ where: { name: "T16 손님" } })) ??
      (await (prisma as any).customer.create({ data: { name: "T16 손님", phone: "0900016016" } }));
    customerId = customer.id;
    // 빠른 예약 ①의 Therapist 줄은 출근 기록이 있는 사람만 기본으로 보인다(1018 스펙 D23).
    await checkInTherapist({ operatingMonthId: monthId, serviceDate, employeeId: therapistId });
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await (prisma as any).therapistCourseRate.deleteMany({ where: { therapistId, courseId } });
    // 출근 기록이 운영월을 참조해(ON DELETE RESTRICT) 먼저 지워야 운영월을 지울 수 있다.
    await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: monthId } });
    // 코스 정책과 운영월은 다른 스펙의 화면에도 보인다. 이 스펙이 만든 것은 지운다.
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T16 A", effectiveFromMonth: monthKey } });
    // 활성 객실은 모두 객실 화면에 나온다(support/README). 이 스펙의 객실은 끈다.
    await (prisma as any).room.update({ where: { id: roomId }, data: { isActive: false } });
    if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  test("저장 응답이 서버까지 닿고도 돌아오지 못하면 요청 id가 행에 남고, 재시도는 쓰기도 감사도 더 남기지 않는다", async ({ page }) => {
    const memo = `T16 응답 유실 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    const panel = await fillBooking(page, memo, "13:00");

    // 첫 저장은 서버까지 가서 콜을 만들지만, 화면은 응답을 받지 못한다.
    let dropped = false;
    await page.route(
      (url) => url.pathname === "/calls",
      async (route) => {
        const request = route.request();
        if (!dropped && isServerAction(request) && request.postData()?.includes(memo)) {
          dropped = true;
          await route.fetch();
          await route.abort("failed");
          return;
        }
        await route.continue();
      }
    );
    await panel.getByRole("button", { name: "예약 저장" }).click();

    const status = panel.locator("[data-save-state]");
    await expect(status).toHaveAttribute("data-save-state", "checking");
    await expect(status).toContainText("저장 여부 확인 중");
    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: memo } });
    expect(created).toHaveLength(1);
    expect(created[0].requestId).toBeTruthy();

    // 재시도는 같은 요청 id로 보낸다. 서버는 새로 만들지 않고 이미 만든 콜을 돌려준다.
    await panel.getByRole("button", { name: "재시도" }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: alreadySaved })).toBeVisible();

    // 실제 DB에는 그 콜 하나뿐이고, 생성 감사 기록도 그 저장 하나뿐이다 — 다시 보낸 요청은 쓰기도 감사도 남기지 않는다.
    const calls = await (prisma as any).serviceCall.findMany({ where: { customerMemo: memo } });
    expect(calls.map((call: { id: string }) => call.id)).toEqual([created[0].id]);
    const audits = await (prisma as any).auditLog.findMany({ where: { targetType: "service_call", targetId: created[0].id } });
    expect(audits.map((audit: { action: string }) => audit.action)).toEqual(["service_call.row_changed"]);
    expect(audits[0].actorId).toBe(accountDbId);
  });

  test("요청이 서버에 닿기도 전에 끊기면(아무 콜도 만들어지지 않는다), 재시도가 같은 요청 id로 실제 콜을 만든다", async ({ page }) => {
    const memo = `T16 서버에 닿기 전 유실 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    const panel = await fillBooking(page, memo, "14:00");

    let blocked = false;
    await page.route(
      (url) => url.pathname === "/calls",
      async (route) => {
        const request = route.request();
        if (!blocked && isServerAction(request) && request.postData()?.includes(memo)) {
          blocked = true;
          // fetch 없이 바로 끊는다 — 요청 자체가 서버에 닿지 못했다.
          await route.abort("failed");
          return;
        }
        await route.continue();
      }
    );
    await panel.getByRole("button", { name: "예약 저장" }).click();
    const status = panel.locator("[data-save-state]");
    await expect(status).toHaveAttribute("data-save-state", "checking");
    expect(await (prisma as any).serviceCall.count({ where: { customerMemo: memo } })).toBe(0);

    await panel.getByRole("button", { name: "재시도" }).click();
    await expect(panel).toBeHidden();
    // 이번에는 처음 저장이 서버에 닿은 적이 없어 "이미 저장된 콜입니다" 안내가 없다.
    await expect(page.getByRole("status").filter({ hasText: alreadySaved })).toBeHidden();
    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: memo } });
    expect(created).toHaveLength(1);
    expect(created[0].requestId).toBeTruthy();
  });

  test("같은 요청 id의 생성이 동시에 들어와도 실제 DB에는 콜 하나와 생성 감사 기록 하나만 남는다", async () => {
    const requestId = `t16-${Date.now().toString(36)}`;
    const input = {
      requestId,
      operatingMonthId: monthId,
      serviceDate,
      startTime: "13:00",
      roomId,
      courseId,
      customerId,
      customerMemo: "T16 동시 생성",
      therapist1Id: therapistId,
      status: "RESERVED",
      actorId: accountDbId
    };

    const results = await Promise.all(Array.from({ length: 4 }, () => createServiceCallRow(input)));

    expect(results.filter((result) => !result.alreadySaved)).toHaveLength(1);
    expect(new Set(results.map((result) => result.row.id)).size).toBe(1);
    const calls = await (prisma as any).serviceCall.findMany({ where: { requestId } });
    expect(calls.map((call: { id: string }) => call.id)).toEqual([results[0].row.id]);
    const audits = await (prisma as any).auditLog.findMany({ where: { targetType: "service_call", targetId: calls[0].id } });
    expect(audits).toHaveLength(1);
  });
});
