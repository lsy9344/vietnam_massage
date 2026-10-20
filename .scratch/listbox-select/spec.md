# 선택 칸(공용 listbox) — 네이티브 select를 everywhere에서 같은 모양으로

**Status:** done

## 문제

Therapist 근태 탭의 날짜 팝업 → 휴무 신청 → "휴가 종류" 드롭다운을 누르면, 목록이 카드 아래가 아니라 **팝업창의 왼쪽 최상단**에 떴다(사용자 보고, 2026-10-20).

조사 결과:

- 이 드롭다운은 네이티브 `<select>`의 목록이다. 네이티브 select의 목록은 브라우저(OS) 팝업이라 페이지 CSS가 위치를 관할하지 않는다. 그래서 뷰어·임베드 웹뷰·확대율 환경마다 그 OS 팝업이 엉뚱한 자리에 그려진다.
- 실제 Chromium(데스크톱 폭·모바일 폭·페이지 스크롤·헤드리스·iframe 안)에서는 어디서든 카드 아래에 정확히 떴다. 즉 앱의 CSS 계산 문제가 아니라, **OS 팝업에 의존하는 구조**가 문제의 원인이었다.
- 저장소 안에도 같은 판단의 선례가 있었다. 콜 원장 그리드는 Story 2.6에서 네이티브 select를 `role="combobox"` + body에 portal로 그리는 목록(`ledger-cell-picker.tsx`)으로 이미 바꿔 두었다.

## 해결

공용 선택 칸(`src/components/ui/listbox-select.tsx`)을 만들고 앱의 네이티브 select 20곳(14개 파일)을 전부 이 컴포넌트로 바꾼다. 목록이 DOM 요소가 되면 위치는 CSS가 정하므로 **어디서 봐도** 카드 아래에 뜬다.

- 모양·키보드·접근성은 `design.md` 6.4에 적었다(입력칸 6.4와 팝오버 6.12를 따름).
- 폼 값은 숨은 input으로 보낸다(`name`). 네이티브 `required`는 폼 전송 가드로 대신한다.
- 목록은 항상 body에 portal로 그린다(모달·패널의 overflow에 잘리지 않게). 모달 안에서 열어도 모달 위(`z-50`, `pointer-events-auto`)에 뜬다.
- 포커스는 트리거에 남긴다(Radix Dialog의 포커스 가두기와 겹치지 않게).

## 검증

- 단위: `pnpm test:unit` 1323개 통과(신규 `listbox-select.test.tsx` 7개 포함).
- 타입: `npx tsc --noEmit` 에러 없음.
- E2E: 전용 DB(`vietnam_aesthetic_lb6`)에서 선택 칸을 쓰는 스펙 전부 통과(티켓 08 휴무 신청·승인함, 티켓 09 정정 요청, 티켓 27·28 근무표, 직원 기준정보, 지출, 운영 일일 인센, 빠른 예약·일행, 공지, 이관 검증, 계정 발급, therapist 현황 줄).
- 전체 스펙(430개): 412 통과 / 11 실패. 실패 11건 중 6건은 **변경 전(베이스라인)에서도 똑같이 실패**하는 기존 실패(콜 원장 흐름 키보드, 객실 평면도, 도크 로고, 기준정보 키보드, 감사 키보드, 휴대폰 원장)이고, 나머지 5건은 개발 서버 렌더러 충돌(HMR 재빌드 중 Target crashed)·공유 DB 상태 때문에 격리 실행하면 모두 통과한다.
- 브라우저: 실제 Chromium 창(데스크톱 폭·모바일 폭) + iPhone 13 프로필(터치·DPR 3)에서 휴무 신청 → 휴가 종류 목록이 **고른 칸 바로 아래**에 뜨는 것 캡처로 확인(`/tmp/opencode/select-repro/phone-4-listbox-screen.png`).

## 코드 리뷰(grok, herdr 워크스페이스 탭의 옆 pane에서 실행)

- 1회: 버그 2건(Escape가 모달까지 닫음·Tab가 목록을 열어 둠), 제안 2건(일행 객실 피커 포커스, 일행 E2E 단언), 사소한 지적 1건(파일 주석). 모두 반영.
- 2회: **0건**(버그·제안·사소한 지적 모두 없음). 이전 지적 5건이 제대로 고쳐졌는지도 확인.
- 3회(휴대폰 프로필 검증에서 발견한 목록 자리 고침 후): 버그 1건(긴 목록도 '그려질 높이'로 판단해야 아래에 연다), 제안 1건(자리 재기 단위 테스트 없음), 사소한 지적 1건(원장 칸 목록이 자리 재기 사본을 쓰므로 주석이 거짓말). 모두 반영.
- 4회: **0건**. 앞선 세 번의 지적(총 9건)이 모두 해결됐고 새 문제 없음.

