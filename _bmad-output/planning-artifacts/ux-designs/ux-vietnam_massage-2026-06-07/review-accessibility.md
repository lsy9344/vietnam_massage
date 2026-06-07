# Accessibility Review — 베트남 에스테틱 ERP (Royal Gold)

_Reviewer pass · 2026-06-07 · scope: DESIGN.md, EXPERIENCE.md, .decision-log.md, .working/{key-live-status,key-call-grid,color-themes-1}.html · files unchanged._

## Overall verdict

This spine takes accessibility seriously where it counts most — status is consistently paired with a text label, the grid keyboard model is well specified, and the locked-token discipline prevents per-screen color drift. **But the headline status colors do not survive WCAG math: white-on-종료확인 orange (3.32:1) and white-on-빈방 bronze (2.48:1) both fail normal-text AA on the very badges that carry money-critical meaning**, and several "money read" combos (brand gold, muted taupe) sit in the 3.2–3.97:1 gray zone. Most fixes are small foreground/contrast tweaks plus three under-specified behaviors (reduced-motion, error `aria`, focus management on the 월마감 modal) that the spine claims in spirit but never pins down — treat those as blocking before build.

## Contrast ledger (computed, sRGB / WCAG 2.x)

| Combo | Ratio | Size class | Verdict |
|---|---|---|---|
| body #3D3115 on bg #FBF3E1 | 11.53:1 | normal | PASS (AAA) |
| body #3D3115 on surface #FFFCF4 | 12.42:1 | normal | PASS (AAA) |
| muted #8E7C53 on bg #FBF3E1 | **3.69:1** | normal | FAIL (needs 4.5) |
| muted #8E7C53 on surface #FFFCF4 | **3.97:1** | normal | FAIL (needs 4.5) |
| brand gold #B57E12 on bg #FBF3E1 | **3.19:1** | normal | FAIL (needs 4.5); PASS as ≥24px large |
| brand gold #B57E12 on surface #FFFCF4 | **3.44:1** | normal | FAIL; PASS as large |
| white on 사용중 #178A5A | 4.36:1 | normal (11px badge) | **FAIL by a hair** (needs 4.5) |
| white on 예약 #2F6FD0 | 4.88:1 | normal | PASS |
| #3D3115 on 청소중 #D9A526 | 5.68:1 | normal | PASS (correct choice — dark text) |
| white on 청소중 #D9A526 (if ever used) | 2.24:1 | — | FAIL (don't) |
| white on 종료확인 #F25C1F | **3.32:1** | normal (11px badge) | **FAIL** (needs 4.5) |
| white on 빈방 #B3A37D | **2.48:1** | normal | **FAIL** (needs 4.5) |
| danger #C8392B on bg #FBF3E1 | 4.66:1 | normal | PASS |
| danger #C8392B errmsg on #FCEFEC | 4.59:1 | normal | PASS (thin margin) |
| call 방문완료 #0F6B43 on #DCF1E6 | 5.54:1 | normal | PASS |
| call 노쇼 #A72A1D on #F8DDD9 | 5.46:1 | normal | PASS |
| call 취소 #73643F on #EEE6D2 | 4.66:1 | normal | PASS |
| 빈방 rname #B3A37D on empty card #F6EFE0 | **2.17:1** | normal (16px) | FAIL |
| 종료확인 rname #F25C1F on #FFF3EC | **3.05:1** | normal (16px) | FAIL |
| focus ring brand #B57E12 on white cell | **3.47:1** | UI (needs 3.0) | PASS (thin) |
| ro-tag muted on readonly tint #F4EAD2 | **3.40:1** | normal (9px) | FAIL |
| nav-sub muted #8E7C53 on sidebar #FBF6EA | 3.78:1 | normal | FAIL |
| "warn" #B8860B on #FFFDF7 (남은 12분) | 3.20:1 | normal | FAIL |

11px/800 badge text = ~8.2pt → well below the 14pt-bold (18.66px) "large text" threshold, so it must clear **4.5:1**, not 3:1. The badges do not get the large-text discount.

## Findings

