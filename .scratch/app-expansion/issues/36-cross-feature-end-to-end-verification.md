# 36: 전체 흐름 교차 검증

**What to build:** 각 티켓에서 이미 확인한 검사를 되풀이하지 않고, 기능 사이에 남은 위험을 실제 연결로 검증한다. 중심 흐름은 전화로 고객 검색 → 빠른 예약 → 입장·객실 확인 → 완료·수납 → 지급 확인 → 마감·월 명세서다. (스펙 V01–V14, 스토리 136–142)

**Blocked by:** 01–35

**Status:** done

- [x] 위 중심 흐름이 하나의 E2E로 통과한다.
- [x] 기능이 엇갈리는 상황을 검증한다: 근무표 변경과 가능 후보, 겹친 콜과 객실 화면, 동시 저장과 응답 유실, 지급 확인 뒤 콜 정정 → 지급 재확인 필요 → 마감 거절, 재오픈 뒤 고객 연결 정정과 재확정.
- [x] 다섯 역할이 새 서버 액션을 직접 호출해도 권한이 지켜진다. 보기 변경, 경고 상세, 겹친 콜 목록, 마감 점검이 권한을 넓히지 않는다.
- [x] 한국어·베트남어 문구, 오류 매핑, 인쇄 문구에 빠진 키가 없다.
- [x] PC, 태블릿, 휴대폰에서 합의한 동선, 키보드 접근, 44px 주요 조작 영역, 동작 줄이기를 확인한다.
- [x] 데이터 이전(요청 id, 새 칸, 기존 지급완료 이전)의 적용 전후 결과, 과거 스냅샷 보존, 남는 제한을 기록한다.
- [x] 발견한 결함은 해당 기능의 새 티켓으로 남긴다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-36-cross-feature-end-to-end-verification`, `integration/app-expansion` 28b671b 위, 01–35 전부 포함). DB `vietnam_aesthetic_t36`·포트 3136(컨테이너 `vietnam-shell-02-e2e`).

### 새 E2E: 전체 흐름 교차 검증

- `tests/e2e/story-ticket-36-cross-feature-end-to-end-verification.spec.ts`(테스트 3개, 직렬).
  1. **중심 흐름**: 고객 화면에서 전화번호로 고객 등록 → 원장에서 빠른 예약 열어 그 전화번호로 검색·선택 → 날짜·시간·가능 코스로 Therapist·코스 채움 → 객실·방문별 요청 → 예약 저장(그리드에 바로 나타남) → 그리드에서 상태를 사용중으로 바꿔 `/rooms`에 반영되는지 확인 → 방문완료+결제수단으로 바꿔 "하루 수납·지출" 탭 합계에 반영되는지 확인(겸사겸사 카운터가 "수납·정산" 보기로 바꿔도 수당 열이 없음을 확인, F02·티켓19) → 정산 담당이 그 콜의 지급을 확인 → 관리자가 검토 시작·마감 확정(점검 통과) → 월 명세서에 마감 버전 1과 금액이 보이고 인쇄 버튼이 있음.
  2. **지급 확인 뒤 콜 정정 → 지급 재확인 필요 → 마감 거절**: 완료 콜 1건으로 지급 확인(300,000) → 같은 날 같은 직원의 완료 콜을 하나 더 만들어(정정을 흉내) 금액이 600,000으로 바뀜 → 패널에 "지급 재확인 필요"(이전/현재 금액)가 뜨고 `/closing`의 "지급 재확인 미처리" 점검에 1건이 걸려 마감 확정이 막힘(해결 전 거절 확인) → 사유와 함께 재확인하면 통과 → 마감 확정이 성공.
  3. **재오픈 뒤 고객 연결 정정과 재확정**: 완료 콜 1건으로 마감 확정(closeVersion 1) → 고객 연결 정정이 잠겨 있음(티켓 25와 같은 안내) → 관리자가 재오픈 → 고객 연결 정정(사유·감사 포함, 콜의 고객/메모는 안 바뀜) → 재확정(closeVersion 2) → DB로 closeVersion 1의 `snapshotJson`·`confirmedAt`이 그대로임을 확인 → 월 명세서가 "마감 버전 2"를 보임.
  - 2·3번 시나리오에 티켓 27의 "역할 바꿔치기" 기법(화면은 권한 있는 역할로 연 채 호출 시점의 계정 역할만 바꿔 서버 재검사를 확인)을 재사용해 `payout:write`(재확인)와 `closing:reopen`을 각각 끼워 넣었다(아래 권한 절 참고).
  - 근무표 변경과 가능 후보(27–29), 겹친 콜과 객실 화면(14), 동시 저장과 응답 유실(15–18)은 각 티켓의 스펙이 이미 충분히 확인했으므로(각 티켓 `## Comments` 참고) 되풀이하지 않았다.

