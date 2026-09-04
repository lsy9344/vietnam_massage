-- Full-attendance threshold moves from 8 hours (480 minutes) to 10 hours (600 minutes),
-- and checkout becomes optional: a check-in-only row stores NULL checkout/standby and is
-- never recognized as full attendance (flag is re-evaluated when checkout is saved later).

-- 1. Backfill stored recognition flags to the 10-hour rule so the stricter CHECK
--    constraint can be added over existing data (retroactive re-evaluation).
UPDATE "therapist_attendances"
SET "is_full_attendance_recognized" = TRUE
WHERE "standby_minutes" >= 600 AND "is_full_attendance_recognized" = FALSE;

UPDATE "therapist_attendances"
SET "is_full_attendance_recognized" = FALSE
WHERE ("standby_minutes" IS NULL OR "standby_minutes" < 600) AND "is_full_attendance_recognized" = TRUE;

-- 2. Checkout (and therefore standby) becomes nullable for check-in-only saves.
ALTER TABLE "therapist_attendances" ALTER COLUMN "check_out_minute" DROP NOT NULL;
ALTER TABLE "therapist_attendances" ALTER COLUMN "standby_minutes" DROP NOT NULL;

-- 3. Re-declare the CHECK constraints with NULL handling and the 600-minute threshold.
ALTER TABLE "therapist_attendances" DROP CONSTRAINT "chk_therapist_attendances_check_out_minute_range";
ALTER TABLE "therapist_attendances" DROP CONSTRAINT "chk_therapist_attendances_standby_minutes_range";
ALTER TABLE "therapist_attendances" DROP CONSTRAINT "chk_therapist_attendances_standby_minutes_consistent";
ALTER TABLE "therapist_attendances" DROP CONSTRAINT "chk_therapist_attendances_full_attendance_consistent";

-- check_out_minute is a nullable minute-of-day integer (00:00..23:59 => 0..1439).
ALTER TABLE "therapist_attendances" ADD CONSTRAINT "chk_therapist_attendances_check_out_minute_range" CHECK ("check_out_minute" IS NULL OR ("check_out_minute" >= 0 AND "check_out_minute" <= 1439));
-- standby_minutes is the nullable overnight-aware difference (0..1439) and must match the stored times.
ALTER TABLE "therapist_attendances" ADD CONSTRAINT "chk_therapist_attendances_standby_minutes_range" CHECK ("standby_minutes" IS NULL OR ("standby_minutes" >= 0 AND "standby_minutes" <= 1439));
ALTER TABLE "therapist_attendances" ADD CONSTRAINT "chk_therapist_attendances_standby_minutes_consistent" CHECK ("standby_minutes" IS NULL OR "standby_minutes" = (("check_out_minute" - "check_in_minute" + 1440) % 1440));
-- full attendance is recognized only when standby >= 10 hours (600 minutes); a row without checkout is never recognized.
ALTER TABLE "therapist_attendances" ADD CONSTRAINT "chk_therapist_attendances_full_attendance_consistent" CHECK ("is_full_attendance_recognized" = ("standby_minutes" IS NOT NULL AND "standby_minutes" >= 600));
