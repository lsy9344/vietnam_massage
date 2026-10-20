/**
 * 목록 위치 재기(design.md 6.12 — 본문 위 팝오버).
 *
 * 목록은 body에 portal로 그린다(모달·패널 안에서 잘리지 않게). 그래서 기준 앵커의 화면 좌표를
 * 직접 잰다. 아래 자리가 모자라면 위로 뒤집고, 높이는 보이는 만큼만 준다.
 * 원장 줄의 칸 안 목록(`ledger-cell-picker.tsx`)도 같은 자리 재기를 쓴다(아래 두 번째 절 참고).
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
const LISTBOX_GAP = 4; // px 기준 앵커와 목록 사이 간격.

/**
 * 기준 앵커 아래(또는 위)에 목록을 놓을 자리를 잰다.
 *
 * `contentHeight`는 목록이 실제로 그려질 높이(내용 높이)다. 이를 주면 **그려질 높이**로 아래 자리가
 * 충분한지 판단한다(목록은 어차피 240px에서 잘린다). 짧은 목록이 위로 뜨면 위의 내용을 가려 읽기
 * 어렵기 때문이다. 0을 주면(내용을 모름) 자리의 비율로 정한다 — 원장 칸 목록은 이 경로로 돈다.
 */
export function measureListboxPosition(anchor: HTMLElement, contentHeight = 0): ListboxPosition {
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
  return {
    left: rect.left,
    top: openAbove ? rect.top - LISTBOX_GAP : rect.bottom + LISTBOX_GAP,
    width: rect.width,
    maxHeight,
    placement: openAbove ? "above" : "below"
  };
}
