"use client";

import { useEffect, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const closeButtonClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary";

// 검정 머리 띠 위의 닫기 버튼(가운데 팝업). 모양은 closeButtonClass와 같고, 화면 바탕색(모래 크림)으로 채워
// 검정 띠 위에서 바로 보이게 한다(사용자 요청, 2026-10-20).
const inkCloseButtonClass =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary";

/**
 * 비모달 보조 패널(콜 상세, 직원 근거, 항목 편집). 작업면을 보면서 다른 행을 고르면 내용만 바뀐다.
 * 포커스를 가두지 않고, 닫히면 패널을 열 때 포커스가 있던 자리로 돌려준다. 도크 위에서 끝난다.
 */
export function SidePanel({
  title,
  onClose,
  children,
  className
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const t = useT();

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <aside
      aria-label={title}
      className={cn(
        "flex max-h-[calc(100vh-var(--dock-space))] flex-col overflow-y-auto rounded-lg border border-border bg-surface",
        className
      )}
    >
      {/* print:hidden: Therapist 안내 쪽지 인쇄(티켓 02)처럼 패널 안 내용만 찍히게 머리글은 뺀다. */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 print:hidden">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <button className={closeButtonClass} onClick={onClose} type="button">
          {t("common.panel.close")}
        </button>
      </div>
      <div className="p-4">{children}</div>
    </aside>
  );
}

/**
 * 모달 패널(빠른 예약 같은 생성 흐름). 오른쪽 서랍이고 휴대폰 폭에서는 전체 화면 시트다.
 * placement="center"는 어느 폭에서나 흐린 배경 위 가운데에 뜨는 팝업이다(Therapist 화면의 창 전부). 흐린 모래색 배경과
 * 갈리도록 머리 띠는 브랜드 검정 잉크, 본문은 아이보리 작업면에 진한 테두리다(사용자 요청, 2026-10-20).
 * 포커스를 가두고 Esc로 닫으며, 닫으면 연 자리로 포커스를 돌려준다. 도크까지 덮어 배경을 비활성으로 만든다.
 * 미저장 값 안내는 onOpenChange를 받는 쪽이 정한다.
 */
export function ModalPanel({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  placement = "drawer",
  children
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  trigger?: ReactNode;
  placement?: "drawer" | "center";
  children: ReactNode;
}) {
  const t = useT();
  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[3px]" data-modal-overlay="" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col overflow-y-auto text-foreground outline-none",
            placement === "center"
              ? "left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-strong bg-surface"
              : "inset-0 bg-surface-float min-[600px]:inset-y-4 min-[600px]:left-auto min-[600px]:right-4 min-[600px]:w-[min(30rem,calc(100vw-2rem))] min-[600px]:rounded-xl min-[600px]:border min-[600px]:border-border"
          )}
        >
          <div
            className={cn(
              "flex items-start justify-between gap-3 px-4 py-3",
              placement === "center" ? "sticky top-0 z-10 bg-brand text-brand-foreground" : "border-b border-border"
            )}
            data-modal-header=""
          >
            <div>
              <DialogPrimitive.Title className={cn("text-lg font-semibold", placement === "center" ? "text-brand-foreground" : "text-foreground")}>
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className={cn("mt-1 text-sm", placement === "center" ? "text-brand-foreground/80" : "text-muted")}>
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close className={placement === "center" ? inkCloseButtonClass : closeButtonClass}>{t("common.panel.close")}</DialogPrimitive.Close>
          </div>
          <div className={cn("p-4", placement === "drawer" && "flex-1")}>{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
