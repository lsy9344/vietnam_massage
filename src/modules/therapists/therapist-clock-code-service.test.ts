import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeClockInCode, deriveClockCodeDaySecretHex } from "@/modules/therapists/therapist-clock-code";
import { getTherapistClockCodeDisplayKeys, verifyTherapistClockInCode } from "@/modules/therapists/therapist-clock-code-service";

const SECRET = "test-nextauth-secret";

// 2042-05-10 14:00:30(Asia/Ho_Chi_Minh) = 2042-05-10T07:00:30.000Z.
const NOW = new Date("2042-05-10T07:00:30.000Z");

async function codeFor(calendarDate: string, minuteOfDay: number) {
  const daySecretHex = await deriveClockCodeDaySecretHex(SECRET, calendarDate);
  return computeClockInCode(daySecretHex, minuteOfDay);
}

describe("verifyTherapistClockInCode", () => {
  it("accepts the current minute's code (분 경계)", async () => {
    const code = await codeFor("2042-05-10", 14 * 60);
    const valid = await verifyTherapistClockInCode({ now: NOW, submittedCode: code, secret: SECRET });
    assert.equal(valid, true);
  });

  it("accepts the previous minute's code (직전 1분 허용)", async () => {
    const code = await codeFor("2042-05-10", 14 * 60 - 1);
    const valid = await verifyTherapistClockInCode({ now: NOW, submittedCode: code, secret: SECRET });
    assert.equal(valid, true);
  });

  it("rejects the minute before that (그 전 분 거절)", async () => {
    const code = await codeFor("2042-05-10", 14 * 60 - 2);
    const valid = await verifyTherapistClockInCode({ now: NOW, submittedCode: code, secret: SECRET });
    assert.equal(valid, false);
  });

  it("accepts the previous day's last minute right after midnight (자정을 넘긴 직전 분)", async () => {
    // 2042-05-11 00:00:30(Asia/Ho_Chi_Minh) = 2042-05-10T17:00:30.000Z.
    const midnight = new Date("2042-05-10T17:00:30.000Z");
    const code = await codeFor("2042-05-10", 1439);
    const valid = await verifyTherapistClockInCode({ now: midnight, submittedCode: code, secret: SECRET });
    assert.equal(valid, true);
  });

  it("rejects a code computed with a different day's key (다른 날 키 거절)", async () => {
    const codeForTomorrow = await codeFor("2042-05-11", 14 * 60);
    const valid = await verifyTherapistClockInCode({ now: NOW, submittedCode: codeForTomorrow, secret: SECRET });
    assert.equal(valid, false);
  });

  it("rejects malformed input instead of throwing", async () => {
    assert.equal(await verifyTherapistClockInCode({ now: NOW, submittedCode: "12a4", secret: SECRET }), false);
    assert.equal(await verifyTherapistClockInCode({ now: NOW, submittedCode: "123", secret: SECRET }), false);
    assert.equal(await verifyTherapistClockInCode({ now: NOW, submittedCode: "", secret: SECRET }), false);
  });
});

describe("getTherapistClockCodeDisplayKeys", () => {
  it("returns today's and tomorrow's day secret, matching the pure derivation", async () => {
    const keys = await getTherapistClockCodeDisplayKeys({ now: NOW, secret: SECRET });
    assert.equal(keys.today.date, "2042-05-10");
    assert.equal(keys.tomorrow.date, "2042-05-11");
    assert.equal(keys.today.daySecretHex, await deriveClockCodeDaySecretHex(SECRET, "2042-05-10"));
    assert.equal(keys.tomorrow.daySecretHex, await deriveClockCodeDaySecretHex(SECRET, "2042-05-11"));
  });

  it("never includes the raw secret itself in the display payload", async () => {
    const keys = await getTherapistClockCodeDisplayKeys({ now: NOW, secret: SECRET });
    const serialized = JSON.stringify(keys);
    assert.ok(!serialized.includes(SECRET));
  });
});
