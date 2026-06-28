---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
includedFiles:
  prd:
    primary: /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/prd.md
    supporting:
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/addendum.md
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/reconcile-brief.md
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/reconcile-client-spec.md
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/reconcile-modules.md
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/reconcile-sheet-design.md
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/review-rubric.md
  architecture:
    primary: /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/architecture.md
  epics:
    primary: /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/epics.md
  ux:
    primary:
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/EXPERIENCE.md
    supporting:
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/review-accessibility.md
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/review-rubric.md
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/validation-report.md
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/mockups/color-themes-1.html
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/mockups/key-call-grid.html
      - /Users/sooyeol/Desktop/dev_busi/vietnam_aesthetic/_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/mockups/key-live-status.html
---

# Implementation Readiness Assessment Report

**Date:** 2026-06-08
**Project:** vietnam_aesthetic

## 1단계: 문서 발견 인벤토리

### PRD

**Whole Documents:**
- 없음

**Folder Documents:**
- `prds/prd-vietnam_aesthetic-2026-06-07/`
  - `prd.md` (32.90 KB, modified 2026-06-07 17:41 KST)
  - `addendum.md`
  - `reconcile-brief.md`
  - `reconcile-client-spec.md`
  - `reconcile-modules.md`
  - `reconcile-sheet-design.md`
  - `review-rubric.md`
  - `.decision-log.md`

### Architecture

**Whole Documents:**
- `architecture.md` (50.62 KB, modified 2026-06-07 22:59 KST)

**Sharded Documents:**
- 없음

### Epics & Stories

**Whole Documents:**
- `epics.md` (133.93 KB, modified 2026-06-08 00:58 KST)

**Sharded Documents:**
- 없음

### UX Design

**Whole Documents:**
- 없음

**Folder Documents:**
- `ux-designs/ux-vietnam_aesthetic-2026-06-07/`
  - `DESIGN.md` (23.46 KB, modified 2026-06-07 19:57 KST)
  - `EXPERIENCE.md` (19.77 KB, modified 2026-06-07 19:57 KST)
  - `review-accessibility.md`
  - `review-rubric.md`
  - `validation-report.md`
  - `validation-report.html`
  - `mockups/color-themes-1.html`
  - `mockups/key-call-grid.html`
  - `mockups/key-live-status.html`

### 발견된 이슈

- Duplicate whole/sharded conflicts: 없음
- Warning: PRD와 UX는 표준 `index.md` shard 구조가 아니라 폴더형 문서 세트입니다. 2단계 이후 평가는 위에 명시한 주요 문서와 보조 문서를 기준으로 진행합니다.

## PRD Analysis

### Functional Requirements

FR-1: 첫 화면 실시간 현황 — 시스템은 로그인 후 사용자를 실시간 객실/콜 현황 화면으로 안내한다. 실현: UJ-1.

FR-2: 객실 카드 시각화 — 시스템은 각 객실을 카드 형태로 표시하고 상태별 색상, 코스, 담당자, 시작시간, 남은분, 종료예정을 표시한다. 실현: UJ-1, UJ-3.

FR-3: 주인용 그래프 대시보드 — 시스템은 주인용 화면에 일별 매출 추이, 코스별 콜 비중, 마사지사 콜/정산 순위, 객실 상태 분포, 노쇼/취소 추이, 운영팀 인센 달성률을 시각화한다. 실현: UJ-1.

FR-4: 운영월 관리 — 관리자는 운영월을 생성하고 상태를 작성중, 검토중, 마감확정, 잠금으로 관리할 수 있다.

FR-5: 객실 마스터 — 관리자는 11개 객실을 관리할 수 있으며, 표준 표시명은 `101 호실` 형식을 사용한다.

FR-6: 직원 마스터 — 관리자는 운영팀 5명, 귀케어팀 4명, 마사지사 50명의 직원 정보를 관리할 수 있다.

FR-7: 코스 마스터 — 관리자는 A~E 코스의 이름, 시간, 기본판매가, 운영팀 콜인정, 귀케어 풀/콜, 마사지사2 필요 여부, TV 표시명을 관리할 수 있다.

FR-8: 수당과 인센 정책 관리 — 관리자는 마사지사 개인별 코스 수당, 운영팀 일일 인센, 운영팀 월 인센 기준을 관리할 수 있다.

