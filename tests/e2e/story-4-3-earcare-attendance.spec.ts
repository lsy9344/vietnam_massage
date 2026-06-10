import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vietnam_massage";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);
const argon2idOptions = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

type SeededData = {
  writableOperatingMonthId: string;
  lockedOperatingMonthId: string;
  earcareEmployeeIds: string[];
};

let seededData: SeededData;

async function login(page: Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(accountId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

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

async function seedAttendanceCode(code: string, displayName: string, sortOrder: number) {
  return (prisma as any).codeItem.upsert({
    where: { codeType_code: { codeType: "ATTENDANCE_STATUS", code } },
    update: { displayName, sortOrder, isActive: true },
    create: { codeType: "ATTENDANCE_STATUS", code, displayName, sortOrder, isSystemDefault: true, isActive: true }
  });
}

async function cleanupStoryAttendance(operatingMonthIds: string[]) {
  await (prisma as any).earcareAttendance.deleteMany({
    where: { operatingMonthId: { in: operatingMonthIds } }
  });
  await (prisma as any).auditLog.deleteMany({
    where: { action: { in: ["earcare_attendance.created", "earcare_attendance.changed"] }, targetType: "earcare_attendance" }
  });
}

async function seedStoryData(): Promise<SeededData> {
  const settlementEmployee = await seedEmployee("E2E43-OPS-001", "E2E43 정산담당", "OPERATIONS", "정산", 94300);
  const counterEmployee = await seedEmployee("E2E43-OPS-002", "E2E43 카운터", "OPERATIONS", "카운터", 94301);
  await seedAuthAccount({
    accountId: "story43_settlement",
    password: "Story43!settlement",
    role: "settlement_manager",
    employeeId: settlementEmployee.id
  });
  await seedAuthAccount({ accountId: "story43_counter", password: "Story43!counter", role: "counter", employeeId: counterEmployee.id });

  await seedAttendanceCode("NORMAL", "정상", 10);
  await seedAttendanceCode("DAY_OFF", "휴무", 20);
  await seedAttendanceCode("LATE", "지각", 30);
  await seedAttendanceCode("EARLY_LEAVE", "조퇴", 40);
  await seedAttendanceCode("ABSENT", "결근", 50);

  const earcareEmployees = [];
  for (let index = 1; index <= 4; index += 1) {
    earcareEmployees.push(await seedEmployee(`E2E43-EAR-00${index}`, `E2E43 귀케어${index}`, "EARCARE", "귀케어", 94300 + index));
  }
  await seedEmployee("E2E43-EAR-999", "E2E43 비활성 귀케어", "EARCARE", "귀케어", 94399, false);

  const writableOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2034-03" },
    update: { startDate: new Date("2034-03-01T00:00:00.000Z"), endDate: new Date("2034-03-31T00:00:00.000Z"), status: "작성중" },
    create: { monthKey: "2034-03", startDate: new Date("2034-03-01T00:00:00.000Z"), endDate: new Date("2034-03-31T00:00:00.000Z"), status: "작성중" }
  });
  const lockedOperatingMonth = await (prisma as any).operatingMonth.upsert({
    where: { monthKey: "2034-04" },
    update: { startDate: new Date("2034-04-01T00:00:00.000Z"), endDate: new Date("2034-04-30T00:00:00.000Z"), status: "잠금" },
    create: { monthKey: "2034-04", startDate: new Date("2034-04-01T00:00:00.000Z"), endDate: new Date("2034-04-30T00:00:00.000Z"), status: "잠금" }
  });

  await cleanupStoryAttendance([writableOperatingMonth.id, lockedOperatingMonth.id]);
  return {
    writableOperatingMonthId: writableOperatingMonth.id,
    lockedOperatingMonthId: lockedOperatingMonth.id,
    earcareEmployeeIds: earcareEmployees.map((employee) => employee.id)
  };
}

