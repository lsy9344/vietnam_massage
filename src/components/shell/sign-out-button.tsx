"use client";

import { signOut } from "next-auth/react";
import { useT } from "@/lib/i18n/client";

export function SignOutButton() {
  const t = useT();
  return (
    <button
      className="flex min-h-11 w-full items-center px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      onClick={() => signOut({ callbackUrl: "/sign-in" })}
      type="button"
    >
      {t("shell.me.signOut")}
    </button>
  );
}
