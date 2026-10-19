import Link from "next/link";
import type { Role } from "@/lib/authorization";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { canAccessRoute, findScreenRoute } from "@/lib/routes";

/** 현장 화면 도구줄의 "출근 코드 보기"(스펙 D13, 티켓 05). 카운터·관리자에게만 보인다. */
export function OpenClockCodeLink({ role, locale }: { role: Role; locale: Locale }) {
  const clockCodeRoute = findScreenRoute("/clock-code");
  if (!clockCodeRoute || !canAccessRoute(role, clockCodeRoute.path)) {
    return null;
  }
  const t = createTranslator(locale);
  return (
    <Link className="screen-step" href="/clock-code">
      {t("shell.openClockCode")}
    </Link>
  );
}
