import { type Locale } from "@/lib/i18n/config";

/**
 * 도메인 에러 code → locale별 사용자 표시 메시지.
 *
 * 정책(Phase E, 사용자 결정 "핵심 사용자 입력 에러만 번역"):
 * - 서비스/스키마는 여전히 한국어 메시지로 throw한다(ko fallback, 기존 테스트/검증 유지).
 * - 운영자가 폼에서 자주 마주치는 "사용자 입력/선택" 계열 code만 vi 번역을 둔다.
 * - 여기에 없는 code(내부/정산 전용 등)는 한국어 원문(fallback)을 그대로 보여준다.
 * - 도메인 에러의 stable `code`는 절대 바꾸지 않는다. 표시 직전에만 이 맵을 적용한다.
 */
const DOMAIN_ERROR_VI: Record<string, string> = {
  // 운영월/날짜
  OPERATING_MONTH_DATE_OUT_OF_RANGE: "Ngày nằm ngoài phạm vi tháng vận hành.",
  OPERATING_MONTH_LOCKED: "Tháng vận hành đã bị khóa.",
  OPERATING_MONTH_NOT_FOUND: "Không tìm thấy tháng vận hành.",

  // 콜 원장 입력/선택
  ROOM_REQUIRED_FOR_STATUS: "Trạng thái đang sử dụng, đang dọn, hoàn tất phải chọn phòng.",
  ROOM_NOT_ACTIVE: "Vui lòng chọn phòng đang hoạt động.",
  TIME_SLOT_NOT_ACTIVE: "Vui lòng chọn khung giờ đang hoạt động.",
  COURSE_NOT_ACTIVE: "Vui lòng chọn gói dịch vụ đang hoạt động.",
  COURSE_POLICY_NOT_FOUND: "Không có chính sách gói dịch vụ áp dụng cho tháng vận hành đã chọn.",
  REQUIRED_CODE_MISSING: "Vui lòng chọn mã bắt buộc.",
  CODE_NOT_ACTIVE: "Vui lòng chọn giá trị mã đang hoạt động.",
  EMPLOYEE_NOT_ACTIVE_FOR_ROLE: "Vui lòng chọn nhân viên phụ trách đang hoạt động.",
  EMPLOYEE_NOT_ACTIVE: "Vui lòng chọn nhân viên phụ trách đang hoạt động.",
  D_COURSE_SECOND_THERAPIST_REQUIRED: "Gói D cần kỹ thuật viên thứ hai.",
  SERVICE_CALL_NOT_FOUND: "Không tìm thấy dòng sổ cuộc gọi.",

  // 일별 지출
  DAILY_EXPENSE_NOT_FOUND: "Không tìm thấy mục chi phí trong ngày.",
  DAILY_EXPENSE_NOT_ACTIVE: "Không thể sửa mục chi phí đã vô hiệu hóa.",

  // 근태/정산 입력
  INVALID_EARCARE_ATTENDANCE_INPUT: "Ngày làm việc không hợp lệ.",
  THERAPIST_EMPLOYEE_NOT_FOUND: "Không tìm thấy kỹ thuật viên đang hoạt động.",
  EARCARE_EMPLOYEE_NOT_FOUND: "Không tìm thấy nhân viên chăm sóc tai đang hoạt động.",
  OPS_EMPLOYEE_NOT_FOUND: "Không tìm thấy nhân viên vận hành đang hoạt động.",
  ATTENDANCE_STATUS_NOT_FOUND: "Vui lòng chọn mã trạng thái làm việc hợp lệ.",

  // 마스터 코드/직원/객실 충돌
  DUPLICATE_CODE: "Mã đã tồn tại trong cùng loại mã.",
  DUPLICATE_CODE_SORT_ORDER: "Thứ tự sắp xếp đã được dùng trong cùng loại mã.",
  DUPLICATE_TIME_SLOT: "Khung giờ đã tồn tại.",
  CODE_ITEM_NOT_FOUND: "Không tìm thấy mục mã.",
  TIME_SLOT_NOT_FOUND: "Không tìm thấy khung giờ.",
  ACCOUNT_ID_ALREADY_LINKED: "ID tài khoản đã được liên kết với nhân viên khác.",
  EMAIL_ALREADY_LINKED: "Email đã được liên kết với nhân viên khác.",
  EMPLOYEE_NOT_FOUND: "Không tìm thấy nhân viên."
};

/**
 * 도메인 에러 메시지를 현재 locale로 해석한다.
 * - vi이고 매핑이 있으면 vi 번역, 아니면 한국어 원문(fallbackKoMessage)을 반환한다.
 */
export function resolveDomainErrorMessage(locale: Locale, code: string | undefined, fallbackKoMessage: string): string {
  if (locale === "vi" && code && DOMAIN_ERROR_VI[code]) {
    return DOMAIN_ERROR_VI[code];
  }
  return fallbackKoMessage;
}

/** 해당 code에 vi 번역이 있는지 여부 (테스트용). */
export function hasDomainErrorTranslation(code: string): boolean {
  return Boolean(DOMAIN_ERROR_VI[code]);
}
