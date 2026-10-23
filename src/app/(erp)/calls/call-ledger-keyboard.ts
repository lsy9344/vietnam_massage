export const EDITABLE_CALL_FIELDS = [
  "startTime",
  "actualEntryTime",
  "actualEndTime",
  "roomId",
  "courseId",
  "customerMemo",
  "customerId",
  "therapist1Id",
  "therapist2Id",
  "status",
  "discountTypeCode",
  "paymentMethodCode",
  "note",
  "visitRequest",
  "bookingChannelCode",
  "bookerName",
  "bookerHandle",
  "confirmationCode"
] as const;

export type EditableCallField = (typeof EDITABLE_CALL_FIELDS)[number];

/**
 * 저장 상태의 되돌리기(callRowSaveReducer의 cancel): 보내고 있거나 마지막으로 저장된 초안으로 돌아간다.
 * 원장 표의 칸 이동(Tab·Enter·화살표)은 흐름별 목록(티켓 03)의 줄 이동(ledger-flow.ts의 ledgerListKey)으로 바뀌었다.
 */
export function cancelCellDraft<T extends Record<string, unknown>>(currentDraft: T, baselineDraft: T): T {
  void currentDraft;
  return { ...baselineDraft };
}
