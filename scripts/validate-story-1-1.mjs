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

[
  "package.json",
  "pnpm-lock.yaml",
  "next.config.ts",
  "tsconfig.json",
  "eslint.config.mjs",
  "postcss.config.mjs",
  "components.json",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/globals.css",
  "src/components/ui/button.tsx",
  "src/components/ui/skeleton.tsx",
  "src/components/ui/separator.tsx",
  "src/components/domain/status-badge.tsx",
  "src/lib/utils.ts"
].forEach(requireFile);

["docs", "_bmad-output", "src/modules", "src/shared", "design.md", "sheet.xlsx"].forEach(requireFile);

const packageJson = JSON.parse(read("package.json") || "{}");
const requiredDeps = [
  "next",
  "react",
  "react-dom",
  "@prisma/client",
  "prisma",
  "@prisma/adapter-pg",
  "pg",
  "dotenv",
  "tsx",
  "@types/pg",
  "zod",
  "@auth/prisma-adapter",
  "next-auth"
];

for (const dep of requiredDeps) {
  if (!packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]) {
    errors.push(`package.json is missing dependency version: ${dep}`);
  }
}

const tsconfig = JSON.parse(read("tsconfig.json") || "{}");
if (tsconfig.compilerOptions?.paths?.["@/*"]?.[0] !== "./src/*") {
  errors.push("tsconfig.json must define @/* -> ./src/*");
}

const css = read("src/app/globals.css");
const cssTokens = [
  "--brand",
  "--brand-secondary",
  "--background",
  "--surface",
  "--text",
  "--border",
  "--muted",
  "--danger",
  "--readonly",
  "--status-active",
  "--status-reserved",
  "--status-cleaning",
  "--status-complete-check",
  "--status-complete-check-glow",
  "--status-empty"
];

for (const token of cssTokens) {
  if (!css.includes(token)) {
    errors.push(`globals.css missing token: ${token}`);
  }
}

if (!css.includes("#3D3115")) {
  errors.push("globals.css must preserve dark foreground #3D3115 for cleaning and empty states");
}

if (!css.includes("@media (prefers-reduced-motion: reduce)")) {
  errors.push("globals.css missing reduced-motion support for status attention classes");
}

const page = read("src/app/page.tsx");
const routes = read("src/lib/routes.ts");
const emptyState = read("src/components/domain/erp-empty-state.tsx");
// i18n 전환: 업무 흐름 도크 구역 라벨은 routes.ts에서 메시지 key로, 한국어 문구는 messages/ko.ts로 이동했다.
// 구역 순서는 routes.ts의 zones 배열 등장 순서로, 한국어 문구 존재는 ko.ts로 검증한다.
const koMessages = read("src/lib/i18n/messages/ko.ts");
const dockZoneKeys = ["ledger", "floor", "customers", "settlements", "closing", "reports", "settings"];
const dockZoneOrder = ["원장", "현장", "고객", "정산", "마감", "보고", "설정"];
let previousIndex = -1;
for (const key of dockZoneKeys) {
  const index = routes.indexOf(`"${key}"`);
  if (index === -1) {
    errors.push(`routes.ts missing dock zone key: ${key}`);
  }
  if (index !== -1 && index < previousIndex) {
    errors.push(`Dock zone key is out of order: ${key}`);
  }
  previousIndex = index;
}
for (const label of dockZoneOrder) {
  if (!koMessages.includes(label)) {
    errors.push(`messages/ko.ts missing dock zone label: ${label}`);
  }
}

for (const prohibited of ["fake", "dummy", "샘플 고객", "가짜"]) {
  const combined = `${page}\n${routes}\n${emptyState}`.toLowerCase();
  if (combined.includes(prohibited)) {
    errors.push(`app shell contains placeholder-like text: ${prohibited}`);
  }
}

const statusBadge = read("src/components/domain/status-badge.tsx");
const foregroundTokens = [
  "text-status-active-foreground",
  "text-status-reserved-foreground",
  "text-status-cleaning-foreground",
  "text-status-complete-check-foreground",
  "text-status-empty-foreground"
];
const statusRules = {
  "사용중": "●",
  "예약": "◷",
  "청소중": "◐",
  "종료확인": "⚠",
  "빈방": "○"
};

for (const [label, glyph] of Object.entries(statusRules)) {
  if (!statusBadge.includes(label) || !statusBadge.includes(glyph)) {
    errors.push(`StatusBadge missing label/glyph pair: ${label} ${glyph}`);
  }
}

for (const token of foregroundTokens) {
  if (!css.includes(token.replace("text-", "--color-")) || !statusBadge.includes(token)) {
    errors.push(`StatusBadge must use reusable foreground token: ${token}`);
  }
}

if (errors.length > 0) {
  console.error("Story 1.1 static validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Story 1.1 static validation passed.");
