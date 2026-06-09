# Test Automation Summary

## Generated Tests

### API Tests
- [x] `tests/e2e/story-3-1-room-status-service.spec.ts` - Playwright runner에서 injected `prismaClient` fixture로 `listRoomStatuses()` DTO 계약, 활성/제외 상태, 최신 활성 콜, 자정 넘김, 정책 누락 fallback, 담당자 mapping, read-only 무부작용을 검증한다.

### E2E Tests
- [x] `tests/e2e/story-3-1-room-status-service.spec.ts` - Story 3.1의 transport-neutral service workflow를 자동화한다. 현재 `/live`, `/rooms`, `/tv`는 placeholder라 UI interaction E2E는 후속 Story 3.2~3.4 범위다.

## Coverage
- API/domain service paths: 1/1 Story 3.1 service covered.
- UI features: 0/0 implemented Story 3.1 UI surfaces covered; UI surfaces are not yet implemented.
- Critical cases: 활성 콜 없음, 예약, 청소중, 사용중, 종료확인, 방문완료/노쇼/취소 제외, 최신 활성 콜, 자정 넘김, 정책 누락, 입력 날짜/시간 검증, read-only guard covered.

## Next Steps
- Story 3.2~3.4에서 `/live`, `/rooms`, `/tv` UI가 구현되면 같은 `RoomStatusDto` fixture를 재사용해 화면별 rendering/polling E2E를 추가한다.
