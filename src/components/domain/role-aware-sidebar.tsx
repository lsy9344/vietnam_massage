"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getNavigationForRole } from "@/lib/navigation";
import type { Role } from "@/lib/authorization";

export function RoleAwareSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const groups = getNavigationForRole(role);

  return (
    <nav aria-label="ERP 도메인 메뉴" className="space-y-4">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="px-3 text-xs font-semibold text-muted">{group.label}</h2>
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
                  {item.label}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
