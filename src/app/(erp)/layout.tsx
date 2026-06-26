import { redirect } from "next/navigation";
import { RoleAwareSidebar } from "@/components/domain/role-aware-sidebar";
import { getAuthorizedAccount } from "@/lib/authorization";

export default async function ErpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // getAuthorizedAccount delegates to getCurrentAccountAuthorization for the server-side status recheck.
  const account = await getAuthorizedAccount();
  if (!account || !account.isActive || (account.lockedUntil !== null && account.lockedUntil > new Date())) {
    redirect("/sign-in");
  }

  return (
    <main className="erp-shell bg-background text-foreground">
      <aside className="border-r border-border bg-surface px-4 py-5">
        <div className="mb-6">
          <p className="text-sm font-semibold text-muted">Vietnam Massage</p>
          <h1 className="mt-1 text-2xl font-semibold">ERP 운영</h1>
        </div>
        <RoleAwareSidebar role={account.role} />
      </aside>

      <section className="flex min-h-screen flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
          <div>
            <p className="text-sm font-medium text-muted">오늘 운영 기준</p>
            <h2 className="text-lg font-semibold">역할별 ERP 업무</h2>
          </div>
          <div className="rounded-md border border-border bg-readonly px-3 py-2 text-sm text-muted">
            {account.id}
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
