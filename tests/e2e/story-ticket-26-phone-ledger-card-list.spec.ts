import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 티켓 26: 휴대폰 폭(600px 미만)에서는 원장 탭이 넓은 표 대신 짧은 카드 목록(예약시각, 객실, 코스,
// Therapist, 상태, 첫 경고)을 보여 주고, 빠른 예약(가능 코스)과 표 편집(새 행 직접 입력)은 숨긴다.
// 태블릿 폭 이상에서는 반대로 넓은 표가 보이고 카드 목록은 숨는다. 카드를 누르면 콜 상세 패널이
// (이미 읽기 전용인) 그대로 열린다.
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
  return (prisma as any).employee.upsert({
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

test.describe("티켓 26 휴대폰 원장 카드 목록", () => {
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
      opsCallCredit: 1,
      earcarePoolAmount: 0,
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
    backCallId = await createCall({ therapistId: therapist.id, roomId: room.id, courseId: course.id, memo: "T26 뒤 콜", status: "RESERVED", startTime: "16:00" });
  });

  test.afterAll(async () => {
    await cleanup();
    await removeSeededMasters();
    await prisma.$disconnect();
  });

  test("휴대폰 폭(390px): 넓은 표·빠른 예약·표 편집은 숨고, 카드 목록이 예약시각·객실·코스·Therapist·상태·첫 경고를 보여 준다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    // 넓은 표의 축소판이 아니라 아예 다른 렌더다: 표 행과 "새 콜 행 추가", "가능 코스"는 숨는다.
    await expect(page.locator(`tr[data-service-call-id="${noWarningCallId}"]`)).toBeHidden();
    await expect(page.getByRole("button", { name: "새 콜 행 추가" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "가능 코스" })).toBeHidden();

    const list = page.getByRole("list", { name: "원장 카드 목록" });
    await expect(list).toBeVisible();

    const noWarningCard = page.locator(`button[data-service-call-id="${noWarningCallId}"]`);
    await expect(noWarningCard).toBeVisible();
    await expect(noWarningCard).toContainText("11:00");
    await expect(noWarningCard).toContainText("T26 호실");
    await expect(noWarningCard).toContainText("T26 A");
    await expect(noWarningCard).toContainText("T26 마사지사");
    await expect(noWarningCard).toContainText("예약");
    await expect(noWarningCard).not.toContainText("끝나지 않았습니다");

    // 첫 경고(서비스가 준 우선순위의 첫 항목)만 보인다.
    const backCard = page.locator(`button[data-service-call-id="${backCallId}"]`);
    await expect(backCard).toContainText("앞 시술이 아직 끝나지 않았습니다");

    // 문서가 가로로 넘치지 않는다(ticket 13의 같은 점검을 카드 목록에도 적용).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("휴대폰 폭에서 카드를 누르면 읽기 전용 상세 패널이 열리고, 닫으면 그 카드로 포커스가 돌아온다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    const backCard = page.locator(`button[data-service-call-id="${backCallId}"]`);
    await backCard.click();

    await expect(page).toHaveURL(new RegExp(`call=${backCallId}$`));
    const panel = page.getByRole("complementary", { name: /^콜 상세 · 16:00/ });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("앞 시술이 아직 끝나지 않았습니다")).toBeVisible();
    // 읽기 전용: 입력 칸이 없다(명세 F08 — 빠른 예약·표 편집과 분리된 패널).
    await expect(panel.locator("input, select, textarea")).toHaveCount(0);

    await panel.getByRole("button", { name: "닫기" }).click();
    await expect(page).not.toHaveURL(/call=/);
    await expect(backCard).toBeFocused();
  });

  test("태블릿 폭(768px) 이상: 넓은 표와 빠른 예약이 보이고 카드 목록은 숨는다", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await login(page, accounts.counter.accountId, accounts.counter.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);

    await expect(page.getByRole("list", { name: "원장 카드 목록" })).toBeHidden();
    await expect(page.locator(`tr[data-service-call-id="${noWarningCallId}"]`)).toBeVisible();
    await expect(page.getByRole("button", { name: "새 콜 행 추가" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "가능 코스" })).toBeVisible();
  });
});
