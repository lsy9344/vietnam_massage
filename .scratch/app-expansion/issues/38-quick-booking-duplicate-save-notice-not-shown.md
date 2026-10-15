# 38: 빠른 예약 재시도의 "이미 저장된 콜입니다" 안내가 보이지 않는다

**What to build:** 빠른 예약 패널은 저장에 성공하면 바로 닫힌다(티켓 20, 스토리 65). 응답 유실 뒤 같은 요청 id로 "다시 시도"해 서버가 이미 만든 콜을 멱등하게 돌려준 경우(`createQuickBookingServiceCallAction`의 `result.notice = "calls.save.alreadySaved"`, 스토리 47)에도 패널이 즉시 닫혀, `quick-booking-panel.tsx`가 `dispatch({..., notice: result.notice})` 뒤 바로 `setOpen(false)`를 불러 그 notice가 그려질 자리(패널)가 이미 사라진다. 사용자는 "이미 저장된 콜입니다"를 볼 방법이 없다. 그리드에 직접 입력한 새 행은 같은 notice를 `NewCallRowSaveStatus`가 보여 주므로, 빠른 예약에도 패널이 닫힌 뒤에도 보이는 자리(토스트 등)를 만든다. (스펙 F03, 스토리 47, 티켓 20)

**Blocked by:** 20

**Status:** done

- [x] 빠른 예약 저장이 `alreadySaved` notice를 돌려주면, 패널이 닫힌 뒤에도 그 notice가 사용자에게 보인다(토스트 등 패널과 독립된 자리).
- [x] 보통(처음 저장) 성공 시에는 이 안내가 나오지 않는다.
- [x] 포커스는 그대로 저장된 행으로 간다(기존 동작, 스토리 65).
- [x] E2E로 응답 유실 뒤 같은 요청 id 재시도 → 패널이 닫히고 그 행으로 포커스가 가면서도 "이미 저장된 콜입니다"가 보이는지 확인한다. 새 문구가 필요하면 두 언어로 더한다.

## Comments

- 2026-10-15 티켓 36(전체 흐름 교차 검증) 중 발견. 티켓 20의 `## Comments`에 이미 가정·넘긴 것으로 기록돼 있었다("저장 성공 시 패널을 닫는다 ... '이미 저장된 콜입니다' 안내는 지금 화면에 더 보여 주지 않는다(가정) ... 패널이 즉시 닫혀 지금은 화면에 보여 주지 않는다. 필요하면 토스트 등 별도 자리가 필요하다"). 토스트 같은 공용 알림 자리를 새로 만드는 일이라 티켓 36 범위에서 바로 고치지 않고 새 티켓으로 남긴다.
- 코드 위치: `src/app/(erp)/calls/quick-booking-panel.tsx`(952–956줄, `result.notice`를 담자마자 `setOpen(false)`), `src/app/(erp)/calls/actions.ts`의 `createQuickBookingServiceCallAction`, 메시지 키 `calls.save.alreadySaved`(`src/lib/i18n/messages/{ko,vi}.ts`). 그리드 새 행의 같은 notice 표시는 `src/app/(erp)/calls/editable-call-grid.tsx`의 `NewCallRowSaveStatus`가 선례다.

- 2026-10-16 리뷰 후속 수정 완료: 빠른 예약의 성공 notice를 ModalPanel 바깥의 aria-live=polite 상태 영역에 남긴다. 이미 저장된 콜을 돌려받을 때만 안내가 보이고 일반 성공·다음 패널 열기에서는 지운다. 서버가 이미 번역한 notice 문자열을 그대로 표시한다. 포커스는 기존 저장 행 이동 경로를 유지한다.
- 검증: 새 DB·운영 빌드의 e2e-booking-focused에서 응답 유실(route.fetch 후 응답 중단) → 같은 요청 id 재시도 → 패널 닫힘 → 안내 표시·콜 1개·그 행 포커스가 통과했다. 키보드로 패널을 사용하고 확인 후 닫을 때 원래 버튼으로 포커스 복귀도 통과(2/2). 보통 성공에 중복 안내가 없는 단언도 기존 PC 흐름에 추가했다. 첫 전체·직렬 실행의 PC 흐름은 통과했으며, 뒤 재실행 1회에는 기존의 저장 후 원장 갱신 지연이 나타났다. 최종 재시도·포커스 흐름은 새 DB에서 통과했다.
