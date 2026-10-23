/**
 * 목록 위치 재기(design.md 6.12 — 본문 위 팝오버).
 *
 * 목록은 body에 portal로 그린다(모달·패널 안에서 잘리지 않게). 그래서 기준 앵커의 화면 좌표를
 * 직접 잰다. 아래 자리가 모자라면 위로 뒤집고, 높이는 보이는 만큼만 준다.
 * 원장 줄의 칸 안 목록(`ledger-cell-picker.tsx`)도 같은 자리 재기를 쓴다(내용 높이·폭까지 같이 준다).
 */

export type ListboxPosition = {
  left: number;
  /** 아래로 열 때 목록 윗변, 위로 열 때 목록 아랫변 기준점. */
  top: number;
  width: number;
  maxHeight: number;
  placement: "below" | "above";
};

export const LISTBOX_MAX_HEIGHT = 240; // px
export const LISTBOX_MAX_WIDTH = 384; // px(24rem) 가장 긴 항목에 맞춰 넓어지는 한계.
const LISTBOX_GAP = 4; // px 기준 앵커와 목록 사이 간격.
const LISTBOX_EDGE = 8; // px 화면 가장자리에서 목록을 띄울 간격.
const LISTBOX_BORDER = 2; // px 목록 테두리(좌우 1px씩).

/** 목록이 그려질 때 안쪽이 필요로 하는 폭(`scrollWidth`는 스크롤바·테두리를 뺀 값이라 따로 받는다). */
export type ListboxContent = {
  /** 목록 요소의 `scrollWidth` — 가장 긴 항목에 맞춘 안쪽 폭. 0이면 모르는 것으로 본다. */
  width: number;
  /** 세로 스크롤바 두께. 목록이 스크롤될 때만 폭에 더한다. */
  scrollbar?: number;
};

let cachedScrollbarWidth: number | null = null;

/** 이 브라우저의 세로 스크롤바 두께(px). 겹쳐 보이는 스크롤바(macOS 등)는 0이다. */
export function measureScrollbarWidth(): number {
  if (cachedScrollbarWidth !== null) return cachedScrollbarWidth;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden";
  document.body.appendChild(probe);
  cachedScrollbarWidth = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return cachedScrollbarWidth;
}

/**
 * 기준 앵커 아래(또는 위)에 목록을 놓을 자리를 잰다.
 *
 * `contentHeight`는 목록이 실제로 그려질 높이(내용 높이)다. 이를 주면 **그려질 높이**로 아래 자리가
 * 충분한지 판단한다(목록은 어차피 240px에서 잘린다). 짧은 목록이 위로 뜨면 위의 내용을 가려 읽기
 * 어렵기 때문이다. 0을 주면(내용을 모름) 자리의 비율로 정한다 — 목록을 아직 그리지 않은 첫 자리 재기가 이 경로다.
 *
 * `content`를 주면 폭도 내용에 맞춘다(아래 본문). 주지 않으면 폭은 기준 칸 폭 그대로다.
 */
export function measureListboxPosition(anchor: HTMLElement, contentHeight = 0, content?: ListboxContent): ListboxPosition {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - LISTBOX_GAP;
  const spaceAbove = rect.top - LISTBOX_GAP;
  // 그려질 높이는 최대 LISTBOX_MAX_HEIGHT다(그 이상은 안에서 스크롤한다).
  const painted = Math.min(contentHeight, LISTBOX_MAX_HEIGHT);
  const openAbove =
    contentHeight > 0
      ? painted > spaceBelow && spaceAbove > spaceBelow
      : spaceBelow < Math.min(LISTBOX_MAX_HEIGHT, spaceAbove) && spaceAbove > spaceBelow;
  const maxHeight = Math.max(120, Math.min(LISTBOX_MAX_HEIGHT, openAbove ? spaceAbove : spaceBelow));
  let { left, width } = rect;
  // 폭: 기준 칸 폭 이상이고, 가장 긴 항목이 다 보이도록 넓어진다(칸이 좁아도 항목 글자가 잘리지 않게).
  // 목록이 스크롤되면(내용이 maxHeight를 넘으면) 스크롤바가 안쪽을 그만큼 깎으니 그 두께를 더한다.
  // 넓어진 목록이 화면 오른쪽을 넘으면 가장자리 안쪽으로 밀어 넣는다. 내용 폭을 모르면 예전처럼 칸 폭 그대로다.
  if (content && content.width > 0) {
    const scrolls = contentHeight > maxHeight;
    const wanted = content.width + LISTBOX_BORDER + (scrolls ? (content.scrollbar ?? 0) : 0);
    width = Math.max(rect.width, Math.min(wanted, LISTBOX_MAX_WIDTH, window.innerWidth - 2 * LISTBOX_EDGE));
    left = Math.max(LISTBOX_EDGE, Math.min(rect.left, window.innerWidth - width - LISTBOX_EDGE));
  }
  return {
    left,
    top: openAbove ? rect.top - LISTBOX_GAP : rect.bottom + LISTBOX_GAP,
    width,
    maxHeight,
    placement: openAbove ? "above" : "below"
  };
}
