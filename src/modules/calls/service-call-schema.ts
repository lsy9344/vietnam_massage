import { z } from "zod";

export const assignmentRoles = ["THERAPIST_1", "THERAPIST_2"] as const;
export type ServiceCallAssignmentRole = (typeof assignmentRoles)[number];

const isoDateMessage = "날짜는 YYYY-MM-DD 형식이어야 합니다.";
const timeMessage = "시간은 HH:mm 형식이어야 합니다.";

function emptyToNull(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

const optionalText = z.preprocess(emptyToNull, z.string().trim().max(500, "500자 이하로 입력하세요.").nullable().optional());
const optionalId = z.preprocess(emptyToNull, z.string().trim().min(1, "선택값이 올바르지 않습니다.").nullable().optional());
const optionalCode = z.preprocess(emptyToNull, z.string().trim().max(40, "코드값이 올바르지 않습니다.").nullable().optional());
const optionalTenMinuteTime = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):(00|10|20|30|40|50)$/, "실제입장은 10분 단위이거나 비어 있어야 합니다.")
    .nullable()
    .optional()
);
// 실제 종료(1018 스펙 D1)는 분 단위 시각이다. 10분 단위로 맞추지 않는다.
const optionalClockTime = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "실제 종료는 HH:mm 형식이거나 비어 있어야 합니다.")
    .nullable()
    .optional()
);
// 화면이 마지막으로 받은 행의 updatedAt(toISOString 형식). 기존 행 저장은 이 버전일 때만 갱신된다.
export const savedVersionMessage = "저장 기준 시각이 올바르지 않습니다. 다시 불러온 뒤에 저장하세요.";
const savedVersion = z
  .string({ error: savedVersionMessage })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, savedVersionMessage);
const wholeVndAmount = z.preprocess((value) => {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return value;
}, z.number().int("금액은 정수로 입력하세요.").positive("금액은 0보다 커야 합니다.").finite("금액이 올바르지 않습니다."));

const expenseMethodSchema = z.preprocess(
  (value) => (value === undefined || value === null || value === "" ? "cash" : value),
  z.enum(["cash", "bank"], { error: "수단은 현금 또는 계좌입니다." })
);

export const serviceCallInputSchema = z.object({
  serviceCallId: z.preprocess(emptyToNull, z.string().trim().min(1, "콜 행 ID가 올바르지 않습니다.").nullable().optional()),
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  serviceDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, isoDateMessage),
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, timeMessage),
  actualEntryTime: optionalTenMinuteTime,
  actualEndTime: optionalClockTime,
  roomId: optionalId,
  courseId: z.string().trim().min(1, "코스를 선택하세요."),
  customerMemo: optionalText,
  customerId: optionalId,
  therapist1Id: optionalId,
  therapist2Id: optionalId,
  status: z.string().trim().min(1, "상태를 선택하세요."),
  discountTypeCode: optionalCode,
  paymentMethodCode: optionalCode,
  note: optionalText,
  // 이번 콜의 방문별 요청(F06, 티켓 23). 고객 공통 선호·주의사항(customerInputSchema.preferenceNote)과는 다른 칸이다.
  visitRequest: optionalText,
  // 예약 경로(BOOKING_CHANNEL 코드)와 메신저의 예약자명(1018 스펙 D1).
  bookingChannelCode: optionalCode,
  bookerName: optionalText,
  confirmationCode: optionalCode,
  /** serviceCallId가 있으면(기존 행 저장) 서비스가 필수로 요구한다. */
  expectedUpdatedAt: z.preprocess(emptyToNull, savedVersion.nullable().optional())
});

export const serviceCallAutosaveInputSchema = serviceCallInputSchema.extend({
  serviceCallId: z.string().trim().min(1, "콜 행 ID가 올바르지 않습니다."),
  expectedUpdatedAt: savedVersion
});

export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요.").max(200, "200자 이하로 입력하세요."),
  phone: optionalText,
  memo: optionalText,
  // 고객 공통 선호·주의사항(F06, 티켓 23). 기존 memo(고객 메모)와는 다른 칸이다.
  preferenceNote: optionalText
});

const newRowRequestId = z.string().trim().min(1, "새 행 요청 id가 올바르지 않습니다.").max(100, "새 행 요청 id가 올바르지 않습니다.");

