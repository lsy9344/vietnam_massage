# 01: 데이터 기초 — 실제 종료·예약 경로·예약자명·출근 예정 시각

**What to build:** 칸을 더하기만 하는 마이그레이션 하나를 만들고, 콜 행 DTO·저장 계약·가능 판정이 새 칸을 읽고 쓰게 한다. 화면은 아직 바꾸지 않는다. (스펙 D1, D2)

**Blocked by:** 없음

**Status:** ready-for-agent

- [ ] 마이그레이션에 칸 네 개를 더한다: `service_calls.actual_end_time`, `booking_channel_code`, `booker_name`, `planned_working_days.planned_start_time`. 모두 비어도 된다. Prisma 스키마도 고친다.
- [ ] 기준정보 코드 종류에 `BOOKING_CHANNEL`을 더하고 기본값 7개(텔레그램, 카카오톡, 왓츠앱, 잘로, 전화, 워크인, 기타)를 넣는다. 기준정보 코드 화면에서 관리자가 더할 수 있다. ko·vi 문구를 같이 넣는다.
- [ ] 콜 행 DTO와 자동 저장 계약이 `actualEndTime`·`bookingChannelCode`·`bookerName`을 읽고 쓴다. 낡은 저장 거절과 요청 id 규칙을 그대로 따르고, 감사 기록 칸 이름을 더한다.
- [ ] 가능 판정은 Therapist의 점유 끝을 "실제 종료가 있으면 실제 종료, 없으면 표시 종료"로 계산한다(D2).
- [ ] `CONTEXT.md`에 용어를 더한다: 실제 종료, 예약 경로, 예약자명, 미지명, 자리, 출근 예정 시각.
- [ ] 단위 테스트, tsc, 기존 E2E 회귀가 통과한다.

## Comments
