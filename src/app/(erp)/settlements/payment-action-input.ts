export function parseTherapistDailySettlementPaymentIsPaid(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("지급완료 상태값이 올바르지 않습니다.");
}
