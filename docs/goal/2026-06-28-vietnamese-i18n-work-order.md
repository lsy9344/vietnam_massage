# 베트남어 다국어 전환 작업지시서

- 작성일: 2026-06-28
- 대상 앱: `vietnam_aesthetic` Next.js ERP
- 목적: 앱에 다국어 기반을 추가하고, 기본 화면 언어를 베트남어로 전환한다.
- 기준 코드: 현재 작업트리 기준 `src`, `scripts`, `tests`, `package.json`

## 1. 작업 목표

현재 앱은 한국어 문구가 화면, 검증 메시지, 도메인 에러, seed 데이터, 정적 검증 스크립트에 직접 들어가 있습니다. 이 작업의 목표는 다음입니다.

1. 한국어와 베트남어를 함께 담을 수 있는 다국어 구조를 만든다.
2. 기본 언어를 베트남어로 설정한다.
3. 기존 한국어는 fallback 또는 언어 전환용으로 유지한다.
4. 업무 값, 권한, route, DB stable code는 번역하지 않고 표시 문구만 번역한다.
5. 기존 정산, 객실 현황, 콜원장, 대시보드 계산 동작은 바꾸지 않는다.

## 2. 전제와 결정 사항

작업 전제:

- 지원 언어는 `ko`, `vi` 두 개로 시작한다.
- 기본 언어는 `vi`로 둔다.
- 번역 누락 시 한국어 `ko` 문구로 fallback한다.
- 언어 선택은 cookie 또는 localStorage로 저장한다.
- route 구조는 우선 유지한다. `/vi/calls` 같은 locale prefix route는 이번 작업 범위에서 제외한다.
- 운영일, 정산일, 상태 계산 로직은 바꾸지 않는다.
- `RESERVED`, `IN_USE`, `CASH`, `CARD` 같은 stable code는 번역하지 않는다.
- `administrator`, `counter`, `settlement_manager` 같은 role 값과 permission 값은 번역하지 않는다.

확인 필요:

- 화면 우측 상단에 언어 전환 버튼을 둘지, 기본 베트남어만 노출할지 결정이 필요하다.
- 베트남어 용어는 원어민 또는 실제 운영자가 최종 검수해야 한다.
- 시간대는 현재 코드의 업무 규칙을 유지한다. 베트남 시간대로 바꾸는 것은 별도 요구사항으로 처리한다.

## 3. 현재 상태 요약

확인된 사실:

- `package.json`에는 `next-intl`, `react-i18next` 같은 i18n 전용 의존성이 없습니다.
- `src/app/layout.tsx`는 `<html lang="ko">`로 고정되어 있습니다.
- `src` 비테스트 코드 109개 파일에 한국어 문구가 있습니다.
- `scripts`와 `tests` 84개 파일이 한국어 문구 또는 `ko-KR` locale에 의존합니다.
- `Intl.NumberFormat("ko-KR")`, `Intl.DateTimeFormat("ko-KR")`, `toLocaleTimeString("ko-KR")`가 여러 화면에 직접 들어가 있습니다.
- `src/lib/navigation.ts`의 사이드바 라벨이 한국어로 하드코딩되어 있습니다.
- `src/components/domain/status-badge.tsx`와 `src/modules/rooms/dtos.ts`는 객실 상태 표시값 자체를 한국어 union type으로 사용합니다.
- `src/modules/masters/code-schema.ts`의 기본 코드 표시명은 한국어입니다.
- `scripts/validate-story-*.mjs`와 Playwright E2E는 한국어 화면 문구를 직접 검사합니다.

## 4. 1순위 작업

### WO-I18N-001. 다국어 기반 추가

작업 내용:

1. `src/lib/i18n` 또는 `src/i18n` 아래에 다국어 설정을 만든다.
2. 최소 파일 구조는 다음처럼 둔다.

```text
src/lib/i18n/config.ts
src/lib/i18n/messages/ko.ts
src/lib/i18n/messages/vi.ts
src/lib/i18n/server.ts
src/lib/i18n/format.ts
src/lib/i18n/types.ts
```