- **[critical]** White-on-종료확인 orange badge is **3.32:1** — fails AA normal text — and 종료확인 is the single most action-critical status in the product ("⚠ 결제·확인 필요", money on the table). Location: `key-live-status.html` L224/L255 `.badge style="background:var(--st-end);color:#fff"`, DESIGN.md `status-종료확인-foreground:#FFFFFF` (L39). *Fix:* the glow/pulse/⚠-label scaffolding already disambiguates the state, so the safest move is to darken the badge **fill** for text-bearing surfaces (e.g. #D6440C ≈ 4.5:1 with white) while keeping #F25C1F for the glow ring/borders, OR switch badge text to #3D3115 (dark-on-orange ≈ 4.6:1). Do not rely on the pulse to excuse the contrast.

- **[critical]** White-on-빈방 bronze badge is **2.48:1** and the empty-card room name #B3A37D-on-#F6EFE0 is **2.17:1** — both fail badly. "빈방" is deliberately recessive, but recessive ≠ illegible; a counter glancing across 11 rooms still has to read it. Location: `key-live-status.html` L243/L262 badge + L106 `.room.empty .rname`; DESIGN.md `status-빈방-foreground:#FFFFFF` (L41), `room-card-빈방` (L118). *Fix:* darken the badge fill to ~#8A7A4F (white reaches 4.5:1) or use dark text #3D3115 on #B3A37D (≈3.6:1 — still short, so prefer darkening the fill). For the dashed-card room name, use #3D3115 or a darker bronze; #B3A37D on the tinted card is unreadable.

- **[high]** White-on-사용중 emerald is **4.36:1** — fails normal-text AA by a whisker on the most frequent badge in the app. Location: `key-live-status.html` L200 etc., `key-call-grid.html` `.pill.use` L121; DESIGN.md L33. *Fix:* nudge the emerald one step darker (#0F7A4E ≈ 4.7:1 with white) — preserves "the only green" semantics and clears AA. Trivially also fixes the dropdown swatch and TV mode.

- **[high]** No `prefers-reduced-motion` handling is specified for the 종료확인 gentle pulse/blink. EXPERIENCE.md State Patterns (L101) and Decision D6 mandate the pulse on 첫화면 + TV현황판, DESIGN.md `room-card-종료확인` (L112-117) calls it "gentle pulse", but neither file nor the mocks (the mock uses a *static* glow, comment L19/L108) defines a motion-off path. Vestibular-sensitive and ADHD users, plus the WCAG 2.3.3 expectation, require an opt-out. *Fix:* spec it explicitly: `@media (prefers-reduced-motion: reduce)` → replace the pulse with the static glow ring + ⚠ label (which already exist), no opacity/scale animation. Also pin the pulse rate in the spine.

- **[high]** Seizure/flash safety for the pulse is asserted nowhere. EXPERIENCE.md says "gentle pulse/blink" (L101) — "blink" is a red flag word. WCAG 2.3.1 requires **< 3 flashes/sec**. *Fix:* in the spine, constrain to a slow opacity breathe (e.g. 1.5–2s ease-in-out cycle, ~0.5Hz, never a hard on/off blink), and drop the word "blink". State the max rate as a hard rule next to the "소리 없음" note.

- **[high]** The D코스 inline error is visually strong but has no specified programmatic association or announcement. The error cell shows "필수 입력" placeholder + danger ring and a separate message row "D코스는 마사지사2 필수…" (`key-call-grid.html` L362, L372-374), but there is no `aria-invalid`, `aria-describedby`, `aria-errormessage`, or live-region spec. A screen-reader user tabbing into 마사지사2 hears an empty cell, not the rule, and a counter who triggers the block via keyboard gets no announcement. EXPERIENCE.md "Accessibility Floor" (L120-128) covers status-color and keyboard but is silent on form error semantics. *Fix:* require `aria-invalid="true"` + `aria-describedby` linking the cell to the message, and announce the block via `role="alert"`/`aria-live="assertive"` when 저장/방문완료 is attempted. The message must not be the only color cue — it already has the `!` icon, good; keep it.

- **[medium]** Muted taupe #8E7C53 fails AA as body text everywhere it lands: 3.69:1 on bg, 3.97:1 on surface, 3.40:1 on the readonly tint, 3.78:1 in the sidebar. It carries real content — staff names ("담당 · 이수진"), course meta, "진행중", "—", ro-tags, nav sub-items, KPI labels. Location: DESIGN.md `muted:#8E7C53` (L27) used as `muted-foreground`; throughout both mocks. *Fix:* darken muted to ~#756134 (≈4.6:1 on cream) for any text role. If the brand wants the lighter taupe for hairlines/decoration only, split the token: `muted-line` (decorative, current) vs `muted-text` (darkened, AA).

- **[medium]** Brand gold #B57E12 as text fails AA at body size (3.19:1 bg / 3.44:1 surface). It's fine for the 22px KPI money values (large-text 3:1 ✔) and as a fill behind white, but it's also used for smaller text: selector "운영월" month, nav sub `.sel` (#B57E12 on #FBEECB), the discount "−₩50,000" relative, "저장중" hint, add-row button label, and the focus-ring (3.47:1 — only just clears the 3:1 UI threshold). Location: DESIGN.md L25-26, L189; mocks `.selector .mo`, `.nav-item.sub.sel`, `.rowsave.saving`, `.addbtn`. *Fix:* restrict #B57E12 to ≥24px or ≥18.66px-bold contexts and fills; for sub-18px gold text use a darker gold (~#8A5E0A ≈ 4.7:1). For the focus ring, thicken to ≥2px and/or pair with the existing outline so it doesn't lean on the 3.47:1 margin alone.

- **[medium]** Color-blind risk cluster confirmed: 청소중 gold #D9A526 vs 빈방 bronze #B3A37D vs 종료확인 orange #F25C1F. Under deuteranopia/protanopia, gold and bronze both collapse toward muddy yellow-beige and orange shifts toward the same warm band — three of the five statuses become a near-indistinguishable family by hue. The product mitigates this well with **always-on text labels** (good) and shape cues (dashed border for 빈방 L105, glow+⚠ for 종료확인 L109-116), but 청소중 has **no non-color reinforcement** beyond its label, and on the TV현황판 read-at-distance the label may be the only thing separating gold/bronze/orange. Location: DESIGN.md status table L198-204; EXPERIENCE.md L86, L124. *Fix:* the label-always rule is the real safeguard and it holds — keep it as the hard rule it is. Additionally give each status a distinct **glyph** in the badge (e.g. ● 사용중 / ◷ 예약 / ⟳ 청소중 / ⚠ 종료확인 / ○ 빈방) so hue is never the sole differentiator within the gold/bronze/orange cluster, especially on TV mode and in the grid dropdown swatches (which are color-only dots, `key-call-grid.html` L309-314).

- **[medium]** 월마감 two-step confirm modal: keyboard operability and focus management are described behaviorally (EXPERIENCE.md L115 "두 번째 확인", Flow 3 L150-157) but never specified at the a11y level. No mention of focus moving into the dialog on open, focus trap within it, `Esc`-to-cancel, focus return to the trigger on close, or `role="alertdialog"` + labelled warning. Because this is irreversible (snapshot lock) and money-critical, the focus contract matters. The spine leans on "shadcn Dialog defaults" (DESIGN.md L181) — which do provide focus trap/restore — but for a two-step destructive flow that assumption should be explicit and verified. *Fix:* state in the spine: open → focus the dialog (heading or the safe/cancel button, **not** the destructive confirm), trap focus, `Esc` cancels step 1, second confirm requires an explicit focus move; on close return focus to [마감 확정]. Confirm shadcn Dialog is used (not a custom popover) so the trap actually exists.

- **[medium]** No documented keyboard model for the type-ahead status dropdown. EXPERIENCE.md specifies `Tab`/`Enter`/arrows/`Esc` for cell navigation (L109-113) and "type-ahead 드롭다운" (L112), but the open-dropdown state (`key-call-grid.html` L306-316) needs its own contract: arrow-key option traversal, `Enter` to select, `Esc` to close **without** leaving the cell (no keyboard trap), and roving focus. Risk: a dropdown that swallows `Tab` or doesn't close on `Esc` is a keyboard trap on the product's hottest surface. *Fix:* specify dropdown keyboard semantics and `aria-activedescendant`/`aria-expanded`; explicitly require `Esc` returns to the cell, not out of the grid.

- **[medium]** TV현황판 distance legibility leans entirely on white-on-status-fill, inheriting every failing contrast above at scale. Large type rescues the *contrast threshold* (≥24px → 3:1 UI bar), so 사용중 4.36 and 종료확인 3.32 technically clear 3:1 for the big `tv-status` 28px text — **but** the small companion badges/labels and any sub-24px meta do not, and low-vision users at a distance are exactly the population that needs margin, not a pass-by-1-decimal. EXPERIENCE.md L126 / DESIGN.md L214 correctly pair color with text labels here (good — not color-only). *Fix:* apply the darkened status fills (above) globally so TV mode inherits AA-not-just-large-text; verify the `tv-meta` 22px (just under 24px) hue/contrast for 빈방 and 청소중 specifically.

- **[low]** 사용중-as-방문완료 reuse: the call-state pill `.done` uses #0F6B43-on-#DCF1E6 (5.54:1 PASS) — good — but DESIGN.md describes 방문완료 as "status-사용중 계열" (L44) while the actual hex (#0F6B43) is darker than status-사용중 (#178A5A). Harmless here, just note the doc and token diverge; make sure implementers use the darker call-text hex, not the emerald, for text on the light chip.

- **[low]** The "남은 12분" urgency uses an undeclared `#B8860B` ("warn", 3.20:1, FAILS) that isn't in the token set (`key-live-status.html` L148). Off-palette and sub-AA. *Fix:* drop the ad-hoc gold; use the darkened muted or danger token per its semantic.

- **[low]** Color-only signaling is otherwise clean — every status badge, grid pill, dashboard chip, call chip, and the 종료확인 alert ships a text label, satisfying the EXPERIENCE.md "절대 색상만으로 전달하지 않는다" rule (L124). The only color-only spots are decorative reinforcers, not sole carriers: the alert-list `.rdot` color dots (`key-live-status.html` L292-295) and the dropdown swatch dots (`key-call-grid.html` L309-314) — both sit next to a text label, so acceptable; just don't let the swatch dot ever stand alone.

## Priority order for build

1. Darken the three failing status fills (종료확인, 빈방, 사용중) — critical/high, affects every surface incl. TV. (criticals + first high)
2. Spec `prefers-reduced-motion` + flash-rate ceiling for the pulse. (high)
3. Spec D코스 error `aria-invalid`/`aria-describedby`/`role="alert"`. (high)
4. Darken `muted` and constrain `brand gold` to large/fill contexts. (medium)
5. Pin dropdown + 월마감 modal keyboard/focus contracts. (medium)
6. Add per-status glyphs for color-blind + distance reinforcement. (medium)
