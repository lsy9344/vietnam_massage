export const CUSTOMER_SEARCH_DEBOUNCE_MS = 300;

export type CustomerVisitSearchTarget = {
  operatingMonthId: string;
  serviceDate: string;
};

export type CustomerVisitSearchChange = {
  customerQuery: string;
  visitCustomer?: string | null;
  visitMemo?: string | null;
};

export function customerVisitSearchPath(current: CustomerVisitSearchTarget, next: CustomerVisitSearchChange) {
  const params = new URLSearchParams();
  params.set("operatingMonthId", current.operatingMonthId);
  params.set("serviceDate", current.serviceDate);
  const query = next.customerQuery.trim();
  if (!query) {
    return `/calls?${params.toString()}`;
  }
  params.set("customerQuery", query);
  if (next.visitCustomer) {
    params.set("visitCustomer", next.visitCustomer);
  } else if (next.visitMemo !== undefined && next.visitMemo !== null) {
    params.set("visitMemo", next.visitMemo);
  }
  return `/calls?${params.toString()}`;
}

export function customerVisitLedgerPath(operatingMonthId: string, serviceDate: string) {
  const params = new URLSearchParams();
  params.set("operatingMonthId", operatingMonthId);
  params.set("serviceDate", serviceDate);
  return `/calls?${params.toString()}`;
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
