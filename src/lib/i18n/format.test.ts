import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatBusinessDateTime, formatBusinessTime, formatDateTime } from "@/lib/i18n/format";

const sample = "2026-09-04T12:42:00.000Z";

describe("formatDateTime", () => {
  // 마스터 화면의 생성/수정 시각은 client component에서 서버와 브라우저 양쪽에서 그려진다.
  // 오전/오후(또는 AM/PM)는 두 런타임의 ICU 데이터가 다르면 갈리고, 그 hydration mismatch가
  // 나면 React가 트리를 다시 그려 서버 액션 결과 메시지와 입력값이 사라진다.
  it("타임스탬프에 오전/오후 판정 문구를 넣지 않는다", () => {
    for (const locale of ["ko", "vi"] as const) {
      const formatted = formatDateTime(locale, sample, { dateStyle: "short", timeStyle: "short" });
      assert.ok(!/오전|오후|AM|PM/.test(formatted), `${locale}: ${formatted}`);
      assert.ok(formatted.includes("19:42"), `${locale}: ${formatted}`);
    }
  });

  it("업무 timezone(Asia/Ho_Chi_Minh)을 유지하고 호출부 옵션이 우선한다", () => {
    assert.equal(formatDateTime("ko", sample, { hour: "2-digit", minute: "2-digit" }), "19:42");
    assert.ok(formatDateTime("ko", sample, { dateStyle: "short", timeStyle: "short", hour12: true }).includes("오후"));
  });

  it("formatBusinessTime은 24시간제 HH:mm과 빈 값 처리를 유지한다", () => {
    assert.equal(formatBusinessTime("ko", sample), "19:42");
    assert.equal(formatBusinessTime("vi", null), "-");
  });
});

describe("formatBusinessDateTime", () => {
  it("베트남 시간으로 YYYY-MM-DD HH:mm을 만든다", () => {
    assert.equal(formatBusinessDateTime("2026-09-04T12:42:00.000Z"), "2026-09-04 19:42");
    assert.equal(formatBusinessDateTime("2026-10-16T17:00:00.000Z"), "2026-10-17 00:00");
  });

  it("빈 값과 해석할 수 없는 값은 null이다", () => {
    assert.equal(formatBusinessDateTime(null), null);
    assert.equal(formatBusinessDateTime(""), null);
    assert.equal(formatBusinessDateTime("not-a-date"), null);
  });
});
