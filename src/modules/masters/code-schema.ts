import { z } from "zod";

export const codeTypes = [
  "SERVICE_STATUS",
  "PAYMENT_METHOD",
  "DISCOUNT_TYPE",
  "ATTENDANCE_STATUS",
  "CONFIRMATION"
] as const;

export type CodeType = (typeof codeTypes)[number];

export type DefaultCodeItem = {
  codeType: CodeType;
  code: string;
  displayName: string;
  sortOrder: number;
};

export const defaultCodeItems: DefaultCodeItem[] = [
  { codeType: "SERVICE_STATUS", code: "RESERVED", displayName: "예약", sortOrder: 10 },
  { codeType: "SERVICE_STATUS", code: "IN_USE", displayName: "사용중", sortOrder: 20 },
  { codeType: "SERVICE_STATUS", code: "CLEANING", displayName: "청소중", sortOrder: 30 },
  { codeType: "SERVICE_STATUS", code: "VISIT_COMPLETE", displayName: "방문완료", sortOrder: 40 },
  { codeType: "SERVICE_STATUS", code: "NO_SHOW", displayName: "노쇼", sortOrder: 50 },
  { codeType: "SERVICE_STATUS", code: "CANCELED", displayName: "취소", sortOrder: 60 },
  { codeType: "PAYMENT_METHOD", code: "CASH", displayName: "현금", sortOrder: 10 },
  { codeType: "PAYMENT_METHOD", code: "CARD", displayName: "카드", sortOrder: 20 },
  { codeType: "PAYMENT_METHOD", code: "BANK_TRANSFER", displayName: "계좌", sortOrder: 30 },
  { codeType: "PAYMENT_METHOD", code: "OTHER", displayName: "기타", sortOrder: 40 },
  { codeType: "DISCOUNT_TYPE", code: "WEEKLY_RETURN", displayName: "일주일내방문", sortOrder: 10 },
  { codeType: "DISCOUNT_TYPE", code: "BIRTHDAY", displayName: "생일자", sortOrder: 20 },
  { codeType: "DISCOUNT_TYPE", code: "REVIEW", displayName: "후기작성", sortOrder: 30 },
  { codeType: "ATTENDANCE_STATUS", code: "NORMAL", displayName: "정상", sortOrder: 10 },
  { codeType: "ATTENDANCE_STATUS", code: "DAY_OFF", displayName: "휴무", sortOrder: 20 },
  { codeType: "ATTENDANCE_STATUS", code: "LATE", displayName: "지각", sortOrder: 30 },
  { codeType: "ATTENDANCE_STATUS", code: "EARLY_LEAVE", displayName: "조퇴", sortOrder: 40 },
  { codeType: "ATTENDANCE_STATUS", code: "ABSENT", displayName: "결근", sortOrder: 50 },
  { codeType: "CONFIRMATION", code: "Y", displayName: "Y", sortOrder: 10 },
  { codeType: "CONFIRMATION", code: "N", displayName: "N", sortOrder: 20 }
];

export const defaultTimeSlots = [
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
  "23:30",
  "00:00",
  "00:30",
  "01:00"
].map((value, index) => ({ value, sortOrder: (index + 1) * 10 }));

export const codeTypeSchema = z.enum(codeTypes, { error: "코드 유형이 올바르지 않습니다." });

export const codeItemIdSchema = z.string().trim().min(1, "코드 ID가 필요합니다.");
export const timeSlotIdSchema = z.string().trim().min(1, "시간 슬롯 ID가 필요합니다.");

export const codeSchema = z
  .string()
  .trim()
  .min(1, "안정 코드를 입력하세요.")
  .max(60, "안정 코드는 60자 이하여야 합니다.")
  .regex(/^[A-Z0-9_]+$/, "안정 코드는 영문 대문자, 숫자, 밑줄만 사용할 수 있습니다.");

export const codeDisplayNameSchema = z
  .string()
  .trim()
  .min(1, "표시명을 입력하세요.")
  .max(60, "표시명은 60자 이하여야 합니다.");

export const sortOrderSchema = z.coerce
  .number({ error: "정렬 순서는 숫자여야 합니다." })
  .int("정렬 순서는 정수여야 합니다.")
  .min(1, "정렬 순서는 1 이상이어야 합니다.")
  .max(9999, "정렬 순서는 9999 이하여야 합니다.");

export const timeSlotValueSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간 슬롯은 HH:mm 형식이어야 합니다.");

export const createCodeItemSchema = z.object({
  codeType: codeTypeSchema,
  code: codeSchema,
  displayName: codeDisplayNameSchema,
  sortOrder: sortOrderSchema
});

export const updateCodeItemDisplayNameSchema = z.object({
  codeItemId: codeItemIdSchema,
  displayName: codeDisplayNameSchema
});

export const updateCodeItemSortOrderSchema = z.object({
  codeItemId: codeItemIdSchema,
  sortOrder: sortOrderSchema
});

export const deactivateCodeItemSchema = z.object({
  codeItemId: codeItemIdSchema
});

export const createTimeSlotSchema = z.object({
  value: timeSlotValueSchema,
  sortOrder: sortOrderSchema
});

export const updateTimeSlotValueSchema = z.object({
  timeSlotId: timeSlotIdSchema,
  value: timeSlotValueSchema
});

export const updateTimeSlotSortOrderSchema = z.object({
  timeSlotId: timeSlotIdSchema,
  sortOrder: sortOrderSchema
});

export const deactivateTimeSlotSchema = z.object({
  timeSlotId: timeSlotIdSchema
});
