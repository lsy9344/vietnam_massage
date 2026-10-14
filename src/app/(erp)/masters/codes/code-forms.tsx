"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { ModalPanel, SidePanel } from "@/components/ui/panel";
import type { CodeType } from "@/modules/masters/code-schema";
import type { CodeItemDto, TimeSlotDto } from "@/modules/masters/code-service";
import {
  createCodeItemAction,
  createTimeSlotAction,
  deactivateCodeItemAction,
  deactivateTimeSlotAction,
  updateCodeItemDisplayNameAction,
  updateCodeItemSortOrderAction,
  updateTimeSlotSortOrderAction,
  updateTimeSlotValueAction,
  type CodeActionState,
  type TimeSlotActionState
} from "@/app/(erp)/masters/codes/actions";
import { SaveRow, TextField } from "@/app/(erp)/masters/master-fields";
import { ActiveStatus, Cell, HeadCell, ImpactNotice, MasterSectionHeading, MasterTable, PanelSection, masterDateTime } from "@/app/(erp)/masters/master-parts";
import { MasterSplit, SelectableRow, useMasterSelection } from "@/app/(erp)/masters/master-workspace";
import { useLocale, useT } from "@/lib/i18n/client";
import { codeLabel } from "@/lib/i18n/codes";
import type { MessageKey } from "@/lib/i18n/types";

type CodeGroup = {
  codeType: CodeType;
  items: CodeItemDto[];
};

const codeTypeLabelKeys: Record<CodeType, MessageKey> = {
  SERVICE_STATUS: "masters.codes.type.SERVICE_STATUS",
  PAYMENT_METHOD: "masters.codes.type.PAYMENT_METHOD",
  DISCOUNT_TYPE: "masters.codes.type.DISCOUNT_TYPE",
  ATTENDANCE_STATUS: "masters.codes.type.ATTENDANCE_STATUS",
  CONFIRMATION: "masters.codes.type.CONFIRMATION"
};

