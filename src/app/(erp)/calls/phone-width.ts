"use client";

import { useEffect, useState } from "react";

/** call-ledger-list.tsx·call-ledger-workspace.tsx의 휴대폰 경계(max-[599px], 티켓 26·스펙 D23)와 같은 값. */
export const PHONE_WIDTH_QUERY = "(min-width: 600px)";

/**
 * 휴대폰 폭(600px 미만)인지 실시간으로 안다. CSS로 숨기기만 하면 DOM에는 그대로 남아, 입력 칸 개수나 글자를
 * 보는 검사(티켓 25·26 E2E, story-2-1)에 걸린다. 휴대폰 폭의 원장은 읽기 전용이라(티켓 26) 원장 목록·편집 패널·
 * 고객 연결 정정 폼(call-customer-link-correction.tsx)이 이 hook으로 입력과 할 일 버튼을 아예 그리지 않는다.
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
