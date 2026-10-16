/**
 * 새 콜 저장의 요청 id(스펙 B07, 티켓 16). randomUUID는 보안 문맥(https)에서만 있어, 어디서나 있는
 * getRandomValues로 만든다. 새 콜은 빠른 예약 패널(quick-booking-panel.tsx)로만 만든다(티켓 03).
 */
export function newRequestId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
