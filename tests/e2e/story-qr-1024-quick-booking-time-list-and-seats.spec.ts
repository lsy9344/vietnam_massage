import { testEmployees } from "./support/test-employees";
import { expect, test, type Locator } from "@playwright/test";
import { hash } from "@/lib/password-hash";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";
import { checkInTherapist, chooseConditions, openQuickBooking, quickBookingLine } from "./support/quick-booking";

// 2026-10-24 고객 제보(qr-1024-1~4) 두 건.
// 1) 빠른 예약 ①의 시간 목록을 스크롤하면 "13:…"처럼 시각이 잘렸다. 브라우저 배율이 100%가 아니면 스크롤바 두께(CSS px)가 처음
//    잰 값과 달라지고, 목록이 스크롤마다 자기 폭으로 다시 폭을 재서 그 차이가 쌓였다. 여기서는 루트의 CSS zoom으로 배율을 흉내 내고,
//    스크롤바가 자리를 차지해야 재현되므로 Playwright의 --hide-scrollbars를 끈다.
// 2) 출근 3명이 D코스(2:1) 1건과 미지명 1건에 다 쓰이는데, 개인 예약만 보는 가능 판정이 미지명 몫의 1명을 "가능"으로 보였다.
//    고객 화면의 시각(18:30 / 19:30 / 20:00 / 21:00)을 7시간 당겨 쓴다. 다른 스펙이 슬롯 순서를 옮겨 영업 마감이 16:00이 될 수 있다.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

const account = { accountId: "tqr1024_counter", password: "Qr1024!counter", staffCode: "E2E-QR1024-COUNTER", sortOrder: 98310 };
const MONTH_KEY = "2043-10";
const MONTH_START = "2043-10-01";
const MONTH_END = "2043-10-31";
const SERVICE_DATE = "2043-10-23";

let monthId = "";
const courses = { A: "", C: "", D: "" };
const therapists = { t12: "", t17: "", t21: "" };

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

async function seedCourse(code: string, durationMinutes: number, requiresSecondTherapist: boolean) {
  const course = await (prisma as any).course.upsert({ where: { code }, update: { isActive: true }, create: { code, isActive: true } });
  const policy = { name: `${code} 코스`, durationMinutes, basePrice: 1500000, requiresSecondTherapist, tvDisplayName: code, effectiveToMonth: MONTH_KEY, isActive: true };
  const existing = await (prisma as any).coursePolicy.findFirst({ where: { courseId: course.id, effectiveFromMonth: MONTH_KEY } });
  if (existing) await (prisma as any).coursePolicy.update({ where: { id: existing.id }, data: policy });
  else await (prisma as any).coursePolicy.create({ data: { courseId: course.id, effectiveFromMonth: MONTH_KEY, ...policy } });
  return course.id as string;
}

async function cleanupCalls() {
  if (!monthId) return;
  const calls = await (prisma as any).serviceCall.findMany({ where: { operatingMonthId: monthId }, select: { id: true } });
  const ids = calls.map((call: { id: string }) => call.id);
  if (ids.length > 0) {
    await (prisma as any).serviceCallAssignment.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCallStatusHistory.deleteMany({ where: { serviceCallId: { in: ids } } });
    await (prisma as any).serviceCall.deleteMany({ where: { id: { in: ids } } });
  }
  await (prisma as any).therapistAttendance.deleteMany({ where: { operatingMonthId: monthId } });
}

/** 열린 시간 목록의 폭과, 말줄임으로 잘린 항목 글자. */
function listState(listbox: Locator) {
  return listbox.evaluate((list) => ({
    width: list.getBoundingClientRect().width,
    truncated: [...list.querySelectorAll('[role="option"] span')].filter((label) => label.scrollWidth > label.clientWidth).map((label) => label.textContent)
  }));
}

