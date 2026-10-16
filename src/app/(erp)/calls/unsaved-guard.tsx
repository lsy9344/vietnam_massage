"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useT } from "@/lib/i18n/client";
import { LEAVE_GUARD_SKIP_ATTRIBUTE } from "@/lib/ledger-address";

type UnsavedGuardApi = {
  setUnsaved: (id: string, unsaved: boolean) => void;
};

const UnsavedGuardContext = createContext<UnsavedGuardApi | null>(null);

/**
 * 저장하지 않은 입력이 있는 동안 CallLeaveGuard에 등록한다(스펙 B07, 티켓 18). 원장 행(15)과 새 행(16)이
 * 쓰고, 콜 상세의 충돌 비교(17)나 빠른 예약 패널(20)도 자기 저장하지 않은 입력이 있는 동안 이 hook으로
 * 등록하면 같은 안내를 받는다. unsaved가 false로 바뀌거나 부르는 쪽이 사라지면 등록은 지워진다.
 * CallLeaveGuard 밖(정적 렌더 테스트 등)에서는 아무것도 하지 않는다.
 */
export function useUnsavedGuard(unsaved: boolean) {
  const api = useContext(UnsavedGuardContext);
  const id = useId();
  useEffect(() => {
    if (!api) return;
    api.setUnsaved(id, unsaved);
    return () => api.setUnsaved(id, false);
  }, [api, id, unsaved]);
}

/**
 * 원장 화면을 감싼다(스펙 B07, 티켓 18). useUnsavedGuard로 등록된 저장하지 않은 입력이 하나라도 있으면
 * 브라우저 닫기·새로고침(beforeunload)과 앱 안 링크 이동(탭 이동, 도크의 다른 화면)을 가로채 안내하고,
 * 취소하면 그 자리에 남아 초안이 그대로다. 같은 화면의 표시만 바꾸는 링크(LEAVE_GUARD_SKIP_ATTRIBUTE)와
 * #로 시작하는 같은 쪽 이동, 새 탭으로 여는 클릭(가운데 버튼·Ctrl/Cmd/Shift)은 가로채지 않는다.
 */
export function CallLeaveGuard({ children }: { children: ReactNode }) {
  const t = useT();
  const unsavedIds = useRef<Set<string>>(new Set());
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const setUnsaved = useCallback((id: string, unsaved: boolean) => {
    if (unsaved) {
      unsavedIds.current.add(id);
    } else {
      unsavedIds.current.delete(id);
    }
  }, []);

  // 브라우저 닫기·새로고침: 브라우저 자체의 안내문을 그대로 쓴다(문구를 커스텀할 수 없다).
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (unsavedIds.current.size === 0) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // 앱 안 이동: Next 라우터보다 앞서 링크 클릭을 캡처 단계에서 가로챈다(App Router에 이동 전 가로채기 API가 없다).
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (unsavedIds.current.size === 0) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.hasAttribute(LEAVE_GUARD_SKIP_ATTRIBUTE) || anchor.target === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      event.preventDefault();
      event.stopPropagation();
      // 도크의 구역 메뉴처럼 팝오버 안의 링크면 메뉴를 닫는다. 팝오버는 맨 위 층이라 열어 두면 안내 창을 덮는다.
      anchor.closest<HTMLElement>("[popover]")?.hidePopover();
      setPendingHref(href);
    }
    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  return (
    <UnsavedGuardContext.Provider value={{ setUnsaved }}>
      {children}
      <ConfirmDialog
        cancelLabel={t("common.confirm.cancel")}
        confirmLabel={t("calls.leaveGuard.confirm")}
        description={t("calls.leaveGuard.description")}
        onConfirm={() => {
          const href = pendingHref;
          setPendingHref(null);
          // 떠나기를 고르면 실제로 이동한다. 서버 액션의 자동저장은 Next 라우터가 아니라 보통의 fetch라
          // 앱 안 이동으로는 끊기지 않지만, 확정된 이동은 전체 새로고침으로 상태를 깨끗이 비운다.
          if (href) window.location.assign(href);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingHref(null);
        }}
        open={pendingHref !== null}
        title={t("calls.leaveGuard.title")}
      />
    </UnsavedGuardContext.Provider>
  );
}
