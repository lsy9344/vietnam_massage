export class OperatingMonthPayoutLockError extends Error {
  readonly code = "OPERATING_MONTH_LOCKED";

  constructor(message = "마감확정 또는 잠금 운영월의 지급 영향 데이터는 수정할 수 없습니다.") {
    super(message);
    this.name = "OperatingMonthPayoutLockError";
  }
}

export function isOperatingMonthPayoutLocked(status: string) {
  return status === "마감확정" || status === "잠금";
}

export function assertOperatingMonthPayoutWritable(month: { status: string }, contextMessage?: string) {
  if (isOperatingMonthPayoutLocked(month.status)) {
    throw new OperatingMonthPayoutLockError(contextMessage);
  }
}
