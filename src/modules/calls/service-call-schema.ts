import { z } from "zod";

export const assignmentRoles = ["THERAPIST_1", "THERAPIST_2", "EARCARE"] as const;
export type ServiceCallAssignmentRole = (typeof assignmentRoles)[number];

const isoDateMessage = "날짜는 YYYY-MM-DD 형식이어야 합니다.";
const timeMessage = "시간은 HH:mm 형식이어야 합니다.";

function emptyToNull(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

const optionalText = z.preprocess(emptyToNull, z.string().trim().max(500, "500자 이하로 입력하세요.").nullable().optional());
const optionalId = z.preprocess(emptyToNull, z.string().trim().min(1, "선택값이 올바르지 않습니다.").nullable().optional());
const optionalCode = z.preprocess(emptyToNull, z.string().trim().max(40, "코드값이 올바르지 않습니다.").nullable().optional());

export const serviceCallInputSchema = z.object({
  serviceCallId: z.preprocess(emptyToNull, z.string().trim().min(1, "콜 행 ID가 올바르지 않습니다.").nullable().optional()),
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  serviceDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, isoDateMessage),
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, timeMessage),
  roomId: z.string().trim().min(1, "객실을 선택하세요."),
  courseId: z.string().trim().min(1, "코스를 선택하세요."),
  customerMemo: optionalText,
  therapist1Id: optionalId,
  therapist2Id: optionalId,
  earcareEmployeeId: optionalId,
  status: z.string().trim().min(1, "상태를 선택하세요."),
  discountTypeCode: optionalCode,
  paymentMethodCode: optionalCode,
  note: optionalText,
  confirmationCode: optionalCode
});

export type ServiceCallInput = z.infer<typeof serviceCallInputSchema>;
