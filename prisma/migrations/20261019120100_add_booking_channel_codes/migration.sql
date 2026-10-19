-- 예약 경로 기본 코드(1018 스펙 D1, 티켓 01). 기준정보 코드 화면의 ensureDefaultCodeItems를 기다리지 않고,
-- 이 마이그레이션을 적용하면 바로 빠른 예약이 경로를 고를 수 있게 한다. 값은 code-schema.ts의 defaultCodeItems와 같다.
-- 실제로 넣은 코드마다 화면이 만들 때와 같은 code_item.created 감사를 남긴다. 이미 있는 코드는 건드리지 않고 감사도 남기지 않는다.
WITH inserted AS (
  INSERT INTO "code_items" ("id", "code_type", "code", "display_name", "sort_order", "is_system_default", "is_active", "created_at", "updated_at")
  VALUES
    ('system-booking-channel-telegram', 'BOOKING_CHANNEL', 'TELEGRAM', '텔레그램', 10, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('system-booking-channel-kakaotalk', 'BOOKING_CHANNEL', 'KAKAOTALK', '카카오톡', 20, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('system-booking-channel-whatsapp', 'BOOKING_CHANNEL', 'WHATSAPP', '왓츠앱', 30, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('system-booking-channel-zalo', 'BOOKING_CHANNEL', 'ZALO', '잘로', 40, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('system-booking-channel-phone', 'BOOKING_CHANNEL', 'PHONE', '전화', 50, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('system-booking-channel-walk-in', 'BOOKING_CHANNEL', 'WALK_IN', '워크인', 60, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('system-booking-channel-other', 'BOOKING_CHANNEL', 'OTHER', '기타', 70, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT DO NOTHING
  RETURNING "id", "code_type", "code", "display_name", "sort_order", "is_system_default", "is_active"
)
INSERT INTO "audit_logs" ("id", "actor_id", "action", "target_type", "target_id", "before_value", "after_value", "created_at")
SELECT
  'migration-20261019120100-' || i."id",
  'migration:20261019120100_add_booking_channel_codes',
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
