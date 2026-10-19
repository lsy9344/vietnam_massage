import type { QuickBookingJoinParty } from "@/app/(erp)/calls/quick-booking-draft";

/**
 * 원장의 "일행에 1명 추가"(스펙 D14, 티켓 04)가 빠른 예약 패널을 연다. 줄은 그 패널과 React 트리에서 멀리 있어
 * 같은 창 안의 이벤트 하나로 잇는다.
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

/**
 * 원장 Therapist 현황 줄의 카드(1018 스펙 D17)가 그 Therapist를 미리 고른 빠른 예약을 연다. "1명 추가"와 같은 까닭으로
 * 같은 창 안의 이벤트로 잇는다.
 */
const PRESET_THERAPIST_EVENT = "calls:quick-booking-therapist";

export function requestQuickBookingWithTherapist(therapistId: string) {
  window.dispatchEvent(new CustomEvent<string>(PRESET_THERAPIST_EVENT, { detail: therapistId }));
}

/** 패널이 "이 Therapist로 빠른 예약" 요청을 받는다. 돌려준 함수로 그만 받는다. */
export function onQuickBookingWithTherapist(handler: (therapistId: string) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<string>).detail);
  window.addEventListener(PRESET_THERAPIST_EVENT, listener);
  return () => window.removeEventListener(PRESET_THERAPIST_EVENT, listener);
}

/**
 * 원장 탭 머리의 빠른 예약 버튼(1018 스펙 D19). 패널은 원장 옆 패널이라 원장 작업면 안에 있고, 버튼은 도구줄에 있어
 * 같은 창 안의 이벤트로 잇는다.
 */
const OPEN_EVENT = "calls:quick-booking-open";

export function requestQuickBookingOpen() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/** 패널이 "빠른 예약 열기" 요청을 받는다. 돌려준 함수로 그만 받는다. */
export function onQuickBookingOpen(handler: () => void) {
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}