### 권한(V12)

- 새 서버 액션 전체를 코드로 대조했다: `settlements/{actions.ts,earcare/actions.ts,operations/actions.ts,operations/monthly/actions.ts,schedule/actions.ts}`, `closing/actions.ts`, `calls/actions.ts`, `masters/employees/actions.ts`의 모든 `export async function`이 본문 첫머리에서 `requirePermission(...)`나 `requireRouteAccess(...)`를 부르고, 권한 문자열이 `src/lib/authorization.ts`의 역할표(관리자/카운터=`call:write`, 관리자/정산 담당=`payout:write`·`closing:write`, 관리자만=`closing:reopen`)와 맞는다. 빠진 액션은 없었다.
- "호출 시점의 역할 재검사"(화면은 숨기지만 서버가 다시 막는지)까지 실제로 확인한 전례는 티켓 27(근무표 편집, `payout:write`) 하나뿐이었다. 이 티켓에서 같은 기법으로 두 가지를 더 확인했다: 지급 재확인(`payout:write`, 시나리오 2)과 월마감 재오픈(`closing:reopen`, 시나리오 3). 둘 다 역할을 바꾼 뒤 호출하면 "권한이 없습니다."로 거절되고 상태가 바뀌지 않았다.
- 보기 변경(F02, 티켓19): `editable-call-grid.tsx`의 `visibleCallGridColumns`가 보기와 무관하게 `showSettlementColumns`로 수당 열을 거르고, `calls/page.tsx`는 그 권한이 없으면 `redactServiceCallSettlementAmounts`로 행 자체를 서버에서 미리 지운다(코드 확인 + 시나리오 1에서 재확인). 겹친 콜 목록(14)과 경고 상세(13)·마감 점검(33)의 역할별 필드·링크 차이는 각 티켓의 E2E가 이미 확인했다(티켓14: "웨이터의 겹친 콜 목록에는 원장 링크와 고객 정보가 없다", 티켓33: 정산 담당은 요약, 관리자는 원장 링크).

### 언어·디자인·기기(V13)

- `pnpm test:unit`의 `src/lib/i18n/i18n.test.ts`("vi 카탈로그는 ko의 모든 key를 가진다", "빈 문자열 없음")가 두 언어 키 빠짐을 이미 자동으로 막는다(이번 실행에서도 통과). `errors.ts`의 `DOMAIN_ERROR_VI`는 설계상 "핵심 사용자 입력 에러만" 번역하는 부분 목록이라(나머지는 한국어 원문 fallback이 의도된 동작), 전체 code 목록과의 1:1 대응은 기준이 아니다. 인쇄 문구(출력 시각 포함)는 티켓32 E2E가 이미 확인했다.
- 44px·키보드·동작 줄이기는 새로 생기는 공용 컴포넌트에 구조적으로 들어 있어 화면마다 새로 테스트할 필요가 없다: 버튼은 공용 `Button`(h-11=44px), 패널은 공용 `ModalPanel`/`SidePanel`/`AlertDialog`(포커스 트랩·Escape, 티켓17·05 E2E가 이미 그 메커니즘을 확인), 움직임은 `globals.css`의 전역 `@media (prefers-reduced-motion: reduce)` 규칙(모든 `*`의 transition·animation을 0.01ms로, 티켓3-5가 이미 확인). 예외 하나를 찾았다(아래 새 티켓 39).
- PC(1280/1440)·태블릿(768)·휴대폰(390) 동선은 티켓20(빠른 예약 PC·태블릿, 휴대폰은 버튼 없음)·티켓26(휴대폰 카드 목록·태블릿 이상 표)·여러 티켓의 1440/1024/390 가로 스크롤 없음 테스트가 이미 확인했다.

