export const CUSTOMER_SEARCH_DEBOUNCE_MS = 300;

/**
 * 고객 화면의 주소. 검색어와 고른 고객(또는 고객 기록이 없는 콜의 고객/메모)이 남아
 * 원장에 다녀와도 같은 고객이 열린다. 고른 고객은 검색어와 따로 남는다.
 */
export type CustomerScreenState = {
  customerQuery: string;
  visitCustomer?: string | null;
  visitMemo?: string | null;
};

export function customerScreenHref(next: CustomerScreenState) {
  const params = new URLSearchParams();
  const query = next.customerQuery.trim();
  if (query) {
    params.set("customerQuery", query);
  }
  if (next.visitCustomer) {
    params.set("visitCustomer", next.visitCustomer);
  } else if (next.visitMemo !== undefined && next.visitMemo !== null) {
    params.set("visitMemo", next.visitMemo);
  }
  const search = params.toString();
  return search ? `/customers?${search}` : "/customers";
}

export function moveCandidateIndex(current: number, key: "ArrowDown" | "ArrowUp", count: number) {
  if (count <= 0) return -1;
  if (key === "ArrowDown") {
    if (current < 0) return 0;
    return Math.min(count - 1, current + 1);
  }
  if (current < 0) return count - 1;
  return Math.max(0, current - 1);
}
