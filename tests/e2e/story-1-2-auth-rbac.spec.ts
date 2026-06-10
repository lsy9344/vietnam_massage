import { expect, test } from "@playwright/test";
import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vietnam_massage";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);
const argon2idOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

const users = [
  {
    accountId: "administrator",
    role: "administrator",
    password: "Story12!administrator",
    landing: "/live",
    visibleGroups: ["운영 현황", "콜 원장", "정산", "월마감", "대시보드", "마스터 설정", "감사 로그"],
    hiddenGroups: [],
    visibleLinks: [
      "첫화면 실시간 현황",
      "객실 현황",
      "TV 현황판",
      "콜/예약 입력 원장",
      "정산 화면",
      "월마감",
      "오늘 대시보드",
      "직원",
      "시트 기능 매핑표",
      "감사 로그"
    ],
    hiddenLinks: []
  },
  {
    accountId: "counter",
    role: "counter",
    password: "Story12!counter",
    landing: "/calls",
    visibleGroups: ["운영 현황", "콜 원장", "대시보드"],
    hiddenGroups: ["정산", "월마감", "마스터 설정", "감사 로그"],
    visibleLinks: ["첫화면 실시간 현황", "객실 현황", "콜/예약 입력 원장", "오늘 대시보드"],
    hiddenLinks: ["TV 현황판", "정산 화면", "월마감", "직원", "감사 로그"]
  },
  {
    accountId: "settlement_manager",
    role: "settlement_manager",
    password: "Story12!settlement_manager",
    landing: "/settlements",
    visibleGroups: ["정산", "월마감", "대시보드"],
    hiddenGroups: ["운영 현황", "콜 원장", "마스터 설정", "감사 로그"],
    visibleLinks: ["정산 화면", "월마감", "오늘 대시보드"],
    hiddenLinks: ["첫화면 실시간 현황", "객실 현황", "TV 현황판", "콜/예약 입력 원장", "직원", "감사 로그"]
  },
  {
    accountId: "waiter",
    role: "waiter",
    password: "Story12!waiter",
    landing: "/rooms",
    visibleGroups: ["운영 현황"],
    hiddenGroups: ["콜 원장", "정산", "월마감", "대시보드", "마스터 설정", "감사 로그"],
    visibleLinks: ["객실 현황"],
    hiddenLinks: ["첫화면 실시간 현황", "TV 현황판", "콜/예약 입력 원장", "정산 화면", "월마감", "오늘 대시보드", "직원", "감사 로그"]
  },
  {
    accountId: "read_only_viewer",
    role: "read_only_viewer",
    password: "Story12!read_only_viewer",
    landing: "/rooms",
    visibleGroups: ["운영 현황", "대시보드", "마스터 설정"],
    hiddenGroups: ["콜 원장", "정산", "월마감", "감사 로그"],
    visibleLinks: ["객실 현황", "TV 현황판", "오늘 대시보드", "시트 기능 매핑표"],
    hiddenLinks: ["첫화면 실시간 현황", "콜/예약 입력 원장", "정산 화면", "월마감", "직원", "감사 로그"]
  }
];

