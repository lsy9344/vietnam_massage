export type SourceSheetVisibility = "visible" | "hidden";

export type ExpectedSourceSheet = {
  name: string;
  visibility: SourceSheetVisibility;
};

export type SheetFeatureMapping = {
  sourceSheet: string;
  visibility: SourceSheetVisibility;
  workbookEvidence: string[];
  erpSurfaces: string[];
  settings: string[];
  calculationEngines: string[];
  verificationItems: string[];
  preservedRules: string[];
  sourceReferences: string[];
};

export type SheetMappingSummary = {
  totalSheets: number;
  visibleSheets: number;
  hiddenSheets: number;
  missingSheets: string[];
  linkedTargetCount: number;
  verificationItemCount: number;
  preservationRate: number;
};

export const EXPECTED_SOURCE_SHEETS: ExpectedSourceSheet[] = [
  { name: "오늘대시보드", visibility: "visible" },
  { name: "실시간콜입력", visibility: "visible" },
  { name: "웨이터리스트", visibility: "visible" },
  { name: "TV현황판", visibility: "visible" },
  { name: "운영팀근무인센", visibility: "visible" },
  { name: "귀케어일정산", visibility: "visible" },
  { name: "마사지사일정산", visibility: "visible" },
  { name: "월마감", visibility: "visible" },
  { name: "직원DB", visibility: "visible" },
  { name: "TV설정", visibility: "visible" },
  { name: "설정_코스수당", visibility: "visible" },
  { name: "목록", visibility: "hidden" }
];

