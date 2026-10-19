import { testEmployees } from "./support/test-employees";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";

// 1018 후속: 원장 두 줄 행의 칸은 열에 맞춘다. 예약자·코스·입장 글자 길이가 줄마다 달라도 윗줄 상태 칸과
// 아랫줄 Therapist·객실·결제 칸이 모든 줄에서 같은 가로 위치에 있다.
const account = { accountId: "t1018_columns_counter", password: "Ticket1018-columns!counter" };
const monthKey = "2041-07";
const serviceDate = "2041-07-14";
const policyNames = { A: "T1018열 A 60분", D: "T1018열 D 120분 아로마 전신 마사지 스페셜" } as const;

let monthId = "";
let roomId = "";
const therapistIds: string[] = [];

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

async function coursePolicy(code: "A" | "D", durationMinutes: number) {
  const course = await (prisma as any).course.upsert({ where: { code }, update: { isActive: true }, create: { code, isActive: true } });
  const name = policyNames[code];
  const policy = { name, durationMinutes, basePrice: 1500000, requiresSecondTherapist: false, tvDisplayName: name, effectiveToMonth: monthKey, isActive: true };
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: monthKey } });
  if (existing) await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data: policy });
  else await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: monthKey, ...policy } });
  return course.id as string;
}

async function cleanup() {
  if (!monthId) return;
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length === 0) return;
  await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
  await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
  await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
}

/** 보이는 원장 줄마다 칸의 왼쪽 x. 칸이 없는 줄(주 버튼이 없는 줄 등)은 null이다. */
async function pickerColumns(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-ledger-line]")]
      .filter((line) => line.offsetParent !== null)
      .map((line) => {
        const left = (field: string) => {
          const picker = line.querySelector(`[data-cell-picker="${field}"]`);
          return picker ? Math.round(picker.getBoundingClientRect().left) : null;
        };
        return { status: left("status"), therapist: left("therapist1Id"), room: left("roomId"), payment: left("paymentMethodCode") };
      })
  );
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectAlignedColumns(page: Page) {
  const columns = await pickerColumns(page);
  expect(columns.length).toBe(6);
  for (const field of ["status", "therapist", "room", "payment"] as const) {
    const lefts = columns.map((column) => column[field]);
    expect(lefts, `${field} 칸이 모든 줄에 있다`).not.toContain(null);
    expect(new Set(lefts), `${field} 칸의 왼쪽 x: ${JSON.stringify(lefts)}`).toEqual(new Set([lefts[0]]));
  }
  await expectNoPageOverflow(page);
}

