import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { selectGridOptionByValue } from "./support/call-grid";


const users = [
  { accountId: "story21_administrator", role: "administrator", password: "Story21!administrator", landing: "/live" },
  { accountId: "story21_counter", role: "counter", password: "Story21!counter", landing: "/calls" },
  { accountId: "story21_waiter", role: "waiter", password: "Story21!waiter", landing: "/rooms" }
];

type SeededData = {
  openMonthId: string;
  lockedMonthId: string;
  roomId: string;
  courseId: string;
  therapist1Id: string;
  therapist2Id: string;
};

let seededData: SeededData;


async function seedAuthAccount(input: { accountId: string; email: string; staffCode: string; role: string; secret: string }) {
  const sortOrder = 92100 + [...input.staffCode].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: input.accountId,
      employeeGroup: "OPERATIONS",
      position: input.role === "waiter" ? "웨이터" : input.role === "counter" ? "카운터" : "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    },
    create: {
      staffCode: input.staffCode,
      displayName: input.accountId,
      employeeGroup: "OPERATIONS",
      position: input.role === "waiter" ? "웨이터" : input.role === "counter" ? "카운터" : "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
  const passwordHash = await hash(input.secret, argon2idOptions);
  await (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: {
      email: input.email,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: input.email,
      accountId: input.accountId,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function seedStoryData(): Promise<SeededData> {
  const openMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2032-01" },
    update: {
      startDate: new Date("2032-01-01T00:00:00.000Z"),
      endDate: new Date("2032-01-31T00:00:00.000Z"),
      status: "작성중"
    },
    create: {
      monthKey: "2032-01",
      startDate: new Date("2032-01-01T00:00:00.000Z"),
      endDate: new Date("2032-01-31T00:00:00.000Z"),
      status: "작성중"
    }
  });
  const lockedMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2032-02" },
    update: {
      startDate: new Date("2032-02-01T00:00:00.000Z"),
      endDate: new Date("2032-02-29T00:00:00.000Z"),
      status: "잠금"
    },
    create: {
      monthKey: "2032-02",
      startDate: new Date("2032-02-01T00:00:00.000Z"),
      endDate: new Date("2032-02-29T00:00:00.000Z"),
      status: "잠금"
    }
  });
  const room = await (prisma as any).room.upsert({
    where: { sortOrder: 92101 },
    update: {
      displayName: "E2E 921 호실",
      migrationReferenceName: "E2E21-ROOM",
      isActive: true
    },
    create: {
      displayName: "E2E 921 호실",
      migrationReferenceName: "E2E21-ROOM",
      sortOrder: 92101,
      isActive: true
    }
  });
  const course = await (prisma as any).course.upsert({
    where: { code: "E2E21A" },
    update: { isActive: true },
    create: { code: "E2E21A", isActive: true }
  });
  const existingPolicy = await (prisma as any).coursePolicy.findFirst({
    where: { courseId: course.id, effectiveFromMonth: "2032-01" }
  });
  if (existingPolicy) {
    await (prisma as any).coursePolicy.update({
      where: { id: existingPolicy.id },
      data: {
        name: "E2E 기본60",
        durationMinutes: 60,
        basePrice: 1500000,
        requiresSecondTherapist: false,
        tvDisplayName: "E2E 기본60",
        effectiveToMonth: null,
        isActive: true
      }
    });
  } else {
    await (prisma as any).coursePolicy.create({
      data: {
        courseId: course.id,
        name: "E2E 기본60",
        durationMinutes: 60,
        basePrice: 1500000,
        requiresSecondTherapist: false,
        tvDisplayName: "E2E 기본60",
        effectiveFromMonth: "2032-01",
        effectiveToMonth: null,
        isActive: true
      }
    });
  }
  const therapist1 = await seedEmployee("E2E21-THR-001", "E2E 마사지사1", "THERAPIST", 92101);
  const therapist2 = await seedEmployee("E2E21-THR-002", "E2E 마사지사2", "THERAPIST", 92102);

  // 빠른 예약의 가능 코스 칩이 바로 "가능"으로 뜨려면 코스 수당이 있어야 한다(없으면 "불가"+경고 확인
  // 경로가 되는데, 그 경로는 티켓 21 스펙이 전담해서 본다).
  const existingRate = await (prisma as any).therapistCourseRate.findFirst({
    where: { therapistId: therapist1.id, courseId: course.id, effectiveFromMonth: "2032-01" }
  });
  const rateData = { amount: 700000, effectiveToMonth: null, isActive: true };
  if (existingRate) {
    await (prisma as any).therapistCourseRate.update({ where: { id: existingRate.id }, data: rateData });
  } else {
    await (prisma as any).therapistCourseRate.create({
      data: { therapistId: therapist1.id, courseId: course.id, effectiveFromMonth: "2032-01", ...rateData }
    });
  }

  await (prisma as any).timeSlot.upsert({
    where: { value: "11:00" },
    update: { isActive: true },
    create: { value: "11:00", sortOrder: 92101, isActive: true }
  });
  // 상태/할인/결제수단/확인값 코드는 공용 마스터 시드(defaultCodeItems)가 이미 제공한다. 같은 표시명으로
  // 한국어 code를 또 만들면 콤보박스에 같은 라벨이 두 개 뜨고 다른 스펙의 드롭다운도 함께 오염된다.

  return {
    openMonthId: openMonth.id,
    lockedMonthId: lockedMonth.id,
    roomId: room.id,
    courseId: course.id,
    therapist1Id: therapist1.id,
    therapist2Id: therapist2.id
  };
}