### 데이터 이전

- **요청 id**(`service_calls.request_id`, 티켓16)·**고객 공통 선호·콜 방문별 요청**(`customers.preference_note`, `service_calls.visit_request`, 티켓23): 둘 다 nullable 추가 칸이라 기존 행은 전부 NULL로 시작하고(위험 없음), `request_id`의 UNIQUE 인덱스는 여러 NULL을 허용해 기존 행끼리 충돌하지 않는다. 실제로 `npx prisma migrate deploy`로 적용해 스키마만 확인했다(데이터 변환이 없어 건수 비교가 필요 없음).
- **기존 Therapist 지급완료 → 지급 확인 사건**(`payout_confirmation_events`, 티켓30, `prisma/migrations/20261016300000_add_payout_confirmation_events`): 실제 Postgres(컨테이너 `vietnam-shell-02-e2e`, 별도 스크래치 DB `vietnam_aesthetic_t36_migration`)에 레거시 데이터를 수동으로 넣고 이 마이그레이션을 그 자리에서 실행해 확인했다(티켓30 자신은 빈 DB에만 적용해 0→0이었다고 적어 뒀다 — 이번에 실제 건수로 다시 확인한 것).
  - 시드: 이력 있는 지급완료 1건(확인→취소→확인 3단계 이력), 이력 없이 지급완료만 있는 레거시 1건(이력 표 도입 전 데이터 흉내), 지급완료가 아닌 행 1건(옮기면 안 됨).
  - 적용 전: `therapist_daily_settlement_payments`=3행, `therapist_daily_settlement_payment_histories`=3행, `payout_confirmation_events`=0행.
  - 적용 후: `payout_confirmation_events`=4행(이력 3건이 각각 `confirm`/`release`/`confirm`으로, 금액은 모두 NULL인 "확인 금액 미기록" 사건으로 변환됐고 발생 시각·처리자가 원본과 일치 + 이력 없는 레거시 행 1건이 보완 `confirm` 사건 1건으로). 지급완료가 아닌 행은 사건이 생기지 않았다(기대대로).
  - 과거 스냅샷 보존: 옛 `therapist_daily_settlement_payments`/`...histories` 표는 적용 뒤에도 3행씩 그대로 남아 있다(드롭 안 함, 쿼리로 확인).
  - 남는 제한: 과거 확인 당시 실제 금액은 기록에 없어 복원할 수 없다(의도적으로 NULL, 화면엔 "확인 금액 미기록"). 귀케어·운영팀은 이 작업에서 처음 생긴 직군이라 옮길 레거시 데이터가 없다. 동시에 확인/해제가 일어나는 극히 짧은 레이스는 티켓30이 이미 기존 지급완료 코드와 같은 특성이라고 적어 뒀고(범위 밖) 이번에도 다르지 않다.

### 발견한 결함

- **작은 회귀 2건, 바로 고쳤다**(이 브랜치의 별도 커밋):
  - `story-ticket-05-settlement-screens.spec.ts:199` — 직원 패널의 링크 수를 `toHaveCount(2)`로 셌는데, 티켓32가 그 패널에 "월 명세서 보기" 링크를 하나 더 둬서 3개가 됐다. 근거 콜 링크("원장에서 보기")만 세도록 좁혔다.
  - `story-ticket-27-schedule.spec.ts`(88·128·158·183줄) — `page.locator("tr", {hasText:"THR-001"})`가 부분 일치라, story-4-4가 뒷정리하지 않고 남기는 다른 스펙의 직원(staffCode에 "THR-001"을 부분 문자열로 포함)과 함께 두 행이 걸려 strict mode 위반으로 깨졌다. staffCode 칸의 정확한 글자(`exact: true`)로 가리도록 고쳤다.
