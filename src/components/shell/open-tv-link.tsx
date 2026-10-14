import Link from "next/link";
import type { Role } from "@/lib/authorization";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { canAccessRoute, findScreenRoute, screenHref, type ScreenContext } from "@/lib/routes";

/** 현장 화면 도구줄의 "TV 화면 열기". TV에 들어갈 수 있는 역할에게만 보인다. */
export function OpenTvLink({ role, context, locale, primary = false }: { role: Role; context: ScreenContext; locale: Locale; primary?: boolean }) {
  const tvRoute = findScreenRoute("/tv");
  if (!tvRoute || !canAccessRoute(role, tvRoute.path)) {
    return null;
  }
  const t = createTranslator(locale);
  return (
    <Link
      className={
        primary
          ? "inline-flex min-h-11 items-center bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
          : "screen-step"
      }
      href={screenHref(tvRoute, context)}
    >
      {t("shell.openTv")}
    </Link>
  );
}