test.beforeAll(async () => {
  seededData = await seedStoryData();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("Story 4.3 earcare attendance", () => {
  test("settlement manager can query four active earcare workers and save non-normal status", async ({ page }) => {
    await login(page, "story43_settlement", "Story43!settlement");
    await page.goto(`/settlements/earcare?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2034-03-12`);

    await expect(page.getByRole("heading", { name: "귀케어 근무상태" })).toBeVisible();
    await expect(page.getByLabel("운영월")).toHaveValue(seededData.writableOperatingMonthId);
    await expect(page.getByLabel("조회날짜")).toHaveValue("2034-03-12");
    await expect(page.getByText("E2E43 귀케어1")).toBeVisible();
    await expect(page.getByText("E2E43 귀케어2")).toBeVisible();
    await expect(page.getByText("E2E43 귀케어3")).toBeVisible();
    await expect(page.getByText("E2E43 귀케어4")).toBeVisible();
    await expect(page.getByText("E2E43 비활성 귀케어")).toHaveCount(0);
    await expect(page.getByText("지급 대상")).toBeVisible();

    const earcare2Row = page.getByRole("row").filter({ hasText: "E2E43 귀케어2" });
    await earcare2Row.getByLabel("E2E43 귀케어2 근무상태").selectOption("DAY_OFF");
    await earcare2Row.getByRole("button", { name: "저장" }).click();

    await expect(earcare2Row.getByText("저장됨")).toBeVisible();
    await expect(earcare2Row.getByText("제외: 휴무")).toBeVisible();

    await expect
      .poll(async () => {
        const attendance = await (prisma as any).earcareAttendance.findUnique({
          where: {
            operatingMonthId_attendanceDate_employeeId: {
              operatingMonthId: seededData.writableOperatingMonthId,
              attendanceDate: new Date("2034-03-12T00:00:00.000Z"),
              employeeId: seededData.earcareEmployeeIds[1]
            }
          }
        });
        return attendance?.statusCode ?? null;
      })
      .toBe("DAY_OFF");

    const savedAttendance = await (prisma as any).earcareAttendance.findUniqueOrThrow({
      where: {
        operatingMonthId_attendanceDate_employeeId: {
          operatingMonthId: seededData.writableOperatingMonthId,
          attendanceDate: new Date("2034-03-12T00:00:00.000Z"),
          employeeId: seededData.earcareEmployeeIds[1]
        }
      }
    });
    expect(savedAttendance.employeeId).toBe(seededData.earcareEmployeeIds[1]);
    expect(savedAttendance.statusCode).toBe("DAY_OFF");
    await expect
      .poll(async () =>
        (prisma as any).auditLog.count({
          where: {
            action: "earcare_attendance.created",
            targetType: "earcare_attendance",
            targetId: savedAttendance.id
          }
        })
      )
      .toBe(1);
  });

  test("changing date does not show previous date attendance as the new date value", async ({ page }) => {
    await login(page, "story43_settlement", "Story43!settlement");
    await page.goto(`/settlements/earcare?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2034-03-14`);

    const earcare3Row = page.getByRole("row").filter({ hasText: "E2E43 귀케어3" });
    await earcare3Row.getByLabel("E2E43 귀케어3 근무상태").selectOption("LATE");
    await earcare3Row.getByRole("button", { name: "저장" }).click();
    await expect(earcare3Row.getByText("저장됨")).toBeVisible();
    await expect(earcare3Row.getByText("제외: 지각")).toBeVisible();

    await page.goto(`/settlements/earcare?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2034-03-15`);

    const nextDateEarcare3Row = page.getByRole("row").filter({ hasText: "E2E43 귀케어3" });
    await expect(page.getByLabel("조회날짜")).toHaveValue("2034-03-15");
    await expect(nextDateEarcare3Row.getByLabel("E2E43 귀케어3 근무상태")).toHaveValue("NORMAL");
    await expect(nextDateEarcare3Row.getByText("지급 대상")).toBeVisible();
    await expect(nextDateEarcare3Row.getByText("제외: 지각")).toHaveCount(0);
  });

  test("invalid stable status code shows inline retry state without writing attendance", async ({ page }) => {
    await login(page, "story43_settlement", "Story43!settlement");
    await page.goto(`/settlements/earcare?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2034-03-16`);

    const earcare1Row = page.getByRole("row").filter({ hasText: "E2E43 귀케어1" });
    const statusSelect = earcare1Row.getByLabel("E2E43 귀케어1 근무상태");
    await statusSelect.evaluate((select: HTMLSelectElement) => {
      const invalidOption = new Option("폐기된 상태", "UNKNOWN_STATUS", true, true);
      select.add(invalidOption);
      select.value = "UNKNOWN_STATUS";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(statusSelect).toHaveValue("UNKNOWN_STATUS");

    await earcare1Row.getByRole("button", { name: "저장" }).click();

    await expect(earcare1Row.getByRole("button", { name: "재시도" })).toBeVisible();
    await expect(earcare1Row.getByText("저장 실패: 근무상태 코드가 올바르지 않습니다.")).toBeVisible();
    const createdAttendance = await (prisma as any).earcareAttendance.findUnique({
      where: {
        operatingMonthId_attendanceDate_employeeId: {
          operatingMonthId: seededData.writableOperatingMonthId,
          attendanceDate: new Date("2034-03-16T00:00:00.000Z"),
          employeeId: seededData.earcareEmployeeIds[0]
        }
      }
    });
    expect(createdAttendance).toBeNull();
  });

  test("locked operating month disables attendance inputs", async ({ page }) => {
    await login(page, "story43_settlement", "Story43!settlement");
    await page.goto(`/settlements/earcare?operatingMonthId=${seededData.lockedOperatingMonthId}&attendanceDate=2034-04-12`);

    await expect(page.getByText("잠긴 운영월입니다")).toBeVisible();
    await expect(page.getByLabel("E2E43 귀케어1 근무상태")).toBeDisabled();
    await expect(page.getByRole("button", { name: "저장" }).first()).toBeDisabled();
  });

  test("counter direct access redirects away from earcare settlements", async ({ page }) => {
    await login(page, "story43_counter", "Story43!counter");
    await page.goto(`/settlements/earcare?operatingMonthId=${seededData.writableOperatingMonthId}&attendanceDate=2034-03-12`);

    await expect(page).toHaveURL(/\/calls/);
  });
});
