import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MAIN_CONTENT_ID, SkipLinks } from "@/components/shell/skip-links";
import { WorkflowDock } from "@/components/shell/workflow-dock";
import { getAuthorizedAccount } from "@/lib/authorization";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";

export default async function ErpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // getAuthorizedAccount delegates to getCurrentAccountAuthorization for the server-side status recheck.
  const account = await getAuthorizedAccount();
  if (!account || !account.isActive || (account.lockedUntil !== null && account.lockedUntil > new Date())) {
    redirect("/sign-in");
  }

  const locale = await getLocale();
  const shellAccount = { role: account.role, displayName: account.displayName };

  // 문서 순서: 건너뛰기 → 화면(도구줄 → 작업면 → 패널) → 업무 흐름 도크.
  return (
    <LocaleProvider locale={locale}>
      <SkipLinks locale={locale} role={account.role} />
      <main className="erp-main bg-background text-foreground" id={MAIN_CONTENT_ID} tabIndex={-1}>
        {children}
      </main>
      <Suspense fallback={null}>
        <WorkflowDock account={shellAccount} />
      </Suspense>
    </LocaleProvider>
  );
}
