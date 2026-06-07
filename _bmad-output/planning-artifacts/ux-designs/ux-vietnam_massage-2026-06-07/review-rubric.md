# Spine Pair Review — DESIGN.md + EXPERIENCE.md

**Run:** `ux-vietnam_massage-2026-06-07/` · **Reviewed:** 2026-06-07 · **Reviewer:** source-extraction rubric (validate spec)

## Overall verdict

**Adequate — ship after addressing two HIGH findings.** The pair is a coherent, source-faithful contract. Every `{path.to.token}` reference in both spines resolves to a defined frontmatter token; the locked status-color system is committed identically in both spines and the decision log; all six PRD FR groups, the role-based IA, and the multi-surface (desktop + TV fullscreen) split are present. A downstream consumer (architect or story-dev) can source-extract cleanly for almost everything.

Two gaps block a *clean* extraction: (1) **UJ-3 (웨이터) has no Key Flow** despite being a named core journey with its own protagonist in the PRD — a consumer extracting "one flow per UJ" finds a hole. (2) **DESIGN.md states no contrast targets** for any load-bearing combination, and several locked status pairings are demonstrably below WCAG AA for normal text (white-on-emerald 4.36, white-on-orange 3.32, white-on-빈방 2.48) — the EXPERIENCE.md accessibility floor *asserts* AA but DESIGN.md commits no ratio, so the load-bearing decision is uncommitted and partly violated. Both are decisions a consumer cannot invent.

---

## 1. Flow coverage

Verdict: **adequate**. PRD UJs extracted: UJ-1, UJ-2, UJ-3, UJ-4. EXPERIENCE.md Key Flows: Flow 1 → UJ-1 (noah), Flow 2 → UJ-2 (mina), Flow 3 → UJ-4 (seora). Each present flow has a named protagonist, numbered steps, a labeled **클라이맥스** beat, and an explicit **실패** path. Strong on the three covered.

- **[high]** UJ-3 (웨이터가 객실 상태와 안내 문구를 확인한다) has no Key Flow (EXPERIENCE.md §Key Flows covers only UJ-1/2/4; PRD §2.3 UJ-3). The 웨이터 role, 객실 현황 landing, and 안내 문구 (FR-18) are all named in the IA and Component Patterns, but no flow walks a 웨이터 through a status-change → 안내-문구 read with a climax/failure path. A consumer extracting "every UJ → one flow" finds UJ-3 unmodeled. *Fix:* add Flow 4 — 웨이터 (e.g. 객실 현황 or TV판에서 사용중→종료확인 전환을 보고 청소/입실 안내를 판단), climax on the 안내 문구 + 종료확인 read, failure on stale/지연 갱신.
- **[low]** FR-18 웨이터 안내 문구 ("사용중/청소중/예약/종료확인/빈방별 안내 문구") is referenced in the IA row and FR map but never appears as a component or state treatment in either spine — it rides along with UJ-3's absence. *Fix:* fold into the Flow-4 addition and/or note 안내 문구 as a field on the room-status card pattern.

## 2. Token completeness

Verdict: **strong on definition, thin on contrast commitment**. Every frontmatter token and every `{path.to.token}` reference across both spines resolves to a defined token (verified by extraction: all 35 DESIGN.md refs + 7 EXPERIENCE.md refs map to frontmatter keys). No color token is missing a hex. Status tokens carry matching `-foreground` tokens. Call chips carry explicit bg/text hex.

