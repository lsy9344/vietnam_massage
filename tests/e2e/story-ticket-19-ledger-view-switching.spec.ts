import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { selectGridOption } from "./support/call-grid";

// 티켓 19: 원장 보기(예약·현장/수납·정산/전체) 전환. 보기별 열 구성, 주소 복원, 보기 전환 중의 초안 유지를 본다.
const accountId = "t19_counter";
const password = "Ticket19!counter";
const monthKey = "2039-07";
const serviceDate = "2039-07-19";
let monthId = "";
let callId = "";

function viewNav(page: Page) {
  return page.getByRole("navigation", { name: "원장 표 보기" });
}

function grid(page: Page) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: "콜 원장 그리드" }) });
}

async function seed() {
  const employee = await testEmployees.upsert({
    where: { staffCode: "E2E-T19-OPS" },
    update: { displayName: "T19 카운터", employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: "E2E-T19-OPS",
      displayName: "T19 카운터",
      employeeGroup: "OPERATIONS",
      position: "카운터",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 91900,
      isActive: true
    }
  });
  await (prisma as any).userAccount.upsert({
    where: { accountId },
    update: {
      email: `${accountId}@example.local`,
      passwordHash: await hash(password, argon2idOptions),
      role: "counter",
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      accountId,
      email: `${accountId}@example.local`,
      passwordHash: await hash(password, argon2idOptions),
      role: "counter",
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });

  const month = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { status: "작성중" },
    create: { monthKey, startDate: new Date(`${monthKey}-01T00:00:00.000Z`), endDate: new Date(`${monthKey}-31T00:00:00.000Z`), status: "작성중" }
  });
  monthId = month.id;

  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 91900 },
    update: { displayName: "T19 호실", isActive: true },
    create: { displayName: "T19 호실", migrationReferenceName: "T19-ROOM", sortOrder: 91900, isActive: true }
  });
  const courseA = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
  const courseD = await (prisma as any).course.upsert({ where: { code: "D" }, update: { isActive: true }, create: { code: "D", isActive: true } });

  async function upsertPolicy(courseId: string, name: string, requiresSecondTherapist: boolean) {
    const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth: monthKey } });
    const data = {
      name,
      durationMinutes: requiresSecondTherapist ? 90 : 60,
      basePrice: 1500000,
      opsCallCredit: 1,
      earcarePoolAmount: 0,
      requiresSecondTherapist,
      tvDisplayName: name,
      effectiveToMonth: null,
      isActive: true
    };
    if (existing) {
      await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth: monthKey, ...data } });
    }
  }
  await upsertPolicy(courseA.id, "T19 A", false);
  await upsertPolicy(courseD.id, "T19 D", true);

  const therapist1 = await testEmployees.upsert({
    where: { staffCode: "E2E-T19-THR-1" },
    update: { displayName: "T19 마사지사1", employeeGroup: "THERAPIST", isActive: true },
    create: {
      staffCode: "E2E-T19-THR-1",
      displayName: "T19 마사지사1",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 91901,
      isActive: true
    }
  });

  async function upsertRate(therapistId: string, courseId: string) {
    const existing = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId, courseId, effectiveFromMonth: monthKey } });
    const data = { amount: 700000, effectiveToMonth: null, isActive: true };
    if (existing) {
      await (prisma as any).therapistCourseRate.update({ where: { id: existing.id }, data });
    } else {
      await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, effectiveFromMonth: monthKey, ...data } });
    }
  }
  await upsertRate(therapist1.id, courseA.id);
  await upsertRate(therapist1.id, courseD.id);

  for (const [value, sortOrder] of [["10:00", 91910]] as const) {
    await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
  }

  await cleanupCalls();
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: "10:00",
      roomId: room.id,
      courseId: courseA.id,
      customerMemo: "T19 손님1",
      status: "RESERVED"
    }
  });
  callId = call.id;
  await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: therapist1.id } });
}

async function cleanupCalls() {
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length === 0) return;
  await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
  await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
  await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
}

