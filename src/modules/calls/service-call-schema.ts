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
const wholeVndAmount = z.preprocess((value) => {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return value;
}, z.number().int("금액은 정수로 입력하세요.").positive("금액은 0보다 커야 합니다.").finite("금액이 올바르지 않습니다."));

export const serviceCallInputSchema = z.object({
  serviceCallId: z.preprocess(emptyToNull, z.string().trim().min(1, "콜 행 ID가 올바르지 않습니다.").nullable().optional()),
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  serviceDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, isoDateMessage),
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, timeMessage),
  roomId: optionalId,
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

export const serviceCallAutosaveInputSchema = serviceCallInputSchema.extend({
  serviceCallId: z.string().trim().min(1, "콜 행 ID가 올바르지 않습니다.")
});

export const dailyExpenseInputSchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  expenseDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, isoDateMessage),
  amount: wholeVndAmount,
  description: z.string().trim().min(1, "내용을 입력하세요.").max(200, "200자 이하로 입력하세요."),
  handledByEmployeeId: z.string().trim().min(1, "담당자를 선택하세요."),
  note: optionalText
});

export const dailyExpenseUpdateSchema = dailyExpenseInputSchema.extend({
  dailyExpenseId: z.string().trim().min(1, "지출 항목 ID가 올바르지 않습니다.")
});

export const dailyExpenseDeactivateSchema = z.object({
  dailyExpenseId: z.string().trim().min(1, "지출 항목 ID가 올바르지 않습니다.")
});

export type ServiceCallInput = z.infer<typeof serviceCallInputSchema>;
export type ServiceCallAutosaveInput = z.infer<typeof serviceCallAutosaveInputSchema>;
export type DailyExpenseInput = z.infer<typeof dailyExpenseInputSchema>;
export type DailyExpenseUpdateInput = z.infer<typeof dailyExpenseUpdateSchema>;
export type DailyExpenseDeactivateInput = z.infer<typeof dailyExpenseDeactivateSchema>;
