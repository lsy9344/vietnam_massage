# UX Design Validation Report — vietnam_aesthetic

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/EXPERIENCE.md`
- **Run timestamp:** 2026-06-07
- **Reviewer files:**
  - `review-rubric.md` (source-extraction rubric / validate spec)
  - `review-accessibility.md` (accessibility pass — Royal Gold)

**Severity totals:** 2 Critical · 6 High · 7 Medium · 12 Low (27 findings)

## Synthesis

**Adequate — ship after addressing the contrast and accessibility-behavior findings.** The pair is a coherent, source-faithful contract. Every `{path.to.token}` reference in both spines resolves to a defined frontmatter token; the locked status-color system is committed identically in both spines and the decision log; all six PRD FR groups, the role-based IA, and the multi-surface (desktop + TV fullscreen) split are present. A downstream consumer can source-extract cleanly for almost everything. Two gaps block a *clean* extraction: UJ-3 (웨이터) has no Key Flow, and DESIGN.md states no contrast targets while several locked status pairings fall below WCAG AA.

The accessibility reviewer shifts the picture decisively toward contrast: not just an uncommitted target but **active failures on money-critical surfaces**. White-on-종료확인 orange (3.32:1) and white-on-빈방 bronze (2.48:1) fail normal-text AA on badges that carry payment/confirm meaning; white-on-사용중 emerald (4.36:1) fails by a hair on the most frequent badge; brand-gold-as-body (~3.2:1) and muted taupe sit in the failing zone — all flagged independently by both reviewers, who concur. Beyond color, the accessibility pass surfaces under-specified behaviors the spine claims in spirit but never pins down: no `prefers-reduced-motion` / flash-rate ceiling for the 종료확인 pulse, no programmatic association for the D코스 form error, and no explicit focus contract for the irreversible 월마감 modal — plus a color-blind glyph recommendation and a missing consolidated Responsive & Platform section. Treat criticals/highs as blocking before build.

## Category verdicts

| # | Category | Verdict |
|---|---|---|
| 1 | Flow coverage | Adequate |
| 2 | Token completeness | Thin (contrast) |
| 3 | Component coverage | Strong |
| 4 | State coverage | Strong |
| 5 | Visual reference coverage | Adequate |
| 6 | Bloat & overspecification | Strong |
| 7 | Inheritance discipline | Strong |
| 8 | Shape fit | Strong |

---

## Critical

**[Token completeness · both reviewers concur]** — White-on-종료확인 orange badge fails AA (~3.32:1) (§ key-live-status.html L224/L255 · DESIGN.md status-종료확인-foreground L39)
- Note: White on 종료확인 #F25C1F is ~3.32:1 — fails AA normal text on the single most action-critical status ("⚠ 결제·확인 필요", money on the table). The 11px/800 badge gets no large-text discount, so it must clear 4.5:1. Both reviewers report the same ~3.32 value.
- Fix: darken the badge fill for text-bearing surfaces (e.g. #D6440C ≈ 4.5:1 with white) while keeping #F25C1F for the glow ring/borders, OR switch badge text to #3D3115 (≈4.6:1). Do not rely on the pulse to excuse the contrast.

**[Token completeness · both reviewers concur]** — White-on-빈방 bronze badge fails badly (~2.48:1) (§ key-live-status.html L243/L262 + L106 · DESIGN.md status-빈방-foreground L41, room-card-빈방 L118)
- Note: White on 빈방 #B3A37D is ~2.48:1 and the empty-card room name #B3A37D-on-#F6EFE0 is ~2.17:1 — both fail badly. 빈방 is deliberately recessive, but recessive ≠ illegible; a counter glancing across 11 rooms still has to read it. Both reviewers report ~2.48.
- Fix: darken the badge fill to ~#8A7A4F (white reaches 4.5:1). For the dashed-card room name, use #3D3115 or a darker bronze; #B3A37D on the tinted card is unreadable.

## High

**[Flow coverage]** — UJ-3 (웨이터) has no Key Flow (§ EXPERIENCE.md §Key Flows · PRD §2.3)
- Note: UJ-3 (웨이터가 객실 상태와 안내 문구를 확인한다) has no Key Flow; §Key Flows covers only UJ-1/2/4. The 웨이터 role, 객실 현황 landing, and 안내 문구 (FR-18) are named in the IA and Component Patterns, but no flow walks a 웨이터 through a status-change → 안내-문구 read with a climax/failure path. A consumer extracting "every UJ → one flow" finds UJ-3 unmodeled.
- Fix: add Flow 4 — 웨이터 (e.g. 객실 현황 or TV판에서 사용중→종료확인 전환을 보고 청소/입실 안내를 판단), climax on the 안내 문구 + 종료확인 read, failure on stale/지연 갱신.

**[Token completeness · both reviewers concur]** — No stated contrast targets for any load-bearing combination (§ DESIGN.md §Colors / §잠긴 STATUS 토큰 · EXPERIENCE.md §Accessibility Floor)
- Note: No contrast targets are stated anywhere in DESIGN.md. EXPERIENCE.md §Accessibility Floor asserts "shadcn AA 기본값 상속" and "라이트 캔버스 대비 AA 유지," but verification is delegated to DESIGN.md, which commits no ratio — so the load-bearing accessibility floor is uncommitted and partly violated. The spine never states which bar (AA-normal 4.5 vs AA-large 3.0) any combination targets. Both reviewers flag this independently.
- Fix: in DESIGN.md §잠긴 STATUS 토큰, state the contrast contract explicitly (e.g. "badge text ≥ AA-large 3.0 against its status fill; 빈방 foreground darkened to meet it") so architect/QA can test it.

**[Token completeness · both reviewers concur]** — White-on-사용중 emerald fails AA by a hair (~4.36:1) (§ key-live-status.html L200 · key-call-grid.html .pill.use L121 · DESIGN.md L33)
- Note: White on 사용중 #178A5A is ~4.36:1 — fails normal-text AA by a whisker on the most frequent badge in the app. Reported identically by both reviewers.
- Fix: nudge the emerald one step darker (#0F7A4E ≈ 4.7:1 with white) — preserves "the only green" semantics and clears AA; also fixes the dropdown swatch and TV mode.

**[Accessibility reviewer]** — No prefers-reduced-motion handling for the 종료확인 pulse (§ EXPERIENCE.md §State Patterns L101 · Decision D6 · DESIGN.md room-card-종료확인 L112-117)
- Note: No `prefers-reduced-motion` handling is specified for the 종료확인 gentle pulse/blink. D6 mandates the pulse on 첫화면 + TV현황판, but neither file nor the mocks (static glow only) defines a motion-off path. Vestibular-sensitive and ADHD users, plus WCAG 2.3.3, require an opt-out. Companion: seizure/flash safety is asserted nowhere — "blink" is a red-flag word; WCAG 2.3.1 requires < 3 flashes/sec.
- Fix: spec `@media (prefers-reduced-motion: reduce)` → replace the pulse with the static glow ring + ⚠ label (which already exist), no opacity/scale animation. Constrain the motion path to a slow opacity breathe (~0.5Hz, 1.5–2s), drop "blink", and state the max rate as a hard rule.

**[Accessibility reviewer]** — D코스 inline error has no programmatic association / announcement (§ key-call-grid.html L362, L372-374 · EXPERIENCE.md §Accessibility Floor L120-128)
- Note: The D코스 inline error is visually strong but has no `aria-invalid`, `aria-describedby`, `aria-errormessage`, or live-region spec. A screen-reader user tabbing into 마사지사2 hears an empty cell, not the rule, and a keyboard-triggered block gets no announcement. §Accessibility Floor covers status-color and keyboard but is silent on form error semantics.
- Fix: require `aria-invalid="true"` + `aria-describedby` linking the cell to the message, and announce the block via `role="alert"`/`aria-live="assertive"` when 저장/방문완료 is attempted. Keep the existing `!` icon so the cue isn't color-only.

## Medium

**[Token completeness · both reviewers concur]** — Brand-gold-as-body text fails AA (~3.2:1) (§ DESIGN.md brand #B57E12 L25-26, L189 · mocks .selector .mo / .nav-item.sub.sel / .addbtn)
- Note: Brand gold #B57E12 as text is ~3.19:1 on bg / ~3.44:1 on surface — fails AA at body size. It passes for 22px KPI money values and as a fill behind white, but is also used for sub-18px text: selector "운영월" month, nav sub .sel, discount relative, "저장중" hint, add-row button, and the focus ring (~3.47:1, only just clears the 3:1 UI threshold). Both reviewers flag brand-gold-as-body.
- Fix: restrict #B57E12 to ≥24px or ≥18.66px-bold contexts and fills; for sub-18px gold text use a darker gold (~#8A5E0A ≈ 4.7:1). Thicken the focus ring to ≥2px so it doesn't lean on the 3.47:1 margin alone.

**[Token completeness]** — Status-color-as-text on cream is uncommitted and largely sub-3.0 (§ DESIGN.md §Colors · room-card 종료확인/빈방 name-color)
- Note: Status hex used as label text on cream is largely sub-3.0 (청소중 #D9A526 = 2.03, 빈방 2.25, 종료확인 3.0 exactly at the graphical floor, brand 3.19). The room-card 빈방 variant uses raw status hex as name-color on a light card (2.25 — fails). Since the hard rule is "status conveyed by color + text label," the colored label text must itself be legible.
- Fix: state that status as foreground text on cream uses `text`/`muted`, not the raw status hex; reserve raw status hex for fills/borders/badges. Call out 청소중 gold and 빈방 bronze as the two that cannot be text on cream.

**[Visual reference coverage]** — color-themes-1.html not linked inline at §Colors (§ DESIGN.md §Colors / frontmatter sources)
- Note: color-themes-1.html is referenced only in DESIGN.md frontmatter `sources` and obliquely in §Brand & Style, but never linked inline at §Colors where it illustrates the chosen Royal Gold palette + the full call/danger hex set. It is the provenance artifact for every hex in the spine.
- Fix: add an inline link in DESIGN.md §Colors — "팔레트 출처/변주: `.working/color-themes-1.html` 변주 ②. 스파인이 충돌 시 우선." so the source-of-hex is traceable at the point of use.

**[Shape fit]** — No consolidated "Responsive & Platform" section (§ EXPERIENCE.md — info scattered across Foundation/IA/State)
- Note: No section titled "Responsive & Platform" in EXPERIENCE.md, unlike the shadcn shape example. This is a multi-surface product (desktop + TV fullscreen, per D2/D4), and surface-switching rules (TV mode entry/exit, viewport assumptions, desktop-only min width, TV refresh cadence) are scattered across Foundation/IA/State rather than consolidated. The info mostly exists but isn't where a consumer looks.
- Fix: add a short "Responsive & Platform" (or "Surfaces") section consolidating: desktop-web target + min viewport, TV fullscreen entry/exit + auto-refresh + no-input, "no native mobile / no dark mode (v1)" — much of this is one-liners already scattered.

**[Accessibility reviewer]** — Muted taupe #8E7C53 fails AA as body text everywhere (§ DESIGN.md muted #8E7C53 L27 · throughout both mocks)
- Note: Muted taupe fails AA as body text everywhere: 3.69 on bg, 3.97 on surface, 3.40 on readonly tint, 3.78 in the sidebar. It carries real content — staff names, course meta, "진행중", "—", ro-tags, nav sub-items, KPI labels.
- Fix: darken muted to ~#756134 (≈4.6:1 on cream) for any text role. If the brand wants the lighter taupe for hairlines only, split the token: `muted-line` (decorative) vs `muted-text` (darkened, AA).

**[Accessibility reviewer]** — Color-blind glyph reinforcement recommended for gold/bronze/orange cluster (§ DESIGN.md status table L198-204 · EXPERIENCE.md L86, L124 · key-call-grid.html L309-314)
- Note: Color-blind risk cluster confirmed: 청소중 gold #D9A526 vs 빈방 bronze #B3A37D vs 종료확인 orange #F25C1F collapse toward a near-indistinguishable warm family under deuteranopia/protanopia. The always-on text labels (good) and shape cues (dashed 빈방, glow+⚠ 종료확인) mitigate well, but 청소중 has no non-color reinforcement beyond its label, and on TV현황판 at distance the label may be the only differentiator.
- Fix: keep the label-always hard rule. Additionally give each status a distinct glyph in the badge (e.g. ● 사용중 / ◷ 예약 / ⟳ 청소중 / ⚠ 종료확인 / ○ 빈방) so hue is never the sole differentiator, especially on TV mode and the color-only dropdown swatch dots.

**[Accessibility reviewer]** — 월마감 modal focus management never specified at a11y level (§ EXPERIENCE.md L115 + Flow 3 L150-157 · DESIGN.md L181)
- Note: The 월마감 two-step confirm modal is described behaviorally but never specified at the a11y level: no focus-into-dialog-on-open, focus trap, Esc-to-cancel, focus return to trigger on close, or `role="alertdialog"`. Because this is irreversible (snapshot lock) and money-critical, the focus contract matters; leaning on "shadcn Dialog defaults" should be explicit and verified.
- Fix: state in the spine: open → focus the dialog (heading or safe/cancel button, not the destructive confirm), trap focus, Esc cancels step 1, second confirm requires an explicit focus move; on close return focus to [마감 확정]. Confirm shadcn Dialog is used so the trap actually exists.

**[Accessibility reviewer]** — No documented keyboard model for the type-ahead status dropdown (§ key-call-grid.html L306-316 · EXPERIENCE.md L109-113)
- Note: Cell navigation keys are specified, but the open-dropdown state needs its own contract: arrow-key traversal, Enter to select, Esc to close without leaving the cell, roving focus. A dropdown that swallows Tab or doesn't close on Esc is a keyboard trap on the product's hottest surface.
- Fix: specify dropdown keyboard semantics and `aria-activedescendant`/`aria-expanded`; explicitly require Esc returns to the cell, not out of the grid.

**[Accessibility reviewer]** — TV현황판 distance legibility inherits the failing contrasts at scale (§ EXPERIENCE.md L126 · DESIGN.md L214)
- Note: TV현황판 leans entirely on white-on-status-fill. Large type rescues the contrast threshold for the 28px tv-status text, but small companion badges/labels and sub-24px meta do not, and low-vision users at a distance need margin, not a pass-by-1-decimal. The color+label pairing here is correct (not color-only).
- Fix: apply the darkened status fills globally so TV mode inherits AA-not-just-large-text; verify the tv-meta 22px (just under 24px) hue/contrast for 빈방 and 청소중 specifically.

## Low

**[Flow coverage]** — FR-18 웨이터 안내 문구 never appears as a component/state (§ IA row / FR map, both spines)
- Note: FR-18 안내 문구 is referenced in the IA row and FR map but never appears as a component or state treatment in either spine — it rides along with UJ-3's absence.
- Fix: fold into the Flow-4 addition and/or note 안내 문구 as a field on the room-status card pattern.

**[Token completeness]** — Brand-gold KPI numerals rely on AA-large size — unstated (§ DESIGN.md kpi-card.value-money-color {colors.brand})
- Note: brand-gold #B57E12 (3.19 on surface) and section accents are below AA-normal but are large KPI numerals (22px/800 → AA-large 3.0, passes). Fine as-is, but unstated.
- Fix: one line noting brand-gold numerals rely on AA-large size.

**[Component coverage]** — 운영월/날짜 selector has no dedicated Components row (§ EXPERIENCE.md §Component Patterns · DESIGN.md §Layout)
- Note: The selector has a behavioral row and §Layout prose mention but no dedicated DESIGN.md.Components row; it relies on the rounded.md "selector" mention in §Shapes. Minor — it's a shadcn Select composition.
- Fix: optional one-line component row or explicit "= shadcn Select" note.

**[Component coverage]** — 주인용 그래프/시각화 has no chart component or color-encoding rule (§ FR-3/FR-33 · sidebar group 대시보드)
- Note: The graph surface has an IA row and is a named surface, but neither spine specifies a chart component, color-encoding rule, or state. Charts are load-bearing for SM-6.
- Fix: add a brief graph pattern (which palette tokens encode series; status colors must not be reused as arbitrary chart series colors or the locked semantics break).

**[State coverage]** — No explicit error state for failed 조회/aggregation load (§ EXPERIENCE.md §State Patterns)
- Note: No explicit error state for a failed 조회/aggregation load on dashboard/정산 (server compute returns error, not just slow). Loading and stale are covered; hard-fail is not.
- Fix: one row — "조회 실패" → retry affordance, keep last value, never blank (parallels the autosave "절대 조용히 드롭하지 않음" discipline).

**[State coverage]** — TV-mode connection-loss / stale-feed has no State Patterns row (§ EXPERIENCE.md §State Patterns · Flow-1 failure)
- Note: TV connection-loss / stale-feed is implied (Flow-1 failure: 스켈레톤 + "갱신 중") but not a TV-surface State Patterns row, despite TV being unattended/at-a-distance where a frozen board is a real failure.
- Fix: TV-mode row — show last-updated timestamp or "갱신 지연" so a stale board is self-evident from across the room.

**[Visual reference coverage]** — EXPERIENCE.md sources omits color-themes-1.html (asymmetry) (§ EXPERIENCE.md vs DESIGN.md frontmatter sources)
- Note: EXPERIENCE.md frontmatter sources omits color-themes-1.html while DESIGN.md lists all three mocks. Asymmetry is defensible (EXPERIENCE is behavior, not palette) but worth a glance.
- Fix: none required.

**[Bloat & overspecification]** — A few literal hex values inside components instead of tokens (§ DESIGN.md §components)
- Note: A few literal hex values appear inside `components`: room-card-종료확인 #FFF3EC, room-card-빈방 #F6EFE0, grid-cell tints, rgba glow literals. One-off tints with no frontmatter token, so they can't be `{ref}`'d — acceptable, but load-bearing tints a consumer might want named.
- Fix (optional): promote the recurring warm-tint family (#FFF3EC/#F6EFE0/#FCEFEC) to named colors tokens (e.g. tint-attention, tint-idle, tint-error).

**[Bloat & overspecification]** — §Permissions & Audit restates FR-34/35 fairly closely (§ EXPERIENCE.md §권한·감사)
- Note: The invented §Permissions & Audit section restates FR-34/35 and §6.4 fairly closely in prose. It earns its place but trims would tighten it.
- Fix: compress to the behavioral deltas not already in State Patterns (lock) and IA (sidebar hide).

**[Inheritance discipline]** — Korean characters in YAML token paths may break naive ASCII resolvers (§ DESIGN.md status-사용중 / call-방문완료-bg / room-card-종료확인)
- Note: Korean characters inside YAML token paths are spec-legal but will break naive `{path.to.token}` resolvers that assume ASCII/kebab-case, and complicate Tailwind/CSS-var generation downstream. Not a spine defect — an extraction-time heads-up.
- Fix: note for the architect that token codegen must map Korean keys to ASCII CSS-var names (e.g. status-사용중 → --status-occupied) with a stable mapping table.

**[Inheritance discipline]** — EXPERIENCE.md uses the glob {colors.status-*} shorthand (§ EXPERIENCE.md §Component Patterns, room card row)
- Note: The glob `{colors.status-*}` is resolvable by a human, not by a literal resolver. Acceptable given the adjacent locked-token table.
- Fix: none required; the locked table disambiguates.

**[Shape fit]** — Invented §권한·감사 section earns its place (§ EXPERIENCE.md §권한·감사)
- Note: The invented §권한·감사 section earns its place: permissions + audit + snapshot-immutability are load-bearing differentiators of the Excel→ERP migration (SM-4/SM-5) and don't fit cleanly in the default sections. Keep it; just trim per Bloat.
- Fix: keep; trim per Bloat finding.

**[Accessibility reviewer]** — 방문완료 doc/token divergence (status-사용중 계열 vs darker hex) (§ DESIGN.md L44 · call pill .done #0F6B43)
- Note: DESIGN.md describes 방문완료 as "status-사용중 계열" while the actual hex #0F6B43 is darker than status-사용중 #178A5A. The pill itself passes (5.54:1) — harmless, but doc and token diverge.
- Fix: make sure implementers use the darker call-text hex, not the emerald, for text on the light chip.

**[Accessibility reviewer]** — "남은 12분" urgency uses an undeclared off-palette #B8860B (fails) (§ key-live-status.html L148)
- Note: The "남은 12분" urgency uses an undeclared `#B8860B` ("warn", 3.20:1, fails) that isn't in the token set. Off-palette and sub-AA.
- Fix: drop the ad-hoc gold; use the darkened muted or danger token per its semantic.

