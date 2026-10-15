import { testEmployees } from "./support/test-employees";
import { expect, test, type Page, type Request } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { createServiceCallRow } from "@/modules/calls/service-call-service";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { selectGridOption, selectGridOptionByValue } from "./support/call-grid";

// 티켓 16: 원장 새 행의 요청 id. 응답을 받지 못한 새 행을 다시 보내도, 같은 요청이 동시에 들어와도 콜은 하나다.
// 13:00은 공용 시드(defaultTimeSlots)의 활성 슬롯이다.
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

function isServerAction(request: Request) {
  return request.method() === "POST" && Boolean(request.headers()["next-action"]);
}

function newRowForm(page: Page) {
  return page.locator("form").filter({ has: page.getByRole("button", { name: "새 콜 행 추가" }) });
}

async function fillNewRow(page: Page, memo: string) {
  const form = newRowForm(page);
  await selectGridOption(page, form, "시간", "13:00");
  await selectGridOptionByValue(page, form, "코스", courseId);
  await selectGridOptionByValue(page, form, "객실", roomId);
  await form.getByLabel("고객/메모").fill(memo);
  await form.getByRole("combobox", { name: "고객", exact: true }).selectOption(customerId);
  await selectGridOptionByValue(page, form, "마사지사1", therapistId);
}

test.describe("티켓 16 새 행 요청 id로 중복 생성 막기", () => {
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
      opsCallCredit: 1,
      earcarePoolAmount: 0,
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
    const customer =
      (await (prisma as any).customer.findFirst({ where: { name: "T16 손님" } })) ??
      (await (prisma as any).customer.create({ data: { name: "T16 손님", phone: "0900016016" } }));
    customerId = customer.id;
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    // 코스 정책과 운영월은 다른 스펙의 화면에도 보인다. 이 스펙이 만든 것은 지운다.
    await (prisma as any).coursePolicy.deleteMany({ where: { name: "T16 A", effectiveFromMonth: monthKey } });
    // 활성 객실은 모두 객실 화면에 나온다(support/README). 이 스펙의 객실은 끈다.
    await (prisma as any).room.update({ where: { id: roomId }, data: { isActive: false } });
    if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await prisma.$disconnect();
  });

  test("새 행 저장 응답이 끊기면 저장 여부 확인 중과 입력이 남고, 재시도하면 이미 만든 콜이나 새 콜 하나로 끝난다", async ({ page }) => {
    const memo = `T16 응답 유실 ${Date.now().toString(36)}`;
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
    await fillNewRow(page, memo);

    // 첫 저장은 서버까지 가서 콜을 만들지만, 화면은 응답을 받지 못한다.
    let dropped = false;
    await page.route(
      (url) => url.pathname === "/calls",
      async (route) => {
        if (!dropped && isServerAction(route.request())) {
          dropped = true;
          await route.fetch();
          await route.abort("failed");
          return;
        }
        await route.continue();
      }
    );
    const form = newRowForm(page);
    await form.getByRole("button", { name: "새 콜 행 추가" }).click();

    const status = form.locator("[data-save-state]");
    await expect(status).toHaveAttribute("data-save-state", "checking");
    await expect(status).toContainText("저장 여부 확인 중");
    await expect(form.getByLabel("고객/메모")).toHaveValue(memo);
    await expect(form.getByLabel("고객/메모")).toBeDisabled();
    const created = await (prisma as any).serviceCall.findMany({ where: { customerMemo: memo } });
    expect(created).toHaveLength(1);
    expect(created[0].requestId).toBeTruthy();

    // 재시도는 같은 요청 id로 보낸다. 서버는 새로 만들지 않고 이미 만든 콜을 돌려준다.
    await form.getByRole("button", { name: "재시도" }).click();
    await expect(status).toHaveAttribute("data-save-state", "saved");
    await expect(status).toContainText(alreadySaved);
    await expect(form.getByLabel("고객/메모")).toHaveValue("");
    // 원장을 다시 열어도 그 콜은 한 줄이다. 저장 뒤 화면 자동 갱신은 이 운영 빌드 환경에서 가끔 늦어(기존 문제) 다시 불러와 본다.
    await page.reload();
    await expect(page.locator(`tr[data-service-call-id="${created[0].id}"]`)).toBeVisible();
    await expect(page.locator("tr[data-service-call-id]").filter({ hasText: memo })).toHaveCount(1);

    const calls = await (prisma as any).serviceCall.findMany({ where: { customerMemo: memo } });
    expect(calls.map((call: { id: string }) => call.id)).toEqual([created[0].id]);
    // 고객을 붙여 만든 콜은 생성 감사 기록이 하나 남고, 다시 보낸 요청은 감사 기록을 쓰지 않는다.
    const audits = await (prisma as any).auditLog.findMany({ where: { targetType: "service_call", targetId: created[0].id } });
    expect(audits.map((audit: { action: string }) => audit.action)).toEqual(["service_call.row_changed"]);
    expect(audits[0].actorId).toBe(accountDbId);

    // 다음 새 행은 새 요청 id다. 이번에는 요청이 서버에 닿기 전에 끊겨, 재시도가 콜을 새로 만든다.
    const nextMemo = `${memo} 다음`;
    await fillNewRow(page, nextMemo);
    let blocked = false;
    await page.route(
      (url) => url.pathname === "/calls",
      async (route) => {
        if (!blocked && isServerAction(route.request())) {
          blocked = true;
          await route.abort("failed");
          return;
        }
        await route.fallback();
      }
    );
    await form.getByRole("button", { name: "새 콜 행 추가" }).click();
    await expect(status).toHaveAttribute("data-save-state", "checking");
    expect(await (prisma as any).serviceCall.count({ where: { customerMemo: nextMemo } })).toBe(0);
    await form.getByRole("button", { name: "재시도" }).click();
    await expect(status).toHaveAttribute("data-save-state", "saved");
    await expect(status).not.toContainText(alreadySaved);
    const next = await (prisma as any).serviceCall.findMany({ where: { customerMemo: nextMemo } });
    expect(next).toHaveLength(1);
    expect(next[0].requestId).not.toBe(created[0].requestId);
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
