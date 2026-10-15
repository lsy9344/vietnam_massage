/**
 * 콜 원장 화면의 주소. 원장 탭과 "하루 수납·지출" 탭은 운영월·날짜를 함께 쓰고,
 * 고른 탭은 주소의 tab 매개변수로 남아 새로고침과 뒤로 가기에서 복원된다(명세 F08 기준 3).
 * 도크로 원장 구역에 들어가면 tab 없이 원장 탭이 열린다(routes.ts getZoneHref).
 */
export type LedgerTab = "ledger" | "cashbook";

export type LedgerDate = {
  operatingMonthId: string;
  serviceDate: string;
};

export function parseLedgerTab(value: unknown): LedgerTab {
  return value === "cashbook" ? "cashbook" : "ledger";
}

/** 날짜를 옮겨도 남길 탭 매개변수. 원장 탭은 주소를 비워 둔다. */
export function ledgerTabParams(tab: LedgerTab): Record<string, string> {
  return tab === "cashbook" ? { tab } : {};
}

export function ledgerHref(target: LedgerDate, tab: LedgerTab = "ledger") {
  const params = new URLSearchParams({
    operatingMonthId: target.operatingMonthId,
    serviceDate: target.serviceDate,
    ...ledgerTabParams(tab)
  });
  return `/calls?${params.toString()}`;
}

/** 원장 표의 콜 행 id. 다른 화면의 링크가 이 행으로 바로 간다. */
export function ledgerCallAnchorId(serviceCallId: string) {
  return `call-${serviceCallId}`;
}

/** 열린 콜 상세 패널의 콜 id를 담는 주소 매개변수. 이 주소로 바로 패널이 열린다. */
export const CALL_PARAM = "call";

/** 그 날짜 원장 탭에서 그 콜의 상세 패널이 열린 주소. */
export function ledgerCallHref(target: LedgerDate & { serviceCallId: string }) {
  const params = new URLSearchParams({
    operatingMonthId: target.operatingMonthId,
    serviceDate: target.serviceDate,
    [CALL_PARAM]: target.serviceCallId
  });
  return `/calls?${params.toString()}`;
}
