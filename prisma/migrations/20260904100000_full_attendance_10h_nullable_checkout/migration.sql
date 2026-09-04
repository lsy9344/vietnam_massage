-- Full-attendance threshold moves from 8 hours (480 minutes) to 10 hours (600 minutes),
-- and checkout becomes optional: a check-in-only row stores NULL checkout/standby and is
-- never recognized as full attendance (flag is re-evaluated when checkout is saved later).
--
-- NOTE: the physical schema on some environments (e.g. restored/imported databases) may
-- not carry the canonical CHECK constraint names from the baseline migration. To stay
-- deterministic, this migration drops ALL existing CHECK constraints on the table first,
-- then re-judges the stored flags, and finally re-declares the canonical set with the
-- new rule. Constraint removal happens before the backfill UPDATE so legacy 8-hour
-- checks cannot reject re-judged rows.

-- 1. Drop every CHECK constraint currently on the table (canonical or auto-named legacy).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE contype = 'c' AND conrelid = 'therapist_attendances'::regclass
  LOOP
    EXECUTE format('ALTER TABLE "therapist_attendances" DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 2. Backfill stored recognition flags to the 10-hour rule (retroactive re-evaluation).
UPDATE "therapist_attendances"
SET "is_full_attendance_recognized" = TRUE
WHERE "standby_minutes" >= 600 AND "is_full_attendance_recognized" = FALSE;

UPDATE "therapist_attendances"
SET "is_full_attendance_recognized" = FALSE
WHERE ("standby_minutes" IS NULL OR "standby_minutes" < 600) AND "is_full_attendance_recognized" = TRUE;

-- 3. Checkout (and therefore standby) becomes nullable for check-in-only saves.
ALTER TABLE "therapist_attendances" ALTER COLUMN "check_out_minute" DROP NOT NULL;
ALTER TABLE "therapist_attendances" ALTER COLUMN "standby_minutes" DROP NOT NULL;

-- 4. Re-declare the canonical CHECK set with NULL handling and the 600-minute threshold.
-- check_in/check_out are minute-of-day integers (00:00..23:59 => 0..1439); checkout is nullable.
ALTER TABLE "therapist_attendances" ADD CONSTRAINT "chk_therapist_attendances_check_in_minute_range" CHECK ("check_in_minute" >= 0 AND "check_in_minute" <= 1439);
ALTER TABLE "therapist_attendances" ADD CONSTRAINT "chk_therapist_attendances_check_out_minute_range" CHECK ("check_out_minute" IS NULL OR ("check_out_minute" >= 0 AND "check_out_minute" <= 1439));
-- standby_minutes is the nullable overnight-aware difference (0..1439) and must match the stored times.
ALTER TABLE "therapist_attendances" ADD CONSTRAINT "chk_therapist_attendances_standby_minutes_range" CHECK ("standby_minutes" IS NULL OR ("standby_minutes" >= 0 AND "standby_minutes" <= 1439));
ALTER TABLE "therapist_attendances" ADD CONSTRAINT "chk_therapist_attendances_standby_minutes_consistent" CHECK ("standby_minutes" IS NULL OR "standby_minutes" = (("check_out_minute" - "check_in_minute" + 1440) % 1440));
-- full attendance is recognized only when standby >= 10 hours (600 minutes); a row without checkout is never recognized.
ALTER TABLE "therapist_attendances" ADD CONSTRAINT "chk_therapist_attendances_full_attendance_consistent" CHECK ("is_full_attendance_recognized" = ("standby_minutes" IS NOT NULL AND "standby_minutes" >= 600));
