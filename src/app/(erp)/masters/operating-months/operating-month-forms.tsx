"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { OperatingMonthDto } from "@/modules/masters/operating-month-service";
import {
  changeOperatingMonthStatusAction,
  createOperatingMonthAction,
  type OperatingMonthActionState
} from "@/app/(erp)/masters/operating-months/actions";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatDateTime } from "@/lib/i18n/format";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";

function StatusChangeForm({ month }: { month: OperatingMonthDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<OperatingMonthActionState, FormData>(
    changeOperatingMonthStatusAction,
    null
  );

  return (
    <form action={formAction} className="grid gap-1">
      <input name="monthKey" type="hidden" value={month.monthKey} />
      <input name="status" type="hidden" value="검토중" />
      <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="secondary">
        {t("masters.operatingMonths.changeToReview")}
      </Button>
      {state && !state.ok ? <span className="text-xs text-danger">{state.formError}</span> : null}
    </form>
  );
}

export function OperatingMonthManager({
  highlightedMonthKey,
  months
}: {
  highlightedMonthKey: string | null;
  months: OperatingMonthDto[];
}) {
  const t = useT();
  const locale = useLocale();
  const [createState, createAction, createPending] = useActionState<OperatingMonthActionState, FormData>(
    createOperatingMonthAction,
    null
  );

  return (
    <>
      <form
        action={createAction}
        className="mb-4 grid grid-cols-1 items-end gap-3 border border-border bg-surface p-3 lg:grid-cols-[220px_auto]"
      >
        <label className="grid gap-1 text-xs font-semibold text-muted">
          {t("masters.operatingMonths.newMonth")}
          <input
            className="h-9 border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
            name="monthKey"
            pattern="[0-9]{4}-(0[1-9]|1[0-2])"
            placeholder="YYYY-MM"
            required
          />
        </label>
        <div className="flex items-center gap-3">
          <Button className="h-9" disabled={createPending} type="submit">
            {t("masters.operatingMonths.create")}
          </Button>
          <span className="text-xs text-muted">{t("masters.operatingMonths.createHelp")}</span>
        </div>
        {createState && !createState.ok ? (
          <div className="lg:col-span-2 border border-danger bg-surface px-3 py-2 text-sm text-danger">
            {createState.fieldErrors?.monthKey?.map((error) => <div key={error}>{error}</div>)}
            {createState.formError ? <div>{createState.formError}</div> : null}
          </div>
        ) : null}
      </form>

      <section className="border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">{t("masters.operatingMonths.listTitle")}</h2>
          <span className="text-xs text-muted">{t("masters.common.displayCount", { count: months.length })}</span>
        </div>

        {months.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted">{t("masters.operatingMonths.empty")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead className="bg-readonly text-xs font-semibold text-muted">
                <tr>
                  <th className="w-32 border-b border-border px-3 py-2">{t("masters.operatingMonths.column.month")}</th>
                  <th className="w-32 border-b border-border px-3 py-2">{t("masters.operatingMonths.column.startDate")}</th>
                  <th className="w-32 border-b border-border px-3 py-2">{t("masters.operatingMonths.column.endDate")}</th>
                  <th className="w-32 border-b border-border px-3 py-2">{t("masters.operatingMonths.column.currentStatus")}</th>
                  <th className="w-44 border-b border-border px-3 py-2">{t("masters.common.createdAt")}</th>
                  <th className="w-44 border-b border-border px-3 py-2">{t("masters.common.updatedAt")}</th>
                  <th className="border-b border-border px-3 py-2">{t("masters.common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => {
                  const highlighted = highlightedMonthKey === month.monthKey;
                  return (
                    <tr className={highlighted ? "bg-readonly align-top" : "align-top"} key={month.id}>
                      <td className="border-b border-border px-3 py-2 font-semibold">
                        <div className="flex items-center gap-2">
                          <span>{month.monthKey}</span>
                          {highlighted ? (
                            <span className="rounded-sm bg-brand px-2 py-1 text-xs font-semibold text-white">
                              {t("masters.operatingMonths.selectedBasis")}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="border-b border-border px-3 py-2">{month.startDate}</td>
                      <td className="border-b border-border px-3 py-2">{month.endDate}</td>
                      <td className="border-b border-border px-3 py-2">{operatingMonthStatusLabel(locale, month.status)}</td>
                      <td className="border-b border-border px-3 py-2 text-xs text-muted">
                        {formatDateTime(locale, month.createdAt, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" })}
                      </td>
                      <td className="border-b border-border px-3 py-2 text-xs text-muted">
                        {formatDateTime(locale, month.updatedAt, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" })}
                      </td>
                      <td className="border-b border-border px-3 py-2">
                        {month.status === "작성중" ? (
                          <StatusChangeForm month={month} />
                        ) : (
                          <span className="text-xs text-muted">{t("masters.operatingMonths.noActionInScope")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
