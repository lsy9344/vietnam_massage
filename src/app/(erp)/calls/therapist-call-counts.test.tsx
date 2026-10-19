import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TherapistCallStrip, therapistCallStripRows } from "@/app/(erp)/calls/therapist-call-counts";
import type { TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

function row(
  therapistId: string,
  attendance: TherapistAvailabilityRowDto["attendance"],
  done: number,
  reserved: number
): TherapistAvailabilityRowDto {
  return {
    therapistId,
    therapistName: therapistId,
    attendance,
    shiftCheck: false,
    available: true,
    freeFrom: null,
    nextReservationTime: null,
    freeMinutes: 60,
    plannedWorkingDayStatus: "미입력",
    callCounts: { done, reserved },
    courses: []
  };
}

// 화면 낭독기가 읽는 글자. 보이기만 하는 숫자(aria-hidden)는 빼고 sr-only 문장을 남긴다.
function spoken(html: string) {
  return html
    .replace(/<span aria-hidden="true"[^>]*>[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function item(html: string, therapistId: string) {
  return html.match(new RegExp(`<li[^>]*data-therapist-call-strip="${therapistId}"[^>]*>([\\s\\S]*?)</li>`))?.[0] ?? "";
}

describe("원장 띠에 올릴 Therapist", () => {
  it("keeps checked-in Therapists even without calls, checked-out ones only with calls, and drops those before check-in, in the given order", () => {
    const rows = [
      row("린", "checked_in", 3, 2),
      row("미출근", "before_check_in", 0, 1),
      row("마이", "checked_in", 0, 0),
      row("퇴근-콜", "checked_out", 2, 0),
      row("퇴근-없음", "checked_out", 0, 0)
    ];
    assert.deepEqual(therapistCallStripRows(rows).map((entry) => entry.therapistId), ["린", "마이", "퇴근-콜"]);
  });

  it("shows only Therapists with calls when nobody has checked in that day", () => {
    const rows = [row("린", "before_check_in", 0, 2), row("마이", "before_check_in", 0, 0), row("투", "before_check_in", 1, 0)];
    assert.deepEqual(therapistCallStripRows(rows).map((entry) => entry.therapistId), ["린", "투"]);
  });
});

describe("원장 탭의 Therapist별 콜 띠", () => {
  const rows = [row("린", "checked_in", 3, 2), row("마이", "checked_in", 0, 0), row("투", "checked_out", 1, 0), row("미출근", "before_check_in", 0, 1)];

  it("shows the legend, then each Therapist as done +booked, and the unassigned reservations at the end", () => {
    const html = renderToStaticMarkup(<TherapistCallStrip locale="ko" rows={rows} unassignedCount={2} />);

    assert.match(html, /^<ul aria-label="Therapist별 콜 수"/);
    assert.match(html, /<li[^>]*>한 것 \+예약<\/li>/);
    // 한 것은 진하게, 예약은 흐리게 "+"를 붙인다.
    assert.match(item(html, "린"), /font-semibold text-foreground">3<\/span><span aria-hidden="true" class="text-muted">\+2<\/span>/);
    assert.equal(spoken(item(html, "린")), "린 한 것 3, 예약 2");
    assert.doesNotMatch(html, /미출근/);
    assert.match(html, /data-unassigned-call-count="">미배정 2<\/li><\/ul>$/);
  });

  it("marks a checked-in Therapist with nothing done or booked with ▲ and the warning color, and not a checked-out one", () => {
    const html = renderToStaticMarkup(<TherapistCallStrip locale="ko" rows={rows} unassignedCount={0} />);

    assert.match(item(html, "마이"), /rounded-full bg-warning-soft px-2 text-warning" data-idle=""/);
    assert.match(item(html, "마이"), /▲/);
    assert.equal(spoken(item(html, "마이")), "마이 한 것 0, 예약 0, 콜 없음");
    // 퇴근은 흐리게, "퇴근" 글자를 붙이고 강조하지 않는다.
    assert.match(item(html, "투"), /^<li class="inline-flex items-baseline gap-1.5 text-muted"/);
    assert.match(item(html, "투"), />퇴근</);
    assert.doesNotMatch(item(html, "린") + item(html, "투"), /data-idle|bg-warning-soft|▲/);
  });

  it("hides the unassigned count at zero and draws nothing when there is nobody to show", () => {
    assert.doesNotMatch(renderToStaticMarkup(<TherapistCallStrip locale="ko" rows={rows} unassignedCount={0} />), /미배정/);
    assert.equal(renderToStaticMarkup(<TherapistCallStrip locale="ko" rows={[row("미출근", "before_check_in", 0, 0)]} unassignedCount={0} />), "");
    assert.match(renderToStaticMarkup(<TherapistCallStrip locale="ko" rows={[]} unassignedCount={1} />), /미배정 1/);
  });

  it("speaks Vietnamese", () => {
    const html = renderToStaticMarkup(<TherapistCallStrip locale="vi" rows={rows} unassignedCount={2} />);
    assert.match(html, /aria-label="Số ca theo Therapist"/);
    assert.match(html, />Đã làm \+Đặt trước</);
    assert.equal(spoken(item(html, "린")), "린 Đã làm 3, đặt trước 2");
    assert.match(spoken(item(html, "마이")), /Chưa có ca$/);
    assert.match(item(html, "투"), />Đã về</);
    assert.match(html, />Chưa phân công 2</);
  });
});
