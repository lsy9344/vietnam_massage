import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LISTBOX_MAX_HEIGHT, measureListboxPosition } from "@/components/ui/listbox-position";

/** 기준 앵커를 화면 좌표로 흉내 낸다. */
function anchorAt(rect: { bottom: number; left: number; top: number; width: number }) {
  return {
    getBoundingClientRect: () => ({
      bottom: rect.bottom,
      height: rect.bottom - rect.top,
      left: rect.left,
      right: rect.left + rect.width,
      top: rect.top,
      width: rect.width,
      x: rect.left,
      y: rect.top
    })
  } as unknown as HTMLElement;
}

function withViewportHeight(innerHeight: number, run: () => void) {
  const original = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { innerHeight };
  try {
    run();
  } finally {
    (globalThis as { window?: unknown }).window = original;
  }
}

describe("목록 자리 재기", () => {
  it("짧은 목록은 아래 자리에 들어가면 아래에 연다", () => {
    withViewportHeight(844, () => {
      // 아래 자리 180px, 위 자리 556px, 목록 내용 100px
      const position = measureListboxPosition(anchorAt({ bottom: 660, left: 40, top: 560, width: 300 }), 100);

      assert.equal(position.placement, "below");
      assert.equal(position.top, 664);
      assert.equal(position.maxHeight, 180);
      assert.equal(position.left, 40);
      assert.equal(position.width, 300);
    });
  });

  it("긴 목록도 그려질 높이(최대 240px)로 판단해 아래에 연다", () => {
    withViewportHeight(844, () => {
      // 아래 자리 320px, 위 자리 472px, 목록 내용 1332px(30줄) — 그려지는 높이는 240px다
      const position = measureListboxPosition(anchorAt({ bottom: 520, left: 40, top: 476, width: 300 }), 1332);

      assert.equal(position.placement, "below");
      assert.equal(position.top, 524);
      assert.equal(position.maxHeight, LISTBOX_MAX_HEIGHT);
    });
  });

  it("아래에 그려질 높이조차 안 들어가면 위로 연다", () => {
    withViewportHeight(844, () => {
      // 아래 자리 200px, 위 자리 500px, 목록 내용 400px → 그려질 높이 240px가 아래에 안 들어간다
      const position = measureListboxPosition(anchorAt({ bottom: 640, left: 40, top: 340, width: 300 }), 400);

      assert.equal(position.placement, "above");
      assert.equal(position.top, 336);
      assert.equal(position.maxHeight, LISTBOX_MAX_HEIGHT);
    });
  });

  it("내용 높이를 모르면 자리의 비율로 정한다(원장 칸 목록 자리)", () => {
    withViewportHeight(844, () => {
      // 아래 자리 100px, 위 자리 600px → 위로
      const above = measureListboxPosition(anchorAt({ bottom: 740, left: 0, top: 240, width: 100 }));
      assert.equal(above.placement, "above");

      // 아래 자리 600px, 위 자리 100px → 아래로
      const below = measureListboxPosition(anchorAt({ bottom: 240, left: 0, top: 140, width: 100 }));
      assert.equal(below.placement, "below");
    });
  });
});