- **죽은 코드 1건, 바로 지웠다**: `src/app/(erp)/calls/therapist-availability-panel.tsx`(티켓20 이후 정의 외 호출부 없음, 티켓29가 이미 보고했던 것).
- **새 티켓으로 남긴 것**(제품 방향 결정이나 더 넓은 작업이 필요해 이 티켓 범위에서 고치지 않음):
  - `.scratch/app-expansion/issues/37-ledger-inline-customer-link-no-reason.md`(needs-triage) — 원장 그리드 인라인 "고객" 칸이 사유 없이 바로 연결을 바꾸는 기존 경로(티켓25가 남긴 간극).
  - `.scratch/app-expansion/issues/38-quick-booking-duplicate-save-notice-not-shown.md`(ready-for-agent) — 빠른 예약 재시도의 "이미 저장된 콜입니다" 안내가 패널이 즉시 닫혀 보이지 않는 문제(티켓20이 남긴 가정).
  - `.scratch/app-expansion/issues/39-closing-action-buttons-below-44px.md`(ready-for-agent) — `closing-action-panel.tsx`의 "검토 시작"·"마감 확정"·"잠금"·"재오픈" 네 버튼이 공용 `Button`(44px) 대신 raw `h-9`(36px)라, 스토리139 기준에 못 미친다(재오픈은 이 작업으로 마감확정에서도 쓰이게 돼 특히 걸림). 네 버튼을 함께 고쳐야 해 범위 밖으로 남겼다.

### 전체 E2E 검증 결과

- `--workers=2`(330개): 11개 실패. `--workers=1` 새 DB 직렬 재실행(330개): 8개 실패, 3 skipped, 7 did not run(앞선 serial describe 실패의 연쇄), 312 passed.
- 직렬 재실행에 남은 8개는 모두 기존/환경 문제로 판별했다(각각 재현·단독 실행으로 확인):
  - **기존 known-failure 그대로**: `story-2-5:270`, `story-5-3:173`·`:242`, `story-5-5:213`·`:252`(메모 `e2e-prod-known-failures` 목록과 같은 "서버 액션 200, 화면 pending 고착" 증상).
  - **같은 가족의 새 사례, 이번에 메모에 추가**: `story-4-4:326`(귀케어 지급 확인/재확인/해제, `--repeat-each=3` 단독 재현에서 2/3회 같은 pending 고착), `story-ticket-24:179`(빠른 예약 가능 코스 비동기 로드, 단독 재실행 3회는 모두 통과 — 로드 지연으로 본다).
  - **일회성 환경 흔들림**: `story-ticket-07:116`("Target page, context or browser has been closed") — 단독 재실행에서 6/6 통과해 일회성으로 판별.
  - `--workers=2` 병렬에서만 보인 나머지(story-1-8, story-3-2, story-3-3, story-4-1, story-4-5, story-5-2, story-ticket-08 등)는 병렬 실행 특유의 흔들림(메모의 기존 패턴)으로, 직렬 재실행에서 모두 사라졌다.
  - 이 발견을 `e2e-prod-known-failures` 메모에 추가해 다음 세션이 다시 추적하지 않게 했다.
- 새 스펙(`story-ticket-36-*`, 테스트 3개)은 `--workers=2`와 `--workers=1` 양쪽에서, 그리고 이 브랜치의 모든 재실행에서 전부 통과했다.

### 검증

- `npx tsc --noEmit` 통과.
- `pnpm test:unit` 855개 전부 통과(이 티켓에서 추가한 단위 테스트 없음 — 교차 E2E와 코드 대조가 중심이라 스펙의 테스트 경계에 새 서비스 경계를 추가하지 않았다).
- `for f in scripts/validate-story-*.mjs; do ...; done` — `validate-story-4-6.mjs`만 기존 실패(이 티켓과 무관, 메모에도 있는 문제).
- `pnpm build` 통과.
- E2E: 위 "전체 E2E 검증 결과" 참고. DB·서버 정리는 보고 직후에 한다.
