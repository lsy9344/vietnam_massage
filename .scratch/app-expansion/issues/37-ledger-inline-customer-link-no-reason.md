# 37: 원장 그리드 인라인 "고객" 칸의 사유 없는 연결 변경

**What to build:** 티켓 25가 콜 상세 패널에 사유 필수 고객 연결 정정(`correctServiceCallCustomerLink`)을 추가했지만, 기존 원장 그리드의 인라인 "고객" 칸(`CustomerLinkSelect`, `editable-call-grid.tsx`)은 손대지 않아 그대로 남아 있다. 이 칸은 지금도 사유 없이 바로 `customerId`를 바꾸고 `service_call.row_changed`로만(이전 고객·새 고객·사유 구분 없이) 감사된다. 같은 필드를 정정하는 두 경로가 서로 다른 규칙(사유 필수 여부, 잠금 검사, 감사 내용)을 가지는 간극을 정리한다. (관련: 스펙 F06, ADR 0003, V09, 티켓 25)

**Blocked by:** 25

**Status:** needs-triage

- [ ] 그리드 인라인 "고객" 칸을 없앨지, 콜 상세 패널의 정정 작업으로 옮길지, 사유를 강제하도록 그대로 고칠지 결정한다.
- [ ] 고른 방향대로 두 경로의 잠금 검사(마감확정·잠금 운영월 거절)와 감사 내용(이전 고객·새 고객·사유·처리자)이 일치한다.
- [ ] 기존 그리드 E2E·단위 테스트가 바뀐 동작에 맞게 갱신된다.
- [ ] 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 티켓 36(전체 흐름 교차 검증) 중 발견. 티켓 25의 `## Comments`에 이미 같은 간극이 기록돼 있었다("그리드 인라인 '고객' 칸으로 사유 없이 바꾸는 기존 경로를 없애거나 사유를 강제하는 일은 하지 않았다 ... 두 경로가 같은 필드를 다르게 다루는 간극이 남는다 — 다음에 그 칸을 이 정정 작업으로 옮기거나 없앨지 결정이 필요하다"). 티켓 36 지시에 따라 작은 회귀가 아니라(두 경로 모두 25 이전부터 설계된 대로 동작 중이고 서로 충돌하지 않는다) 제품 방향 결정이 필요한 항목이라 새 티켓으로 남긴다.
- 코드 위치: `src/app/(erp)/calls/editable-call-grid.tsx`의 `CustomerLinkSelect`(정의 606줄, 쓰는 곳 938·1485줄). 정정 작업 경로는 `src/app/(erp)/calls/call-customer-link-correction.tsx` + `src/modules/calls/service-call-service.ts`의 `correctServiceCallCustomerLink`.
