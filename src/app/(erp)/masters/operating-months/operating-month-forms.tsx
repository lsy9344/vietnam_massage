"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { ModalPanel, SidePanel } from "@/components/ui/panel";
import { StatusIndicator } from "@/components/ui/status-indicator";
import type { OperatingMonthDto } from "@/modules/masters/operating-month-service";
import {
  changeOperatingMonthStatusAction,
  createOperatingMonthAction,
  type OperatingMonthActionState
} from "@/app/(erp)/masters/operating-months/actions";
import { lifecycleSteps, operatingMonthTone } from "@/app/(erp)/masters/operating-months/operating-month-lifecycle";
import { SaveRow, TextField } from "@/app/(erp)/masters/master-fields";
import { Cell, HeadCell, ImpactNotice, MasterSectionHeading, MasterTable, PanelSection, masterDateTime } from "@/app/(erp)/masters/master-parts";
import { MasterSplit, SelectableRow, useMasterSelection, useSelectCreatedItem } from "@/app/(erp)/masters/master-workspace";
import { useLocale, useT } from "@/lib/i18n/client";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import { findScreenRoute, screenHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** 도구줄의 주요 행동: 새 운영월을 만드는 서랍. 만든 운영월을 바로 골라 패널에 연다. */
export function CreateOperatingMonthPanel() {
  const t = useT();
  const selectCreated = useSelectCreatedItem();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<OperatingMonthActionState, FormData>(async (previous, formData) => {
    const result = await createOperatingMonthAction(previous, formData);
    if (result?.ok) {
      setOpen(false);
      selectCreated(result.data.id);
    }
    return result;
  }, null);

  return (
    <ModalPanel
      description={t("masters.operatingMonths.meta.defaultStatus")}
      onOpenChange={setOpen}
      open={open}
      title={t("masters.operatingMonths.create")}
      trigger={<Button>{t("masters.operatingMonths.create")}</Button>}
    >
      <form action={formAction} className="grid gap-4">
        <TextField
          hint={t("masters.operatingMonths.createHelp")}
          label={t("masters.operatingMonths.newMonth")}
          name="monthKey"
          pattern="[0-9]{4}-(0[1-9]|1[0-2])"
          placeholder="YYYY-MM"
          required
          state={state}
        />
        <SaveRow label={t("masters.operatingMonths.create")} pending={pending} primary state={state} />
      </form>
    </ModalPanel>
  );
}

function StatusChangeForm({ month }: { month: OperatingMonthDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<OperatingMonthActionState, FormData>(changeOperatingMonthStatusAction, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="monthKey" type="hidden" value={month.monthKey} />
      <input name="status" type="hidden" value="검토중" />
      <p className="text-sm text-muted">{t("masters.operatingMonths.changeToReviewNote")}</p>
      <SaveRow label={t("masters.operatingMonths.changeToReview")} pending={pending} state={state} />
    </form>
  );
}

function LifecycleSteps({ status }: { status: string }) {
  const t = useT();
  const locale = useLocale();
  return (
    <ol aria-label={t("masters.operatingMonths.lifecycle")} className="flex flex-wrap items-center gap-2">
      {lifecycleSteps(status).map((step, index) => (
        <li
          aria-current={step.state === "current" ? "step" : undefined}
          className={cn(
            "inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-sm",
            step.state === "current" && "bg-brand font-semibold text-brand-foreground",
            step.state === "done" && "border border-border text-foreground",
            step.state === "upcoming" && "border border-dashed border-border-strong text-muted"
          )}
          key={step.status}
        >
          <span aria-hidden="true">{index + 1}</span>
          {operatingMonthStatusLabel(locale, step.status)}
        </li>
      ))}
    </ol>
  );
}

function OperatingMonthPanel({ month, onClose }: { month: OperatingMonthDto; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const closingRoute = findScreenRoute("/closing");

  return (
    <SidePanel onClose={onClose} title={month.monthKey}>
      <div className="grid gap-6" key={month.id}>
        <PanelSection title={t("masters.operatingMonths.lifecycle")}>
          <LifecycleSteps status={month.status} />
        </PanelSection>
        <ImpactNotice
          items={[t("masters.operatingMonths.impact.review"), t("masters.operatingMonths.impact.closing")]}
          locale={locale}
        />
        {month.status === "작성중" ? (
          <StatusChangeForm month={month} />
        ) : (
          <div className="grid justify-items-start gap-3">
            <p className="text-sm text-muted">{t("masters.operatingMonths.nextStepOnClosing")}</p>
            {closingRoute ? (
              <Link className="screen-step" href={screenHref(closingRoute, { operatingMonthId: month.id, date: null })}>
                {t("masters.operatingMonths.openClosing")}
              </Link>
            ) : null}
          </div>
        )}
        <PanelSection title={t("masters.common.details")}>
          <dl>
            <DetailRow label={t("masters.operatingMonths.column.startDate")} value={month.startDate} />
            <DetailRow label={t("masters.operatingMonths.column.endDate")} value={month.endDate} />
            <DetailRow label={t("masters.common.createdAt")} value={masterDateTime(locale, month.createdAt)} />
            <DetailRow label={t("masters.common.updatedAt")} value={masterDateTime(locale, month.updatedAt)} />
          </dl>
        </PanelSection>
      </div>
    </SidePanel>
  );
}

/** 운영월 목록과, 고른 운영월의 단계·변경 영향·검토 시작 패널. 운영월은 지우거나 비활성으로 두지 않는다. */
export function OperatingMonthManager({
  highlightedMonthKey,
  months,
  initialItem
}: {
  highlightedMonthKey: string | null;
  months: OperatingMonthDto[];
  initialItem: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  const { selected, select, panelRef } = useMasterSelection(initialItem);
  const selectedMonth = months.find((month) => month.id === selected) ?? null;

  return (
    <MasterSplit
      hint={t("masters.operatingMonths.panelHint")}
      panel={selectedMonth ? <OperatingMonthPanel month={selectedMonth} onClose={() => select(null)} /> : null}
      panelRef={panelRef}
    >
      <section aria-labelledby="operating-months-title" className="grid gap-3">
        <MasterSectionHeading count={t("masters.common.count", { count: months.length })} id="operating-months-title" title={t("masters.operatingMonths.listTitle")} />
        {months.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong bg-surface px-4 py-6 text-sm text-muted">{t("masters.operatingMonths.empty")}</p>
        ) : (
          <MasterTable
            head={
              <>
                <HeadCell>{t("masters.operatingMonths.column.month")}</HeadCell>
                <HeadCell>{t("masters.operatingMonths.column.startDate")}</HeadCell>
                <HeadCell>{t("masters.operatingMonths.column.endDate")}</HeadCell>
                <HeadCell>{t("masters.operatingMonths.column.currentStatus")}</HeadCell>
              </>
            }
            label={t("masters.operatingMonths.listTitle")}
            minWidth="min-w-[32rem]"
          >
            {months.map((month) => (
              <SelectableRow
                key={month.id}
                label={
                  <span className="inline-flex items-center gap-2">
                    {month.monthKey}
                    {highlightedMonthKey === month.monthKey ? (
                      <span className="inline-flex h-7 items-center rounded-full border border-border bg-surface-float px-2.5 text-xs font-semibold text-foreground">
                        {t("masters.operatingMonths.selectedBasis")}
                      </span>
                    ) : null}
                  </span>
                }
                onSelect={(viaKeyboard) => select(month.id, viaKeyboard)}
                selected={month.id === selected}
              >
                <Cell>{month.startDate}</Cell>
                <Cell>{month.endDate}</Cell>
                <Cell>
                  <StatusIndicator label={operatingMonthStatusLabel(locale, month.status)} tone={operatingMonthTone(month.status)} />
                </Cell>
              </SelectableRow>
            ))}
          </MasterTable>
        )}
      </section>
    </MasterSplit>
  );
}