3. `Locale = "ko" | "vi"` 타입을 만든다.
4. `defaultLocale = "vi"`, `fallbackLocale = "ko"`를 명시한다.
5. 번역 함수는 key 기반으로 만든다. 예: `t(locale, "navigation.calls")`.
6. client component에서는 서버 전용 함수를 직접 부르지 않게 한다.
7. client component에는 `labels` props 또는 i18n provider를 통해 문구를 전달한다.
8. 번역 key가 없을 때는 fallback 문구를 반환하고, 테스트에서 누락 key를 잡는다.

완료 기준:

- 앱에서 `ko`, `vi` message catalog를 로드할 수 있습니다.
- 기본 렌더링 언어가 `vi`입니다.
- 누락 번역이 있어도 화면이 빈 문자열로 깨지지 않습니다.
- TypeScript에서 잘못된 locale 값을 허용하지 않습니다.

권장 테스트:

- i18n key fallback 단위 테스트
- `vi` 기본 locale 확인 테스트
- message key 누락 검사 스크립트

### WO-I18N-002. 앱 shell과 공통 컴포넌트 번역 적용

대상 파일:

- `src/app/layout.tsx`
- `src/app/(erp)/layout.tsx`
- `src/lib/navigation.ts`
- `src/components/domain/role-aware-sidebar.tsx`
- `src/components/domain/page-header.tsx`
- `src/components/domain/erp-empty-state.tsx`
- `src/components/domain/status-badge.tsx`
- `src/components/domain/room-status-card.tsx`
- `src/components/domain/room-status-refresh-controller.tsx`
- `src/app/(auth)/sign-in/page.tsx`
- `src/app/(auth)/sign-in/sign-in-form.tsx`

작업 내용:

1. `<html lang="ko">`를 현재 locale에 맞게 `ko` 또는 `vi`로 바꾼다.
2. metadata title/description을 locale 기반으로 바꾼다.
3. 사이드바 그룹/메뉴 라벨을 translation key로 바꾼다.
4. ERP shell의 `ERP 운영`, `오늘 운영 기준`, `역할별 ERP 업무`를 번역한다.
5. 로그인 폼 라벨, 버튼, 에러 메시지를 번역한다.
6. 상태 배지는 내부 상태값과 화면 라벨을 분리한다.
7. `aria-label`도 화면 언어와 같은 언어로 번역한다.

완료 기준:

- 첫 접속 시 shell, 사이드바, 로그인 화면이 베트남어로 보입니다.
- 언어를 한국어로 바꾸면 기존 한국어 문구가 보입니다.
- 접근성 라벨도 선택 언어를 따릅니다.
- 권한별 사이드바 노출 규칙은 기존과 같습니다.

### WO-I18N-003. 상태값과 코드 표시명 분리

대상 파일:

- `src/modules/rooms/dtos.ts`
- `src/modules/rooms/room-status-service.ts`
- `src/components/domain/status-badge.tsx`
- `src/modules/calls/service-call-service.ts`
- `src/modules/masters/code-schema.ts`
- `src/app/(erp)/calls/editable-call-grid.tsx`

작업 내용:

1. `RoomDisplayStatus`는 가능하면 stable key로 전환한다.
   - 예: `IN_USE`, `ENDING_SOON`, `RESERVED`, `CLEANING`, `COMPLETE_CHECK`, `EMPTY`
2. 한 번에 바꾸기 위험하면 `displayStatusCode`를 새로 추가하고 기존 `displayStatus`는 호환용으로 유지한다.
3. `StatusBadge`는 stable key를 받아 locale별 label을 표시한다.
4. `ROOM_STATUS_GUIDANCE_TEXT`는 translation key로 이동한다.
5. `SERVICE_STATUS`, `PAYMENT_METHOD`, `DISCOUNT_TYPE`, `ATTENDANCE_STATUS`는 DB code를 기준으로 label만 번역한다.
6. 기존 저장값이 한국어인 과거 데이터가 있을 수 있으므로, 서비스 로직의 호환 처리는 유지한다.
7. 신규 저장은 stable code를 쓰게 한다.
8. `CodeItem.displayName`을 업무 데이터로 계속 쓸지, 시스템 기본 code만 i18n dictionary로 표시할지 결정한다.

권장 방향:

- 시스템 기본 code는 dictionary로 번역한다.
- 사용자가 직접 만든 custom code의 `displayName`은 사용자가 입력한 값 그대로 보여준다.
- 실제 DB 값 자체를 베트남어로 덮어쓰는 방식은 피한다.

완료 기준:

