import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

const THERAPIST_COUNT = 50;

type SeededData = {
  writableOperatingMonthId: string;
  lockedOperatingMonthId: string;
  therapistEmployeeIds: string[];
};

let seededData: SeededData;

async function seedEmployee(staffCode: string, displayName: string, employeeGroup: string, position: string, sortOrder: number, isActive = true) {
  return (prisma as any).employee.upsert({
    where: { staffCode },
    update: { displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive },
    create: { staffCode, displayName, employeeGroup, position, shiftType: "전체", baseSalary: 0, employmentStatus: "재직", sortOrder, isActive }
  });
}

async function seedAuthAccount(input: { accountId: string; password: string; role: string; employeeId: string }) {
  const passwordHash = await hash(input.password, argon2idOptions);
  return (prisma as any).userAccount.upsert({
    where: { accountId: input.accountId },
    update: {
      email: `${input.accountId}@example.local`,
      passwordHash,
      role: input.role,
      employeeId: input.employeeId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    },
    create: {
      email: `${input.accountId}@example.local`,
      accountId: input.accountId,
      passwordHash,
      role: input.role,
      employeeId: input.employeeId,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    }
  });
}

async function cleanupStoryAttendance(operatingMonthIds: string[]) {
  // Scope the audit-log cleanup to this story's attendance rows only.
  // Deleting every therapist_attendance.* audit log would wipe unrelated history.
  const storyAttendances = await (prisma as any).therapistAttendance.findMany({
    where: { operatingMonthId: { in: operatingMonthIds } },
    select: { id: true }
  });
  const storyAttendanceIds = storyAttendances.map((attendance: { id: string }) => attendance.id);
  if (storyAttendanceIds.length > 0) {
    await (prisma as any).auditLog.deleteMany({
      where: {
        action: { in: ["therapist_attendance.created", "therapist_attendance.changed", "therapist_attendance.deactivated"] },
        targetType: "therapist_attendance",
        targetId: { in: storyAttendanceIds }
      }
    });
  }
  await (prisma as any).therapistAttendance.deleteMany({
    where: { operatingMonthId: { in: operatingMonthIds } }
  });
}

async function cleanupStorySeedData(operatingMonthIds: string[]) {
  await cleanupStoryAttendance(operatingMonthIds);
  await (prisma as any).userAccount.updateMany({
    where: { accountId: { in: ["story41_settlement", "story41_counter"] } },
    data: { isActive: false, lockedUntil: null, failedLoginCount: 0 }
  });
  await (prisma as any).employee.updateMany({
    where: { staffCode: { startsWith: "E2E41-" } },
    data: { isActive: false }
  });
  await (prisma as any).operatingMonth.deleteMany({
    where: { monthKey: { in: ["2035-03", "2035-04"] } }
  });
}

async function seedStoryData(): Promise<SeededData> {
  const settlementEmployee = await seedEmployee("E2E41-OPS-001", "E2E41 정산담당", "OPERATIONS", "정산", 94100);
  const counterEmployee = await seedEmployee("E2E41-OPS-002", "E2E41 카운터", "OPERATIONS", "카운터", 94101);
  await seedAuthAccount({
    accountId: "story41_settlement",
    password: "Story41!settlement",
    role: "settlement_manager",
    employeeId: settlementEmployee.id
  });
  await seedAuthAccount({ accountId: "story41_counter", password: "Story41!counter", role: "counter", employeeId: counterEmployee.id });

  const therapistEmployeeIds: string[] = [];
  for (let index = 1; index <= THERAPIST_COUNT; index += 1) {
    const employee = await seedEmployee(
      `E2E41-THR-${String(index).padStart(3, "0")}`,
      `E2E41 마사지사${index}`,
      "THERAPIST",
      "마사지사",
      94110 + index
    );
    therapistEmployeeIds.push(employee.id);
  }
  await seedEmployee("E2E41-THR-999", "E2E41 비활성 마사지사", "THERAPIST", "마사지사", 94999, false);

  const writableOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2035-03" },
    update: { startDate: new Date("2035-03-01T00:00:00.000Z"), endDate: new Date("2035-03-31T00:00:00.000Z"), status: "작성중" },
    create: { monthKey: "2035-03", startDate: new Date("2035-03-01T00:00:00.000Z"), endDate: new Date("2035-03-31T00:00:00.000Z"), status: "작성중" }
  });
  const lockedOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2035-04" },
    update: { startDate: new Date("2035-04-01T00:00:00.000Z"), endDate: new Date("2035-04-30T00:00:00.000Z"), status: "잠금" },
    create: { monthKey: "2035-04", startDate: new Date("2035-04-01T00:00:00.000Z"), endDate: new Date("2035-04-30T00:00:00.000Z"), status: "잠금" }
  });

  await cleanupStoryAttendance([writableOperatingMonth.id, lockedOperatingMonth.id]);
  return {
    writableOperatingMonthId: writableOperatingMonth.id,
    lockedOperatingMonthId: lockedOperatingMonth.id,
    therapistEmployeeIds
  };
}

test.beforeAll(async () => {
  seededData = await seedStoryData();
});

test.afterAll(async () => {
  // Clean up this run's attendance, scoped audit logs, seeded accounts/employees,
  // and future months so this suite cannot influence later default selections.
  await cleanupStorySeedData([seededData.writableOperatingMonthId, seededData.lockedOperatingMonthId]);
  await prisma.$disconnect();
});

