import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { settlementBasisText } from "@/lib/i18n/settlement-basis";

describe("settlementBasisText", () => {
  it("ko면 원문을 그대로 반환한다", () => {
    assert.equal(settlementBasisText("ko", "팀장 몫 3,000,000 VND"), "팀장 몫 3,000,000 VND");
    assert.equal(settlementBasisText("ko", "방문완료 풀 200000 VND / 정상 근무자 2명"), "방문완료 풀 200000 VND / 정상 근무자 2명");
  });

  it("null/빈 값은 빈 문자열", () => {
    assert.equal(settlementBasisText("vi", null), "");
    assert.equal(settlementBasisText("vi", undefined), "");
  });

  it("ops-monthly 동적 금액/인원 문구를 vi로 번역한다", () => {
    assert.equal(settlementBasisText("vi", "팀장 몫 3000000 VND"), "Phần trưởng nhóm 3.000.000 VND");
    assert.match(settlementBasisText("vi", "카운터팀 몫 5000000 VND / 3명"), /Phần nhóm quầy .*VND \/ 3 người/);
    assert.match(settlementBasisText("vi", "웨이터팀 대상자 0명 / 미배분 1000000 VND"), /0 đối tượng nhóm phục vụ/);
  });

  it("ops-monthly 고정 문구를 vi로 번역한다(화이트리스트)", () => {
    assert.equal(settlementBasisText("vi", "팀장 대상 아님"), "Không thuộc đối tượng trưởng nhóm");
    assert.equal(settlementBasisText("vi", "미분류 지급"), "Chi chưa phân loại");
  });

  it("earcare 풀/근무자 문구(잔여 포함)를 vi로 번역한다", () => {
    assert.equal(settlementBasisText("vi", "방문완료 귀케어 풀 0 VND"), "Quỹ chăm sóc tai hoàn tất 0 VND");
    assert.match(settlementBasisText("vi", "방문완료 풀 200000 VND / 정상 근무자 2명"), /Quỹ hoàn tất .*VND \/ 2 nhân viên bình thường$/);
    assert.match(
      settlementBasisText("vi", "방문완료 풀 200000 VND / 정상 근무자 2명 + 잔여 50000 VND 배분"),
      /phân bổ phần dư .*VND/
    );
  });

  it("ops-daily 개인 인센 문구를 vi로 번역한다", () => {
    assert.match(settlementBasisText("vi", "일 총콜 50콜 / 40콜 이상 개인 200000 VND"), /Tổng cuộc gọi ngày 50 ca \/ từ 40 ca, cá nhân .*VND/);
  });

  it("'{상태} 제외' 문구는 상태를 번역하고 제외를 vi로 표기한다", () => {
    // 상태 라벨이 화이트리스트에 없으면 원문 상태 + vi 제외.
    assert.equal(settlementBasisText("vi", "결근 제외"), "결근 (loại trừ)");
  });

  it("동적 threshold 경고를 vi로 번역한다", () => {
    assert.match(settlementBasisText("vi", "30콜 미만으로 운영팀 일일 인센이 없습니다."), /Dưới 30 ca nên không có thưởng ngày/);
    assert.match(settlementBasisText("vi", "40콜 미만으로 운영팀 월 인센이 없습니다."), /Dưới 40 ca nên không có thưởng tháng/);
  });

  it("미매칭 문구는 원문(ko)으로 안전 fallback한다", () => {
    assert.equal(settlementBasisText("vi", "전혀 모르는 근거 문구"), "전혀 모르는 근거 문구");
  });
});