## 결정 기록

- 네이티브 select를 **남겨 두고** 하는 게 낫지 않냐: 아니다. 네이티브 목록은 위치 제어가 안 되고, 모바일 웹에서 OS 메뉴로 열려 흐름이 끊긴다. 목록을 DOM으로 그리면 위치·모양·키보드가 한곳에 모인다.
- 목록을 모달 안에 그대로 그리는 방법: 모달이 `overflow-y-auto` + `transform`(`-translate-x-1/2`)이라 잘리고·밀린다. portal이 답이다.
- 목록 자리(위/아래): 목록이 아래 자리에 다 들어갈 만큼 짧으면 아래에 연다. 짧은 목록이 위로 뜨면 위의 내용을 가려 읽기 어렵다(휴대폰 프로필에서 발견해 고침). 판단은 목록이 **그려질 높이**(최대 240px)로 한다 — 목록은 어차피 240px에서 잘리므로 그 높이보다 아래 자리가 좁을 때만 위로 연다.
- 초기값: 네이티브 select와 같은 규칙(고른 값이 목록에 없으면 첫 항목). 새 직원 폼의 재직상태가 이 규칙 없이는 비어 있어 서버가 거절했다.
- `required`: 폼이 `noValidate`면 브라우저 검증을 끄는 자리이므로 native select도 막지 않았다. 거기서도 막지 않는다.
- 기존 `measureListboxPosition`(원장 칸 목록)을 `src/components/ui/listbox-position.ts`로 옮겨 두 컴포넌트가 한 자리에 쓴다.

## Comments

- 만듦: `src/components/ui/listbox-select.tsx`(공용 선택 칸), `src/components/ui/listbox-position.ts`(목록 자리 재기 — 원장 칸 목록도 이 한 곳을 쓴다), `src/components/ui/listbox-select.test.tsx`(단위 7개), `src/components/ui/listbox-position.test.ts`(자리 재기 단위 4개).
- 바꾼 곳(네이티브 select 20곳 → 0): therapist 근태 달력(휴가 종류), therapist 정정 요청 다이얼로그(날짜), 도구줄 운영월, 운영 근태(근무상태), 공지(대상 Therapist), 이관 검증 필터 2칸 + 이슈 상태, 기준정보 직원(그룹·주/야간·재직상태·역할), 근무표 칸(근무상태), 월 명세서(운영월·직원·버전), therapist 현황 줄(정렬), 원장 일행(객실), 지출(수단·담당자), 빠른 예약(시간·인원·두 번째 Therapist).
- E2E: `tests/e2e/support/listbox-select.ts` 헬퍼 추가(`pickListboxOption`, `pickListboxOptionByValue`, `openListbox`). `selectOption`을 쓰던 39곳을 이 헬퍼로 바꿨다. `toHaveValue`로 셀렉트 값을 보던断言은 숨은 input(`input[name=...]`) 또는 보이는 글자(`toContainText`)로 바꿨다. 티켓 08에 "목록이 열려 있는 동안 Escape는 목록만 닫고 팝업은 닫지 않는다"(Tab도 닫힘) E2E를 새로 넣었다.
- 단위 테스트: 네이티브 `<option>` 마크업을 보던断言 6건을 새 마크업(combobox 버튼 + 숨은 input) 기준으로 고쳤다. 빠른 예약 "두 번째 Therapist 후보에서 빠짐"은 목록이 열 때만 그려져 단위에서 볼 수 없어, 같은 내용을 보는 E2E(`story-ticket-21`)가 그대로 확인한다.
- 문서: `design.md` 6.4에 선택 칸 규칙을 적었다.

## 배포

- 2026-10-21 Cloudflare 프리뷰 배포(사용자 확인): `preview/therapist-accounts`(6d46a55)를 `pnpm cf:build` → `wrangler versions upload --preview-alias app-expansion`. 버전 `31e0b76b-1e17-4c96-96dc-2b96108b3385`, 태그 `listbox-6d46a55`, 주소 `https://app-expansion-vietnam-massage-erp.boothy-selectroom.workers.dev`.
- 확인: 빌드 산출(gzip 4.37MiB, 한도 10MiB 아래)·Hyperdrive `275fdce2…`·프리뷰 `/sign-in` 200·`/api/auth/providers`의 callbackUrl이 프리뷰 도메인·프리뷰가 새로 올린 청크에 새 선택 칸 코드가 들어 있음·운영 트래픽은 `bff7cf91` 100% 그대로(운영 주소 변경 없음).
- 이 변경은 마이그레이션이 없다(스키마·운영 DB 무변경). `prisma migrate deploy`는 쓰지 않았다(D29).