async function cleanupStoryCalls(operatingMonthId: string) {
  const calls = await (prisma as any).serviceCall.findMany({
    where: {
      operatingMonthId,
      customerMemo: { startsWith: "E2E story 2.1" }
    },
    select: { id: true }
  });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length === 0) return;

  await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
  await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, sortOrder: number) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: {
      displayName,
      employeeGroup,
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    },
    create: {
      staffCode,
      displayName,
      employeeGroup,
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    }
  });
}

/** 티켓 03: 날짜 clamp·잠금 테스트는 화면 입력 없이 그냥 보일 콜을 직접 시드한다(새 콜은 빠른 예약으로만 만든다). */
async function seedCall(input: { operatingMonthId: string; serviceDate: string; memo: string }) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: input.operatingMonthId,
      serviceDate: new Date(`${input.serviceDate}T00:00:00.000Z`),
      startTime: "11:00",
      roomId: seededData.roomId,
      courseId: seededData.courseId,
      customerMemo: input.memo,
      status: "RESERVED"
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: seededData.therapist1Id }
  });
  return call;
}

function line(page: Page, callId: string) {
  return page.locator(`[data-ledger-line][data-service-call-id="${callId}"]`);
}

function panel(page: Page) {
  return page.getByRole("complementary", { name: /^콜 상세/ });
}

function quickBookingDialog(page: Page) {
  return page.getByRole("dialog", { name: "빠른 예약" });
}

async function openQuickBooking(page: Page) {
  await page.getByRole("button", { name: "빠른 예약" }).click();
  await expect(quickBookingDialog(page)).toBeVisible();
}

