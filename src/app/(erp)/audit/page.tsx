import Link from "next/link";
import {
  AUDIT_TARGET_TYPES,
  auditChangeSummary,
  auditFieldChanges,
  auditReason,
  auditSourceHref,
  auditTargetLabel
} from "@/app/(erp)/audit/audit-view-model";
import { AuditWorkspace, type AuditEntryView } from "@/app/(erp)/audit/audit-workspace";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ScreenState } from "@/components/ui/screen-state";
import { requirePermission, requireRouteAccess, type Role } from "@/lib/authorization";
import { listAuditActors, listAuditLogs, type AuditActor, type AuditLogListItem } from "@/modules/audit/audit-service";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import { type Translator } from "@/lib/i18n";
import { BUSINESS_TIME_ZONE_OFFSET } from "@/lib/business-time";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

type AuditPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseBusinessDayStart(value: string | undefined, fieldLabel: string, t: Translator) {
  if (!value) {
    return { date: null, error: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { date: null, error: t("audit.error.dateFormat", { field: fieldLabel }) };
  }

  const [year, month, day] = value.split("-").map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > lastDayOfMonth) {
    return { date: null, error: t("audit.error.invalidDate", { field: fieldLabel }) };
  }

  const date = new Date(`${value}T00:00:00.000${BUSINESS_TIME_ZONE_OFFSET}`);
  if (Number.isNaN(date.getTime())) {
    return { date: null, error: t("audit.error.unparseableDate", { field: fieldLabel }) };
  }

  return { date, error: null };
}

function nextDay(date: Date | null) {
  if (!date) {
    return null;
  }

  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

// 날짜와 시각 사이 공백이 본문 글꼴에서 거의 보이지 않아(예: "00:08:5315/10/26") 가운뎃점으로 나눈다.
function auditDateTime(locale: Locale, date: Date) {
  return `${formatDateTime(locale, date, { dateStyle: "short" })} · ${formatDateTime(locale, date, { timeStyle: "medium" })}`;
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return JSON.stringify(value, null, 2);
}

function toEntryView(
  locale: Locale,
  role: Role,
  log: AuditLogListItem,
  actors: Map<string, AuditActor>
): AuditEntryView {
  const actor = actors.get(log.actorId);
  return {
    id: log.id,
    time: auditDateTime(locale, log.createdAt),
    actorName: actor?.name ?? log.actorId,
    actorAccountId: actor && actor.accountId !== actor.name ? actor.accountId : null,
    targetLabel: auditTargetLabel(locale, log.targetType),
    targetId: log.targetId,
    action: log.action,
    summary: auditChangeSummary(log.beforeValue, log.afterValue),
    reason: auditReason(log),
    changes: auditFieldChanges(log.beforeValue, log.afterValue),
    beforeJson: formatJson(log.beforeValue),
    afterJson: formatJson(log.afterValue),
    sourceHref: auditSourceHref(role, log)
  };
}

function FieldError({ id, messages }: { id: string; messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <span className="grid gap-1 text-sm font-normal text-danger" id={id}>
      {messages.map((message) => (
        <span key={message}>{message}</span>
      ))}
    </span>
  );
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const account = await requireRouteAccess("/audit");
  await requirePermission("audit:read");

  const { locale, t } = await getServerTranslator();
  const params = (await searchParams) ?? {};
  const targetType = firstParam(params.targetType)?.trim() ?? "";
  const fromValue = firstParam(params.from)?.trim() ?? "";
  const toValue = firstParam(params.to)?.trim() ?? "";
  const from = parseBusinessDayStart(fromValue, t("audit.field.startDate"), t);
  const to = parseBusinessDayStart(toValue, t("audit.field.endDate"), t);
  const rangeError = from.date && to.date && from.date > to.date ? t("audit.error.rangeOrder") : null;
  // 오류는 그 오류를 낸 칸 아래에 둔다. 기간 순서 오류는 종료일 칸의 문제로 본다.
  const fromErrors = [from.error].filter((error): error is string => Boolean(error));
  const toErrors = [to.error, rangeError].filter((error): error is string => Boolean(error));
  const hasFieldErrors = fromErrors.length + toErrors.length > 0;
  let queryError: string | null = null;
  let logs: AuditLogListItem[] = [];
  let actors = new Map<string, AuditActor>();

  if (!hasFieldErrors) {
    try {
      logs = await listAuditLogs({
        targetType,
        from: from.date,
        to: nextDay(to.date),
        limit: 100
      });
      actors = await listAuditActors(logs.map((log) => log.actorId));
    } catch {
      queryError = t("audit.error.queryFailed");
    }
  }

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/audit" title={t("audit.title")} />

      <form className="mb-6 flex flex-wrap items-start gap-4 rounded-lg border border-border bg-surface p-4" method="get" noValidate>
        <label className="grid w-full gap-1.5 text-sm font-semibold text-foreground sm:w-56">
          {t("audit.field.targetType")}
          <input
            className={inputFieldClassName()}
            defaultValue={targetType}
            list="audit-target-types"
            name="targetType"
            placeholder={t("audit.field.targetTypePlaceholder")}
          />
          <datalist id="audit-target-types">
            {AUDIT_TARGET_TYPES.map((type) => (
              <option key={type} value={type}>
                {auditTargetLabel(locale, type)}
              </option>
            ))}
          </datalist>
        </label>
        <label className="grid w-full gap-1.5 text-sm font-semibold text-foreground sm:w-48">
          {t("audit.field.startDate")}
          <input
            aria-describedby={fromErrors.length > 0 ? "audit-from-error" : undefined}
            aria-invalid={fromErrors.length > 0 || undefined}
            className={inputFieldClassName({ invalid: fromErrors.length > 0 })}
            defaultValue={fromValue}
            name="from"
            type="date"
          />
          <FieldError id="audit-from-error" messages={fromErrors} />
        </label>
        <label className="grid w-full gap-1.5 text-sm font-semibold text-foreground sm:w-48">
          {t("audit.field.endDate")}
          <input
            aria-describedby={toErrors.length > 0 ? "audit-to-error" : undefined}
            aria-invalid={toErrors.length > 0 || undefined}
            className={inputFieldClassName({ invalid: toErrors.length > 0 })}
            defaultValue={toValue}
            name="to"
            type="date"
          />
          <FieldError id="audit-to-error" messages={toErrors} />
        </label>
        {/* 칸 라벨 높이만큼 내려 버튼을 입력칸 줄에 맞춘다. */}
        <div className="flex flex-wrap gap-2 sm:pt-[1.625rem]">
          <Button type="submit" variant="secondary">
            {t("audit.query")}
          </Button>
          <Link
            className="inline-flex h-11 items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
            href="/audit"
          >
            {t("audit.reset")}
          </Link>
        </div>
        <p className="w-full text-xs text-muted">
          {t("audit.meta.recent")} · {t("audit.meta.noDelete")}
        </p>
      </form>

      {queryError ? <ScreenState className="mb-6" kind="error" label={t("audit.error.label")} title={queryError} /> : null}

      <AuditWorkspace
        countLabel={t("audit.displayCount", { count: logs.length })}
        emptyMessage={hasFieldErrors || queryError ? t("audit.empty.error") : t("audit.empty.none")}
        entries={logs.map((log) => toEntryView(locale, account.role, log, actors))}
      />
    </div>
  );
}
