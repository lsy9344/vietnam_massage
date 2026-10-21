import { testEmployees } from "./support/test-employees";
import { expect, test } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

/**
 * 티켓 34: 미완료 콜(예약·사용중·청소중)이 남은 운영월의 사유 있는 예외 마감(F07, ADR 0005).
 * 33이 만든 "마감 확인 대상 콜" 목록에 확인 체크·사유를 더해, 확인한 뒤 새 대상이 생기면
 * 확정이 거절되고 다시 계산한 목록이 보이는지, 확정하면 예외 사유·확인한 콜·처리자가 그 마감
 * 버전에 남고 재오픈 뒤에도 보존되는지를 확인한다.
 */

type SeededData = {
  monthId: string;
  monthKey: string;
  serviceDate: string;
  firstCallId: string;
  memoPrefix: string;
  accounts: {
    admin: string;
    settlement: string;
  };
};

let seededData: SeededData;

function story34WorkerSuffix(workerIndex: number) {
  return `W${String(workerIndex + 1).padStart(2, "0")}`;
}

function story34MonthKey(workerIndex: number) {
  const monthNumber = workerIndex + 1;
  const year = 2097 + Math.floor((monthNumber - 1) / 12);
  const month = ((monthNumber - 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function utcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

async function storyEmployeeSortOrder(employeeGroup: string, staffCode: string, preferredSortOrder: number) {
  const existing = await (prisma as any).employee.findUnique({ where: { staffCode }, select: { sortOrder: true } });
  if (existing) return existing.sortOrder;

  for (let sortOrder = preferredSortOrder; sortOrder < preferredSortOrder + 100; sortOrder += 1) {
    const conflicting = await (prisma as any).employee.findFirst({ where: { employeeGroup, sortOrder, NOT: { staffCode } }, select: { id: true } });
    if (!conflicting) return sortOrder;
  }

  throw new Error(`No ticket-34 employee sortOrder available for ${employeeGroup}:${staffCode}`);
}

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, sortOrder: number) {
  const safeSortOrder = await storyEmployeeSortOrder(employeeGroup, staffCode, sortOrder);
  return testEmployees.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder: safeSortOrder, isActive: true },
    create: { staffCode, displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder: safeSortOrder, isActive: true }
  });
}

async function seedAuthAccount(input: { accountId: string; password: string; role: string; employeeId: string }) {
  const passwordHash = await hash(input.password, argon2idOptions);
  return (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: { email: `${input.accountId}@example.local`, passwordHash, role: input.role, employeeId: input.employeeId, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: { email: `${input.accountId}@example.local`, accountId: input.accountId, passwordHash, role: input.role, employeeId: input.employeeId, isActive: true, lockedUntil: null, failedLoginCount: 0 }
  });
}

async function upsertCoursePolicy(courseId: string, effectiveFromMonth: string, name: string) {
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId, effectiveFromMonth } });
  const data = {
    name,
    durationMinutes: 60,
    basePrice: 1500000,
    requiresSecondTherapist: false,
    tvDisplayName: name,
    effectiveToMonth: null,
    isActive: true
  };
  if (existing) return (prisma as any).coursePolicy.update({ where: { id: existing.id }, data });
  return (prisma as any).coursePolicy.create({ data: { courseId, effectiveFromMonth, ...data } });
}

async function cleanupStoryData(operatingMonthIds: string[], memoPrefix: string) {
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: { in: operatingMonthIds }, customerMemo: { startsWith: memoPrefix } }, select: { id: true } });
  const callIds = calls.map((call: { id: string }) => call.id);
  if (callIds.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: callIds } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: callIds } } });
  }
}

async function createCall(input: {
  operatingMonthId: string;
  serviceDate: Date;
  startTime: string;
  courseId: string;
  memo: string;
  status: string;
  therapist1Id: string;
}) {
  const call = await (prisma as any).serviceCall.create({
    data: {
      operatingMonthId: input.operatingMonthId,
      serviceDate: input.serviceDate,
      startTime: input.startTime,
      roomId: null,
      courseId: input.courseId,
      customerMemo: input.memo,
      status: input.status,
      discountTypeCode: null,
      paymentMethodCode: null,
      confirmationCode: null
    }
  });
  await (prisma as any).serviceCallAssignment.create({
    data: { serviceCallId: call.id, assignmentRole: "THERAPIST_1", employeeId: input.therapist1Id, isActive: true }
  });
  return call;
}

