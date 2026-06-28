---
title: "Sprint Change Proposal: Epic 4 순서 조정"
project: "vietnam_aesthetic"
date: "2026-06-08"
status: "approved"
workflow: "bmad-correct-course"
mode: "incremental"
approved_by: "noah"
approved_at: "2026-06-08 01:19:12 KST"
---

# Sprint Change Proposal: Epic 4 순서 조정

## 1. Issue Summary

구현 준비성 점검 결과, 현재 `epics.md`의 Epic 4 `주인용 KPI와 시각화 대시보드`가 이후 Epic 5 `일정산과 운영팀 인센`, Epic 6 `월마감 확정, 잠금, 재오픈`의 산출물에 의존하는 것으로 확인되었다.

이 문제는 `_bmad-output/planning-artifacts/implementation-readiness-report-2026-06-08.md`에서 critical issue로 식별되었다. 구체적으로 Story 4.2는 월마감 확정 스냅샷 조회를 요구하지만 스냅샷은 Epic 6에서 생성되고, Story 4.3은 마사지사 정산 순위와 운영팀 인센/월마감 지급 구성 그래프를 요구하지만 해당 계산 기반은 Epic 5와 Epic 6에서 구현된다.

현재 순서대로 구현하면 팀은 다음 둘 중 하나를 선택해야 한다.

- Epic 4 구현 중 Epic 5/6 산출물이 없어 막힌다.
- 아직 구현되지 않은 정산/월마감 데이터를 `준비 중` 또는 placeholder로 표시하면서 FR-3, FR-32, FR-33이 완료된 것처럼 오인할 수 있다.

따라서 Phase 4 implementation 진입 전 Epic 순서를 조정해야 한다.

## 2. Impact Analysis

### Epic Impact

- Epic 4는 현재 위치에서 독립적으로 완료할 수 없다.
- Epic 5와 Epic 6 자체 요구사항은 유지 가능하며, 순서를 앞당기면 Architecture의 데이터 흐름과 일치한다.
- Epic 7은 검증/release-readiness 성격이므로 마지막 위치를 유지한다.

권장 순서:

```text
Epic 1: ERP 운영 기준과 접근 통제
Epic 2: 콜 원장 입력과 방문완료 계산
Epic 3: 실시간 객실 현황과 TV 현황판
Epic 4: 일정산과 운영팀 인센
Epic 5: 월마감 확정, 잠금, 재오픈
Epic 6: 주인용 KPI와 시각화 대시보드
Epic 7: 엑셀 기능 매핑과 계산 대조 검증
```

### Story Impact

Story 번호 재정렬이 필요하다.

- 기존 `Story 5.1-5.6` -> `Story 4.1-4.6`
- 기존 `Story 6.1-6.6` -> `Story 5.1-5.6`
- 기존 `Story 4.1-4.4` -> `Story 6.1-6.4`

내부 story reference도 함께 정정해야 한다.

- 기존 Story 6.2의 `Story 5.1` 참조 -> 새 `Story 4.1`
- 기존 Story 6.6의 `Story 6.3` 참조 -> 새 `Story 5.3`
- 기존 Story 4.3은 새 `Story 6.3`으로 이동하며, `관련 데이터가 아직 구현되지 않았거나` acceptance path를 제거한다.

### Artifact Conflicts

- PRD: 변경 필요 없음. MVP 범위와 FR 정의는 유지된다.
- Epics: 변경 필요 있음. Epic 순서, FR Coverage Map, Story 번호, 내부 참조를 수정해야 한다.
- Architecture: 변경 필요 없음. 이미 `masters -> calls -> rooms -> settlements -> closing -> dashboard` 흐름을 명시하고 있어 이번 변경과 일치한다.
- UX Design: 변경 필요 없음. 대시보드 UX 요구는 유지되며 구현 순서만 조정된다.
- Project knowledge docs: 변경 필요 없음. `docs/modules/dashboard.md`도 dashboard가 `calls`, `settlements`, `closing`을 읽는다고 명시한다.
- Sprint status file: 현재 저장소에서 `sprint-status.yaml` 또는 `sprint-status.yml`은 발견되지 않았다. 별도 상태 파일이 나중에 생성되면 승인된 Epic 번호와 story 번호를 반영해야 한다.

### Technical Impact

코드 구현 변경은 아직 없다. 이번 변경은 backlog/planning artifact 정리다.

기술적 효과:

