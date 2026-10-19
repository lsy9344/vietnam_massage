"use client";

import { useId } from "react";
import Link from "next/link";
import { LocaleSwitcher } from "@/components/domain/locale-switcher";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { BrandLockup } from "@/components/ui/brand-logo";
import type { TherapistProfile } from "@/modules/therapists/therapist-profile-service";
import { useT } from "@/lib/i18n/client";

/**
 * Therapist 화면 오른쪽 위 "나" 메뉴: 이름·직원 코드·전화번호(보기만, 고칠 수 없음, 스펙 D9), 언어,
 * 비밀번호 변경(티켓 02), 로그아웃. 운영팀 MeMenu는 표시 이름과 역할을 보이지만 Therapist는 역할 대신
 * 직원 정보를 보인다는 점이 달라 별도 컴포넌트로 둔다(티켓 01).
 */
export function TherapistMeMenu({ profile }: { profile: TherapistProfile | null }) {
  const t = useT();
  const menuId = useId();

  return (
    <>
      <button className="screen-step" popoverTarget={menuId} type="button">
        {t("shell.me.trigger")}
      </button>
      <div aria-label={t("shell.me.aria")} className="shell-popover shell-popover-top" id={menuId} popover="auto" role="group">
        <div className="border-b border-border px-3 py-3">
          <BrandLockup layout="inline" />
        </div>
        <div className="border-b border-border px-3 py-3">
          <p className="text-sm font-semibold text-foreground">{profile?.displayName ?? "-"}</p>
          <p className="mt-0.5 text-xs text-muted">{t("therapist.me.staffCodeLabel", { code: profile?.staffCode ?? "-" })}</p>
          <p className="mt-0.5 text-xs text-muted">
            {profile?.phone ? t("therapist.me.phoneLabel", { phone: profile.phone }) : t("therapist.me.phoneEmpty")}
          </p>
        </div>
        <div className="border-b border-border px-3 py-3">
          <LocaleSwitcher />
        </div>
        <Link
          className="flex min-h-11 w-full items-center rounded-sm px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
          href="/therapist/password"
        >
          {t("therapist.me.changePassword")}
        </Link>
        <SignOutButton />
      </div>
    </>
  );
}
