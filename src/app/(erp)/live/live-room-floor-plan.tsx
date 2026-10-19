"use client";

import { useRef, useState, type ReactNode } from "react";
import { RoomFloorPlan } from "@/components/domain/room-floor-plan";
import { ModalPanel } from "@/components/ui/panel";
import { useLocale, useT } from "@/lib/i18n/client";
import type { RoomStatusDto } from "@/modules/rooms/dtos";

/**
 * 실시간 화면의 객실 평면도와 방 서랍(.scratch/room-floor-plan/spec.md D3).
 * 방이나 빈방 칩을 누르면 서랍에 그 방의 지금 객실 카드가 뜬다. 카드는 서버가 방마다 그려 cards로 넘기므로
 * 자동 갱신(router.refresh) 뒤에도 열린 서랍이 새 값을 보인다. 그 방이 목록에서 없어지면 서랍을 닫는다.
 */
export function LiveRoomFloorPlan({ statuses, cards }: { statuses: RoomStatusDto[]; cards: Record<string, ReactNode> }) {
  const locale = useLocale();
  const t = useT();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  // 서랍에는 trigger가 없어서, 닫으면 연 자리(방 버튼 또는 빈방 칩)로 직접 포커스를 돌린다.
  const openerRef = useRef<HTMLElement | null>(null);

  const selected = selectedRoomId ? statuses.find((status) => status.roomId === selectedRoomId) : undefined;
  if (selectedRoomId && !selected) setSelectedRoomId(null);

  return (
    <>
      <RoomFloorPlan
        locale={locale}
        onOpenRoom={(roomId, opener) => {
          openerRef.current = opener;
          setSelectedRoomId(roomId);
        }}
        selectedRoomId={selected ? selected.roomId : null}
        statuses={statuses}
      />
      <ModalPanel
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (openerRef.current?.isConnected) openerRef.current.focus();
        }}
        onOpenChange={(open) => {
          if (!open) setSelectedRoomId(null);
        }}
        open={Boolean(selected)}
        title={t("floorPlan.selectedRoom")}
      >
        {selected ? cards[selected.roomId] : null}
      </ModalPanel>
    </>
  );
}