FR-9: 코드와 시간 슬롯 관리 — 관리자는 상태, 결제수단, 할인구분, 확인값, 근무상태, 시간 슬롯을 관리할 수 있다.

FR-10: 서비스 콜 입력 — 카운터는 날짜, 시간, 객실, 코스, 고객/메모, 마사지사1, 마사지사2, 귀케어 담당, 상태, 할인구분, 결제수단, 비고, 확인값을 입력할 수 있다. 실현: UJ-2.

FR-11: 서비스 콜 상태 관리 — 카운터는 서비스 콜 상태를 `예약`, `사용중`, `청소중`, `방문완료`, `노쇼`, `취소`로 변경할 수 있다.

FR-12: 방문완료 계산 — 시스템은 상태가 `방문완료`일 때만 결제금액, 마사지사1수당, 마사지사2수당, 귀케어 풀, 콜인정을 계산한다.

FR-13: 할인 계산 — 시스템은 할인구분 값이 있으면 원본 엑셀처럼 고정 100,000원을 할인한다.

FR-14: D코스 2인 검증 — 시스템은 D코스 서비스 콜에서 마사지사2 입력을 필수로 검증한다.

FR-15: 일별 지출과 콜 요약 — 카운터 또는 관리자 권한 사용자는 일자별 지출금액, 내용, 담당자, 비고를 입력할 수 있으며, 시스템은 원본 `실시간콜입력` U:X 영역의 일별 요약을 계산해 보여준다.

FR-16: 객실 상태 계산 — 시스템은 객실별 최신 `사용중`, `청소중`, `예약` 서비스 콜을 찾아 객실 상태를 계산한다. 실현: UJ-3.

FR-17: 남은 시간과 종료확인 — 시스템은 코스 시간과 시작시간을 기준으로 남은분과 종료예정을 계산한다.

FR-18: 웨이터 안내 문구 — 시스템은 객실 상태에 맞는 웨이터 안내 문구를 표시한다.

FR-19: TV 현황판 — 시스템은 11개 객실을 대형 카드 형태로 보여주는 조회 전용 TV 현황판을 제공한다.

FR-20: 마사지사 출퇴근 입력 — 정산 담당자는 마사지사별 출근시간과 퇴근시간을 입력할 수 있다. 실현: UJ-4.

FR-21: 마사지사 일일정산 — 시스템은 마사지사가 마사지사1 또는 마사지사2 어느 칸에 배정되어도 담당 콜로 인정하고 일일정산을 계산한다.

FR-22: 귀케어 근무상태 입력 — 정산 담당자는 귀케어사 4명의 일별 근무상태를 입력할 수 있다.

FR-23: 귀케어 일일정산 — 시스템은 방문완료 콜의 귀케어 풀을 해당일 정상 근무 귀케어사에게 균등 분배한다.

FR-24: 운영팀 근무상태와 일일 인센 — 정산 담당자는 운영팀 5명의 일별 근무상태를 입력하고 시스템은 일일 인센을 계산한다.

FR-25: 운영팀 월 인센 미리보기 — 시스템은 운영월 총콜 기준으로 운영팀 월 인센을 계산해 미리 보여준다.

FR-26: 월마감 미리보기 — 정산 담당자는 운영월의 마사지사, 운영팀, 귀케어 지급액을 미리보기로 확인할 수 있다. 실현: UJ-4.

FR-27: 만근수당 계산 — 시스템은 마사지사 만근 인정일이 20일 이상이면 만근수당 2,000,000을 지급한다.

FR-28: 갯수왕 수당 계산 — 시스템은 월 총콜 40콜 이상 마사지사를 대상으로 1~3위 갯수왕 수당을 계산한다.

FR-29: 월마감 확정과 잠금 — 관리자 또는 정산 담당 권한 사용자는 월마감을 미리보기, 검토, 확정, 잠금 단계로 처리할 수 있다.

FR-30: 월마감 재오픈 — 관리자는 사유 입력 후 잠긴 월마감을 재오픈할 수 있다.

FR-31: 오늘 KPI 대시보드 — 시스템은 조회날짜 기준 오늘 예약건수, 방문완료 콜, 노쇼, 취소, 결제합계, 마사지사 담당콜, 마사지사 정산, 코스별 방문완료를 보여준다.

FR-32: 월간 KPI 대시보드 — 시스템은 운영월 기준 월 방문완료 콜, 예약건수, 노쇼, 취소, 방문완료 매출을 보여준다.

