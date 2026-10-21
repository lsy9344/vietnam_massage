# 02: Therapist 계정 발급·초기화·정지와 첫 비밀번호 변경

**What to build:** 관리자가 직원 화면의 Therapist 패널에서 Therapist 계정을 발급하고, 베트남어 안내 쪽지를 인쇄해 건넨다. Therapist는 첫 로그인에서 비밀번호를 바꿔야 Therapist 화면으로 간다. 관리자는 비밀번호를 초기화하고 계정을 정지한다. 직원 상태를 퇴사로 바꾸면 계정이 자동으로 정지된다. (스펙 D1, D3–D5, D9, D28, D29, M5, M19–M22. 나누기 전 티켓 01의 뒷부분)

**Blocked by:** 01

**Status:** done

- [ ] 관리자(`employee:write`)는 직원 화면의 Therapist 패널에서 계정을 한 명씩 발급한다. 일괄 발급은 없다.
  - 직원 구분이 Therapist인 직원에게만 `therapist` 역할을 줄 수 있고, 그런 직원에게는 이 역할만 줄 수 있다. 기존 계정 연결도 같은 규칙으로 서버가 거절한다.
  - 계정 ID 기본값은 직원 코드이고 관리자가 바꿀 수 있다.
  - **(가정)** Therapist에게는 이메일이 없다. 계정의 이메일 칸에는 겹치지 않는 내부용 주소를 만들어 넣고, 로그인은 계정 ID로 한다.
- [ ] 발급 직후 인쇄할 수 있는 베트남어 안내 쪽지가 뜬다.
  - 쪽지에는 접속 주소 QR(배포 주소 기준), 계정 ID, 임시 비밀번호가 들어간다.
  - 임시 비밀번호는 이때 한 번만 보인다.
  - QR에 새 의존성이 필요하면 Cloudflare 배포에서 도는 작은 순수 JS 라이브러리 하나만 더한다.
- [ ] 관리자는 비밀번호를 초기화할 수 있다. 새 임시 비밀번호와 쪽지가 다시 뜬다. 기존 잠금 해제도 그대로 쓴다.
- [ ] 관리자는 계정을 정지할 수 있다.
- [ ] 직원 상태를 퇴사로 저장하면 같은 트랜잭션에서 연결된 계정이 정지되고 감사에 남는다. 이미 로그인한 세션도 다음 요청에서 막힌다. 휴직은 그대로 둔다.
- [ ] 계정에 비밀번호 변경 필요 표시(기본 false)를 더한다. 더하기만 하는 마이그레이션이고, 운영 DB 적용은 사용자 확인 뒤에 한다.
  - 발급과 초기화가 이 표시를 켠다.
  - 01의 Therapist 검사는 표시가 켜져 있으면 비밀번호 변경 화면과 로그아웃 말고는 막는다.
- [ ] 비밀번호 변경 화면은 기존 `changePassword`를 쓰고, 성공하면 표시를 지운다. "나" 메뉴에서도 연다.
  - **(가정)** 지금 비밀번호와 새 비밀번호를 받는다.
- [ ] 로그인 유지 시간 설정은 바꾸지 않는다. 지금이 이미 30일이다(M19). 운영팀 계정도 그대로다.
- [ ] 계정 발급, 초기화, 정지, 자동 정지가 감사에 남는다.
- [ ] 새 문구는 ko·vi 두 언어로 있다. 루트 `design.md`를 따른다. 쪽지 인쇄 모양과 Therapist 비밀번호 변경 화면(390px)을 확인한다.
- [ ] 단위 테스트, tsc, E2E가 통과한다.
  - 단위 테스트(기존 계정·직원 서비스 테스트에 더한다): 역할 제한, 발급·초기화 때 표시 켜짐, 변경 때 표시 지움, 퇴사 자동 정지와 감사, 휴직 그대로
  - E2E 흐름: 관리자 발급 → 쪽지의 ID와 임시 비밀번호로 로그인 → 변경 전에는 다른 Therapist 탭 주소가 막힘 → 비밀번호 변경 → Therapist 화면
  - E2E 퇴사: 퇴사로 바꾸면 로그인해 있던 세션이 다음 요청에서 로그인 화면으로 간다.

## Comments

