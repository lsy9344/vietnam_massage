# 01: Therapist 역할과 빈 Therapist 화면

**What to build:** `therapist` 역할을 더한다. therapist 계정으로 로그인하면 운영팀 도크가 없는 네 탭짜리 빈 Therapist 화면으로 간다. 운영팀 화면과 서버 액션은 모두 거절한다. 계정 발급 화면은 02에서 만들고, 이 티켓은 E2E 시드 계정으로 확인한다. 마이그레이션은 없다. (스펙 D2, D6–D9, M14–M18, M22. 나누기 전 티켓 01의 앞부분)

**Blocked by:** 없음 (바로 시작)

**Status:** ready-for-agent

- [ ] 역할 목록에 `therapist`를 더한다. 이 역할은 민감 권한이 없다. 역할 칸은 문자열이라 스키마를 바꾸지 않는다.
- [ ] Therapist 화면(오늘, 근태, 수당, 공지)을 기존 라우트 목록에 therapist 전용으로 올린다.
  - therapist의 첫 화면은 오늘 탭이다.
  - 운영팀 도크의 구역 계산에는 섞이지 않는다.
  - therapist가 운영팀 화면 주소(TV 포함)를 열면 Therapist 첫 화면으로 보내진다. 되돌이가 생기지 않는다.
- [ ] Therapist 화면과 Therapist 서버 액션은 검사 하나를 거친다(M17). 세션 계정이 활성이고, 역할이 therapist이고, 연결된 직원이 Therapist 구분이며 퇴사가 아니어야 한다. 통과하면 계정 id와 직원 id를 돌려준다. 비밀번호 변경 필요 표시는 02가 이 검사에 더한다.
- [ ] 관리자만 가진 새 민감 권한 `therapist:manage`를 더한다. 10, 11, 12가 쓴다.
- [ ] Therapist 화면은 운영팀 레이아웃과 다른 레이아웃을 쓴다.
  - 아래 탭은 오늘, 근태, 수당, 공지 네 개다. 탭 내용은 비어 있다(03–10이 채운다). 공지 탭에는 숫자 자리를 둔다.
  - 오른쪽 위 "나" 메뉴에 내 이름, 직원 코드, 전화번호가 보이고 고칠 수 없다. 메뉴에는 언어와 로그아웃이 있다. 비밀번호 변경은 02가 더한다.
- [ ] 자동 새로고침을 하지 않는 공통 조각을 둔다(D8). 화면을 열 때, 화면으로 돌아올 때(visibility), 새로고침 버튼을 누를 때만 새로 읽고, 마지막 갱신 시각을 보인다. 03–10이 이 조각을 쓴다.
- [ ] 처음 언어는 베트남어다(앱 기본값 그대로). 한국어로 바꿀 수 있다. 홈 화면에 추가해 열면 Therapist 첫 화면이 나온다.
- [ ] E2E 시드에 Therapist 구분 직원과 연결된 therapist 계정 하나를 기존 역할 계정과 같은 방식으로 더한다.
- [ ] 기존 라우트 테스트와 권한 테스트에 therapist 줄을 더한다. 확인할 것은 다섯 가지다.
  - Therapist 화면 밖의 모든 화면이 거절된다.
  - 첫 화면이 오늘 탭이다.
  - 도크 구역이 없다.
  - 민감 권한이 없다.
  - `therapist:manage`는 관리자에게만 있다.
- [ ] 새 문구는 ko·vi 두 언어로 있다(vi에서 Therapist는 "KTV"). 루트 `design.md`를 따른다. 390px 폭에서 가로 스크롤이 0이다.
- [ ] 단위 테스트, tsc, E2E가 통과한다. E2E가 확인할 것은 세 가지다.
  - 시드 계정으로 로그인하면 베트남어 빈 Therapist 화면이 뜬다.
  - 운영팀 화면 주소를 열면 첫 화면으로 보내진다.
  - 운영팀 서버 액션을 직접 부르면 거절된다. 운영팀 세션에서 잡은 액션 요청을 therapist 세션 쿠키로 다시 보내서 확인한다.

## Comments

뒤 티켓이 바로 쓸 수 있게 만든 조각과 위치(이름을 분명히 지었다):

