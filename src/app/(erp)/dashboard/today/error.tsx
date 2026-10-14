"use client";

import { useRouter } from "next/navigation";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { Button } from "@/components/ui/button";
import { ScreenState } from "@/components/ui/screen-state";
import { useLocale, useT } from "@/lib/i18n/client";

export default function TodayDashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();

  return (
    <div className="screen">
      <ScreenToolbar locale={locale} path="/dashboard/today" title={t("dashboard.today.title")} />
      {/* 오류 상태는 화면 낭독기에 바로 알린다(ScreenState). 서버 오류 문장은 보이지 않는다. */}
      <ScreenState
        action={
          <>
            <Button
              onClick={() => {
                reset();
              }}
              variant="secondary"
            >
              {t("dashboard.error.retry")}
            </Button>
            <Button
              onClick={() => {
                router.refresh();
              }}
              variant="secondary"
            >
              {t("dashboard.error.refresh")}
            </Button>
          </>
        }
        description={
          <>
            <p>{t("dashboard.today.error.description")}</p>
            <p className="mt-2 font-semibold text-danger">{t("dashboard.error.generic")}</p>
          </>
        }
        kind="error"
        label={t("dashboard.error.chip")}
        title={t("dashboard.today.error.title")}
      />
    </div>
  );
}
