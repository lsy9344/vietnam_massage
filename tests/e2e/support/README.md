# E2E 공용 헬퍼와 격리 규칙

Playwright 스펙은 **하나의 Postgres를 공유**한다(CI는 shard마다 하나, 로컬은 전부 하나).
스펙이 남긴 마스터 데이터는 다음 스펙의 화면에 그대로 나타나므로, 아래 규칙을 지키지 않으면
"내 스펙만 보면 맞는데 같이 돌리면 틀리는" 실패가 생긴다.

## 로그인은 `support/auth.ts`의 `login()`을 쓴다

로그인 폼은 `signIn("credentials", { redirect: false })`로 비동기 POST를 보낸 뒤 클라이언트에서
이동한다. 클릭 직후 `page.goto(...)`를 하면 그 POST가 취소되어 세션 없이 `/sign-in`으로 튕긴다.
공유 헬퍼는 credentials 응답과 landing navigation까지 기다린다. 스펙 안에 로그인 절차를 다시
구현하지 말 것.

## 콜 원장 셀은 combobox다

그리드의 선택 셀은 `<select>`가 아니라 Story 2.6의 type-ahead combobox다.
`support/call-grid.ts`의 `selectGridOption()` / `selectGridOptionByValue()`를 쓴다.
직접 타이핑할 때는 focus 후 전체 선택(`ControlOrMeta+a`)을 먼저 하고, Enter/방향키 전에
필터된 옵션이 렌더됐는지 기다린다.

## 출근 입력이 없으면 "정상근무"다

귀케어/운영팀 직원은 해당 날짜에 출근 row가 없으면 정상근무로 간주되어 지급 대상에 들어간다.
공용 마스터 시드(`scripts/seed-master-data.ts`)가 기본 직원을 만들기 때문에, 지급액이나 인원수를
단언하는 스펙은 **그날 활성 직원 전원**의 상태를 명시해야 한다(자기 직원만 넣으면 안 된다).

## 인센 규칙은 시드한 달로 한정한다

`effectiveToMonth`를 비워 두면 그 규칙이 이후 모든 운영월에 적용되어 다른 스펙의 지급액을 바꾼다.
운영팀 일일/월 인센 규칙은 `effectiveToMonth = effectiveFromMonth`로 시드한다.

## 객실은 활성인 것이 전부 화면에 나온다

`/rooms`와 `/tv`는 활성 객실마다 카드를 그린다. "기본 객실 11개"를 단언하는 스펙은
`support/cleanup.ts`의 `deactivateNonDefaultRooms()`로 다른 스펙의 E2E 객실을 비활성화한 뒤 확인한다.

## 코드 마스터는 중복 시드하지 않는다

`SERVICE_STATUS`, `PAYMENT_METHOD` 등은 공용 마스터 시드가 영문 code + 한국어 표시명으로 만든다.
같은 표시명으로 한국어 code를 또 만들면 드롭다운에 같은 라벨이 두 개 뜨고, 무엇이 저장됐는지
단언할 수 없게 된다.

## 서버 액션은 결과를 기다린 뒤 reload한다

폼 제출 직후 `page.reload()`를 하면 액션 POST가 취소된다. 저장 결과(저장됨/행 사라짐 등)를
확인한 뒤 reload한다. 반대로, 저장 성공 시 행이 remount되는 화면(마사지사 출퇴근 입력)에서는
일시적인 "저장됨" 배지가 아니라 **저장된 값**을 단언한다.
