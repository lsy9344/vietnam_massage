# 10: 공지 — 대상, 읽음, 내리기

**What to build:** 관리자가 Therapist 전체나 특정 Therapist 한 명에게 공지를 보내고, Therapist는 공지 탭에서 읽는다. 관리자는 누가 읽었는지 보고, 보낸 공지는 내리기만 할 수 있다. (스펙 D25, D28, D29, M4, M5, M18, M24. 나누기 전 티켓 08)

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 공지 표(작성 계정, 본문, 대상 종류, 대상 직원, 보낸 시각, 내린 시각, 내린 계정)와 받는 사람 표(공지, Therapist 직원, 읽은 시각)를 둔다. 더하기만 하는 마이그레이션이고, 운영 DB 적용은 사용자 확인 뒤에 한다.
- [ ] 공지는 `therapist:manage`를 가진 관리자만 보낸다(M18). 관리자 공지 화면은 운영팀 라우트 목록에 관리자 전용으로 올린다.
  - 대상은 Therapist 전체 또는 Therapist 한 명이다.
  - 본문은 쓴 그대로 보이고 번역하지 않는다.
- [ ] 받는 사람 줄은 보낼 때 만든다. 전체 공지는 그 시점의 활성 Therapist 계정 기준이다.
- [ ] Therapist의 공지 탭에는 나에게 온 공지가 최신순으로 보인다.
  - 열면 읽음으로 기록된다.
  - 읽지 않은 수가 탭에 숫자로 보인다(01이 둔 자리).
- [ ] 관리자는 공지마다 대상 인원, 읽은 사람, 읽지 않은 사람을 본다.
- [ ] 보낸 공지는 고칠 수 없다. 내리면 Therapist에게 보이지 않지만, 관리자 목록과 기록에는 "내림"으로 남는다.
- [ ] 답장 기능은 없다.
- [ ] 보내기와 내리기가 감사에 남는다.
- [ ] Therapist 쪽은 01의 Therapist 검사가 돌려준 직원 id로만 읽고, 01의 새로고침 공통 조각을 쓴다.
- [ ] 새 문구는 ko·vi 두 언어로 있다. 390px에서 가로 스크롤이 0이다.
- [ ] 단위 테스트, tsc, E2E가 통과한다.
  - Therapist 모듈 서비스(메모리 Prisma): 받는 사람 고정, 읽음 기록, 읽지 않은 수, 내린 공지 숨김, 감사
  - E2E: 특정 Therapist 공지가 다른 Therapist에게 보이지 않고, 읽음 기록이 남는다.
  - E2E 거절: 정산 담당과 therapist 역할이 보내기 액션을 직접 부르면 거절된다.

## Comments

- 만듦: `src/modules/therapists/therapist-notice-service.ts`(`sendTherapistNotice`, `withdrawTherapistNotice`, `listTherapistNoticesForAdmin`, `listTherapistNoticeTargetOptions`, `listTherapistNoticesForEmployee`, `countUnreadTherapistNotices`, `markTherapistNoticeRead`, `TherapistNoticeDomainError`). 스키마 `prisma/schema.prisma`의 `TherapistNotice`·`TherapistNoticeRecipient` + 마이그레이션 `20261020121000_add_therapist_notices`(더하기만, CHECK 3개 — 대상 종류, 대상·대상직원 일치, 내림·내린 계정 일치). 운영 DB 적용은 아직 안 함.
- 관리자 화면: `/settlements/notices`(`src/app/(erp)/settlements/notices/{page,notice-workspace,actions,notice-action-error}.tsx|ts`). `src/lib/routes.ts`의 settlements 구역에 `administrator`만 접근하는 탭으로 더했다(`shell.tab.therapistNotices`="공지"). 보내기·내리기는 `therapist:manage` 권한.
- Therapist 화면: `src/app/therapist/notices/{page,actions}.tsx|ts`, `src/components/therapist/therapist-notice-list.tsx`(목록 행 카드, design.md 6.10 — 눌러 `ModalPanel`로 열고 그 순간 읽음 기록). `src/app/therapist/layout.tsx`가 01이 둔 `TherapistTabBar`의 `noticeUnreadCount` 자리에 실제 값을 넘긴다.
- 가정: 대상 종류 저장값은 CONTEXT.md 공지 용어("Therapist 전체 또는 특정 Therapist")를 그대로 따 "전체"·"특정" 두 코드 문자열로 뒤에 썼다(다른 코드처럼 영문 코드가 아니라 한국어 문자열 — 기존 `방식`·`상태` 칸들과 같은 관례). 공지 목록은 매번 받는 사람 전원(이름 포함)을 함께 돌려준다 — 목록 규모가 작아(Therapist 수십 명) 펼침마다 다시 불러오는 별도 "상세 조회" 함수를 두지 않았다.
- 검증: `pnpm test:unit` 1059 passed, 0 failed(병합 뒤). `npx tsc --noEmit` 에러 없음. `for f in scripts/validate-story-*.mjs; do ...; done` → `validate-story-4-6.mjs`만 실패(기존 실패). E2E는 전용 DB `vietnam_aesthetic_th10`·포트 3210, 운영 빌드로 돌렸다: 새 스펙 `tests/e2e/story-ticket-10-therapist-notices.spec.ts` 3개 통과, 직접 관련된 기존 스펙 `story-ticket-01-therapist-role-shell.spec.ts`(6개)·`story-shell-workflow-dock.spec.ts`(18개, 새 "공지" 탭을 반영해 한 줄 고침) 24개 모두 통과, 새 실패 없음. 끝나고 서버를 끄고 DB를 지웠다.
