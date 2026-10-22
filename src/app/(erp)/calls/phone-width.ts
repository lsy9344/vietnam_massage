"use client";

import { useSyncExternalStore } from "react";

/** call-ledger-list.tsx·call-ledger-workspace.tsx의 휴대폰 경계(max-[599px], 티켓 26·스펙 D23)와 같은 값. */
export const PHONE_WIDTH_QUERY = "(min-width: 600px)";

/**
 * 휴대폰 폭(600px 미만)인지 실시간으로 안다. CSS로 숨기기만 하면 DOM에는 그대로 남아, 입력 칸 개수나 글자를
 * 보는 검사(티켓 25·26 E2E, story-2-1)에 걸린다. 휴대폰 폭의 원장은 읽기 전용이라(티켓 26) 원장 목록·편집 패널이
 * 이 hook으로 입력과 할 일 버튼을 아예 그리지 않는다(고객 연결 정정 폼은 편집 패널의 readOnly를 받는다).
 *
 * 서버는 창 폭을 모르므로 넓은 화면으로 그린다. 붙을 때(hydration)도 서버와 같은 값을 쓰고, 그 뒤에 이 기기의 폭으로
 * 다시 그린다 — 첫 렌더부터 창 폭을 읽으면 휴대폰에서 서버 HTML과 달라 hydration 오류가 났다(2026-10-22).
 */
export function usePhoneWidth() {
  return useSyncExternalStore(subscribePhoneWidth, isPhoneWidthNow, () => false);
}

function subscribePhoneWidth(onChange: () => void) {
  const query = window.matchMedia(PHONE_WIDTH_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isPhoneWidthNow() {
  return !window.matchMedia(PHONE_WIDTH_QUERY).matches;
}