- **역할·권한**: `src/lib/authorization.ts`의 `roles`에 `"therapist"` 추가, `SensitivePermission`에 `"therapist:manage"` 추가(관리자만, `rolePermissions.administrator`). `src/modules/masters/account-service.ts`의 `validRoles`에도 `"therapist"`를 더해 로그인·세션이 인식한다. **가정**: `src/modules/masters/employee-schema.ts`의 `accountRoles`(직원 화면의 "연결 계정" 역할 선택지, employee-forms.tsx)는 건드리지 않았다 — 그 화면에 therapist가 선택지로 뜨면 THERAPIST 구분이 아닌 직원에게도 역할을 줄 수 있게 되어 D26을 어긴다. 02가 전용 발급 화면에서 그 제약을 구현한 뒤 따로 연다.
- **M17 검사**: `src/modules/therapists/therapist-access-service.ts`의 `requireTherapistAccess()` — Therapist 화면·서버 액션이 공통으로 부르는 단일 함수. `{accountId, employeeId}`를 돌려준다. 내부 순수 조각 `isTherapistEmployee(employeeId, {prismaClient})`는 메모리 Prisma로 단위 테스트했다(`therapist-access-service.test.ts`). 세션 무효/비활성·잠금이면 `/sign-in`, 역할이 therapist가 아니면 그 역할의 첫 화면, role은 therapist인데 직원 연결이 깨졌으면(드문 경우) `/sign-in`으로 보내 되돌이를 막는다.
- **"나" 메뉴용 정보**: `src/modules/therapists/therapist-profile-service.ts`의 `getTherapistProfile(employeeId)` — 이름·직원코드·전화번호만 고른다(M6).
- **라우트**: `src/lib/routes.ts`에 zone `"therapist"`와 4개 경로(`/therapist`, `/therapist/attendance`, `/therapist/payout`, `/therapist/notices`, 이 순서가 탭 순서)를 더했다. `getRoleLandingPath("therapist") === "/therapist"`. 기존 `canAccessRoute`/`getDockZones`/`getZoneTabs`를 그대로 재사용했고(`getDockZones("therapist")`가 구역 하나뿐이라 자연히 `[]`), ops 역할 쪽 계산에는 therapist를 `roles`에 넣은 곳이 없어 섞이지 않는다.
- **레이아웃·화면**: `src/app/therapist/{layout,page,attendance/page,payout/page,notices/page}.tsx`. 레이아웃은 `requireTherapistAccess()`로 느슨한 1차 검사 후 `TherapistTabBar`(아래 탭 4개, `src/components/therapist/therapist-tab-bar.tsx`, 뷰는 `TherapistTabBarView`로 분리해 순수 렌더 테스트 가능)를 띄우고, 각 화면이 다시 `requireTherapistAccess()`를 불러 employeeId를 얻는다(ops의 ErpLayout+requireRouteAccess 이중 검사와 같은 모양). "나" 메뉴는 `TherapistMeMenu`+`TherapistTopBar`(화면마다, ops ScreenToolbar처럼). 공지 탭 숫자 자리는 `TherapistTabBar`의 `noticeUnreadCount?: number` prop으로 뒀다(10이 실제 값을 넘기면 된다. 지금은 비워 자리만 있음, 테스트로 배지 on/off 확인함).
- **새로고침 공통 조각(D8)**: `src/components/therapist/therapist-refresh.tsx`의 `TherapistRefresh`/`TherapistRefreshController` — 자동 폴링 없이 open/visibilitychange/버튼만. 4개 빈 화면에 이미 연결해 뒀다(03–10은 안의 `TherapistEmptyTab`을 실제 내용으로 바꾸면 된다).
- **E2E 시드 계정**: `scripts/seed-dev-accounts.ts`에 accountId `"therapist"` / 비밀번호 `"Story12!therapist"`를 기존 역할과 같은 방식으로 더했다(CI가 이미 이 스크립트를 돈다). `support/auth.ts`의 `login()`은 역할과 무관하게 그대로 동작해 새 로그인 헬퍼가 필요 없었다. 새 스펙 `tests/e2e/story-ticket-01-therapist-role-shell.spec.ts`는 자기 `beforeAll`에서도 같은 계정을 재확인 시드한다(기존 story-1-2 관례와 동일).
- **가정(D14류, 새로 한 가정)**: 없음 — 스펙에 이미 적힌 가정만 따랐다. 서버 액션 요청 잡기 테스트는 관리자의 `/masters/employees` 직원 정렬 순서 변경 action을 캡처해 therapist 세션으로 재전송했다(같은 값이면 no-op 저장이라 분간이 안 돼, multipart 본문의 `sortOrder` 필드만 다른 값으로 바꿔 보냈다 — `employee:write` 권한이 없어 거절되고, 감사 기록에 therapist 계정이 actor로 남지 않음을 확인).
- **검증**: `pnpm test:unit`(1035 pass), `npx tsc --noEmit`(0 errors), `for f in scripts/validate-story-*.mjs; do node "$f" ...; done`(기존 실패 `validate-story-4-6.mjs`만, 새 실패 없음). E2E는 DB `vietnam_aesthetic_th01`·포트 3201에서 새 스펙 7개 + `story-1-1-app-shell`·`story-1-2-auth-rbac`·`story-i18n-default-vi`·`story-i18n-switch-ko`·`story-i18n-vi-screens`·`story-shell-workflow-dock`(routes.ts 공유 코드라 함께 확인) 전부 통과(47/47, 새 실패 없음).
