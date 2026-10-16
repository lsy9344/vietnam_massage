import type { QuickBookingJoinParty } from "@/app/(erp)/calls/quick-booking-draft";

/**
 * 원장의 "일행에 1명 추가"(스펙 D14, 티켓 04)가 빠른 예약 패널을 연다. 패널은 원장 탭 머리(도구줄)에 있어 원장
 * 목록과 React 트리가 다르므로, 같은 창 안의 이벤트 하나로 잇는다.
 */
const JOIN_PARTY_EVENT = "calls:quick-booking-join-party";

export function requestQuickBookingJoinParty(join: QuickBookingJoinParty) {
  window.dispatchEvent(new CustomEvent<QuickBookingJoinParty>(JOIN_PARTY_EVENT, { detail: join }));
}

/** 패널이 "1명 추가" 요청을 받는다. 돌려준 함수로 그만 받는다. */
export function onQuickBookingJoinParty(handler: (join: QuickBookingJoinParty) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<QuickBookingJoinParty>).detail);
  window.addEventListener(JOIN_PARTY_EVENT, listener);
  return () => window.removeEventListener(JOIN_PARTY_EVENT, listener);
}