// 원장 새 행은 초안마다 화면이 요청 id를 하나 만든다. 응답을 받지 못해 다시 보낼 때도 같은 id를 보낸다.
export const serviceCallCreateInputSchema = serviceCallInputSchema
  .omit({ serviceCallId: true, expectedUpdatedAt: true })
  .extend({
    requestId: newRowRequestId,
    // 빠른 예약의 새 고객(F01, 티켓 24): 고객 지정 세 갈래(기존 id/새 고객/고객 없음) 중 하나다. 콜과
    // 같은 트랜잭션에서 만들어, 같은 요청 id로 다시 보내도 고객이 두 번 생기지 않는다.
    newCustomer: customerInputSchema.nullable().optional(),
    // 일행에 1명 추가(스펙 D14, 티켓 04): 이미 있는 일행의 id. 비어 있으면 일행이 아닌 콜이다.
    partyId: optionalId
  })
  .refine((data) => !(data.customerId && data.newCustomer), {
    message: "기존 고객과 새 고객을 동시에 지정할 수 없습니다.",
    path: ["newCustomer"]
  });

// 빠른 예약 일행의 손님 한 명(스펙 D10, 티켓 02). 시각·고객·메모는 일행이 공유하고, 코스·Therapist·객실만 손님마다 다르다.
export const quickBookingGuestSchema = z.object({
  courseId: z.string().trim().min(1, "코스를 선택하세요."),
  therapist1Id: optionalId,
  therapist2Id: optionalId,
  roomId: optionalId
});

export const QUICK_BOOKING_PARTY_MAX_GUESTS = 10;

// 빠른 예약 일행 저장(스펙 D10–D12, 티켓 02). 요청 id는 일행 저장 하나에 하나다. 손님은 1번(대표)부터 순서대로다.
export const quickBookingPartyInputSchema = serviceCallInputSchema
  .omit({ serviceCallId: true, expectedUpdatedAt: true, courseId: true, therapist1Id: true, therapist2Id: true, roomId: true })
  .extend({
    requestId: newRowRequestId,
    newCustomer: customerInputSchema.nullable().optional(),
    guests: z
      .array(quickBookingGuestSchema)
      .min(2, "일행은 2명 이상이어야 합니다.")
      .max(QUICK_BOOKING_PARTY_MAX_GUESTS, `일행은 ${QUICK_BOOKING_PARTY_MAX_GUESTS}명까지입니다.`)
  })
  .refine((data) => !(data.customerId && data.newCustomer), {
    message: "기존 고객과 새 고객을 동시에 지정할 수 없습니다.",
    path: ["newCustomer"]
  });

export const dailyExpenseInputSchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  expenseDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, isoDateMessage),
  amount: wholeVndAmount,
  description: z.string().trim().min(1, "내용을 입력하세요.").max(200, "200자 이하로 입력하세요."),
  handledByEmployeeId: z.string().trim().min(1, "담당자를 선택하세요."),
  method: expenseMethodSchema,
  note: optionalText
});

export const dailyExpenseUpdateSchema = dailyExpenseInputSchema.extend({
  dailyExpenseId: z.string().trim().min(1, "지출 항목 ID가 올바르지 않습니다.")
});

export const dailyExpenseDeactivateSchema = z.object({
  dailyExpenseId: z.string().trim().min(1, "지출 항목 ID가 올바르지 않습니다.")
});

export const customerUpdateSchema = customerInputSchema.extend({
  customerId: z.string().trim().min(1, "고객을 선택하세요.")
});

// 고객 연결 정정(F06): 콜 id, 새 고객(연결 해제는 null), 필수 사유, 화면이 마지막으로 받은 updatedAt.
export const serviceCallCustomerLinkCorrectionSchema = z.object({
  serviceCallId: z.string().trim().min(1, "콜 행 ID가 올바르지 않습니다."),
  customerId: z.preprocess(emptyToNull, z.string().trim().min(1, "선택값이 올바르지 않습니다.").nullable()),
  reason: z.string().trim().min(1, "정정 사유를 입력하세요.").max(500, "500자 이하로 입력하세요."),
  expectedUpdatedAt: savedVersion
});

export type ServiceCallInput = z.infer<typeof serviceCallInputSchema>;
export type ServiceCallAutosaveInput = z.infer<typeof serviceCallAutosaveInputSchema>;
export type ServiceCallCreateInput = z.infer<typeof serviceCallCreateInputSchema>;
export type QuickBookingGuestInput = z.infer<typeof quickBookingGuestSchema>;
export type QuickBookingPartyInput = z.infer<typeof quickBookingPartyInputSchema>;
export type DailyExpenseInput = Omit<z.infer<typeof dailyExpenseInputSchema>, "method"> & {
  method?: "cash" | "bank" | "" | null;
};
export type DailyExpenseUpdateInput = Omit<z.infer<typeof dailyExpenseUpdateSchema>, "method"> & {
  method?: "cash" | "bank" | "" | null;
};
export type DailyExpenseDeactivateInput = z.infer<typeof dailyExpenseDeactivateSchema>;
export type CustomerInput = z.infer<typeof customerInputSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
export type ServiceCallCustomerLinkCorrectionInput = z.infer<typeof serviceCallCustomerLinkCorrectionSchema>;
