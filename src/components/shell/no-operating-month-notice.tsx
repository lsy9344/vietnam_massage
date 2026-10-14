import Link from "next/link";
import type { Role } from "@/lib/authorization";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { canAccessRoute } from "@/lib/routes";

const OPERATING_MONTHS_PATH = "/masters/operating-months";

/**
 * 운영월이 없을 때 모든 화면이 보이는 다음 할 일 안내.
 * 운영월 설정에 들어갈 수 있는 역할에게만 링크를, 그 밖에는 관리자에게 요청하라는 안내를 보인다.
 */
export function NoOperatingMonthNotice({ role, locale, description }: { role: Role; locale: Locale; description?: string }) {
  const t = createTranslator(locale);
  return (
    <section className="border border-border bg-surface px-4 py-8">
      <h2 className="text-base font-semibold text-foreground">{t("common.createOperatingMonthFirst")}</h2>
      {description ? <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p> : null}
      {canAccessRoute(role, OPERATING_MONTHS_PATH) ? (
        <Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-strong underline-offset-4 hover:underline" href={OPERATING_MONTHS_PATH}>
          {t("common.goToOperatingMonths")}
        </Link>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("common.requestOperatingMonthFromAdmin")}</p>
      )}
    </section>
  );
}
