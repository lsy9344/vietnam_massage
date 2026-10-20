import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clockCodeMinuteNow,
  computeClockInCode,
  deriveClockCodeDaySecretHex,
  previousClockCodeMinute,
  selectClockCodeDaySecret
} from "@/modules/therapists/therapist-clock-code";

describe("therapist clock code (pure, Web Crypto)", () => {
  it("derives a day secret deterministically from the secret and calendar date", async () => {
    const a = await deriveClockCodeDaySecretHex("secret-1", "2042-05-10");
    const b = await deriveClockCodeDaySecretHex("secret-1", "2042-05-10");
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]+$/);
  });

  it("gives different days (or different secrets) different day secrets", async () => {
    const day1 = await deriveClockCodeDaySecretHex("secret-1", "2042-05-10");
    const day2 = await deriveClockCodeDaySecretHex("secret-1", "2042-05-11");
    const otherSecret = await deriveClockCodeDaySecretHex("secret-2", "2042-05-10");
    assert.notEqual(day1, day2, "다른 날짜는 다른 키여야 한다");
    assert.notEqual(day1, otherSecret, "다른 비밀값은 다른 키여야 한다");
  });

  it("computes a stable 4-digit zero-padded code for the same (day secret, minute)", async () => {
    const daySecret = await deriveClockCodeDaySecretHex("secret-1", "2042-05-10");
    const codeA = await computeClockInCode(daySecret, 540);
    const codeB = await computeClockInCode(daySecret, 540);
    assert.equal(codeA, codeB);
    assert.match(codeA, /^\d{4}$/);
  });

  it("changes the code when the minute changes (분 경계)", async () => {
    const daySecret = await deriveClockCodeDaySecretHex("secret-1", "2042-05-10");
    const codes = await Promise.all(Array.from({ length: 10 }, (_, minute) => computeClockInCode(daySecret, minute)));
    assert.ok(new Set(codes).size > 1, "분마다 코드가 달라져야 한다");
  });

  it("changes the code for the same minute number on a different day key (다른 날 키 거절)", async () => {
    const today = await deriveClockCodeDaySecretHex("secret-1", "2042-05-10");
    const tomorrow = await deriveClockCodeDaySecretHex("secret-1", "2042-05-11");
    const codeToday = await computeClockInCode(today, 600);
    const codeTomorrow = await computeClockInCode(tomorrow, 600);
    assert.notEqual(codeToday, codeTomorrow);
  });

  it("clockCodeMinuteNow reads the business-timezone calendar date and minute of day", () => {
    // 2042-05-10 14:05(Asia/Ho_Chi_Minh) = 2042-05-10T07:05:00.000Z.
    const minute = clockCodeMinuteNow(new Date("2042-05-10T07:05:00.000Z"));
    assert.equal(minute.calendarDate, "2042-05-10");
    assert.equal(minute.minuteOfDay, 14 * 60 + 5);
  });

  it("previousClockCodeMinute steps back one minute within the same day", () => {
    const previous = previousClockCodeMinute({ calendarDate: "2042-05-10", minuteOfDay: 600 });
    assert.deepEqual(previous, { calendarDate: "2042-05-10", minuteOfDay: 599 });
  });

  it("previousClockCodeMinute crosses midnight into the previous day's last minute (자정을 넘긴 직전 분)", () => {
    const previous = previousClockCodeMinute({ calendarDate: "2042-05-10", minuteOfDay: 0 });
    assert.deepEqual(previous, { calendarDate: "2042-05-09", minuteOfDay: 1439 });
  });

  // R12: 매장 화면을 이틀 넘게 켜 두면 받은 키(오늘·다음 날)의 날짜를 모두 지난다. 그 전에는
  // tomorrow.date를 지나 today.date와 같다는 오산으로 today 키를 다시 썼다(틀린 코드).
  describe("selectClockCodeDaySecret (R12)", () => {
    const keys = { today: { date: "2042-05-10", daySecretHex: "today-secret" }, tomorrow: { date: "2042-05-11", daySecretHex: "tomorrow-secret" } };

    it("picks today's secret on today's date", () => {
      assert.equal(selectClockCodeDaySecret(keys, "2042-05-10"), "today-secret");
    });

    it("picks tomorrow's secret on tomorrow's date", () => {
      assert.equal(selectClockCodeDaySecret(keys, "2042-05-11"), "tomorrow-secret");
    });

    it("returns null the day after tomorrow instead of falling back to today's secret", () => {
      assert.equal(selectClockCodeDaySecret(keys, "2042-05-12"), null);
    });

    it("returns null for a date before today too", () => {
      assert.equal(selectClockCodeDaySecret(keys, "2042-05-09"), null);
    });
  });
});
