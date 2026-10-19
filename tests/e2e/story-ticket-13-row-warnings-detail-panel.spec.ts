import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 티켓 13: 원장 행 경고 버튼(첫 경고와 전체 건수, title에 전체 문장), 편집 패널(주소의 콜 id, 관련 콜 이동,
// 포커스 복귀)과 접근 권한. 콜 상세 패널은 티켓 03에서 편집 패널로 합쳐졌다 — 경고·관련 콜 구역은 그대로 옮겨졌다.
// 날짜를 한참 과거로 두어 "지금"이 모든 표시 종료보다 늦다(시계를 흉내 내지 않는다).
const accounts = {
  counter: { accountId: "t13_counter", password: "Ticket13!counter" },
  waiter: { accountId: "t13_waiter", password: "Ticket13!waiter" }
} as const;
type Role = keyof typeof accounts;

const monthKey = "2025-05";
const serviceDate = "2025-05-16";

let monthId = "";
let frontCallId = "";
let backCallId = "";
let thirdCallId = "";
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
  const employee = await seedEmployee(`E2E-T13-${role.toUpperCase()}`, `T13 ${role}`, "OPERATIONS", sortOrder);
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

async function createCall(input: { therapistId: string; roomId: string; courseId: string; memo: string; status: string; startTime: string; actualEntryTime?: string; paymentMethodCode?: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: monthId,
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      startTime: input.startTime,
      actualEntryTime: input.actualEntryTime ?? null,
      roomId: input.roomId,
      courseId: input.courseId,
      customerMemo: input.memo,
      status: input.status,
      paymentMethodCode: input.paymentMethodCode ?? null
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId }
  });
  return call.id as string;
}

