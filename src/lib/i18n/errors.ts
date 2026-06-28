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

/**
 * code가 없는(plain Error) 사용자 표시 메시지를 한국어 원문 자체를 key로 vi 번역한다.
 * 일부 서비스는 stable code 없이 한국어 메시지만 throw하므로, action 경계에서 안전한
 * 화이트리스트(한국어→vi)로 매핑한다. 매핑이 없으면 한국어 원문을 그대로 반환한다.
 */
const KOREAN_MESSAGE_VI: Record<string, string> = {
  // 지급완료(마사지사 일일정산) action 안전 메시지
  "운영월을 선택하세요.": "Vui lòng chọn tháng vận hành.",
  "조회 날짜는 YYYY-MM-DD 형식이어야 합니다.": "Ngày tra cứu phải theo định dạng YYYY-MM-DD.",
  "마사지사를 선택하세요.": "Vui lòng chọn kỹ thuật viên.",
  "처리자를 확인할 수 없습니다.": "Không xác định được người xử lý.",
  "운영월을 찾을 수 없습니다.": "Không tìm thấy tháng vận hành.",
  "마감확정 또는 잠금 운영월의 지급완료 상태는 변경할 수 없습니다.": "Không thể đổi trạng thái đã thanh toán của tháng đã chốt hoặc đã khóa.",
  "운영월 범위를 벗어난 날짜입니다.": "Ngày nằm ngoài phạm vi tháng vận hành.",
  "마사지사를 찾을 수 없습니다.": "Không tìm thấy kỹ thuật viên.",
  "활성 마사지사만 지급완료 상태를 변경할 수 있습니다.": "Chỉ kỹ thuật viên đang hoạt động mới có thể đổi trạng thái đã thanh toán.",
  "해당 날짜에 정산 대상 콜이 없는 마사지사는 지급완료로 표시할 수 없습니다.": "Không thể đánh dấu đã thanh toán cho kỹ thuật viên không có cuộc gọi cần đối soát trong ngày.",
  "지급완료 상태값이 올바르지 않습니다.": "Giá trị trạng thái đã thanh toán không hợp lệ.",
  // 월마감 재오픈 등 Zod field-level 메시지
  "재오픈 사유를 5자 이상 입력하세요.": "Vui lòng nhập lý do mở lại từ 5 ký tự trở lên.",
  // 콜 원장/일별 지출 Zod field-level 메시지 (inline 표시)
  "날짜는 YYYY-MM-DD 형식이어야 합니다.": "Ngày phải theo định dạng YYYY-MM-DD.",
  "시간은 HH:mm 형식이어야 합니다.": "Giờ phải theo định dạng HH:mm.",
  "코스를 선택하세요.": "Vui lòng chọn gói dịch vụ.",
  "상태를 선택하세요.": "Vui lòng chọn trạng thái.",
  "담당자를 선택하세요.": "Vui lòng chọn người phụ trách.",
  "내용을 입력하세요.": "Vui lòng nhập nội dung.",
  "금액은 정수로 입력하세요.": "Vui lòng nhập số tiền là số nguyên.",
  "금액은 0보다 커야 합니다.": "Số tiền phải lớn hơn 0.",
  "금액이 올바르지 않습니다.": "Số tiền không hợp lệ.",
  "500자 이하로 입력하세요.": "Vui lòng nhập tối đa 500 ký tự.",
  "200자 이하로 입력하세요.": "Vui lòng nhập tối đa 200 ký tự.",
  "선택값이 올바르지 않습니다.": "Giá trị lựa chọn không hợp lệ.",
  // 운영팀 월 인센/월마감 보너스 고정 warning (표시 직전 번역; 서비스는 한국어 원문 유지)
  "적용월에 활성 운영팀 월 인센 정책이 없습니다.": "Không có chính sách thưởng tháng nhóm vận hành đang hoạt động trong tháng áp dụng.",
  "활성 운영팀 직원이 없어 전체 월 인센을 미배분으로 남겼습니다.": "Không có nhân viên nhóm vận hành đang hoạt động nên toàn bộ thưởng tháng được để chưa phân bổ.",
  "팀장 대상자가 없어 팀장 몫을 미배분으로 남겼습니다.": "Không có đối tượng trưởng nhóm nên phần của trưởng nhóm được để chưa phân bổ.",
  "팀장 대상자가 2명 이상이라 deterministic order의 첫 번째 직원에게 팀장 몫을 배정했습니다.": "Có từ 2 đối tượng trưởng nhóm trở lên nên phần của trưởng nhóm được phân cho nhân viên đầu tiên theo deterministic order.",
  "카운터팀 대상자가 없어 카운터팀 몫을 미배분으로 남겼습니다.": "Không có đối tượng nhóm quầy nên phần của nhóm quầy được để chưa phân bổ.",
  "웨이터팀 대상자가 없어 웨이터팀 몫을 미배분으로 남겼습니다.": "Không có đối tượng nhóm phục vụ nên phần của nhóm phục vụ được để chưa phân bổ.",
  "Story 4.1 마사지사 출퇴근/만근 인정 source가 없어 만근수당을 계산하지 않았습니다.": "Không có source chấm công/công nhận đủ công của KTV massage Story 4.1 nên không tính phụ cấp đủ công.",
  // 운영팀 월 인센 calculationBasis 고정 문구 (표시 직전 번역)
  "월 인센 지급 조건 미충족": "Chưa đạt điều kiện chi thưởng tháng",
  "팀장 중복 대상 / deterministic order 후순위": "Trùng đối tượng trưởng nhóm / xếp sau theo deterministic order",
  "팀장 대상 아님": "Không thuộc đối tượng trưởng nhóm",
  "미분류 지급": "Chi chưa phân loại",
  "월 인센 팀 분류 대상 아님": "Không thuộc đối tượng phân loại nhóm thưởng tháng"
};

export function resolveKoreanMessage(locale: Locale, koMessage: string): string {
  if (locale === "vi" && KOREAN_MESSAGE_VI[koMessage]) {
    return KOREAN_MESSAGE_VI[koMessage];
  }
  return koMessage;
}
