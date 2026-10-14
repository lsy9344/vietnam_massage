import Link from "next/link";
import type { ReactNode } from "react";
import { MeMenu, type ShellAccount } from "@/components/shell/me-menu";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getDockZones, getZoneTabs, screenHref, zoneForPath, type ScreenContext } from "@/lib/routes";

type ScreenToolbarProps = {
  /** 로딩·오류 화면처럼 계정을 모르는 곳에서는 비워 둔다(탭과 "나" 메뉴 없이 제목만). */
  account?: ShellAccount;
  /** 이 화면의 라우트 목록 경로. 구역 안 탭과 현재 탭을 정한다. */
  path: string;
  title: string;
  locale: Locale;
  /** 구역 안 탭으로 옮길 때 넘길 운영월·날짜. */
  context?: ScreenContext;
  /** 날짜·운영월 맥락(DateContextControls). 날짜가 있는 화면만. */
  dateControls?: ReactNode;
  /** 오른쪽 끝의 주요 행동 하나. */
  action?: ReactNode;
  /** 연결 상태, 마지막 갱신. */
  status?: ReactNode;
  /** 원장처럼 길게 스크롤하는 화면에서 도구줄을 위에 붙여 둔다(840px 이상). */
  sticky?: boolean;
};

const noContext: ScreenContext = { operatingMonthId: null, date: null };

/**
 * 화면 도구줄: 제목 → 날짜·운영월 맥락 → 구역 안 탭 → 주요 행동과 화면 상태.
 * 모든 화면에 같은 내용을 띄우는 전역 상단바가 아니라, 화면마다 다른 맨 위 줄이다.
 */
export function ScreenToolbar({
  account,
  path,
  title,
  locale,
  context = noContext,
  dateControls,
  action,
  status,
  sticky = false
}: ScreenToolbarProps) {
  const t = createTranslator(locale);
  const zone = zoneForPath(path);
  const tabs = zone && account ? getZoneTabs(account.role, zone) : [];
  const meMenuAccount = account && getDockZones(account.role).length === 0 ? account : null;

  return (
    <header className={sticky ? "screen-toolbar screen-toolbar-sticky" : "screen-toolbar"}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h1 className="text-xl font-bold leading-tight text-foreground lg:text-2xl">{title}</h1>
        {dateControls}
        {tabs.length > 1 && zone ? (
          <nav aria-label={t("shell.tabs.aria", { zone: t(`shell.zone.${zone}`) })} className="flex flex-wrap gap-1">
            {tabs.map((tab) => (
              <Link
                aria-current={tab.path === path ? "page" : undefined}
                className="screen-tab"
                href={screenHref(tab, context)}
                key={tab.path}
              >
                {t(tab.labelKey)}
              </Link>
            ))}
          </nav>
        ) : null}
        {action || status || meMenuAccount ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            {status}
            {action}
            {meMenuAccount ? <MeMenu account={meMenuAccount} placement="toolbar" /> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