export const SHEET_FEATURE_MAPPINGS: SheetFeatureMapping[] = [
  {
    sourceSheet: "오늘대시보드",
    visibility: "visible",
    workbookEvidence: [
      "원본 대시보드 sheet는 콜 원장과 정산 결과를 집계해 오늘/월간 운영 KPI를 보여주는 downstream 화면이다."
    ],
    erpSurfaces: ["/dashboard/today", "/dashboard/monthly", "/dashboard/reports"],
    settings: ["운영월 날짜 범위와 대시보드 조회 조건은 OperatingMonth 기준으로 선택한다."],
    calculationEngines: ["src/modules/dashboard/dashboard-query-service.ts"],
    verificationItems: [
      "방문완료 calculated call만 매출, 할인, 코스별 집계에 포함한다.",
      "콜 없음, calculated 완료 콜 없음, snapshot_missing을 0값 성공 그래프로 표시하지 않는다."
    ],
    preservedRules: [
      "오늘 KPI와 월간 KPI는 화면에서 재계산하지 않고 dashboard query DTO를 소비한다.",
      "월마감 확정/잠금 월은 latest snapshot 기준과 현재 재계산 기준을 섞지 않는다."
    ],
    sourceReferences: ["client_erp_specification.md dashboard sections", "_bmad-output/project-context.md Story 6.1-6.4"]
  },
  {
    sourceSheet: "실시간콜입력",
    visibility: "visible",
    workbookEvidence: [
      "A:S 영역은 날짜, 시간, 객실, 코스, 담당자, 상태, 할인, 결제, 확인값 중심의 콜 원장 입력/계산 구조다.",
      "U:X 영역은 일별 지출, 일별 요약, 코스별 요약으로 분리된다.",
      "hidden K/L 계산 column과 3,060 hidden rows는 workbook evidence로 보존한다."
    ],
    erpSurfaces: ["/calls", "src/app/(erp)/calls/editable-call-grid.tsx", "src/app/(erp)/calls/daily-expense-panel.tsx"],
    settings: ["CodeItem 상태/결제수단/할인구분/확인값", "Room.id", "Course.id", "Employee.id", "TimeSlot.value"],
    calculationEngines: [
      "src/modules/calls/service-call-service.ts",
      "DailyExpense",
      "getDailyCallLedgerSummary()",
      "listCompletedServiceCallCalculationsForDate()"
    ],
    verificationItems: [
      "A:S 콜 원장 입력/계산 구조와 U:X 지출/요약 구조를 별도로 검증한다.",
      "방문완료 또는 VISIT_COMPLETE 상태만 결제, 수당, 귀케어 풀, 콜인정 계산에 포함한다.",
      "D코스 마사지사2 필수 오류와 정책/수당 누락 warning은 calculated 완료 콜에서 제외된다."
    ],
    preservedRules: [
      "원본 행/셀 좌표는 검증 근거이며 ERP 저장 키는 service_calls와 service_call_assignments의 stable ID다.",
      "할인 선택은 고정 100,000 VND 할인 규칙으로 계산하되 빈 할인은 null 선택 없음이다."
    ],
    sourceReferences: ["client_erp_specification.md §6.2", "sheet_erp_design.md §2.3", "_bmad-output/project-context.md Story 2.1-2.6"]
  },
  {
    sourceSheet: "웨이터리스트",
    visibility: "visible",
    workbookEvidence: ["객실별 현재 상태, 남은 시간, 종료확인 안내를 웨이터가 조회하는 read-only sheet다."],
    erpSurfaces: ["/rooms", "RoomStatusCard", "RoomStatusRefreshController"],
    settings: ["Room displayName/sortOrder", "CodeItem SERVICE_STATUS"],
    calculationEngines: ["src/modules/rooms/room-status-service.ts", "RoomStatusDto", "ROOM_STATUS_GUIDANCE_TEXT", "listRoomStatuses()"],
    verificationItems: [
      "예약, 사용중, 청소중 활성 상태와 방문완료/노쇼/취소 비점유 상태를 구분한다.",
      "남은 시간이 0분 이하인 사용중 call은 displayStatus만 종료확인으로 표시한다."
    ],
    preservedRules: [
      "/rooms는 콜 원장 입력이나 정산 mutation을 포함하지 않는다.",
      "객실 상태, 남은 시간, 종료확인 안내는 RoomStatusDto와 listRoomStatuses()에서만 온다."
    ],
    sourceReferences: ["_bmad-output/project-context.md Story 3.1, 3.3", "src/modules/rooms/room-status-service.ts"]
  },
  {
    sourceSheet: "TV현황판",
    visibility: "visible",
    workbookEvidence: ["원본 TV board는 객실 상태를 fullscreen 표시하며 입력/수정 affordance가 없는 read-only downstream sheet다."],
    erpSurfaces: ["/tv", "src/app/tv/page.tsx", "RoomStatusCard variant=\"tv\"", "RoomStatusRefreshController variant=\"tv\""],
    settings: ["TV typography contract", "status token/display contract", "CodeItem SERVICE_STATUS"],
    calculationEngines: ["src/modules/rooms/room-status-service.ts", "RoomStatusDto", "listRoomStatuses()"],
    verificationItems: [
      "fullscreen route에 ERP chrome/sidebar/topbar가 없어야 한다.",
      "상태 색상은 텍스트 라벨과 glyph를 함께 제공하고 15초 polling freshness를 표시한다."
    ],
    preservedRules: [
      "/tv와 /rooms는 같은 RoomStatusDto를 사용하며 active call을 화면에서 재계산하지 않는다.",
      "종료확인은 결제/확인 필요 주의 문구와 status token으로 표시한다."
    ],
    sourceReferences: ["_bmad-output/project-context.md Story 3.4-3.5", "src/app/tv/page.tsx"]
  },
  {
    sourceSheet: "운영팀근무인센",
    visibility: "visible",
    workbookEvidence: ["운영팀 근무상태, 일일 콜 기준 인센, 월간 콜 기준 분배 인센을 계산하는 정산 sheet다."],
    erpSurfaces: ["/settlements/operations", "/settlements/operations/monthly"],
    settings: ["OpsDailyIncentiveRule", "OpsMonthlyIncentiveRule", "ATTENDANCE_STATUS code"],
    calculationEngines: [
      "src/modules/settlements/ops-attendance-service.ts",
      "src/modules/settlements/ops-daily-incentive-service.ts",
      "src/modules/settlements/ops-monthly-incentive-service.ts"
    ],
    verificationItems: [
      "정상 근무자만 일일 30/40/50콜 인센 대상이다.",
      "월 1000/1100/1200/1300/1400/1500콜 기준 분배율과 방문완료 콜인정 기준을 검증한다."
    ],
    preservedRules: [
      "콜인정은 방문완료 calculated call 기준이며 예약/사용중/청소중/노쇼/취소는 제외한다.",
      "운영팀 인센 정책은 effective month range로 관리하고 확정 월마감 snapshot을 자동 재계산하지 않는다."
    ],
    sourceReferences: ["client_erp_specification.md §8", "_bmad-output/project-context.md Story 4.5-4.6"]
  },
  {
    sourceSheet: "귀케어일정산",
    visibility: "visible",
    workbookEvidence: ["B코스 귀케어 pool과 근무상태별 N분의1 일일정산을 계산하는 settlement sheet다."],
    erpSurfaces: ["/settlements/earcare"],
    settings: ["ATTENDANCE_STATUS code", "Employee employeeGroup=EARCARE", "CoursePolicy.earcarePoolAmount"],
    calculationEngines: [
      "src/modules/settlements/earcare-attendance-service.ts",
      "src/modules/settlements/earcare-daily-settlement-service.ts"
    ],
    verificationItems: [
      "B코스 귀케어 pool은 방문완료 calculated call 기준으로만 집계한다.",
      "정상 근무자 N분의1과 정상 근무자 0명 처리 상태를 검증한다."
    ],
    preservedRules: [
      "귀케어 담당자는 Employee.id stable key로 저장하고 표시명 문자열로 정산하지 않는다.",
      "귀케어 근무상태 입력은 월마감 잠금 guard 대상이다."
    ],
    sourceReferences: ["sheet_erp_design.md hidden rows evidence", "_bmad-output/project-context.md Story 4.3-4.4"]
  },
  {
    sourceSheet: "마사지사일정산",
    visibility: "visible",
    workbookEvidence: ["마사지사1/마사지사2 담당콜, 코스별 수당, 출퇴근/만근 정보를 일별로 대조하는 settlement sheet다."],
    erpSurfaces: ["/settlements", "therapist daily settlement views"],
    settings: ["Employee employeeGroup=THERAPIST", "TherapistCourseRate", "CoursePolicy"],
    calculationEngines: ["src/modules/settlements/therapist-daily-settlement-service.ts"],
    verificationItems: [
      "마사지사1과 마사지사2 assignment role별 담당콜을 분리해 계산한다.",
      "코스별 수당은 방문완료 calculated call과 TherapistCourseRate 기준으로 검증한다."
    ],
    preservedRules: [
      "마사지사 표시명 대신 Employee.id와 staffCode stable key를 정산 reference로 사용한다.",
      "정책 누락은 조용히 0으로 계산하지 않고 warning/not-found evidence로 노출한다."
    ],
    sourceReferences: ["_bmad-output/project-context.md Story 4.2", "src/modules/settlements/therapist-daily-settlement-service.ts"]
  },
  {
    sourceSheet: "월마감",
    visibility: "visible",
    workbookEvidence: ["월 단위 최종 매출, 지급, 인센, 스냅샷 확정 결과를 보존하는 closing sheet다."],
    erpSurfaces: ["/closing"],
    settings: ["OperatingMonth status", "MonthlyClosing closeVersion"],
    calculationEngines: [
      "src/modules/closing/monthly-closing-preview-service.ts",
      "src/modules/closing/monthly-closing-service.ts",
      "src/modules/closing/month-lock-guard.ts"
    ],
    verificationItems: [
      "미리보기, 검토중, 마감확정, 잠금, 재오픈 전이와 versioned snapshot을 검증한다.",
      "최종 지급은 방문완료 기준 집계와 정산 결과를 포함하고 확정 snapshot 이후 자동 재계산하지 않는다."
    ],
    preservedRules: [
      "마감확정/잠금 월의 지급 영향 데이터 write는 server-side guard에서 차단한다.",
      "재오픈은 이전 snapshot을 보존하고 새 closeVersion을 생성한다."
    ],
    sourceReferences: ["_bmad-output/project-context.md Story 5.1-5.6", "src/modules/closing/README.md"]
  },
  {
    sourceSheet: "직원DB",
    visibility: "visible",
    workbookEvidence: ["운영팀, 귀케어팀, 마사지사, 계정 연결 정보를 담는 master sheet다."],
    erpSurfaces: ["/masters/employees"],
    settings: ["Employee", "UserAccount", "employeeGroup", "staffCode", "role"],
    calculationEngines: ["src/modules/masters/employee-service.ts", "src/modules/masters/account-service.ts"],
    verificationItems: [
      "Employee와 UserAccount를 optional unique employeeId로 분리한다.",
      "퇴사/휴직 상태와 선택 목록 비활성 여부를 구분한다."
    ],
    preservedRules: [
      "Employee.id와 staffCode stable key를 사용하고 직원명/계정 ID/Excel 행 번호를 downstream 저장 키로 쓰지 않는다.",
      "직원 비활성은 physical delete가 아니라 isActive=false다."
    ],
    sourceReferences: ["docs/modules/masters.md", "_bmad-output/project-context.md Story 1.7"]
  },
  {
    sourceSheet: "TV설정",
    visibility: "visible",
    workbookEvidence: ["객실/방번호, TV 표시 상태값, 시간 슬롯과 표시 설정의 원천 sheet다."],
    erpSurfaces: ["/masters/rooms", "/masters/codes", "/tv", "/rooms"],
    settings: ["Room", "CodeItem SERVICE_STATUS", "TimeSlot", "status badge tokens"],
    calculationEngines: ["src/modules/masters/room-service.ts", "src/modules/masters/code-service.ts", "StatusBadge"],
    verificationItems: [
      "11개 객실 표시명과 sortOrder, status display values, time slot 기본값을 검증한다.",
      "상태는 색상만이 아니라 glyph와 텍스트 라벨로 전달한다."
    ],
    preservedRules: [
      "Room.id stable key를 사용하고 1번방 같은 숨김 시트 참조값은 migrationReferenceName으로만 보존한다.",
      "status color token은 객실/콜 상태 의미에만 사용한다."
    ],
    sourceReferences: ["_bmad-output/project-context.md Story 1.5, 1.6, 3.5", "src/components/domain/status-badge.tsx"]
  },
  {
    sourceSheet: "설정_코스수당",
    visibility: "visible",
    workbookEvidence: ["운영월, A~E 코스 정책, 마사지사별 수당, 운영팀 인센 정책의 원천 설정 sheet다."],
    erpSurfaces: ["/masters/operating-months", "/masters/courses"],
    settings: [
      "OperatingMonth",
      "Course",
      "CoursePolicy",
      "TherapistCourseRate",
      "OpsDailyIncentiveRule",
      "OpsMonthlyIncentiveRule"
    ],
    calculationEngines: ["src/modules/masters/course-service.ts", "src/modules/masters/operating-month-service.ts"],
    verificationItems: [
      "A~E 코스 가격, 시간, 귀케어 pool, D코스 마사지사2 필수 여부를 검증한다.",
      "수당/인센 정책은 effective month range overlap 없이 관리한다."
    ],
    preservedRules: [
      "Course.id stable key와 Course.code A~E reference를 사용하고 코스명 문자열로 계산하지 않는다.",
      "확정된 과거 월마감 snapshot은 현재/미래 정책 변경으로 흔들리지 않는다."
    ],
    sourceReferences: ["docs/modules/masters.md", "_bmad-output/project-context.md Story 1.8"]
  },
  {
    sourceSheet: "목록",
    visibility: "hidden",
    workbookEvidence: [
      "숨김 sheet 목록은 A1:I51 range로 dropdown/reference values를 제공한다.",
      "원본 검증은 hidden sheet를 visible sheet와 동일하게 포함해야 한다."
    ],
    erpSurfaces: ["/masters/codes", "/masters/rooms", "/masters/courses", "/masters/employees"],
    settings: [
      "SERVICE_STATUS: 예약, 사용중, 청소중, 방문완료, 노쇼, 취소",
      "PAYMENT_METHOD: 현금, 카드, 계좌, 기타",
      "DISCOUNT_TYPE: 일주일내방문, 생일자, 후기작성",
      "ATTENDANCE_STATUS: 정상, 휴무, 지각, 조퇴, 결근",
      "CONFIRMATION: Y, N, null 선택 없음",
      "TimeSlot: ERP 기본 입력 11:00~01:00 29개; workbook named range 31개 차이는 검증 근거로 기록",
      "Room.id, Employee.id, Course.id stable key dropdown mapping"
    ],
    calculationEngines: ["src/modules/masters/code-service.ts", "src/modules/masters/room-service.ts", "src/modules/masters/course-service.ts"],
    verificationItems: [
      "숨김 목록 omission은 검증 실패다.",
      "상태, 결제수단, 할인구분, 확인값, 근무상태, 시간 슬롯, 객실, 코스, 마사지사, 귀케어 담당 dropdown mapping을 모두 검증한다.",
      "할인구분 선택은 고정 100,000 VND 할인 규칙과 연결한다."
    ],
    preservedRules: [
      "표시명 dropdown 값은 사용자 입력 보조값이고 downstream 저장은 Room.id, Employee.id, Course.id, CodeItem.id 또는 codeType + code, TimeSlot.value/sortOrder stable key다.",
      "빈 할인/확인값은 code row가 아니라 null 선택 없음으로 구분한다."
    ],
    sourceReferences: ["sheet_erp_design.md §2 hidden 목록", "_bmad-output/project-context.md Story 1.6"]
  }
];

