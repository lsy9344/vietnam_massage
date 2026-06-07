---
status: final
updated: 2026-06-07
project: vietnam_massage
sources:
  - prds/prd-vietnam_massage-2026-06-07/prd.md
  - .decision-log.md
  - mockups/color-themes-1.html
  - mockups/key-live-status.html
  - mockups/key-call-grid.html
inherits: shadcn/ui + Tailwind CSS v4
name: 로얄 골드 (Royal Gold) — 베트남 에스테틱 ERP
description: >
  엑셀 기반 마사지/에스테틱 매장 운영을 웹 ERP로 이전하는 단일 데스크톱 웹앱의
  비주얼 아이덴티티. shadcn/ui + Tailwind v4 기본값을 상속하고, 따뜻한 라이트
  캔버스 위 채도 높은 골드 브랜드 레이어 + 잠긴 상태 색상 토큰만 델타로 정의한다.
  라이트 모드 전용(v1, 다크 모드 없음).
colors:
  # ── 브랜드 레이어 델타 (shadcn primary/destructive 등을 오버라이드) ──
  brand: '#B57E12'            # deep saturated gold · shadcn primary 대체 (fill/대형 수치 전용, 본문 텍스트 금지)
  brand-2: '#D9A526'          # bright amber-gold · 그라데이션/active nav 보조
  brand-foreground: '#FFFFFF'
  background: '#FBF3E1'       # rich cream · shadcn background 대체
  surface: '#FFFCF4'          # warm ivory · card/popover 표면
  border: '#EAD7AE'           # gold-sand line · shadcn border/input 대체
  text: '#3D3115'             # espresso · foreground 대체
  muted: '#6E5E38'            # darkened bronze taupe · muted-foreground 대체 (본문 AA: 5.72 on bg)
  muted-line: '#B3A37D'       # 구 taupe · 장식/hairline/border 전용 (텍스트 금지)
  danger: '#C8392B'           # vivid red · shadcn destructive 대체 (D코스 검증·노쇼)
  readonly-tint: '#F4EAD2'    # 편집 그리드 computed 셀 배경
  # ── 잠긴 시맨틱 STATUS 토큰 (모든 표면에서 동일·불변) ──
  # 첫화면 카드 / 객실현황 / TV현황판 / dashboard chips 전부 같은 hex.
  status-사용중: '#0E7549'     # emerald(어둡게 보정) · 활성/매출 (유일한 green) · white 5.74 AA
  status-사용중-foreground: '#FFFFFF'
  status-예약: '#2F6FD0'       # royal blue · 예약 (유일한 blue) · white 4.88 AA
  status-예약-foreground: '#FFFFFF'
  status-청소중: '#D9A526'     # bright gold · 회전 (gold 계열, 텍스트는 반드시 짙은색) · dark 5.68 AA
  status-청소중-foreground: '#3D3115'   # 절대 white 금지(white=2.24 FAIL)
  status-종료확인: '#D2440E'   # electric orange(어둡게 보정) · 주의/행동 텍스트 배지 · white 4.59 AA (유일한 orange)
  status-종료확인-foreground: '#FFFFFF'
  status-종료확인-glow: '#F25C1F'   # 밝은 orange · glow ring/accent 전용(비텍스트). 텍스트 위에 쓰지 않음.
  status-빈방: '#B3A37D'       # dim bronze · 유휴 · 빈방 배지의 border/accent 값 (fill 아님)
  status-빈방-foreground: '#3D3115'   # 빈방 배지는 outline/ghost 스타일: bg=surface, border=status-빈방, text=짙은색(12.42 AA)
  # ── 콜 상태 칩(연한 배경/짙은 텍스트). 의미상 status 토큰을 재사용 ──
  call-방문완료-bg: '#DCF1E6'
  call-방문완료-text: '#0F6B43'   # green 계열(짙은 emerald, status-사용중보다 어두움) · 5.54 AA
  call-노쇼-bg: '#F8DDD9'
  call-노쇼-text: '#A72A1D'       # danger 계열
  call-취소-bg: '#EEE6D2'
  call-취소-text: '#73643F'       # muted 계열
