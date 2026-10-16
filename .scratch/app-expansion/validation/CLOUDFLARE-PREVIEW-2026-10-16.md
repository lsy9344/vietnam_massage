# Cloudflare 프리뷰 배포 — 2026-10-16

- 사용자 요청: 통합 결과를 실제 DB에 연결한 Cloudflare 프리뷰로 배포.
- 소스: `integration/app-expansion`, `e19e43e`.
- 프리뷰: https://app-expansion-vietnam-massage-erp.boothy-selectroom.workers.dev
- 고정 버전: https://a1486963-vietnam-massage-erp.boothy-selectroom.workers.dev
- Worker 버전: `a1486963-0a10-4bf0-8166-809bd5dc6ee2`.
- 방식: `opennextjs-cloudflare upload` → `wrangler versions upload --preview-alias app-expansion`.
- 실제 DB: 기존 `vietnam-massage-erp-db` Hyperdrive를 통한 PlanetScale Postgres(싱가포르).
- 프리뷰에만 `NEXTAUTH_URL`을 프리뷰 주소로 지정하고 `MAINTENANCE_MODE=off`로 설정. 기존 인증 secret은 상속.
- 운영 트래픽 버전은 `bff7cf91-d69b-486c-81eb-c4a8666af6ee` 100%로 유지됨. main 병합과 push는 하지 않음.

## 빌드·DB

- `pnpm cf:build`와 `wrangler versions upload --dry-run` 통과.
- 번들: gzip 3864.28 KiB, Worker 시작 23ms.
- 마이그레이션 전 실제 DB 전체를 비공개 로컬 경로에 백업하고 `pg_restore --list` 검증 완료.
- 실제 DB에 다음 4개 마이그레이션 적용(총 20개 적용 완료):
  - `20261015120000_add_service_call_request_id`
  - `20261016230000_add_customer_preference_and_visit_request`
  - `20261016270000_add_planned_working_days`
  - `20261016300000_add_payout_confirmation_events`
- 기존 주요 테이블 건수 보존: 계정 8, 직원 64, 콜 1262, 지출 727, 구 지급 행 315, 구 지급 이력 324.
- 지급 확인 사건 324건으로 구 이력 이전 완료. 구 지급 표·이력은 보존됨.
- 데이터 초기화·시드·비밀번호 변경은 실행하지 않음. 프리뷰 저장은 실제 DB에 반영됨.

## 배포 후 확인

- 로그인 화면 200, 프리뷰 전용 인증 callback 주소, 존재하지 않는 계정의 안전한 401 거부 응답 확인.
- 기존 활성 관리자 계정의 짧은 검증용 서명 세션으로 다음 14개 화면의 200 응답과 화면 제목 표시 확인. 운영 계정 비밀번호를 입력하는 로그인 검증은 수행하지 않았다.
  - 현황, 원장, 고객 검색.
  - 근무표, Therapist 일일정산, 귀케어 일일정산, 운영팀 일일·월간 정산, 월 명세서.
  - 월마감, 일일·월간 대시보드, 그래프 보고서, 직원 관리.
- 검증은 조회만 수행했다. 신규 예약·고객·근무·지급 확인·마감 저장은 사용자가 실제 사이트에서 확인한다.
- **조회 지연:** 월마감 약 96.4초, 월간 대시보드 약 41.2초, 그래프 보고서 약 42.2초. 서버 오류로 단정하지 않았으며, 대기 후 실제 화면 표시까지 확인했다. 별도 성능 개선은 이번 프리뷰 배포 범위에 포함하지 않았다.
- 초기 자동 검증의 60초 network-idle 대기 및 운영월 자동 이동 후 30초 제목 대기는 위 집계 시간 때문에 초과됐다. DOM 로딩을 기다리고 실제 운영월 주소로 직접 조회하여 월간 화면을 확인했다.
- 개별 실행에는 위 대기 초과 기록이 남아 있다. 최종 통합 결과는 비공개 실행 폴더의 `smoke-summary.json`(14/14), 월간·보고서 최종 실행은 각각 `smoke-monthly/result.json`, `smoke-reports/result.json`을 기준으로 한다.

## 실행 증거

Git에서 제외한 `cloudflare-preview-2026-10-16/` 아래에 빌드·업로드·마이그레이션·브라우저 검증 로그, 전후 DB 건수, 운영 버전 비교 결과를 보관했다. 백업 자체와 기존 인증 자료는 저장소 밖 비공개 경로에 유지한다.

전체 기능 검증 및 기존 E2E 제한 사항은 [REVIEW-2026-10-16.md](REVIEW-2026-10-16.md)를 참조한다.
