import type { Messages } from "@/lib/i18n/types";

/**
 * 베트남어 메시지 카탈로그.
 *
 * - `Messages` 타입이므로 ko의 모든 key를 반드시 채워야 한다(누락 시 TS 에러).
 * - 초안은 작업지시서 §7 용어집 기반이며, 최종 문구는 원어민/운영자 검수가 필요하다.
 */
export const vi: Messages = {
  // 공통 메타데이터
  "app.title": "Vietnam Aesthetic ERP",
  "app.description": "Vỏ ứng dụng ERP cho sổ vận hành, tình trạng phòng, đối soát và chốt tháng",

  // 앱 shell
  "shell.brand": "Vietnam Aesthetic",
  "shell.title": "Vận hành ERP",
  "shell.header.eyebrow": "Theo ngày vận hành hôm nay",
  "shell.header.title": "Nghiệp vụ ERP theo vai trò",
  "shell.menu.aria": "Menu nghiệp vụ ERP",

  // 언어 전환
  "locale.switch.aria": "Chuyển ngôn ngữ hiển thị",

  // 사이드바 그룹
  "nav.group.operations": "Tình hình vận hành",
  "nav.group.calls": "Sổ cuộc gọi",
  "nav.group.settlements": "Đối soát",
  "nav.group.closing": "Chốt tháng",
  "nav.group.dashboard": "Bảng điều khiển",
  "nav.group.masters": "Thiết lập dữ liệu gốc",
  "nav.group.audit": "Nhật ký kiểm tra",

  // 사이드바 항목
  "nav.item.live": "Trạng thái thời gian thực",
  "nav.item.rooms": "Tình trạng phòng",
  "nav.item.tv": "Bảng trạng thái TV",
  "nav.item.calls": "Sổ nhập cuộc gọi/đặt lịch",
  "nav.item.settlements": "Màn hình đối soát",
  "nav.item.closing": "Chốt tháng",
  "nav.item.dashboardToday": "Bảng điều khiển hôm nay",
  "nav.item.dashboardMonthly": "Bảng điều khiển theo tháng",
  "nav.item.dashboardReports": "Báo cáo biểu đồ",
  "nav.item.mastersOperatingMonths": "Tháng vận hành",
  "nav.item.mastersRooms": "Phòng",
  "nav.item.mastersCodes": "Mã/Khung giờ",
  "nav.item.mastersEmployees": "Nhân viên",
  "nav.item.mastersCourses": "Gói dịch vụ/Phụ cấp/Thưởng",
  "nav.item.mastersSheetMapping": "Bảng ánh xạ chức năng sheet",
  "nav.item.audit": "Nhật ký kiểm tra",

  // 로그인
  "auth.signIn.eyebrow": "Vietnam Aesthetic ERP",
  "auth.signIn.title": "Đăng nhập tài khoản nhân viên",
  "auth.signIn.description": "Đăng nhập bằng email hoặc ID tài khoản do quản trị viên cấp.",
  "auth.signIn.identityLabel": "Email hoặc ID tài khoản",
  "auth.signIn.passwordLabel": "Mật khẩu",
  "auth.signIn.submit": "Đăng nhập",
  "auth.error.invalidCredentials": "Thông tin tài khoản không đúng hoặc không thể sử dụng.",

  // 객실 상태 표시
  "roomStatus.사용중": "Đang sử dụng",
  "roomStatus.종료임박": "Sắp kết thúc",
  "roomStatus.예약": "Đặt trước",
  "roomStatus.청소중": "Đang dọn",
  "roomStatus.종료확인": "Cần xác nhận kết thúc",
  "roomStatus.빈방": "Phòng trống",
  "roomStatus.aria": "Trạng thái: {status}",

  // 객실 카드 안내 문구
  "roomCard.guidance.completeCheck": "Cần thanh toán·xác nhận",
  "roomCard.guidance.endingSoon": "Sắp kết thúc",
  "roomCard.guidance.empty": "Có thể vào ngay",

  // 운영월 상태
  "operatingMonthStatus.작성중": "Đang soạn",
  "operatingMonthStatus.검토중": "Đang xem xét",
  "operatingMonthStatus.마감확정": "Đã chốt",
  "operatingMonthStatus.잠금": "Đã khóa"
};
