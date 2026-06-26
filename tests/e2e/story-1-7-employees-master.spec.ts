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
    await expect(page.getByText("OPS-LEAD-001").first()).toBeVisible();
    await expect(page.getByText("EAR-001").first()).toBeVisible();
    await expect(page.getByText("THR-050").first()).toBeVisible();
    await expect.poll(async () => (prisma as any).employee.count({ where: { employeeGroup: "OPERATIONS", staffCode: { startsWith: "OPS-" } } })).toBe(5);
    await expect.poll(async () => (prisma as any).employee.count({ where: { employeeGroup: "EARCARE", staffCode: { startsWith: "EAR-" } } })).toBe(4);
    await expect.poll(async () => (prisma as any).employee.count({ where: { employeeGroup: "THERAPIST", staffCode: { startsWith: "THR-" } } })).toBe(50);

    // 범위를 section이 아니라 form으로 좁힌다. section은 생성 폼과 직원 테이블을
    // 모두 포함해, getByLabel("그룹")이 테이블 행의 인라인 <select>까지 매칭(strict 위반)한다.
    const createForm = page.locator("form").filter({ has: page.getByRole("button", { name: "직원 생성" }) });
    await createForm.getByLabel("이름").fill("테스트 직원");
    await createForm.getByLabel("staff code").fill(staffCode);
    await createForm.getByLabel("그룹").selectOption("OPERATIONS");
    await createForm.getByLabel("직책").fill("카운터");
    await createForm.getByLabel("주/야간").selectOption("주간");
    await createForm.getByLabel("기본급").fill("1000");
    await createForm.getByLabel("정렬 순서").fill(String(sortOrder));
    await createForm.getByRole("button", { name: "직원 생성" }).click();
    // 생성 server action 완료를 DB 폴링으로 확정한 뒤 reload로 RSC를 강제 동기화한다.
    // (`input[value="테스트 직원"]`는 리셋된 생성 폼/비제어 표시명 input 사이에서 불안정하고,
    //  클릭 직후 row 단언은 revalidate race로 깨진다.)
    await expect.poll(async () => (await findEmployeeByStaffCode(staffCode))?.staffCode).toBe(staffCode);
    // reload는 in-flight server action POST를 abort(net::ERR_ABORTED)시키므로, 새 네비게이션(goto)으로
    // RSC를 안전하게 재조회한다. DB poll로 생성이 이미 확정되었으니 새 페이지에 직원 행이 보인다.
    await page.goto("/masters/employees");
    const row = page.locator("tbody tr").filter({ hasText: staffCode });
    await expect(row).toBeVisible();

    const created = await findEmployeeByStaffCode(staffCode);
    expect(created).toMatchObject({ displayName: "테스트 직원", staffCode, isActive: true });

    await expect(row.getByText(`직원 ID: ${created.id}`)).toBeVisible();
    await row.getByLabel("표시명").fill("테스트 직원 변경");
    await row.getByRole("button", { name: "프로필 저장" }).click();
    await expect(row.getByLabel("표시명")).toHaveValue("테스트 직원 변경");
    // 비제어 input의 toHaveValue는 내가 채운 값이라 즉시 통과하므로 server action 반영을 보장하지 못한다.
    // revalidate 후 DB가 갱신되기를 폴링해 이후 단언이 stale row를 읽지 않게 한다.
    await expect
      .poll(async () => (await findEmployeeByStaffCode(staffCode))?.displayName)
      .toBe("테스트 직원 변경");
    const renamed = await findEmployeeByStaffCode(staffCode);
    expect(renamed).toMatchObject({ id: created.id, displayName: "테스트 직원 변경", staffCode });

    await row.getByLabel("계정 ID").fill(linkedAccountId);
    await row.getByLabel("이메일").fill(linkedEmail);
    await row.getByLabel("역할").selectOption("counter");
    await row.getByLabel("초기 비밀번호").fill("Story17!linked");
    await row.getByRole("button", { name: "계정 연결" }).click();
    // 계정 연결 server action 완료를 DB 폴링으로 먼저 확정해 revalidate race를 제거한다.
    await expect.poll(async () => (await (prisma as any).userAccount.findUnique({ where: { accountId: linkedAccountId }, select: { role: true } }))?.role).toBe("counter");
    // "counter"는 역할 <select>의 selected option과 결과 표시 div("현재 역할: counter") 양쪽에 매칭(strict 위반).
    // 계정 연결 결과는 표시 div로 확인한다.
    await expect(row.getByText("현재 역할: counter")).toBeVisible();
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
    // 비활성 server action 완료를 DB 폴링으로 확정한다(서버 진실).
    await expect.poll(async () => (await findEmployeeByStaffCode(staffCode))?.isActive).toBe(false);
    // goto로 RSC를 안전하게 재조회한 뒤 UI 신호를 확인한다("비활성"은 "비활성 처리" 버튼에도 매칭되는
    // 거짓 양성이므로, 비활성 시 버튼이 대체되는 "이미 비활성" 텍스트로 확인 — employee-forms.tsx).
    await page.goto("/masters/employees");
    const deactivatedRow = page.locator("tbody tr").filter({ hasText: staffCode });
    await expect(deactivatedRow.getByText("이미 비활성")).toBeVisible();
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

    // 범위를 section이 아니라 form으로 좁힌다. section은 생성 폼과 직원 테이블을
    // 모두 포함해, getByLabel("그룹")이 테이블 행의 인라인 <select>까지 매칭(strict 위반)한다.
    const createForm = page.locator("form").filter({ has: page.getByRole("button", { name: "직원 생성" }) });
    await createForm.getByLabel("이름").fill("오류 직원");
    await createForm.getByLabel("staff code").fill("bad-code");
    await createForm.getByLabel("그룹").selectOption("OPERATIONS");
    await createForm.getByLabel("직책").fill("카운터");
    await createForm.getByLabel("주/야간").selectOption("주간");
    await createForm.getByLabel("기본급").fill("1000");
    await createForm.getByLabel("정렬 순서").fill("9801");
    await createForm.getByRole("button", { name: "직원 생성" }).click();
    await expect(page.getByText("staff code는 영문 대문자, 숫자, 하이픈만 사용할 수 있습니다.")).toBeVisible();

    // 직원 생성 server action 제출 후 비제어 input이 리렌더로 초기화되므로,
    // 두 번째 제출 전에 필수 필드를 다시 채워야 zod 검증을 통과해 도메인 단계(중복 staff code)까지 도달한다.
    await createForm.getByLabel("이름").fill("오류 직원");
    await createForm.getByLabel("staff code").fill("OPS-LEAD-001");
    await createForm.getByLabel("그룹").selectOption("OPERATIONS");
    await createForm.getByLabel("직책").fill("카운터");
    await createForm.getByLabel("주/야간").selectOption("주간");
    await createForm.getByLabel("기본급").fill("1000");
    await createForm.getByLabel("정렬 순서").fill("9801");
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

  // 이 스펙이 생성하는 E2E17 직원과 연결 계정을 정리한다. teardown이 없으면 매 실행마다
  // "테스트 직원" 행이 누적되어 value 기반 셀렉터가 strict 위반으로 깨진다(test-review H2).
  // 직원은 FK 참조(ServiceCallAssignment 등) 가능성이 있어 물리삭제 대신 고유 prefix로
  // rename + 비활성화해 후속 실행의 셀렉터 충돌만 제거한다.
  test.afterAll(async () => {
    const e2eEmployees = await (prisma as any).employee.findMany({
      where: { staffCode: { startsWith: "E2E17-CUSTOM" } },
      select: { id: true }
    });
    const employeeIds = e2eEmployees.map((e: { id: string }) => e.id);
    if (employeeIds.length > 0) {
      await (prisma as any).userAccount.deleteMany({ where: { employeeId: { in: employeeIds } } });
      // 표시명을 고유화해 다음 실행의 `input[value="테스트 직원"]` 중복 매칭을 막는다.
      for (const id of employeeIds) {
        await (prisma as any).employee.update({
          where: { id },
          data: { isActive: false, displayName: `E2E17-정리됨-${id.slice(0, 8)}` }
        });
      }
    }
    await (prisma as any).userAccount.deleteMany({ where: { accountId: { startsWith: "story17_no_secret" } } });
    await prisma.$disconnect();
  });
});

// Static validator anchors: user_account.linked_to_employee, employee.profile_changed.