FR-33: 주인용 시각화 리포트 — 시스템은 일별 매출 추이, 코스별 콜/매출 비중, 마사지사 콜 순위, 마사지사 정산 순위, 객실 상태 분포, 노쇼/취소 추이를 그래프로 제공한다.

FR-34: 권한 역할 — 시스템은 관리자, 카운터, 웨이터, 정산 담당, 조회 전용 권한을 지원한다.

FR-35: 감사 로그 — 시스템은 민감한 변경의 행위자, 액션, 대상, 변경 전 상태, 변경 후 상태, 시각을 기록한다.

FR-36: 시트 기능 매핑표 — 시스템 또는 산출물은 원본 12개 시트와 숨김 시트 `목록`이 어떤 ERP 기능으로 이전됐는지 매핑표를 제공한다.

FR-37: 계산 대조 검증 — 시스템은 샘플 데이터 또는 이관 데이터 기준으로 원본 엑셀과 ERP 계산 결과를 대조할 수 있어야 한다.

Total FRs: 37

### Non-Functional Requirements

NFR-1: ERP 계산 결과는 원본 엑셀의 업무 규칙과 일치해야 한다.

NFR-2: 행 번호, 셀 좌표, 숨김 행 구조는 구현 기준이 아니라 검증 근거로만 사용한다.

NFR-3: 월간 집계는 운영월 날짜 조건으로 계산한다.

NFR-4: 실시간 객실/콜 현황과 TV 현황판은 운영자가 체감할 수 있을 만큼 빠르게 갱신되어야 한다.

NFR-5: 대시보드 그래프는 조회날짜 또는 운영월 변경 시 즉시 이해 가능한 로딩 상태와 함께 갱신되어야 한다.

NFR-6: 정산과 월마감 계산은 대량 수식처럼 화면을 멈추게 하지 않고 서버 계산 또는 집계로 처리해야 한다.

NFR-7: 인증은 확정 기술스택의 NextAuth/Auth.js를 사용한다.

NFR-8: 권한별 화면 접근과 기능 실행 범위를 분리한다.

NFR-9: 지급액, 수당, 마감, 직원 정보에 영향을 주는 기능은 권한 검사를 통과해야 한다.

NFR-10: 감사 로그는 일반 운영 기능으로 삭제할 수 없다.

NFR-11: 월마감 확정 스냅샷은 이후 설정 변경으로 자동 재계산되어 흔들리면 안 된다.

NFR-12: 재오픈은 관리자 권한과 사유 입력을 요구한다.

NFR-13: 실시간 객실/콜 현황은 첫 화면에서 주인이 매장 상태를 한눈에 파악할 수 있어야 한다.

NFR-14: 카운터 입력 화면은 엑셀의 빠른 입력성을 잃지 않아야 한다.

NFR-15: 정산 화면은 계산 결과와 산출 근거를 함께 보여줘야 한다.

Total NFRs: 15

### Additional Requirements

- 기술스택 제약: 구현 기술스택은 Next.js + Node.js, PostgreSQL, Prisma, NextAuth/Auth.js를 사용한다.
- UI/UX 기반 제약: Tailwind CSS v4와 shadcn/ui를 사용한다.
- 운영 제약: 배포, env, migration 절차는 프로젝트 표준과 동일하게 따른다.
- 범위 가드레일: 원본 엑셀의 기능 보존이 v1 최우선이다.
- 제외 범위: 신규 CRM, 마케팅 자동화, 회계 연동, 모바일 앱, 멤버십은 v1 범위가 아니다.
- 식별자 제약: 이름 문자열은 안정 키로 사용하지 않는다. 직원, 객실, 코스는 고유 ID를 사용한다.
- 정책 이력 제약: 현재 수당/인센/가격 정책은 적용월과 스냅샷을 가져야 한다.
- 소스 이관 원칙: ERP must accurately migrate all functional behavior from the existing Excel workbook.
- 구현 기준 원칙: Excel sheet row and cell coordinates should not become implementation rules; requirements should be expressed as ERP domain behavior, stable identifiers, policies, workflows, and calculations.
- 시각화 요구: The ERP must include improved visual presentation for operational understanding, and graphs and visualization dashboards are in scope.
- MVP 포함 범위: 마스터 설정, 예약/콜 원장, 일별 지출, 실시간 객실/콜 현황 첫 화면, 웨이터 객실 현황, TV 현황판, 오늘/월간 대시보드와 주인용 그래프 시각화, 마사지사 일일정산, 귀케어 일일정산, 운영팀 근무/인센, 월마감, 권한/인증/감사 로그, 엑셀 기능 매핑표와 계산 대조 검증.
- MVP 제외 범위: 신규 CRM, 마케팅 자동화, 회계 시스템 연동, 고객용 모바일 앱, 고객 멤버십, 복잡한 할인 금액 다양화, 원본 엑셀에 없는 고객 세그먼트 분석, 외부 POS/PG 연동.
- 오픈 질문: 월마감 재오픈 승인 정책, TV 현황판 갱신 방식, 패키지 매니저/테스트 러너/lint/format 설정, `sheet.xlsx` 실제 운영 데이터 이관 범위와 기간은 구현 전 또는 아키텍처 단계에서 확정해야 한다.
- 비차단 결정: PRD decision log는 위 오픈 질문들을 PRD finalization blocker가 아닌 downstream follow-up으로 기록했다.

