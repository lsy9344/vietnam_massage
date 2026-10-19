import type { PayoutConfirmationDto } from "@/modules/settlements/payout-confirmation-service";

/**
 * M10: Therapist가 보는 지급 확인 상태는 세 가지뿐이다("확인됨"/"아직"/"관리자 확인 중"). 기존
 * PayoutConfirmationDto는 네 내부 상태(unconfirmed/confirmed/needs_reconfirmation/
 * confirmed_amount_unrecorded)를 구분하지만, 네 번째 상태는 운영월이 작성중·검토중이면 재확인이
 * 필요한 것으로 세고 아니면 확인된 것으로 센다(derivePayoutConfirmationStatus가 이미 그 분기를
 * requiresReconfirmation에 반영해 뒀다) — 그래서 이 함수는 status와 requiresReconfirmation만 보고,
 * 운영월 상태를 다시 보거나 계산식을 새로 만들지 않는다.
 */
export type TherapistPayoutStatus = "confirmed" | "unconfirmed" | "needsReview";

export function therapistPayoutStatusOf(confirmation: Pick<PayoutConfirmationDto, "status" | "requiresReconfirmation">): TherapistPayoutStatus {
  if (confirmation.status === "unconfirmed") return "unconfirmed";
  return confirmation.requiresReconfirmation ? "needsReview" : "confirmed";
}