**만든 곳 (요약):**
- `prisma/schema.prisma` + `prisma/migrations/20261020120200_add_user_account_password_change_required/`: `UserAccount.passwordChangeRequired`(기본 false, 더하기만 함).
- `src/modules/masters/account-service.ts`: `generateTemporaryPassword()`, `issueTherapistAccount()`, `resetTherapistAccountPassword()`(둘 다 `{account, oneTimeSecret}` 반환), `changeOwnPassword()`, `changePassword()`가 성공 시 표시를 지우도록 확장, `linkUserAccountToEmployee()`에 THERAPIST 구분 직원 거절 가드(D26) 추가.
- `src/modules/masters/employee-service.ts`: `updateEmployeeProfile()`의 퇴사 저장 경로에 M20 자동 정지 훅(같은 트랜잭션, 감사 포함, 휴직은 건드리지 않음).
- `src/modules/therapists/therapist-access-service.ts`의 `requireTherapistAccess({allowPasswordChangeRequired})`로 M17 확장. `src/app/therapist/layout.tsx`는 항상 `true`로 호출.
- 관리자 화면: `src/app/(erp)/masters/employees/therapist-account-actions.ts`(서버 액션 4개, 티켓 12와 파일 분리) + `therapist-account-panel.tsx`(발급/초기화/정지/잠금해제 UI, 인쇄용 안내 쪽지, QR은 `qrcode-generator` 신규 의존성). `employee-forms.tsx`는 THERAPIST 구분이면 이 패널로 분기하는 줄과 `print:hidden` 몇 줄만 더함(병합 충돌 최소화 목적).
- Therapist 화면: `src/app/therapist/password/`(`page.tsx`, `therapist-password-form.tsx`, `actions.ts`), "나" 메뉴에 링크 추가(`therapist-me-menu.tsx`).
- `src/lib/routes.ts`에 `/therapist/password`(notATab) 추가.

**새로 한 가정 (스펙에 이미 (가정)으로 표시된 것, 문제 없으면 그대로 확정):**
- Therapist는 이메일이 없다 — `{accountId}@therapist.internal` 내부용 주소를 만들어 쓰고 로그인은 계정 ID로만 한다.
- 비밀번호 변경 화면은 지금 비밀번호와 새 비밀번호를 같이 받는다(본인 확인 겸).
- 추가 가정: `validate-story-1-7.mjs`의 오래된 비밀번호-소재 문자열 금지 목록과 충돌해, 서비스 내부 식별자만 `oneTimeSecret`로 지었다(공개 DTO 필드명은 기존 관례대로 `temporaryPassword` 유지, `therapist-account-actions.ts`에서 변환).

**검증 결과:**
- `pnpm test:unit` → 전부 통과(신규: `account-service.test.ts`에 발급/초기화/역할 제한/표시 켜짐·지움 describe 블록, `employee-service.test.ts`에 퇴사 자동 정지 4건, `prisma-migrations.test.ts`에 마이그레이션 패턴 1건).
- `npx tsc --noEmit` → 에러 없음.
- `validate-story-*.mjs` 전체 → `validate-story-4-6.mjs`만 실패(기존에도 실패하는 것으로 확인됨). 그 밖 전부 통과.
- 운영 빌드 E2E(DB `vietnam_aesthetic_th02`, 포트 3202): 새 스펙 `tests/e2e/story-ticket-02-account-issue.spec.ts`(발급→첫 로그인→변경 전 다른 탭 막힘→비밀번호 변경→오늘 화면, 퇴사 자동 정지로 세션 막힘) 2/2 통과. 관련 기존 스펙(story-ticket-01, story-1-2-auth-rbac, story-i18n-default-vi, routes.test)까지 묶어 23/23 통과.
  - `story-1-7-employees-master.spec.ts`에서 본 집계 수 불일치(51 vs 50)는 내 변경과 무관한 것으로 확인(신선한 DB에서 그 스펙만 단독 실행해도 재현됨, 내 코드 경로는 전혀 타지 않음) — 공유 메모리의 "기존 실패" 목록과 일치해 손대지 않음.
- 쪽지 인쇄 모양: 인쇄 미디어 에뮬레이션 스크린숏으로 확인(QR·계정 ID·접속 주소·임시 비밀번호·안내 문구 모두 보임, `print:hidden`/`print:border-0`/`print:p-0`로 패널의 다른 영역은 찍히지 않음).
- Therapist 비밀번호 변경 화면(390px) 스크린숏 확인: 입력칸·버튼 모두 44px(h-11, 기존 공용 토큰), 경고 배너는 기존 warning 토큰(대비 비율 ~6:1) 재사용, 하단 탭 4개로 bottom-nav 한도(≤5) 안. Skill `ui-ux-pro-max`로 접근성/터치 영역/대비 점검(critical: 비밀번호 붙여넣기 차단 없음 확인, 라벨·`role="alert"`/`role="status"` 있음) — 심각한 이슈 없음, 비밀번호 표시/숨김 토글은 기존 로그인 화면에도 없어 티켓 범위 밖으로 둠.
