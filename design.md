# Shadcn/ui Customization Specification (`design.md`)

> 2026-10-14 후속 사용자 지시: UI/UX·디자인·스타일을 핵심 요구사항으로 두며 필요하면 모든 화면과 스타일을 재구성할 수 있다. 아래의 골드·각진 모서리 등 기존 시각 조건은 현행 구현 기록이며 새 디자인을 제한하지 않는다. 화면 점검·리서치·AI 생성 화면 이미지와 [후속 디자인 가이드](docs/design/2026-10-14-ui-redesign.md), [27개 화면 갤러리](output/design/2026-10-14/index.html)가 새 구현 기준이 된다. 업무 규칙·권한·데이터 보존은 통합 명세를 따른다.

> 탐색과 화면 골격은 [업무 흐름 중심 정보구조와 화면 골격](docs/design/2026-10-14-workflow-information-architecture.md)을 따른다. 위 갤러리와 가이드는 화면 안의 정보 위계를 정할 때 참고하는 자료이며, 그 안의 좌측 사이드바·상단바 배치는 따르지 않는다.

This document serves as a strict guideline and reference for the AI Agent to customize Shadcn/ui components and establish a unique design system. The agent must strictly follow the architectural principles, global configuration rules, and component-level variant structures defined below.

---

## 1. Architectural Principles & Anti-Patterns
*   **Anti-Pattern (Out-of-the-box Shadcn):** Do not leave components with default padding, border-radius, or shadows. Avoid making the application look identical to standard Shadcn templates (Bootstrap effect).
*   **Ownership Principle:** Shadcn/ui is not a dependency abstraction (like MUI); it is a code generator. You own the source code inside `components/ui/`. Modify the component files directly instead of chaining arbitrary utility classes in page layouts.
*   **Accessibility Foundation:** Retain the underlying Radix UI primitives for behavior and accessibility, but completely override styles using Tailwind CSS.

---

## 2. Global Style Configuration (`app/globals.css`)

All foundational design tokens must be configured in `globals.css` inside the `:root` and `.dark` blocks. Do not hardcode magic numbers in local components.

### 2.1 Border Radius Configuration
*   To achieve a sharp, modern, or boxy UI, reduce or completely remove the default global radius.
*   **Action:** Modify the `--radius` variable globally.
```css
    :root {
      --radius: 0rem; /* Set to 0rem for sharp corners, or custom values like 0.1rem */
    }
    ```

### 2.2 OKLCH Color System Space
Shadcn/ui utilizes OKLCH instead of HSL for perceptually uniform color mapping. When generating or modifying themes, follow this structural template: `oklch(L C H)`
*   **L (Lightness):** Range `0.0` (Black) to `1.0` (White) / `0%` to `100%`.
*   **C (Chroma):** Color intensity/saturation. `0` is pure gray. Higher values yield more vivid colors. Keep it low for backgrounds, high for accents.
*   **H (Hue):** Color wheel angle (`0` to `360`).
    *   `0° - 20°`: Red
    *   `180°`: Green/Cyan
    *   `200°`: Blue
    *   `260°`: Deep Blue / Indigo
    *   `300°`: Purple

*   **Theme Modification Pattern Example:**
```css
    .dark {
      /* Deep Blue Primary Accents (L=0.54, C=0.24, H=260) */
      --primary: 0.54 0.24 260; 
      --primary-foreground: 0.98 0.01 260;
    }
    ```

---

## 3. Automated Theme Generation
*   When a wholesale theme overhaul is required, prioritize generating tokens compatible with tools like **Tweak CN**.
*   **Design Token Checklist for Agent:**
    1.  **Typography:** Define custom monospace or sans-serif fonts (e.g., Geist Mono) and explicitly adjust `letter-spacing` for scannability.
    2.  **Shadows:** Finetune shadow opacity, blur radius, and spread. Avoid heavy default shadows; use minimal spread with subtle opacity.

---

## 4. Component-Level Customization Rule (`components/ui/*`)

When altering specific UI behaviors, navigate to the respective file in `components/ui/` and utilize the `cva` (Class Variance Authority) schema. **Never** wrap components repeatedly in `className="rounded-full"` at the page level.

### 4.1 Modifying Existing Variants (e.g., `button.tsx`)
Locate `buttonVariants` and update the inline Tailwind classes inside the targeted variant group.
```typescript
// Example: Enforcing full rounding exclusively for the outline variant
const buttonVariants = cva(
  "inline-flex items-center justify-center...", // Global Styles
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow",
        // Action: Append specific utility classes directly to the variant
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-full", 
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3",
      }
    }
  }
)
```