export function getSheetMappingSummary(mappings: SheetFeatureMapping[] = SHEET_FEATURE_MAPPINGS): SheetMappingSummary {
  const mappedNames = new Set(mappings.map((mapping) => mapping.sourceSheet));
  const missingSheets = EXPECTED_SOURCE_SHEETS.map((sheet) => sheet.name).filter((sheetName) => !mappedNames.has(sheetName));
  const linkedTargetCount = mappings.reduce(
    (sum, mapping) => sum + mapping.erpSurfaces.length + mapping.settings.length + mapping.calculationEngines.length,
    0
  );
  const verificationItemCount = mappings.reduce((sum, mapping) => sum + mapping.verificationItems.length, 0);
  const coveredSheets = EXPECTED_SOURCE_SHEETS.length - missingSheets.length;

  return {
    totalSheets: EXPECTED_SOURCE_SHEETS.length,
    visibleSheets: EXPECTED_SOURCE_SHEETS.filter((sheet) => sheet.visibility === "visible").length,
    hiddenSheets: EXPECTED_SOURCE_SHEETS.filter((sheet) => sheet.visibility === "hidden").length,
    missingSheets,
    linkedTargetCount,
    verificationItemCount,
    preservationRate: Math.round((coveredSheets / EXPECTED_SOURCE_SHEETS.length) * 100)
  };
}
