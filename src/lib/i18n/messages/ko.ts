/**
 * 한국어 메시지 카탈로그 = 번역 key의 원천(source of truth).
 *
 * - 이 객체의 key 집합이 곧 `MessageKey` 타입이 된다.
 * - 새 화면 문구는 반드시 여기에 key를 추가한 뒤 사용한다.
 * - 비테스트 src 코드의 신규 한국어 리터럴은 이 파일에서만 허용된다.
 */
export const ko = {
  // 공통 메타데이터
  "app.title": "Vietnam Aesthetic ERP",
  "app.description": "운영 원장, 객실 현황, 정산, 월마감을 위한 ERP 앱 쉘",

  // 앱 shell
  "shell.brand": "Vietnam Aesthetic",
  "shell.title": "ERP 운영",
  "shell.header.eyebrow": "오늘 운영 기준",
  "shell.header.title": "역할별 ERP 업무",
  "shell.menu.aria": "ERP 도메인 메뉴",

  // 언어 전환
  "locale.switch.aria": "화면 언어 전환",

  // 사이드바 그룹
  "nav.group.operations": "운영 현황",
  "nav.group.calls": "콜 원장",
  "nav.group.settlements": "정산",
  "nav.group.closing": "월마감",
  "nav.group.dashboard": "대시보드",
  "nav.group.masters": "마스터 설정",
  "nav.group.audit": "감사 로그",

  // 사이드바 항목
  "nav.item.live": "첫화면 실시간 현황",
  "nav.item.rooms": "객실 현황",
  "nav.item.tv": "TV 현황판",
  "nav.item.calls": "콜/예약 입력 원장",
  "nav.item.settlements": "정산 화면",
  "nav.item.closing": "월마감",
  "nav.item.dashboardToday": "오늘 대시보드",
  "nav.item.dashboardMonthly": "월간 대시보드",
  "nav.item.dashboardReports": "그래프 리포트",
  "nav.item.mastersOperatingMonths": "운영월",
  "nav.item.mastersRooms": "객실",
  "nav.item.mastersCodes": "코드/시간 슬롯",
  "nav.item.mastersEmployees": "직원",
  "nav.item.mastersCourses": "코스/수당/인센",
  "nav.item.mastersSheetMapping": "시트 기능 매핑표",
  "nav.item.audit": "감사 로그",

  // 로그인
  "auth.signIn.eyebrow": "Vietnam Aesthetic ERP",
  "auth.signIn.title": "직원 계정 로그인",
  "auth.signIn.description": "관리자에게 발급받은 이메일 또는 계정 ID로 로그인한다.",
  "auth.signIn.identityLabel": "이메일 또는 계정 ID",
  "auth.signIn.passwordLabel": "비밀번호",
  "auth.signIn.submit": "로그인",
  "auth.error.invalidCredentials": "계정 정보가 올바르지 않거나 사용할 수 없습니다.",

  // 객실 상태 표시 (RoomDisplayStatus 한국어 key → 라벨)
  "roomStatus.사용중": "사용중",
  "roomStatus.종료임박": "종료임박",
  "roomStatus.예약": "예약",
  "roomStatus.청소중": "청소중",
  "roomStatus.종료확인": "종료확인",
  "roomStatus.빈방": "빈방",
  "roomStatus.aria": "상태: {status}",

  // 객실 카드 안내 문구
  "roomCard.guidance.completeCheck": "결제·확인 필요",
  "roomCard.guidance.endingSoon": "곧 종료",
  "roomCard.guidance.empty": "즉시 가능",

  // 운영월 상태 (OperatingMonth.status 한국어 key → 라벨)
  "operatingMonthStatus.작성중": "작성중",
  "operatingMonthStatus.검토중": "검토중",
  "operatingMonthStatus.마감확정": "마감확정",
  "operatingMonthStatus.잠금": "잠금"
} as const;
