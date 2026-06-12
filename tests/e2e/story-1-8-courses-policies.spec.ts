import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, gotoStable, login } from "./support/auth";
import { defaultCourseSeeds } from "@/modules/masters/course-schema";


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

  test.afterAll(async () => {
    // 테스트가 코스 정책 tvDisplayName/name을 변경하므로(현재 정책 저장), 반복 실행 안정성을 위해
    // 각 코스의 활성 정책을 schema 기본값으로 복원한다(teardown 부재 시 다음 실행에서 원본 라벨 누락).
    for (const seed of defaultCourseSeeds) {
      const course = await (prisma as any).course.findUnique({ where: { code: seed.code }, select: { id: true } });
      if (!course) continue;
      await (prisma as any).coursePolicy.updateMany({
        where: { courseId: course.id, isActive: true },
        data: { tvDisplayName: seed.tvDisplayName, name: seed.name }
      });
    }
    await prisma.$disconnect();
  });

  test("administrator는 기본 코스, D코스 설정, 0원 수당, 일/월 인센, 정책 변경 감사 로그를 확인한다", async ({ page }) => {
    await login(page, "story18_administrator", "Story18!administrator");
    await gotoStable(page, "/masters/courses");

    await expect(page.getByRole("heading", { name: "코스/수당/인센", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: /코스\/수당\/인센/ })).toBeVisible();
    // tvDisplayName은 텍스트 노드가 아니라 정책 폼의 input value(course-forms.tsx)로 렌더되므로
    // getByText로는 잡히지 않는다. input value 로케이터로 확인한다.
    await expect(page.locator('input[value="A 누루60"]').first()).toBeVisible();
    await expect(page.locator('input[value="B 귀청소90"]').first()).toBeVisible();
    await expect(page.locator('input[value="C 때밀이90"]').first()).toBeVisible();
    await expect(page.locator('input[value="D 2:1 90"]').first()).toBeVisible();
    await expect(page.locator('input[value="E 풀코스120"]').first()).toBeVisible();
    await expect(courseRow(page, "D").getByText("마사지사2 필요: Y")).toBeVisible();
    await expect(page.getByText("0원 수당")).toBeVisible();
    await expect(page.locator('input[value="0"]').first()).toBeVisible();
    await expect(page.getByText("30콜").or(page.locator('input[value="30"]')).first()).toBeVisible();
    await expect(page.locator('input[value="1000"]').first()).toBeVisible();

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
    // 코스 A 행에는 현재 정책 폼(현재 정책 저장)과 새 정책 폼이 각각 TV 표시명 input을 렌더한다.
    // 현재 정책 폼의 input(first)을 채우고 같은 폼의 "현재 정책 저장" 버튼을 누른다.
    const currentPolicyForm = row.locator("form").filter({ has: page.getByRole("button", { name: "현재 정책 저장" }) });
    await currentPolicyForm.getByLabel("TV 표시명").fill(newTvLabel);
    // 저장 server action POST 응답을 기다린 뒤 반환해 in-flight POST 중 goto가 abort되지 않게 한다.
    const saveResponse = page
      .waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/masters/courses"), { timeout: 15_000 })
      .catch(() => undefined);
    await currentPolicyForm.getByRole("button", { name: "현재 정책 저장" }).click();
    await saveResponse;
    // 정책 저장 반영을 DB 폴링으로 확정한 뒤 goto로 RSC를 재조회한다.
    await expect
      .poll(async () =>
        (await (prisma as any).coursePolicy.count({ where: { courseId: beforeCourseA.id, tvDisplayName: newTvLabel } }))
      )
      .toBeGreaterThan(0);
    await page.goto("/masters/courses");
    await expect(page.locator(`input[value="${newTvLabel}"]`).first()).toBeVisible();

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
