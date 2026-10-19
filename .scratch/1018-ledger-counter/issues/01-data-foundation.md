# 01: 데이터 기초 — 실제 종료·예약 경로·예약자명·출근 예정 시각

**What to build:** 칸을 더하기만 하는 마이그레이션 하나를 만들고, 콜 행 DTO·저장 계약·가능 판정이 새 칸을 읽고 쓰게 한다. 화면은 아직 바꾸지 않는다. (스펙 D1, D2)

**Blocked by:** 없음

**Status:** done

- [x] 마이그레이션에 칸 네 개를 더한다: `service_calls.actual_end_time`, `booking_channel_code`, `booker_name`, `planned_working_days.planned_start_time`. 모두 비어도 된다. Prisma 스키마도 고친다.
- [x] 기준정보 코드 종류에 `BOOKING_CHANNEL`을 더하고 기본값 7개(텔레그램, 카카오톡, 왓츠앱, 잘로, 전화, 워크인, 기타)를 넣는다. 기준정보 코드 화면에서 관리자가 더할 수 있다. ko·vi 문구를 같이 넣는다.
- [x] 콜 행 DTO와 자동 저장 계약이 `actualEndTime`·`bookingChannelCode`·`bookerName`을 읽고 쓴다. 낡은 저장 거절과 요청 id 규칙을 그대로 따르고, 감사 기록 칸 이름을 더한다.
- [x] 가능 판정은 Therapist의 점유 끝을 "실제 종료가 있으면 실제 종료, 없으면 표시 종료"로 계산한다(D2).
- [x] `CONTEXT.md`에 용어를 더한다: 실제 종료, 예약 경로, 예약자명, 미지명, 자리, 출근 예정 시각.
- [x] 단위 테스트, tsc, 기존 E2E 회귀가 통과한다.

## Comments

- 2026-10-19 구현(브랜치 feat/1018-ledger-rework).
  - 마이그레이션 `20261019120000_add_actual_end_booking_channel_planned_start`는 칸 네 개만 더한다(D1 "칸 추가만"). `BOOKING_CHANNEL` 기본 7개는 `defaultCodeItems`에 두고, 기존 DB에는 데이터 마이그레이션 `20261019120100_add_booking_channel_codes`가 넣는다(2026-10-19 사용자 위임 결정: 관리자가 코드 화면을 열 때까지 기다리면 빠른 예약 ②(티켓 05)의 경로 버튼이 비고, 원장 화면이 열릴 때마다 기본값을 확인하면 DB 조회가 늘어서다). 실제로 넣은 코드마다 화면과 같은 모양의 `code_item.created` 감사를 처리자 `migration:20261019120100_add_booking_channel_codes`로 남긴다. 이미 있는 코드는 건드리지 않는다. 새 DB에서 적용·같은 SQL 재실행·시드 뒤에도 코드 7개·감사 7건 그대로임을 확인했다.
  - 저장 계약: 세 칸은 `actualEntryTime`처럼 저장 입력에서 빠지면(undefined) 저장된 값을 지키고, null이면 지운다. 실제 종료는 HH:mm(분 단위, 10분 맞춤 없음)이고, 바뀌면 실제입장처럼 `service_call.row_changed` 감사 대상이다. 경로 코드는 활성 `BOOKING_CHANNEL` 코드만 받는다. `listServiceCallFormOptions()`가 `bookingChannels`를 준다. 충돌 비교 칸 목록(`EDITABLE_CALL_FIELDS`)에 세 칸을 더했다.
  - 가능 판정(D2): 점유는 [예약시각, 실제 종료 ?? 표시 종료)다. 시작은 그대로 예약시각이다. 기존 초과 점유(표시 종료를 넘긴 사용중 콜, 티켓 03에서 없앤다)는 남겼고, 실제 종료가 있는 사용중 콜에는 붙이지 않는다. 늦게 입장한 사용중 콜은 이제 표시 종료까지 묶이므로, 옛 규칙을 전제한 단위 테스트 하나("counts free minutes only up to a hold…")를 D2에 맞게 고쳤다.
  - ADR 0001의 "마치는 시각을 손으로 적지 않는다"와 어긋나지 않도록 ADR 0001에 보완 문단을 더했다. 자동 청소 중(ADR 0008)은 티켓 03이다.
  - 검증: 단위 937개 통과, tsc 통과, 검증 스크립트는 기존 실패인 4-6만 실패. 새 DB(마이그레이션 적용·시드)에서 운영 빌드 E2E 전체를 병렬로 돌린 뒤(16개 실패), 실패한 스펙을 새 DB에서 직렬로 다시 돌렸다. 남은 실패는 기존 목록의 2-5:268, 5-3:173·242, 5-5:211·250뿐이다. 리뷰 반영(초과 점유 한 줄, 마이그레이션 INSERT 제거) 뒤에는 E2E를 다시 돌리지 않았다.
  - 운영 DB 마이그레이션은 적용하지 않았다(D1, 직전에 사용자 확인).
