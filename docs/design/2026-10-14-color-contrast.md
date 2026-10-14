# 색 토큰 대비 측정

작성일: 2026-10-14
대상 티켓: `.scratch/app-expansion/issues/02-design-foundation-and-workflow-shell.md`
측정 방법: `node scripts/measure-token-contrast.mjs` — `src/app/globals.css`의 `:root` 토큰 값(OKLCH·HEX)을 sRGB로 바꿔 WCAG 2.x 대비를 계산한다. 토큰 값을 바꾸면 다시 재서 이 표를 고친다.

기준: 본문 글자 4.5:1 이상(1.4.3), 입력칸 테두리처럼 조작 영역을 알아보게 하는 경계와 포커스 표시는 3:1 이상(1.4.11).

## 바꾼 값

| 토큰 | 전 | 후 | 이유 |
| --- | --- | --- | --- |
| `--brand` | `oklch(0.604 0.124 78)` | `oklch(0.54 0.12 78)` | 골드 바탕의 흰 글자가 3.95:1, 골드 글자 링크가 surface 위에서 3.87:1로 4.5에 못 미쳤다. 기본 버튼, 현재 탭 표시, 링크가 모두 이 토큰을 쓴다 |
| `--brand-strong` | `oklch(0.534 0.118 76)` | `oklch(0.47 0.105 76)` | `--brand`보다 한 단계 짙게 유지(누름·강조) |
| `--brand-foreground` | 없음(클래스는 쓰였으나 토큰이 없어 색이 비어 있었다) | `#FFFFFF` | 골드 바탕 위 글자 |
| `--border-strong` | 없음 | `#9A8352` | `--border`(1.39:1)는 장식선으로만 쓰고, 입력칸·단계 버튼 테두리는 3:1 이상인 이 토큰을 쓴다 |
| 의미 토큰 | 없음 | `--success`, `--warning`, `--info`와 각 `-soft`, `-foreground`, `--danger-soft` | 상태색과 오류색을 브랜드 골드와 따로 둔다 |

객실 상태색(`--status-*`)은 Story 3.5가 고정한 값이라 바꾸지 않았다.

## 측정값

| 글자(또는 경계) | 바탕 | 대비 | 판정 |
| --- | --- | --- | --- |
| `--text` | `--background` | 12.55 | 통과 |
| `--text` | `--surface` | 13.57 | 통과 |
| `--muted` | `--background` | 6.20 | 통과 |
| `--muted` | `--surface` | 6.70 | 통과 |
| `--muted` | `--readonly` | 5.75 | 통과 |
| `--brand` | `--surface` | 5.03 | 통과 |
| `--brand` | `--background` | 4.65 | 통과 |
| `--brand-strong` | `--surface` | 6.78 | 통과 |
| `--brand-strong` | `--background` | 6.27 | 통과 |
| `--brand-foreground` | `--brand` | 5.14 | 통과 |
| `--brand-foreground` | `--brand-strong` | 6.94 | 통과 |
| `--border` | `--surface` | 1.39 | 장식선 전용(조작 경계에 쓰지 않음) |
| `--border-strong` | `--surface` | 3.58 | 조작 경계 통과 |
| `--border-strong` | `--background` | 3.31 | 조작 경계 통과 |
| `--danger` | `--surface` | 5.28 | 통과 |
| `--danger` | `--danger-soft` | 4.54 | 통과 |
| `--danger-foreground` | `--danger` | 5.17 | 통과 |
| `--success` | `--surface` | 5.61 | 통과 |
| `--success` | `--success-soft` | 4.92 | 통과 |
| `--success-foreground` | `--success` | 5.74 | 통과 |
| `--warning` | `--surface` | 6.65 | 통과 |
| `--warning` | `--warning-soft` | 5.95 | 통과 |
| `--warning-foreground` | `--warning` | 6.80 | 통과 |
| `--info` | `--surface` | 6.42 | 통과 |
| `--info` | `--info-soft` | 5.61 | 통과 |
| `--info-foreground` | `--info` | 6.57 | 통과 |
| `--status-active-foreground` | `--status-active` | 5.74 | 통과 |
| `--status-reserved-foreground` | `--status-reserved` | 4.88 | 통과 |
| `--status-ending-soon-foreground` | `--status-ending-soon` | 4.60 | 통과 |
| `--status-cleaning-foreground` | `--status-cleaning` | 5.68 | 통과 |
| `--status-complete-check-foreground` | `--status-complete-check` | 4.59 | 통과 |
| `--status-empty-foreground` | `--surface` | 12.45 | 통과 |
| `--status-empty`(빈방 배지 테두리) | `--surface` | 2.43 | 배지 글자(12.45)와 기호(○)로 상태를 알리므로 테두리는 보조 |

포커스 표시는 `--brand` 2px 외곽선이며, `--surface` 위 5.03:1, `--background` 위 4.65:1이다.

## 남은 일

- 각 화면 본문에 직접 쓰인 `text-brand`, `bg-brand` 같은 클래스는 토큰 값을 따라 함께 바뀌었다. 화면 본문을 다시 짜는 티켓(03–08)에서 새 의미 토큰과 공통 상태 표시(`StatusIndicator`)로 옮긴다.
- 실제 기기 화면(태블릿, 벽 TV)에서의 눈 확인은 이 측정에 들어 있지 않다.
