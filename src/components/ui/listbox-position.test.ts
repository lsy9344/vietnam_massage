import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LISTBOX_MAX_HEIGHT, LISTBOX_MAX_WIDTH, measureListboxPosition } from "@/components/ui/listbox-position";

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

  describe("폭(2026-10-22: 빠른 예약 시간 칸 83px에서 목록 글자가 잘렸다)", () => {
    function withViewport(innerWidth: number, run: () => void) {
      const original = (globalThis as { window?: unknown }).window;
      (globalThis as { window?: unknown }).window = { innerHeight: 900, innerWidth };
      try {
        run();
      } finally {
        (globalThis as { window?: unknown }).window = original;
      }
    }

    it("칸보다 긴 항목이 있으면 그 항목이 다 보이도록 칸 폭보다 넓어진다(테두리 포함)", () => {
      withViewport(1440, () => {
        const position = measureListboxPosition(anchorAt({ bottom: 300, left: 400, top: 256, width: 83 }), 200, { width: 118 });
        assert.equal(position.width, 120); // 안쪽 118 + 테두리 2
        assert.equal(position.left, 400);
      });
    });

    it("목록이 스크롤되면 스크롤바 두께를 더한다", () => {
      withViewport(1440, () => {
        // 내용 높이 800px은 240px에 못 들어가 스크롤된다.
        const scrolled = measureListboxPosition(anchorAt({ bottom: 300, left: 400, top: 256, width: 83 }), 800, { width: 118, scrollbar: 15 });
        assert.equal(scrolled.width, 135);
        // 짧아서 스크롤되지 않으면 더하지 않는다.
        const short = measureListboxPosition(anchorAt({ bottom: 300, left: 400, top: 256, width: 83 }), 100, { width: 118, scrollbar: 15 });
        assert.equal(short.width, 120);
      });
    });

    it("항목이 짧아도 칸 폭보다 좁아지지 않는다", () => {
      withViewport(1440, () => {
        const position = measureListboxPosition(anchorAt({ bottom: 300, left: 400, top: 256, width: 300 }), 100, { width: 60 });
        assert.equal(position.width, 300);
      });
    });

    it("아무리 긴 항목이어도 최대 폭에서 멈춘다", () => {
      withViewport(1440, () => {
        const position = measureListboxPosition(anchorAt({ bottom: 300, left: 400, top: 256, width: 83 }), 100, { width: 900 });
        assert.equal(position.width, LISTBOX_MAX_WIDTH);
      });
    });

    it("넓어진 목록이 화면 오른쪽을 넘으면 가장자리 안쪽으로 밀어 넣는다", () => {
      withViewport(1440, () => {
        const position = measureListboxPosition(anchorAt({ bottom: 300, left: 1380, top: 256, width: 83 }), 100, { width: 198 });
        assert.equal(position.width, 200);
        assert.equal(position.left, 1440 - 200 - 8);
      });
    });

    it("좁은 화면에서는 화면 폭 안으로 줄인다", () => {
      withViewport(320, () => {
        const position = measureListboxPosition(anchorAt({ bottom: 300, left: 200, top: 256, width: 83 }), 100, { width: 900 });
        assert.equal(position.width, 320 - 16);
        assert.equal(position.left, 8);
      });
    });

    it("내용 폭을 모르면 예전처럼 칸 폭 그대로다(원장 칸 목록 자리)", () => {
      withViewportHeight(844, () => {
        const position = measureListboxPosition(anchorAt({ bottom: 300, left: 1380, top: 256, width: 83 }), 100);
        assert.equal(position.width, 83);
        assert.equal(position.left, 1380);
      });
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
