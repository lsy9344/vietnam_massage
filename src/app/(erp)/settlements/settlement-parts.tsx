import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DateCapsule } from "@/components/ui/date-capsule";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { ledgerCallHref } from "@/lib/ledger-address";
import type { SettlementAmount } from "@/app/(erp)/settlements/settlement-view-model";
import { t } from "@/lib/i18n";
import { operatingMonthStatusLabel, serviceStatusLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrencyVnd } from "@/lib/i18n/format";
import type { SettlementEvidenceCallDto } from "@/modules/settlements/settlement-evidence-call";

export function vnd(locale: Locale, value: number) {
  return `${formatCurrencyVnd(locale, value)} ${t(locale, "settlements.vndSuffix")}`;
}

/** 글자 안에 넣는 금액(예: 요약 카드 설명). 계산 근거가 없으면 0 대신 "근거 없음". */
export function amountLabel(amount: SettlementAmount, locale: Locale) {
  return amount.kind === "noBasis" ? t(locale, "settlements.noBasis") : vnd(locale, amount.value);
}

/** 표·패널의 금액. 계산 근거가 없으면 0 대신 "근거 없음"을 보인다. */
export function AmountText({ amount, locale }: { amount: SettlementAmount; locale: Locale }) {
  if (amount.kind === "noBasis") {
    return <span className="font-normal text-muted">{t(locale, "settlements.noBasis")}</span>;
  }
  return <>{vnd(locale, amount.value)}</>;
}

/** 요약 카드(SummaryCard)의 값과 단위. 근거가 없으면 "계산 근거 없음"(design.md 6.7). */
export function summaryAmount(amount: SettlementAmount, locale: Locale): { value: string; unit?: string } {
  if (amount.kind === "noBasis") return { value: t(locale, "settlements.summary.noBasis") };
  return { value: formatCurrencyVnd(locale, amount.value), unit: t(locale, "settlements.vndSuffix") };
}

/** 잠긴 운영월: 이유(운영월 상태)와 함께 읽기 전용임을 알린다. */
export function SettlementLockedNotice({ locale, monthStatus, description }: { locale: Locale; monthStatus: string; description: string }) {
  return (
    <ScreenState
      className="mb-6"
      description={
        <>
          <p>{t(locale, "settlements.locked.reason", { status: operatingMonthStatusLabel(locale, monthStatus) })}</p>
          <p className="mt-1">{description}</p>
        </>
      }
      kind="locked"
      label={t(locale, "common.screenState.locked")}
      title={t(locale, "settlements.locked.title")}
    />
  );
}

/** 조회 실패: 원인과 같은 조건으로 다시 조회하는 버튼. */
export function SettlementErrorNotice({
  locale,
  title,
  message,
  query,
  className
}: {
  locale: Locale;
  title: string;
  message: string;
  /** 다시 조회할 때 그대로 보낼 주소 매개변수. */
  query: Record<string, string>;
  className?: string;
}) {
  return (
    <ScreenState
      action={
        <form method="get">
          {Object.entries(query).map(([name, value]) => (
            <input key={name} name={name} type="hidden" value={value} />
          ))}
          <Button type="submit" variant="secondary">
            {t(locale, "settlements.requery")}
          </Button>
        </form>
      }
      className={className}
      description={message}
      kind="error"
      label={t(locale, "common.screenState.error")}
      title={title}
    />
  );
}

export function SettlementEmptyNotice({ locale, title, description, className }: { locale: Locale; title: string; description: string; className?: string }) {
  return <ScreenState className={className} description={description} kind="empty" label={t(locale, "common.screenState.empty")} title={title} />;
}

/** 요약 카드 바로 아래의 경고 한 줄: 칩과 내역 문장. */
export function SettlementWarningLine({ label, detail }: { label: string; detail?: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1" role="status">
      <StatusIndicator label={label} tone="warning" />
      {detail ? <span className="text-sm text-foreground">{detail}</span> : null}
    </p>
  );
}

/** 직원 패널 안의 한 구역(출퇴근, 근거 콜, 적용 정책, 지급). */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-3">
      <h3 className="text-[0.9375rem] font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

// 목록 행 카드(design.md 6.10). 직원 패널은 같은 --surface 바탕이라 1px 테두리로 나눈다.
const evidenceItemClassName = "block min-h-14 rounded-md border border-border bg-surface px-4 py-2.5";

/**
 * 정산 근거 콜 하나(스토리 148). 원장에 들어갈 수 있는 역할(관리자)에게는 항목 전체가 원장의 그 날짜·그 콜로 가는
 * 링크이고, 정산 담당에게는 링크 없이 같은 자리의 콜 요약(날짜, 예약시각, 코스, Therapist, 상태)만 보인다.
 */
export function EvidenceCallItem({
  locale,
  call,
  serviceDate,
  canOpenLedger,
  amount,
  detail
}: {
  locale: Locale;
  /** 같은 조회에서 콜 행을 읽지 못했으면 null. */
  call: SettlementEvidenceCallDto | null;
  serviceDate: string;
  canOpenLedger: boolean;
  /** 이 콜이 이 정산에 보탠 값(수당, 풀, 콜 수). */
  amount: ReactNode;
  /** 담당 역할, 정책 상태 같은 덧붙임. */
  detail?: ReactNode;
}) {
  const href = canOpenLedger && call ? ledgerCallHref(call) : null;
  const body = (
    <>
      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
          <DateCapsule>{call ? `${call.serviceDate} ${call.startTime}` : serviceDate}</DateCapsule>
          {call ? (
            <>
              <span className="font-semibold">{call.courseCode}</span>
              <span>{call.therapistNames.join(", ") || "—"}</span>
              <span className="text-muted">{serviceStatusLabel(locale, call.status)}</span>
            </>
          ) : (
            <span className="text-muted">{t(locale, "settlements.evidenceCall.missing")}</span>
          )}
        </span>
        <span className="text-right text-sm font-semibold text-foreground">{amount}</span>
      </span>
      {detail || href ? (
        <span className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span className="flex flex-wrap items-center gap-2">{detail}</span>
          {href ? (
            <span className="font-semibold text-foreground underline underline-offset-4">{t(locale, "settlements.evidenceCall.openLedger")}</span>
          ) : null}
        </span>
      ) : null}
    </>
  );

  return href ? (
    <a
      className={`${evidenceItemClassName} transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary`}
      href={href}
    >
      {body}
    </a>
  ) : (
    <div className={evidenceItemClassName}>{body}</div>
  );
}

/** 직원 패널에서 월 명세서 화면으로 가는 링크(티켓 32). 받는 화면에 들어갈 수 없는 역할에게는 아예 주지 않는다. */
export function StatementLink({ locale, href }: { locale: Locale; href: string | null }) {
  if (!href) return null;
  return (
    <Link className="text-sm font-semibold text-brand-strong underline-offset-4 hover:underline" href={href}>
      {t(locale, "settlements.statement.openLink")}
    </Link>
  );
}

export function EvidenceCallList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="grid gap-2">
      {children}
    </ul>
  );
}
