# 프런트데스크 운영 화면 구조(IA) 1차 조사

조사일/접속일: 2026-10-14. 목적: 콜 원장 기반 ERP의 화면 구조(내비게이션) 재설계를 위해, 스파·살롱 예약 소프트웨어와 레스토랑·호텔 운영 소프트웨어가 "프런트데스크의 하루 업무"를 어떻게 화면으로 나누는지 1차 자료로 확인한다. "왼쪽 사이드바 + 상단 바"라는 일반형 셸을 쓰지 않기로 한 결정의 근거 자료이며, 관련 경쟁사 조사 `docs/research/2026-10-14-vn-nightlife-spa.md`(vn-nightlife.com/spa 시연판 분석)와 중복되지 않게 그 문서를 전제로 쓴다.

## 0. 방법과 한계

원칙은 벤더 공식 자료(헬프센터, 공식 문서, 공식 제품 페이지, 공식 스크린샷·영상)만 근거로 쓰고, 모든 주장에 접속한 정확한 URL을 붙이는 것이다. 공식 자료에 접근하지 못한 경우 추측해서 UI를 적지 않고 "접근 실패"라고 적는다. "문서화됨"과 "추정"을 문장마다 구분한다.

이번 조사는 두 경로를 같이 썼다. ①직접 WebFetch, ②WebSearch/Tavily 검색엔진이 색인한 본문으로 대체 확인(직접 요청은 403/타임아웃/SSL 오류가 났지만 검색엔진은 같은 공식 URL의 본문을 갖고 있던 경우). 아래 표는 ①이 막힌 지점이다. ②로 복구된 항목은 해당 절에 "(검색 색인으로 확인)"이라고 표시했고, 둘 다 실패한 항목만 "접근 실패"로 남겼다.

| 벤더 | 시도한 주소 | ① 직접 접근 | ② 검색엔진 색인 대체 |
| --- | --- | --- | --- |
| Vagaro | `support.vagaro.com` | 403 Forbidden | 성공 — 개별 기사 본문 확보 |
| Boulevard | `support.boulevard.io`의 개별 글, `www.joinblvd.com/platform` | 403/본문 미수신 | 성공 — 카테고리 목록 및 일부 기사 본문 확보 |
| Mindbody | `support.mindbodyonline.com/s/` | JS 로딩 오류("Sorry to interrupt", CSS Error) | 실패 — Salesforce Lightning 커뮤니티라 정적 추출 자체가 안 됨. 완전 접근 실패로 남긴다 |
| Cloudbeds | `support.cloudbeds.com`, `myfrontdesk.cloudbeds.com` | SSL 핸드셰이크 실패 / 403 | 성공 — Dashboard, Daily Operations Guide, Night Audit 기사 본문 확보 |
| OpenTable | `www.opentable.com/restaurant-solutions/products/guest-center/` 등 | 타임아웃 | 성공 — 공식 OpenTable Training 유튜브 채널 영상, 공식 제품 페이지로 대체 확인 |
| Toast | `pos.toasttab.com/products/*` | 402/403(봇 차단) | 성공 — `support.toasttab.com`, `doc.toasttab.com`의 개별 지원 기사로 KDS·Toast Go·마감 절차를 확인 |
| Oracle OPERA Cloud | Front Office / Night Audit 가이드 개별 페이지 | 일부 404 | 성공 — End of Day, Role Manager, 모바일 앱 관련 페이지는 확보. "Front Desk Workspace" 모듈 자체 문서만 끝내 못 찾음 |

이 세션의 WebSearch 호출 한도가 조사 중간에 소진되어(여러 병렬 작업과 공유하는 한도), 후반부는 Tavily 검색/추출로 대체했다. 그 덕에 ①에서 막혔던 벤더 상당수를 ②로 복구할 수 있었지만, Mindbody 헬프센터만은 두 경로 모두 실패해 끝까지 접근하지 못했다.

## 1. 스파·살롱 예약 소프트웨어

### 1.1 Fresha