async function seedStoryData(workerIndex: number): Promise<SeededData> {
  const suffix = story34WorkerSuffix(workerIndex);
  const sortBase = 96340 + workerIndex * 100;
  const monthKey = story34MonthKey(workerIndex);
  const serviceDate = `${monthKey}-02`;
  const memoPrefix = `Ticket34 ${suffix}`;
  const accounts = {
    admin: `ticket34_admin_${suffix.toLowerCase()}`,
    settlement: `ticket34_settlement_${suffix.toLowerCase()}`
  };

  const adminEmployee = await seedEmployee(`E2E34-${suffix}-AUTH-ADMIN`, "E2E34 관리자", "BACKOFFICE", "관리자", sortBase);
  const settlementEmployee = await seedEmployee(`E2E34-${suffix}-AUTH-SETTLE`, "E2E34 정산담당", "BACKOFFICE", "정산", sortBase + 1);
  await seedAuthAccount({ accountId: accounts.admin, password: "Ticket34!admin", role: "administrator", employeeId: adminEmployee.id });
  await seedAuthAccount({ accountId: accounts.settlement, password: "Ticket34!settlement", role: "settlement_manager", employeeId: settlementEmployee.id });

  const therapist = await seedEmployee(`E2E34-${suffix}-THR-001`, `E2E34 마사지사 ${suffix}`, "THERAPIST", "마사지사", sortBase + 10);

  const month = await (prisma as any).operatingMonth.upsert({
    where: { monthKey },
    update: { startDate: utcDate(serviceDate), endDate: utcDate(serviceDate), status: "검토중" },
    create: { monthKey, startDate: utcDate(serviceDate), endDate: utcDate(serviceDate), status: "검토중" }
  });
  await cleanupStoryData([month.id], memoPrefix);
  await (prisma as any).monthlyClosing.deleteMany({ where: { operatingMonthId: month.id } });

  const courseCode = `E2E34-${suffix}-VALID`;
  const course = await (prisma as any).course.upsert({ where: { code: courseCode }, update: { isActive: true }, create: { code: courseCode, isActive: true } });
  await upsertCoursePolicy(course.id, monthKey, `Ticket34 ${suffix} valid`);

  const firstCall = await createCall({
    operatingMonthId: month.id,
    serviceDate: utcDate(serviceDate),
    startTime: "17:00",
    courseId: course.id,
    memo: `${memoPrefix} reserved pending close 1`,
    status: "예약",
    therapist1Id: therapist.id
  });

  return { monthId: month.id, monthKey, serviceDate, firstCallId: firstCall.id, memoPrefix, accounts };
}