- 상태 비교 로직이 베트남어 표시 문자열에 의존하지 않습니다.
- 객실 카드, TV 현황판, 콜원장 상태 선택지가 베트남어로 보입니다.
- 기존 한국어 status 데이터도 계산과 조회에서 깨지지 않습니다.
- 신규 저장 데이터는 stable code 기준으로 저장됩니다.

### WO-I18N-004. 주요 업무 화면 번역

대상 화면:

- `/live`
- `/rooms`
- `/tv`
- `/calls`
- `/settlements`
- `/settlements/earcare`
- `/settlements/operations`
- `/settlements/operations/monthly`
- `/closing`
- `/dashboard/today`
- `/dashboard/monthly`
- `/dashboard/reports`
- `/masters/operating-months`
- `/masters/rooms`
- `/masters/codes`
- `/masters/employees`
- `/masters/courses`
- `/masters/sheet-mapping`
- `/audit`

작업 내용:

1. PageHeader의 eyebrow, title, description, meta 라벨을 번역한다.
2. table header, form label, button text, empty state, 안내 문구를 번역한다.
3. `loading.tsx`, `error.tsx`의 문구도 번역한다.
4. 콜원장 grid의 column header와 저장 상태 문구를 번역한다.
   - `저장중`, `저장됨`, `저장 보류`
5. 정산 화면의 지급완료, 지급해제, 변경 이력 문구를 번역한다.
6. 대시보드의 KPI 이름, 비용 항목, 경고 문구를 번역한다.
7. 마스터 화면의 생성/수정/비활성화 버튼과 검증 메시지를 번역한다.
8. 감사 로그 화면의 filter label, 변경 전/후, 상세 보기 문구를 번역한다.

완료 기준:

- 주요 ERP route에서 사용자가 보는 고정 한국어 문구가 남지 않습니다.
- 사용자 입력 데이터, 직원명, 코스명, 객실명 같은 업무 데이터는 임의 번역하지 않습니다.
- 화면 폭이 좁아져도 베트남어 문구가 버튼/표 셀 밖으로 넘치지 않습니다.

### WO-I18N-005. 검증 메시지와 서버 에러 메시지 번역

대상 범위:

- `src/lib/auth-messages.ts`
- `src/lib/auth.ts`
- `src/lib/authorization.ts`
- `src/modules/**/**-schema.ts`
- `src/modules/**/**-service.ts`
- `src/app/(erp)/**/actions.ts`
- `src/app/(erp)/**/payment-action-error.ts`

작업 내용:

1. Zod schema의 한국어 error message를 key 기반으로 바꾼다.
2. 서버 action이 반환하는 `message`는 현재 locale로 번역한다.
3. 도메인 에러는 내부 `code`를 유지하고, 화면 표시 직전에 locale message로 바꾼다.
4. 로그, audit action, DB 저장용 code는 번역하지 않는다.
5. 테스트에서는 message 전체보다 error code와 핵심 표시 문구를 함께 검증한다.

완료 기준:

- 잘못된 입력을 넣으면 베트남어 에러가 보입니다.
- 서버 내부 에러 code는 기존처럼 추적할 수 있습니다.
- 한국어 fallback에서도 기존 의미가 유지됩니다.

## 5. 2순위 작업

### WO-I18N-006. 숫자, 날짜, 금액 formatter 정리

현재 `ko-KR` 사용 위치:

- `src/components/domain/room-status-card.tsx`
- `src/components/domain/room-status-refresh-controller.tsx`
- `src/modules/closing/monthly-closing-preview-service.ts`
- `src/app/(erp)/audit/page.tsx`
- `src/app/(erp)/calls/daily-expense-panel.tsx`
- `src/app/(erp)/calls/daily-summary-strip.tsx`
- `src/app/(erp)/calls/editable-call-grid.tsx`
- `src/app/(erp)/live/page.tsx`
- `src/app/(erp)/closing/*`
- `src/app/(erp)/dashboard/*`
- `src/app/(erp)/masters/*`
- `src/app/(erp)/settlements/*`

작업 내용:

1. `formatNumber(locale, value)`, `formatCurrencyVnd(locale, value)`, `formatDateTime(locale, value)` helper를 만든다.
2. 베트남어 화면에서는 `vi-VN` locale을 사용한다.
3. 금액은 VND 기준을 유지한다.
4. 시간대는 이번 작업에서 바꾸지 않는다.
5. `en-CA`를 날짜 input용 ISO 생성에 쓰는 부분은 바꾸지 않는다.

