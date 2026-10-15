/**
 * 새 행 초안의 요청 id(스펙 B07, 티켓 16). randomUUID는 보안 문맥(https)에서만 있어, 어디서나 있는
 * getRandomValues로 만든다. 원장 새 행(editable-call-grid.tsx)과 빠른 예약 패널(quick-booking-panel.tsx)이
 * 같은 생성 경로(createServiceCallRowAction)를 쓰므로 이 생성기도 공유한다.
 */
export function newRequestId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