- dashboard query service가 정산/월마감 결과를 읽는 구조가 자연스러워진다.
- dashboard component가 settlement/closing 계산을 직접 재구현할 위험이 줄어든다.
- 확정 스냅샷 조회 요구가 스냅샷 생성 story 이후에 배치된다.

## 3. Recommended Approach

권장 경로는 **Direct Adjustment**다.

Epic 4를 분리하는 대안도 가능하지만, 현재 Epic 4의 핵심 가치가 오늘/월간 KPI, 정산 순위, 인센 흐름, 확정 스냅샷 조회를 한 화면 흐름으로 묶는 데 있으므로 분리하면 FR traceability와 story 의미가 더 복잡해진다.

권장 변경은 Epic 4를 Epic 6 뒤로 통째 이동하고 번호를 재정렬하는 것이다.

- Effort: Medium
- Risk: Low to Medium
- Timeline impact: 구현 전 문서 정리 작업이므로 단기 영향은 작다.
- Scope impact: MVP scope 변경 없음.
- Handoff classification: Moderate. backlog 재정렬과 story reference 정정이 필요하므로 Product Owner/Developer coordination 대상이다.

## 4. Detailed Change Proposals

### Proposal A: Epic 순서와 FR Coverage Map 수정

Status: user-approved draft proposal

Artifact: `_bmad-output/planning-artifacts/epics.md`

Sections:

- `FR Coverage Map`
- `Epic List`
- Epic/Story body headings

OLD:

```text
Epic 4: 주인용 KPI와 시각화 대시보드
Epic 5: 일정산과 운영팀 인센
Epic 6: 월마감 확정, 잠금, 재오픈
Epic 7: 엑셀 기능 매핑과 계산 대조 검증
```

NEW:

```text
Epic 4: 일정산과 운영팀 인센
Epic 5: 월마감 확정, 잠금, 재오픈
Epic 6: 주인용 KPI와 시각화 대시보드
Epic 7: 엑셀 기능 매핑과 계산 대조 검증
```

Required FR map updates:

- `FR3`: Epic 4 -> Epic 6
- `FR31`: Epic 4 -> Epic 6
- `FR32`: Epic 4 -> Epic 6
- `FR33`: Epic 4 -> Epic 6
- `FR20-FR25`: Epic 5 -> Epic 4
- `FR26-FR30`: Epic 6 -> Epic 5

Required story renumbering:

- Existing `Story 5.1-5.6` -> `Story 4.1-4.6`
- Existing `Story 6.1-6.6` -> `Story 5.1-5.6`
- Existing `Story 4.1-4.4` -> `Story 6.1-6.4`

Rationale:

Dashboard stories must consume completed call, settlement, and monthly close snapshot outputs. Moving dashboard after settlement and closing removes the forward dependency while preserving PRD coverage.

### Proposal B: Story 6.3 readiness/empty-state acceptance criterion tighten

Status: user-approved draft proposal

Artifact: `_bmad-output/planning-artifacts/epics.md`

Story: existing `Story 4.3` -> new `Story 6.3: 주인용 그래프 리포트`

Section: Acceptance Criteria

OLD:

```text
Given 운영팀 인센 달성률 또는 월마감 지급 구성 그래프가 표시된다
When 관련 데이터가 아직 구현되지 않았거나 운영월에 없다
Then 빈 상태 또는 준비 중 상태를 명확하게 표시한다
And 존재하지 않는 데이터를 임의로 꾸며 표시하지 않는다.
```

NEW:

```text
Given 운영팀 인센 달성률 또는 월마감 지급 구성 그래프가 표시된다
When 선택한 운영월에 운영팀 인센 데이터가 없거나 월마감 확정 스냅샷이 아직 없다
Then 데이터 없음 또는 미확정 상태를 명확하게 표시한다
And 존재하지 않는 데이터를 임의로 꾸며 표시하거나 완료된 지표처럼 취급하지 않는다.
```

Rationale:

`관련 데이터가 아직 구현되지 않았거나`는 미구현 기능을 정상 acceptance path처럼 보이게 할 수 있다. Dashboard epic이 settlement/closing 이후로 이동하면 구현 기반은 존재해야 하므로, 이 기준은 운영 데이터 없음 또는 마감 미확정 상태만 다루도록 좁힌다.

## 5. Implementation Handoff

### Scope Classification

Moderate.

이 변경은 제품 범위나 아키텍처를 다시 설계하는 major replan은 아니다. 하지만 Epic 번호, FR coverage, story 번호, 내부 참조가 함께 움직이므로 단순 개발 story 하나로 처리하기보다 backlog/planning artifact 정리로 다뤄야 한다.