test.describe("2026-10-24 고객 제보: 빠른 예약 시간 목록과 남은 자리", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const operations = await seedEmployee(account.staffCode, "QR1024 카운터", "OPERATIONS", account.sortOrder);
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
        where: { monthKey: MONTH_KEY },
        update: { status: "작성중" },
        create: { monthKey: MONTH_KEY, startDate: new Date(`${MONTH_START}T00:00:00.000Z`), endDate: new Date(`${MONTH_END}T00:00:00.000Z`), status: "작성중" }
      })
    ).id;
    await cleanupCalls();

    courses.A = await seedCourse("QR24A", 60, false);
    courses.C = await seedCourse("QR24C", 90, false);
    courses.D = await seedCourse("QR24D", 90, true);
    therapists.t12 = (await seedEmployee("E2E-QR1024-12", "QR 마사지사12", "THERAPIST", 98311)).id;
    therapists.t17 = (await seedEmployee("E2E-QR1024-17", "QR 마사지사17", "THERAPIST", 98312)).id;
    therapists.t21 = (await seedEmployee("E2E-QR1024-21", "QR 마사지사21", "THERAPIST", 98313)).id;
    for (const therapistId of Object.values(therapists)) {
      await checkInTherapist({ operatingMonthId: monthId, serviceDate: SERVICE_DATE, employeeId: therapistId });
      for (const courseId of Object.values(courses)) {
        const rate = { amount: 500000, effectiveFromMonth: MONTH_KEY, effectiveToMonth: MONTH_KEY, isActive: true };
        const existing = await (prisma as any).therapistCourseRate.findFirst({ where: { therapistId, courseId } });
        if (existing) await (prisma as any).therapistCourseRate.update({ where: { id: existing.id }, data: rate });
        else await (prisma as any).therapistCourseRate.create({ data: { therapistId, courseId, ...rate } });
      }
    }

    // 고객 화면(7시간 당김): 11:30 A60 둘(12는 11:39 입장이라 12:39까지), 12:30 D90(17+21)과 미지명 C90, 14:00 A60 둘(12·17).
    const calls = [
      { startTime: "11:30", courseId: courses.A, status: "IN_USE", actualEntryTime: "11:39", therapistIds: [therapists.t12] },
      { startTime: "11:30", courseId: courses.A, status: "IN_USE", actualEntryTime: "11:30", therapistIds: [therapists.t17] },
      { startTime: "12:30", courseId: courses.D, status: "RESERVED", therapistIds: [therapists.t17, therapists.t21] },
      { startTime: "12:30", courseId: courses.C, status: "RESERVED", therapistIds: [] },
      { startTime: "14:00", courseId: courses.A, status: "RESERVED", therapistIds: [therapists.t12] },
      { startTime: "14:00", courseId: courses.A, status: "RESERVED", therapistIds: [therapists.t17] }
    ];
    for (const { therapistIds, ...call } of calls) {
      const created = await (prisma as any).serviceCall.create({
        data: { operatingMonthId: monthId, serviceDate: new Date(`${SERVICE_DATE}T00:00:00.000Z`), customerMemo: "QR1024 손님", ...call }
      });
      for (const [index, employeeId] of therapistIds.entries()) {
        await (prisma as any).serviceCallAssignment.create({
          data: { serviceCallId: created.id, assignmentRole: index === 0 ? "THERAPIST_1" : "THERAPIST_2", employeeId }
        });
      }
    }
  });

  test.afterAll(async () => {
    await cleanupCalls();
    for (const courseId of Object.values(courses)) {
      await (prisma as any).therapistCourseRate.deleteMany({ where: { courseId } });
      await (prisma as any).coursePolicy.deleteMany({ where: { courseId } });
      await (prisma as any).course.update({ where: { id: courseId }, data: { isActive: false } });
    }
    await (prisma as any).operatingMonth.deleteMany({ where: { id: monthId } });
    await testEmployees.deactivateAll();
    await prisma.$disconnect();
  });

  test("배율이 100%가 아니어도 시간 목록을 스크롤한 뒤 모든 시각이 HH:MM 그대로 보인다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${SERVICE_DATE}`);
    const panel = await openQuickBooking(page);
    const trigger = panel.locator("#quick-booking-time");

    for (const zoom of ["0.8", "0.9", "1.25"]) {
      await page.evaluate((value) => (document.documentElement.style.zoom = value), zoom);
      await trigger.click();
      const listbox = page.getByRole("listbox");
      await expect(listbox).toBeVisible();
      const opened = await listState(listbox);
      expect(opened.truncated, `배율 ${zoom} 처음`).toEqual([]);

      const box = await listbox.boundingBox();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + 40);
      for (let step = 0; step < 20; step += 1) await page.mouse.wheel(0, 40);
      await expect.poll(() => listbox.evaluate((list) => list.scrollTop)).toBeGreaterThan(0);
      const scrolled = await listState(listbox);
      expect(scrolled.truncated, `배율 ${zoom} 스크롤 뒤`).toEqual([]);
      // 스크롤해도 폭이 줄거나 늘지 않는다.
      expect(Math.abs(scrolled.width - opened.width), `배율 ${zoom} 폭`).toBeLessThan(1);
      await page.keyboard.press("Escape");
      await expect(listbox).toBeHidden();
    }
  });

  test("D코스 2명과 미지명 1명이 출근 3명을 다 쓰면, 비어 보이는 Therapist도 안 되는 쪽으로 접힌다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, account.accountId, account.password);
    await page.goto(`/calls?operatingMonthId=${monthId}&serviceDate=${SERVICE_DATE}`);
    const panel = await openQuickBooking(page);

    // 12:30(고객 19:30): 12는 12:39까지 앞 손님이라 4자리가 겹친다.
    await chooseConditions(panel, { time: "12:30" });
    await expect(panel.locator("[data-quick-booking-seats]")).toHaveText("12:30 남은 자리 -1 / 3");

    // 13:00(고객 20:00): 12는 개인 예약으로는 14:00까지 비지만, 그 자리는 미지명 C90 몫이다.
    await chooseConditions(panel, { time: "13:00" });
    await expect(panel.locator("[data-quick-booking-seats]")).toHaveText("13:00 남은 자리 0 / 3");
    await expect(panel.getByText("이 시각에 받을 수 있는 출근한 Therapist가 없습니다.")).toBeVisible();
    const folded = panel.locator("[data-quick-booking-unavailable]");
    await expect(folded.locator("summary")).toHaveText("이 시각에 안 되는 3명");
    await folded.locator("summary").click();
    await expect(quickBookingLine(panel, therapists.t12).locator(`[data-course-id="${courses.A}"]`)).toHaveAttribute("aria-label", /불가/);

    // 14:00(고객 21:00): D90과 미지명 C90이 끝나 21만 받을 수 있다.
    await chooseConditions(panel, { time: "14:00" });
    await expect(panel.locator("[data-quick-booking-seats]")).toHaveText("14:00 남은 자리 1 / 3");
    await expect(quickBookingLine(panel, therapists.t21).locator(`[data-course-id="${courses.A}"]`)).toHaveAttribute("aria-label", "QR 마사지사21 QR24A60 담기");
  });
});
