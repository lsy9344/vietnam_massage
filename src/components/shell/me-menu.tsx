"use client";

import { useId } from "react";
import { LocaleSwitcher } from "@/components/domain/locale-switcher";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { BrandLockup } from "@/components/ui/brand-logo";
import type { Role } from "@/lib/authorization";
import { useT } from "@/lib/i18n/client";

export type ShellAccount = {
  role: Role;
  displayName: string;
};

/**
 * "나" 메뉴: 가게 로고, 표시 이름, 역할, 언어 전환, 로그아웃. 로고는 도크에 자리가 없는 좁은 폭에서도 여기서 보인다.
 * 브라우저 popover로 열고 닫는다(바깥 누름·Esc로 닫히고 포커스가 버튼으로 돌아온다).
 */
export function MeMenu({ account, placement }: { account: ShellAccount; placement: "dock" | "toolbar" }) {
  const t = useT();
  const menuId = useId();

  return (
    <>
      <button
        className={placement === "dock" ? "shell-dock-item" : "screen-step"}
        popoverTarget={menuId}
        type="button"
      >
        {t("shell.me.trigger")}
      </button>
      <div
        aria-label={t("shell.me.aria")}
        className={placement === "dock" ? "shell-popover shell-popover-end" : "shell-popover shell-popover-top"}
        id={menuId}
        popover="auto"
        role="group"
      >
        <div className="border-b border-border px-3 py-3">
          <BrandLockup layout="inline" />
        </div>
        <div className="border-b border-border px-3 py-3">
          <p className="text-sm font-semibold text-foreground">{account.displayName}</p>
          <p className="mt-0.5 text-xs text-muted">{t(`shell.role.${account.role}`)}</p>
        </div>
        <div className="border-b border-border px-3 py-3">
          <LocaleSwitcher />
        </div>
        <SignOutButton />
      </div>
    </>
  );
}
