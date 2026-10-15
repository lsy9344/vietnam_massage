import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 티켓 18: 원장에 저장하지 않은 입력이 있을 때 탭 이동·다른 화면 이동에서 떠나기 전 안내가 나오고,
// 취소하면 초안이 그대로 남는다. 원장 보기 전환(티켓 19)은 같은 화면의 표시만 바꾸므로 안내하지 않는다.
const accountId = "t18_counter";
const password = "Ticket18!counter";
const monthKey = "2039-08";
const serviceDate = "2039-08-18";
let monthId = "";
let callId = "";

function grid(page: Page) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: "콜 원장 그리드" }) });
}

function leaveGuardDialog(page: Page) {
  return page.getByRole("alertdialog", { name: "저장하지 않은 입력이 있습니다" });
}

async function seed() {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E-T18-OPS" },
    update: { displayName: "T18 카운터", employeeGroup: "OPERATIONS", isActive: true },
    create: {
      staffCode: "E2E-T18-OPS",
      displayName: "T18 카운터",
      employeeGroup: "OPERATIONS",
      position: "카운터",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 91800,
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
    where: { sortOrder: 91800 },
    update: { displayName: "T18 호실", isActive: true },
    create: { displayName: "T18 호실", migrationReferenceName: "T18-ROOM", sortOrder: 91800, isActive: true }
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
  await upsertPolicy(courseA.id, "T18 A", false);
  await upsertPolicy(courseD.id, "T18 D", true);

  const therapist1 = await (prisma as any).employee.upsert({
    where: { staffCode: "E2E-T18-THR-1" },
    update: { displayName: "T18 마사지사1", employeeGroup: "THERAPIST", isActive: true },
    create: {
      staffCode: "E2E-T18-THR-1",
      displayName: "T18 마사지사1",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 91801,
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

  for (const [value, sortOrder] of [["11:00", 91810]] as const) {
    await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
  }

  await cleanupCalls();
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: "11:00",
      roomId: room.id,
      courseId: courseA.id,
      customerMemo: "T18 손님1",
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

/** 행을 D코스로 바꿔 마사지사2 누락으로 저장을 거절시킨다(story-2-6과 같은 방식, 티켓 19와 동일). */
async function makeRowSaveFail(page: Page) {
  const row = grid(page).locator(`tr[data-service-call-id="${callId}"]`);
  const courseCombobox = row.getByRole("combobox", { name: "코스" });
  await courseCombobox.focus();
  await courseCombobox.press("ControlOrMeta+a");
  await courseCombobox.pressSequentially("T18 D");
  await expect(page.getByRole("listbox").getByRole("option")).not.toHaveCount(0);
  await courseCombobox.press("Enter");
  await expect(row.getByText("저장 실패")).toBeVisible();
  return row;
}

test.describe("티켓 18 떠나기 전 안내", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seed();
  });

  test.afterAll(async () => {
    await cleanupCalls();
    await prisma.$disconnect();
  });

  test("저장하지 않은 입력이 있으면 탭 이동과 다른 화면 이동에서 안내가 나오고, 취소하면 초안이 그대로다", async ({ page }) => {
    await login(page, accountId, password);
    const ledgerUrl = `/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`;
    await page.goto(ledgerUrl);

    const row = await makeRowSaveFail(page);

    // 탭 이동(하루 수납·지출): 안내가 나오고, 취소하면 원장 탭에 그대로 남아 초안이 유지된다.
    await page.getByRole("navigation", { name: "콜 원장 보기" }).getByRole("link", { name: "하루 수납·지출" }).click();
    await expect(leaveGuardDialog(page)).toBeVisible();
    await leaveGuardDialog(page).getByRole("button", { name: "취소" }).click();
    await expect(leaveGuardDialog(page)).toBeHidden();
    await expect(page).toHaveURL(ledgerUrl);
    await expect(row.getByRole("combobox", { name: "코스" })).toHaveValue(/T18 D/);
    await expect(row.getByText("저장 실패")).toBeVisible();

    // 앱의 다른 화면(고객 화면)으로 이동: 안내가 나오고, 이번에는 나가기를 고른다.
    await page.getByRole("link", { name: "고객 화면" }).click();
    await expect(leaveGuardDialog(page)).toBeVisible();
    await leaveGuardDialog(page).getByRole("button", { name: "나가기" }).click();
    await expect(page).toHaveURL(/\/customers/);
  });

  test("저장하지 않은 입력이 없으면 안내 없이 바로 이동하고, 원장 보기 전환은 저장 실패가 있어도 안내하지 않는다", async ({ page }) => {
    await login(page, accountId, password);
    const ledgerUrl = `/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`;
    await page.goto(ledgerUrl);

    // 아직 고치지 않은 행: 탭을 바로 옮길 수 있다.
    await page.getByRole("navigation", { name: "콜 원장 보기" }).getByRole("link", { name: "하루 수납·지출" }).click();
    await expect(leaveGuardDialog(page)).toBeHidden();
    await expect(page).toHaveURL(`${ledgerUrl}&tab=cashbook`);

    await page.goto(ledgerUrl);
    await makeRowSaveFail(page);

    // 원장 보기 전환(예약·현장)은 같은 화면의 표시만 바꾸므로, 저장 실패가 있어도 안내하지 않는다.
    await page.getByRole("navigation", { name: "원장 표 보기" }).getByRole("link", { name: "예약·현장" }).click();
    await expect(leaveGuardDialog(page)).toBeHidden();
    await expect(page).toHaveURL(`${ledgerUrl}&view=booking`);
    await expect(grid(page).locator(`tr[data-service-call-id="${callId}"]`).getByText("저장 실패")).toBeVisible();
  });

  test("브라우저 닫기·새로고침은 저장하지 않은 입력이 있으면 브라우저 안내가 뜨고, 없으면 바로 된다", async ({ page }) => {
    await login(page, accountId, password);
    const ledgerUrl = `/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`;
    await page.goto(ledgerUrl);

    // 저장하지 않은 입력이 없으면 새로고침에서 브라우저 안내가 뜨지 않는다.
    let dialogSeen = false;
    const noDialogHandler = (dialog: import("@playwright/test").Dialog) => {
      dialogSeen = true;
      void dialog.dismiss();
    };
    page.on("dialog", noDialogHandler);
    await page.reload();
    page.off("dialog", noDialogHandler);
    expect(dialogSeen).toBe(false);

    const row = await makeRowSaveFail(page);

    // 저장하지 않은 입력이 있으면 새로고침에서 브라우저 자체의 beforeunload 안내가 뜬다(문구는 커스텀할 수 없다).
    // 취소(dismiss)하면 새로고침이 막히고 초안이 그대로다.
    let dialogType: string | null = null;
    const unsavedDialogHandler = (dialog: import("@playwright/test").Dialog) => {
      dialogType = dialog.type();
      void dialog.dismiss();
    };
    page.on("dialog", unsavedDialogHandler);
    await page.reload({ timeout: 15_000 }).catch(() => undefined);
    page.off("dialog", unsavedDialogHandler);
    expect(dialogType).toBe("beforeunload");
    await expect(page).toHaveURL(ledgerUrl);
    await expect(row.getByRole("combobox", { name: "코스" })).toHaveValue(/T18 D/);
    await expect(row.getByText("저장 실패")).toBeVisible();
  });
});