typography:
  # 본문/라벨/캡션은 shadcn 기본 산세리프 램프 상속(한국어 폴백: Apple SD Gothic Neo,
  # Malgun Gothic, Noto Sans KR). 메인 ERP는 조밀한 데이터 화면 → 작은 size + tabular-nums.
  # 아래는 델타 역할만 명시.
  display:
    fontWeight: '800'
    fontSize: 30px
    letterSpacing: -0.5px
    lineHeight: '1.15'
  h1:
    fontWeight: '800'
    fontSize: 19px
    letterSpacing: -0.4px
  section-label:
    fontWeight: '800'
    fontSize: 12px
    letterSpacing: 0.4px
  body:
    fontWeight: '600'
    fontSize: 13px
    lineHeight: '1.5'
  data:
    # 그리드/KPI 수치 — 등폭 숫자
    fontWeight: '700'
    fontSize: 12.5px
    note: 'font-variant-numeric: tabular-nums'
  kpi-value:
    fontWeight: '800'
    fontSize: 22px
    letterSpacing: -0.5px
    note: 'tabular-nums'
  # ── TV현황판 풀스크린 모드 전용 대형 램프 (멀리서 읽힘) ──
  tv-room-name:
    fontWeight: '900'
    fontSize: 40px
    letterSpacing: -1px
  tv-status:
    fontWeight: '900'
    fontSize: 28px
  tv-meta:
    fontWeight: '700'
    fontSize: 22px
rounded:
  # shadcn보다 약간 부드러운 카드, status/콜 칩은 pill.
  sm: 5px      # 그리드 셀 포커스/입력
  md: 9px      # KPI·summary 카드, selector, dropdown
  lg: 11px     # gridwrap, 패널
  xl: 14px     # 룸 카드 컨테이너, 브라우저 프레임
  full: 9999px # status badge · 콜 칩
spacing:
  # shadcn/Tailwind 4-base 스케일 상속. 명명 토큰만 추가.
  card-pad: 13px        # 룸 카드 내부 패딩
  grid-cell-pad: 9px 10px
  content-gutter: 24px  # main content 좌우
  room-gap: 12px        # 룸 그리드 간격
  sidebar-width: 228px
components:
  room-card:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.card-pad}'
    badge-radius: '{rounded.full}'
  room-card-종료확인:
    border: '{colors.status-종료확인-glow}'
    background: '#FFF3EC'
    glow: '0 0 0 3px rgba(242,92,31,.20), 0 0 18px rgba(242,92,31,.30)'   # status-종료확인-glow 기반(장식)
    name-color: '{colors.status-종료확인-glow}'   # 대형 객실명(비텍스트 강조), 배지 텍스트는 status-종료확인(어두운) 토큰
    note: 'glow ring/name-color=밝은 glow 토큰(장식). 배지 텍스트=어두운 status-종료확인. 정적 glow ring + gentle pulse(EXPERIENCE.md, reduced-motion 시 정적). 소리 없음.'
  room-card-빈방:
    background: '{colors.surface}'
    border-style: 'dashed'
    border: '{colors.status-빈방}'
    name-color: '{colors.text}'   # 짙은 텍스트(12.42 AA), bronze 텍스트 금지
    note: 'outline/ghost 후퇴 처리 — surface 배경 + dashed bronze border, opacity .92. 빈방 배지도 흰-온-bronze fill 아님: outline 스타일(bg=surface/border=빈방/text=짙은색).'
  status-badge:
    radius: '{rounded.full}'
    fontWeight: '800'
    note: '배지 = 색상 + 텍스트 라벨 + 글리프(항상 셋 모두). 색상만으로 구분 금지(색맹·거리).'
    glyphs:
      사용중: '●'      # filled dot
      예약: '◷'        # clock
      청소중: '◐'      # turnover/broom
      종료확인: '⚠'    # alert
      빈방: '○'        # empty ring (outline 배지)
    note-fill: '사용중/예약: status fill + white foreground. 청소중: gold fill + 짙은 foreground. 종료확인: 어두운 status-종료확인 fill + white. 빈방: surface bg + bronze border + 짙은 text(outline).'
  grid-cell-input:
    background: '#FFFDF8'
    hover-background: '#FFF8E8'
    radius: '{rounded.sm}'
  grid-cell-editing:
    background: '#FFFFFF'
    ring: 'inset 0 0 0 2px {colors.brand}'
    outline: '3px solid rgba(181,126,18,.22)'
  grid-cell-computed:
    background: '{colors.readonly-tint}'
    foreground: '{colors.text}'
    fontWeight: '700'
    note: 'read-only · 입력 셀과 시각적으로 구분. 진행중/— 는 muted.'
  grid-cell-error:
    ring: 'inset 0 0 0 2px {colors.danger}'
    row-background: '#FCEFEC'
    message-color: '{colors.danger}'
    note: 'D코스 + 마사지사2 빈칸 인라인 검증.'
  sidebar-nav-item:
    foreground: '{colors.text}'
    radius: '{rounded.md}'
    active-background: 'linear-gradient(135deg, {colors.brand}, {colors.brand-2})'
    active-foreground: '{colors.brand-foreground}'
  kpi-card:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.md}'
    value-money-color: '{colors.brand}'
    value-bad-color: '{colors.danger}'
    value-ok-color: '{colors.status-사용중}'
  month-close-stepper:
    note: '작성중 → 검토중 → 마감확정 → 잠금. active 단계 badged, 액션은 역할+상태 게이트.'
    active-badge-background: '{colors.brand}'
  settlement-evidence-block:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    note: '계산 결과 + 산출 근거를 항상 함께. 맨숫자 금지.'
  status-chip:
    radius: '{rounded.full}'
    note: '대시보드/그리드 status 칩 — status 토큰 색상 고정.'
  call-state-chip:
    radius: '{rounded.full}'
    방문완료: 'bg {colors.call-방문완료-bg} / text {colors.call-방문완료-text}'
    노쇼: 'bg {colors.call-노쇼-bg} / text {colors.call-노쇼-text}'
    취소: 'bg {colors.call-취소-bg} / text {colors.call-취소-text}'
