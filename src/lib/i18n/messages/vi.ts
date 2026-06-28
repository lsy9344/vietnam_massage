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

  // 공통 운영월/조회 컨트롤 (여러 화면 공유)
  "common.operatingMonth": "Tháng vận hành",
  "common.queryDate": "Ngày tra cứu",
  "common.query": "Tra cứu",
  "common.operatingMonthStatusPrefix": "Trạng thái tháng vận hành",
  "common.dateRange": "Khoảng ngày",
  "common.createOperatingMonthFirst": "Vui lòng tạo tháng vận hành trước",
  "common.goToOperatingMonths": "Đi tới quản lý tháng vận hành",
  "common.roomStatusAria": "Tình trạng phòng",
  "common.monthOption": "{monthKey} ({status})",

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

  // 객실 카드 필드 라벨
  "roomCard.field.course": "Gói dịch vụ",
  "roomCard.field.start": "Bắt đầu",
  "roomCard.field.remaining": "Số phút còn lại",
  "roomCard.field.expectedEnd": "Dự kiến kết thúc",
  "roomCard.field.assignee": "Người phụ trách",
  "roomCard.minutes": "{value} phút",

  // 실시간 갱신 컨트롤러
  "roomRefresh.aria": "Trạng thái cập nhật thời gian thực",
  "roomRefresh.refreshing": "Đang cập nhật",
  "roomRefresh.stale": "Cập nhật trễ",
  "roomRefresh.lastUpdated": "Cập nhật gần nhất",
  "roomRefresh.refresh": "Làm mới",

  // ERP empty state (디자인 데모용)
  "emptyState.dataWaiting": "Chờ kết nối dữ liệu",
  "emptyState.statusToken": "Token trạng thái",
  "emptyState.statusRuleTitle": "Quy tắc hiển thị trạng thái phòng/cuộc gọi",
  "emptyState.statusBadgeTokensAria": "Token huy hiệu trạng thái",
  "emptyState.connectionAreaAria": "Khu vực chờ kết nối",
  "emptyState.connectionStatus": "Trạng thái kết nối dữ liệu",
  "emptyState.followUpTitle": "Chờ kết nối chức năng tiếp theo",
  "emptyState.followUpDescription": "Dữ liệu sổ, phòng và đối soát thực tế đang chờ kết nối.",
  "emptyState.loadingExampleAria": "Ví dụ trạng thái tải",

  // 운영월 상태
  "operatingMonthStatus.작성중": "Đang soạn",
  "operatingMonthStatus.검토중": "Đang xem xét",
  "operatingMonthStatus.마감확정": "Đã chốt",
  "operatingMonthStatus.잠금": "Đã khóa",

  // /live /rooms /tv 화면
  // 첫화면(실시간 현황)
  "live.description": "Tra cứu tình trạng phòng và tóm tắt cuộc gọi/doanh thu hôm nay.",
  "live.empty.description": "Màn hình đầu tra cứu tình trạng phòng và tóm tắt cuộc gọi trong khoảng ngày của tháng vận hành.",
  "live.summary.aria": "Tóm tắt trạng thái hôm nay",
  "live.summary.reservationCount": "Số lượt đặt trước",
  "live.summary.inUse": "Đang sử dụng",
  "live.summary.cleaning": "Đang dọn",
  "live.summary.completed": "Hoàn tất",
  "live.summary.noShow": "Không đến",
  "live.summary.canceled": "Đã hủy",
  "live.payment.aria": "Tổng hợp theo phương thức thanh toán",
  "live.kpi.aria": "KPI hôm nay",
  "live.kpi.paymentTotal": "Tổng thanh toán",
  "live.kpi.netSales": "Doanh thu thuần",
  "live.kpi.courseCompleted": "Hoàn tất theo gói dịch vụ",
  "live.warning.excluded": "Thiếu chính sách {policy} ca, thiếu phụ cấp {rate} ca, cần kỹ thuật viên 2 là {second} ca đã bị loại khỏi tổng hợp số tiền/gói dịch vụ.",
  "live.countSuffix": "ca",
  "live.vndSuffix": "VND",
  "live.loading.roomsAria": "Đang tải tình trạng phòng",
  "live.loading.summaryAria": "Đang tải tóm tắt hôm nay",

  // 객실 현황
  "rooms.description.short": "Tra cứu chỉ đọc tình trạng từng phòng và lời hướng dẫn cho phục vụ.",
  "rooms.description.full": "Tra cứu chỉ đọc tình trạng từng phòng, thời gian còn lại, xác nhận kết thúc và lời hướng dẫn cho phục vụ.",
  "rooms.empty.description": "Tình trạng phòng tra cứu tình trạng phòng trong khoảng ngày của tháng vận hành.",
  "rooms.loading.roomsAria": "Đang tải tình trạng phòng",

  // TV 현황판
  "tv.eyebrow": "Tình hình vận hành",
  "tv.eyebrowFull": "Tình hình vận hành · toàn màn hình · chỉ đọc",
  "tv.empty.description": "Vui lòng tạo tháng vận hành trước. Bảng trạng thái TV là màn hình toàn màn hình chỉ đọc.",
  "tv.loading.boardAria": "Đang tải bảng trạng thái TV"
};
