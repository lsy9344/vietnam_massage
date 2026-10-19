/**
 * 콜 원장 화면의 주소. 원장 탭과 "하루 수납·지출" 탭은 운영월·날짜를 함께 쓰고,
 * 고른 탭은 주소의 tab 매개변수로 남아 새로고침과 뒤로 가기에서 복원된다(명세 F08 기준 3).
 * 원장 탭 안의 보기 전환(티켓 19)은 흐름별 목록(티켓 03)으로 없어졌다. 옛 주소의 view 매개변수는 무시한다.
 * 도크의 원장 메뉴는 같은 주소 값으로 두 탭을 연다(routes.ts의 원장 보기).
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

/** 원장 목록의 콜 줄 id. 다른 화면의 링크가 이 줄로 바로 간다. */
export function ledgerCallAnchorId(serviceCallId: string) {
  return `call-${serviceCallId}`;
}

/** 열린 콜 상세 패널의 콜 id를 담는 주소 매개변수. 이 주소로 바로 패널이 열린다. */
export const CALL_PARAM = "call";

/**
 * 이 속성이 있는 링크는 떠나기 전 안내(CallLeaveGuard, 티켓 18)를 가로채지 않는다. 같은 화면의 표시 방식만
 * 바꾸는 이동에 단다(옛 원장 보기 전환이 그랬다). 서버 컴포넌트도 쓸 수 있게 "use client" 없는 이 모듈에 둔다
 * (서버가 클라이언트 모듈의 상수를 읽으면 참조 프록시가 되는 문제를 피한다).
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

/** 원장을 한 Therapist의 콜만 보이게 거르는 주소 매개변수(1018 스펙 D17). 값은 Therapist id다. */
export const THERAPIST_FILTER_PARAM = "therapist";

/**
 * 서버를 다시 부르지 않고 지금 주소의 매개변수 하나를 바꾼다(history.replaceState). 앱 라우터의 useSearchParams가
 * 따라 바뀐다. 브라우저에서만 부른다.
 */
export function replaceAddressParam(name: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