---

<!-- Spine distilled at Finalize from .decision-log.md, .working/, sources. 본 스파인은 모든 mock보다 우선한다(충돌 시 spine WIN). -->

## Brand & Style

베트남 에스테틱 ERP의 비주얼 방향은 **"따뜻한 스파(Warm Spa)"** — 따뜻한 오프화이트/크림 캔버스 위 골드·앰버·어스톤 럭셔리다. 주인이 첫 화면을 봤을 때 즉시 "선명하고 고급스럽다 / 돈 버는 집"이라고 느끼는 것이 브랜드 목표다(PRD §5.2, .decision-log D3). 채택된 테마는 **② 로얄 골드(Royal Gold)** — 채도 높은 진한 골드로, 다섯 변주 중 가장 또렷한 "money read"를 준다.

이 제품은 **shadcn/ui + Tailwind CSS v4**를 통째로 상속한다. 이 DESIGN.md는 *브랜드 레이어 델타*만 정의한다: 골드 브랜드 색상, 따뜻한 크림 표면 색상, 잠긴 status 색상 토큰, 그리고 이 도메인에만 존재하는 컴포넌트(룸 상태 카드 · 편집 그리드 셀 · 월마감 스테퍼 · 정산 근거 블록). shadcn에서 기본 제공되는 컴포넌트(Button, Card, Dialog, Sheet, Command, Popover, Toast, Tabs, Select)는 별도 명시가 없으면 기본 비주얼을 그대로 쓴다.

성격은 화려하되 *조용히 조밀하다*. 주인용 첫화면/대시보드는 선명한 골드와 상태 색상으로 화려하지만, 카운터의 콜 입력 그리드는 엑셀처럼 조밀하고 빠른 데이터 화면이어야 한다. 시각적 화려함이 입력 속도를 절대 해치면 안 된다(SM-C2). **라이트 모드 전용 · 다크 모드 없음(v1).**

## Colors

팔레트는 **로얄 골드 브랜드 레이어 + 잠긴 status 토큰 + shadcn 기본값**의 3층 구조다. (팔레트 비교/선정 출처: [`mockups/color-themes-1.html`](mockups/color-themes-1.html) — 다섯 변주 중 **변주 ②** 로얄 골드. 전체 hex 세트의 provenance.)

