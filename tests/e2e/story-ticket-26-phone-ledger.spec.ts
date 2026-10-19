import { testEmployees } from "./support/test-employees";
import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 티켓 26 → 콜 원장 흐름 재구성 티켓 05(스펙 D23): 휴대폰 폭(600px 미만)도 태블릿 이상과 같은 흐름별 원장
// 목록을 쓰고, 줄을 누르면 편집 패널이 전체 화면 시트로 열린다. 휴대폰 폭은 여전히 읽기 전용이다 — 빠른 예약,
// 입장·결제 같은 할 일 버튼, 패널의 입력칸이 없다.
// 경고는 ticket 13과 같은 트릭으로 만든다: 날짜를 한참 과거로 두면 "지금"이 모든 표시 종료보다
// 늦어, 같은 Therapist의 다른 사용중 콜이 있으면 "앞 시술이 아직 끝나지 않았습니다"가 안정적으로 붙는다.
// 영업일은 첫 활성 시간 슬롯(기본 시드 11:00)부터 시작해 자정을 넘어 이어지므로, 그 이전 시각(예:
// 10:00)은 "영업일의 뒤"로 계산된다(businessMinute). 경고 없는 비교 대상 콜은 그 함정을 피해
// 사용중 콜(15:00)보다 뚜렷이 앞선 시각(11:00)으로 둔다.
const accounts = {
  counter: { accountId: "t26_counter", password: "Ticket26!counter" }
} as const;

const monthKey = "2025-06";
const serviceDate = "2025-06-16";

let monthId = "";
let noWarningCallId = "";
let frontCallId = "";
let backCallId = "";
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

async function seedAccount(sortOrder: number) {
  const account = accounts.counter;
  const employee = await seedEmployee("E2E-T26-COUNTER", "T26 counter", "OPERATIONS", sortOrder);
  const data = {
    email: `${account.accountId}@example.local`,
    passwordHash: await hash(account.password, argon2idOptions),
    role: "counter",
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

async function createCall(input: { therapistId: string; roomId: string; courseId: string; memo: string; status: string; startTime: string; actualEntryTime?: string }) {
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
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapistId }
  });
  return call.id as string;
}

