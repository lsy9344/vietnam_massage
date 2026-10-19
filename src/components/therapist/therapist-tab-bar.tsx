"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { THERAPIST_TAB_BAR_ID } from "@/components/therapist/therapist-skip-links";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/client";
import { getZoneTabs } from "@/lib/routes";

const NOTICES_PATH = "/therapist/notices";

/**
 * Therapist 화면 아래 탭 네 개(오늘·근태·수당·공지, 스펙 D7). 운영팀 업무 흐름 도크와 같은 떠 있는 섬
 * 모양을 재사용하지만(.shell-dock*), 구역 메뉴 팝오버나 로고, 더보기 같은 ops 전용 동작은 없다 — 네
 * 화면이 모두 한 구역("therapist")의 직접 링크다(티켓 01).
 *
 * 공지 탭의 읽지 않은 수는 noticeUnreadCount로 받는다. 공지 기능(티켓 10)이 실제 값을 넘기기 전까지는
 * undefined라 자리만 비워 둔다.
 */
export function TherapistTabBarView({ currentPath, locale, noticeUnreadCount }: { currentPath: string; locale: Locale; noticeUnreadCount?: number }) {
  const t = createTranslator(locale);
  const tabs = getZoneTabs("therapist", "therapist");

  return (
    <nav aria-label={t("therapist.nav.aria")} className="shell-dock therapist-tab-bar print:hidden" id={THERAPIST_TAB_BAR_ID} tabIndex={-1}>
      <div className="shell-dock-zones">
        {tabs.map((tab) => {
          const current = tab.path === currentPath;
          const badge = tab.path === NOTICES_PATH ? noticeUnreadCount : undefined;
          return (
            <Link
              aria-current={current ? "page" : undefined}
              className="shell-dock-item"
              data-therapist-tab={tab.path}
              href={tab.path}
              key={tab.path}
            >
              {t(tab.labelKey)}
              {badge ? <span className="therapist-tab-badge">{badge}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** 지금 화면의 주소를 읽어 탭 바를 그린다. */
export function TherapistTabBar({ noticeUnreadCount }: { noticeUnreadCount?: number }) {
  const pathname = usePathname();
  const locale = useLocale();
  return <TherapistTabBarView currentPath={pathname} locale={locale} noticeUnreadCount={noticeUnreadCount} />;
}