async function login(page: import("@playwright/test").Page, accountId: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("이메일 또는 계정 ID").fill(accountId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

async function seedAuthAccount(input: {
  accountId: string;
  email: string;
  displayName: string;
  staffCode: string;
  role: string;
  isActive: boolean;
  lockedUntil: Date | null;
  secret: string;
}) {
  const sortOrder = 7000 + [...input.staffCode].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const employeeDefaults = {
    employeeGroup: "OPERATIONS",
    position: input.role === "waiter" ? "웨이터" : input.role === "counter" ? "카운터" : "팀장",
    shiftType: input.role === "counter" || input.role === "waiter" ? "주간" : "전체",
    baseSalary: 0,
    employmentStatus: "재직",
    sortOrder
  };
  const employee = await (prisma as any).employee.upsert({
    where: { staffCode: input.staffCode },
    update: {
      displayName: input.displayName,
      ...employeeDefaults,
      isActive: true
    },
    create: {
      staffCode: input.staffCode,
      displayName: input.displayName,
      ...employeeDefaults,
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
      isActive: input.isActive,
      lockedUntil: input.lockedUntil,
      failedLoginCount: input.lockedUntil ? 5 : 0
    },
    create: {
      email: input.email,
      accountId: input.accountId,
      passwordHash,
      role: input.role,
      employeeId: employee.id,
      isActive: input.isActive,
      lockedUntil: input.lockedUntil,
      failedLoginCount: input.lockedUntil ? 5 : 0
    }
  });
}

test.describe("Story 1.2 직원 로그인과 RBAC", () => {
  test.beforeAll(async () => {
    for (const user of users) {
      await seedAuthAccount({
        accountId: user.accountId,
        email: `${user.accountId}@example.local`,
        displayName: user.accountId,
        staffCode: `E2E-${user.accountId.toUpperCase()}`,
        role: user.role,
        isActive: true,
        lockedUntil: null,
        secret: user.password
      });
    }
  });

  for (const user of users) {
    test(`${user.accountId} 로그인 후 역할별 landing과 sidebar만 렌더링한다`, async ({ page }) => {
      await login(page, user.accountId, user.password);
      await expect(page).toHaveURL(new RegExp(`${user.landing}$`));
      const menu = page.getByRole("navigation", { name: "ERP 도메인 메뉴" });

      for (const label of user.visibleGroups) {
        await expect(menu.getByText(label, { exact: true })).toBeVisible();
      }
      for (const label of user.hiddenGroups) {
        await expect(menu.getByText(label, { exact: true })).toHaveCount(0);
      }
      for (const label of user.visibleLinks) {
        await expect(menu.getByRole("link", { name: label })).toBeVisible();
      }
      for (const label of user.hiddenLinks) {
        await expect(menu.getByRole("link", { name: label })).toHaveCount(0);
      }
    });
  }

  test("이메일 identity로도 직원 계정 로그인이 가능하다", async ({ page }) => {
    await login(page, "administrator@example.local", "Story12!administrator");
    await expect(page).toHaveURL(/\/live$/);
    await expect(page.getByRole("heading", { name: "첫화면 실시간 현황", level: 3 })).toBeVisible();
  });

  test("public signup affordance가 없고 실패 메시지는 안전한 문구로 통일된다", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByText(/signup|sign up|회원가입|가입하기|계정 만들기/i)).toHaveCount(0);
    await page.getByLabel("이메일 또는 계정 ID").fill("unknown");
    await page.getByLabel("비밀번호").fill("wrong-password");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByText("계정 정보가 올바르지 않거나 사용할 수 없습니다.")).toBeVisible();
  });

  test("비활성 또는 잠금 계정 로그인은 같은 안전한 오류 메시지로 거부된다", async ({ page }) => {
    await seedAuthAccount({
      accountId: "inactive_e2e",
      email: "inactive-e2e@example.local",
      displayName: "비활성 E2E",
      staffCode: "E2E-INACTIVE",
      role: "counter",
      isActive: false,
      lockedUntil: null,
      secret: "Story12!inactive_e2e"
    });
    await seedAuthAccount({
      accountId: "locked_e2e",
      email: "locked-e2e@example.local",
      displayName: "잠금 E2E",
      staffCode: "E2E-LOCKED",
      role: "counter",
      isActive: true,
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      secret: "Story12!locked_e2e"
    });

    await login(page, "inactive_e2e", "Story12!inactive_e2e");
    await expect(page.getByText("계정 정보가 올바르지 않거나 사용할 수 없습니다.")).toBeVisible();

    await page.getByLabel("이메일 또는 계정 ID").fill("locked_e2e");
    await page.getByLabel("비밀번호").fill("Story12!locked_e2e");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByText("계정 정보가 올바르지 않거나 사용할 수 없습니다.")).toBeVisible();
  });

  const blockedRoutes = [
    {
      accountId: "counter",
      password: "Story12!counter",
      forbiddenPath: "/settlements",
      expectedLanding: /\/calls$/,
      expectedHeading: "콜/예약 입력 원장"
    },
    {
      accountId: "settlement_manager",
      password: "Story12!settlement_manager",
      forbiddenPath: "/calls",
      expectedLanding: /\/settlements$/,
      expectedHeading: "정산 화면"
    },
    {
      accountId: "waiter",
      password: "Story12!waiter",
      forbiddenPath: "/settlements",
      expectedLanding: /\/rooms$/,
      expectedHeading: "객실 현황"
    },
    {
      accountId: "read_only_viewer",
      password: "Story12!read_only_viewer",
      forbiddenPath: "/masters/employees",
      expectedLanding: /\/rooms$/,
      expectedHeading: "객실 현황"
    }
  ];

  for (const routeCase of blockedRoutes) {
    test(`${routeCase.accountId} direct route 접근은 서버에서 역할 landing으로 차단된다`, async ({ page }) => {
      await login(page, routeCase.accountId, routeCase.password);
      await page.goto(routeCase.forbiddenPath);
      await expect(page).toHaveURL(routeCase.expectedLanding);
      await expect(page.getByRole("heading", { name: routeCase.expectedHeading, level: 3 })).toBeVisible();
    });
  }

  test.afterAll(async () => {
    await prisma.$disconnect();
  });
});