### PRD Completeness Assessment

PRD는 `final` 상태이며 FR-1부터 FR-37까지 기능 요구사항 번호가 연속적이고, NFR은 정확성/성능/보안/감사성/사용성으로 구분되어 있다. PRD 보조 문서 기준으로 FR-15의 일별 U:X 요약 범위와 화면/시각화 방향은 이미 리뷰 후 보강 완료된 상태다.

초기 판단으로 PRD는 Epic coverage validation에 사용할 수 있을 만큼 완성도가 높다. 다만 구현 준비 관점에서는 오픈 질문 4개와 툴링 미확정 항목이 후속 아키텍처/스토리 수준에서 명시적으로 이어져야 한다.

## Epic Coverage Validation

### Epic FR Coverage Extracted

- Epic 1: ERP 운영 기준과 접근 통제 — FR4, FR5, FR6, FR7, FR8, FR9, FR34, FR35
- Epic 2: 콜 원장 입력과 방문완료 계산 — FR10, FR11, FR12, FR13, FR14, FR15
- Epic 3: 실시간 객실 현황과 TV 현황판 — FR1, FR2, FR16, FR17, FR18, FR19
- Epic 4: 일정산과 운영팀 인센 — FR20, FR21, FR22, FR23, FR24, FR25
- Epic 5: 월마감 확정, 잠금, 재오픈 — FR26, FR27, FR28, FR29, FR30
- Epic 6: 주인용 KPI와 시각화 대시보드 — FR3, FR31, FR32, FR33
- Epic 7: 엑셀 기능 매핑과 계산 대조 검증 — FR36, FR37

Total FRs in epics: 37

### Coverage Matrix

| FR Number | PRD Requirement | Epic Coverage | Status |
| --------- | --------------- | ------------- | ------ |
| FR-1 | 첫 화면 실시간 현황 | Epic 3 | Covered |
| FR-2 | 객실 카드 시각화 | Epic 3 | Covered |
| FR-3 | 주인용 그래프 대시보드 | Epic 6 | Covered |
| FR-4 | 운영월 관리 | Epic 1 | Covered |
| FR-5 | 객실 마스터 | Epic 1 | Covered |
| FR-6 | 직원 마스터 | Epic 1 | Covered |
| FR-7 | 코스 마스터 | Epic 1 | Covered |
| FR-8 | 수당과 인센 정책 관리 | Epic 1 | Covered |
| FR-9 | 코드와 시간 슬롯 관리 | Epic 1 | Covered |
| FR-10 | 서비스 콜 입력 | Epic 2 | Covered |
| FR-11 | 서비스 콜 상태 관리 | Epic 2 | Covered |
| FR-12 | 방문완료 계산 | Epic 2 | Covered |
| FR-13 | 할인 계산 | Epic 2 | Covered |
| FR-14 | D코스 2인 검증 | Epic 2 | Covered |
| FR-15 | 일별 지출과 콜 요약 | Epic 2 | Covered |
| FR-16 | 객실 상태 계산 | Epic 3 | Covered |
| FR-17 | 남은 시간과 종료확인 | Epic 3 | Covered |
| FR-18 | 웨이터 안내 문구 | Epic 3 | Covered |
| FR-19 | TV 현황판 | Epic 3 | Covered |
| FR-20 | 마사지사 출퇴근 입력 | Epic 4 | Covered |
| FR-21 | 마사지사 일일정산 | Epic 4 | Covered |
| FR-22 | 귀케어 근무상태 입력 | Epic 4 | Covered |
| FR-23 | 귀케어 일일정산 | Epic 4 | Covered |
| FR-24 | 운영팀 근무상태와 일일 인센 | Epic 4 | Covered |
| FR-25 | 운영팀 월 인센 미리보기 | Epic 4 | Covered |
| FR-26 | 월마감 미리보기 | Epic 5 | Covered |
| FR-27 | 만근수당 계산 | Epic 5 | Covered |
| FR-28 | 갯수왕 수당 계산 | Epic 5 | Covered |
| FR-29 | 월마감 확정과 잠금 | Epic 5 | Covered |
| FR-30 | 월마감 재오픈 | Epic 5 | Covered |
| FR-31 | 오늘 KPI 대시보드 | Epic 6 | Covered |
| FR-32 | 월간 KPI 대시보드 | Epic 6 | Covered |
| FR-33 | 주인용 시각화 리포트 | Epic 6 | Covered |
| FR-34 | 권한 역할 | Epic 1 | Covered |
| FR-35 | 감사 로그 | Epic 1 | Covered |
| FR-36 | 시트 기능 매핑표 | Epic 7 | Covered |
| FR-37 | 계산 대조 검증 | Epic 7 | Covered |