- **메인 화면과 예약 생성**: 헬프센터 "Create appointments"에 따르면 Day 뷰에서 "시간대를 클릭 → 팝업에서 **Add appointment** 선택 → 새 예약 화면이 열린다"고 되어 있다. 열린 화면 안에 왼쪽 패널(고객: 기존 고객 선택/신규 고객 생성/워크인으로 둠)과 오른쪽 패널(서비스 검색·선택)이 있고 저장 시 캘린더에 반영된다. 서비스별로 담당 직원을 배정하며, 고객이 특정 직원을 요청하면 하트 아이콘으로 표시한다. 메모·동의서·결제 정책은 하단 "Actions"(점 3개) 메뉴에 있다. 이 화면이 사이드 패널/모달/전체 페이지 중 어느 것인지는 헬프센터 문서가 명시하지 않는다. ([Fresha Help Center: Create appointments](https://www.fresha.com/help-center/knowledge-base/calendar/260-create-appointments-1), 2026-10-14 접속)
- **더블부킹은 막히지 않는다**: 같은 문서가 "you will be able to double book appointments within the same time slot"(같은 시간대에 더블부킹이 가능하다)라고 분명히 적는다. 같은 문서는 빈 시간이 없을 때 쓰는 "Next available date", "Check all professionals", "Join the waitlist" 버튼도 설명한다. ([위와 동일](https://www.fresha.com/help-center/knowledge-base/calendar/260-create-appointments-1))
- **가용성 표시와 자원(룸·장비) 예약**: 공식 기능 소개 페이지는 "시스템은 직원 가용성에 맞는 시간만 고객에게 보여 줘 스케줄 오류를 피하게 돕는다"(The system only shows clients available times based on staff availability)고 적는데, 이는 고객이 직접 온라인 예약을 할 때의 동작이다. 전용 헬프센터 문서는 리소스(룸·장비)를 서비스에 연결해 두면 예약 시 자동 배정되고 그 길이만큼 블록된다고 설명하며, **온라인 예약은 "리소스 중복예약이 아예 불가능"**("will never be able to double book a resource")하지만 **매장 내(in-store) 예약은 겹쳐도 알림만 뜨고 직원이 그대로 진행하거나 취소할 수 있다**고 명시한다 ([Manage bookable resources](https://www.fresha.com/help-center/knowledge-base/calendar/101215-create-and-manage-resources)). 즉 Fresha는 사람(직원)의 더블부킹은 허용하고, 리소스와 고객용 온라인 위젯의 충돌만 막는 비대칭 구조다.
- **체크인→시술중→체크아웃**: 공식 자료 범위에서는 정식 상태 목록을 확인하지 못했다. 확인된 동사는 "Complete appointments"(체크아웃 시 완료 처리)와 "no-show 표시"뿐이고, 기능 소개 페이지는 "Streamline your checkout process with fast, seamless payments"라고만 적어 체크아웃을 결제 단계로만 언급한다 ([Fresha: Scheduling features](https://www.fresha.com/for-business/features/scheduling)).
- **중복 고객 — 자동 병합 사례(핵심 발견)**: 신규 고객 생성 시 이름·이메일·전화번호가 기존 고객과 일치하면 알림이 뜨고 "Review and merge"를 눌러야 병합되지만, **온라인 예약 경로에서는 다르다** — "클라이언트가 온라인으로 예약하며 매장 내 프로필과 일치하는 정보를 쓰면 시스템이 자동으로 병합한다"(원문: "the system automatically merges them into one"). 병합 기준은 이메일 또는 전화번호 일치(이름 제외)이고 되돌릴 수 없다 ([Merge client profiles](https://www.fresha.com/help-center/knowledge-base/clients/57-merge-client-profiles), [Create client profiles](https://www.fresha.com/help-center/knowledge-base/clients/320-create-client-profiles)). 조사한 벤더 중 "자동 병합"을 공식 문서로 명시한 유일한 사례다.
- **급여/커미션/리포트 위치**: Reports 섹션에 "Team performance reports"(임금·커미션)가 캘린더와 별도로 있고, "Team Pay"라는 급여 애드온이 커미션·팁·타임시트를 한 "pay run"으로 묶는다(공식 Fresha Academy 영상: [Track commissions](https://www.youtube.com/watch?v=d29diWlJm2o), [Pay your team with Fresha](https://www.youtube.com/watch?v=hbLDWHFr3SU)). 팀원마다 "permission roles"로 접근 수준을 다르게 주고 리포트 공유 범위도 팀원별로 설정한다 ([Manage permission roles](https://www.fresha.com/help-center/knowledge-base/team/100692-manage-permission-roles), [Manage report access for team members](https://www.fresha.com/help-center/knowledge-base/reports/192-manage-report-access-for-team-members)).

### 1.2 Zenoti

- **메인 화면**: 2024년 10월 릴리스 노트가 "새로운 Appointment Book"을 공지하며 "customizable blocks, focus mode, provider filtering"을 추가했다고 적는다. 이 새 디자인은 기본값이 아니다: "This feature is not enabled by default for any customer. Businesses can contact Zenoti to enable this." ([Release notes — October 29, 2024](https://help.zenoti.com/en/release-notes/release-notes/release-notes---october-29,-2024.html)) 제품 페이지는 Appointment Book을 "Your Command Center"로 부르며 "Zenoti automatically checks provider, room, and equipment availability"라고 명시한다 ([Appointment Book & Smart Scheduling](https://www.zenoti.com/platform/appointment-booking)).
- **룸 중복예약 방지(검색 색인으로 확인, 직접 fetch는 본문 없이 네비게이션만 반환)**: 전용 기사가 룸 중복예약 방지를 "Organization Settings > Appointment Book"의 "Prevent double booking of rooms" 옵션으로, 룸 선택 필수화를 "Center Settings > Appointment Book"의 별도 옵션으로 설명한다. 정리·셋업 시간은 "Block Time"으로 넣고, "Appointment Book > View Options"에서 Room View/Employee View를 전환한다 ([Avoid Room Double-Bookings and Scheduling Conflicts](https://help.zenoti.com/en/zenoti-driven-growth/business-accelerators/focus-on-operational-control/avoid-room-double-bookings-and-scheduling-conflicts.html)). 직원(Therapist) 더블부킹을 막는 동등 옵션이 있는지는 끝까지 확인하지 못했다.
- **상태값**: Zenoti Mobile 헬프 문서는 Confirm, Cancel, No Show, Check In, 서비스 블록 안의 Start/Complete(Undo Start로 되돌림)를 정의한다 ([Switch views in Zenoti Mobile](https://help.zenoti.com/en/zenoti-mobile/zenoti-mobile-v2/manage-appointments/switch-views-in-zenoti-mobile.html)). 분석 문서는 리포팅용 상태 묶음도 정의한다 — No-show / Cancelled / "Open and confirmed" / "In progress"(Checked-in+서비스 시작) / Completed(Closed, 단 No-show·취소 수수료가 있으면 완료로 안 침) ([Appointments by status](https://help.zenoti.com/en/analytics/business-snapshot/appointments-by-status.html)).
- **중복 고객 처리(수동 병합, 자동 아님)**: 공식 가이드 "Manage guests"는 병합된 프로필이 사진·예약 이력·결제 이력을 그대로 유지한다고 적고, 병합 버튼이 보이지 않는 두 원인을 설명한다 — 조직(organization) 레벨에서는 병합·삭제 버튼이 의도적으로 숨겨져 있어 센터 레벨 Appointment Book에서 다시 로그인해야 하거나, 병합 권한이 없는 역할이라 관리자가 권한을 줘야 한다는 것이다 ([Manage guests](https://help.zenoti.com/en/appointments/manage-guest-experience/manage-guests.html)).
  - 참고(2차 자료, 공식 헬프센터 아님): Zenoti 자체 데이터팀이 조닝 단위로 돌리는 별도의 대량 자동 병합 프로세스가 있고, 이름+휴대폰 번호 일치 기준이며 카드번호가 저장된 프로필은 제외한다고 설명한다. 이는 매장 직원이 쓰는 수동 병합과는 다른, Zenoti 내부 운영 프로세스다 ([Notion 커뮤니티 문서](https://regisonzenoti.notion.site/Bulk-Zonal-Guest-Merge-Executed-by-Zenoti-64a70ab5cf0a4902a0f0ac5428b814a0)).
- **프런트데스크와 정산의 관계**: 제품 페이지는 "프런트데스크가 손님을 체크인/체크아웃하고, 추가 상품을 권하고, 로열티·멤버십을 추적하고, 결제를 처리한다"고 한 화면의 일로 묶어 설명한다. 또한 "그날의 매출·수납 데이터는 Appointment Book에서 볼 수 있으며, 재무 데이터 접근을 프런트데스크에서 숨길 수 있다"고 적어, 리포트가 일별 캘린더 화면에 노출되되 권한으로 가릴 수 있는 구조임을 보여준다(검색 스니펫 기준, 원문 전체 대조는 못함). 급여 자체는 "Integrated Payroll & Tipping"이라는 별도 제품명으로 소개되어, 일별 예약 화면과 다른 모듈이라는 점이 제품 구조상 명시적이다.

### 1.3 Phorest

- **예약 생성**: 공식 헬프센터는 빈 시간대를 "더블클릭(터치스크린은 더블탭)"하고, 신규 고객이면 **Add Client**, 아니면 이름 검색, 그다음 서비스 카테고리→서비스를 고르는 순서로 설명한다. 같은 캘린더 화면 위에서 여는 흐름이라 별도 페이지 이동이 아니다 ([How do I make an appointment](https://phorest.helpjuice.com/305295-how-do-i-make-an-appointment-gb)). 온라인 예약은 자동 반영되어 "overbooking을 줄이는 데 도움"이 된다고 명시한다.
- **상태 색상**: 다이어리는 예약 상태를 색으로 표현한다 — **빨강**: 체크인 안 된 채 시작 시각이 지남, **노랑**: 체크인 완료, **초록**: 결제까지 완료, **회색**: 종료 시각이 지났는데 체크인도 결제도 안 됨 ([Why have my appointments gone grey?](https://phorest.helpjuice.com/333939-why-have-my-appointments-gone-grey)). 이는 우리 제품의 "종료 확인 필요"(표시 종료를 지났는데 사용중으로 남음)와 개념적으로 겹치는 "방치된 예약" 신호다.
- **일 마감(Cash Up/EOD)**: **Manager** 화면의 **Cash Up** 버튼에서 열리며 당일 수치가 기본값이다. 결제수단별 실제 금액을 입력하면 시스템이 계산한 "Expected"와 비교해 일치하면 초록으로 표시된다. 마감 시 다음 영업일을 위한 "Closing float"를 설정하고 나머지는 "Cash to Bank"로 넘긴다. Phorest Go(모바일)로도 할 수 있고, 수동으로 하지 않으면 자동 Cash Up이 돈다 ([How do I cash up each night (EOD)](https://phorest.helpjuice.com/305364-how-do-i-cash-up-each-night-eod-gb)).
  - 이 마감 흐름은 "그날 번 돈을 맞추는 절차"이지, "끝나지 않은 예약(시술중으로 남은 콜)을 어떻게 할지"를 다루지 않는다. 우리 제품의 ADR 0005(미완료 콜은 확인과 사유를 남겨 예외 마감)에 대응하는 장치는 Phorest 공식 문서에서 확인하지 못했다.
- **수당/커미션 리포트**: **Manager → Reports → Staff** 아래 Staff Commission Overview(직원별 커미션 합계)와 Staff Commission Detail(요약+직원별 상세) 리포트가 있다. 커미션은 "서비스가 결제된 시점이 아니라 수행된 시점" 기준으로 계산되고, 구간을 지정해(예: 주 단위) 돌려야 한다. 티어형 커미션은 "Apply Higher Brackets To Full Amount" 옵션으로 전액에 상위 요율을 적용할 수 있다 ([Staff Commission Overview report](https://phorest.helpjuice.com/305697-staff-commission-overview-report-gb), [Staff Commission Detail report](https://phorest.helpjuice.com/305691-staff-commission-detail-report)).
- **내비게이션 구조**: Cash Up, Reports, Staff 관리가 모두 하나의 **Manager** 영역 아래 있다. 즉 "매일 쓰는 Book(캘린더)"과 "정산·리포트·직원관리를 묶은 Manager"가 최상위에서 나뉜다 ([Manager](https://phorest.helpjuice.com/44078-manager)).

### 1.4 Mindbody (Business)

Mindbody 자체 헬프센터(`support.mindbodyonline.com`)는 직접 WebFetch와 검색엔진 색인 양쪽 모두 실패했다(Salesforce Lightning 커뮤니티 렌더링, 빈 본문 또는 "CSS Error"만 반환). 아래는 Mindbody의 공식 제품 페이지·블로그·교육 카탈로그(같은 벤더가 운영하는 공식 콘텐츠)로 확인한 내용이다.

- **캘린더가 중심 화면**: 공식 교육 카탈로그는 Calendar를 "향후 2주의 모든 클래스·예약·코스를 한눈에 보여주는 스냅샷"이라고 정의한다 ([공식 교육 카탈로그](https://booker.exceedlms.com/student/catalog/list?page=2)).
- **역할별 접근 제한(Front Desk 권한 그룹, 핵심 발견)**: 직원은 권한 그룹에 배정되고, 그룹이 할 수 있는 일을 정한다. 공식 교육 자료는 "Front Desk" 그룹이 활성화된 권한이 적다고 설명하고 ([Staff Permissions 교육](https://booker.exceedlms.com/student/path/401805/activity/360139)), 공식 블로그는 더 직접적으로 "프런트데스크 역할은 예약, 체크인, 결제만 보고 백엔드 설정은 보지 않는다"(원문: "Front desk roles only see booking, check-in, and payments, not behind-the-scenes settings")고 명시한다 ([Customize Mindbody 블로그](https://www.mindbodyonline.com/en-gb/business/education/blog/studios-salons-spas-customize-mindbody)). 이는 "역할마다 보이는 메뉴 자체가 달라진다"를 벤더가 직접 확인해 준 몇 안 되는 사례다.
- **체크인은 별도 디바이스 서피스로도 존재**: 클라이언트는 프런트데스크 태블릿의 "Mindbody Check-In app", 본인 휴대폰의 Mindbody 앱, 또는 바코드·Client ID를 입력하는 "Self Check-In" 화면으로 체크인한다. 세 경로 모두 "프런트데스크 직원의 손을 거치지 않고" 출석을 기록하는 것이 목적이다 ([Scheduling for Classes & Appointments](https://www.mindbodyonline.com/business/scheduling), [Class Check-In App](https://www.mindbodyonline.com/business/class-check-in-app)). 태블릿 키오스크는 잔액 부족 고객이 체크인하면 프런트데스크에 알림을 띄운다. 공식 블로그는 Business 앱의 재설계된 Class Sign-In 화면(카드형 레이아웃, 회원 등급·생일·누락 정보 표시)도 소개한다 ([Business App 블로그](https://www.mindbodyonline.com/education/blog/how-the-mindbody-business-app-benefits-your-staff)).
- **디바이스 분리**: "Business app"은 직원이 자기 휴대폰으로 일정 확인, 체크인 처리, 취소 처리, 결제까지 하는 별도 모바일 앱이다 ([Business App](https://www.mindbodyonline.com/business/business-app), [8 Steps to Get the Most Out of Mindbody](https://www.mindbodyonline.com/business/education/blog/8-steps-to-get-the-most-out-of-the-mindbody-app)). 즉 "프런트데스크 태블릿(체크인 전용 키오스크)" / "직원 휴대폰(Business 앱)" / "풀 데스크톱 소프트웨어"라는 최소 3개의 디바이스별 표면이 공식적으로 구분된다.
- **나머지(가용성 표시, 더블부킹 경고, 룸 배정, 급여/커미션, 마감)**: 공식 헬프센터 접근 실패로 확인하지 못했다.

### 1.5 Vagaro

`support.vagaro.com`은 직접 WebFetch 시 403이었으나, 검색엔진이 색인한 개별 기사 본문은 확보했다.

- **더블부킹이 기본 허용(핵심 발견)**: 헬프센터 기사 제목 자체가 "Double-Book Time Slots on the Calendar"이고, 본문은 "겹치는 예약이 있어도 그 시간대에 더 예약을 추가할 수 있다. 추가할 수 있는 예약 수에 제한이 없다"고 적는다 ([Double-Book Time Slots on the Calendar](https://support.vagaro.com/hc/en-us/articles/204347690-Double-Book-Time-Slots-on-the-Calendar), 검색 색인으로 확인). 공식 제품 업데이트 로그의 "Double-Book Your Resources" 항목도 "한 리소스를 여러 명이 쓰는 다중 고객 예약도 문제없다"고 설명해, 그룹 예약 상황에서는 리소스 더블부킹까지 허용하는 기능을 추가한 것으로 보인다 ([Double-Book Your Resources](https://www.vagaro.com/en-ca/pro/updates/double-book-your-resources)).
- **리소스는 다르게 취급**: "A resource on Vagaro is a bookable item, assigned to appointments to manage availability and **prevent double booking**"라고 명시한다 ([Book a Service Bundle](https://support.vagaro.com/hc/en-us/articles/360038357414-Book-a-Service-Bundle), 검색 색인). Fresha와 마찬가지로 "사람(직원) 시간"은 겹침을 허용하고 "물리적 리소스"만 겹침을 막는 비대칭 구조다.
- **체크인/체크아웃은 리포트로 사후 감사**: "The New Missed Checkouts and Check-ins Report"가 "모든 리포팅 데이터가 정확하도록 돕는다"고 적어, 체크인·체크아웃이 예약마다 기록되는 상태값이고 빠뜨린 건을 사후에 리포트로 잡아낸다는 것을 보여준다 ([Vagaro Pro: Product Updates](https://www.vagaro.com/pro/updates)).
- 급여/커미션, 역할별 화면, 룸 배정 화면 공식 문서는 확보하지 못했다.

### 1.6 Boulevard

`support.boulevard.io` 홈은 직접 fetch 시 403이었으나, 검색엔진이 색인한 카테고리 목록과 일부 기사 본문은 확보했다.

- **헬프센터 카테고리 구성**: Getting Started, Merchant Information, **Boulevard Dashboard**(웹 버전, 153개 글), **Boulevard Professional (iOS & Android apps)**(스태프용 네이티브 모바일 앱, 5개 글), **Boulevard Duo**(매장 내 전용 디바이스 앱으로 추정, 12개 글), **New Reporting Experience**/**Old Reporting Experience**(리포팅이 대시보드와 분리된 별도 카테고리, 신·구 버전 공존, 64/85개 글), Medspa, ePrescribe, Client Self-Booking, Boulevard Marketing, Dispute Resolution Center 등 ([Boulevard Support Center 카테고리 목록](https://support.boulevard.io/en)). 공식 제품 페이지 상단 내비게이션에서도 Reports는 "Grow your business" 묶음, Scheduling은 "Manage more efficiently" 묶음으로 서로 다른 그룹에 있다 ([www.joinblvd.com](https://www.joinblvd.com)).
- **온라인 예약은 선택 기능**: "온라인 예약을 꺼 두고 일정·예약 관리, CRM, 리포팅 용도로만 Boulevard를 쓸 수 있다"고 FAQ가 명시한다 ([General FAQs](https://support.boulevard.io/en/articles/5941334-general-faqs)).
- **고객 중복 — 경고는 하되 자동 병합은 안 함(핵심 발견)**: "Boulevard proactively identifies potential duplicates during the staff client creation process. If a staff member is attempting to add a client that matches the first & last name, email, or phone number of an existing client, they will see a warning." 병합은 별도 화면("Merge Clients")에서 두 프로필을 각각 선택하고, 행 단위로 "어느 쪽 정보를 남길지" 고른 뒤 확인 모달을 거쳐야 하며, **"view clients contact info"와 "merge client profiles" 권한이 모두 있어야" 실행할 수 있다** ([Merging Client Profiles](https://support.boulevard.io/en/articles/5941428-merging-client-profiles)). Fresha의 "온라인 예약은 자동 병합"과 뚜렷이 다르며, Zenoti의 "수동 병합 + 권한 게이트"와 함께 우리 제품의 "자동 병합 금지" 원칙과 가장 가까운 업계 사례다.
- **애드온 서비스**: 애드온 서비스는 반드시 같은 담당자가 기본 서비스와 함께 수행해야 하며, "Add-On Only" 설정을 켜면 단독 예약이 불가능해진다 ([Add-On Services](https://support.boulevard.io/en/articles/6584601-add-on-services)).
- 룸/리소스 배정, 체크인→시술중→체크아웃 상태모델, 급여/커미션 공식 문서는 확보하지 못했다.

## 2. 레스토랑/호스피탈리티 운영 소프트웨어

### 2.1 Toast — FOH/BOH 분리가 명시적 용어로 문서화됨

`pos.toasttab.com`의 제품 마케팅 페이지(KDS, Toast Go)는 402/403을 반환했지만, 지원센터(`support.toasttab.com`)와 플랫폼 가이드(`doc.toasttab.com`)의 개별 지원 기사는 확보했다.

- **지원센터 자체가 "프런트오브하우스" 용어를 쓴다**: "Get started with Toast POS" 카드는 "Learn front-of-house skills"라고 적는다 ([Toast Support Center](https://support.toasttab.com/)).
- **핸드헬드(Toast Go) vs 터미널**: Toast Go 3 설정 기사는 핸드헬드가 "Wi-Fi와 셀룰러를 오가며 주문·결제·영수증 출력"을 하고, 자체 웹브라우저는 지원하지 않으며, 셀프 매니지드 고객은 사전 설치된 앱만 쓸 수 있다고 명시한다. 클라우드 인쇄에는 "같은 네트워크에 터미널이 최소 1대는 온라인 상태"여야 한다는 요건이 있어, 핸드헬드와 고정 터미널이 역할을 분담한다는 것을 보여준다 ([Set Up Toast Go 3](https://support.toasttab.com/article/Set-Up-Toast-Go-3)).
- **KDS는 같은 하드웨어의 "모드 전환"**: Toast는 KDS 전용 기기를 따로 팔기보다 "Toast 기기의 모드를 KDS로 전환"하는 방식을 기본 문서화한다 — 기기 설정에서 Primary Mode를 "Kitchen Display/Expo Screen"으로 바꾸고, "Expediter"(모든 조리대 티켓을 한 화면에 모음) 또는 "Prep Station"(특정 조리대 품목만 표시)으로 지정한다 ([Get Started With the Kitchen Display System](https://support.toasttab.com/en/article/Get-Started-With-the-Kitchen-Display-System)). KDS 개요 문서는 "KDS는 주방(back of house)과 홀(front of house) 사이의 소통을 돕고, Toast POS에서의 변경이 실시간으로 주방 화면에 반영된다"고 **벤더가 직접 이 용어를 쓴다** ([Kitchen display system overview](https://doc.toasttab.com/doc/platformguide/platformKDSOverview.html)). 키친 설정 기사는 "Toast Web > **Front of house** > Order screen setup > UI options" 경로를 적어, "Front of house"가 분리된 앱이 아니라 브라우저 기반 관리 도구(Toast Web) 안의 한 설정 카테고리 이름임을 보여준다 ([Get Started With Kitchen Configuration](https://support.toasttab.com/en/article/Basic-Kitchen-Configuration)).
- **마감 체크리스트 — 두 레이어**:
  1. **Shift Review**(직원 단위, 선택적): 열린 체크 닫기 → (해당 시)현금 팁 신고 → 현금·팁 정산(지급/수령) → (해당 시)현금서랍 닫기 → 클럭아웃 및 영수증 출력. 매니저용은 "직원별 시프트 상태 확인 → 못 끝낸 시프트 완료 처리 → 당기 영업주 내 재오픈 → 이전 영업주는 Toast Web에서 정정"이다 ([Shift Review Checklist](https://support.toasttab.com/en/article/Shift-Review-Checklist-for-Employees-and-Managers?lang=en_US)).
  2. **Close Out Day / Z Report**(영업일 단위, 매니저 전용·선택적): Toast는 기본적으로 **매일 새벽 4시(미 동부 기준)에 영업일을 자동 마감**하고 카드 결제를 자동 캡처하며 남은 클럭인 직원을 자동 클럭아웃한다. "Close Out Day"는 그 전에 미리 열어보는 선택적 매니저 화면이며, "Z Report 인쇄는 영업일을 넘기는 행위가 아니다." 미결제 체크는 자동으로 안 닫힌다(자동 마감/무효화 옵션이 켜진 경우만 예외) ([Close Out Day, Z Report, Auto-Capture](https://support.toasttab.com/article/Close-Out-Day-Z-Report-Auto-Capture)).
  - **현금서랍 마감은 또 다른 독립 기능**: 원문은 "They are separate features"라고 못박는다 — Close Out Day(영업일·체크·클럭인 상태)와 현금서랍 마감(서랍 단위 현금 실사)은 서로 다른 절차이고, 현금 입금은 체크 마감·시프트 리뷰·서랍 마감이 모두 끝난 뒤 "그날의 마지막 현금 작업"이어야 한다. 서랍은 영업일 컷오프(기본 새벽 4시)에도 자동으로 닫힌다 ([Use Cash Drawers](https://support.toasttab.com/en/article/Use-Cash-Drawers-New-Experience?lang=en_US)).
- **권한은 "지금 쓰는 기기"가 아니라 "배정된 Job"을 따른다**: Server/Cashier/Manager 같은 Job마다 기본 권한 세트가 있고 직원 개인에게 추가 오버라이드를 얹을 수 있으며, 복수 Job을 가지면 권한이 합쳐진다. 지원 문서가 명시적으로 짚는 한계: **"지금 클락인한 Job으로 권한을 제한하는 기능은 아직 없다"** — 즉 한 사람이 서버와 매니저 Job을 동시에 갖고 있으면, 그날 서버로만 일하는 중에도 매니저 권한을 그대로 쓸 수 있다. 권한 편집 자체는 Toast Web(백오피스)에서만 가능하다 ([Assign User Access Permissions](https://support.toasttab.com/article/Assigning-User-Access-Permissions), 2026-10-14).

### 2.2 Square

- **KDS는 읽기전용이 아니라 양방향 작업 화면이다**: 공식 Square KDS 페이지는 "allows you to view, track, and fulfill orders via digital tickets in your back of house"라고 적고, 고객 후기를 인용해 "It's great to have that two-way ticket interaction that paper receipts can't offer"라고 강조한다. Expeditor Mode는 "주문 이행과 완료를 총괄"한다. 즉 Square KDS는 상태를 "완료로 표시"하는 등 조작이 가능한 화면이며, 우리 제품의 읽기전용 벽걸이 TV(read_only_viewer)와는 성격이 다르다 ([Square: Kitchen Display System](https://squareup.com/us/en/point-of-sale/restaurants/kitchen-display-system)).
- **디바이스별 하드웨어 라인업과 급여의 분리**: Square for Restaurants 페이지는 Handheld, Terminal, Register, Stand, Kiosk를 별도 하드웨어 제품으로 나열하고, Staff 섹션에 Payroll과 Shifts를 별도 링크로 둔다. 재설계된 "Square Dashboard 앱"은 매니저가 휴대폰으로 실시간 알림, 현금 흐름, 급여·타임카드·스케줄을 관리하는 별도 앱이다 ([Square: Point of Sale for Restaurants](https://squareup.com/us/en/point-of-sale/restaurants)).
- **같은 플로어 플랜 기능도 하드웨어마다 할 수 있는 일이 다르다(헬프센터 직접 열람)**: 인원수만 입력해도(주문 전에) 테이블이 "occupied"로 바뀌고, 대형 파티를 위한 **테이블 병합은 Square Register에서만** 할 수 있으며 **Terminal·Handheld는 병합된 테이블을 보기만** 할 수 있다 — 같은 화면 기능이 "지금 들고 있는 기기"에 따라 편집 가능 범위가 달라지는 구체적 사례다 ([Building your floor plan](https://squareup.com/help/us/en/article/6427-building-your-floor-plan), 2026-10-14).
- **영업일 마감**: "Close of Day"는 Square for Restaurants Plus/Premium 이상에서만 제공되는 매니저 전용 리포트다. 실행 전 선행 조건: 팁 미조정 항목 정리(실행 시 닫힌 체크의 카드 팁이 그대로 정산됨), 열린 체크 전부 닫기, 클럭인 중인 직원은 현금 팁 신고. 경로는 "Account > Run Close of Day"이고, 요건을 못 채워도 오너 패스코드로 강제 실행할 수 있다 ([Close of Day report](https://squareup.com/help/us/en/article/6594)).
- **SevenRooms 연동(교차 검증)**: SevenRooms로 테이블을 예약·착석시키면 Square 플로어 플랜에 보라색으로 "미개봉 예약" 테이블이 표시되고, 메뉴를 추가해 Send를 누르면 주방 프린터 또는 Square KDS로 전달된다 — 예약 시스템과 POS/KDS가 "좌석 상태"를 공유하는 구체적 사례다 ([SevenRooms integration with Square](https://squareup.com/help/us/en/article/8270-sevenrooms-and-square-for-restaurants)).
- **역할/권한**: "Standard/Enhanced/Full" 3단계 권한 세트 또는 완전 커스텀 권한 세트(Advanced Access 구독 시 무제한 생성)를 만들 수 있고, 이 권한이 POS·Team App·Dashboard·Dashboard 앱에 공통 적용된다 ([Create and edit permission sets](https://squareup.com/help/us/en/article/5822-employee-permissions)).

### 2.3 SevenRooms

- **"Hub" 단위로 묶인 내비게이션**: 공식 플랫폼 페이지는 "Streamline every FOH shift with smart seating, pacing controls, cover forecasting and waitlist automation"라고 설명하고, **Operations Hub** 아래에 Table Management와 Reporting & Group Reporting을 나란히 두며, **Guest Experience Hub** 아래에 Reservations & Waitlist를 둔다 ([SevenRooms: Platform](https://sevenrooms.com/platform/)).
- **Web Portal(백오피스) vs iPad(호스트 스탠드) 분리(핵심 발견)**: 공식 교육 자료는 두 트랙으로 나뉜다 — "Web Portal" 트랙은 플로어플랜·가용성·유저 설정, 이벤트/경험/업셀 생성을 다루고, **"Hosts & Front of House" 트랙은 명시적으로 "SevenRooms iPad app"에 초점**을 맞춰 "서비스 중 예약 생성·수정·착석, 워크인·웨이트리스트 관리, 플로어플랜 레이아웃 편집"을 다룬다 ([Training | SevenRooms](https://sevenrooms.com/newcustomer/training)).
- **홈 화면(공식 "Welcome to SevenRooms" 영상)**: 좌측 탭은 Floor Plan(그날의 좌석·예정·과거 예약과 물리적 배치, 좌석 변경·상태 변경·신규 예약을 여기서 처리), Reservation List(같은 데이터의 리스트), Guest List(도착 확인·거절·편집), Clients(이름/전화/이메일 검색 또는 신규 추가), Server Sections, Lifespan(실시간 지출 대비 미니멈), Settings다 ([Welcome to SevenRooms](https://www.youtube.com/watch?v=VK5YX7SyjZc)).
- **역할 기반 권한**: "User Accounts are fully customizable with different permission levels available per role" ([Getting Started: Account Setup](https://sevenrooms.com/newcustomer/settings)).

### 2.4 OpenTable — "Floor Plan이 기본 뷰"라고 벤더가 직접 설명

공식 제품 페이지(`guest-center` 전용 페이지)는 두 차례 타임아웃이 났지만, 공식 OpenTable Training 유튜브 채널과 다른 공식 제품 페이지로 대체 확인했다.

- **홈 화면 구조(공식 교육 영상)**: "Overview of OpenTable for Restaurants" 영상은 "플로어 플랜이 기본 뷰이며, 선택한 교대(shift)의 예약·웨이트리스트·테이블 레이아웃을 함께 보여준다"고 설명한다. 그 외 화면은 List View, Timeline(예약 공백 확인, 충돌 해소, 추가 파티를 끼워 넣을 자리 찾기), Shift Overview, Guestbook(고객 이력), Server Sections, Settings다 ([Overview of OpenTable for Restaurants](https://www.youtube.com/watch?v=A8IK4eMiBz4)).
- **테이블 관리 기능(제품 페이지)**: 커스텀 플로어 플랜, 테이블 타입, "Smart Assign"(테이블 배정 추천), POS 연동 자동 테이블 상태 갱신, 대기시간 안내·문자 알림이 있는 웨이트리스트, 교대 개요, 커버 리포트, 실시간 매출 추적을 제공한다 ([Restaurant Table Management System](https://www.opentable.com/restaurant-solutions/products/table-management), [Plans & Pricing](https://www.opentable.com/restaurant-solutions/plans)).
- **디바이스/제품명 분리**: "guestcenter.opentable.com"이라는 운영자 전용 제품명으로 운영되고, 소비자용 예약 사이트(opentable.com)와는 분리되어 있다.
- 신규 예약/워크인의 정확한 생성 UI(패널/모달 여부)는 확인하지 못했다.

## 3. 호텔 PMS(Property Management System)

### 3.1 Mews

- **"Mews Operations"는 프런트오피스와 백오피스를 한 모듈에 함께 담는다**: 공식 헬프센터는 이 모듈을 "the control centre for front office and back office staff"라고 설명한다 — 다른 벤더들의 "FOH/백오피스 분리"와 다른 사례로, 적어도 이름상으로는 하나로 묶는다 ([Mews Help Center](https://help.mews.com/s/)). 제품 페이지는 Timeline을 "바쁜 프런트데스크 직원이 누가 오고, 누가 가고, 어느 방에 있는지 쉽게 알 수 있게 하는 스마트하고 인터랙티브한 타임라인"이라고 설명하고, "데스크톱에서 태블릿으로 옮겨가면" 프런트데스크를 벗어나 체크인을 진행할 수 있다고 명시한다 ([Hotel Front Desk Software](https://www.mews.com/en-gb/products/hotel-front-desk-software)).
- **Timeline 화면의 구체적 구조(헬프센터 글 직접 열람)**: 행은 객실(타입별 1차 정렬 후 객실번호순), 열은 시간이며, 예약은 도착·출발 시각을 그대로 반영한 블록("Last name, First name" 라벨)으로 그려진다. **블록을 클릭하면 "Smart detail window"가 뜨고**, 거기서 예약 관리 화면 열기·체크인/체크아웃·고객 프로필 이동을 고를 수 있다 — 우리 콜 원장의 "행 클릭 → 콜 상세 패널" 구조와 가장 가까운 사례다. 신규 예약도 Timeline에서 직접 만들며, **숙박형(야간) 서비스는 일 단위 뷰, 시간제 서비스는 시간 단위 뷰**로 생성 UI가 달라진다고 명시한다 — Mews가 시간제 과금 서비스를 1급으로 지원한다는 뜻이고, 코스 시간제 과금을 쓰는 업종에는 직접적인 선례다. 초과예약 방지는 하드블록 다이얼로그가 아니라 "어떤 객실이 사용중/가능/청소중/서비스중인지 그리드에서 보여주는" 시각적 방식이며, 객실번호 클릭만으로 그 자리에서 하우스키핑 상태를 바꿀 수 있다. 상태는 "confirmed/checked-in" 같은 라벨 대신 **색+긴급도**로 표현한다(주황=긴급 조치 필요(노쇼·체크인/아웃 누락), 파랑=오늘 안에 조치 필요, 진회색=인하우스, 노랑=객실 정지, 초록=온라인 체크인, 점선=미확정). ([The Timeline: An overview](https://help.mews.com/s/article/The-Timeline-An-overview), 2026-10-14)
- **하우스키핑(객실 상태)은 별도 제품**: 같은 헬프센터는 **Flexkeeping**을 하우스키핑 자동화(객실 배정, 청소 계획, 교대 스케줄, 검수)를 다루는 별도 카테고리로 분리해 둔다.
- **리포트/재무도 별도 제품명**: **Mews Business Intelligence**(대시보드·커스텀 리포팅)와 **Finance**(리포트 생성)가 Operations와 분리된 카테고리로 존재한다.
- **나이트오딧을 없앴다고 공식 주장(핵심 발견)**: "Do I still need to perform a night audit? **No manual night audit is required. Mews automatically closes the day based on your business day configuration.**" ([Ledgers in Mews Operations FAQs](https://help.mews.com/s/article/Ledgers-in-Mews-Operations-FAQs?language=en_US)). 공식 블로그는 업계 표준 나이트오딧 절차(거래 마감 → 고객 계정 검증 → 객실 재고 갱신 → 결제/환불 처리 → 현금·결제수단 조정 → 리포트 생성 → 영업일 마감)를 "자동화로 없앨 수 있는 수작업"으로 프레이밍한다 ([What Is a Night Audit in a Hotel?](https://www.mews.com/en/blog/hotel-night-audit-automation)) — 레거시 PMS·Toast·Square류의 "사람이 트리거하는 마감"과 대비되는 지점이다.
- 체크인/체크아웃 상태모델, 신규 예약 생성 화면, 역할별 랜딩 화면은 카테고리 설명 수준을 넘어 확인하지 못했다.

### 3.2 Cloudbeds

`support.cloudbeds.com`은 직접 접근(SSL 핸드셰이크 실패/403)에 실패했지만, 검색엔진이 색인한 `myfrontdesk.cloudbeds.com` 헬프센터 기사 본문은 확보했다.

- **최상위 내비게이션에서 PMS와 리포팅이 형제 항목**: 공식 홈페이지의 Platform 메뉴는 Platform Overview, **PMS**, Payments, **Insights & Reporting**, Channel Manager, Booking Engine, Distribution Partners, Guest Communication & Digital Check-in, Revenue Management, Guest Marketing CRM을 같은 레벨에 나열한다 ([Cloudbeds 공식 홈페이지](https://www.cloudbeds.com/)).
- **대시보드가 로그인 후 기본 화면(검색 색인으로 확인)**: "도착·출발 건수, 예정 점유율, 객실 가용성을 보여주는 일일 요약이며, 로그인 시 기본으로 열리고 메인 메뉴에서도 다시 접근할 수 있다" ([Dashboard - Everything you need to know](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/115000400634)).
- **권장 업무 순서(검색 색인으로 확인)**: "Daily Operations Guide"는 프런트데스크 직원에게 "대시보드의 'Today' 뷰에서 Arrivals, Departures, In-house, Overbookings를 먼저 확인한 다음 미배정 예약을 확인하라"고 순서를 명시한다 ([Daily Operations Guide](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/40771665486363-Your-Cloudbeds-PMS-Daily-Operations-Guide)). Arrivals/Departures 탭에는 "View all" 토글이 있어, 켜면 이미 처리된 방까지 보이고 끄면 아직 처리 안 된 방만 남는다.
- **태스크/티켓은 하우스키핑과 묶여 한 기능으로 제공**: "Tickets and tasks" 기능이 팀 채팅, 작업, 티켓, 검수를 한 곳에 둔다. Mews가 하우스키핑을 별도 제품(Flexkeeping)으로 분리한 것과 달리, Cloudbeds는 PMS 내 한 기능으로 통합한다는 점이 대비된다.
- **나이트오딧(검색 색인으로 확인)**: "자정 이후 아무 때나 수동으로 'Run Night Audit' 버튼을 눌러 트리거할 수 있고, 설정에서 정해진 시각에 자동 실행도 가능하다. 완료되면 객실 요금이 게시되고 예약 상태가 갱신되며 영업일이 다음 날로 넘어간다" ([Enhancements to the Night Audit Process](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/31030047512347-Enhancements-to-the-Night-Audit-Process-in-Cloudbeds-PMS)). 완료 후 "Daily Trial Balance"라는 원장 스냅샷이 생성된다 ([Daily Trial Balance Report](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/50911360846875-Daily-Trial-Balance-Report-Everything-You-Need-to-Know)). Mews와 달리 Cloudbeds는 "자동 실행 옵션은 있지만 트리거 자체(나이트오딧이라는 절차)는 여전히 존재한다."
- **셀프 체크인/키오스크**: "Digital check-in"으로 손님이 도착 전 ID·서명을 제출할 수 있고, 키오스크 옵션은 로비를 셀프 체크인/체크아웃 스테이션으로 바꾸는 용도로 설명된다. 모바일 앱은 "오늘과 내일의 도착·출발·인하우스 숙박을 조회"하는 축약된 표면이다.

### 3.3 Oracle OPERA Cloud

- **리포팅/분석이 처음부터 별도 제품**: Oracle의 공식 문서 색인 페이지는 OPERA Cloud Services와 나란히 **OPERA Reporting and Analytics**, OPERA Cloud Distribution, Enterprise Management, Materials Control을 별도 제품 문서 세트로 나열한다 ([Oracle Help Center: Hospitality 문서 색인](https://docs.oracle.com/en/industries/hospitality/opera-cloud-services/)) — Square·SevenRooms·Boulevard·Mews·Cloudbeds의 "내비게이션상 분리"보다 더 강한, "제품 자체가 분리"된 형태다.
- **영업일 마감(핵심 발견)**: "Financials > End of Day > Manage End of Day" 경로로 들어가며, 속성(property)마다 타일이 하나씩 떠서 그날의 Arrivals/Departures 예정 건수와 "닫아야 할 오픈 캐셔" 수를 보여준다. **"Auto No Show Arrivals"가 켜져 있으면 도착 예정 예약이 자동으로 노쇼 처리되고, "Auto Close Cashiers"가 켜져 있으면 열려 있는 캐셔가 자동으로 닫힌다** ([Running End of Day](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.3/ocsuh/t_endofday_running_end_of_day.htm); 레거시 OPERA 5.6 동등 절차는 [About End of Day Sequence](https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/about_end_of_day_sequence.htm)). 이는 우리 제품의 "미완료 콜은 자동 상태 변경 없이 확인·사유 기록으로 예외 마감"(ADR 0005)과 **정반대 방향**이다.
- **역할**: 역할은 "Chain Role"(체인 전체 공통)과 "Property Role"(속성 하나에 한정)로 나뉘고, 한 사용자가 여러 역할을 동시에 가질 수 있다. 공식 트레이닝 영상은 "프런트데스크 매니저는 Reservations, Front Desk Agent, Night Audit, Front Desk Supervisor, Front Desk Manager 역할을 모두 가질 수 있다"고 예시를 든다 — 역할은 계층형이라 상위 역할이 하위 역할의 권한을 자동 포함하지 않고 각각 따로 부여해야 한다 ([About Roles](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.1/ocsuh/c_manage_roles.htm)).
- **홈 화면은 "역할 고정"이 아니라 "권한 게이트 + 개인 선택"이다(직접 열람, 24.1판과 다른 26.4판 User Guide에서 확인)**: 기본 홈은 타일형 **Dashboard**이고, 어떤 타일이 보이는지는 "역할에 해당 대시보드 타일의 user task가 부여돼 있어야" 한다는 권한 조건을 따른다("In order to view a tile your role(s) must be granted the applicable user task for the dashboard tile"). 그런데 그 위에서 **개인 사용자가 자신이 접근 가능한 임의의 화면을 "Set <Page> as my Home Page"로 직접 지정**할 수 있고, "Reset to Dashboard"로 되돌릴 수 있다 — 역할마다 다른 고정 홈을 시스템이 강제하는 게 아니라, "권한으로 메뉴를 제한한 뒤 개인이 그 안에서 자기 홈을 고르는" 제3의 방식이다. ([About the Dashboard](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/c_home_dashboard.htm), [Selecting Your Home Page](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/t_getting_started_selecting_your_home_page.htm), 2026-10-14)
- **Front Desk 장 구조(직접 열람)**: Arrivals and Check In, In House, Departures and Checkout, Front Desk Workspace로 나뉜다. Arrivals and Check In에는 **"SMART Search"**가 있어 성/이름/이메일로 "불완전하거나 근사한 정보"까지 찾고 유사/정확 일치를 토글로 가른다 — 전화로 받아적은 이름·번호의 모호성을 다루는 우리 설계와 비교할 선례다. ([Front Desk](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/ch_front_desk.htm), [Arrivals and Check In](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/ch_arrivals_and_check_in_intro.htm), 2026-10-14)
- **고객(게스트) 프로필 자동 병합 — 안전장치를 갖춘 실제 사례(직접 열람, 핵심 발견)**: "Profile Auto Merge" 컨트롤을 켜면 규칙 기반 자동 병합을 설정할 수 있고, 끄면 수동 병합만 가능하다. 그 사이에 **Profile Match List**라는 검토 큐가 있어, 일치 점수("match points")가 임계값을 넘은 후보 쌍이 **"24시간 동안 검토 대상으로 머문 뒤" 다음 배치에서 실제로 병합**된다. 결과 상태는 세 가지다: **MPC**(병합 예정, "ID가 더 낮은 프로필이 보통 살아남는다"), **DNM**(병합 금지 — 활성 미수금 계정·미래 예약·비활성 프로필·직원 프로필은 자동 제외), **CNM**(활성 예약·미정산 잔액 등 기술적/업무적 사유로 병합 불가). 사용자는 **Merge Profiles**(수동 강제 병합)·**Do Not Merge**(영구 제외)·**Allow Merge**(제외 해제)를 직접 조작할 수 있다. ([Profiles](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/ch_profiles_intro.htm), [Using Profile Match List](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/t_using_profile_match_list.htm), 2026-10-14) — 대형 호텔 PMS조차 자동 병합을 기본값이 아니라 "점수 임계값 + 24시간 인간 검토창 + 금전/미래예약 프로필 강제 제외 + 양방향 수동 오버라이드"를 갖춘 뒤에야 옵션으로 제공한다는 뜻이며, 8.3절의 자동 병합 논의를 뒷받침하는 가장 강한 근거다.
- **모바일/대화형 표면**: 모바일 앱의 "Ask Oracle" 메뉴는 Arrivals(도착 예정 검색), Departures(당일 체크아웃 검색) 항목을 제공하고, Digital Assistant는 오늘의 도착·출발 현황을 보여주거나 확인번호로 체크인을 수행할 수 있다 ([OPERA Cloud mobile app / PWA](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.5/ocsuh/c_overview_opera_cloud_mobile_app_pwa.htm)).
- **Front Desk Workspace의 존재는 공식 목차로 확정됐지만 화면 레이아웃은 여전히 확인 못함**: User Guide 26.4판의 Front Desk 장 하위 목차에 "Front Desk Workspace"가 독립 토픽으로 올라 있어(위 항목) 그런 모듈이 실재한다는 것은 더 이상 추정이 아니다. 다만 그 페이지 자체는 "JavaScript must be enabled to correctly display this content"만 반환해 도착·출발·객실 상태 보드가 실제로 한 화면에 어떻게 배치되는지는 끝내 확인하지 못했다. 객실 상태 보드의 정확한 화면 구성도 마찬가지로 미확인이다.

## 4. 전화 예약 중 빠른 입력 패턴

손님 전화를 받으면서 동시에 예약을 만드는 상황(우리 counter 역할의 핵심 업무)에 대해, 1~3절의 조각들을 한데 모은다.

- **고객 검색이 서비스 선택보다 먼저 온다.** Fresha의 공식 예약 생성 흐름은 "왼쪽 패널에서 기존 고객을 고르거나, 신규 고객을 만들거나, 워크인으로 남겨 둔다"를 서비스 선택보다 앞에 둔다. Phorest도 "빈 시간대를 누른 뒤 고객 이름을 검색하거나 Add Client"가 서비스 카테고리 선택보다 먼저다. SevenRooms의 공식 영상도 "클라이언트 이름, 전화번호, 이메일로 검색하거나 신규 고객을 추가한다"고 설명한다. 세 벤더 모두 "고객 먼저, 그다음 서비스/직원/시간" 순서라는 점에서 일치한다 ([Fresha: Create appointments](https://www.fresha.com/help-center/knowledge-base/calendar/260-create-appointments-1), [Phorest: How do I make an appointment](https://phorest.helpjuice.com/305295-how-do-i-make-an-appointment-gb), [Welcome to SevenRooms](https://www.youtube.com/watch?v=VK5YX7SyjZc)).
- **전화로 받아적은 부정확한 정보를 검색이 흡수하게 만든 사례도 있다.** Oracle OPERA Cloud의 Arrivals and Check In 화면은 "SMART Search"로 성/이름/이메일을 "불완전하거나 근사한 정보"로도 찾고, "유사 일치"와 "정확 일치"를 토글로 가른다(3.3절). 스파·살롱 벤더 쪽에서는 이 정도로 명시적인 "근사 검색" 문서를 찾지 못했다 — 경쟁사 시연판의 전화번호 파서(국가번호 추정, ambiguous 후보 제시, `docs/research/2026-10-14-vn-nightlife-spa.md` §11)가 다루는 문제를 호텔 PMS 쪽이 이름 검색 영역에서 먼저 명문화한 사례로 참고할 만하다. 우리 제품은 국가번호를 해석하지 않고 숫자만 비교한다(통합 명세 B09).
- **워크인(고객 미확정) 예약을 1급으로 다룬다.** Fresha는 "워크인으로 남겨 둠"을 신규/기존과 나란한 세 번째 선택지로 공식 문서에 명시한다. 이는 전화 예약처럼 "일단 시간만 잡고 손님 정보는 나중에"가 드문 일이 아니라는 뜻이다.
- **빈 시간이 없을 때의 대안 제시가 문서화되어 있다.** Fresha는 "Next available date"(다음 가능일), "Check all professionals"(전체 직원 확인), "Join the waitlist"(대기열 등록) 세 가지 대안을 명시한다. 이는 우리 경쟁사 분석(vn-nightlife.com/spa)의 `suggestions[]`(날짜·시각·마사지사·라벨)나 `earliest`(가장 빠른 시각) 필드와 같은 방향의 장치다(`docs/research/2026-10-14-vn-nightlife-spa.md` §11).
- **최근 방문 이력, 메모 처리**: "최근 방문 이력을 예약 생성 화면에 바로 띄운다"거나 "손님 공통 메모와 이번 방문 요청을 분리해서 입력받는다"는 내용을 1차 문서로 확인하지 못했다. Mindbody의 "Class Sign-In" 카드가 "멤버십 등급, 생일, 누락 정보"를 보여준다는 설명이 가장 근접하지만 이는 체크인 화면이지 예약 생성 화면이 아니다. 우리 CONTEXT.md의 "고객 공통 선호·주의사항"과 "방문별 요청"을 분리하는 설계는, 조사한 벤더들의 공식 문서보다 한발 더 들어간 모델로 보인다.
- **중복 고객 처리 방식이 벤더마다 다르다.** Fresha는 매장 직원 입력 시 경고 후 수동 병합이지만 **온라인 예약 경로에서는 일치 정보가 있으면 자동 병합**한다(유일한 자동 병합 사례). Boulevard는 생성 시점에 이름/이메일/전화 일치로 경고만 하고, 병합은 항상 별도 화면에서 권한자가 필드 단위로 선택해 수동 실행한다. Zenoti도 매장 직원 병합은 수동이고 권한 게이트가 있다(내부 대량 자동 병합은 벤더 운영 프로세스일 뿐 매장 기능이 아니다). Vagaro·Mindbody·Phorest는 공식 문서를 확보하지 못했다. 예약 "생성 시점에" 저장을 막고 후보를 먼저 보여주는 흐름(우리 경쟁사의 `customer_candidates`, "신규 등록 사유 필수")에 정확히 대응하는 공식 문서는 어떤 벤더에서도 찾지 못했다 — Boulevard·Zenoti의 병합도 "사후에, 별도 화면에서" 하는 것이라 시점이 다르다. 우리는 Boulevard·Zenoti 쪽에 가깝게(경고 + 수동 확인 + 사유 기록) 이미 설계되어 있다.

## 5. 마감·정산·급여 흐름 비교

| 벤더 | 확인된 내용 | 다루는 범위 |
| --- | --- | --- |
| Phorest | Manager 화면의 Cash Up: 결제수단별 기대값(Expected) vs 실제 입력값을 대조, 일치 시 초록 표시. 마감 시 Closing float를 떼고 나머지는 Cash to Bank로. 수동으로 안 하면 자동 Cash Up이 돈다 | 현금·카드 등 결제수단별 시재만. 미완료 예약은 다루지 않음 |
| Phorest | Staff Commission Overview/Detail 리포트: Manager→Reports→Staff. 커미션은 서비스 수행 시점 기준, 구간 지정 실행, 티어형 옵션 있음 | 수당 계산 결과 리포트. "지급을 확인했다"는 상태나 "재확인 필요" 같은 워크플로는 문서에 없음 |
| Zenoti | "그날의 매출·수납 데이터는 Appointment Book에서 바로 볼 수 있다", "재무 데이터를 프런트데스크에서 숨길 수 있다". 급여는 "Integrated Payroll & Tipping"이라는 별도 제품 | 일 마감 체크리스트 자체보다는, 캘린더 화면에 재무 요약이 노출되는지와 그 접근 권한 |
| Toast | Shift Review(직원, 선택): 체크 닫기→현금 팁 신고→현금·팁 정산→서랍 닫기→클럭아웃. Close Out Day/Z Report(매니저, 선택, 영업일은 새벽 4시 자동 마감). 현금서랍 마감은 "별개 기능"으로 명시 | 영업일 상태와 현금 실사를 의도적으로 분리. 미결제 체크는 자동으로 안 닫힘(옵션 시 예외) |
| Square | Close of Day(매니저 전용, Plus/Premium): 팁 미조정 정리·열린 체크 닫기·현금 팁 신고가 선행 조건, 오너 패스코드로 강제 실행 가능. Staff 섹션에 Payroll·Shifts 별도 링크 | 카드 팁 실제 정산까지 포함. 급여는 별도 Dashboard 앱 |
| Mews | "나이트오딧 수동 절차 자체가 불필요"(자동 영업일 마감) | 업계 표준 나이트오딧 절차를 자동화로 대체한다고 공식 주장 |
| Cloudbeds | 수동 "Run Night Audit" 버튼 또는 예약된 자동 실행. 완료 후 Daily Trial Balance 생성 | 나이트오딧 절차는 유지하되 트리거를 유연화 |
| Oracle OPERA Cloud | End of Day: 속성별 타일에 Arrivals/Departures/오픈 캐셔 표시. "Auto No Show Arrivals", "Auto Close Cashiers" 옵션으로 **자동 상태 변경 가능** | 미완료 항목을 자동으로 처리할 수 있는 옵션을 공식 제공 — 우리 ADR 0005와 반대 방향 |
| Mindbody, Vagaro, Boulevard, SevenRooms, OpenTable | 확인 못 함 또는 간접 언급뿐 | — |

가장 뚜렷한 공통점은, 조사한 어떤 벤더의 공식 문서도 "상태가 남아 있는 레코드(시술중/사용중 등)를 목록으로 보여주고, 사유를 적어야 예외적으로 마감할 수 있다"는 절차를 설명하지 않는다는 점이다. 벤더들은 체크리스트 통과 실패 시 대개 ①권한자 오버라이드(Toast/Square의 오너 패스코드)나 ②자동 변경(OPERA의 Auto No Show/Auto Close Cashiers) 중 하나를 쓴다. 우리 ADR 0005가 정한 "마감 확인 대상 콜" 절차(확인 목록 + 사유 기록, 우회 없음)는 이 비교군 안에서는 선례를 찾을 수 없는, 우리가 자체적으로 더 엄격하게 세운 규칙이다.

## 6. 역할 기반 홈 화면과 읽기전용 디스플레이 비교

| 벤더 | 역할별로 다른 화면/권한이 문서화됐는가 | 근거 |
| --- | --- | --- |
| Mindbody | 예 — "Front Desk" 권한 그룹이 명시적으로 존재하고, "프런트데스크 역할은 예약·체크인·결제만 보고 백엔드 설정은 안 보인다"고 명시 | [Customize Mindbody 블로그](https://www.mindbodyonline.com/en-gb/business/education/blog/studios-salons-spas-customize-mindbody), [Staff Permissions 교육](https://booker.exceedlms.com/student/path/401805/activity/360139) |
| Oracle OPERA Cloud | 예, 다만 "역할마다 고정된 다른 화면"은 아니다 — Chain/Property Role이 접근 가능한 대시보드 타일·메뉴를 제한하지만, 그 범위 안에서 **개인 사용자가 "Set <Page> as my Home Page"로 자기 홈을 직접 고른다**("권한 게이트 + 개인 선택"이라는 제3의 방식) | [About Roles](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.1/ocsuh/c_manage_roles.htm), [About the Dashboard](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/c_home_dashboard.htm), [Selecting Your Home Page](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/t_getting_started_selecting_your_home_page.htm) |
| Zenoti | 예(부분) — "재무 데이터 접근을 프런트데스크에서 숨길 수 있다"는 권한 토글만 확인. "랜딩 화면 자체가 바뀐다"는 설명은 없음 | 1.2절 |
| Square, Fresha, SevenRooms | 부분 — 권한 세트를 역할별로 세분화한다고 문서화하지만, "역할마다 다른 랜딩"까지는 명시하지 않음 | 1.1, 2.2, 2.3절 |
| Phorest | 간접적 — Manager 허브가 별도로 있다는 것은 "매니저가 아닌 역할은 기본적으로 그 허브에 가지 않는다"는 추정을 가능하게 하지만, 역할별 랜딩을 명시한 문서는 없음 | 1.3절 |
| Vagaro, Boulevard, Toast, OpenTable, Mews, Cloudbeds | 확인 못 함 | — |

읽기전용 디스플레이(벽걸이 TV, 주방 모니터 등)에 대해서는, Square의 KDS가 유일하게 구체적으로 문서화된 "현장 디스플레이형" 화면이었는데 공식 설명 자체가 "view, track, and fulfill"과 "two-way ticket interaction"을 강조해 사실상 조작 가능한 작업 화면이다. "손대지 않고 보기만 하는" 디스플레이를 제품의 핵심 기능으로 내세운 벤더는 이번 조사에서 없었다. 이는 read_only_viewer(벽걸이 TV) 역할을 설계할 때 참고할 업계 선례가 드물다는 뜻이며, 역으로 "어차피 다들 안 하니 그냥 조작 가능하게 만들어도 되겠다"는 결론으로 이어져서는 안 된다 — 우리 쪽의 요구(TV는 읽기 전용이고 편집 기능과 고객 연락처를 두지 않는다, 통합 명세 "객실·실시간·TV")가 조사 대상과 다른 고유한 제약이기 때문이다.

## 7. 교차 패턴과 반복 빈도

아래 표는 1~3절에서 실제로 "문서화됨"으로 확인한 근거가 있는 경우만 센 것이다(조사한 13개 제품: Fresha, Mindbody, Vagaro, Zenoti, Phorest, Boulevard, Toast, Square, OpenTable, SevenRooms, Mews, Cloudbeds, OPERA Cloud). 확인하지 못한 벤더·항목은 분모에서 제외했다.

| 패턴 | 확인된 벤더 | 비고 |
| --- | --- | --- |
| 하루 단위 캘린더/보드가 메인 화면, 생성은 그 화면 위에서 패널/팝업으로 처리 | Fresha, Phorest, Zenoti(2024년 재설계), Mindbody, OpenTable(Floor Plan이 기본 뷰), SevenRooms(Floor Plan에서 바로 생성), Mews(Timeline) | 컨테이너가 사이드 패널인지 모달인지까지 명시한 공식 문서는 Fresha뿐이었고 그마저 "새 예약 화면"이라고만 함 |
| 프런트(현장 운영)와 백오피스(리포트/정산)가 내비게이션 또는 제품 단위로 분리 | Phorest(Manager 허브), Toast("Front of house"를 공식 용어로 사용), Square(Staff/Customer 섹션 분리), SevenRooms(Operations Hub ≠ Guest Experience Hub, Web Portal ≠ iPad), Boulevard(Dashboard ≠ Professional ≠ Duo, 리포팅도 별도 카테고리), Mindbody(체크인 키오스크/Business 앱 vs 풀 소프트웨어), Mews(하우스키핑·BI는 분리하되 "Operations"는 FOH+BOH를 한 이름으로 묶는 예외), Cloudbeds(PMS ≠ Insights & Reporting), Oracle(OPERA Cloud Services ≠ OPERA Reporting and Analytics, 아예 별개 제품) | 9개 제품에서 확인된 가장 강한 패턴. 분리의 "세기"는 제품마다 다르다(Oracle은 별도 제품, Phorest는 같은 앱의 한 허브) |
| 디바이스 전용 서피스(핸드헬드/키오스크/전용 모바일 앱) | Mindbody(Class Check-In 키오스크, Business 앱), Boulevard(Professional 네이티브 앱, Duo), Toast(Toast Go 핸드헬드), Square(Handheld/Terminal/Stand/Kiosk, Dashboard 앱), SevenRooms(호스트 iPad), Mews(체크인 태블릿), Oracle(Ask Oracle 모바일) | 7개 제품에서 명확히 확인 |
| 역할별로 보이는 메뉴·권한이 다르다(권한 그룹이 랜딩/메뉴를 바꿈) | Mindbody(Front Desk 권한 그룹, "백엔드 설정은 보지 않음"), Oracle(Chain/Property Role이 메뉴 접근권 자체를 바꿈), Zenoti(재무 데이터를 프런트데스크에서 숨기는 옵션), Square/Fresha/SevenRooms(세분화된 권한 세트) | "랜딩 화면 자체가 바뀐다"고 명시한 사례는 Mindbody·Oracle 둘뿐 |
| 중복 고객 병합은 수동, 이력 보존(자동 병합 아님) | Zenoti(수동 병합, 권한 필요, 이력 보존), Boulevard(경고+수동 병합, 권한 게이트) | 2개 벤더 확인. 반대로 Fresha는 온라인 경로에서 공식적으로 자동 병합하고, Oracle OPERA Cloud는 "자동 병합"을 옵션으로 열어 두되 매치 포인트 임계값·24시간 인간 검토창·금전/미래예약 프로필 강제 제외·양방향 수동 오버라이드(Merge/Do Not Merge/Allow Merge)까지 갖춘 뒤에야 쓴다(3.3절) — "완전 자동"과 "완전 수동" 사이에 "안전장치를 갖춘 옵션형 자동"이라는 세 번째 지점이 있다는 뜻 |
| 더블부킹을 막지 않고 허용하거나 경고만 한다(사람 기준) | Fresha(사람은 허용, 리소스는 차단), Vagaro(사람은 허용, 리소스는 차단, 그룹 예약 시 리소스 공유도 허용) | 명시적 "경고만 하고 저장은 막지 않는다"는 문구를 확인한 벤더는 없었다. 둘 다 아예 "허용된다"고 적는다 |
| 일 마감이 체크리스트형(기대값 대 실제값 대조, 또는 선행조건 확인) | Phorest(Cash Up), Toast(Shift Review+Close Out Day), Square(Close of Day 선행조건), Cloudbeds(Daily Operations Guide 점검 순서), Oracle(End of Day 타일형 현황판) | 5개 제품에서 확인. 단, "미완료 예약·시술중 상태"까지 체크리스트에 포함하는 벤더는 없었다 |
| 마감 체크리스트의 예외 처리가 "자동 변경" 또는 "권한자 우회"다 | Toast/Square(오너 패스코드 오버라이드), Oracle(Auto No Show Arrivals, Auto Close Cashiers) | 우리 ADR 0005(우회 없이 사유 기록)와 다른 방향 |
| 읽기전용(터치 불가) 전용 디스플레이 서피스 | 확인된 벤더 없음 | Square KDS는 오히려 "양방향"이 강점으로 홍보된다 |

## 8. 이 앱에 주는 시사점

### 8.1 역할 × 디바이스 매핑

| 역할 | 조사에서 가장 가까운 대응물 | 근거 |
| --- | --- | --- |
| counter(카운터, 전화 예약·배정·수납) | Fresha/Phorest/Zenoti의 "캘린더=메인 화면, 그 위에서 예약 생성" 역할, Mindbody의 Front Desk 권한 그룹(예약·체크인·결제만, 백엔드 설정 제외), SevenRooms의 Host & Front of House(iPad) | 1.1, 1.3, 1.4, 2.3 |
| settlement_manager(수당·지급 확인·월마감) | Phorest의 Manager 허브(Cash Up + Staff Commission 리포트가 한 영역), Square Dashboard 앱, Zenoti의 "재무 데이터를 프런트데스크에서 숨기는" 권한 분리, Toast의 매니저 체크리스트 | 1.3, 1.2, 2.2, 2.1 |
| waiter(플로어/객실 상태 확인) | SevenRooms의 Table Management(Operations Hub), Mews의 Flexkeeping(하우스키핑 별도 모듈), Cloudbeds 모바일 앱(오늘/내일 도착·출발·인하우스 축약 표면) — 업종이 달라 그대로 옮길 수 없고 "축약된 전용 표면"이라는 틀만 참고 | 2.3, 3.1, 3.2 |
| read_only_viewer(벽걸이 TV) | 조사 대상에서 직접적 대응물을 찾지 못함(6절, 7절 참고) | 6절 |
| administrator | OPERA Cloud의 ADMIN/Chain Role, Fresha/Square의 최고 권한 세트 | 1.1, 2.2, 3.3 |

디바이스 측면에서는 PC/태블릿/폰/벽걸이TV 네 가지 모두에 대응하는 전례를 가진 벤더가 없었다. 가장 근접한 것은 Mindbody의 Class Check-In(키오스크), Boulevard Professional(스태프 전용 네이티브 앱), Square의 하드웨어 라인업(Handheld/Terminal/Stand/Kiosk), SevenRooms의 호스트 iPad, Mews의 체크인 태블릿이지만, 이들은 모두 "조작 가능한" 전용 화면이지 "보기만 하는" 디스플레이가 아니다. 우리 제품의 read_only_viewer(벽걸이 TV)는 이 조사에서 확인한 벤더들이 공식 문서로 전면에 내세우는 패턴이 아니며, 참고할 1차 자료가 거의 없는 영역이다.

### 8.2 반복되는 IA 패턴과 채택 여부

1. **"하루 서피스 + 그 위에서 생성" (7개 제품 확인)** — 콜 원장이 이미 이 패턴이다. Fresha조차 패널/모달 중 어느 쪽인지 공식 문서가 밝히지 않을 만큼, "그 자리에서 바로 만든다"는 원칙이 "서랍이냐 모달이냐"보다 더 중요한 합의였을 가능성이 있다. 경쟁사(vn-nightlife.com/spa)도 예약 상세·신규 작성 모두 서랍 하나로 처리하며 별도 페이지를 두지 않는다(`docs/research/2026-10-14-vn-nightlife-spa.md` §3, §11) — 이번 조사 대상과 같은 방향이다.
2. **"프런트오브하우스/운영 화면과 백오피스/리포트 분리" (9개 제품 확인, 가장 강한 패턴)** — 우리 역할 중 counter와 settlement_manager가 이미 사실상 분리되어 있으므로, 이 패턴을 내비게이션에도 반영하는 것은 근거가 충분하다. 다만 Oracle이나 Boulevard처럼 "아예 다른 제품/앱"으로 쪼개는 것은 우리 규모에 과하다 — Phorest의 "Manager 허브 하나에 정산·리포트·직원관리를 묶는" 수준이 더 맞는 참조점이다.
3. **"역할별로 메뉴·랜딩이 달라진다" (Mindbody·Oracle 2개 제품만 명시적으로 확인)** — 생각보다 적게 문서화되어 있다. 벤더들이 이걸 안 하는 게 아니라, 공식 헬프센터가 "권한 그룹" 설정 화면을 설명하는 수준에 그치고 "역할별로 다른 홈 화면"을 마케팅 포인트로 내세우지 않기 때문으로 보인다. 우리가 역할별 랜딩을 설계할 때 참고할 수 있는 깊이 있는 1차 자료가 부족하다는 뜻이고, 우리가 스스로 설계 원칙을 세워야 하는 영역임을 시사한다.
4. **"마감 전 체크리스트"는 돈/영업일 상태 중심이지 미완료 업무 중심이 아니다 (Phorest, Toast, Square, Cloudbeds, Oracle 5개 확인)** — 가장 중요한 차이다. ADR `docs/adr/0005-close-unfinished-calls-with-recorded-reason.md`가 정한 "마감 확인 대상 콜은 목록으로 확인시키고 사유를 남겨야 예외 마감할 수 있다"는 규칙과 동등한 장치(상태값이 남은 레코드를 열거하고 사유를 강제하는, 우회 없는 마감 절차)는 어떤 벤더의 공식 문서에서도 찾지 못했다. 벤더들은 대신 권한자 오버라이드(Toast/Square)나 자동 변경(Oracle)으로 "우회"한다. 즉 이 규칙은 베껴올 선례가 없는, 우리가 직접 더 엄격하게 설계한 부분이다.
5. **급여/커미션은 거의 보편적으로 일별 운영 화면과 다른 모듈이다 (Fresha, Zenoti, Phorest, Square 4개 확인, 반례를 못 찾음)** — 안전하게 가져갈 수 있는 패턴이다.

### 8.3 그대로 베끼면 위험한 지점

- **"시간표상 가능"을 "예약 확정"처럼 보이게 하면 안 된다.** Fresha와 Vagaro는 공식 문서에서 **직원 더블부킹을 기본 허용**하고 경고 문구조차 명시하지 않는다(겹침 차단은 리소스에 한정). 우리 CONTEXT.md의 "시간표상 가능"(실제 근무와 앞 시술 종료까지 확인된 것은 아님)이라는 개념은 이번에 조사한 어떤 벤더보다 더 조심스러운 태도인데, Fresha/Vagaro류의 "일단 허용"이나 Zenoti식 "관리자가 켜고 끄는 차단 옵션"을 그대로 가져오면 "확정이 곧 보장이 아니다"라는 우리 핵심 개념이 희석된다.
- **자동 병합 금지는 업계에서도 소수파 선택이지만, "자동 병합을 하려면 이 정도 안전장치가 최소선"이라는 기준은 분명하다.** Fresha는 온라인 예약 경로에서 자동 병합을 공식 수행한다. Boulevard와 Zenoti(매장 기능 기준)는 "경고 + 수동 병합 + 권한 요구"를 공식 문서화했다(`docs/adr/0003-customer-record-besides-call-memo.md` 계열과 맥이 같다). Oracle OPERA Cloud는 자동 병합을 아예 옵션으로 제공하면서도, 매치 포인트 임계값·**24시간 인간 검토창**·활성 미수금/미래예약/직원 프로필의 강제 제외·Merge/Do Not Merge/Allow Merge 양방향 수동 오버라이드까지 갖춘 뒤에야 쓴다(3.3절) — 업계 최고 수준의 "자동" 병합도 결국 사람이 검토할 시간을 번 뒤에 기본값으로 진행하는 설계이지, 사람이 끝까지 빠지는 설계가 아니다. 우리 제품이 "후보만 보여주고 항상 사람이 고른다"는 더 보수적인 쪽에 서 있다는 것은 이 스펙트럼 안에서 정당화되는 선택이지만, "Fresha식 자동 병합이 업계 표준"이라고 착각해 참고 제품의 다른 UI(빠른 예약 생성 흐름 등)를 베끼다 보면 자동 병합 로직까지 같이 들어올 위험이 있다 — 확인된 자동 병합 선례(Fresha, Oracle)조차 전부 임계값·검토창·제외 규칙 같은 안전장치를 동반한다는 사실 자체가, 안전장치 없이 베끼면 안 된다는 신호다.
- **지급 확인(payout confirmation)을 Phorest의 Cash Up이나 Toast/Square의 "현금·팁 정산"으로 오해하면 안 된다.** `docs/adr/0004-payout-confirmation-preserves-confirmed-amount.md`가 정한 지급 확인은 실제 송금이 아니라 "그 금액을 확인했다는 기록"이고, 이후 정정되면 "지급 재확인 필요"로 갈라진다. Toast의 Shift Review는 직원이 실제로 돈을 주고받는 행위를 "Paid"로 기록하는 기능이고, Phorest의 Cash Up도 "Cash to Bank"로 실제 입금을 전제한다. 두 개념을 같은 화면 패턴(기대값 대 실제값 비교 UI)으로 묶어서 설계하면 "돈이 실제로 나갔다"는 오해를 만들 위험이 있다 — 버튼 라벨도 "지급 처리됨"이 아니라 "지급 확인됨(계산 금액 기준)"처럼 구분해 지어야 한다.
- **마감 자동화 옵션은 우리 ADR 0005와 직접 충돌한다.** OPERA Cloud의 "Auto No Show Arrivals", "Auto Close Cashiers"나 Toast의 "자동 영업일 마감(새벽 4시)"은 모두 "사람이 안 건드리면 시스템이 상태를 바꾼다"는 철학이다. 업계 PMS/POS의 "체크리스트 UI"는 참고하되, 그 뒤에 숨은 "자동 변경 옵션"은 들여오면 안 된다.
- **KDS 같은 "현장 디스플레이"를 전부 읽기전용으로 가정하면 안 된다.** Square의 공식 설명은 KDS를 양방향 조작 화면으로 분명히 포지셔닝한다. 우리 read_only_viewer(벽걸이 TV)를 설계할 때 "주방 디스플레이니까 당연히 읽기전용이겠지"라고 유추하면 틀린다 — 오히려 순수 읽기전용 디스플레이의 선례를 거의 찾지 못했다는 사실 자체가, 외부 벤더 자료보다 우리 내부 요구(쓰기 권한이 전혀 없는 룸 상태 확인)를 더 신뢰해야 한다는 뜻이다.
- **디바이스별 분리를 "앱을 아예 나눈다"로 오인하면 과하다.** Boulevard(3개 앱)나 SevenRooms(Web Portal/iPad 분리)처럼 완전히 별도 앱으로 쪼개는 방식은, 역할이 5개뿐이고 팀 규모가 작은 매장에는 과한 엔지니어링일 수 있다. 하나의 Next.js 앱 안에서 레이아웃과 진입점만 디바이스/역할별로 다르게 가는 쪽(Cloudbeds 모바일 축약 뷰, Mindbody Business 앱처럼 "같은 데이터의 축약 표면")이 우리 규모에는 더 맞을 가능성이 높다 — 판단이 필요한 지점이라 단정하지 않는다.
- **접근 실패한 지점(Mindbody 헬프센터 전체, Vagaro/Boulevard/Zenoti/Phorest의 역할별 권한 상세, Zenoti의 Therapist 더블부킹 차단 여부, OpenTable의 생성 UI, Oracle의 Front Desk Workspace 화면 구성)의 UI는 이 문서에서 추정하지 않았다.** 이후 이 문서를 근거로 그 세부 UI를 단정해 인용하면 안 된다.

## 9. 확인하지 못한 항목과 후속 조사 제안

1. **Mindbody 헬프센터 본문**: `support.mindbodyonline.com`은 Salesforce Lightning 커뮤니티로 렌더링되어 직접 접근과 검색엔진 색인 양쪽 모두 실패했다. 사람이 로그인한 브라우저로 직접 열어 캡처하는 방식이 필요하다.
2. **Vagaro, Boulevard, Phorest, Zenoti의 역할별 권한/홈 화면 상세**: 카테고리 구조나 단편적 설명은 확보했지만, "역할마다 랜딩이 어떻게 달라지는가"를 구체적으로 설명하는 개별 기사는 못 찾았다.
3. **Zenoti의 Therapist(직원) 더블부킹 차단 여부**: 룸 중복예약 방지 설정은 확인했지만, 사람(Therapist) 단위의 동등 설정이 있는지는 확인하지 못했다.
4. **OpenTable의 신규 예약/워크인 생성 UI**: 제품 페이지 일부가 타임아웃되어 패널/모달 여부를 확인하지 못했다.
5. **Oracle OPERA Cloud의 "Front Desk Workspace" 화면 레이아웃**: 재조사 결과 User Guide 26.4판에서 Front Desk 장의 하위 목차(Arrivals and Check In, In House, Departures and Checkout, **Front Desk Workspace**, Reservation Upgrade)까지는 확인했고 "Front Desk Workspace"가 실재하는 하위 토픽임은 확정됐지만, 그 페이지 자체는 "JavaScript must be enabled to correctly display this content"만 반환해 실제 화면 구성(배치, 위젯)은 여전히 확인하지 못했다.
6. **호텔 PMS의 "하우스키핑 전용 읽기 화면"**: Mews(Flexkeeping)와 Cloudbeds(Tickets and tasks)가 하우스키핑 기능이 있다는 것은 확인했지만, "객실 상태만 보여주는 순수 읽기 전용 보드" 형태의 공식 설명은 찾지 못했다.

이 문서는 위 항목들이 채워지지 않았다는 전제 위에서 "이 앱에 주는 시사점"(8절)을 썼다. 후속 조사로 내용이 보강되면 8절의 결론(특히 역할별 랜딩과 읽기전용 디스플레이 관련 결론)이 바뀔 수 있다는 점을 염두에 둔다.

## 10. 인용 목록(접속일 2026-10-14)

**Fresha**: [Create appointments](https://www.fresha.com/help-center/knowledge-base/calendar/260-create-appointments-1) · [Scheduling features](https://www.fresha.com/for-business/features/scheduling) · [Create and manage resources](https://www.fresha.com/help-center/knowledge-base/calendar/101215-create-and-manage-resources) · [Merge client profiles](https://www.fresha.com/help-center/knowledge-base/clients/57-merge-client-profiles) · [Create client profiles](https://www.fresha.com/help-center/knowledge-base/clients/320-create-client-profiles) · [Reporting and analytics overview](https://www.fresha.com/help-center/knowledge-base/reports/614-reporting-and-analytics-overview) · [Manage report access for team members](https://www.fresha.com/help-center/knowledge-base/reports/192-manage-report-access-for-team-members) · [Manage permission roles](https://www.fresha.com/help-center/knowledge-base/team/100692-manage-permission-roles) · [Fresha Academy: Track commissions](https://www.youtube.com/watch?v=d29diWlJm2o) · [Fresha Academy: Pay your team](https://www.youtube.com/watch?v=hbLDWHFr3SU)

**Zenoti**: [Appointment Book & Smart Scheduling](https://www.zenoti.com/platform/appointment-booking) · [Release notes — Oct 29, 2024](https://help.zenoti.com/en/release-notes/release-notes/release-notes---october-29,-2024.html) · [Avoid Room Double-Bookings](https://help.zenoti.com/en/zenoti-driven-growth/business-accelerators/focus-on-operational-control/avoid-room-double-bookings-and-scheduling-conflicts.html) · [Switch views in Zenoti Mobile](https://help.zenoti.com/en/zenoti-mobile/zenoti-mobile-v2/manage-appointments/switch-views-in-zenoti-mobile.html) · [Appointments by status](https://help.zenoti.com/en/analytics/business-snapshot/appointments-by-status.html) · [Manage guests](https://help.zenoti.com/en/appointments/manage-guest-experience/manage-guests.html) · [(2차 자료) Bulk Zonal Guest Merge](https://regisonzenoti.notion.site/Bulk-Zonal-Guest-Merge-Executed-by-Zenoti-64a70ab5cf0a4902a0f0ac5428b814a0)

**Phorest**: [How do I make an appointment](https://phorest.helpjuice.com/305295-how-do-i-make-an-appointment-gb) · [Why have my appointments gone grey?](https://phorest.helpjuice.com/333939-why-have-my-appointments-gone-grey) · [How do I cash up each night (EOD)](https://phorest.helpjuice.com/305364-how-do-i-cash-up-each-night-eod-gb) · [Staff Commission Overview report](https://phorest.helpjuice.com/305697-staff-commission-overview-report-gb) · [Staff Commission Detail report](https://phorest.helpjuice.com/305691-staff-commission-detail-report) · [Manager](https://phorest.helpjuice.com/44078-manager)

**Mindbody**: [공식 교육 카탈로그](https://booker.exceedlms.com/student/catalog/list?page=2) · [Staff Permissions 교육](https://booker.exceedlms.com/student/path/401805/activity/360139) · [Customize Mindbody 블로그](https://www.mindbodyonline.com/en-gb/business/education/blog/studios-salons-spas-customize-mindbody) · [Business App 블로그](https://www.mindbodyonline.com/education/blog/how-the-mindbody-business-app-benefits-your-staff) · [Scheduling for Classes & Appointments](https://www.mindbodyonline.com/business/scheduling) · [Business App](https://www.mindbodyonline.com/business/business-app) · [Class Check-In App](https://www.mindbodyonline.com/business/class-check-in-app) — `support.mindbodyonline.com`은 접근 실패

**Vagaro**: [Double-Book Time Slots on the Calendar](https://support.vagaro.com/hc/en-us/articles/204347690-Double-Book-Time-Slots-on-the-Calendar)(검색 색인) · [Book a Service Bundle](https://support.vagaro.com/hc/en-us/articles/360038357414-Book-a-Service-Bundle)(검색 색인) · [Double-Book Your Resources](https://www.vagaro.com/en-ca/pro/updates/double-book-your-resources) · [Pro Product Updates](https://www.vagaro.com/pro/updates)

**Boulevard**: [Support Center 카테고리](https://support.boulevard.io/en) · [General FAQs](https://support.boulevard.io/en/articles/5941334-general-faqs) · [Merging Client Profiles](https://support.boulevard.io/en/articles/5941428-merging-client-profiles) · [Add-On Services](https://support.boulevard.io/en/articles/6584601-add-on-services) · [joinblvd.com](https://www.joinblvd.com)

**Toast**: [Support Center](https://support.toasttab.com/) · [Set Up Toast Go 3](https://support.toasttab.com/article/Set-Up-Toast-Go-3) · [Get Started With the Kitchen Display System](https://support.toasttab.com/en/article/Get-Started-With-the-Kitchen-Display-System) · [Kitchen display system overview](https://doc.toasttab.com/doc/platformguide/platformKDSOverview.html) · [Get Started With Kitchen Configuration](https://support.toasttab.com/en/article/Basic-Kitchen-Configuration) · [Shift Review Checklist](https://support.toasttab.com/en/article/Shift-Review-Checklist-for-Employees-and-Managers?lang=en_US) · [Close Out Day, Z Report, Auto-Capture](https://support.toasttab.com/article/Close-Out-Day-Z-Report-Auto-Capture) · [Use Cash Drawers](https://support.toasttab.com/en/article/Use-Cash-Drawers-New-Experience?lang=en_US) · [Assign User Access Permissions](https://support.toasttab.com/article/Assigning-User-Access-Permissions)

**Square**: [Kitchen Display System](https://squareup.com/us/en/point-of-sale/restaurants/kitchen-display-system) · [Point of Sale for Restaurants](https://squareup.com/us/en/point-of-sale/restaurants) · [Close of Day report](https://squareup.com/help/us/en/article/6594) · [Create and edit permission sets](https://squareup.com/help/us/en/article/5822-employee-permissions) · [SevenRooms integration with Square](https://squareup.com/help/us/en/article/8270-sevenrooms-and-square-for-restaurants) · [Building your floor plan](https://squareup.com/help/us/en/article/6427-building-your-floor-plan)

**OpenTable**: [Restaurant Table Management System](https://www.opentable.com/restaurant-solutions/products/table-management) · [Plans & Pricing](https://www.opentable.com/restaurant-solutions/plans) · [Overview of OpenTable for Restaurants (공식 영상)](https://www.youtube.com/watch?v=A8IK4eMiBz4)

**SevenRooms**: [Platform](https://sevenrooms.com/platform/) · [Training](https://sevenrooms.com/newcustomer/training) · [Getting Started: Account Setup](https://sevenrooms.com/newcustomer/settings) · [Welcome to SevenRooms (공식 영상)](https://www.youtube.com/watch?v=VK5YX7SyjZc)

**Mews**: [Hotel Front Desk Software](https://www.mews.com/en-gb/products/hotel-front-desk-software) · [Help Center](https://help.mews.com/s/) · [Ledgers in Mews Operations FAQs](https://help.mews.com/s/article/Ledgers-in-Mews-Operations-FAQs?language=en_US) · [What Is a Night Audit in a Hotel?](https://www.mews.com/en/blog/hotel-night-audit-automation) · [The Timeline: An overview](https://help.mews.com/s/article/The-Timeline-An-overview)

**Cloudbeds**: [공식 홈페이지](https://www.cloudbeds.com/) · [Dashboard](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/115000400634)(검색 색인) · [Daily Operations Guide](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/40771665486363-Your-Cloudbeds-PMS-Daily-Operations-Guide)(검색 색인) · [Night Audit Enhancements](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/31030047512347-Enhancements-to-the-Night-Audit-Process-in-Cloudbeds-PMS)(검색 색인) · [Daily Trial Balance Report](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/50911360846875-Daily-Trial-Balance-Report-Everything-You-Need-to-Know)(검색 색인)

**Oracle OPERA Cloud**: [문서 색인](https://docs.oracle.com/en/industries/hospitality/opera-cloud-services/) · [About End of Day Sequence (레거시)](https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/about_end_of_day_sequence.htm) · [Running End of Day](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.3/ocsuh/t_endofday_running_end_of_day.htm) · [About Roles](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.1/ocsuh/c_manage_roles.htm) · [OPERA Cloud mobile app / PWA](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.5/ocsuh/c_overview_opera_cloud_mobile_app_pwa.htm) · [About the Dashboard](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/c_home_dashboard.htm) · [Selecting Your Home Page](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/t_getting_started_selecting_your_home_page.htm) · [Front Desk](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/ch_front_desk.htm) · [Arrivals and Check In](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/ch_arrivals_and_check_in_intro.htm) · [Profiles](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/ch_profiles_intro.htm) · [Using Profile Match List](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.4/ocsuh/t_using_profile_match_list.htm)

**내부 문서**: `docs/research/2026-10-14-vn-nightlife-spa.md` · `CONTEXT.md` · `docs/adr/0003-customer-record-besides-call-memo.md` · `docs/adr/0004-payout-confirmation-preserves-confirmed-amount.md` · `docs/adr/0005-close-unfinished-calls-with-recorded-reason.md`
