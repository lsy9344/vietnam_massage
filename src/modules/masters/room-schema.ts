import { z } from "zod";

export const defaultRooms = [
  { displayName: "101 호실", migrationReferenceName: "1번방", sortOrder: 10 },
  { displayName: "102 호실", migrationReferenceName: "2번방", sortOrder: 20 },
  { displayName: "103 호실", migrationReferenceName: "3번방", sortOrder: 30 },
  { displayName: "201 호실", migrationReferenceName: "4번방", sortOrder: 40 },
  { displayName: "202 호실", migrationReferenceName: "5번방", sortOrder: 50 },
  { displayName: "203 호실", migrationReferenceName: "6번방", sortOrder: 60 },
  { displayName: "301 호실", migrationReferenceName: "7번방", sortOrder: 70 },
  { displayName: "302 호실", migrationReferenceName: "8번방", sortOrder: 80 },
  { displayName: "303 호실", migrationReferenceName: "9번방", sortOrder: 90 },
  { displayName: "401 호실", migrationReferenceName: "10번방", sortOrder: 100 },
  { displayName: "402 호실", migrationReferenceName: "11번방", sortOrder: 110 }
] as const;

export const roomIdSchema = z.string().trim().min(1, "객실 ID가 필요합니다.");

export const roomDisplayNameSchema = z
  .string()
  .trim()
  .min(1, "표시명을 입력하세요.")
  .max(40, "표시명은 40자 이하여야 합니다.");

export const roomSortOrderSchema = z.coerce
  .number({ error: "정렬 순서는 숫자여야 합니다." })
  .int("정렬 순서는 정수여야 합니다.")
  .min(1, "정렬 순서는 1 이상이어야 합니다.")
  .max(9999, "정렬 순서는 9999 이하여야 합니다.");

export const updateRoomDisplayNameSchema = z.object({
  roomId: roomIdSchema,
  displayName: roomDisplayNameSchema
});

export const updateRoomSortOrderSchema = z.object({
  roomId: roomIdSchema,
  sortOrder: roomSortOrderSchema
});

export const deactivateRoomSchema = z.object({
  roomId: roomIdSchema
});