### Missing Requirements

누락된 PRD FR coverage 없음.

### Coverage Statistics

- Total PRD FRs: 37
- FRs covered in epics: 37
- Coverage percentage: 100%
- FRs in epics but not in PRD: 없음

## UX Alignment Assessment

### UX Document Status

Found.

Primary UX documents:
- `ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md` — status `final`
- `ux-designs/ux-vietnam_aesthetic-2026-06-07/EXPERIENCE.md` — status `final`

Supporting UX documents:
- `.decision-log.md`
- `review-accessibility.md`
- `review-rubric.md`
- `validation-report.md`
- `mockups/color-themes-1.html`
- `mockups/key-call-grid.html`
- `mockups/key-live-status.html`

### UX ↔ PRD Alignment

- PRD의 UJ-1, UJ-2, UJ-3, UJ-4가 UX Key Flows에 대응된다.
- PRD의 실시간 현황, 콜 원장, 웨이터 객실 현황, 월마감 흐름이 EXPERIENCE.md의 IA, Component Patterns, State Patterns, Key Flows에 반영되어 있다.
- PRD의 status 값(`사용중`, `예약`, `청소중`, `종료확인`, `빈방`)과 콜 상태(`방문완료`, `노쇼`, `취소`)는 UX에서 원문 보존 규칙으로 유지된다.
- PRD의 “카운터 입력 속도 보존” 요구는 편집 그리드, 키보드 이동, type-ahead, autosave, computed cell, D코스 인라인 검증으로 UX에 반영되어 있다.
- PRD의 “화려하지만 단순한 주인용 대시보드” 방향은 Royal Gold visual layer, KPI card, room card, chart/report surfaces로 반영되어 있다.

### UX ↔ Architecture Alignment

- Architecture는 Next.js App Router, shadcn/ui, Tailwind CSS v4, domain components(`RoomStatusCard`, `EditableCallGrid`, `StatusBadge`, `CallStateChip`, `MonthCloseStepper`, `SettlementEvidenceBlock`)로 UX 컴포넌트 요구를 지원한다.
- Architecture는 `src/app/(erp)/live`, `calls`, `rooms`, `tv`, `settlements`, `closing`, `dashboard`, `masters`, `audit` route 구조로 UX IA를 지원한다.
- Architecture는 room/TV status DTO 공유와 polling/auto-refresh를 통해 UX의 첫화면/객실현황/TV현황판 동일 계산 요구를 지원한다.
- Architecture는 Server Actions row autosave, domain service 계산, Zod validation, structured action result로 UX의 빠른 그리드 입력과 오류 상태를 지원한다.
- Architecture는 status label+glyph, D코스 `aria-invalid`/`aria-describedby`, reduced-motion pulse, shadcn Dialog focus trap/alertdialog 등 UX 접근성 요구를 직접 반영한다.
- Architecture는 월마감 스냅샷, 잠금, 재오픈, audit boundary를 통해 UX의 월마감 이중확인과 지급액 불변성 경험을 지원한다.

### Alignment Issues

No critical UX/PRD/Architecture misalignment found.

