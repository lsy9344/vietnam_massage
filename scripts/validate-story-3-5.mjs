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

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) / 255,
    g: Number.parseInt(normalized.slice(2, 4), 16) / 255,
    b: Number.parseInt(normalized.slice(4, 6), 16) / 255
  };
}

function channel(value) {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function requireContrast(label, foreground, background, minimum) {
  const ratio = contrastRatio(foreground, background);
  if (ratio < minimum) {
    errors.push(`${label} contrast ratio ${ratio.toFixed(2)} is below ${minimum}:1`);
  }
}

[
  "package.json",
  "src/app/globals.css",
  "src/components/domain/status-badge.tsx",
  "src/components/domain/room-status-card.tsx",
  "src/components/domain/erp-empty-state.tsx",
  "src/app/(erp)/live/page.tsx",
  "src/app/(erp)/rooms/page.tsx",
  "src/app/tv/page.tsx",
  "tests/e2e/story-3-5-status-badge-accessibility.spec.ts",
  "_bmad-output/project-context.md",
  "docs/modules/rooms.md",
  "src/modules/rooms/README.md",
  "docs/modules/calls.md"
].forEach(requireFile);

const packageJson = readJson("package.json");
if (!packageJson.scripts?.lint?.includes("validate-story-3-4.mjs && node scripts/validate-story-3-5.mjs")) {
  errors.push("package.json lint script must run scripts/validate-story-3-5.mjs immediately after validate-story-3-4.mjs");
}

const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
for (const forbidden of ["@tanstack/react-query", "swr", "redis", "ioredis", "socket.io"]) {
  if (dependencies[forbidden]) errors.push(`Story 3.5 must not add ${forbidden}`);
}

const globalsCss = read("src/app/globals.css");
const lockedTokens = {
  "--status-active": "#0E7549",
  "--status-reserved": "#2F6FD0",
  "--status-cleaning": "#D9A526",
  "--status-cleaning-foreground": "#3D3115",
  "--status-complete-check": "#D2440E",
  "--status-complete-check-glow": "#F25C1F",
  "--status-empty": "#B3A37D",
  "--status-empty-foreground": "#3D3115"
};
for (const [token, value] of Object.entries(lockedTokens)) {
  if (!globalsCss.includes(`${token}: ${value};`)) errors.push(`globals.css must keep locked token ${token}: ${value}`);
}
for (const required of [
  ".status-attention",
  ".status-attention::after",
  "@keyframes status-attention-breathe",
  "position: relative",
  "content: \"\"",
  "pointer-events: none",
  "animation: status-attention-breathe 2s ease-in-out infinite",
  "box-shadow: 0 0 0 3px color-mix(in srgb, var(--status-complete-check-glow) 24%, transparent)",
  "@media (prefers-reduced-motion: reduce)",
  "animation: none !important",
  "opacity: 1",
  "box-shadow: 0 0 0 2px var(--status-complete-check-glow)"
]) {
  if (!globalsCss.includes(required)) errors.push(`globals.css missing motion/reduced-motion contract: ${required}`);
}
const statusAttentionBlock = globalsCss.match(/\.status-attention\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
if (statusAttentionBlock.includes("animation:")) {
  errors.push("status-attention must not animate the whole card because that can reduce text contrast; animate the ring pseudo-element only");
}
if (/scale\(|transform:|background-color|color:/.test(globalsCss.match(/@keyframes status-attention-breathe[\s\S]*?\n}/)?.[0] ?? "")) {
  errors.push("status-attention keyframes must remain a slow opacity breathe without scale, color, or background flash");
}

requireContrast("active badge text", "#FFFFFF", lockedTokens["--status-active"], 4.5);
requireContrast("reserved badge text", "#FFFFFF", lockedTokens["--status-reserved"], 4.5);
requireContrast("cleaning badge text", lockedTokens["--status-cleaning-foreground"], lockedTokens["--status-cleaning"], 4.5);
requireContrast("complete-check badge text", "#FFFFFF", lockedTokens["--status-complete-check"], 4.5);
requireContrast("empty badge text", lockedTokens["--status-empty-foreground"], "#FFFCF4", 4.5);

const statusBadge = read("src/components/domain/status-badge.tsx");
for (const required of [
  "export const statusBadgeStates",
  "\"사용중\", \"예약\", \"청소중\", \"종료확인\", \"빈방\"",
  "glyph: \"●\"",
  "glyph: \"◷\"",
  "glyph: \"◐\"",
  "glyph: \"⚠\"",
  "glyph: \"○\"",
  // i18n 전환: aria-label/표시 라벨은 번역 prop을 우선 쓰되 한국어 state로 fallback한다.
  "`상태: ${state}`",
  "displayLabel",
  "rounded-full",
  "bg-status-active text-status-active-foreground",
  "bg-status-reserved text-status-reserved-foreground",
  "bg-status-cleaning text-status-cleaning-foreground",
  "bg-status-complete-check text-status-complete-check-foreground",
  "border border-status-empty bg-surface text-status-empty-foreground"
]) {
  if (!statusBadge.includes(required)) errors.push(`status-badge.tsx missing ${required}`);
}
for (const forbidden of ["rounded-md", "style={{", "status-attention", "bg-status-empty text-white", "bg-status-complete-check-glow", "#F25C1F"]) {
  if (statusBadge.includes(forbidden)) errors.push(`status-badge.tsx must not include ${forbidden}`);
}
const cleaningBlock = statusBadge.match(/청소중:[\s\S]*?},\r?\n  종료확인:/)?.[0] ?? "";
if (cleaningBlock.includes("text-white") || !cleaningBlock.includes("text-status-cleaning-foreground")) {
  errors.push("청소중 badge must use text-status-cleaning-foreground and never text-white");
}

const roomCard = read("src/components/domain/room-status-card.tsx");
for (const required of [
  "RoomStatusDto",
  "StatusBadge",
  "status.displayStatus === \"종료확인\"",
  "status.displayStatus === \"빈방\"",
  "status-attention border-status-complete-check",
  "isEmpty && \"border-dashed border-status-empty bg-surface",
  "roomCard.guidance.completeCheck",
  "roomCard.guidance.empty",
  "text-[40px]",
  "text-[28px]",
  "text-[22px]",
  "data-testid=\"room-status-card\""
]) {
  if (!roomCard.includes(required)) errors.push(`room-status-card.tsx missing ${required}`);
}
// i18n 전환: 안내 한국어 문구는 messages/ko.ts로 이동.
const koMessages35 = read("src/lib/i18n/messages/ko.ts");
for (const label of ["결제·확인 필요", "즉시 가능"]) {
  if (!koMessages35.includes(label)) errors.push(`messages/ko.ts missing room-card label: ${label}`);
}
if (/remainingMinutes\s*<=\s*0[\s\S]{0,160}종료확인/.test(roomCard)) {
  errors.push("room-status-card.tsx must not recalculate 종료확인 from remainingMinutes");
}
for (const forbidden of ["role=\"button\"", "onClick=", "cursor-pointer", "hover:shadow", "EditableCallGrid", "autosave"]) {
  if (roomCard.includes(forbidden)) errors.push(`room-status-card.tsx must stay read-only and not include ${forbidden}`);
}

for (const route of ["src/app/(erp)/live/page.tsx", "src/app/(erp)/rooms/page.tsx", "src/app/tv/page.tsx"]) {
  const source = read(route);
  for (const required of ["RoomStatusCard", "listRoomStatuses", "status={status}"]) {
    if (!source.includes(required)) errors.push(`${route} missing shared status rendering: ${required}`);
  }
  for (const forbidden of ["statusBadgeConfig", "statusColor", "statusClass", "bg-status-active", "bg-status-reserved", "bg-status-cleaning", "bg-status-empty"]) {
    if (source.includes(forbidden)) errors.push(`${route} must not define route-local status token or class map: ${forbidden}`);
  }
}
const tvPage = read("src/app/tv/page.tsx");
if (!tvPage.includes("variant=\"tv\"")) errors.push("src/app/tv/page.tsx must render RoomStatusCard variant=\"tv\"");

const emptyState = read("src/components/domain/erp-empty-state.tsx");
for (const required of ["StatusBadge", "statusBadgeStates.map", "state={state}"]) {
  if (!emptyState.includes(required)) errors.push(`erp-empty-state.tsx status examples must use StatusBadge: ${required}`);
}

const e2e = read("tests/e2e/story-3-5-status-badge-accessibility.spec.ts");
for (const required of [
  "Story 3.5 status badge accessibility",
  "story35_admin",
  "E2E35-",
  "상태: 예약",
  "상태: 사용중",
  "상태: 청소중",
  "상태: 종료확인",
  "상태: 빈방",
  "◷",
  "●",
  "◐",
  "⚠",
  "○",
  "/live?operatingMonthId",
  "/rooms?operatingMonthId",
  "/tv?operatingMonthId",
  "text-status-cleaning-foreground",
  "border-status-empty",
  "bg-surface",
  "bg-status-complete-check",
  "not.toHaveClass(/status-attention/)",
  "page.emulateMedia({ reducedMotion: \"reduce\" })",
  "animationName",
  "\"::after\"",
  "text-[40px]",
  "text-[28px]",
  "text-[22px]"
]) {
  if (!e2e.includes(required)) errors.push(`story-3-5 E2E missing ${required}`);
}
for (const forbidden of ["waitForTimeout(", "bg-status-empty text-white", "text-white"]) {
  if (e2e.includes(forbidden)) errors.push(`story-3-5 E2E must not include ${forbidden}`);
}

const docs = `${read("_bmad-output/project-context.md")}\n${read("docs/modules/rooms.md")}\n${read("src/modules/rooms/README.md")}\n${read("docs/modules/calls.md")}`;
for (const required of [
  "Story 3.5",
  "StatusBadge",
  "status token source of truth",
  "색상, 텍스트 라벨, 글리프",
  "청소중",
  "text-status-cleaning-foreground",
  "빈방",
  "outline",
  "종료확인",
  "status-complete-check-glow",
  "prefers-reduced-motion",
  "TV typography",
  "UI 계산 재구현 금지",
  "swatch 단독"
]) {
  if (!docs.includes(required)) errors.push(`docs/project context missing ${required}`);
}

if (errors.length > 0) {
  console.error("Story 3.5 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Story 3.5 validation passed.");
