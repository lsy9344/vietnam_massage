import type { Locale } from "@/lib/i18n/config";
import { t } from "@/lib/i18n";
import type { CodeType } from "@/modules/masters/code-schema";
import type { RoomDisplayStatus } from "@/modules/rooms/dtos";

/**
 * 시스템 기본 코드(isSystemDefault)의 표시 라벨 사전. stable `code`를 key로 한다.
 *
 * - DB의 CodeItem.displayName(한국어)에 의존하지 않는다. seed 재실행 시 displayName이
 *   한국어로 덮어써지는(scripts/seed-master-data.ts) 문제를 우회한다.
 * - 사용자가 만든 custom 코드는 여기에 없으므로 DB displayName을 그대로 쓴다.
 */
const SYSTEM_CODE_LABELS: Record<CodeType, Record<string, Record<Locale, string>>> = {
  SERVICE_STATUS: {
    RESERVED: { ko: "예약", vi: "Đặt trước" },
    IN_USE: { ko: "사용중", vi: "Đang sử dụng" },
    CLEANING: { ko: "청소중", vi: "Đang dọn" },
    VISIT_COMPLETE: { ko: "방문완료", vi: "Hoàn tất" },
    NO_SHOW: { ko: "노쇼", vi: "Không đến" },
    CANCELED: { ko: "취소", vi: "Đã hủy" }
  },
  PAYMENT_METHOD: {
    CASH: { ko: "현금", vi: "Tiền mặt" },
    CARD: { ko: "카드", vi: "Thẻ" },
    BANK_TRANSFER: { ko: "계좌", vi: "Chuyển khoản" },
    OTHER: { ko: "기타", vi: "Khác" }
  },
  DISCOUNT_TYPE: {
    WEEKLY_RETURN: { ko: "일주일내방문", vi: "Quay lại trong tuần" },
    BIRTHDAY: { ko: "생일자", vi: "Sinh nhật" },
    REVIEW: { ko: "후기작성", vi: "Viết đánh giá" }
  },
  ATTENDANCE_STATUS: {
    NORMAL: { ko: "정상", vi: "Bình thường" },
    DAY_OFF: { ko: "휴무", vi: "Ngày nghỉ" },
    LATE: { ko: "지각", vi: "Đi muộn" },
    EARLY_LEAVE: { ko: "조퇴", vi: "Về sớm" },
    ABSENT: { ko: "결근", vi: "Vắng mặt" }
  },
  CONFIRMATION: {
    Y: { ko: "Y", vi: "Y" },
    N: { ko: "N", vi: "N" }
  }
};

/**
 * 코드 표시 라벨을 반환한다.
 * - 시스템 기본 코드: dictionary에서 locale별 라벨.
 * - custom 코드: 사용자가 입력한 DB displayName 그대로.
 * - 둘 다 없으면 코드값 자체로 fallback (빈 문자열 방지).
 */
export function codeLabel(
  locale: Locale,
  codeType: CodeType,
  code: string,
  isSystemDefault: boolean,
  dbDisplayName?: string | null
): string {
  if (isSystemDefault) {
    return SYSTEM_CODE_LABELS[codeType]?.[code]?.[locale] ?? dbDisplayName ?? code;
  }
  return dbDisplayName ?? code;
}

/**
 * RoomDisplayStatus(한국어 stable key)를 화면 라벨로 번역한다.
 * 비교 로직은 여전히 한국어 key를 쓰고, 표시 직전에만 이 함수를 통과시킨다.
 */
export function roomStatusLabel(locale: Locale, status: RoomDisplayStatus): string {
  return t(locale, `roomStatus.${status}`);
}

/**
 * OperatingMonth.status(한국어 stable key)를 화면 라벨로 번역한다.
 * payout/마감 로직은 한국어 key를 그대로 비교하고, 표시 직전에만 번역한다.
 */
export function operatingMonthStatusLabel(locale: Locale, status: string): string {
  if (status === "작성중" || status === "검토중" || status === "마감확정" || status === "잠금") {
    return t(locale, `operatingMonthStatus.${status}`);
  }
  return status;
}