- **[high]** No contrast targets are stated for any load-bearing combination anywhere in DESIGN.md (DESIGN.md §Colors / §잠긴 STATUS 토큰). EXPERIENCE.md §Accessibility Floor asserts "shadcn AA 기본값 상속, 브랜드 오버라이드 검증" and "라이트 캔버스 대비 AA 유지," but the *verification* is delegated to DESIGN.md which states no ratio. Computed ratios show real failures against AA-normal-text (4.5): white-on-`status-사용중` #178A5A = **4.36**, white-on-`status-종료확인` #F25C1F = **3.32**, white-on-`status-빈방` #B3A37D = **2.48** (fails even large-text 3.0). White-on-`status-청소중` would be 2.24 — correctly avoided by using dark `#3D3115` foreground (5.68, passes). Badges are bold/large so the AA-large 3.0 bar mostly applies, but 빈방's white foreground fails that too, and the spine never states which bar it targets. *Fix:* in DESIGN.md §잠긴 STATUS 토큰, state the contrast contract explicitly (e.g. "badge text ≥ AA-large 3.0 against its status fill; 빈방 foreground darkened to meet it") and either darken `status-빈방-foreground` or swap to a dark foreground. Commit the target so architect/QA can test it.
- **[med]** Status-color-as-text/icon *on the cream background* is uncommitted and largely sub-3.0 (사용중 3.94, 예약 4.42, 청소중 #D9A526 = **2.03**, 종료확인 3.0, 빈방 2.25, brand 3.19) (DESIGN.md §Colors). The room-card 종료확인 variant uses `name-color: {colors.status-종료확인}` (3.0 — exactly at the graphical-object floor) and 빈방 uses `name-color: {colors.status-빈방}` on a light card (2.25 — fails). Since the hard rule is "status conveyed by color + text label," the colored *label text* must itself be legible. *Fix:* state that status as foreground text on cream uses `text`/`muted`, not the raw status hex; reserve raw status hex for fills/borders/badges. Call out the 청소중 gold and 빈방 bronze as the two that cannot be used as text on cream.
- **[low]** `kpi-card.value-money-color: {colors.brand}` (#B57E12, 3.19 on surface) and section accents in brand gold are below AA-normal but are large KPI numerals (`kpi-value` 22px/800 → AA-large 3.0, passes 3.19). Fine as-is, but unstated. *Fix:* one line noting brand-gold numerals rely on AA-large size.

## 3. Component coverage

Verdict: **strong**. Every component named in either spine's prose/patterns has a row in DESIGN.md.Components, and every behavioral component in EXPERIENCE.md.Component Patterns maps to a DESIGN.md visual spec. Cross-checked: 편집 그리드 (grid-cell-*), 객실 상태 카드 (room-card + 종료확인/빈방 variants), 월마감 스테퍼 (month-close-stepper), 정산 결과+근거 (settlement-evidence-block), status/call chips (status-chip/call-state-chip), 운영월/날짜 selector, KPI 카드, sidebar-nav-item. shadcn-inherited components (Button/Card/Dialog/Sheet/Popover/Select/Toast/Tabs/Avatar) declared as as-is in both.

- **[low]** 운영월/날짜 selector has a behavioral row (EXPERIENCE.md §Component Patterns) and is referenced in DESIGN.md §Layout prose ("운영월/날짜 selector") but has no dedicated DESIGN.md.Components row; it relies on `rounded.md` "selector" mention in §Shapes. Minor — it's a shadcn Select composition. *Fix:* optional one-line component row or explicit "= shadcn Select" note.
- **[low]** 주인용 그래프/시각화 (FR-3/FR-33, sidebar group 대시보드) has an IA row and is a named surface, but neither spine specifies a chart/graph component, color-encoding rule, or state. Charts are load-bearing for SM-6. *Fix:* add a brief graph pattern (which palette tokens encode series; status colors must not be reused as arbitrary chart series colors or the locked semantics break).

## 4. State coverage

Verdict: **strong**. EXPERIENCE.md §State Patterns walks loading (cold + 조회-change, split grid vs dashboard), empty (빈방 + no-data), error (autosave fail + D코스 검증), attention (종료확인), lock (월마감), and permission-denied (sidebar hide). Each cites the surface and FR/decision. Focus state covered in §Interaction Primitives + grid-cell-editing.

- **[low]** No explicit error state for a failed 조회/aggregation load on dashboard/정산 (server compute returns error, not just slow). Loading and stale are covered; hard-fail is not. *Fix:* one row — "조회 실패" → retry affordance, keep last value, never blank (parallels the autosave "절대 조용히 드롭하지 않음" discipline).
- **[low]** TV 모드 connection-loss / stale-feed state is implied (Flow-1 failure: 스켈레톤 + "갱신 중") but not a TV-surface State Patterns row, despite TV being unattended/at-a-distance where a frozen board is a real failure. *Fix:* TV-mode row — show last-updated timestamp or "갱신 지연" so a stale board is self-evident from across the room.

## 5. Visual reference coverage

Verdict: **adequate**. `.working/` contains exactly three files: `color-themes-1.html`, `key-live-status.html`, `key-call-grid.html`. Spines-win is stated once per spine (DESIGN.md HTML comment line; EXPERIENCE.md blockquote). EXPERIENCE.md §IA links `key-live-status.html` (첫화면) and `key-call-grid.html` (콜 그리드) inline at the relevant section with what each illustrates, plus the "Finalize 시 mockups/로 승격" note.

- **[med]** `color-themes-1.html` is referenced only in DESIGN.md frontmatter `sources` and obliquely in §Brand & Style ("다섯 변주 중… ②"), but is never linked inline at the §Colors section where it illustrates the chosen Royal Gold palette + the full call/danger hex set. It is the provenance artifact for every hex in the spine. *Fix:* add an inline link in DESIGN.md §Colors — "팔레트 출처/변주: `.working/color-themes-1.html` 변주 ②. 스파인이 충돌 시 우선." so the source-of-hex is traceable at the point of use.
- **[low]** EXPERIENCE.md frontmatter `sources` omits `color-themes-1.html` while DESIGN.md lists it; DESIGN.md frontmatter `sources` lists all three mocks. Asymmetry is defensible (EXPERIENCE is behavior, not palette) but worth a glance. No action required.

## 6. Bloat & overspecification

Verdict: **strong**. No source restatement of FR prose, persona bios, or scope lists; FRs are cited by number, not copied. Tables used where tables fit (IA, roles, state, voice, do/don't, status). EXPERIENCE.md carries microcopy only and correctly pushes editorial voice to DESIGN.md (§Voice and Tone header line). DESIGN.md uses tokens, not raw pixels, in component specs.

- **[low]** A few literal hex values appear inside `components` instead of tokens: `room-card-종료확인.background: '#FFF3EC'`, `room-card-빈방.background: '#F6EFE0'`, `grid-cell-input.background/hover '#FFFDF8'/'#FFF8E8'`, `grid-cell-editing.background '#FFFFFF'`, `grid-cell-error.row-background '#FCEFEC'`, and rgba glow literals (DESIGN.md §components). These are one-off tints with no frontmatter token, so they can't be `{ref}`'d — acceptable, but they're load-bearing tints a consumer might want named. *Fix (optional):* promote the recurring warm-tint family (`#FFF3EC`/`#F6EFE0`/`#FCEFEC`) to named `colors` tokens (e.g. `tint-attention`, `tint-idle`, `tint-error`) so variants reference them.
- **[low]** §Permissions & Audit (EXPERIENCE.md, invented section) restates FR-34/35 and §6.4 fairly closely in prose. It earns its place (see §8) but trims would tighten it. *Fix:* compress to the behavioral deltas not already in State Patterns (lock) and IA (sidebar hide).

## 7. Inheritance discipline

Verdict: **strong**. The token-path hazard flagged in the brief is clean: both spines consistently use the `{colors.status-사용중}` form (hyphen-joined Korean), which matches the frontmatter keys verbatim — no `{colors.status.*}` (dot) vs `{colors.status-*}` (hyphen) split, and the Korean-in-path is internally consistent across DESIGN.md, EXPERIENCE.md, and every reference. Status values (`사용중·예약·청소중·종료확인·빈방`) and call states (`방문완료·노쇼·취소`) are byte-identical across both spines, the PRD (FR-9/FR-2/FR-11), and the decision log (D3). UJ names and FR numbers map verbatim. `sources` frontmatter paths resolve (PRD + `.decision-log.md` + the three mocks all exist).

- **[low]** Korean characters inside YAML token paths (`status-사용중`, `call-방문완료-bg`, component key `room-card-종료확인`) are spec-legal but will break naive `{path.to.token}` resolvers that assume ASCII/kebab-case, and complicate Tailwind/CSS-var generation downstream. Not a spine defect — an extraction-time heads-up. *Fix:* note for the architect that token codegen must map Korean keys to ASCII CSS-var names (e.g. `status-사용중` → `--status-occupied`) with a stable mapping table.
- **[low]** EXPERIENCE.md uses the glob `{colors.status-*}` (§Component Patterns, room card row) as shorthand for the locked set. Resolvable by a human, not by a literal resolver. Acceptable given the adjacent locked-token table, but flag. *Fix:* none required; the locked table disambiguates.

## 8. Shape fit

Verdict: **strong**. DESIGN.md follows the canonical section order exactly: Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts. Frontmatter carries name/description/colors/typography/rounded/spacing/components per spec. EXPERIENCE.md has all expected defaults: Foundation, IA, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, **Responsive & Platform present as needed** — and critically the multi-surface split (desktop ERP + TV fullscreen mode) is handled throughout (Foundation, IA TV row, dedicated TV typography ramp, TV state/accessibility notes). The Responsive/Platform concern is met even though there's no single "Responsive & Platform" heading.

- **[med]** No section titled "Responsive & Platform" in EXPERIENCE.md, unlike the shadcn shape example. This is a multi-surface product (desktop + TV fullscreen, explicitly per D2/D4), and surface-switching rules (when/how TV mode is entered/exited, viewport assumptions, desktop-only min width, TV refresh cadence) are scattered across Foundation/IA/State rather than consolidated. The information mostly exists but isn't where a consumer looks for it. *Fix:* add a short "Responsive & Platform" (or "Surfaces") section consolidating: desktop-web target + min viewport, TV fullscreen entry/exit + auto-refresh + no-input, "no native mobile / no dark mode (v1)" — much of this is one-liners already scattered.
- **[low]** Invented section §권한·감사 (EXPERIENCE.md) earns its place: permissions + audit + snapshot-immutability are load-bearing differentiators of the Excel→ERP migration (SM-4/SM-5) and don't fit cleanly in the default sections. Keep it; just trim per §6.

---

## Mechanical notes

- **Token resolution:** 100% — all 35 DESIGN.md `{...}` refs and all 7 EXPERIENCE.md refs resolve to defined frontmatter keys. No dot/hyphen path mismatch; Korean-in-path consistent across both spines and refs.
- **Color hex completeness:** every `colors.*` token has a hex; every status token has a matching `-foreground`; call chips carry explicit bg+text hex.
- **Contrast (computed, sRGB WCAG 2.x):** body `text` on cream 11.53 / on surface 12.42 (pass AAA). muted on cream 3.69 (AA-large only). Badge foregrounds: white/사용중 4.36, white/예약 4.88, dark/청소중 5.68, white/종료확인 3.32, white/빈방 **2.48 (fails AA-large)**. Status-as-text on cream: 청소중 **2.03**, 빈방 **2.25**, brand 3.19 (all sub-3.0 except 예약 4.42). Call chips: 방문완료 5.54, 노쇼 5.46, 취소 4.66 (all pass AA-normal). → Spine states no contrast target; commit one and fix 빈방 foreground (see §2).
- **UJ → Flow:** UJ-1→Flow1, UJ-2→Flow2, UJ-4→Flow3, **UJ-3→(none)**.
- **FR → IA:** all FR-1..FR-37 appear in the EXPERIENCE.md IA/FR map; FR-18 (안내 문구) has no component/state treatment.
- **`.working/` files:** 3 total — all linked from a spine (live-status + call-grid inline in EXPERIENCE; color-themes only in frontmatter + oblique prose, not inline at §Colors).
- **Spines-win:** stated once per spine.
- **Status value / glossary parity:** identical across DESIGN.md, EXPERIENCE.md, PRD, decision log.
