import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TherapistAccountNoticeView } from "@/app/(erp)/masters/employees/therapist-account-panel";
import { renderInShell } from "@/components/shell/test-harness";
import type { TherapistAccountNoticeDto } from "@/app/(erp)/masters/employees/therapist-account-actions";

// R10(D5 "쪽지는 베트남어"): 안내 쪽지는 관리자가 지금 보는 화면 언어와 무관하게 늘 베트남어로
// 그려져야 한다 — 받는 사람이 Therapist라서다. 관리자 locale을 ko로 둔 채로 렌더해 쪽지 문구가
// vi로 나오는지 본다(한국어 관리자로 발급해도 쪽지는 베트남어, 공통 규칙 README의 E2E 기준과 짝이다).
const notice: TherapistAccountNoticeDto = {
  accountId: "THR-012",
  temporaryPassword: "a1b2c3",
  loginUrl: "https://example.com/therapist"
};

function renderNotice(adminLocale: "ko" | "vi") {
  return renderToStaticMarkup(renderInShell(<TherapistAccountNoticeView notice={notice} onClose={() => {}} />, adminLocale));
}

describe("TherapistAccountNoticeView", () => {
  it("renders the notice in Vietnamese even when the admin's screen language is Korean", () => {
    const html = renderNotice("ko");
    assert.match(html, /Giấy hướng dẫn cho KTV/);
    assert.match(html, /Mật khẩu tạm/);
    assert.match(html, /Đưa giấy này hoặc cho KTV xem mã QR/);
    assert.doesNotMatch(html, /Therapist 안내 쪽지/);
    assert.doesNotMatch(html, /임시 비밀번호/);
  });

  it("stays Vietnamese when the admin's screen language already is Vietnamese", () => {
    const html = renderNotice("vi");
    assert.match(html, /Giấy hướng dẫn cho KTV/);
  });
});