function CodeCreatePanel({ codeType, onCreated }: { codeType: CodeType; onCreated: (id: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CodeActionState, FormData>(async (previous, formData) => {
    const result = await createCodeItemAction(previous, formData);
    if (result?.ok) {
      setOpen(false);
      onCreated(result.data.id);
    }
    return result;
  }, null);
  const typeLabel = t(codeTypeLabelKeys[codeType]);

  return (
    <ModalPanel
      description={t("masters.codes.createDescription", { type: typeLabel })}
      onOpenChange={setOpen}
      open={open}
      title={`${typeLabel} · ${t("masters.codes.addCode")}`}
      trigger={<Button variant="secondary">{t("masters.codes.addCode")}</Button>}
    >
      <form action={formAction} className="grid gap-4">
        <input name="codeType" type="hidden" value={codeType} />
        <TextField hint={t("masters.codes.stableCodeHint")} id={`new-code-${codeType}`} label={t("masters.codes.stableCode")} name="code" placeholder={t("masters.codes.stableCodePlaceholder")} state={state} />
        <TextField id={`new-display-${codeType}`} label={t("masters.common.displayName")} name="displayName" placeholder={t("masters.codes.newDisplayNamePlaceholder")} state={state} />
        <TextField id={`new-sort-${codeType}`} label={t("masters.common.sortOrder")} min={1} name="sortOrder" placeholder="90" state={state} type="number" />
        <SaveRow label={t("masters.codes.addCode")} pending={pending} primary state={state} />
      </form>
    </ModalPanel>
  );
}

function CodeDisplayNameForm({ item }: { item: CodeItemDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<CodeActionState, FormData>(updateCodeItemDisplayNameAction, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="codeItemId" type="hidden" value={item.id} />
      <TextField defaultValue={item.displayName} label={t("masters.common.displayName")} maxLength={60} name="displayName" required state={state} />
      <SaveRow label={t("masters.common.save")} pending={pending} state={state} />
    </form>
  );
}

function CodeSortOrderForm({ item }: { item: CodeItemDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<CodeActionState, FormData>(updateCodeItemSortOrderAction, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="codeItemId" type="hidden" value={item.id} />
      <TextField defaultValue={item.sortOrder} label={t("masters.common.sortOrder")} max={9999} min={1} name="sortOrder" required state={state} type="number" />
      <SaveRow label={t("masters.common.apply")} pending={pending} state={state} />
    </form>
  );
}

function CodeDeactivateForm({ item }: { item: CodeItemDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<CodeActionState, FormData>(deactivateCodeItemAction, null);

  if (!item.isActive) {
    return <p className="text-sm text-muted">{t("masters.common.alreadyInactive")}</p>;
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input name="codeItemId" type="hidden" value={item.id} />
      <p className="text-sm text-muted">{t("masters.codes.deactivateNote")}</p>
      <SaveRow label={t("masters.common.deactivate")} pending={pending} state={state} />
    </form>
  );
}

function CodePanel({ item, onClose }: { item: CodeItemDto; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const screenLabel = codeLabel(locale, item.codeType, item.code, item.isSystemDefault, item.displayName);
  const impact = [t("masters.codes.impact.storedCode")];
  if (item.isSystemDefault) impact.push(t("masters.codes.impact.systemDefaultLabel"));
  impact.push(t("masters.codes.impact.inactive"));

  return (
    <SidePanel onClose={onClose} title={item.displayName}>
      <div className="grid gap-6" key={item.id}>
        <ActiveStatus inactiveNote={t("masters.codes.inactiveNote")} isActive={item.isActive} locale={locale} />
        <ImpactNotice items={impact} locale={locale} />
        <CodeDisplayNameForm item={item} />
        <CodeSortOrderForm item={item} />
        <PanelSection title={t("masters.common.details")}>
          <dl>
            <DetailRow label={t("masters.codes.column.type")} value={t(codeTypeLabelKeys[item.codeType])} />
            <DetailRow label={t("masters.codes.stableCode")} value={<span className="font-mono">{item.code}</span>} />
            <DetailRow label={t("masters.codes.column.screenLabel")} value={screenLabel} />
            <DetailRow label={t("masters.codes.column.systemDefault")} value={item.isSystemDefault ? t("masters.codes.yes") : t("masters.codes.no")} />
            <DetailRow label={t("masters.common.uniqueId")} value={item.id} />
            <DetailRow label={t("masters.common.createdAt")} value={masterDateTime(locale, item.createdAt)} />
            <DetailRow label={t("masters.common.updatedAt")} value={masterDateTime(locale, item.updatedAt)} />
          </dl>
        </PanelSection>
        <PanelSection title={t("masters.common.deactivateTitle")}>
          <CodeDeactivateForm item={item} />
        </PanelSection>
      </div>
    </SidePanel>
  );
}

function TimeSlotCreatePanel({ onCreated }: { onCreated: (id: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<TimeSlotActionState, FormData>(async (previous, formData) => {
    const result = await createTimeSlotAction(previous, formData);
    if (result?.ok) {
      setOpen(false);
      onCreated(result.data.id);
    }
    return result;
  }, null);

  return (
    <ModalPanel
      description={t("masters.codes.slotCreateDescription")}
      onOpenChange={setOpen}
      open={open}
      title={t("masters.codes.addSlot")}
      trigger={<Button variant="secondary">{t("masters.codes.addSlot")}</Button>}
    >
      <form action={formAction} className="grid gap-4">
        <TextField id="new-time-slot-value" label={t("masters.codes.timeSlot")} name="value" placeholder="10:00" state={state} />
        <TextField id="new-time-slot-sort" label={t("masters.common.sortOrder")} min={1} name="sortOrder" placeholder="5" state={state} type="number" />
        <SaveRow label={t("masters.codes.addSlot")} pending={pending} primary state={state} />
      </form>
    </ModalPanel>
  );
}

function TimeSlotValueForm({ slot }: { slot: TimeSlotDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<TimeSlotActionState, FormData>(updateTimeSlotValueAction, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="timeSlotId" type="hidden" value={slot.id} />
      <TextField defaultValue={slot.value} label={t("masters.codes.timeSlot")} name="value" required state={state} />
      <SaveRow label={t("masters.common.save")} pending={pending} state={state} />
    </form>
  );
}

function TimeSlotSortOrderForm({ slot }: { slot: TimeSlotDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<TimeSlotActionState, FormData>(updateTimeSlotSortOrderAction, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="timeSlotId" type="hidden" value={slot.id} />
      <TextField defaultValue={slot.sortOrder} label={t("masters.common.sortOrder")} max={9999} min={1} name="sortOrder" required state={state} type="number" />
      <SaveRow label={t("masters.common.apply")} pending={pending} state={state} />
    </form>
  );
}

function TimeSlotDeactivateForm({ slot }: { slot: TimeSlotDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<TimeSlotActionState, FormData>(deactivateTimeSlotAction, null);

  if (!slot.isActive) {
    return <p className="text-sm text-muted">{t("masters.common.alreadyInactive")}</p>;
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input name="timeSlotId" type="hidden" value={slot.id} />
      <p className="text-sm text-muted">{t("masters.codes.slotDeactivateNote")}</p>
      <SaveRow label={t("masters.common.deactivate")} pending={pending} state={state} />
    </form>
  );
}

function TimeSlotPanel({ slot, onClose }: { slot: TimeSlotDto; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  return (
    <SidePanel onClose={onClose} title={slot.value}>
      <div className="grid gap-6" key={slot.id}>
        <ActiveStatus inactiveNote={t("masters.codes.slotInactiveNote")} isActive={slot.isActive} locale={locale} />
        <ImpactNotice
          items={[t("masters.codes.impact.storedTime"), t("masters.codes.impact.slotOrder"), t("masters.codes.impact.slotInactive")]}
          locale={locale}
        />
        <TimeSlotValueForm slot={slot} />
        <TimeSlotSortOrderForm slot={slot} />
        <PanelSection title={t("masters.common.details")}>
          <dl>
            <DetailRow label={t("masters.common.uniqueId")} value={slot.id} />
            <DetailRow label={t("masters.common.createdAt")} value={masterDateTime(locale, slot.createdAt)} />
            <DetailRow label={t("masters.common.updatedAt")} value={masterDateTime(locale, slot.updatedAt)} />
          </dl>
        </PanelSection>
        <PanelSection title={t("masters.common.deactivateTitle")}>
          <TimeSlotDeactivateForm slot={slot} />
        </PanelSection>
      </div>
    </SidePanel>
  );
}

/**
 * 코드·시간 슬롯: 코드 유형마다의 목록과 시간 슬롯 목록, 고른 항목의 패널 하나.
 * 목록은 안정 코드와 표시명, 그리고 화면에 실제로 보이는 이름(시스템 기본 코드는 언어별 이름)을 나눠 보인다.
 */
export function CodeManager({ codeGroups, timeSlots, initialItem }: { codeGroups: CodeGroup[]; timeSlots: TimeSlotDto[]; initialItem: string | null }) {
  const t = useT();
  const locale = useLocale();
  const { selected, select, panelRef } = useMasterSelection(initialItem);
  const selectedCode = codeGroups.flatMap((group) => group.items).find((item) => item.id === selected) ?? null;
  const selectedSlot = selectedCode ? null : (timeSlots.find((slot) => slot.id === selected) ?? null);
  const panel = selectedCode ? (
    <CodePanel item={selectedCode} onClose={() => select(null)} />
  ) : selectedSlot ? (
    <TimeSlotPanel onClose={() => select(null)} slot={selectedSlot} />
  ) : null;

  return (
    <MasterSplit hint={t("masters.common.panelHint")} panel={panel} panelRef={panelRef}>
      {codeGroups.map((group) => {
        const label = t(codeTypeLabelKeys[group.codeType]);
        const headingId = `code-group-${group.codeType}`;
        return (
          <section aria-labelledby={headingId} className="grid gap-3" key={group.codeType}>
            <MasterSectionHeading
              action={<CodeCreatePanel codeType={group.codeType} onCreated={(id) => select(id)} />}
              count={t("masters.common.count", { count: group.items.length })}
              id={headingId}
              title={label}
            />
            <MasterTable
              head={
                <>
                  <HeadCell>{t("masters.common.displayName")}</HeadCell>
                  <HeadCell>{t("masters.common.activeColumn")}</HeadCell>
                  <HeadCell>{t("masters.codes.stableCode")}</HeadCell>
                  <HeadCell>{t("masters.codes.column.screenLabel")}</HeadCell>
                  <HeadCell numeric>{t("masters.common.sortOrder")}</HeadCell>
                  <HeadCell>{t("masters.codes.column.systemDefault")}</HeadCell>
                </>
              }
              label={label}
              minWidth="min-w-[44rem]"
            >
              {group.items.map((item) => (
                <SelectableRow key={item.id} label={item.displayName} onSelect={(viaKeyboard) => select(item.id, viaKeyboard)} selected={item.id === selected}>
                  <Cell>
                    <ActiveStatus inactiveNote={t("masters.codes.inactiveNote")} isActive={item.isActive} locale={locale} />
                  </Cell>
                  <Cell>
                    <span className="font-mono text-xs text-foreground">{item.code}</span>
                  </Cell>
                  <Cell muted>{codeLabel(locale, group.codeType, item.code, item.isSystemDefault, item.displayName)}</Cell>
                  <Cell numeric>{item.sortOrder}</Cell>
                  <Cell>{item.isSystemDefault ? t("masters.codes.yes") : t("masters.codes.no")}</Cell>
                </SelectableRow>
              ))}
            </MasterTable>
          </section>
        );
      })}

      <section aria-labelledby="time-slot-title" className="grid gap-3">
        <MasterSectionHeading
          action={<TimeSlotCreatePanel onCreated={(id) => select(id)} />}
          count={t("masters.common.count", { count: timeSlots.length })}
          id="time-slot-title"
          title={t("masters.codes.timeSlot")}
        />
        <MasterTable
          head={
            <>
              <HeadCell>{t("masters.codes.timeSlot")}</HeadCell>
              <HeadCell>{t("masters.common.activeColumn")}</HeadCell>
              <HeadCell numeric>{t("masters.common.sortOrder")}</HeadCell>
            </>
          }
          label={t("masters.codes.timeSlot")}
          minWidth="min-w-[28rem]"
        >
          {timeSlots.map((slot) => (
            <SelectableRow key={slot.id} label={slot.value} onSelect={(viaKeyboard) => select(slot.id, viaKeyboard)} selected={slot.id === selected}>
              <Cell>
                <ActiveStatus inactiveNote={t("masters.codes.slotInactiveNote")} isActive={slot.isActive} locale={locale} />
              </Cell>
              <Cell numeric>{slot.sortOrder}</Cell>
            </SelectableRow>
          ))}
        </MasterTable>
      </section>
    </MasterSplit>
  );
}