**[Accessibility reviewer]** — Color-only signaling otherwise clean — keep swatch dots paired with labels (§ key-live-status.html L292-295 · key-call-grid.html L309-314 · EXPERIENCE.md L124)
- Note: Color-only signaling is otherwise clean — every badge/pill/chip and the 종료확인 alert ships a text label, satisfying the "절대 색상만으로 전달하지 않는다" rule. The only color-only spots are decorative reinforcers next to a text label (alert-list .rdot, dropdown swatch dots) — acceptable.
- Fix: don't let the swatch dot ever stand alone.

---

## Mechanical notes

- Token resolution: 100% — all 35 DESIGN.md refs and all 7 EXPERIENCE.md refs resolve; no dot/hyphen mismatch; Korean-in-path consistent.
- Color hex completeness: every `colors.*` token has a hex; every status token has a matching `-foreground`; call chips carry explicit bg+text hex.
- Contrast (computed, sRGB WCAG 2.x): body text passes AAA; badge foregrounds white/사용중 4.36, white/종료확인 3.32, white/빈방 2.48 fail; status-as-text on cream mostly sub-3.0; call chips pass AA-normal. Spine states no contrast target.
- UJ → Flow: UJ-1→Flow1, UJ-2→Flow2, UJ-4→Flow3, UJ-3→(none).
- FR → IA: all FR-1..FR-37 appear in the IA/FR map; FR-18 (안내 문구) has no component/state treatment.
- `.working/` files: 3 total — all linked from a spine; color-themes-1.html only in frontmatter + oblique prose, not inline at §Colors.
- Spines-win stated once per spine; status value / glossary parity identical across DESIGN.md, EXPERIENCE.md, PRD, decision log.
