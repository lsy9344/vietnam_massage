-- 위챗 예약 경로 추가(2026-10-23 고객 요청). 기준정보 코드 화면의 ensureDefaultCodeItems를 기다리지 않고,
-- 이 마이그레이션을 적용하면 바로 빠른 예약이 위챗을 고를 수 있게 한다. 값은 code-schema.ts의 defaultCodeItems와 같다.
-- 20261019120100과 같은 패턴: 실제로 넣은 코드마다 화면이 만들 때와 같은 code_item.created 감사를 남긴다.
-- 이미 있는 코드는 건드리지 않고 감사도 남기지 않는다.
-- 정렬 순서는 잘로(40)와 전화(50) 사이의 45다. 관리자가 45를 이미 다른 경로에 썼으면(코드 화면에서 정렬 순서를 정할 수
-- 있다) 맨 뒤(가장 큰 값 + 10)에 둔다. 45를 그대로 넣으면 (code_type, sort_order) 유일 제약에 걸려 위챗이 조용히 빠지고,
-- 그 뒤 코드 화면의 ensureDefaultCodeItems가 같은 45로 다시 만들려다 화면이 깨진다.
WITH inserted AS (
  INSERT INTO "code_items" ("id", "code_type", "code", "display_name", "sort_order", "is_system_default", "is_active", "created_at", "updated_at")
  SELECT
    'system-booking-channel-wechat', 'BOOKING_CHANNEL', 'WECHAT', '위챗',
    CASE
      WHEN EXISTS (SELECT 1 FROM "code_items" WHERE "code_type" = 'BOOKING_CHANNEL' AND "sort_order" = 45)
        THEN (SELECT MAX("sort_order") + 10 FROM "code_items" WHERE "code_type" = 'BOOKING_CHANNEL')
      ELSE 45
    END,
    true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ON CONFLICT DO NOTHING
  RETURNING "id", "code_type", "code", "display_name", "sort_order", "is_system_default", "is_active"
)
INSERT INTO "audit_logs" ("id", "actor_id", "action", "target_type", "target_id", "before_value", "after_value", "created_at")
SELECT
  'migration-20261023120100-' || i."id",
  'migration:20261023120100_add_wechat_booking_channel',
  'code_item.created',
  'code_item',
  i."id",
  NULL,
  jsonb_build_object(
    'id', i."id",
    'codeType', i."code_type",
    'code', i."code",
    'displayName', i."display_name",
    'sortOrder', i."sort_order",
    'isSystemDefault', i."is_system_default",
    'isActive', i."is_active"
  ),
  CURRENT_TIMESTAMP
FROM inserted AS i;
