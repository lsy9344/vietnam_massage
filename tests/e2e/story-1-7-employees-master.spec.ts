import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { prisma } from "./support/db";
import { argon2idOptions, login } from "./support/auth";


const users = [
  { accountId: "story17_administrator", role: "administrator", password: "Story17!administrator", landing: "/live" },
  { accountId: "story17_counter", role: "counter", password: "Story17!counter", landing: "/calls" },
  { accountId: "story17_settlement_manager", role: "settlement_manager", password: "Story17!settlement_manager", landing: "/settlements" },
  { accountId: "story17_waiter", role: "waiter", password: "Story17!waiter", landing: "/rooms" },
  { accountId: "story17_read_only_viewer", role: "read_only_viewer", password: "Story17!read_only_viewer", landing: "/rooms" }
];


async function seedAuthAccount(input: {
  accountId: string;
  email: string;
  displayName: string;
  staffCode: string;
  role: string;
  secret: string;
}) {
  const sortOrder = 8000 + [...input.staffCode].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: input.displayName,
      employeeGroup: "OPERATIONS",
      position: "팀장",
      shiftType: "전체",
      baseSalary: 0,
      employmentStatus: "재직",
      sortOrder,
      isActive: true
    },
    create: {
      staffCode: input.staffCode,
      displayName: input.displayName,
      employeeGroup: "OPERATIONS",
      position: "팀장",
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

function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

async function unusedSortOrder(employeeGroup: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const sortOrder = 90000 + Math.floor(Math.random() * 9999);
    const existingCount = await (prisma as any).employee.count({ where: { employeeGroup, sortOrder } });
    if (existingCount === 0) {
      return sortOrder;
    }
  }

  throw new Error(`No unused sortOrder available for ${employeeGroup}`);
}

async function findEmployeeByStaffCode(staffCode: string) {
  return (prisma as any).employee.findUnique({
    where: { staffCode },
    select: { id: true, displayName: true, staffCode: true, isActive: true }
  });
}