async function openLedger(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await login(page, account.accountId, account.password);
  await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${serviceDate}`);
  await expect(page.getByRole("list", { name: "콜 원장 목록" })).toBeVisible();
}

test.describe("1018 후속 원장 줄의 칸 열 맞춤", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const operations = await seedEmployee("E2E-T1018-COL-COUNTER", "T1018열 카운터", "OPERATIONS", 97811);
    const data = {
      email: `${account.accountId}@example.local`,
      passwordHash: await hash(account.password, argon2idOptions),
      role: "counter",
      employeeId: operations.id,
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0
    };
    await (prisma as any).userAccount.upsert({ where: { accountId: account.accountId }, update: data, create: { ...data, accountId: account.accountId } });

    monthId = (
      await (prisma as any).operatingMonth.upsert({
        where: { monthKey },
        update: { status: "작성중" },
        create: { monthKey, startDate: new Date(`${monthKey}-01T00:00:00.000Z`), endDate: new Date(`${monthKey}-31T00:00:00.000Z`), status: "작성중" }
      })
    ).id;
    await cleanup();

    const courseA = await coursePolicy("A", 60);
    const courseD = await coursePolicy("D", 120);
    for (const [index, name] of ["T1018열 일", "T1018열 아주 긴 이름의 마사지사"].entries()) {
      therapistIds.push((await seedEmployee(`E2E-T1018-COL-${index}`, name, "THERAPIST", 97821 + index)).id);
    }

    roomId = (
      await (prisma as any).room.upsert({
        where: { sortOrder: 97831 },
        update: { displayName: "T1018열 객실", isActive: true },
        create: { displayName: "T1018열 객실", migrationReferenceName: "T1018-COL-97831", sortOrder: 97831, isActive: true }
      })
    ).id;

    // 줄마다 예약자·코스·입장 글자 길이가 다르다. 사용중(입장 → 예상)·청소중(입장 → 종료, 주 버튼 둘)·예약(미입장) 줄이
    // 섞여 윗줄 앞 칸과 주 버튼 길이도 다르다. 11:00과 11:30은 같은 객실이 겹쳐 경고가 붙는다.
    const calls = [
      { startTime: "11:00", courseId: courseA, bookingChannelCode: "WALK_IN", bookerName: "김", status: "IN_USE", actualEntryTime: "11:05", roomId, therapist: 0 },
      { startTime: "11:30", courseId: courseD, bookingChannelCode: "PHONE", bookerName: "아주 긴 예약자 이름 홍길동 사장님", status: "RESERVED", roomId, therapist: null },
      { startTime: "13:00", courseId: courseA, bookingChannelCode: null, bookerName: null, customerMemo: "몰라", status: "RESERVED", therapist: 1 },
      { startTime: "14:00", courseId: courseD, bookingChannelCode: "KAKAOTALK", bookerName: "몰라", status: "IN_USE", actualEntryTime: "14:00", therapist: 1, paymentMethodCode: "CARD" },
      { startTime: "15:00", courseId: courseA, bookingChannelCode: "TELEGRAM", bookerName: "Nguyen Van A", status: "RESERVED", therapist: 0 },
      { startTime: "16:00", courseId: courseA, bookingChannelCode: "ZALO", bookerName: "정 대표", status: "CLEANING", actualEntryTime: "16:00", actualEndTime: "16:58", therapist: 0 }
    ];
    for (const { therapist, ...call } of calls) {
      const created = await (prisma as any).serviceCall.create({
        data: { operatingMonthId: monthId, serviceDate: new Date(`${serviceDate}T00:00:00.000Z`), roomId: null, ...call }
      });
      if (therapist !== null) {
        await (prisma as any).serviceCallAssignment.create({ data: { serviceCallId: created.id, assignmentRole: "THERAPIST_1", employeeId: therapistIds[therapist] } });
      }
    }
  });

  test.afterAll(async () => {
    await cleanup();
    await (prisma as any).coursePolicy.deleteMany({ where: { name: { in: Object.values(policyNames) } } });
    await (prisma as any).room.updateMany({ where: { id: roomId }, data: { isActive: false } });
    await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  for (const width of [1280, 1024, 700]) {
    test(`${width}px: 상태·Therapist·객실·결제 칸이 모든 줄에서 같은 가로 위치에 있다`, async ({ page }) => {
      await openLedger(page, width);
      await expectAlignedColumns(page);
    });
  }

  test("1280px에서 편집 패널을 열어 원장이 좁아져도 칸이 모든 줄에서 같은 가로 위치에 있다", async ({ page }) => {
    await openLedger(page, 1280);
    await page.locator("[data-call-open]").first().click();
    await expect(page.getByRole("complementary", { name: /^콜 상세/ })).toBeVisible();
    await expectAlignedColumns(page);
  });

  test("휴대폰 폭(360px)의 읽기 전용 줄도 경고 칩이 줄 안에 다 보인다", async ({ page }) => {
    await openLedger(page, 360);
    await expect(page.getByRole("button", { name: /^경고 / }).first()).toBeVisible();
    // 경고 버튼의 오른쪽 끝이 그 줄 안에 있는지 한 번에 잰다(목록이 다시 그려지는 사이에 재지 않게).
    const overhangs = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-ledger-line] button[aria-label^="경고 "]')]
        .filter((warning) => warning.offsetParent !== null)
        .map((warning) => Math.round(warning.getBoundingClientRect().right - warning.closest("[data-ledger-line]")!.getBoundingClientRect().right))
    );
    expect(overhangs.length).toBeGreaterThan(0);
    for (const overhang of overhangs) expect(overhang).toBeLessThanOrEqual(0);
    await expectNoPageOverflow(page);
  });
});
