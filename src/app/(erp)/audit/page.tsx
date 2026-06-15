import { requirePermission, requireRouteAccess } from "@/lib/authorization";
import { PageHeader } from "@/components/domain/page-header";
import { listAuditLogs } from "@/modules/audit/audit-service";

type AuditPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseKstDayStart(value: string | undefined, fieldLabel: string) {
  if (!value) {
    return { date: null, error: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { date: null, error: `${fieldLabel}은 YYYY-MM-DD 형식이어야 합니다.` };
  }

  const [year, month, day] = value.split("-").map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > lastDayOfMonth) {
    return { date: null, error: `${fieldLabel} 날짜가 올바르지 않습니다.` };
  }

  const date = new Date(`${value}T00:00:00.000+09:00`);
  if (Number.isNaN(date.getTime())) {
    return { date: null, error: `${fieldLabel} 날짜를 해석할 수 없습니다.` };
  }

  return { date, error: null };
}

function nextDay(date: Date | null) {
  if (!date) {
    return null;
  }

  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Seoul"
  }).format(date);
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return JSON.stringify(value, null, 2);
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  await requireRouteAccess("/audit");
  await requirePermission("audit:read");

  const params = (await searchParams) ?? {};
  const targetType = firstParam(params.targetType)?.trim() ?? "";
  const fromValue = firstParam(params.from)?.trim() ?? "";
  const toValue = firstParam(params.to)?.trim() ?? "";
  const from = parseKstDayStart(fromValue, "시작일");
  const to = parseKstDayStart(toValue, "종료일");
  const rangeError = from.date && to.date && from.date > to.date ? "종료일은 시작일과 같거나 이후여야 합니다." : null;
  const errors = [from.error, to.error, rangeError].filter((error): error is string => Boolean(error));
  let queryError: string | null = null;
  let logs: Awaited<ReturnType<typeof listAuditLogs>> = [];

  if (errors.length === 0) {
    try {
      logs = await listAuditLogs({
        targetType,
        from: from.date,
        to: nextDay(to.date),
        limit: 100
      });
    } catch {
      queryError = "감사 로그를 불러오지 못했습니다. 다시 조회하거나 관리자에게 문의하세요.";
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow="감사 로그"
        title="변경 이력 조회"
        description="지급액과 운영 상태에 영향을 주는 변경의 행위자, 액션, 대상, 변경 전후값을 조회한다."
        meta={
          <>
            <div>최근 100건</div>
            <div>삭제 불가 이력</div>
          </>
        }
      />

      <form className="mb-4 grid grid-cols-1 items-end gap-3 border border-border bg-surface p-3 lg:grid-cols-[220px_180px_180px_auto]" method="get">
        <label className="grid gap-1 text-xs font-semibold text-muted">
          대상 유형
          <input
            className="h-9 border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={targetType}
            name="targetType"
            placeholder="service_call"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          시작일
          <input
            className="h-9 border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={fromValue}
            name="from"
            type="date"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          종료일
          <input
            className="h-9 border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={toValue}
            name="to"
            type="date"
          />
        </label>
        <div className="flex gap-2">
          <button className="h-9 border border-brand bg-brand px-4 text-sm font-semibold text-white" type="submit">
            조회
          </button>
          <a className="grid h-9 place-items-center border border-border px-4 text-sm font-semibold text-foreground" href="/audit">
            초기화
          </a>
        </div>
      </form>

      {errors.length > 0 ? (
        <div className="border border-danger bg-surface p-4 text-sm text-danger">
          {errors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      ) : null}

      {queryError ? <div className="border border-danger bg-surface p-4 text-sm text-danger">{queryError}</div> : null}

      <section className="border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">감사 이벤트</h2>
          <span className="text-xs text-muted">{logs.length}건 표시</span>
        </div>

        {logs.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted">
            {errors.length > 0 || queryError ? "조회 결과를 표시할 수 없습니다." : "조건에 맞는 감사 로그가 없다."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="bg-readonly text-xs font-semibold text-muted">
                <tr>
                  <th className="w-40 border-b border-border px-3 py-2">시각</th>
                  <th className="w-36 border-b border-border px-3 py-2">행위자</th>
                  <th className="w-52 border-b border-border px-3 py-2">액션</th>
                  <th className="w-44 border-b border-border px-3 py-2">대상</th>
                  <th className="border-b border-border px-3 py-2">변경 전</th>
                  <th className="border-b border-border px-3 py-2">변경 후</th>
                  <th className="w-44 border-b border-border px-3 py-2">사유</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr className="align-top" key={log.id}>
                    <td className="border-b border-border px-3 py-2 text-xs text-muted">{formatDateTime(log.createdAt)}</td>
                    <td className="border-b border-border px-3 py-2 font-medium">{log.actorId}</td>
                    <td className="border-b border-border px-3 py-2 font-mono text-xs">{log.action}</td>
                    <td className="border-b border-border px-3 py-2">
                      <div className="font-medium">{log.targetType}</div>
                      <div className="text-xs text-muted">{log.targetId}</div>
                    </td>
                    <td className="max-w-[260px] border-b border-border px-3 py-2">
                      <details>
                        <summary className="cursor-pointer truncate text-xs">{log.beforeSummary}</summary>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap bg-background p-2 text-xs">
                          {formatJson(log.beforeValue)}
                        </pre>
                      </details>
                    </td>
                    <td className="max-w-[260px] border-b border-border px-3 py-2">
                      <details>
                        <summary className="cursor-pointer truncate text-xs">{log.afterSummary}</summary>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap bg-background p-2 text-xs">
                          {formatJson(log.afterValue)}
                        </pre>
                      </details>
                    </td>
                    <td className="border-b border-border px-3 py-2 text-xs text-muted">{log.reason ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
