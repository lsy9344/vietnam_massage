"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { RoomDto } from "@/modules/masters/room-service";
import {
  deactivateRoomAction,
  updateRoomDisplayNameAction,
  updateRoomSortOrderAction,
  type RoomActionState
} from "@/app/(erp)/masters/rooms/actions";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function InlineError({ state, field }: { state: RoomActionState; field?: string }) {
  if (!state || state.ok) {
    return null;
  }

  const fieldMessages = field ? state.fieldErrors?.[field] : null;
  return (
    <span className="text-xs text-danger">
      {fieldMessages?.map((message) => <span key={message}>{message}</span>)}
      {state.formError ? <span>{state.formError}</span> : null}
    </span>
  );
}

function DisplayNameForm({ room }: { room: RoomDto }) {
  const [state, formAction, pending] = useActionState<RoomActionState, FormData>(updateRoomDisplayNameAction, null);

  return (
    <form action={formAction} className="grid min-w-60 gap-1">
      <input name="roomId" type="hidden" value={room.id} />
      <label className="sr-only" htmlFor={`display-name-${room.id}`}>
        표시명
      </label>
      <div className="flex items-center gap-2">
        <input
          className="h-8 w-40 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
          defaultValue={room.displayName}
          id={`display-name-${room.id}`}
          maxLength={40}
          name="displayName"
          required
        />
        <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="secondary">
          저장
        </Button>
      </div>
      <InlineError field="displayName" state={state} />
    </form>
  );
}

function SortOrderForm({ room }: { room: RoomDto }) {
  const [state, formAction, pending] = useActionState<RoomActionState, FormData>(updateRoomSortOrderAction, null);

  return (
    <form action={formAction} className="grid gap-1">
      <input name="roomId" type="hidden" value={room.id} />
      <label className="sr-only" htmlFor={`sort-order-${room.id}`}>
        정렬 순서
      </label>
      <div className="flex items-center gap-2">
        <input
          className="h-8 w-20 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
          defaultValue={room.sortOrder}
          id={`sort-order-${room.id}`}
          max={9999}
          min={1}
          name="sortOrder"
          required
          type="number"
        />
        <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="secondary">
          적용
        </Button>
      </div>
      <InlineError field="sortOrder" state={state} />
    </form>
  );
}

function DeactivateForm({ room }: { room: RoomDto }) {
  const [state, formAction, pending] = useActionState<RoomActionState, FormData>(deactivateRoomAction, null);

  if (!room.isActive) {
    return <span className="text-xs text-muted">이미 비활성</span>;
  }

  return (
    <form action={formAction} className="grid gap-1">
      <input name="roomId" type="hidden" value={room.id} />
      <Button className="h-8 px-2 text-xs" disabled={pending} type="submit" variant="ghost">
        비활성 처리
      </Button>
      <InlineError state={state} />
    </form>
  );
}

export function RoomManager({ rooms }: { rooms: RoomDto[] }) {
  return (
    <section className="border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">객실 목록</h2>
        <span className="text-xs text-muted">{rooms.length}개 표시</span>
      </div>

      {rooms.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted">등록된 객실이 없다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-readonly text-xs font-semibold text-muted">
              <tr>
                <th className="w-64 border-b border-border px-3 py-2">표시명</th>
                <th className="w-32 border-b border-border px-3 py-2">이관 참조값</th>
                <th className="w-40 border-b border-border px-3 py-2">정렬 순서</th>
                <th className="w-24 border-b border-border px-3 py-2">활성 여부</th>
                <th className="w-44 border-b border-border px-3 py-2">생성 시각</th>
                <th className="w-44 border-b border-border px-3 py-2">수정 시각</th>
                <th className="border-b border-border px-3 py-2">작업</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr className={room.isActive ? "align-top" : "bg-readonly align-top"} key={room.id}>
                  <td className="border-b border-border px-3 py-2">
                    <DisplayNameForm room={room} />
                    <div className="mt-1 text-xs text-muted">고유 ID: {room.id}</div>
                  </td>
                  <td className="border-b border-border px-3 py-2">
                    <span className="text-xs text-muted">{room.migrationReferenceName}</span>
                  </td>
                  <td className="border-b border-border px-3 py-2">
                    <SortOrderForm room={room} />
                  </td>
                  <td className="border-b border-border px-3 py-2">{room.isActive ? "활성" : "비활성"}</td>
                  <td className="border-b border-border px-3 py-2 text-xs text-muted">{formatDateTime(room.createdAt)}</td>
                  <td className="border-b border-border px-3 py-2 text-xs text-muted">{formatDateTime(room.updatedAt)}</td>
                  <td className="border-b border-border px-3 py-2">
                    <DeactivateForm room={room} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
