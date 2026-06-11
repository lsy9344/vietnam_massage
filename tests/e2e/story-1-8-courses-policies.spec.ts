import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";


const users = [
  { accountId: "story18_administrator", role: "administrator", password: "Story18!administrator", landing: "/live" },
  { accountId: "story18_counter", role: "counter", password: "Story18!counter", landing: "/calls" },
  { accountId: "story18_waiter", role: "waiter", password: "Story18!waiter", landing: "/rooms" }
];

function courseRow(page: import("@playwright/test").Page, code: string) {
  return page.locator("tbody tr").filter({ hasText: new RegExp(`^\\s*${code}\\s*Course\\.id`) }).first();
}


async function seedAuthAccount(input: { accountId: string; email: string; staffCode: string; role: string; secret: string }) {
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: input.accountId,
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 87000 + input.staffCode.length,
      isActive: true
    },
    create: {
      staffCode: input.staffCode,
      displayName: input.accountId,
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder: 87000 + input.staffCode.length,
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

test.describe("Story 1.8 코스 마스터와 수당/인센 정책 관리", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const user of users) {
      await seedAuthAccount({
        accountId: user.accountId,
        email: `${user.accountId}@example.local`,
        staffCode: `E2E18-${user.role.toUpperCase()}`,
        role: user.role,
        secret: user.password
      });
    }
  });

  test("administrator는 기본 코스, D코스 설정, 0원 수당, 일/월 인센, 정책 변경 감사 로그를 확인한다", async ({ page }) => {
    await login(page, "story18_administrator", "Story18!administrator");
    await page.goto("/masters/courses");

    await expect(page.getByRole("heading", { name: "코스/수당/인센", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: /코스\/수당\/인센/ })).toBeVisible();
    await expect(page.getByText("A 누루60")).toBeVisible();
    await expect(page.getByText("B 귀청소90")).toBeVisible();
    await expect(page.getByText("C 때밀이90")).toBeVisible();
    await expect(page.getByText("D 2:1 90")).toBeVisible();
    await expect(page.getByText("E 풀코스120")).toBeVisible();
    await expect(courseRow(page, "D").getByText("마사지사2 필요: Y")).toBeVisible();
    await expect(page.getByText("0원 수당")).toBeVisible();
    await expect(page.locator('input[value="0"]').first()).toBeVisible();
    await expect(page.getByText("30콜").or(page.locator('input[value="30"]'))).toBeVisible();
    await expect(page.locator('input[value="1000"]')).toBeVisible();

    const dCourse = await (prisma as any).course.findUnique({ where: { code: "D" }, select: { id: true, code: true } });
    const dPolicy = await (prisma as any).coursePolicy.findFirst({
      where: { courseId: dCourse.id, isActive: true },
      orderBy: { effectiveFromMonth: "desc" }
    });
    expect(dPolicy).toMatchObject({ requiresSecondTherapist: true });

    const beforeCourseA = await (prisma as any).course.findUnique({ where: { code: "A" }, select: { id: true, code: true } });
    const auditCountBefore = await (prisma as any).auditLog.count({
      where: { action: "course.policy_changed", targetType: "course_policy" }
    });
    const row = courseRow(page, "A");
    const newTvLabel = `A 누루60 ${Date.now().toString(36).slice(-4)}`;
    await row.getByLabel("TV 표시명").fill(newTvLabel);
    await row.getByRole("button", { name: "현재 정책 저장" }).click();
    await expect(page.locator(`input[value="${newTvLabel}"]`)).toBeVisible();

    const courseA = await (prisma as any).course.findUnique({ where: { code: "A" }, select: { id: true, code: true } });
    expect(courseA).toMatchObject({ id: beforeCourseA.id, code: "A" });
    await expect
      .poll(async () => (prisma as any).auditLog.count({ where: { action: "course.policy_changed", targetType: "course_policy" } }))
      .toBeGreaterThan(auditCountBefore);

    await page.goto("/audit?targetType=course_policy");
    const auditRow = page.getByRole("row", { name: /course\.policy_changed/ }).filter({ hasText: newTvLabel });
    await expect(auditRow).toBeVisible();
    await expect(auditRow).toContainText(beforeCourseA.id);
  });

  test("administrator는 정책 입력 오류를 한국어 메시지로 확인하고 기존 정책을 보존한다", async ({ page }) => {
    await login(page, "story18_administrator", "Story18!administrator");
    await page.goto("/masters/courses");

    const beforeB = await (prisma as any).course.findUnique({ where: { code: "B" }, select: { id: true, code: true } });
    const bRow = courseRow(page, "B");
    const currentPolicyForm = bRow.locator("form").first();
    await currentPolicyForm.getByLabel("시작월").fill("2026-07");
    await currentPolicyForm.getByLabel("종료월").fill("2026-06");
    await currentPolicyForm.getByRole("button", { name: "현재 정책 저장" }).click();
    await expect(bRow.getByText("적용 종료월은 시작월보다 빠를 수 없습니다.")).toBeVisible();
    const afterB = await (prisma as any).course.findUnique({ where: { code: "B" }, select: { id: true, code: true } });
    expect(afterB).toMatchObject(beforeB);

    const monthlySection = page.getByRole("heading", { name: "운영팀 월 인센 정책" }).locator("xpath=ancestor::div[contains(@class, 'border-t')][1]");
    const monthlyForm = monthlySection.locator("form").first();
    await monthlyForm.locator('input[name="leadShare"]').fill("0.5");
    await monthlyForm.getByRole("button", { name: "월 저장" }).click();
    await expect(monthlySection.getByText("팀장/카운터팀/웨이터팀 분배율 합계는 1이어야 합니다.")).toBeVisible();
  });

  for (const user of users.filter((entry) => entry.role !== "administrator")) {
    test(`non-admin ${user.role}는 direct /masters/courses 접근과 sidebar 항목에서 제외된다`, async ({ page }) => {
      await login(page, user.accountId, user.password);
      await page.goto("/masters/courses");
      await expect(page).toHaveURL(new RegExp(user.landing));
      await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: /코스\/수당\/인센/ })).toHaveCount(0);
    });
  }
});
