"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getNavigationForRole } from "@/lib/navigation";
import { useT } from "@/lib/i18n/client";
import type { Role } from "@/lib/authorization";

export function RoleAwareSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const t = useT();
  const groups = getNavigationForRole(role);

  return (
    <nav aria-label={t("shell.menu.aria")} className="space-y-4">
      {groups.map((group) => {
        const groupLabel = t(group.labelKey);
        return (
          <section key={group.labelKey} aria-label={groupLabel} className="space-y-1 rounded-md border border-border bg-surface/60">
            <h2 className="rounded-t-md bg-brand/90 px-3 py-2 text-xs font-bold uppercase tracking-wide text-brand-foreground">{groupLabel}</h2>
            <div className="mt-1 space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                      isActive ? "bg-readonly text-foreground" : "text-muted hover:bg-readonly hover:text-foreground"
                    )}
                    href={item.href}
                    key={item.href}
                  >
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
