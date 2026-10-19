# 색 토큰 대비 측정

작성일: 2026-10-14 (같은 날 Clarity 기반 디자인 시스템으로 토큰을 바꾸며 다시 쟀다)
대상: `.scratch/app-expansion/issues/02-design-foundation-and-workflow-shell.md`, 루트 `design.md`
측정 방법: `node scripts/measure-token-contrast.mjs` — `src/app/globals.css`의 `:root` 토큰 값(OKLCH·HEX)을 sRGB로 바꿔 WCAG 2.x 대비를 계산한다. 토큰 값을 바꾸면 다시 재서 이 표를 고친다.

기준: 본문 글자 4.5:1 이상(1.4.3), 입력칸 테두리처럼 조작 영역을 알아보게 하는 경계와 포커스 표시는 3:1 이상(1.4.11).

## 바꾼 값

### 2차: Clarity 기반 디자인 시스템 (design.md)

주 행동은 검정 잉크, Royal Gold는 표식(포커스 링·도크 현재 구역·브랜드 표식)으로 옮겼다. 바탕은 모래 크림, 작업면은 아이보리다.

| 토큰 | 전 | 후 | 이유 |
| --- | --- | --- | --- |
| `--background` | `oklch(0.965 0.022 90)` | `#F1E8D7` | 화면 바탕(모래 크림) |
| `--surface` | `oklch(0.992 0.008 92)` | `#FAF4E9` | 카드·표·패널·입력칸(아이보리) |
| `--surface-float` | 없음 | `#F6F5F1` | 떠 있는 층: 도크, 팝오버, 서랍, 다이얼로그 |
| `--readonly` | `oklch(0.94 0.028 88)` | `#ECE3D0` | 읽기 전용 칸, hover 바탕 |
| `--text` | `oklch(0.296 0.035 75)` | `#161513` | 본문·제목·숫자 |
| `--muted` | `oklch(0.47 0.046 80)` | `#57534C` | 보조 글자 |
| `--faint` | 없음 | `#68625A` | 입력칸 안내 문구, 작은 메타. 원본 JSON의 `#878176`은 바탕 위 3.18:1로 본문 기준 미달이라 진하게 했다 |
| `--border` | `oklch(0.883 0.048 85)` | `#D8D0C1` | 장식선 전용 |
| `--border-strong` | `#9A8352` | `#857D6C` | 입력칸 경계. 새 바탕 위에서 3:1을 넘도록 진하게 했다(원본 JSON은 검색창 경계에 `#D8D0C1`, 1.26:1을 썼다) |
| `--brand` | `oklch(0.54 0.12 78)` | `#090909` | 주 행동·활성 탭·선택(검정 잉크) |
| `--brand-strong` | `oklch(0.47 0.105 76)` | `#2B2824` | 주 행동 hover |
| `--brand-secondary` | `oklch(0.737 0.135 82)` | `oklch(0.47 0.105 76)` | Royal Gold 표식. 이전 `--brand-strong` 값이다. 이전 `--brand` 골드는 새 바탕 위 4.23:1이라 쓰지 않는다 |
| `--accent-*` | 없음 | 라벤더 `#CDAAEE`, 피치 `#FFB399`, 블루 `#A4C1ED`, 민트 `#B8E6C9`, 버터 `#FFE5AA` | 요약 카드·차트 계열. 위 글자는 늘 `--text` |
| `--danger` | `oklch(0.547 0.187 27)` | `oklch(0.52 0.187 27)` | 새 바탕 위 4.44:1이라 진하게 했다 |

의미 토큰(`--success`, `--warning`, `--info`와 각 `-soft`·`-foreground`, `--danger-soft`)은 값을 그대로 두었다. 연한 틴트 바탕이라 채도 높은 파스텔 요약 카드와 헷갈리지 않는다. 객실 상태색(`--status-*`)은 Story 3.5가 고정한 값이라 바꾸지 않았다.

### 1차: Royal Gold 정리 (티켓 02)

| 토큰 | 전 | 후 | 이유 |
| --- | --- | --- | --- |
| `--brand` | `oklch(0.604 0.124 78)` | `oklch(0.54 0.12 78)` | 골드 바탕의 흰 글자가 3.95:1, 골드 글자 링크가 surface 위에서 3.87:1로 4.5에 못 미쳤다 |
| `--brand-foreground` | 없음 | `#FFFFFF` | 골드 바탕 위 글자 |
| `--border-strong` | 없음 | `#9A8352` | 입력칸·단계 버튼 테두리(3:1 이상) |
| 의미 토큰 | 없음 | `--success`, `--warning`, `--info`와 각 `-soft`, `-foreground`, `--danger-soft` | 상태색과 오류색을 브랜드색과 따로 둔다 |