// 코스 정책과 운영월은 다른 스펙의 화면에도 보인다(코스 화면은 가장 이른 운영월의 정책을 보인다).
// 이 스펙이 만든 것은 끝나면 지운다.
async function removeSeededMasters() {
  await (prisma as any).coursePolicy.deleteMany({ where: { name: "T13 A", effectiveFromMonth: monthKey } });
  if (createdMonth) await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
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

test.describe("티켓 13 원장 행 경고와 콜 상세 패널", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount("counter", 9401);
    await seedAccount("waiter", 9402);
    createdMonth = !(await (prisma as any).operatingMonth.findUnique({ where: { monthKey } }));
    const month = await (prisma as any).operatingMonth.upsert({
      where: { monthKey },
      update: { status: "작성중" },
      create: {
        monthKey,
        startDate: new Date(`${monthKey}-01T00:00:00.000Z`),
        endDate: new Date(`${monthKey}-31T00:00:00.000Z`),
        status: "작성중"
      }
    });
    monthId = month.id;
    await cleanup();

    const room = await (prisma as any).room.upsert({
      where: { sortOrder: 94001 },
      update: { displayName: "T13 호실", isActive: true },
      create: { displayName: "T13 호실", migrationReferenceName: "T13-ROOM", sortOrder: 94001, isActive: true }
    });
    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
    const policy = {
      name: "T13 A",
      durationMinutes: 60,
      basePrice: 1500000,
      requiresSecondTherapist: false,
      tvDisplayName: "T13 A",
      effectiveToMonth: null,
      isActive: true
    };
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policy } });
    }
    // 수당이 없는 마사지사라 방문완료 콜이 계산 오류 경고가 된다.
    const therapist = await seedEmployee("E2E-T13-THR-1", "T13 마사지사", "THERAPIST", 9411);
    for (const [value, sortOrder] of [["15:00", 94015], ["16:00", 94016], ["17:00", 94017]] as const) {
      await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
    }

    // 15:00 사용중 콜은 16:00 예약에 양보해 표시 종료가 16:00이고 끝나지 않았다.
    frontCallId = await createCall({ therapistId: therapist.id, roomId: room.id, courseId: course.id, memo: "T13 앞 콜", status: "IN_USE", startTime: "15:00", actualEntryTime: "15:20" });
    backCallId = await createCall({ therapistId: therapist.id, roomId: room.id, courseId: course.id, memo: "T13 뒤 콜", status: "RESERVED", startTime: "16:00" });
    thirdCallId = await createCall({
      therapistId: therapist.id,
      roomId: room.id,
      courseId: course.id,
      memo: "T13 수당 없음",
      status: "VISIT_COMPLETE",
      startTime: "17:00",
      paymentMethodCode: "CASH"
    });
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await removeSeededMasters();
    await prisma.$disconnect();
  });

  function line(page: Page, callId: string) {
    return page.locator(`[data-ledger-line][data-service-call-id="${callId}"]`);
  }

  // 경고 버튼(티켓 03): aria-label이 "경고 N건: 첫 경고"다. 보이는 글자는 "▲ N"뿐이고 전체 문장은 title에 있다.
  function warningsButton(page: Page, callId: string) {
    return line(page, callId).getByRole("button", { name: /^경고 \d+건:/ });
  }

  test("행에는 경고 버튼 하나(첫 경고와 전체 건수)만 보이고, 저장 상태는 같은 칸의 다른 자리에 있다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    // 경고가 하나면 건수가 1이고, title에도 그 한 문장만 있다.
    const back = warningsButton(page, backCallId);
    await expect(back).toHaveAccessibleName("경고 1건: 앞 시술이 아직 끝나지 않았습니다");
    await expect(back).toHaveAttribute("title", "앞 시술이 아직 끝나지 않았습니다");

    // thirdCallId는 방문완료라 완료·취소 묶음에 있고, 그 묶음은 기본으로 접혀 있다(스펙 D16).
    await page.getByRole("button", { name: "완료·취소·노쇼 1건" }).click();
    // 경고가 둘이면 전체 건수(2)가 보이고, title에 둘 다(줄바꿈으로) 있다 — "+1"이 아니라 총 건수다.
    const third = warningsButton(page, thirdCallId);
    await expect(third).toHaveAccessibleName("경고 2건: 앞 시술이 아직 끝나지 않았습니다");
    await expect(third).toHaveAttribute("title", "앞 시술이 아직 끝나지 않았습니다\n계산 오류");
    // 아직 이 화면에서 고치지 않은 행(idle)은 저장 칩이 보이지 않는다 — 경고와 저장은 같은 칸의 다른 표시다.
    await expect(line(page, thirdCallId).locator("[data-line-save-state]")).not.toContainText("저장");

    // 앞 콜에는 양보 경고가 그대로 남는다(12시간제로 말한다).
    await expect(warningsButton(page, frontCallId)).toHaveAccessibleName("경고 1건: 4:00 예약이 있습니다");
  });

  test("경고를 누르면 편집 패널이 열리고 주소에 콜 id가 남으며, 닫으면 포커스가 그 행의 시간 버튼으로 돌아온다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    // thirdCallId는 방문완료라 완료·취소 묶음에 있고, 그 묶음은 기본으로 접혀 있다(스펙 D16).
    await page.getByRole("button", { name: "완료·취소·노쇼 1건" }).click();
    await warningsButton(page, thirdCallId).click();

    await expect(page).toHaveURL(new RegExp(`call=${thirdCallId}$`));
    const panel = page.getByRole("complementary", { name: /^콜 상세 · 17:00/ });
    await expect(panel).toBeVisible();
    const warningsRegion = panel.getByRole("region", { name: "경고" });
    await expect(warningsRegion.getByRole("listitem")).toHaveCount(2);
    await expect(warningsRegion.getByText("앞 시술이 아직 끝나지 않았습니다")).toBeVisible();
    await expect(warningsRegion.getByText("계산 오류")).toBeVisible();
    await expect(line(page, thirdCallId)).toHaveAttribute("data-selected", "true");
    // 원장의 날짜는 그대로다.
    await expect(page).toHaveURL(new RegExp(`serviceDate=${serviceDate}`));

    await panel.getByRole("button", { name: "닫기" }).click();
    await expect(panel).toHaveCount(0);
    await expect(page).not.toHaveURL(/call=/);
    // 패널을 연 것이 경고 버튼이어도, 닫으면 그 행의 시간(상세 열기) 버튼으로 포커스가 돌아온다(원장 공통 규칙, 티켓 03).
    await expect(line(page, thirdCallId).locator("[data-call-open]")).toBeFocused();
  });

  test("주소의 콜 id로 바로 열리고, 관련 콜을 누르면 같은 원장의 그 콜로 옮겨 간다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}&call=${backCallId}`);

    const panel = page.getByRole("complementary", { name: /^콜 상세 · 16:00/ });
    await expect(panel).toBeVisible();
    await expect(line(page, backCallId)).toHaveAttribute("data-selected", "true");

    await panel.getByRole("region", { name: "관련 콜" }).locator(`[data-related-call="${frontCallId}"]`).click();
    await expect(page).toHaveURL(new RegExp(`serviceDate=${serviceDate}&call=${frontCallId}$`));
    await expect(page.getByRole("complementary", { name: /^콜 상세 · 15:00/ })).toBeVisible();
    await expect(line(page, frontCallId)).toHaveAttribute("data-selected", "true");

    // 관련 콜로 옮겨 다녀도 닫으면 그 콜은 더 이상 골라진 상태가 아니다.
    await page.getByRole("complementary", { name: /^콜 상세/ }).getByRole("button", { name: "닫기" }).click();
    await expect(page).not.toHaveURL(/call=/);
    await expect(line(page, frontCallId)).toHaveAttribute("data-selected", "false");
  });

  test("행의 경고 버튼으로 열고 관련 콜로 옮긴 뒤 닫으면 처음 연 행의 시간 버튼에 포커스가 돌아온다", async ({ page }) => {
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    await warningsButton(page, backCallId).click();
    const panel = page.getByRole("complementary", { name: /^콜 상세 · 16:00/ });
    await panel.getByRole("region", { name: "관련 콜" }).locator(`[data-related-call="${frontCallId}"]`).click();
    await expect(page.getByRole("complementary", { name: /^콜 상세 · 15:00/ })).toBeVisible();

    await page.getByRole("complementary", { name: /^콜 상세/ }).getByRole("button", { name: "닫기" }).click();
    await expect(line(page, backCallId).locator("[data-call-open]")).toBeFocused();
  });

  for (const width of [1440, 1024, 390]) {
    test(`패널이 열려도 ${width}px에서 문서가 가로로 넘치지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await login(page, accounts.counter.accountId, accounts.counter.password);
      await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}&call=${thirdCallId}`);

      await expect(page.getByRole("complementary", { name: /^콜 상세/ })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("390px(휴대폰 폭)에서는 줄을 눌러도 읽기 전용 패널이라 입력칸이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}&call=${thirdCallId}`);

    const panel = page.getByRole("complementary", { name: /^콜 상세 · 17:00/ });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("region", { name: "경고" }).getByText("앞 시술이 아직 끝나지 않았습니다")).toBeVisible();
    await expect(panel.locator("input, select, textarea")).toHaveCount(0);
  });

  test("웨이터는 콜 원장과 편집 패널 주소에 들어가지 못한다", async ({ page }) => {
    await login(page, accounts.waiter.accountId, accounts.waiter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}&call=${backCallId}`);
    await expect(page).toHaveURL(/\/rooms$/);
    await expect(page.getByRole("complementary", { name: /콜 상세/ })).toHaveCount(0);
  });
});
