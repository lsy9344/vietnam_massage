/**
 * 콜 원장 화면의 주소. 원장 탭과 "하루 수납·지출" 탭은 운영월·날짜를 함께 쓰고,
 * 고른 탭은 주소의 tab 매개변수로 남아 새로고침과 뒤로 가기에서 복원된다(명세 F08 기준 3).
 * 원장 탭 안의 보기(예약·현장/수납·정산/전체)도 같은 방식으로 view 매개변수에 남는다(티켓 19).
 * 도크의 원장 메뉴도 같은 주소 값으로 두 탭을 연다(routes.ts의 원장 보기).
 */
export type LedgerTab = "ledger" | "cashbook";

/** 원장 표의 열 묶음 세 가지(명세 F02). 전체 보기가 기본값이라 주소를 비워 둔다. */
export type LedgerView = "booking" | "settlement" | "all";

/** 보기 전환을 그릴 때 쓰는 순서: 예약·현장 → 수납·정산 → 전체. */
export const LEDGER_VIEWS: readonly LedgerView[] = ["booking", "settlement", "all"];

export type LedgerDate = {
  operatingMonthId: string;
  serviceDate: string;
};

export function parseLedgerTab(value: unknown): LedgerTab {
  return value === "cashbook" ? "cashbook" : "ledger";
}

export function parseLedgerView(value: unknown): LedgerView {
  return value === "booking" || value === "settlement" ? value : "all";
}

/** 날짜를 옮겨도 남길 탭 매개변수. 원장 탭은 주소를 비워 둔다. */
export function ledgerTabParams(tab: LedgerTab): Record<string, string> {
  return tab === "cashbook" ? { tab } : {};
}

/** 날짜·탭을 옮겨도 남길 보기 매개변수. 전체 보기는 주소를 비워 둔다(기존 기본 동작과 같다). */
export function ledgerViewParams(view: LedgerView): Record<string, string> {
  return view === "all" ? {} : { view };
}

/** 보기는 원장 탭 안에서만 뜻이 있다. 하루 수납·지출 탭으로 가는 링크에는 담지 않는다. */
export function ledgerHref(target: LedgerDate, tab: LedgerTab = "ledger", view: LedgerView = "all") {
  const params = new URLSearchParams({
    operatingMonthId: target.operatingMonthId,
    serviceDate: target.serviceDate,
    ...ledgerTabParams(tab),
    ...(tab === "ledger" ? ledgerViewParams(view) : {})
  });
  return `/calls?${params.toString()}`;
}

/** 원장 표의 콜 행 id. 다른 화면의 링크가 이 행으로 바로 간다. */
export function ledgerCallAnchorId(serviceCallId: string) {
  return `call-${serviceCallId}`;
}

/** 열린 콜 상세 패널의 콜 id를 담는 주소 매개변수. 이 주소로 바로 패널이 열린다. */
export const CALL_PARAM = "call";

/**
 * 이 속성이 있는 링크는 떠나기 전 안내(CallLeaveGuard, 티켓 18)를 가로채지 않는다. 원장 보기 전환처럼
 * 같은 화면의 표시 방식만 바꾸는 이동이 여기 해당한다. page.tsx(서버 컴포넌트)와 CallLeaveGuard
 * ("use client")가 함께 쓰므로 "use client" 없는 이 모듈에 둔다(서버가 클라이언트 모듈의 상수를
 * 읽으면 참조 프록시가 되는 문제를 피한다).
 */
export const LEAVE_GUARD_SKIP_ATTRIBUTE = "data-leave-guard-skip";

/** 그 날짜 원장 탭에서 그 콜의 상세 패널이 열린 주소. */
export function ledgerCallHref(target: LedgerDate & { serviceCallId: string }) {
  const params = new URLSearchParams({
    operatingMonthId: target.operatingMonthId,
    serviceDate: target.serviceDate,
    [CALL_PARAM]: target.serviceCallId
  });
  return `/calls?${params.toString()}`;
}