### Recommended Recipients

- Product Owner / PM: Epic 순서 변경과 FR Coverage Map 정합성 확인
- Developer agent: `epics.md`의 번호 재정렬, 내부 참조 정정, 변경 후 readiness 재검증
- Architect: 별도 action 없음. 단, 변경 후 Architecture의 `settlements -> closing -> dashboard` 흐름과 epics 순서가 일치하는지 spot-check

### Implementation Tasks

1. `epics.md`에서 Epic 4/5/6 순서를 재정렬한다.
2. FR Coverage Map을 새 Epic 번호에 맞춘다.
3. Story heading 번호와 내부 참조를 새 번호에 맞춘다.
4. 기존 Story 4.3의 미구현 데이터 acceptance path를 Proposal B 문구로 교체한다.
5. 변경 후 `implementation-readiness` 관점으로 Epic independence와 FR traceability를 다시 검증한다.
6. 별도 sprint status 파일이 생성되어 있다면 새 Epic/Story 번호를 반영한다.

### Success Criteria

- Epic 1-7 순서가 Architecture data flow와 일치한다.
- Dashboard epic은 settlement와 closing 구현 이후에 배치된다.
- FR-3, FR-31, FR-32, FR-33은 새 dashboard epic에 trace된다.
- FR-20-FR30은 새 settlement/closing epic 번호에 trace된다.
- Story acceptance criteria에서 미구현 기능을 완료처럼 인정하는 문구가 제거된다.
- Readiness report의 critical dependency violation이 해소된다.

## 6. Checklist Summary

- [x] 1.1 Triggering source identified: `implementation-readiness-report-2026-06-08.md`
- [x] 1.2 Core problem defined: Epic 4 forward dependency on settlement/closing outputs
- [x] 1.3 Evidence collected: readiness report, `epics.md`, `architecture.md`, module docs
- [x] 2.1 Current epic evaluated: Epic 4 cannot complete as originally sequenced
- [x] 2.2 Epic-level change identified: move dashboard after closing
- [x] 2.3 Remaining epics reviewed: Epic 5/6 remain viable, Epic 7 remains final validation
- [x] 2.4 New epic need checked: no new epic required
- [x] 2.5 Priority/order checked: Epic resequencing required
- [x] 3.1 PRD checked: no PRD change required
- [x] 3.2 Architecture checked: no conflict; existing architecture supports change
- [x] 3.3 UX checked: no UX change required
- [x] 3.4 Other artifacts checked: no sprint status file found
- [x] 4.1 Direct Adjustment evaluated: viable and recommended
- [x] 4.2 Rollback evaluated: not applicable; no completed implementation to revert
- [x] 4.3 MVP Review evaluated: not required; MVP unchanged
- [x] 4.4 Recommended path selected: Direct Adjustment
- [x] 5.1 Issue summary drafted
- [x] 5.2 Epic/artifact impact documented
- [x] 5.3 Recommended path documented
- [x] 5.4 MVP impact and action plan defined
- [x] 5.5 Agent handoff plan established
- [x] 6.1 Checklist completion reviewed
- [x] 6.2 Sprint Change Proposal accuracy verified
- [x] 6.3 Explicit user approval obtained: `yes`
- [x] 6.4 Sprint status update checked: no `sprint-status.yaml` or `sprint-status.yml` found in current workspace
- [x] 6.5 Handoff plan confirmed

## 7. Approval

Approved by noah on 2026-06-08 01:19:12 KST.

Approval decision:

- Proceed with Moderate-scope backlog/planning artifact adjustment.
- Route to Product Owner / PM and Developer agent for `epics.md` resequencing and validation.

## 8. Workflow Execution Log

- 2026-06-08 01:19:12 KST: User approved Sprint Change Proposal with `yes`.
- Scope classification: Moderate.
- Handoff recipients: Product Owner / PM, Developer agent; Architect spot-check optional.
- 2026-06-08 01:19 KST: Proposal A and Proposal B applied to `_bmad-output/planning-artifacts/epics.md`.
- 2026-06-08 01:19 KST: Targeted implementation-readiness recheck passed for Epic order, FR coverage map, story numbering, internal story references, and the narrowed dashboard empty-state criterion.
- Follow-up action: full implementation-readiness workflow can be rerun before Phase 4 if a refreshed comprehensive report is needed.
