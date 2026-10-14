"use client";

import { useActionState } from "react";
import { DetailRow } from "@/components/ui/detail-row";
import { SidePanel } from "@/components/ui/panel";
import type { RoomDto } from "@/modules/masters/room-service";
import {
  deactivateRoomAction,
  updateRoomDisplayNameAction,
  updateRoomSortOrderAction,
  type RoomActionState
} from "@/app/(erp)/masters/rooms/actions";
import { SaveRow, TextField } from "@/app/(erp)/masters/master-fields";
import { ActiveStatus, Cell, HeadCell, ImpactNotice, MasterSectionHeading, MasterTable, PanelSection, masterDateTime } from "@/app/(erp)/masters/master-parts";
import { MasterSplit, SelectableRow, useMasterSelection } from "@/app/(erp)/masters/master-workspace";
import { useLocale, useT } from "@/lib/i18n/client";

function DisplayNameForm({ room }: { room: RoomDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<RoomActionState, FormData>(updateRoomDisplayNameAction, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="roomId" type="hidden" value={room.id} />
      <TextField defaultValue={room.displayName} label={t("masters.common.displayName")} maxLength={40} name="displayName" required state={state} />
      <SaveRow label={t("masters.common.save")} pending={pending} state={state} />
    </form>
  );
}

function SortOrderForm({ room }: { room: RoomDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<RoomActionState, FormData>(updateRoomSortOrderAction, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="roomId" type="hidden" value={room.id} />
      <TextField defaultValue={room.sortOrder} label={t("masters.common.sortOrder")} max={9999} min={1} name="sortOrder" required state={state} type="number" />
      <SaveRow label={t("masters.common.apply")} pending={pending} state={state} />
    </form>
  );
}

function DeactivateForm({ room }: { room: RoomDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<RoomActionState, FormData>(deactivateRoomAction, null);

  if (!room.isActive) {
    return <p className="text-sm text-muted">{t("masters.common.alreadyInactive")}</p>;
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input name="roomId" type="hidden" value={room.id} />
      <p className="text-sm text-muted">{t("masters.rooms.deactivateNote")}</p>
      <SaveRow label={t("masters.common.deactivate")} pending={pending} state={state} />
    </form>
  );
}

function RoomPanel({ room, onClose }: { room: RoomDto; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  return (
    <SidePanel onClose={onClose} title={room.displayName}>
      <div className="grid gap-6" key={room.id}>
        <ActiveStatus inactiveNote={t("masters.rooms.inactiveNote")} isActive={room.isActive} locale={locale} />
        <ImpactNotice
          items={[t("masters.rooms.impact.displayName"), t("masters.rooms.impact.sortOrder"), t("masters.rooms.impact.inactive")]}
          locale={locale}
        />
        <DisplayNameForm room={room} />
        <SortOrderForm room={room} />
        <PanelSection title={t("masters.common.details")}>
          <dl>
            <DetailRow label={t("masters.common.uniqueId")} value={room.id} />
            <DetailRow label={t("masters.rooms.column.migrationReference")} value={room.migrationReferenceName} />
            <DetailRow label={t("masters.common.createdAt")} value={masterDateTime(locale, room.createdAt)} />
            <DetailRow label={t("masters.common.updatedAt")} value={masterDateTime(locale, room.updatedAt)} />
          </dl>
        </PanelSection>
        <PanelSection title={t("masters.common.deactivateTitle")}>
          <DeactivateForm room={room} />
        </PanelSection>
      </div>
    </SidePanel>
  );
}

/** 객실 마스터: 객실 목록과, 고른 객실의 변경 영향·표시명·정렬 순서·비활성 처리 패널. 객실 추가는 데이터 계약에 없다. */
export function RoomManager({ rooms, initialItem }: { rooms: RoomDto[]; initialItem: string | null }) {
  const t = useT();
  const locale = useLocale();
  const { selected, select, panelRef } = useMasterSelection(initialItem);
  const selectedRoom = rooms.find((room) => room.id === selected) ?? null;

  return (
    <MasterSplit
      hint={t("masters.common.panelHint")}
      panel={selectedRoom ? <RoomPanel onClose={() => select(null)} room={selectedRoom} /> : null}
      panelRef={panelRef}
    >
      <section aria-labelledby="rooms-list-title" className="grid gap-3">
        <MasterSectionHeading count={t("masters.common.count", { count: rooms.length })} id="rooms-list-title" title={t("masters.rooms.listTitle")} />
        {rooms.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong bg-surface px-4 py-6 text-sm text-muted">{t("masters.rooms.empty")}</p>
        ) : (
          <MasterTable
            head={
              <>
                <HeadCell>{t("masters.common.displayName")}</HeadCell>
                <HeadCell>{t("masters.common.activeColumn")}</HeadCell>
                <HeadCell>{t("masters.rooms.column.migrationReference")}</HeadCell>
                <HeadCell numeric>{t("masters.common.sortOrder")}</HeadCell>
              </>
            }
            label={t("masters.rooms.listTitle")}
            minWidth="min-w-[36rem]"
          >
            {rooms.map((room) => (
              <SelectableRow key={room.id} label={room.displayName} onSelect={(viaKeyboard) => select(room.id, viaKeyboard)} selected={room.id === selected}>
                <Cell>
                  <ActiveStatus inactiveNote={t("masters.rooms.inactiveNote")} isActive={room.isActive} locale={locale} />
                </Cell>
                <Cell muted>{room.migrationReferenceName}</Cell>
                <Cell numeric>{room.sortOrder}</Cell>
              </SelectableRow>
            ))}
          </MasterTable>
        )}
      </section>
    </MasterSplit>
  );
}
