import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 티켓 14: 같은 객실의 예약 구간이 겹치면 원장 행에 경고가 붙고, 객실 화면은 같은 결과를 "겹친 콜 N건"과 목록으로 보인다.
// 웨이터의 목록에는 원장 링크와 고객 정보가 없다. 실시간과 TV에는 겹침 목록이 없다.
// 다른 현장 스펙과 겹치지 않게 과거 날짜와 이 스펙 전용 객실을 쓴다.
const accounts = {
  counter: { accountId: "t14_counter", password: "Ticket14!counter" },
  waiter: { accountId: "t14_waiter", password: "Ticket14!waiter" }
} as const;
type Role = keyof typeof accounts;

const monthKey = "2025-04";
const serviceDate = "2025-04-17";
const roomName = "T14 호실";
const secretMemo = "T14 비밀메모";

let monthId = "";
let earlyCallId = "";
let lateCallId = "";
let eveningCallId = "";
let createdMonth = false;

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

async function seedAccount(role: Role, sortOrder: number) {
  const account = accounts[role];
  const employee = await seedEmployee(`E2E-T14-${role.toUpperCase()}`, `T14 ${role}`, "OPERATIONS", sortOrder);
  const data = {
    email: `${account.accountId}@example.local`,
    passwordHash: await hash(account.password, argon2idOptions),
    role,
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

async function createCall(input: { therapistId: string; roomId: string; courseId: string; status: string; startTime: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      roomId: input.roomId,
      courseId: input.courseId,
      customerMemo: secretMemo,
      status: input.status
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId }
  });
  return call.id as string;
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

// 코스 화면은 가장 이른 운영월의 정책을 보이므로, 이 스펙이 만든 정책과 운영월은 끝나면 지운다.
async function removeSeededMasters() {
  await (prisma as any).coursePolicy.deleteMany({ where: { name: "T14 A", effectiveFromMonth: monthKey } });
  if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
}

function roomCard(page: Page) {
  return page.locator('[data-testid="room-status-card"]').filter({ hasText: roomName });
}

// 티켓 03 이후 원장 행에는 입력칸도 "경고" 칸도 없다. 경고는 버튼 하나(aria-label "경고 N건: 첫 경고")뿐이다.
function line(page: Page, callId: string) {
  return page.locator(`[data-ledger-line][data-service-call-id="${callId}"]`);
}

const dateQuery = () => `operatingMonthId=${monthId}&serviceDate=${serviceDate}`;

test.describe("티켓 14 객실 겹침", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount("counter", 9403);
    await seedAccount("waiter", 9404);
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
      where: { sortOrder: 94002 },
      update: { displayName: roomName, isActive: true },
      create: { displayName: roomName, migrationReferenceName: "T14-ROOM", sortOrder: 94002, isActive: true }
    });
    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
    const policy = {
      name: "T14 A",
      durationMinutes: 60,
      basePrice: 1500000,
      requiresSecondTherapist: false,
      tvDisplayName: "T14 A",
      effectiveToMonth: null,
      isActive: true
    };
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policy } });
    }
    const first = await seedEmployee("E2E-T14-THR-1", "T14 마사지사1", "THERAPIST", 9412);
    const second = await seedEmployee("E2E-T14-THR-2", "T14 마사지사2", "THERAPIST", 9413);

    // 14:00–15:00과 14:30–15:30은 겹친다. 18:00 콜은 겹치지 않고 객실의 대표 콜이 된다.
    earlyCallId = await createCall({ therapistId: first.id, roomId: room.id, courseId: course.id, status: "RESERVED", startTime: "14:00" });
    lateCallId = await createCall({ therapistId: second.id, roomId: room.id, courseId: course.id, status: "IN_USE", startTime: "14:30" });
    eveningCallId = await createCall({ therapistId: first.id, roomId: room.id, courseId: course.id, status: "RESERVED", startTime: "18:00" });
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await removeSeededMasters();
    await prisma.$disconnect();
  });

  test("원장의 두 행에 서로의 예약시각이 붙고, 겹치지 않는 콜에는 붙지 않는다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?${dateQuery()}`);

    // 경고는 행마다 버튼 하나다(티켓 13). 겹침 하나뿐이라 "외 N건"이 붙지 않는다.
    await expect(line(page, earlyCallId).getByRole("button", { name: "경고 1건: 이 객실에 14:30 콜이 있습니다" })).toBeVisible();
    await expect(line(page, lateCallId).getByRole("button", { name: "경고 1건: 이 객실에 14:00 콜이 있습니다" })).toBeVisible();
    await expect(line(page, eveningCallId)).not.toContainText("이 객실에");
  });

  test("카운터는 객실 화면에서 겹친 콜 목록을 펼쳐 원장의 그 콜 상세로 간다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/rooms?${dateQuery()}`);

    const card = roomCard(page);
    await card.getByText("겹친 콜 2건").click();
    const items = card.locator("[data-overlap-call]");
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText("14:00");
    await expect(items.first()).toContainText("T14 A · T14 마사지사1");

    await card.locator(`a[data-overlap-call="${lateCallId}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/calls\\?operatingMonthId=${monthId}&serviceDate=${serviceDate}&call=${lateCallId}$`));
    await expect(page.getByRole("complementary", { name: /^콜 상세 · 14:30/ })).toBeVisible();
  });

  test("웨이터의 겹친 콜 목록에는 원장 링크와 고객 정보가 없다", async ({ page }) => {
    await login(page, accounts.waiter.accountId, accounts.waiter.password);
    await page.goto(`/rooms?${dateQuery()}`);

    const card = roomCard(page);
    await card.getByText("겹친 콜 2건").click();
    const items = card.locator("[data-overlap-call]");
    await expect(items).toHaveCount(2);
    await expect(items.nth(1)).toContainText("14:30");
    await expect(items.nth(1)).toContainText("T14 A · T14 마사지사2 · 사용중");
    await expect(card.locator("a")).toHaveCount(0);
    await expect(page.locator('a[href*="/calls"]')).toHaveCount(0);
    await expect(page.getByText(secretMemo)).toHaveCount(0);
    await expect(page.getByText(/1,500,000|1\.500\.000/)).toHaveCount(0);
  });

  test("실시간 카드에는 겹침 목록이 없고 대표 콜의 원장 상세로 가는 링크가 있다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/live?${dateQuery()}`);

    // 실시간 객실판은 평면도다. 번호가 없는 이 객실은 기타 줄에 있고, 누르면 서랍에 객실 카드가 뜬다.
    await page.getByRole("group", { name: "기타" }).getByRole("button", { name: new RegExp(`^${roomName}, `) }).click();
    const card = page.getByRole("dialog", { name: "선택한 객실" }).getByTestId("room-status-card");
    await expect(card).toContainText(roomName);
    await expect(card.getByText(/겹친 콜/)).toHaveCount(0);
    await expect(card.getByText(/이 객실에/)).toHaveCount(0);

    await card.getByRole("link", { name: `${roomName} 18:00 콜을 원장에서 열기` }).click();
    await expect(page).toHaveURL(new RegExp(`call=${eveningCallId}$`));
    await expect(page.getByRole("complementary", { name: /^콜 상세 · 18:00/ })).toBeVisible();
  });

  test("TV에는 겹침 목록과 원장 경고 문장이 없다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/tv?${dateQuery()}`);

    const card = roomCard(page);
    await expect(card).toBeVisible();
    await expect(card.getByText(/겹친 콜|이 객실에/)).toHaveCount(0);
    await expect(card.locator("a")).toHaveCount(0);
  });
});
