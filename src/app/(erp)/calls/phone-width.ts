"use client";

import { useEffect, useState } from "react";

/** call-ledger-list.tsx의 휴대폰 경계(min-[600px], 티켓 26)와 같은 값. */
export const PHONE_WIDTH_QUERY = "(min-width: 600px)";

/**
 * 휴대폰 폭(600px 미만)인지 실시간으로 안다. CSS(`min-[600px]:hidden`)만으로는 안 된다 — CSS로 숨겨도
 * DOM에는 그대로 남아, 입력 칸 개수나 글자를 보는 검사(티켓 25·26 E2E, story-2-1)에 걸린다. 콜 상세의
 * 고객 연결 정정 폼(call-customer-link-correction.tsx)과 원장 콜이 없을 때의 빈 상태 문구
 * (call-ledger-list.tsx·call-phone-card-list.tsx)가 이 hook으로 실제 폭에 맞는 한쪽만 그린다.
 */
export function usePhoneWidth() {
  const [isPhone, setIsPhone] = useState(() => typeof window !== "undefined" && !window.matchMedia(PHONE_WIDTH_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(PHONE_WIDTH_QUERY);
    const update = () => setIsPhone(!query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isPhone;
}