test.describe("Story 4.1 therapist attendance", () => {
  test("settlement manager sees 50 active therapists and saves overnight full-attendance", async ({ page }) => {
    await login(page, "story41_settlement", "Story41!settlement");
    await page.goto(`/settlements?operatingMonthId=${seededData.writableOperatingMonthId}&serviceDate=2035-03-12`);

    await expect(page.getByRole("heading", { name: "마사지사 일일정산" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "마사지사 출퇴근 입력" })).toBeVisible();
    await expect(page.getByLabel("운영월")).toHaveValue(seededData.writableOperatingMonthId);
    await expect(page.getByLabel("조회날짜")).toHaveValue("2035-03-12");

    await expect(page.getByText("E2E41 마사지사1", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E41 마사지사50", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E41 비활성 마사지사")).toHaveCount(0);

    const therapist1Row = page.getByRole("row").filter({ hasText: "E2E41 마사지사1" }).first();
    await therapist1Row.getByLabel("E2E41 마사지사1 출근시간").fill("22:00");
    await therapist1Row.getByLabel("E2E41 마사지사1 퇴근시간").fill("06:00");
    await therapist1Row.getByRole("button", { name: "저장" }).click();

    await expect(therapist1Row.getByText("저장됨")).toBeVisible();
    await expect(therapist1Row.getByText("만근 인정 (480분)")).toBeVisible();

    await expect
      .poll(async () => {
        const attendance = await (prisma as any).therapistAttendance.findUnique({
          where: {
            operatingMonthId_attendanceDate_employeeId: {
              operatingMonthId: seededData.writableOperatingMonthId,
              attendanceDate: new Date("2035-03-12T00:00:00.000Z"),
              employeeId: seededData.therapistEmployeeIds[0]
            }
          }
        });
        return attendance ? `${attendance.standbyMinutes}:${attendance.isFullAttendanceRecognized}` : null;
      })
      .toBe("480:true");

    const savedAttendance = await (prisma as any).therapistAttendance.findUniqueOrThrow({
      where: {
        operatingMonthId_attendanceDate_employeeId: {
          operatingMonthId: seededData.writableOperatingMonthId,
          attendanceDate: new Date("2035-03-12T00:00:00.000Z"),
          employeeId: seededData.therapistEmployeeIds[0]
        }
      }
    });
    expect(savedAttendance.employeeId).toBe(seededData.therapistEmployeeIds[0]);
    expect(savedAttendance.checkInMinute).toBe(1320);
    expect(savedAttendance.checkOutMinute).toBe(360);
    await expect
      .poll(async () =>
        (prisma as any).auditLog.count({
          where: {
            action: "therapist_attendance.created",
            targetType: "therapist_attendance",
            targetId: savedAttendance.id
          }
        })
      )
      .toBe(1);
  });

  test("under-eight-hour standby is not recognized as full attendance", async ({ page }) => {
    await login(page, "story41_settlement", "Story41!settlement");
    await page.goto(`/settlements?operatingMonthId=${seededData.writableOperatingMonthId}&serviceDate=2035-03-13`);

    const therapist2Row = page.getByRole("row").filter({ hasText: "E2E41 마사지사2" }).first();
    await therapist2Row.getByLabel("E2E41 마사지사2 출근시간").fill("10:00");
    await therapist2Row.getByLabel("E2E41 마사지사2 퇴근시간").fill("17:59");
    await therapist2Row.getByRole("button", { name: "저장" }).click();

    await expect(therapist2Row.getByText("저장됨")).toBeVisible();
    await expect(therapist2Row.getByText("만근 미인정 (479분)")).toBeVisible();
  });

  test("invalid time input shows inline retry without writing attendance", async ({ page }) => {
    await login(page, "story41_settlement", "Story41!settlement");
    await page.goto(`/settlements?operatingMonthId=${seededData.writableOperatingMonthId}&serviceDate=2035-03-14`);

    const therapist3Row = page.getByRole("row").filter({ hasText: "E2E41 마사지사3" }).first();
    // bypass the native time picker by injecting an invalid value
    await therapist3Row.getByLabel("E2E41 마사지사3 출근시간").evaluate((input: HTMLInputElement) => {
      input.removeAttribute("type");
      input.value = "99:99";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await therapist3Row.getByLabel("E2E41 마사지사3 퇴근시간").fill("18:00");
    await therapist3Row.getByRole("button", { name: "저장" }).click();

    await expect(therapist3Row.getByRole("button", { name: "재시도" })).toBeVisible();
    // The invalid input must surface a safe Korean error message via role="alert".
    const therapist3Alert = therapist3Row.getByRole("alert");
    await expect(therapist3Alert.first()).toBeVisible();
    await expect(therapist3Row.getByText("HH:mm 형식이어야 합니다", { exact: false }).first()).toBeVisible();
    const createdAttendance = await (prisma as any).therapistAttendance.findUnique({
      where: {
        operatingMonthId_attendanceDate_employeeId: {
          operatingMonthId: seededData.writableOperatingMonthId,
          attendanceDate: new Date("2035-03-14T00:00:00.000Z"),
          employeeId: seededData.therapistEmployeeIds[2]
        }
      }
    });
    expect(createdAttendance).toBeNull();
  });

  test("locked operating month disables attendance inputs", async ({ page }) => {
    await login(page, "story41_settlement", "Story41!settlement");
    await page.goto(`/settlements?operatingMonthId=${seededData.lockedOperatingMonthId}&serviceDate=2035-04-12`);

    await expect(page.getByText("잠긴 운영월입니다", { exact: false })).toBeVisible();
    await expect(page.getByLabel("E2E41 마사지사1 출근시간")).toBeDisabled();
    await expect(page.getByRole("button", { name: "저장" }).first()).toBeDisabled();
  });

  test("counter direct access redirects away from settlements", async ({ page }) => {
    await login(page, "story41_counter", "Story41!counter");
    await page.goto(`/settlements?operatingMonthId=${seededData.writableOperatingMonthId}&serviceDate=2035-03-12`);

    await expect(page).toHaveURL(/\/calls/);
  });
});