// 코스 정책과 운영월은 다른 스펙의 화면에도 보인다(코스 화면은 가장 이른 운영월의 정책을 보인다).
// 이 스펙이 만든 것은 끝나면 지운다(ticket 13과 같은 방식).
async function removeSeededMasters() {
  await (prisma as any).coursePolicy.deleteMany({ where: { name: "T26 A", effectiveFromMonth: monthKey } });
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

test.describe("티켓 26 휴대폰 원장(흐름별 목록과 전체 화면 시트)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedAccount(94260);
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
      where: { sortOrder: 94260 },
      update: { displayName: "T26 호실", isActive: true },
      create: { displayName: "T26 호실", migrationReferenceName: "T26-ROOM", sortOrder: 94260, isActive: true }
    });
    const course = await (prisma as any).course.upsert({ where: { code: "A" }, update: { isActive: true }, create: { code: "A", isActive: true } });
    const existingPolicy = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
    const policy = {
      name: "T26 A",
      durationMinutes: 60,
      basePrice: 1500000,
      requiresSecondTherapist: false,
      tvDisplayName: "T26 A",
      effectiveToMonth: null,
      isActive: true
    };
    if (existingPolicy) {
      await (prisma as any).coursePolicy.update({ where: { id: existingPolicy.id }, data: policy });
    } else {
      await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policy } });
    }
    const therapist = await seedEmployee("E2E-T26-THR-1", "T26 마사지사", "THERAPIST", 94261);
    for (const [value, sortOrder] of [["11:00", 94260], ["15:00", 94261], ["16:00", 94262]] as const) {
      await (prisma as any).timeSlot.upsert({ where: { value }, update: { isActive: true }, create: { value, sortOrder, isActive: true } });
    }

    // 경고 없는 콜(비교 대상).
    noWarningCallId = await createCall({ therapistId: therapist.id, roomId: room.id, courseId: course.id, memo: "T26 예약", status: "RESERVED", startTime: "11:00" });
    // 15:00 사용중 콜은 16:00 예약에 양보해 표시 종료가 16:00이고, 날짜가 한참 과거라 "지금"이 그보다 늦다.
    frontCallId = await createCall({ therapistId: therapist.id, roomId: room.id, courseId: course.id, memo: "T26 앞 콜", status: "IN_USE", startTime: "15:00", actualEntryTime: "15:20" });
    // 1018 티켓 03: 지난 날짜의 사용중 콜은 읽을 때 자동 청소 중이 끝낸다. 앞 시술 미완료는 종료 취소한 앞 콜에서만 남으므로
    // 앞 콜을 청소중 → 사용중으로 되돌린 이력을 둔다.
    await (prisma as any).serviceCallStatusHistory.create({
      data: {
        serviceCallId: frontCallId,
        previousStatus: "CLEANING",
        newStatus: "IN_USE",
        changedByAccountId: (await (prisma as any).userAccount.findFirstOrThrow({ select: { id: true } })).id
      }
    });
    backCallId = await createCall({ therapistId: therapist.id, roomId: room.id, courseId: course.id, memo: "T26 뒤 콜", status: "RESERVED", startTime: "16:00" });
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await cleanup();
    await removeSeededMasters();
    await prisma.$disconnect();
  });

  test("휴대폰 폭(390px): 같은 흐름별 목록이 시간·객실·코스·Therapist·상태·경고를 보이고, 빠른 예약과 할 일 버튼은 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    await expect(page.locator("[data-call-ledger-list]")).toBeVisible();
    await expect(page.getByRole("list", { name: "원장 카드 목록" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "빠른 예약" })).toBeHidden();

    const noWarningLine = page.locator(`[data-ledger-line][data-service-call-id="${noWarningCallId}"]`);
    await expect(noWarningLine).toBeVisible();
    await expect(noWarningLine).toContainText("11:00");
    await expect(noWarningLine).toContainText("T26 호실");
    await expect(noWarningLine).toContainText("T26 A");
    await expect(noWarningLine).toContainText("T26 마사지사");
    await expect(noWarningLine).toContainText("예약");
    await expect(noWarningLine.getByRole("button", { name: /^경고/ })).toHaveCount(0);

    // 경고는 줄의 경고 버튼에 개수와 첫 경고로 보인다.
    const backLine = page.locator(`[data-ledger-line][data-service-call-id="${backCallId}"]`);
    await expect(backLine.getByRole("button", { name: /^경고 1건: 앞 시술이 아직 끝나지 않았습니다/ })).toBeVisible();

    // 읽기 전용: 예약 줄의 입장, 사용중 줄의 결제가 없다.
    await expect(page.locator("[data-call-ledger-list]").getByRole("button", { name: /입장|결제/ })).toHaveCount(0);

    // 줄은 화면 폭 안에 들어가고, 문서가 가로로 넘치지 않는다.
    const box = await noWarningLine.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("휴대폰 폭에서 줄을 누르면 읽기 전용 패널이 전체 화면 시트로 열리고, 닫으면 그 줄로 포커스가 돌아온다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    const backOpen = page.locator(`[data-call-open="${backCallId}"]`);
    await backOpen.click();

    await expect(page).toHaveURL(new RegExp(`call=${backCallId}$`));
    const panel = page.getByRole("complementary", { name: /^콜 상세 · 16:00/ });
    await expect(panel).toBeVisible();
    // 전체 화면 시트: 화면 전체를 덮고(도크까지), 포커스는 시트 안의 닫기 버튼이다.
    const sheet = await panel.boundingBox();
    expect(sheet).toEqual({ x: 0, y: 0, width: 390, height: 844 });
    const close = panel.getByRole("button", { name: "닫기" });
    await expect(close).toBeFocused();
    await expect(panel.getByText("앞 시술이 아직 끝나지 않았습니다")).toBeVisible();
    // 읽기 전용: 입력 칸이 없다(명세 F08).
    await expect(panel.locator("input, select, textarea")).toHaveCount(0);

    await close.click();
    await expect(page).not.toHaveURL(/call=/);
    await expect(backOpen).toBeFocused();

    // Esc도 시트를 닫는다(시트 뒤의 줄은 보이지 않으므로).
    await backOpen.click();
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/call=/);
    await expect(backOpen).toBeFocused();
  });

  test("태블릿 폭(768px) 이상: 같은 목록에 빠른 예약과 할 일 버튼이 있고, 패널은 화면을 덮지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    // 콜 원장 흐름 재구성(티켓 03): 넓은 표는 흐름별 원장 목록으로, 1018 티켓 02에서 두 줄 행 목록([data-ledger-line])으로 바뀌었고,
    // 표 아래 "새 콜 행 추가"는 없어졌다(새 콜은 빠른 예약으로만 만든다).
    const noWarningLine = page.locator(`[data-ledger-line][data-service-call-id="${noWarningCallId}"]`);
    await expect(noWarningLine).toBeVisible();
    await expect(noWarningLine.getByRole("button", { name: "11:00 콜 입장" })).toBeVisible();
    await expect(page.getByRole("button", { name: "새 콜 행 추가" })).toHaveCount(0);
    // 가능 코스(빠른 예약의 Therapist·코스 단계)는 티켓 20부터 패널 안으로 옮겨, 태블릿 폭에서도
    // 머리의 "빠른 예약" 버튼으로만 보인다(명세 F08).
    await expect(page.getByRole("button", { name: "빠른 예약" })).toBeVisible();

    await page.locator(`[data-call-open="${noWarningCallId}"]`).click();
    const panel = page.getByRole("complementary", { name: /^콜 상세 · 11:00/ });
    await expect(panel).toBeVisible();
    expect(await panel.evaluate((node) => getComputedStyle(node).position)).not.toBe("fixed");
  });
});