완료 기준:

- 화면의 숫자/날짜/시간 포맷이 locale helper를 통해 나옵니다.
- `rg 'ko-KR' src --glob '!**/*.test.*'` 결과가 의도된 fallback 또는 테스트 외에는 남지 않습니다.
- 금액 계산 결과는 기존과 같습니다.

### WO-I18N-007. seed와 기본 마스터 표시명 정책 정리

대상 파일:

- `src/modules/masters/code-schema.ts`
- `src/modules/masters/employee-schema.ts`
- `src/modules/masters/room-schema.ts`
- `scripts/seed-master-data.ts`

작업 내용:

1. `defaultCodeItems`의 stable code는 그대로 둔다.
2. 시스템 기본 code label은 dictionary에서 번역한다.
3. 기존 DB의 `CodeItem.displayName`을 베트남어로 migration할지 여부를 결정한다.
4. 기본 직원명, 직책, 객실명은 업무 데이터로 보고 임의 번역하지 않는다.
5. 새 DB seed에서 베트남어 표시명을 원하면 별도 seed 정책을 문서화한다.

완료 기준:

- code value와 display label이 섞이지 않습니다.
- 기존 데이터 migration 없이도 화면은 베트남어 label을 보여줄 수 있습니다.
- seed를 다시 실행해도 custom 데이터가 의도치 않게 번역/변경되지 않습니다.

### WO-I18N-008. 정적 검증 스크립트와 E2E 테스트 갱신

대상:

- `scripts/validate-story-*.mjs`
- `tests/e2e/*.spec.ts`
- `src/**/*.test.ts`

작업 내용:

1. 한국어 라벨을 직접 찾는 검증을 locale-aware 검증으로 바꾼다.
2. 베트남어 기본 표시를 확인하는 E2E를 추가한다.
3. 한국어 fallback 또는 언어 전환 동작을 확인하는 E2E를 추가한다.
4. 상태/금액/권한/정산 계산 테스트는 기존 기대값을 유지한다.
5. 테스트 helper에서 locale cookie 설정 기능을 제공한다.

권장 테스트:

```bash
pnpm lint
pnpm test:unit
pnpm build
pnpm test:e2e
```

E2E DB 환경이 준비되지 않은 경우 최소 선별 검증:

```bash
pnpm exec playwright test tests/e2e/story-1-1-app-shell.spec.ts
pnpm exec playwright test tests/e2e/story-1-2-auth-rbac.spec.ts
pnpm exec playwright test tests/e2e/story-2-1-call-ledger-basic.spec.ts
pnpm exec playwright test tests/e2e/story-3-2-live-status.spec.ts
pnpm exec playwright test tests/e2e/story-6-1-today-dashboard.spec.ts
```

완료 기준:

- 기존 lint 검증 스크립트가 베트남어 전환 후에도 통과합니다.
- 기본 locale `vi`에서 핵심 화면 E2E가 통과합니다.
- `ko` locale에서도 주요 메뉴와 로그인 화면이 정상 표시됩니다.

## 6. 3순위 작업

### WO-I18N-009. 언어 전환 UX 추가

작업 내용:

1. ERP header 우측에 언어 전환 control을 추가한다.
2. 선택지는 `Tiếng Việt`, `한국어`로 표시한다.
3. 선택한 언어는 cookie 또는 localStorage에 저장한다.
4. 전환 후 현재 route를 유지한다.
5. 로그인 화면에서도 같은 언어가 적용되게 한다.

완료 기준:

- 사용자가 새로고침해도 선택한 언어가 유지됩니다.
- 권한별 route 접근 동작은 변하지 않습니다.
- 로그인 전/후 언어가 자연스럽게 이어집니다.

### WO-I18N-010. 번역 품질 검수

작업 내용:

1. 베트남어 용어집을 운영자에게 검수받는다.
2. 긴 베트남어 문구가 표, 버튼, 카드에서 넘치지 않는지 확인한다.
3. 모바일 폭과 TV 현황판 폭에서 screenshot 검증을 한다.
4. 정산/마감/감사 로그처럼 업무 의미가 중요한 문구는 원어민 확인을 받는다.

완료 기준:

