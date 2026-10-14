import type { ReactNode } from "react";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

/**
 * 기준정보 화면들의 같은 모양(design.md 6.6 표, 6.8 상태 칩). 서버 페이지와 클라이언트 작업면 양쪽에서 쓴다.
 */

export const masterCellClassName = "border-b border-border px-3 py-2 align-middle";

export function masterDateTime(locale: Locale, value: string) {
  return formatDateTime(locale, value, { dateStyle: "short", timeStyle: "short" });
}

export function MasterTable({
  label,
  minWidth,
  head,
  children
}: {
  label: string;
  /** 표가 좁아지지 않을 최소 폭(Tailwind 클래스). 넘치면 표 상자만 가로로 스크롤한다. */
  minWidth: string;
  head: ReactNode;
  children: ReactNode;
}) {
  // relative: 표 안 sr-only 라벨(절대 위치)이 스크롤 상자 밖 문서 폭을 늘리지 않게 이 상자 안에 가둔다.
  return (
    <div className="relative overflow-x-auto rounded-md border border-border bg-surface">
      <table aria-label={label} className={cn("w-full border-collapse text-left text-sm", minWidth)}>
        <thead className="bg-readonly text-xs font-semibold text-muted">
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// 머리글은 줄을 바꾸지 않는다. 좁으면 표 상자만 가로로 스크롤한다(베트남어 머리글이 서너 줄로 꺾이지 않게).
export function HeadCell({ numeric, children }: { numeric?: boolean; children: ReactNode }) {
  return (
    <th className={cn(masterCellClassName, "whitespace-nowrap", numeric && "text-right")} scope="col">
      {children}
    </th>
  );
}

export function Cell({ numeric, muted, nowrap, children }: { numeric?: boolean; muted?: boolean; nowrap?: boolean; children: ReactNode }) {
  return <td className={cn(masterCellClassName, numeric && "text-right", muted && "text-muted", nowrap && "whitespace-nowrap")}>{children}</td>;
}

/** 구역 제목 한 줄: 제목, 건수, 오른쪽 끝의 보조 행동(예: 코드 추가). */
export function MasterSectionHeading({ id, title, count, action }: { id?: string; title: string; count?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* 건수는 제목 밖에 둔다. 제목(구역 이름)이 곧 표와 구역의 이름이다. */}
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-[0.9375rem] font-semibold text-foreground" id={id}>
          {title}
        </h2>
        {count ? <span className="text-sm text-muted">{count}</span> : null}
      </div>
      {action}
    </div>
  );
}

/** 화면 맨 위의 상태별 수 한 줄(design.md 6.8: 칩 옆에 건수). */
export function CountChips({
  locale,
  label,
  items,
  unit
}: {
  locale: Locale;
  label: string;
  items: Array<{ key: string; label: string; tone: StatusTone; count: number }>;
  unit: (count: string) => string;
}) {
  return (
    <ul aria-label={label} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {items.map((item) => (
        <li className="inline-flex items-center gap-1.5" key={item.key}>
          <StatusIndicator label={item.label} tone={item.tone} />{" "}
          <span className="text-sm font-semibold text-foreground">{unit(formatNumber(locale, item.count))}</span>
        </li>
      ))}
    </ul>
  );
}

export function ActiveCounts({ locale, active, inactive, unit }: { locale: Locale; active: number; inactive: number; unit: (count: string) => string }) {
  return (
    <CountChips
      items={[
        { key: "active", label: t(locale, "masters.common.active"), tone: "success", count: active },
        { key: "inactive", label: t(locale, "masters.common.inactive"), tone: "neutral", count: inactive }
      ]}
      label={t(locale, "masters.common.counts.aria")}
      locale={locale}
      unit={unit}
    />
  );
}

/**
 * 행의 활성 여부. 비활성 항목은 지우지 않고 남겨 둔 것이라는 사실을 행 안에서 설명한다
 * (과거 기록이 그 항목을 그대로 가리킨다).
 */
export function ActiveStatus({ locale, isActive, inactiveNote }: { locale: Locale; isActive: boolean; inactiveNote: string }) {
  return (
    <div className="grid justify-items-start gap-1">
      {isActive ? (
        <StatusIndicator label={t(locale, "masters.common.active")} tone="success" />
      ) : (
        <>
          <StatusIndicator label={t(locale, "masters.common.inactive")} tone="neutral" />
          <span className="max-w-64 text-xs text-muted">{inactiveNote}</span>
        </>
      )}
    </div>
  );
}

/** 편집 칸보다 먼저 보이는 변경 영향(정보구조 9절 "변경 영향과 과거 참조 안내"). */
export function ImpactNotice({ locale, items }: { locale: Locale; items: string[] }) {
  return (
    <section aria-label={t(locale, "masters.common.impact.title")} className="grid gap-2 rounded-md bg-info-soft px-4 py-3">
      <h3 className="text-sm font-semibold text-info">
        <span aria-hidden="true">{"◆︎ "}</span>
        {t(locale, "masters.common.impact.title")}
      </h3>
      <ul className="grid list-disc gap-1 pl-5 text-sm text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** 패널 안 한 묶음(예: 표시명, 계정 연결). 묶음 사이는 24px다. */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-3">
      <h3 className="text-[0.9375rem] font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}