test.describe("Ticket 34 close with unfinished calls and a recorded reason", () => {
  test.beforeAll(async ({}, workerInfo) => {
    seededData = await seedStoryData(workerInfo.workerIndex);
  });

  test.afterAll(async () => {
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("confirmation is rejected and shows the refreshed list when a new pending-close call appears after the checklist loaded, then succeeds once the new list is confirmed; the exception survives reopen (F07/ADR 0005, ticket 34)", async ({ page }) => {
    await login(page, seededData.accounts.settlement, "Ticket34!settlement");
    await page.goto(`/closing?operatingMonthId=${seededData.monthId}`);

    const pendingSection = page.getByRole("region", { name: "마감 전 점검" }).locator("section", { hasText: "마감 확인 대상 콜" }).first();
    await expect(pendingSection).toContainText("1건");

    const confirmButton = page.getByRole("button", { name: "마감 확정" });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    const submitButton = dialog.getByRole("button", { name: "지급 기록 확정" });
    await expect(submitButton).toBeDisabled();
    await dialog.getByRole("checkbox", { name: /위 1건을 확인했습니다/ }).check();
    await dialog.getByLabel("예외 마감 사유").fill("기존 예약은 다음달 초 방문이 확정되어 예외로 마감합니다");
    await expect(submitButton).toBeEnabled();

    // 확인 체크 이후, 다이얼로그를 제출하기 전에 새 마감 확인 대상 콜이 하나 더 생긴다
    // (다른 화면에서 새 예약이 들어온 상황을 흉내낸다).
    const secondCall = await createCall({
      operatingMonthId: seededData.monthId,
      serviceDate: utcDate(seededData.serviceDate),
      startTime: "19:00",
      courseId: (await (prisma as any).serviceCall.findUnique({ where: { id: seededData.firstCallId }, select: { courseId: true } })).courseId,
      memo: `${seededData.memoPrefix} reserved pending close 2 (appeared mid-review)`,
      status: "사용중",
      therapist1Id: (await (prisma as any).serviceCallAssignment.findFirst({ where: { serviceCallId: seededData.firstCallId }, select: { employeeId: true } })).employeeId
    });

    await submitButton.click();

    // 서버가 트랜잭션 안에서 다시 계산해 목록이 다르다며 거절하고, 지금의(2건) 목록을 돌려준다.
    await expect(dialog.getByText(/확인한 목록 이후 새로운 마감 확인 대상 콜이 생겨/)).toBeVisible();
    const refreshedCheckbox = dialog.getByRole("checkbox", { name: /위 2건을 확인했습니다/ });
    await expect(refreshedCheckbox).toBeVisible();
    await expect(refreshedCheckbox).not.toBeChecked();
    await expect(submitButton).toBeDisabled();

    const month = await (prisma as any).operatingMonth.findUnique({ where: { id: seededData.monthId }, select: { status: true } });
    expect(month?.status).toBe("검토중");
    expect(await (prisma as any).monthlyClosing.count({ where: { operatingMonthId: seededData.monthId } })).toBe(0);

    // 새 목록을 다시 확인하고 같은 사유로 제출하면 통과한다.
    await refreshedCheckbox.check();
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // 운영 빌드에서는 서버 액션이 200으로 끝나도 화면 반영(revalidatePath)이 가끔 늦거나 멈춘 것처럼
    // 보인다(e2e-prod-known-failures 메모의 5-3/5-5/5-6과 같은 증상). 결과는 DB로 확인한다.
    await expect(async () => {
      const latest = await (prisma as any).operatingMonth.findUnique({ where: { id: seededData.monthId }, select: { status: true } });
      expect(latest?.status).toBe("마감확정");
    }).toPass({ timeout: 20000 });

    // 두 콜 모두 상태가 바뀌지 않는다(자동 방문완료 처리하지 않는다).
    const calls = await (prisma as any).serviceCall.findMany({ where: { id: { in: [seededData.firstCallId, secondCall.id] } }, select: { id: true, status: true } });
    expect(calls.find((c: any) => c.id === seededData.firstCallId)?.status).toBe("예약");
    expect(calls.find((c: any) => c.id === secondCall.id)?.status).toBe("사용중");

    // 예외 사유, 확인한 콜과 그 당시 상태, 처리자가 이번 마감 버전에 남는다.
    const closing = await (prisma as any).monthlyClosing.findFirst({
      where: { operatingMonthId: seededData.monthId },
      orderBy: { closeVersion: "desc" }
    });
    const snapshot = closing?.snapshotJson as any;
    expect(snapshot.pendingCloseException.reason).toBe("기존 예약은 다음달 초 방문이 확정되어 예외로 마감합니다");
    expect(snapshot.pendingCloseException.calls).toHaveLength(2);
    expect(snapshot.pendingCloseException.confirmedByAccountId).toBeTruthy();
    const confirmedCallIds = snapshot.pendingCloseException.calls.map((c: any) => c.serviceCallId).sort();
    expect(confirmedCallIds).toEqual([seededData.firstCallId, secondCall.id].sort());

    // 재오픈 뒤에도 이 마감 버전의 예외 기록은 보존된다(소급 재계산하지 않는다).
    await login(page, seededData.accounts.admin, "Ticket34!admin");
    await page.goto(`/closing?operatingMonthId=${seededData.monthId}`);
    await expect(page.getByText("예외 마감 콜")).toBeVisible();
    await page.getByLabel("재오픈 사유").fill("정산 재검토를 위해 재오픈합니다");
    await page.getByRole("button", { name: "재오픈" }).click();

    await expect(async () => {
      const latest = await (prisma as any).operatingMonth.findUnique({ where: { id: seededData.monthId }, select: { status: true } });
      expect(latest?.status).toBe("검토중");
    }).toPass({ timeout: 20000 });

    const closingAfterReopen = await (prisma as any).monthlyClosing.findFirst({
      where: { operatingMonthId: seededData.monthId },
      orderBy: { closeVersion: "desc" }
    });
    const snapshotAfterReopen = closingAfterReopen?.snapshotJson as any;
    expect(snapshotAfterReopen.pendingCloseException.reason).toBe("기존 예약은 다음달 초 방문이 확정되어 예외로 마감합니다");
    expect(snapshotAfterReopen.pendingCloseException.calls).toHaveLength(2);
  });
});