Minor observations:
- Architecture는 TV/room refresh를 v1 polling으로 결정했고, UX는 자동 갱신과 갱신 지연 표시를 요구한다. 이는 정렬되어 있으나 운영 피드백 후 SSE/WebSocket 전환 가능성이 남아 있다.
- Dashboard chart library는 Architecture에서 구현 시점으로 deferred 되어 있다. UX는 chart/report surface를 요구하므로 Epic 4 구현 시 차트 라이브러리 또는 CSS/table visual 방식의 최종 선택이 필요하다.
- UX validation artifacts(`validation-report.md`, `review-accessibility.md`, `review-rubric.md`)에는 이전 critical/high findings가 남아 있지만, `.decision-log.md` D8 및 현재 final `DESIGN.md`/`EXPERIENCE.md`는 해당 항목들이 resolved 되었음을 보여준다. 소비자는 final spine과 decision log를 canonical source로 사용해야 한다.

### Warnings

- UX folder is not a standard `index.md` shard. Final UX source files are clear, but automated consumers should explicitly load `DESIGN.md`, `EXPERIENCE.md`, and `.decision-log.md`.
- Implementers must not treat older validation-report findings as current blockers without checking final spine text; the report is useful historical evidence but stale against D8-resolved decisions.
- Implementation readiness still depends on minor architecture follow-ups: test runner/e2e framework, hosting/backup/migration approval flow, and chart library selection.

## Epic Quality Review

### Review Scope

- Epics reviewed: 7
- Stories reviewed: 38
- Story format check: all 38 stories include `As a`, `I want`, `So that`.
- Acceptance criteria structure: all 38 stories use Given/When/Then criteria.
- Forward-reference review: no blocking dependency on a later epic was found in the current sequence.

### Epic Structure Validation

| Epic | User Value | Independence | Traceability | Result |
| ---- | ---------- | ------------ | ------------ | ------ |
| Epic 1: ERP 운영 기준과 접근 통제 | Pass | Pass | Pass | Pass with starter-template exception |
| Epic 2: 콜 원장 입력과 방문완료 계산 | Pass | Pass; uses Epic 1 output | Pass | Pass |
| Epic 3: 실시간 객실 현황과 TV 현황판 | Pass | Pass; uses Epic 1 and 2 output | Pass | Pass |
| Epic 4: 일정산과 운영팀 인센 | Pass | Pass; uses Epic 1 and 2 output | Pass | Pass |
| Epic 5: 월마감 확정, 잠금, 재오픈 | Pass | Pass; uses Epic 1/2/4 output | Pass | Pass |
| Epic 6: 주인용 KPI와 시각화 대시보드 | Pass | Pass; uses Epic 1-5 output | Pass | Pass |
| Epic 7: 엑셀 기능 매핑과 계산 대조 검증 | Pass | Pass as validation/release-readiness epic after prior features | Pass | Pass |

### Critical Violations

No critical epic-quality violations found in the current `epics.md`.

### Major Issues

No major story-quality issues found.

### Minor Concerns

- Story 1.1 is partly technical setup, but this is acceptable because the Architecture specifies an official Next.js starter and the workflow explicitly requires Epic 1 Story 1 to set up the initial project from the starter template.
- Several stories have 9-10 Given/When/Then blocks. They are still cohesive, but Story 2.6, Story 3.5, and Story 5.6 should be watched during implementation planning for possible split if estimates become too large.
- Epic 7 is QA/release-readiness oriented rather than direct operator workflow, but it maps to explicit PRD requirements FR-36 and FR-37 and is justified by the product’s “Excel function preservation 100%” success criterion.

### Dependency Analysis

- Epic 1 creates the starter/app shell, auth/RBAC, audit base, operating month, room, code, employee, course/rate/incentive policy foundations.
- Epic 2 depends only on Epic 1 masters/code/audit/auth outputs.
- Epic 3 depends only on Epic 1/2 call and room outputs.
- Epic 4 depends on Epic 1/2 call, staff, policy, code, and audit outputs and does not require future epics.
- Epic 5 depends on Epic 4 settlement outputs and does not require future epics.
- Epic 6 intentionally comes after settlement and closing work, so dashboard stories can consume call, room, settlement, monthly close, and snapshot outputs without forward dependency.
- Epic 7 depends on implemented features and tests from prior epics, which is acceptable for a validation/release-readiness epic.

### Database/Entity Creation Timing