- 베트남어 문구가 업무자가 이해할 수 있는 표현입니다.
- 버튼과 표 헤더가 깨지지 않습니다.
- TV 현황판에서 상태와 객실명이 멀리서도 읽힙니다.

## 7. 번역 용어집 초안

아래는 개발 시작용 초안입니다. 최종 문구는 운영자 검수가 필요합니다.

| 한국어 | 베트남어 초안 |
| --- | --- |
| 운영 현황 | Tình hình vận hành |
| 첫화면 실시간 현황 | Trạng thái thời gian thực |
| 객실 현황 | Tình trạng phòng |
| TV 현황판 | Bảng trạng thái TV |
| 콜 원장 | Sổ cuộc gọi |
| 콜/예약 입력 원장 | Sổ nhập cuộc gọi/đặt lịch |
| 정산 | Đối soát |
| 월마감 | Chốt tháng |
| 대시보드 | Bảng điều khiển |
| 마스터 설정 | Thiết lập dữ liệu gốc |
| 감사 로그 | Nhật ký kiểm tra |
| 로그인 | Đăng nhập |
| 이메일 또는 계정 ID | Email hoặc ID tài khoản |
| 비밀번호 | Mật khẩu |
| 운영월 | Tháng vận hành |
| 조회날짜 | Ngày tra cứu |
| 조회 | Tra cứu |
| 예약 | Đặt trước |
| 사용중 | Đang sử dụng |
| 종료임박 | Sắp kết thúc |
| 청소중 | Đang dọn |
| 종료확인 | Cần xác nhận kết thúc |
| 빈방 | Phòng trống |
| 방문완료 | Hoàn tất |
| 노쇼 | Không đến |
| 취소 | Đã hủy |
| 현금 | Tiền mặt |
| 카드 | Thẻ |
| 계좌 | Chuyển khoản |
| 기타 | Khác |
| 할인 | Giảm giá |
| 지출 | Chi phí |
| 결제합계 | Tổng thanh toán |
| 순이익 | Lợi nhuận ròng |
| 객실 | Phòng |
| 코스 | Gói dịch vụ |
| 시작 | Bắt đầu |
| 남은분 | Số phút còn lại |
| 종료예정 | Dự kiến kết thúc |
| 담당자 | Người phụ trách |
| 마사지사 | Kỹ thuật viên massage |
| 귀케어 | Chăm sóc tai |
| 지급완료 | Đã thanh toán |
| 변경 이력 | Lịch sử thay đổi |

## 8. 작업 순서 권장안

1. i18n 기반과 formatter를 먼저 만든다.
2. app shell, 로그인, 사이드바를 베트남어로 바꾼다.
3. 상태값과 code label 분리를 처리한다.
4. `/calls`, `/rooms`, `/live`, `/tv`를 먼저 전환한다.
5. 정산, 마감, 대시보드를 전환한다.
6. 마스터, 감사 로그, migration report 화면을 전환한다.
7. schema/action/domain error message를 locale 기반으로 바꾼다.
8. 정적 검증 스크립트와 E2E를 갱신한다.
9. 전체 lint, unit, build, E2E를 돌린다.
10. 베트남어 원문 검수를 반영한다.

## 9. 최종 검수 기준

기능 기준:

- 기본 접속 언어가 베트남어입니다.
- 한국어로 전환하거나 fallback할 수 있습니다.
- 주요 화면에 고정 한국어 UI 문구가 남지 않습니다.
- 정산 계산, 콜원장 저장, 객실 상태 계산, 월마감 동작이 기존과 같습니다.
- stable code, role, permission, route는 기존과 같습니다.

품질 기준:

- `pnpm lint` 통과
- `pnpm test:unit` 통과
- `pnpm build` 통과
- E2E DB 환경이 준비된 경우 `pnpm test:e2e` 통과
- 베트남어 원어민 또는 실제 운영자 용어 검수 완료

회귀 방지 기준:

- 새로 추가되는 화면 문구는 translation key를 통해서만 추가합니다.
- `src` 비테스트 코드에 새 한국어 hardcode를 추가하지 않습니다. 단, `messages/ko.ts`는 예외입니다.
- `ko-KR` 직접 호출을 새로 추가하지 않습니다. formatter helper를 사용합니다.
- 새 테스트는 locale을 명시하거나 기본 `vi` 기대값을 사용합니다.
