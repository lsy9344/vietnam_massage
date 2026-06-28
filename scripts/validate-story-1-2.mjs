import { existsSync, readFileSync } from "node:fs";

const errors = [];

function requireFile(path) {
  if (!existsSync(path)) {
    errors.push(`Missing required file: ${path}`);
  }
}

function read(path) {
  requireFile(path);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function readJson(path) {
  const contents = read(path);
  return contents ? JSON.parse(contents) : {};
}

[
  ".env.example",
  "prisma/schema.prisma",
  "src/app/page.tsx",
  "src/app/(auth)/sign-in/page.tsx",
  "src/app/(auth)/sign-in/sign-in-form.tsx",
  "src/app/api/auth/[...nextauth]/route.ts",
  "src/app/(erp)/layout.tsx",
  "src/app/(erp)/live/page.tsx",
  "src/app/(erp)/calls/page.tsx",
  "src/app/(erp)/rooms/page.tsx",
  "src/app/(erp)/settlements/page.tsx",
  "src/app/(erp)/closing/page.tsx",
  "src/app/(erp)/dashboard/today/page.tsx",
  "src/app/tv/page.tsx",
  "src/components/domain/role-aware-sidebar.tsx",
  "src/components/domain/erp-empty-state.tsx",
  "src/lib/action-result.ts",
  "src/lib/auth-messages.ts",
  "src/lib/auth.ts",
  "src/lib/authorization.ts",
  "src/lib/navigation.ts",
  "src/lib/prisma.ts",
  "src/modules/masters/account-service.ts",
  "scripts/seed-dev-accounts.ts",
  "tests/e2e/story-1-2-auth-rbac.spec.ts"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (packageJson.dependencies?.["@node-rs/argon2"] === undefined) {
  errors.push("package.json must include @node-rs/argon2 as a dependency");
}
if (packageJson.dependencies?.["next-auth"] !== "4.24.14") {
  errors.push("Story 1.2 must keep next-auth@4.24.14 stable");
}

const envExample = read(".env.example");
for (const envName of ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"]) {
  if (!envExample.includes(envName)) {
    errors.push(`.env.example missing ${envName}`);
  }
}
if (/^AUTH_SECRET=/m.test(envExample)) {
  errors.push("Use NextAuth v4 NEXTAUTH_SECRET instead of AUTH_SECRET");
}

const prismaSchema = read("prisma/schema.prisma");
for (const required of [
  "model UserAccount",
  "model Employee",
  "model LoginAttempt",
  "passwordHash",
  "failedLoginCount",
  "lockedUntil",
  "@map(\"user_accounts\")",
  "@map(\"employees\")",
  "@map(\"login_attempts\")"
]) {
  if (!prismaSchema.includes(required)) {
    errors.push(`prisma/schema.prisma missing ${required}`);
  }
}
for (const prohibited of ["plainPassword", "temporaryPassword", "reversiblePassword", "password String"]) {
  if (prismaSchema.includes(prohibited)) {
    errors.push(`prisma/schema.prisma contains prohibited password material: ${prohibited}`);
  }
}

const authMessages = read("src/lib/auth-messages.ts");
const auth = `${read("src/lib/auth.ts")}\n${authMessages}`;
for (const required of [
  "CredentialsProvider",
  "계정 정보가 올바르지 않거나 사용할 수 없습니다.",
  "authenticateAccount",
  "accountId",
  "employeeId",
  "role"
]) {
  if (!auth.includes(required)) {
    errors.push(`src/lib/auth.ts missing ${required}`);
  }
}
if (auth.includes("GoogleProvider") || auth.includes("EmailProvider")) {
  errors.push("Story 1.2 must not add OAuth or email magic-link providers");
}
if (auth.includes("...session.user") || auth.includes("name: account.") || auth.includes("email: account.")) {
  errors.push("NextAuth session/user callback must keep only accountId, role, and employeeId hints");
}

const signInPage = read("src/app/(auth)/sign-in/page.tsx");
const signInForm = read("src/app/(auth)/sign-in/sign-in-form.tsx");
const signInCombined = `${signInPage}\n${signInForm}\n${authMessages}`;
for (const prohibited of ["signup", "sign up", "회원가입", "가입하기", "계정 만들기"]) {
  if (signInCombined.toLowerCase().includes(prohibited.toLowerCase())) {
    errors.push(`sign-in UI contains public signup affordance: ${prohibited}`);
  }
}
if (!signInCombined.includes("계정 정보가 올바르지 않거나 사용할 수 없습니다.")) {
  errors.push("sign-in UI must use the safe Korean auth failure message");
}

const authorization = read("src/lib/authorization.ts");
for (const role of ["administrator", "counter", "waiter", "settlement_manager", "read_only_viewer"]) {
  if (!authorization.includes(role)) {
    errors.push(`authorization role missing: ${role}`);
  }
}
for (const required of [
  "getRoleLandingPath",
  "requireRouteAccess",
  "requirePermission",
  "getCurrentAccountAuthorization",
  "/live",
  "/calls",
  "/settlements",
  "/rooms"
]) {
  if (!authorization.includes(required)) {
    errors.push(`authorization helper missing: ${required}`);
  }
}
if (!authorization.includes("redirect(")) {
  errors.push("route access guard must block direct unauthorized access server-side");
}

const navigation = read("src/lib/navigation.ts");
// i18n 전환: 사이드바 라벨은 메시지 key(navigation.ts)와 한국어 문구(messages/ko.ts)로 분리됐다.
const koMessages = read("src/lib/i18n/messages/ko.ts");
const sidebarGroupKeys = [
  "nav.group.operations",
  "nav.group.calls",
  "nav.group.settlements",
  "nav.group.closing",
  "nav.group.dashboard",
  "nav.group.masters",
  "nav.group.audit"
];
const sidebarOrder = ["운영 현황", "콜 원장", "정산", "월마감", "대시보드", "마스터 설정", "감사 로그"];
let previousIndex = -1;
for (const key of sidebarGroupKeys) {
  const index = navigation.indexOf(key);
  if (index === -1) {
    errors.push(`navigation.ts missing sidebar group key: ${key}`);
  }
  if (index !== -1 && index < previousIndex) {
    errors.push(`navigation.ts sidebar group out of order: ${key}`);
  }
  previousIndex = index;
}
for (const label of sidebarOrder) {
  if (!koMessages.includes(label)) {
    errors.push(`messages/ko.ts missing sidebar group label: ${label}`);
  }
}
for (const required of ["getNavigationForRole", "allowedRoles"]) {
  if (!navigation.includes(required)) {
    errors.push(`navigation.ts missing ${required}`);
  }
}
for (const label of ["TV 현황판", "오늘 대시보드"]) {
  if (!koMessages.includes(label)) {
    errors.push(`messages/ko.ts missing navigation label: ${label}`);
  }
}
if (navigation.includes("disabled")) {
  errors.push("navigation must hide unauthorized groups/items, not disable them");
}

const layout = read("src/app/(erp)/layout.tsx");
if (!layout.includes("getCurrentAccountAuthorization") || !layout.includes("redirect(\"/sign-in\")")) {
  errors.push("(erp)/layout.tsx must recheck account status server-side and redirect unauthenticated users");
}
if (!layout.includes("RoleAwareSidebar")) {
  errors.push("(erp)/layout.tsx must render the role-aware sidebar");
}

const rootPage = read("src/app/page.tsx");
if (!rootPage.includes("getRoleLandingPath") || !rootPage.includes("redirect(\"/sign-in\")")) {
  errors.push("root page must be an auth-aware redirect entry");
}

const accountService = read("src/modules/masters/account-service.ts");
for (const required of [
  "@node-rs/argon2",
  "hashPassword",
  "verifyPassword",
  "authenticateAccount",
  "recordFailedLogin",
  "LOGIN_LOCKOUT_THRESHOLD",
  "LOGIN_LOCKOUT_MINUTES"
]) {
  if (!accountService.includes(required)) {
    errors.push(`account service missing ${required}`);
  }
}
for (const prohibited of ["bcrypt", "createHash", "createCipher", "decrypt"]) {
  if (accountService.includes(prohibited)) {
    errors.push(`account service contains prohibited password approach: ${prohibited}`);
  }
}
if (!accountService.includes("try {") || !accountService.includes("return false;")) {
  errors.push("verifyPassword must safely fail malformed hashes instead of surfacing auth internals");
}

const nextAuthTypes = read("src/types/next-auth.d.ts");
if (nextAuthTypes.includes("DefaultSession")) {
  errors.push("NextAuth Session type must not include DefaultSession name/email/image fields");
}

const seedScript = read("scripts/seed-dev-accounts.ts");
if (!seedScript.includes("const passwordHash = await hashPassword(account.localOnlySecret);")) {
  errors.push("seed-dev-accounts.ts must hash each local-only secret once before upsert");
}

const actionResult = read("src/lib/action-result.ts");
for (const required of ["ok: true", "ok: false", "fieldErrors", "formError", "domainErrorCode"]) {
  if (!actionResult.includes(required)) {
    errors.push(`ActionResult missing ${required}`);
  }
}

const e2e = read("tests/e2e/story-1-2-auth-rbac.spec.ts");
for (const required of ["administrator", "counter", "settlement_manager", "waiter", "read_only_viewer", "direct route"]) {
  if (!e2e.includes(required)) {
    errors.push(`Story 1.2 e2e missing ${required}`);
  }
}
if (!e2e.includes("test.beforeAll") || !e2e.includes("seedAuthAccount")) {
  errors.push("Story 1.2 e2e must seed its role accounts before login assertions");
}

if (errors.length > 0) {
  console.error("Story 1.2 static validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Story 1.2 static validation passed.");