test.describe("티켓 19 원장 보기 전환", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seed();
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanupCalls();
    await prisma.$disconnect();
  });

  test("보기마다 다른 열 묶음을 보여 주고, 고른 보기는 주소에 남아 새로고침과 뒤로 가기에서 복원된다", async ({ page }) => {
    await login(page, accountId, password);
    const ledgerUrl = `/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`;
    await page.goto(ledgerUrl);

    // 기본은 전체 보기(기존 동작과 같다): 주소에 view가 없고, 모든 열이 보인다.
    await expect(viewNav(page).getByRole("link", { name: "전체" })).toHaveAttribute("aria-current", "page");
    await expect(grid(page).getByRole("combobox", { name: "할인구분" }).first()).toBeVisible();
    await expect(grid(page).getByRole("combobox", { name: "확인값" }).first()).toBeVisible();

    // 예약·현장: 실제입장은 보이고, 결제·확인 관련 입력은 없다.
    await viewNav(page).getByRole("link", { name: "예약·현장" }).click();
    await expect(page).toHaveURL(`${ledgerUrl}&view=booking`);
    await expect(viewNav(page).getByRole("link", { name: "예약·현장" })).toHaveAttribute("aria-current", "page");
    await expect(grid(page).getByRole("combobox", { name: "실제입장" }).first()).toBeVisible();
    await expect(grid(page).getByRole("combobox", { name: "할인구분" })).toHaveCount(0);
    await expect(grid(page).getByRole("combobox", { name: "확인값" })).toHaveCount(0);

    await page.reload();
    await expect(viewNav(page).getByRole("link", { name: "예약·현장" })).toHaveAttribute("aria-current", "page");
    await expect(grid(page).getByRole("combobox", { name: "실제입장" }).first()).toBeVisible();

    // 수납·정산: 결제수단은 보이고, 코스·마사지사 배정은 없다.
    await viewNav(page).getByRole("link", { name: "수납·정산" }).click();
    await expect(page).toHaveURL(`${ledgerUrl}&view=settlement`);
    await expect(grid(page).getByRole("combobox", { name: "결제수단" }).first()).toBeVisible();
    await expect(grid(page).getByRole("combobox", { name: "코스" })).toHaveCount(0);
    await expect(grid(page).getByRole("combobox", { name: "마사지사1" })).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(`${ledgerUrl}&view=booking`);

    await viewNav(page).getByRole("link", { name: "전체" }).click();
    await expect(page).toHaveURL(ledgerUrl);
    await expect(viewNav(page).getByRole("link", { name: "전체" })).toHaveAttribute("aria-current", "page");
  });

  test("보기를 바꿔도 저장이 막힌 초안과 역할·데이터가 그대로다", async ({ page }) => {
    await login(page, accountId, password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    const row = grid(page).locator(`tr[data-service-call-id="${callId}"]`);
    const courseCombobox = row.getByRole("combobox", { name: "코스" });
    await courseCombobox.focus();
    await courseCombobox.press("ControlOrMeta+a");
    await courseCombobox.pressSequentially("T19 D");
    await expect(page.getByRole("listbox").getByRole("option")).not.toHaveCount(0);
    await courseCombobox.press("Enter");

    // D코스인데 마사지사2가 없어 저장이 거절된다(story-2-6과 같은 방식).
    await expect(row.getByText("저장 실패")).toBeVisible();

    // 수납·정산 보기로 바꿔도(코스 열은 없어진다) 저장상태 칸은 그대로 저장 실패다 — 행이 다시 만들어지지 않았다는 뜻이다.
    await viewNav(page).getByRole("link", { name: "수납·정산" }).click();
    await expect(row.getByText("저장 실패")).toBeVisible();
    await expect(row.getByRole("combobox", { name: "코스" })).toHaveCount(0);

    // 전체 보기로 되돌리면 코스 칸이 다시 보이고, 고친 값(D코스)이 그대로 남아 있다.
    await viewNav(page).getByRole("link", { name: "전체" }).click();
    await expect(row.getByRole("combobox", { name: "코스" })).toHaveValue(/T19 D/);
    await expect(row.getByText("저장 실패")).toBeVisible();
  });
});
