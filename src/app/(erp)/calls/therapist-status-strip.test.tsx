import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInShell } from "@/components/shell/test-harness";
import { TherapistStatusStrip } from "@/app/(erp)/calls/therapist-status-strip";
import { sortTherapistStatusRows, therapistStatusRows, THERAPIST_STATUS_SORTS } from "@/app/(erp)/calls/therapist-status";
import type { Locale } from "@/lib/i18n/config";
import type { TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

type Current = TherapistAvailabilityRowDto["current"];

const free = (nextReservationTime: string | null = null, freeMinutes: number | null = null): Current => ({
  state: "available",
  expectedEnd: null,
  nextReservationTime,
  freeMinutes
});
const soon = (nextReservationTime: string, freeMinutes: number): Current => ({ state: "reserved_soon", expectedEnd: null, nextReservationTime, freeMinutes });
const inUse = (expectedEnd: string): Current => ({ state: "in_use", expectedEnd, nextReservationTime: null, freeMinutes: null });
const off = (state: "before_check_in" | "checked_out"): Current => ({ state, expectedEnd: null, nextReservationTime: null, freeMinutes: null });

function row(
  therapistName: string,
  current: Current,
  counts: { finished?: number; reserved?: number } = {},
  extra: Partial<TherapistAvailabilityRowDto> = {}
): TherapistAvailabilityRowDto {
  const finished = counts.finished ?? 0;
  const reserved = counts.reserved ?? 0;
  return {
    therapistId: `t-${therapistName}`,
    therapistName,
    attendance: current.state === "before_check_in" || current.state === "checked_out" ? current.state : "checked_in",
    shiftCheck: false,
    available: true,
    freeFrom: null,
    nextReservationTime: null,
    freeMinutes: 60,
    plannedWorkingDayStatus: "미입력",
    callCounts: { done: finished, finished, reserved },
    plannedStartTime: null,
    current,
    courses: [],
    ...extra
  };
}

const names = (rows: TherapistAvailabilityRowDto[]) => rows.map((entry) => entry.therapistName);

function render(locale: Locale, rows: TherapistAvailabilityRowDto[], unassignedCount = 0) {
  return renderToStaticMarkup(renderInShell(<TherapistStatusStrip canBook rows={rows} unassignedCount={unassignedCount} />, locale));
}

function card(html: string, therapistName: string) {
  return html.match(new RegExp(`<li[^>]*data-therapist-status="t-${therapistName}"[^>]*>([\\s\\S]*?)</li>`))?.[0] ?? "";
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("Therapist 현황 줄에 올릴 Therapist (1018 스펙 D17)", () => {
  it("keeps those who checked in, those scheduled to work before check-in, and checked-out ones only with calls that day", () => {
    const rows = [
      row("출근", free()),
      row("근무예정", off("before_check_in"), {}, { plannedWorkingDayStatus: "근무 예정" }),
      row("미입력", off("before_check_in")),
      row("휴무", off("before_check_in"), {}, { plannedWorkingDayStatus: "휴무" }),
      row("퇴근-콜", off("checked_out"), { finished: 2 }),
      row("퇴근-없음", off("checked_out"))
    ];
    assert.deepEqual(names(therapistStatusRows(rows)), ["출근", "근무예정", "퇴근-콜"]);
  });

  it("also keeps someone before check-in who already has a call that day, so the booking stays visible", () => {
    assert.deepEqual(names(therapistStatusRows([row("예약만", off("before_check_in"), { reserved: 1 })])), ["예약만"]);
  });
});

describe("Therapist 현황 줄 정렬 (1018 스펙 D17)", () => {
  const rows = [
    row("12", inUse("18:30"), { finished: 1, reserved: 3 }),
    row("2", free("19:00", 120), { finished: 2, reserved: 1 }),
    row("19", off("before_check_in"), { finished: 0, reserved: 1 }),
    row("9", free(), { finished: 0, reserved: 2 }),
    row("5", off("checked_out"), { finished: 3, reserved: 0 })
  ];

  it("puts free now first, then in use, before check-in and checked out, with fewer finished first among equals", () => {
    assert.deepEqual(names(sortTherapistStatusRows(rows, "available")), ["9", "2", "12", "19", "5"]);
  });

  it("puts reserved soon right after free now (2026-10-23 고객 요청)", () => {
    assert.deepEqual(names(sortTherapistStatusRows([row("12", inUse("18:30")), row("17", soon("15:00", 26)), row("9", free())], "available")), ["9", "17", "12"]);
  });

  it("sorts by fewer finished today, keeping the given order among equals", () => {
    assert.deepEqual(names(sortTherapistStatusRows(rows, "finished")), ["19", "9", "12", "2", "5"]);
  });

  it("sorts by fewer remaining reservations", () => {
    assert.deepEqual(names(sortTherapistStatusRows(rows, "reserved")), ["5", "2", "19", "9", "12"]);
  });

  it("sorts by Therapist number", () => {
    assert.deepEqual(names(sortTherapistStatusRows(rows, "number")), ["2", "5", "9", "12", "19"]);
  });
});

describe("Therapist 현황 줄 (1018 스펙 D17)", () => {
  const rows = [
    row("12", free("19:00", 120), { finished: 2, reserved: 1 }),
    row("17", inUse("18:30"), { finished: 1, reserved: 3 }),
    row("19", off("before_check_in"), { reserved: 1 }, { plannedWorkingDayStatus: "근무 예정", plannedStartTime: "18:00" }),
    row("21", off("checked_out"), { finished: 4 })
  ];

  it("shows number, finished, remaining reservations, the state now and the next time on each card", () => {
    const html = render("ko", rows, 2);

    assert.match(html, /aria-label="Therapist 현황"/);
    assert.equal(text(card(html, "12")), "12 완료 2 · 예약 1 ●︎ 지금 가능 ~19:00 (120분) 콜만");
    assert.equal(text(card(html, "17")), "17 완료 1 · 예약 3 ◆︎ 사용 중 종료 예상 18:30 콜만");
    assert.equal(text(card(html, "19")), "19 완료 0 · 예약 1 ○︎ 출근 전 18:00 콜만");
    // 퇴근한 사람은 흐리게 보인다.
    assert.match(card(html, "21"), /^<li[^>]*class="[^"]*text-muted/);
    assert.match(text(card(html, "21")), /퇴근/);
  });

  it("does not call someone free now when the next reservation comes before the shortest course could end (2026-10-23 고객 요청)", () => {
    const html = render("ko", [row("17", soon("15:00", 26), { finished: 1, reserved: 3 })]);

    assert.equal(text(card(html, "17")), "17 완료 1 · 예약 3 ▲︎ 곧 예약 15:00 예약 (26분 후) 콜만");
    assert.doesNotMatch(card(html, "17"), /지금 가능/);
  });

  it("puts the unassigned reservations at the end and leaves rooms and cleaning out", () => {
    const html = render("ko", rows, 2);

    assert.match(html, /data-unassigned-call-count="">미지명 2</);
    assert.doesNotMatch(html, /객실|청소/);
  });

  it("offers the four sorts with free now first, a filter button per card, and a collapse toggle", () => {
    const html = render("ko", rows);

    assert.deepEqual(THERAPIST_STATUS_SORTS, ["available", "finished", "reserved", "number"]);
    assert.match(html, /aria-label="정렬"[^>]*role="combobox"/);
    assert.match(html, />지금 가능 순</);
    assert.match(card(html, "12"), /aria-label="12 콜만 보기" aria-pressed="false"/);
    assert.match(card(html, "12"), /data-therapist-status-book=""/);
    assert.match(html, /aria-expanded="true"[^>]*>현황 접기</);
  });

  it("draws nothing when there is nobody to show and no unassigned reservation", () => {
    assert.equal(render("ko", [row("미입력", off("before_check_in"))]), "");
    assert.match(render("ko", [], 1), /미지명 1/);
  });

  it("speaks Vietnamese", () => {
    const html = render("vi", rows, 2);

    assert.match(text(card(html, "12")), /Hoàn thành 2 · Đặt trước 1 ●︎ Rảnh ngay ~19:00 \(120 phút\)/);
    assert.match(text(card(html, "17")), /Đang sử dụng Dự kiến xong 18:30/);
    assert.match(html, />Chưa chỉ định 2</);
  });
});
