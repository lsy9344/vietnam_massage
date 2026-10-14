// globals.css의 :root 색 토큰으로 WCAG 2.x 대비를 잰다.
// 사용: node scripts/measure-token-contrast.mjs  (결과는 docs/design/2026-10-14-color-contrast.md에 옮겨 적는다)
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "";
const tokens = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));

function oklchToLinearSrgb(l, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
  ].map((channel) => Math.min(1, Math.max(0, channel)));
}

function hexToLinearSrgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => {
    const channel = parseInt(value.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
}

function linear(name) {
  const value = name.startsWith("#") ? name : tokens[name];
  if (!value) throw new Error(`unknown token ${name}`);
  if (value.startsWith("#")) return hexToLinearSrgb(value);
  const match = value.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  if (!match) throw new Error(`unsupported color ${name}: ${value}`);
  return oklchToLinearSrgb(Number(match[1]), Number(match[2]), Number(match[3]));
}

function luminance(name) {
  const [r, g, b] = linear(name);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const pairs = process.argv.slice(2).length
  ? process.argv.slice(2).map((pair) => pair.split(":"))
  : [
      ["text", "background"],
      ["text", "surface"],
      ["muted", "background"],
      ["muted", "surface"],
      ["muted", "readonly"],
      ["brand-strong", "surface"],
      ["brand-strong", "background"],
      ["brand-foreground", "brand"],
      ["brand-foreground", "brand-strong"],
      ["brand", "surface"],
      ["border", "surface"],
      ["border-strong", "surface"],
      ["border-strong", "background"],
      ["brand", "background"],
      ["danger", "surface"],
      ["danger-foreground", "danger"],
      ["danger", "danger-soft"],
      ["success", "surface"],
      ["success", "success-soft"],
      ["success-foreground", "success"],
      ["warning", "surface"],
      ["warning", "warning-soft"],
      ["warning-foreground", "warning"],
      ["info", "surface"],
      ["info", "info-soft"],
      ["info-foreground", "info"],
      ["status-active-foreground", "status-active"],
      ["status-reserved-foreground", "status-reserved"],
      ["status-ending-soon-foreground", "status-ending-soon"],
      ["status-cleaning-foreground", "status-cleaning"],
      ["status-complete-check-foreground", "status-complete-check"],
      ["status-empty-foreground", "surface"],
      ["status-empty", "surface"]
    ];

for (const [foreground, background] of pairs) {
  console.log(`${foreground} on ${background}: ${contrast(foreground, background).toFixed(2)}`);
}
