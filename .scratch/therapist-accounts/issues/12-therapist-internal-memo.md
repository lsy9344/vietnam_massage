# 12: Therapist 내부 메모

**What to build:** 직원 화면의 Therapist 패널 안에 관리자만 쓰고 보는 내부 메모를 둔다. 날짜와 작성자가 붙은 기록이 쌓이고, 고치거나 지울 수 없다. (스펙 D27, D28, D29, M5, M18, M24. 나누기 전 티켓 10)

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 메모 표(Therapist 직원, 작성 계정, 본문, 작성 시각)를 둔다. 더하기만 하는 마이그레이션이고, 운영 DB 적용은 사용자 확인 뒤에 한다.
- [ ] 직원 화면에서 Therapist를 고르면 패널에 내부 메모 목록(최신순)과 추가 입력이 있다. 각 기록에는 날짜, 작성자, 내용이 있다.
- [ ] 추가만 할 수 있다. 수정이나 삭제는 없다.
- [ ] `therapist:manage`를 가진 관리자만 읽고 쓴다(M18). 정산 담당, 카운터, 웨이터, 조회 전용, Therapist 본인은 메모를 읽거나 쓸 수 없다. 화면에서도, 서버 액션을 직접 불러도 마찬가지다.
- [ ] Therapist 화면의 어떤 응답에도 내부 메모가 들어가지 않는다.
- [ ] 추가가 감사에 남는다.
- [ ] 새 문구는 ko·vi 두 언어로 있다.
- [ ] 단위 테스트, tsc, E2E가 통과한다.
  - Therapist 모듈 서비스(메모리 Prisma): 추가와 최신순 목록, 감사
  - E2E 거절: 정산 담당과 therapist 역할이 메모를 읽을 수 없다.

## Comments

- 새 표 `TherapistInternalMemo`(마이그레이션 `prisma/migrations/20261020121200_add_therapist_internal_memos`)와 모듈 `src/modules/therapists/therapist-memo-service.ts`(`addTherapistMemo`, `listTherapistMemos`, `listTherapistMemosByEmployeeIds`) + `therapist-memo-schema.ts`(`addTherapistMemoSchema`)를 만들었다. 작성자 표시 이름은 새로 만들지 않고 `src/modules/audit/audit-service.ts`의 `listAuditActors`를 그대로 재사용한다(M1).
  - `addTherapistMemo`는 대상 직원이 `employeeGroup === "THERAPIST"`인지 다시 확인한다(패널이 그 구분일 때만 보이지만, 서버 액션 직접 호출에 대한 방어). 없는 직원은 기존 코드 `EMPLOYEE_NOT_FOUND`를 재사용하고, Therapist가 아닌 직원은 새 코드 `THERAPIST_MEMO_EMPLOYEE_NOT_THERAPIST`.
  - 감사는 `therapist_memo.added`(targetType `therapist_internal_memo`, afterValue에 `employeeId`·`body`)로 저장과 같은 트랜잭션에서 남긴다. `audit-view-model.ts`에 그 targetType의 라벨과 원본 화면 링크(그 Therapist의 `/masters/employees` 패널)를 더했다.
- 화면: `src/app/(erp)/masters/employees/therapist-memo-panel.tsx`(목록·추가 폼, 추가 성공 시 key를 올려 입력칸만 비운다)와 `therapist-memo-actions.ts`(`addTherapistMemoAction`, `therapist:manage` 권한 확인)를 새 파일로 두고, `employee-forms.tsx`에는 `employee.employeeGroup === "THERAPIST" && therapistMemos`일 때 `<TherapistMemoPanel .../>` 한 줄만 끼웠다(02의 계정 연결 영역과 겹치지 않게 linkedAccount 섹션과 details 섹션 사이에 둠).
- 권한 경계(요청 사항): 메모는 `page.tsx`의 데이터 로드 단계에서 `canPerform(account.role, "therapist:manage")`를 확인하고 통과할 때만 `listTherapistMemosByEmployeeIds`를 부른다. 통과하지 못하면 `therapistMemosByEmployeeId`가 `null`이라 그 계정에는 메모가 서버 응답에 전혀 담기지 않는다(화면에서 숨기는 게 아니라 조회 자체를 안 한다). `/masters/employees` 라우트 자체가 이미 `administrator`만 허용하므로(기존 `routes.ts`) 이중 방어다.
- 가정: 메모는 대상 직원의 재직·휴직·퇴사 여부를 보지 않는다(비활성 Therapist에 대한 과거 메모도 남길 수 있어야 한다고 보았다. D27/패널 선택 로직과 일치).
- 검증
  - `pnpm test:unit`: 1050 pass, 0 fail (새 `therapist-memo-service.test.ts` 11건 포함).
  - `npx tsc --noEmit`: 0 errors.
  - 검증 스크립트: `validate-story-4-6.mjs`만 기존 실패, 그 외 전부 통과.
  - 운영 빌드 E2E(DB `vietnam_aesthetic_th12`, 포트 3212): 새 스펙 `story-ticket-12-therapist-internal-memo.spec.ts` 3건 통과(관리자 추가·최신순·감사, 정산 담당 화면 접근 차단, 정산 담당·therapist 세션으로 서버 액션 재전송 거절). 관련 기존 스펙도 같이 돌렸다: `story-1-7-employees-master.spec.ts`(1건 실패 — 기존 문제, 아래 참고), `story-1-3-audit-log.spec.ts`(전부 통과), `story-ticket-01-therapist-role-shell.spec.ts`(전부 통과).
  - 기존 실패로 본 것: `story-1-7-employees-master.spec.ts:132`가 `staffCode: {startsWith:"THR-"}` 직원 수를 50으로 기대하는데 51이 나와 실패했다. 원인은 01이 `scripts/seed-dev-accounts.ts`에 더한 Therapist 데모 계정의 staffCode `"THR-E2E-001"`이 그 접두사에 걸리는 것으로, 이 티켓이 만들거나 건드린 코드와 무관하다(내 테스트 직원 staffCode는 `E2E-T12-THR-1`로 그 접두사에 걸리지 않음). `seed-dev-accounts.ts`와 그 스펙 파일은 고치지 않았다(01 소유 파일이라 범위 밖으로 봄).