test.describe("Story 2.1 날짜별 콜 원장 그리드 조회와 기본 입력", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const user of users) {
      await seedAuthAccount({
        accountId: user.accountId,
        email: `${user.accountId}@example.local`,
        staffCode: `E2E21-${user.role.toUpperCase()}`,
        role: user.role,
        secret: user.password
      });
    }
    seededData = await seedStoryData();
    await cleanupStoryCalls(seededData.openMonthId);
  });

  test("counter는 날짜별 빈 상태를 보고, 빠른 예약으로 만든 콜에 stable ID와 담당자 row가 저장된다", async ({ page }) => {
    const memo = `E2E story 2.1 memo ${Date.now().toString(36)}`;

    await login(page, "story21_counter", "Story21!counter");
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-01-05`);

    await expect(page.getByRole("heading", { name: /콜|예약|원장/, level: 1 })).toBeVisible();
    await expect(page.getByText("이 날짜의 콜이 없습니다")).toBeVisible();
    await expect(page.getByRole("button", { name: "빠른 예약" })).toBeEnabled();
    // 티켓 03: 콜이 없으면 표 자체가 숨고(빈 상태 문구만 보인다) 콜이 생겨야 머리글이 뜬다 —
    // "코스" 머리 확인은 빠른 예약으로 콜을 만든 뒤로 옮긴다.
    await expect(page.getByLabel("운영월")).toHaveValue(seededData.openMonthId);
    await expect(page.getByLabel("조회날짜")).toHaveValue("2032-01-05");

    // 티켓 03: 새 콜은 표 아래 "새 콜 행 추가"가 아니라 빠른 예약으로만 만든다.
    await openQuickBooking(page);
    const dialog = quickBookingDialog(page);

    await dialog.getByLabel("고객/메모").fill(memo);
    await dialog.getByRole("button", { name: "다음" }).click();

    await dialog.getByLabel("조회날짜").fill("2032-01-05");
    await dialog.getByLabel("시간").selectOption("11:00");
    await dialog.getByRole("button", { name: "다음" }).click();

    const courseButton = dialog.getByRole("button", { name: /E2E21A 60분 가능/ });
    await expect(courseButton).toBeVisible({ timeout: 10_000 });
    await courseButton.click();
    await dialog.getByRole("button", { name: "다음" }).click();

    await dialog.getByLabel("객실").selectOption({ label: "E2E 921 호실" });
    await dialog.getByLabel("비고").fill("E2E 비고");
    await dialog.getByRole("button", { name: "다음" }).click();

    await expect(dialog.getByText(memo)).toBeVisible();
    await dialog.getByRole("button", { name: "예약 저장" }).click();
    await expect(dialog).toBeHidden();

    const savedCall = await (prisma as any).serviceCall.findFirst({
      where: { customerMemo: memo },
      include: { assignments: true }
    });
    expect(savedCall).toBeTruthy();
    // 저장 직후 그 줄이 선택되고 패널이 열린다(스펙 D20·티켓 20).
    await expect(page).toHaveURL(new RegExp(`call=${savedCall.id}$`));
    await expect(line(page, savedCall.id)).toContainText(memo);
    expect(savedCall.assignments.map((assignment: any) => assignment.assignmentRole)).toEqual(["THERAPIST_1"]);
    // 콜이 생기면 원장 목록이 보인다.
    await expect(page.getByRole("list", { name: "콜 원장 목록" })).toBeVisible();

    // 마사지사2·할인구분·결제수단·확인값은 빠른 예약에 없다 — 편집 패널에서 고친다(스펙 D20).
    const edit = panel(page);
    await expect(edit).toBeVisible();
    await selectGridOptionByValue(page, edit, "마사지사2", seededData.therapist2Id);
    await selectGridOptionByValue(page, edit, "할인구분", "BIRTHDAY");
    await edit.getByRole("region", { name: "결제" }).getByText("현금", { exact: true }).click();
    await edit.getByText("더 보기").click();
    await selectGridOptionByValue(page, edit, "확인값", "Y");
    await expect(edit.locator('[data-save-state="saved"]')).toContainText("저장됨");
    // REQ-007: 결제수단을 고른 순간 선결제 매출로 잡히므로 예약 상태도 "계산됨"이다.
    await expect(edit.getByRole("region", { name: "결제" }).getByText("계산됨")).toBeVisible();

    const updatedCall = await (prisma as any).serviceCall.findUnique({
      where: { id: savedCall.id },
      include: { assignments: true }
    });
    expect(updatedCall).toMatchObject({
      operatingMonthId: seededData.openMonthId,
      roomId: seededData.roomId,
      courseId: seededData.courseId,
      status: "RESERVED",
      discountTypeCode: "BIRTHDAY",
      paymentMethodCode: "CASH",
      confirmationCode: "Y",
      note: "E2E 비고"
    });
    expect(updatedCall.assignments.map((assignment: any) => assignment.assignmentRole).sort()).toEqual([
      "THERAPIST_1",
      "THERAPIST_2"
    ]);
  });

  test("administrator가 운영월 밖 날짜로 들어와도 조회날짜가 운영월 안으로 고정된다", async ({ page }) => {
    const memo = `E2E story 2.1 clamp ${Date.now().toString(36)}`;
    const call = await seedCall({ operatingMonthId: seededData.openMonthId, serviceDate: "2032-01-31", memo });

    await login(page, "story21_administrator", "Story21!administrator");
    await page.goto(`/calls?operatingMonthId=${seededData.openMonthId}&serviceDate=2032-02-01`);

    // 화면이 운영월 밖 날짜를 마지막 날로 고정하므로 저장이 서버 가드까지 가지 않는다.
    // 서버 가드("운영월 범위를 벗어난 날짜입니다." / OPERATING_MONTH_DATE_OUT_OF_RANGE)는
    // service 단위 테스트가 검증한다.
    await expect(page.getByLabel("조회날짜")).toHaveValue("2032-01-31");
    await expect(line(page, call.id)).toContainText(memo);
  });

  test("잠금 운영월은 read-only로 보이고 패널 칸과 빠른 예약이 잠긴다", async ({ page }) => {
    const memo = `E2E story 2.1 locked ${Date.now().toString(36)}`;
    const call = await seedCall({ operatingMonthId: seededData.lockedMonthId, serviceDate: "2032-02-03", memo });

    await login(page, "story21_counter", "Story21!counter");
    await page.goto(`/calls?operatingMonthId=${seededData.lockedMonthId}&serviceDate=2032-02-03&call=${call.id}`);

    // 잠금 안내는 콜 그리드와 지출 패널 두 곳에 뜬다.
    await expect(page.getByText("잠긴 운영월입니다.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "빠른 예약" })).toBeDisabled();
    const edit = panel(page);
    await expect(edit).toBeVisible();
    await expect(edit.getByRole("combobox", { name: "시간" })).toBeDisabled();
    await expect(edit.getByRole("combobox", { name: "객실" })).toBeDisabled();
  });

  test("non-write role은 /calls direct access와 원장 링크에서 제외된다", async ({ page }) => {
    await login(page, "story21_waiter", "Story21!waiter");
    await page.goto("/calls");

    await expect(page).toHaveURL(/\/rooms$/);
    await expect(page.locator('a[href^="/calls"]')).toHaveCount(0);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });
});