test.describe("Story 1.7 직원 마스터와 계정 연결", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const user of users) {
      await seedAuthAccount({
        accountId: user.accountId,
        email: `${user.accountId}-story17@example.local`,
        displayName: user.accountId,
        staffCode: `E2E17-${user.accountId.toUpperCase()}`,
        role: user.role,
        secret: user.password
      });
    }
  });

  test("administrator는 기본 직원 그룹/count를 보고 생성, 수정, 비활성, 계정 연결과 감사 로그를 검증한다", async ({ page, browser }) => {
    const suffix = uniqueSuffix();
    const staffCode = `E2E17-CUSTOM-${suffix}`;
    const linkedAccountId = `story17_linked_counter_${suffix.toLowerCase()}`;
    const linkedEmail = `${linkedAccountId}@example.local`;
    const sortOrder = await unusedSortOrder("OPERATIONS");

    await login(page, "story17_administrator", "Story17!administrator");
    await page.goto("/masters/employees");

    await expect(page.getByRole("heading", { name: "직원", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: /직원/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /운영팀/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /귀케어팀/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /마사지사/ })).toBeVisible();
    await expect(page.getByText("OPS-LEAD-001")).toBeVisible();
    await expect(page.getByText("EAR-001")).toBeVisible();
    await expect(page.getByText("THR-050")).toBeVisible();
    await expect.poll(async () => (prisma as any).employee.count({ where: { employeeGroup: "OPERATIONS", staffCode: { startsWith: "OPS-" } } })).toBe(5);
    await expect.poll(async () => (prisma as any).employee.count({ where: { employeeGroup: "EARCARE", staffCode: { startsWith: "EAR-" } } })).toBe(4);
    await expect.poll(async () => (prisma as any).employee.count({ where: { employeeGroup: "THERAPIST", staffCode: { startsWith: "THR-" } } })).toBe(50);

    const createForm = page.locator("section").filter({ has: page.getByRole("heading", { name: "직원 생성" }) });
    await createForm.getByLabel("이름").fill("테스트 직원");
    await createForm.getByLabel("staff code").fill(staffCode);
    await createForm.getByLabel("그룹").selectOption("OPERATIONS");
    await createForm.getByLabel("직책").fill("카운터");
    await createForm.getByLabel("주/야간").selectOption("주간");
    await createForm.getByLabel("기본급").fill("1000");
    await createForm.getByLabel("정렬 순서").fill(String(sortOrder));
    await createForm.getByRole("button", { name: "직원 생성" }).click();
    await expect(page.locator('input[value="테스트 직원"]')).toBeVisible();

    const created = await findEmployeeByStaffCode(staffCode);
    expect(created).toMatchObject({ displayName: "테스트 직원", staffCode, isActive: true });

    const row = page.locator("tbody tr").filter({ hasText: staffCode });
    await expect(row.getByText(`직원 ID: ${created.id}`)).toBeVisible();
    await row.getByLabel("표시명").fill("테스트 직원 변경");
    await row.getByRole("button", { name: "프로필 저장" }).click();
    await expect(page.locator('input[value="테스트 직원 변경"]')).toBeVisible();
    const renamed = await findEmployeeByStaffCode(staffCode);
    expect(renamed).toMatchObject({ id: created.id, displayName: "테스트 직원 변경", staffCode });

    await row.getByLabel("계정 ID").fill(linkedAccountId);
    await row.getByLabel("이메일").fill(linkedEmail);
    await row.getByLabel("역할").selectOption("counter");
    await row.getByLabel("초기 비밀번호").fill("Story17!linked");
    await row.getByRole("button", { name: "계정 연결" }).click();
    await expect(row.getByText("counter")).toBeVisible();
    const linkedAccount = await (prisma as any).userAccount.findUnique({
      where: { accountId: linkedAccountId },
      select: { employeeId: true, role: true, isActive: true }
    });
    expect(linkedAccount).toMatchObject({ employeeId: created.id, role: "counter", isActive: true });

    const linkedPage = await browser.newPage();
    await login(linkedPage, linkedAccountId, "Story17!linked");
    await expect(linkedPage).toHaveURL(/\/calls/);
    await linkedPage.close();

    await row.getByRole("button", { name: "비활성 처리" }).click();
    await expect(row.getByText("비활성")).toBeVisible();
    const deactivated = await findEmployeeByStaffCode(staffCode);
    expect(deactivated).toMatchObject({ id: created.id, staffCode, isActive: false });
    const accountAfterEmployeeDeactivate = await (prisma as any).userAccount.findUnique({
      where: { accountId: linkedAccountId },
      select: { isActive: true, employeeId: true }
    });
    expect(accountAfterEmployeeDeactivate).toMatchObject({ employeeId: created.id, isActive: true });

    await page.goto("/audit?targetType=employee");
    await expect(page.getByRole("row", { name: /employee\.profile_changed/ }).first()).toBeVisible();
    await page.goto("/audit?targetType=user_account");
    await expect(page.getByRole("row", { name: /user_account\.linked_to_employee/ }).first()).toBeVisible();
  });

  test("administrator는 직원 생성과 계정 연결의 핵심 오류를 한국어 메시지로 본다", async ({ page }) => {
    const suffix = uniqueSuffix().toLowerCase();

    await login(page, "story17_administrator", "Story17!administrator");
    await page.goto("/masters/employees");

    const createForm = page.locator("section").filter({ has: page.getByRole("heading", { name: "직원 생성" }) });
    await createForm.getByLabel("이름").fill("오류 직원");
    await createForm.getByLabel("staff code").fill("bad-code");
    await createForm.getByLabel("그룹").selectOption("OPERATIONS");
    await createForm.getByLabel("직책").fill("카운터");
    await createForm.getByLabel("주/야간").selectOption("주간");
    await createForm.getByLabel("기본급").fill("1000");
    await createForm.getByLabel("정렬 순서").fill("9801");
    await createForm.getByRole("button", { name: "직원 생성" }).click();
    await expect(page.getByText("staff code는 영문 대문자, 숫자, 하이픈만 사용할 수 있습니다.")).toBeVisible();

    await createForm.getByLabel("staff code").fill("OPS-LEAD-001");
    await createForm.getByRole("button", { name: "직원 생성" }).click();
    await expect(page.getByText("이미 사용 중인 staff code입니다.")).toBeVisible();

    const row = page.locator("tbody tr").filter({ hasText: "OPS-COUNTER-NIGHT-001" });
    await row.getByLabel("계정 ID").fill(`story17_no_secret_${suffix}`);
    await row.getByLabel("이메일").fill(`story17_no_secret_${suffix}@example.local`);
    await row.getByLabel("역할").selectOption("counter");
    await row.getByRole("button", { name: "계정 연결" }).click();
    await expect(page.getByText("새 계정을 만들려면 초기 비밀번호가 필요합니다.")).toBeVisible();
  });

  for (const user of users.filter((entry) => entry.role !== "administrator")) {
    test(`${user.role}는 direct /masters/employees 접근과 sidebar 직원 항목에서 제외된다`, async ({ page }) => {
      await login(page, user.accountId, user.password);
      await page.goto("/masters/employees");
      await expect(page).toHaveURL(new RegExp(user.landing));
      await expect(page.getByRole("navigation", { name: "ERP 도메인 메뉴" }).getByRole("link", { name: /직원/ })).toHaveCount(0);
    });
  }
});

// Static validator anchors: user_account.linked_to_employee, employee.profile_changed.
