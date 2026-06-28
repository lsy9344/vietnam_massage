"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
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

function mapActionError(error: unknown, locale: Locale): ActionResult<RoomDto> {
  if (error instanceof RoomDomainError) {
    return {
      ok: false,
      formError: resolveDomainErrorMessage(locale, error.code, error.message),
      domainErrorCode: error.code
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      formError: t(locale, "action.error.noPermission")
    };
  }

  return {
    ok: false,
    formError: t(locale, "action.error.saveFailed")
  };
}

export async function updateRoomDisplayNameAction(
  _previousState: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  const locale = await getLocale();
  const parsed = updateRoomDisplayNameSchema.safeParse({
    roomId: formData.get("roomId"),
    displayName: formData.get("displayName")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: t(locale, "action.error.invalidInput")
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
    return mapActionError(error, locale);
  }
}

export async function updateRoomSortOrderAction(
  _previousState: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  const locale = await getLocale();
  const parsed = updateRoomSortOrderSchema.safeParse({
    roomId: formData.get("roomId"),
    sortOrder: formData.get("sortOrder")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: t(locale, "action.error.invalidInput")
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
    return mapActionError(error, locale);
  }
}

export async function deactivateRoomAction(
  _previousState: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  const locale = await getLocale();
  const parsed = deactivateRoomSchema.safeParse({
    roomId: formData.get("roomId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: t(locale, "action.error.invalidInput")
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
    return mapActionError(error, locale);
  }
}