- No story creates all database tables upfront as a standalone technical milestone.
- Entity/model creation appears tied to the first story that needs each domain object: account/employee/policies in Epic 1, calls in Epic 2, room DTO/status in Epic 3, settlement entities in Epic 4, close snapshots in Epic 5, dashboard query DTOs in Epic 6, validation fixtures in Epic 7.
- This satisfies the “tables created when first needed” principle at planning level.

### Best Practices Compliance Checklist

| Check | Result |
| ----- | ------ |
| Epics deliver user value | Pass, except Epic 1 Story 1 technical setup is allowed by starter requirement |
| Epic independence | Pass |
| Stories appropriately sized | Mostly pass; monitor 9-10 AC stories |
| No forward dependencies | Pass |
| Database tables created when needed | Pass |
| Clear acceptance criteria | Pass |
| Traceability to FRs maintained | Pass |

## Summary and Recommendations

### Overall Readiness Status

READY WITH MINOR IMPLEMENTATION GATES

The epic/story plan is implementation-ready from a sequencing and story-quality perspective. PRD extraction is complete, FR coverage is 100%, UX and Architecture are aligned, and the current epic order avoids forward dependencies by placing dashboard work after settlement and monthly-close foundations.

### Critical Issues Requiring Immediate Action

None.

### Recommended Next Steps

1. Keep the current epic ordering.
   - Epic 4 settlement, Epic 5 closing, and Epic 6 dashboard sequencing is now coherent.

2. Clean up UX artifact authority.
   - Keep `DESIGN.md`, `EXPERIENCE.md`, and `.decision-log.md` as canonical.
   - Either refresh stale validation artifacts or clearly mark them as historical pre-fix review output.

3. Confirm minor implementation gates before the first dev story.
   - Test runner and e2e framework.
   - Hosting/DB hosting, backup retention, migration approval flow.
   - Dashboard chart approach or chart library.

4. Watch story sizing during implementation planning.
   - Story 2.6, Story 3.5, and Story 5.6 have 10 AC blocks and may need splitting if estimates become large.

### Final Note

This assessment found no critical or major epic-quality blockers in the current plan. Remaining items are implementation-entry gates and minor planning hygiene, not reasons to block Phase 4.

**Assessment Date:** 2026-06-08
**Assessor:** Codex via `bmad-check-implementation-readiness`

## Final Readiness Assessment

### Overall Readiness Status

READY.

Implementation can proceed to Phase 4 after confirming the minor implementation-entry gates below. The core planning artifacts are aligned: required documents exist, PRD requirements are complete enough for traceability, all 37 PRD FRs are covered by epics, UX and Architecture are aligned, and the current epic order avoids forward dependencies.

### Critical Issues Requiring Immediate Action

None.

### Findings Summary

- Document discovery: no missing required artifact type and no whole/sharded duplicate conflict. PRD and UX are folder-based document sets rather than standard `index.md` shards.
- PRD analysis: 37 FRs and 15 NFRs extracted. PRD is `final` and suitable as the traceability baseline.
- Epic coverage: 37/37 PRD FRs covered. No extra FRs in epics outside the PRD.
- UX alignment: no critical UX/PRD/Architecture mismatch. Current `DESIGN.md` and `EXPERIENCE.md` resolve earlier accessibility/flow findings.
- Epic quality: 7 epics and 38 stories reviewed. No critical or major epic-quality blockers found.

### Recommended Next Steps

1. Treat `DESIGN.md`, `EXPERIENCE.md`, and their decision log as canonical UX sources; mark older UX validation artifacts as historical or refresh them.
2. Confirm implementation tooling before Story 1.1: test runner, e2e framework, and any lint/format decisions not covered by the starter.
3. Confirm deployment gates: hosting/DB hosting, backup retention, restore expectations, and migration approval flow.
4. Confirm dashboard rendering approach when Epic 6 starts: lightweight chart library vs CSS/table visualizations.
5. Confirm source `sheet.xlsx` migration period/range before data migration and fixture work.
6. Watch Story 2.6, Story 3.5, and Story 5.6 for possible split if estimates become too large.

### Final Note

This assessment identified 0 critical issues and 6 non-blocking implementation-entry items across artifact hygiene, tooling, operations, dashboard implementation, data migration, and story sizing. Proceeding is reasonable once those entry items are assigned or explicitly accepted.

**Assessment Date:** 2026-06-08
**Assessor:** Codex via `bmad-check-implementation-readiness`
