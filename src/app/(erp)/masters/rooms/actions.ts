"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import {
  RoomDomainError,
  deactivateRoom,
  updateRoomDisplayName,
  updateRoomSortOrder,
  type RoomDto
} from "@/modules/masters/room-service";
import {
  deactivateRoomSchema,
  updateRoomDisplayNameSchema,
  updateRoomSortOrderSchema
} from "@/modules/masters/room-schema";

export type RoomActionState = ActionResult<RoomDto> | null;

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
  );
}

function mapActionError(error: unknown): ActionResult<RoomDto> {
  if (error instanceof RoomDomainError) {
    return {
      ok: false,
      formError: error.message,
      domainErrorCode: error.code
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      formError: "권한이 없습니다."
    };
  }

  return {
    ok: false,
    formError: "객실 저장 중 오류가 발생했습니다."
  };
}

export async function updateRoomDisplayNameAction(
  _previousState: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  const parsed = updateRoomDisplayNameSchema.safeParse({
    roomId: formData.get("roomId"),
    displayName: formData.get("displayName")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "표시명 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await updateRoomDisplayName({
      actorId: account.id,
      roomId: parsed.data.roomId,
      displayName: parsed.data.displayName
    });
    revalidatePath("/masters/rooms");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function updateRoomSortOrderAction(
  _previousState: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  const parsed = updateRoomSortOrderSchema.safeParse({
    roomId: formData.get("roomId"),
    sortOrder: formData.get("sortOrder")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "정렬 순서 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await updateRoomSortOrder({
      actorId: account.id,
      roomId: parsed.data.roomId,
      sortOrder: parsed.data.sortOrder
    });
    revalidatePath("/masters/rooms");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function deactivateRoomAction(
  _previousState: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  const parsed = deactivateRoomSchema.safeParse({
    roomId: formData.get("roomId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: "비활성 처리 입력값을 확인하세요."
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await deactivateRoom({
      actorId: account.id,
      roomId: parsed.data.roomId
    });
    revalidatePath("/masters/rooms");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error);
  }
}