## 측정값 (2차 기준)

| 글자(또는 경계) | 바탕 | 대비 | 판정 |
| --- | --- | --- | --- |
| `--text` | `--background` / `--surface` / `--surface-float` | 15.00 / 16.67 / 16.73 | 통과 |
| `--muted` | `--background` / `--surface` / `--surface-float` / `--readonly` | 6.28 / 6.98 / 7.01 / 5.99 | 통과 |
| `--faint` | `--background` / `--surface` / `--surface-float` / `--readonly` | 4.96 / 5.51 / 5.53 / 4.73 | 통과 |
| `--brand-foreground` | `--brand` / `--brand-strong` | 19.91 / 14.67 | 통과 |
| `--brand` | `--background` / `--surface` | 16.37 / 18.19 | 통과 |
| `--brand-secondary`(포커스 링·골드 표식) | `--background` / `--surface` / `--surface-float` / `--readonly` | 5.71 / 6.34 / 6.36 / 5.44 | 통과 |
| `--border` | `--background` / `--surface` | 1.26 / 1.40 | 장식선 전용(조작 경계에 쓰지 않음) |
| `--border-strong` | `--background` / `--surface` / `--surface-float` / `--readonly` | 3.35 / 3.73 / 3.74 / 3.20 | 조작 경계 통과 |
| `--text` | `--accent-lavender` / `-peach` / `-blue` / `-mint` / `-butter` | 9.19 / 10.57 / 9.93 / 13.21 / 14.81 | 통과 |
| `--danger` | `--background` / `--surface` / `--danger-soft` | 4.99 / 5.54 / 5.10 | 통과 |
| `--danger-foreground` | `--danger` | 5.81 | 통과 |
| `--success` | `--background` / `--surface` / `--success-soft` | 4.72 / 5.24 / 4.92 | 통과 |
| `--success-foreground` | `--success` | 5.74 | 통과 |
| `--warning` | `--background` / `--surface` / `--warning-soft` | 5.59 / 6.21 / 5.95 | 통과 |
| `--warning-foreground` | `--warning` | 6.80 | 통과 |
| `--info` | `--background` / `--surface` / `--info-soft` | 5.40 / 6.00 / 5.61 | 통과 |
| `--info-foreground` | `--info` | 6.57 | 통과 |
| `--status-active-foreground` | `--status-active` | 5.74 | 통과 |
| `--status-reserved-foreground` | `--status-reserved` | 4.88 | 통과 |
| `--status-ending-soon-foreground` | `--status-ending-soon` | 4.60 | 통과 |
| `--status-cleaning-foreground` | `--status-cleaning` | 5.68 | 통과 |
| `--status-complete-check-foreground` | `--status-complete-check` | 4.59 | 통과 |
| `--status-empty-foreground` | `--surface` | 11.64 | 통과 |
| `--status-empty`(빈방 배지 테두리) | `--surface` | 2.27 | 배지 글자(11.64)와 기호(○)로 상태를 알리므로 테두리는 보조 |
| `--status-ending-soon`(객실 평면도 마커 고리) | `--surface` / `--background` | 4.20 / 3.78 | 글자가 아닌 표시 3:1 통과(design.md 6.16) |
| `--status-complete-check`(객실 평면도 마커 고리) | `--surface` / `--background` | 4.19 / 3.77 | 글자가 아닌 표시 3:1 통과(design.md 6.16) |

`--muted`는 파스텔 위에서 3.85–4.43:1이라 기준에 못 미친다. 파스텔 요약 카드 안의 글자는 모두 `--text`로 쓴다(design.md 6.7절).

포커스 표시는 `--brand-secondary` 2px 외곽선이며 위 표대로 모든 면에서 5.4:1 이상이다.

## 남은 일

- 각 화면 본문에 직접 쓰인 `text-brand`, `bg-brand`, `focus:border-brand`는 토큰 값을 따라 검정으로 바뀌었다. 화면 본문을 다시 짜는 티켓(03–08)에서 design.md의 컴포넌트 규칙과 공통 상태 표시(`StatusIndicator`)로 옮긴다.
- 실제 기기 화면(태블릿, 벽 TV)에서의 눈 확인은 이 측정에 들어 있지 않다.
