-- 기본 객실 11개를 층별(높은 층 -> 낮은 층, 같은 층은 왼쪽 -> 오른쪽) 순서로 재정렬한다.
-- Room.sort_order 는 UNIQUE 이므로 임시값/최종값이 기존 값과 충돌하면 안 된다.
--
-- 기존 "+ 1000000" 방식은 이미 1000010 같은 값이 존재하면 UNIQUE 위반으로 실패할 수 있었다.
-- 또한 최종값 10..110 자리를 커스텀(비기본) 객실이 차지하고 있으면 두 번째 UPDATE 가 충돌한다.
-- 이를 모두 피하기 위해:
--   1) 충돌 가능한 모든 행(기본 11개 + 최종값 10..110 을 점유한 임의 행)을 음수 임시 구간으로 이동한다.
--      모든 sort_order >= 1 이므로 음수 구간은 항상 비어 있고, 원본값이 UNIQUE 이므로 -sort_order 도 UNIQUE.
--   2) 기본 객실만 층별 최종값으로 배치한다.
--   3) 임시로 비켜둔 커스텀 객실은 "현재 최대 sort_order 이후의 빈 자리"(MAX + 순번*10)로 복원한다.
--      (sort_order 에 상한 CHECK 가 없어 고정 오프셋 방식은 충돌 위험이 있으므로 항상 비어 있는 상단으로 옮긴다.)
UPDATE "rooms"
SET "sort_order" = -"sort_order"
WHERE "migration_reference_name" IN ('1번방', '2번방', '3번방', '4번방', '5번방', '6번방', '7번방', '8번방', '9번방', '10번방', '11번방')
  OR (
    "sort_order" IN (10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110)
    AND "migration_reference_name" NOT IN ('1번방', '2번방', '3번방', '4번방', '5번방', '6번방', '7번방', '8번방', '9번방', '10번방', '11번방')
  );

UPDATE "rooms"
SET "sort_order" = CASE "migration_reference_name"
  WHEN '10번방' THEN 10
  WHEN '11번방' THEN 20
  WHEN '7번방' THEN 30
  WHEN '8번방' THEN 40
  WHEN '9번방' THEN 50
  WHEN '4번방' THEN 60
  WHEN '5번방' THEN 70
  WHEN '6번방' THEN 80
  WHEN '1번방' THEN 90
  WHEN '2번방' THEN 100
  WHEN '3번방' THEN 110
  ELSE "sort_order"
END
WHERE "migration_reference_name" IN ('1번방', '2번방', '3번방', '4번방', '5번방', '6번방', '7번방', '8번방', '9번방', '10번방', '11번방');

-- 비켜둔 커스텀 객실(아직 음수)을 양수 구간으로 복원한다.
-- sort_order 에는 상한 CHECK 가 없어 "1000000 + 원래값" 같은 고정 오프셋은 이미 그 대역(예: 1000010)을
-- 쓰는 행이 있으면 여전히 UNIQUE 위반이 날 수 있다. 따라서 "현재 최대값 이후의 빈 자리"로 배정한다.
-- 현재 최대 sort_order(기본 객실 재배치 후 값 포함) 뒤에 10 간격으로 순번을 매기면 어떤 기존 값과도 겹치지 않는다.
-- 원래 순서를 보존하기 위해 -sort_order(=원래값) 오름차순으로 정렬한다.
WITH "displaced" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY -"sort_order" ASC) AS "rn"
  FROM "rooms"
  WHERE "sort_order" < 0
)
UPDATE "rooms"
SET "sort_order" = (SELECT COALESCE(MAX("sort_order"), 0) FROM "rooms" WHERE "sort_order" >= 0)
  + "displaced"."rn" * 10
FROM "displaced"
WHERE "rooms"."id" = "displaced"."id";