- **Brand Gold (`{colors.brand}` #B57E12 / 보조 `{colors.brand-2}` #D9A526)** — 브랜드 색. 사이드바 active 항목(135° 그라데이션), 로고, primary 버튼, KPI의 매출/금액 수치, 진행률 바에 쓴다. shadcn `primary`를 대체한다. 금액과 "돈" 신호에만 쓰고 상태 표시에는 쓰지 않는다. **사용 규칙(대비):** brand gold는 라이트 캔버스 위 본문 대비가 ~3.2:1로 일반 텍스트 AA(4.5)에 미달한다 → **fill(흰 텍스트를 올리는 배경) · 대형 굵은 수치(≥18px, KPI 금액 — 대형 텍스트 3:1 통과) · 아이콘 · 액센트에만** 쓰고 **본문/작은 텍스트로는 절대 쓰지 않는다.** 18px 미만 골드 텍스트가 필요하면 더 짙은 골드를 쓴다.
- **Background `{colors.background}` #FBF3E1 / Surface `{colors.surface}` #FFFCF4** — rich cream 캔버스와 warm ivory 카드 표면. 모든 화면이 이 따뜻한 라이트 바탕 위에 올라간다. (TV 모드도 같은 라이트 캔버스를 쓴다 — 대비는 어두운 배경이 아니라 큰 사이즈 + 채도 높은 status 블록으로 만든다.)
- **Border `{colors.border}` #EAD7AE · Text `{colors.text}` #3D3115 · Muted `{colors.muted}` #6E5E38** — gold-sand 라인, espresso 본문, **짙게 보정한** bronze taupe 보조 텍스트(크림 위 5.72:1, AA 통과). 각각 shadcn `border`/`input`, `foreground`, `muted-foreground`를 대체한다. 구 밝은 taupe(#B3A37D)는 `{colors.muted-line}`으로 분리 — **장식/hairline/border 전용이며 텍스트로 쓰지 않는다.**
- **Danger `{colors.danger}` #C8392B** — vivid red. shadcn `destructive` 대체. **D코스 2인 검증 오류**와 **노쇼**, 자동저장 실패에만 쓴다. 장식용 빨강 금지.

### 잠긴 STATUS 토큰 (하드 룰)

다섯 상태 색상은 **시맨틱하게 잠긴 협상 불가 토큰**이다(동일 hex 사용 규칙은 아래 "하드 룰" 참조):

| 상태 | 토큰 | hex | foreground | 글리프 | 의미 |
|---|---|---|---|---|---|
| 사용중 | `{colors.status-사용중}` | #0E7549 | white | ● | emerald · 활성/매출 (유일한 green) |
| 예약 | `{colors.status-예약}` | #2F6FD0 | white | ◷ | royal blue · 예약 (유일한 blue) |
| 청소중 | `{colors.status-청소중}` | #D9A526 | **#3D3115(짙은색)** | ◐ | bright gold · 회전 (gold 계열, **white 금지**) |
| 종료확인 | `{colors.status-종료확인}` | #D2440E | white | ⚠ | electric orange(텍스트 배지용 보정) · **주의/행동 필요** (유일한 orange) |
| 종료확인 glow | `{colors.status-종료확인-glow}` | #F25C1F | — | — | 밝은 orange · **glow ring/accent 전용(비텍스트)** |
| 빈방 | `{colors.status-빈방}` | #B3A37D | — | ○ | dim bronze · 유휴 · **outline 배지의 border 값** (fill 아님) |

**하드 룰:** 이 status 토큰들은 **첫화면 카드 · 객실현황 · TV현황판 · dashboard chips**에서 글자 그대로 동일하다(.decision-log D3, PRD FR-2/FR-16/FR-19/§5.2). 한 표면에서 사용중이 emerald이면 모든 표면에서 emerald다. 화면마다 색을 바꾸는 것은 금지다. 콜 상태(방문완료/노쇼/취소)는 연한 배경+짙은 텍스트 칩으로 status·danger·muted 계열을 재사용한다.

**대비 보정 규칙 (WCAG AA 유지, hue 정체성 보존):**
- **사용중**은 emerald hue를 유지하되 #178A5A→**#0E7549**로 한 단계 어둡게 보정(white 4.36→5.74). "유일한 green" 정체성 유지.
- **청소중**은 #D9A526 그대로지만 foreground는 **반드시 #3D3115 짙은 텍스트**(5.68). white는 2.24로 절대 금지.
- **종료확인은 용도 분리(split):** 텍스트를 얹는 배지/칩은 어둡게 보정한 **`status-종료확인` #D2440E**(white 4.59 AA)를 쓰고, 밝은 **#F25C1F는 `status-종료확인-glow`로 분리해 glow ring·카드 accent(비텍스트)에만** 쓴다. `room-card-종료확인`의 glow·name-color는 glow 토큰, 배지 텍스트는 어두운 토큰. 두 토큰 모두 "유일한 orange"의 attention 정체성을 공유한다.
- **빈방은 outline/ghost 배지로 재정의:** 흰-온-bronze fill은 2.48로 심하게 미달 → 배지 배경=`{colors.surface}`, border=`{colors.status-빈방}`(#B3A37D), 텍스트=#3D3115(짙은색, 12.42). `status-빈방`은 border/accent 값으로만 살아 있고 filled chip 아님. `room-card-빈방`도 동일(surface 배경 + dashed bronze border + 짙은 텍스트).

### 대비 목표 (Contrast targets)

AA 목표: **일반 텍스트 4.5:1 / 대형 텍스트(≥18.66px bold·≥24px) 및 UI 컴포넌트 3:1.** 11px/800 배지 텍스트는 대형 텍스트에 해당하지 않으므로 4.5:1을 충족해야 한다. 아래는 load-bearing 조합의 계산된 비율(sRGB / WCAG 2.x):

| 조합 | 비율 | 분류 | 판정 |
|---|---|---|---|
| body #3D3115 on bg #FBF3E1 | 11.53 | 일반 | PASS (AAA) |
| muted #6E5E38 on bg #FBF3E1 | 5.72 | 일반 | PASS |
| muted #6E5E38 on surface #FFFCF4 | 6.17 | 일반 | PASS |
| brand #B57E12 on bg (KPI 대형 수치 ≥18px) | 3.19 | 대형 | PASS (대형 한정; 본문 금지) |
| white on 사용중 #0E7549 | 5.74 | 배지(일반) | PASS |
| white on 예약 #2F6FD0 | 4.88 | 배지(일반) | PASS |
| #3D3115 on 청소중 #D9A526 | 5.68 | 배지(일반) | PASS (white=2.24 FAIL, 쓰지 않음) |
| white on 종료확인 #D2440E | 4.59 | 배지(일반) | PASS |
| 종료확인-glow #F25C1F (글로우 링) | — | 비텍스트 장식 | N/A (텍스트 미사용) |
| #3D3115 on 빈방 outline(surface 배경) | 12.42 | 배지(일반) | PASS |
| 빈방 border #B3A37D on surface | 2.42 | UI border(장식) | 경계선 액센트(3:1 미달이나 정보 전달은 텍스트+글리프가 담당) |
| danger #C8392B on bg | 4.66 | 일반 | PASS |
| danger #C8392B on errmsg #FCEFEC | 4.59 | 일반 | PASS |
| call 방문완료 #0F6B43 on #DCF1E6 | 5.54 | 칩(일반) | PASS |
| call 노쇼 #A72A1D on #F8DDD9 | 5.46 | 칩(일반) | PASS |
| call 취소 #73643F on #EEE6D2 | 4.66 | 칩(일반) | PASS |

## Typography

본문·라벨·캡션은 shadcn 기본 산세리프 램프를 상속하고, 한국어 폴백은 Apple SD Gothic Neo · Malgun Gothic · Noto Sans KR이다. **언어는 한국어 전용**(D1) — i18n 레이어 없음.

메인 ERP는 **조밀한 데이터 화면**이다: 작은 본문(`{typography.body}` 13px), 등폭 숫자(`tabular-nums`)로 그리드/KPI 수치를 정렬하고, 화면 제목은 `{typography.h1}` 19px로 절제한다. KPI 수치만 `{typography.kpi-value}` 22px로 키워 한눈에 읽히게 한다.

**TV현황판 풀스크린 모드**는 같은 라이트 캔버스 위에서 **거리 가독성을 위한 대형 램프**를 별도로 쓴다: 객실명 `{typography.tv-room-name}` 40px/900, 상태 `{typography.tv-status}` 28px/900, 코스·담당·남은시간 `{typography.tv-meta}` 22px. 멀리서도 객실명·상태·남은 시간·코스·담당자를 읽을 수 있어야 한다(PRD §5.4). TV 모드의 대비는 어두운 배경이 아니라 *큰 글자 + 채도 높은 status 색 블록*으로 만든다.

## Layout & Spacing

shadcn / Tailwind 4-base 스페이싱 스케일(4·8·12·16·20·24·32…)을 상속한다. 명명 토큰만 추가: `{spacing.content-gutter}` 24px(메인 좌우), `{spacing.room-gap}` 12px(룸 그리드), `{spacing.sidebar-width}` 228px.

레이아웃은 **좌측 고정 사이드바 + 메인** 2분할이다(D4). 사이드바는 도메인 그룹으로 묶이고, 메인은 상단 topbar(화면 제목 + 운영월/날짜 selector + 사용자) 아래 content로 구성된다. 첫화면은 **룸 카드(4열 그리드) → KPI row(5열) → 하단 2열(코스별 콜 + 남은시간 알림)** 순서로, 룸 상태가 항상 최상단·최우선이다(PRD §5.1). 콜 입력 그리드는 12열 조밀 테이블 + 상단 일별 요약 strip이다.

**TV현황판은 chrome/사이드바를 숨긴 풀스크린 모드**로, 11개 객실을 대형 카드 그리드로만 채운다(D2/D4).

## Elevation & Depth

깊이는 옅은 따뜻한 그림자로만 표현한다(`rgba(120,90,40,.06~.20)` 계열). 카드는 미세한 1px 그림자, 브라우저 프레임/모달은 더 큰 그림자, 드롭다운은 `0 12px 28px rgba(120,90,40,.25)`. 그림자를 계층 위계 장치로 남용하지 않는다.

유일한 예외는 **종료확인 카드의 glow**다: `{colors.status-종료확인-glow}`(밝은 #F25C1F) 기반 다중 box-shadow ring(`0 0 0 3px rgba(242,92,31,.20), 0 0 18px rgba(242,92,31,.30)`)으로 카드를 띄워 시선을 끈다. glow는 비텍스트 장식 신호이므로 밝은 glow 토큰을 쓰고, 같은 카드의 배지 텍스트는 어두운 `{colors.status-종료확인}`을 쓴다. 이 glow는 *주의를 요구하는 유일한* 깊이 신호이며, EXPERIENCE.md의 gentle pulse와 결합한다(reduced-motion 시 정적 ring으로 대체, 소리 없음).

## Shapes

라운딩은 shadcn보다 약간 부드럽다: 그리드 셀 입력/포커스 `{rounded.sm}` 5px, KPI·summary 카드·selector·dropdown `{rounded.md}` 9px, gridwrap·패널 `{rounded.lg}` 11px, 룸 카드·브라우저 프레임 `{rounded.xl}` 14px. **status badge와 콜 칩은 항상 pill(`{rounded.full}`)**이다. 빈방 카드만 dashed border로 "비어 있음 / 후퇴"를 형태로 드러낸다.

## Components

shadcn 기본 컴포넌트(Button·Card·Dialog·Sheet·Popover·Select·Toast·Tabs·Avatar)는 그대로 쓴다. 아래는 이 도메인의 load-bearing 브랜드/커스텀 컴포넌트다.

- **룸 상태 카드 (`room-card`)** — `{colors.surface}` 표면 + `{rounded.lg}`. 상단 객실명 + status badge(pill), 코스, 담당, 남은시간/종료예정 타임라인. **종료확인 변형(`room-card-종료확인`)**은 `{colors.status-종료확인-glow}` 테두리·glow ring(밝은 #F25C1F, 장식) + 연주황 배경 + "⚠ 결제·확인 필요" 라벨이며, **배지 텍스트는 어두운 `{colors.status-종료확인}` (#D2440E)**로 white를 얹어 AA를 만족시킨다. **빈방 변형(`room-card-빈방`)**은 surface 배경 + dashed bronze border + **짙은 텍스트(bronze 텍스트 금지)**로 후퇴시킨다(outline 스타일).
- **status badge** — 모든 배지는 **색상 + 텍스트 라벨 + 글리프** 세 가지를 항상 동반한다(색맹·거리 가독성). 상태별 글리프: 사용중 ●, 예약 ◷, 청소중 ◐, 종료확인 ⚠, 빈방 ○. 사용중/예약/종료확인은 status fill + 흰 텍스트, 청소중은 gold fill + 짙은 텍스트, 빈방은 surface 배경 + bronze border + 짙은 텍스트(outline).
- **편집 그리드 셀 (`grid-cell-*`)** — 입력 셀(`grid-cell-input`)은 흰 배경/hover 강조, 편집 중(`grid-cell-editing`)은 brand 색 inset ring + outline. **computed 읽기전용 셀(`grid-cell-computed`)**은 `{colors.readonly-tint}` 틴트로 입력 셀과 시각적으로 분명히 구분(결제금액·콜인정·수당 등). **오류 셀(`grid-cell-error`)**은 `{colors.danger}` inset ring + 행 배경 + 인라인 메시지(D코스 검증).
- **사이드바 내비 (`sidebar-nav-item`)** — 도메인 그룹 라벨 + 항목. active 항목은 `{colors.brand}`→`{colors.brand-2}` 135° 그라데이션 + 흰 텍스트 + 골드 그림자.
- **KPI 카드 (`kpi-card`)** — 라벨 + 큰 수치. 금액은 `{colors.brand}`, 나쁜 지표(노쇼)는 `{colors.danger}`, 좋은 지표(방문완료)는 `{colors.status-사용중}`.
- **월마감 스테퍼 (`month-close-stepper`)** — `작성중 → 검토중 → 마감확정 → 잠금` 수평 스테퍼. active 단계 badged, 액션 버튼은 역할 + 현재 상태로 게이트.
- **정산 결과 + 근거 블록 (`settlement-evidence-block`)** — 계산 결과와 산출 근거(만근 인정일 수, 콜 수, 적용 수당 정책)를 항상 함께 보여준다. 맨숫자 금지.
- **status / 콜-state 칩 (`status-chip` / `call-state-chip`)** — 대시보드·그리드용 pill. status 칩은 잠긴 status 토큰 색을 고정 사용. 콜 칩은 연한 배경 + 짙은 텍스트(방문완료/노쇼/취소).

## Do's and Don'ts

| Do | Don't |
|---|---|
| shadcn 기본값을 브랜드 레이어 밖 모든 것에 상속 | brand·status·danger 외의 shadcn 색 토큰을 임의 오버라이드 |
| 다섯 status 토큰을 모든 표면에서 동일 hex로 사용 | **상태 색상 토큰을 화면마다 다르게 쓰지 말 것** (첫화면≠TV≠그리드 금지) |
| status 배지는 항상 색상 + 텍스트 라벨 + 상태별 글리프(●◷◐⚠○) 동반 | 색상(hue)만으로 상태를 구분(색맹·거리 가독성 위반) |
| 종료확인에만 orange + glow + pulse를 집중 | orange를 다른 상태/장식에 사용 (유일한 주의 색) |
| 카운터 그리드는 조밀·키보드 우선·빠르게 | **화려한 시각화로 카운터 입력 속도를 해치지 말 것 (SM-C2)** |
| computed 셀은 틴트로 입력 셀과 명확히 구분 | computed 셀을 입력 셀처럼 보이게 (오입력 유발) |
| 화면명을 도메인 의미로 명명(첫화면/콜 원장/정산) | **엑셀 시트명·셀 좌표를 화면명·구조로 복제하지 말 것** |
| TV 대비는 큰 글자 + 채도 status 블록으로 | 다크 캔버스 도입 (v1 라이트 전용) |
| 금액·매출에만 brand gold 사용 | gold를 상태 표시나 장식에 남발 |
