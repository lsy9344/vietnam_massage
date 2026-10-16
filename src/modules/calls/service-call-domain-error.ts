export class ServiceCallDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ServiceCallDomainError";
  }
}

/**
 * 빠른 예약 일행 저장(티켓 02)에서 손님 한 명의 값이 검증에 걸렸다. 원래 오류의 코드와 문장을 그대로 두고,
 * 몇 번째 손님의 어느 칸인지를 더한다. 화면은 그 손님·칸 옆과 요약에 보인다.
 */
export class QuickBookingGuestError extends ServiceCallDomainError {
  constructor(
    cause: ServiceCallDomainError,
    public readonly guestPosition: number,
    public readonly field: "courseId" | "therapist1Id" | "therapist2Id" | "roomId"
  ) {
    super(cause.message, cause.code);
    this.name = "QuickBookingGuestError";
  }
}
