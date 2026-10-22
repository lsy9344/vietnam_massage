import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ConditionsStep,
  CustomerStep,
  ErrorSummary,
  QuickBookingPanel,
  QuickBookingTrigger,
  StepperNav,
  type QuickBookingAvailability
} from "@/app/(erp)/calls/quick-booking-panel";
import { renderInShell } from "@/components/shell/test-harness";
import type { NewCallRowDraft } from "@/app/(erp)/calls/call-new-row-save";
import type { QuickBookingGuest } from "@/app/(erp)/calls/quick-booking-draft";
import type { Locale } from "@/lib/i18n/config";
import type {
  CustomerDto,
  CustomerVisitCandidateDto,
  ServiceCallFormOptions,
  TherapistAvailabilityCourseDto,
  TherapistAvailabilityRowDto
} from "@/modules/calls/service-call-service";

function render(locale: Locale, node: React.ReactElement) {
  return renderToStaticMarkup(renderInShell(node, locale));
}

const options: ServiceCallFormOptions = {
  rooms: [{ value: "room-101", label: "101 호실" }],
  timeSlots: [
    { value: "18:00", label: "18:00" },
    { value: "18:30", label: "18:30" }
  ],
  courses: [
    { value: "course-a", label: "A 60분" },
    { value: "course-c", label: "C 90분" },
    { value: "course-d", label: "D 90분" }
  ],
  statuses: [{ value: "RESERVED", label: "예약" }],
  discountTypes: [],
  paymentMethods: [],
  confirmationCodes: [],
  secondTherapistCourseIds: [],
  bookingChannels: [
    { value: "TELEGRAM", label: "텔레그램" },
    { value: "WALK_IN", label: "워크인" }
  ],
  therapists: [{ value: "therapist-12", label: "12번 (T12)" }],
  expenseHandlers: []
};

const customers: CustomerDto[] = [{ id: "customer-1", name: "홍길동", phone: "010-6655-1100", memo: null, preferenceNote: null }];

function course(courseId: string, code: string, minutes: number, verdict: TherapistAvailabilityCourseDto["verdict"] = "possible"): TherapistAvailabilityCourseDto {
  return { courseId, courseCode: code, courseName: code, durationMinutes: minutes, verdict, requiresSecondTherapist: code === "D" };
}

function row(therapistId: string, name: string, changes: Partial<TherapistAvailabilityRowDto> = {}): TherapistAvailabilityRowDto {
  return {
    therapistId,
    therapistName: name,
    attendance: "checked_in",
    shiftCheck: false,
    available: true,
    freeFrom: null,
    nextReservationTime: null,
    freeMinutes: null,
    plannedWorkingDayStatus: "미입력",
    callCounts: { done: 0, finished: 0, reserved: 0 },
    plannedStartTime: null,
    current: { state: "available", expectedEnd: null, nextReservationTime: null, freeMinutes: null },
    courses: [course("course-a", "A", 60), course("course-c", "C", 90), course("course-d", "D", 90)],
    ...changes
  };
}

const rows: TherapistAvailabilityRowDto[] = [
  row("therapist-12", "12번", { nextReservationTime: "19:00", freeMinutes: 60, courses: [course("course-a", "A", 60), course("course-c", "C", 90, "time_short"), course("course-d", "D", 90, "time_short")] }),
  row("therapist-7", "7번"),
  row("therapist-3", "3번", { available: false, freeFrom: "18:30", courses: [course("course-a", "A", 60, "time_short"), course("course-c", "C", 90, "time_short"), course("course-d", "D", 90, "time_short")] }),
  row("therapist-9", "9번", { attendance: "before_check_in", plannedWorkingDayStatus: "근무 예정" }),
  row("therapist-5", "5번", { attendance: "before_check_in", plannedWorkingDayStatus: "휴무" })
];

function draft(overrides: Partial<NewCallRowDraft> = {}): NewCallRowDraft {
  return {
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-10",
    startTime: "18:00",
    actualEntryTime: null,
    actualEndTime: null,
    roomId: null,
    courseId: "",
    customerMemo: null,
    customerId: null,
    therapist1Id: null,
    therapist2Id: null,
    status: "RESERVED",
    discountTypeCode: null,
    paymentMethodCode: null,
    note: null,
    visitRequest: null,
    bookingChannelCode: null,
    bookerName: null,
    confirmationCode: null,
    newCustomer: null,
    ...overrides
  };
}

const noop = () => undefined;

function conditions(
  locale: Locale,
  {
    availability = { rows, seats: [], pending: false, failed: false },
    guests = [],
    joining = false,
    partySize = 1,
    presetTherapistId = null
  }: { availability?: QuickBookingAvailability; guests?: QuickBookingGuest[]; joining?: boolean; partySize?: number; presetTherapistId?: string | null } = {}
) {
  return render(
    locale,
    <ConditionsStep
      availability={availability}
      disabled={false}
      draft={draft()}
      fieldErrors={{}}
      guests={guests}
      joining={joining}
      monthEndDate="2026-06-30"
      monthStartDate="2026-06-01"
      onAddGuest={noop}
      onNext={noop}
      onNow={noop}
      onPartySizeChange={noop}
      onRemoveGuest={noop}
      onScheduleChange={noop}
      onSecondTherapist={noop}
      options={options}
      partySize={partySize}
      onShowBeforeCheckInChange={noop}
      presetTherapistId={presetTherapistId}
      showBeforeCheckIn={false}
    />
  );
}

/** html에서 한 줄(data-quick-booking-line)을 떼어 본다. */
function line(html: string, id: string) {
  const start = html.indexOf(`data-quick-booking-line="${id}"`);
  assert.ok(start >= 0, `line not found: ${id}`);
  const open = html.lastIndexOf("<li", start);
  return html.slice(open, html.indexOf("</li>", start) + "</li>".length);
}

function lineOrder(html: string) {
  return [...html.matchAll(/data-quick-booking-line="([^"]+)"/g)].map((match) => match[1]);
}

const guest = (courseId: string, therapist1Id: string | null, therapist2Id: string | null = null): QuickBookingGuest => ({
  courseId,
  therapist1Id,
  therapist2Id,
  roomId: null
});

describe("빠른 예약 — 머리 버튼과 옆 패널(1018 스펙 D19)", () => {
  it("머리 버튼은 태블릿 폭 이상에서만 보이고 잠긴 운영월에서는 꺼진다", () => {
    assert.match(render("ko", <QuickBookingTrigger isLocked={false} />), /<button[^>]*class="[^"]*hidden min-\[600px\]:inline-flex[^"]*"[^>]*data-quick-booking-trigger=""[^>]*>빠른 예약<\/button>/);
    // 패널이 닫혀 있으면 원장 화면의 주 버튼(검정)이다. 열려 있는 동안은 패널의 "다음"·"예약 저장"이 주 버튼이라 테두리 버튼이 된다.
    assert.match(render("ko", <QuickBookingTrigger isLocked={false} />), /<button[^>]*class="[^"]*bg-brand[^"]*"[^>]*aria-expanded="false"/);
    assert.match(render("ko", <QuickBookingTrigger isLocked />), /<button[^>]*disabled=""[^>]*>빠른 예약<\/button>/);
    assert.match(render("vi", <QuickBookingTrigger isLocked={false} />), />Đặt lịch nhanh</);
  });

  it("닫혀 있으면 패널을 그리지 않고, 열면 원장 옆의 비모달 패널(휴대폰은 전체 화면 시트)로 ① 조건부터 보인다", () => {
    const props = {
      customers,
      initialAvailabilityRows: rows,
      initialAvailabilityTime: "18:00",
      isLocked: false,
      monthEndDate: "2026-06-30",
      monthStartDate: "2026-06-01",
      onOpenChange: noop,
      operatingMonthId: "month-2026-06",
      options,
      serviceDate: "2026-06-10"
    };
    assert.doesNotMatch(render("ko", <QuickBookingPanel {...props} open={false} />), /<aside/);
    const html = render("ko", <QuickBookingPanel {...props} open />);
    assert.match(html, /<aside aria-label="빠른 예약" class="[^"]*max-\[599px\]:fixed max-\[599px\]:inset-0/);
    assert.doesNotMatch(html, /role="dialog"/);
    assert.match(html, /aria-current="step"[^>]*>.*조건/);
    assert.match(html, /data-quick-booking-line="unassigned"/);
    // 이미 담은 손님이 없으면 ② 고객으로 넘어갈 수 없다.
    assert.match(html, /<button[^>]*disabled=""[^>]*>.*고객<\/button>/);
    assert.match(render("ko", <QuickBookingPanel {...props} hidden open />), /<div hidden="" id="quick-booking-panel"/);
  });

  it("단계 이동줄은 두 단계이고, 오류가 있는 단계에 표시가 붙는다", () => {
    const html = render("ko", <StepperNav customerReady disabled={false} errorSteps={new Set(["customer"])} onSelect={noop} step="conditions" />);
    assert.equal((html.match(/<li>/g) ?? []).length, 2);
    assert.match(html, /고객<span aria-hidden="true" class="font-bold text-danger">!<\/span>/);
    assert.doesNotMatch(html, /disabled=""/);
  });

  it("패널 요약은 손님별 오류에 손님 번호를 붙인다", () => {
    const html = render("ko", <ErrorSummary fieldErrors={{ "guests.2.therapist1Id": ["같은 Therapist"] }} message="저장하지 못했습니다" onJump={noop} />);
    assert.match(html, /저장하지 못했습니다/);
    assert.match(html, /손님 2 · 같은 Therapist/);
  });
});

describe("빠른 예약 ① 조건(1018 스펙 D20·D23)", () => {
  it("맨 위에 미지명 줄, 그 아래 출근한 Therapist 줄을 두고, 그 시각에 안 되는 사람은 접어 둔 N명으로 보인다", () => {
    const html = conditions("ko");
    assert.deepEqual(lineOrder(html), ["unassigned", "therapist-12", "therapist-7", "therapist-3"]);
    assert.match(html, /<details[^>]*data-quick-booking-unavailable=""[^>]*><summary[^>]*>이 시각에 안 되는 1명<\/summary>/);
    assert.match(line(html, "therapist-3"), /18:30부터/);
  });

  it("Therapist 줄은 이름 · 비는 시간 · 같은 열에 맞춘 코스 칩이다", () => {
    const html = conditions("ko");
    assert.match(line(html, "therapist-12"), /~19:00 60분/);
    assert.match(line(html, "therapist-7"), /마감까지/);
    for (const id of ["unassigned", "therapist-12", "therapist-7"]) {
      const chips = [...line(html, id).matchAll(/data-course-id="([^"]+)"/g)].map((match) => match[1]);
      assert.deepEqual(chips, ["course-a", "course-c", "course-d"], id);
    }
    assert.match(line(html, "therapist-7"), />C90</);
    // 불가 칩은 흐린 점선과 ○ 표시로 보이고, 누르면 경고를 확인한 뒤 담긴다.
    assert.match(line(html, "therapist-12"), /class="[^"]*border-dashed[^"]*"[^>]*aria-label="12번 C90 · 불가, 경고 확인 후 담기"/);
    assert.match(line(html, "therapist-12"), /aria-label="12번 A60 담기"/);
    // 그날 한 것 +예약도 이름 옆에 그대로 보인다.
    assert.match(line(html, "therapist-12"), /data-therapist-call-count=""/);
  });

  it("출근 전 보기는 근무표가 근무 예정인 출근 전 사람만 센다(휴무·근무표 없음은 빼고)", () => {
    const html = conditions("ko");
    assert.match(html, /출근 전 보기 \(1명\)/);
    assert.doesNotMatch(html, /data-quick-booking-line="therapist-9"/);
    assert.doesNotMatch(html, /data-quick-booking-line="therapist-5"/);
  });

  it("현황 줄 카드에서 연 Therapist를 미지명 줄 아래 맨 위에 골라 둔다", () => {
    const html = conditions("ko", { presetTherapistId: "therapist-7" });
    assert.deepEqual(lineOrder(html).slice(0, 3), ["unassigned", "therapist-7", "therapist-12"]);
    assert.match(line(html, "therapist-7"), /aria-current="true"/);
  });

  it("담은 손님을 하단에 보이고 뺄 수 있게 하며, 담은 Therapist 줄은 담음으로 꺼진다", () => {
    const html = conditions("ko", { partySize: 2, guests: [guest("course-c", "therapist-7"), guest("course-c", null)] });
    assert.match(html, /담은 손님 2 \/ 2명/);
    assert.match(html, /손님 1 · 7번 C90/);
    assert.match(html, /손님 2 · 미지명 C90/);
    assert.equal((html.match(/>빼기</g) ?? []).length, 2);
    assert.match(line(html, "therapist-7"), /담음/);
    // 인원만큼 담았으면 칩은 꺼지고 [다음]이 켜진다.
    assert.match(line(html, "unassigned"), /disabled=""/);
    assert.match(html, /<button class="[^"]*"[^>]*type="button">다음<\/button>/);
  });

  it("인원만큼 담기 전에는 [다음]이 꺼져 있다", () => {
    const html = conditions("ko", { partySize: 2, guests: [guest("course-c", "therapist-7")] });
    assert.match(html, /<button[^>]*disabled=""[^>]*>다음<\/button>/);
  });

  it("D코스 손님은 두 번째 Therapist를 고른다. 첫 Therapist와 다른 손님이 맡은 사람은 후보에서 빠진다", () => {
    const html = conditions("ko", { partySize: 2, guests: [guest("course-d", "therapist-7"), guest("course-a", "therapist-12")] });
    const first = html.slice(html.indexOf('data-quick-booking-guest="1"'), html.indexOf('data-quick-booking-guest="2"'));
    assert.match(first, /두 번째 Therapist/);
    // 후보 목록은 열 때만 그린다(포털 listbox). 후보에서 빠지는지는 E2E가 본다
    // (tests/e2e/story-ticket-21-quick-booking-two-therapists-and-override-path.spec.ts).
    assert.match(first, /role="combobox"/);
    // 미지명 D코스 손님은 두 번째 Therapist를 고르지 않는다.
    assert.doesNotMatch(conditions("ko", { guests: [guest("course-d", null)] }), /두 번째 Therapist/);
  });

  it("일행에 1명 추가할 때는 인원을 고르지 않는다", () => {
    assert.doesNotMatch(conditions("ko", { joining: true }), />인원</);
    assert.match(conditions("ko"), />인원</);
  });

  it("베트남어로도 같은 칸을 보인다", () => {
    const html = conditions("vi", { partySize: 1, guests: [] });
    assert.match(html, /Chưa chỉ định/);
    assert.match(html, /Đến khi đóng cửa/);
    assert.match(html, /1 người không nhận được giờ này/);
  });
});

function customerStep(
  locale: Locale,
  changes: Partial<NewCallRowDraft> = {},
  extra: { bookerCandidates?: CustomerVisitCandidateDto[]; joining?: boolean; summary?: string } = {}
) {
  return render(
    locale,
    <CustomerStep
      bookerCandidates={extra.bookerCandidates ?? []}
      customers={customers}
      disabled={false}
      draft={draft(changes)}
      fieldErrors={{}}
      joining={extra.joining ?? false}
      locale={locale}
      message={null}
      notice={null}
      onClearCustomer={noop}
      onEdit={noop}
      onPrevious={noop}
      onQueryChange={noop}
      onRetry={noop}
      onSave={noop}
      onSelectCustomer={noop}
      options={options}
      query=""
      searchCandidates={[]}
      status="idle"
      summary={extra.summary ?? "18:00 · 1명 · 7번 C90"}
      visitSummary={null}
    />
  );
}

describe("빠른 예약 ① 남은 자리(1018 스펙 D25·D26)", () => {
  // 18:00에 10자리 중 3자리가 남고, 18:30부터는 1자리다.
  const seats = [
    { time: "18:00", offsetMinutes: 0, capacity: 10, remaining: 3, freeTherapistIds: ["therapist-12", "therapist-7"] },
    { time: "18:30", offsetMinutes: 30, capacity: 10, remaining: 1, freeTherapistIds: ["therapist-12", "therapist-7"] }
  ];

  it("shows the remaining seats at the chosen time over the pick list", () => {
    const html = conditions("ko", { availability: { rows, seats, pending: false, failed: false } });
    assert.match(html, /<p[^>]*data-quick-booking-seats="3\/10"[^>]*>18:00 남은 자리 3 \/ 10<\/p>/);
    assert.ok(html.indexOf("data-quick-booking-seats") < html.indexOf('data-quick-booking-line="unassigned"'));
    assert.match(conditions("vi", { availability: { rows, seats, pending: false, failed: false } }), /18:00 còn 3 \/ 10 chỗ/);
    // 가능 판정을 아직 못 받았으면 보이지 않는다.
    assert.doesNotMatch(conditions("ko"), /data-quick-booking-seats/);
  });

  it("warns when the picked guests need more seats than remain, and still lets the counter go on", () => {
    const availability = { rows, seats, pending: false, failed: false };
    const enough = conditions("ko", { availability, guests: [guest("course-a", null)], partySize: 2 });
    assert.doesNotMatch(enough, /data-quick-booking-seat-shortage/);

    const short = conditions("ko", { availability, guests: [guest("course-a", null), guest("course-a", "therapist-7")], partySize: 2 });
    assert.match(short, /data-quick-booking-seat-shortage=""/);
    assert.match(short, /자리가 모자랍니다: 18:30 남은 자리 1, 담은 손님 2자리/);
    // 경고만 하고 막지 않는다. 인원만큼 담았으니 다음으로 갈 수 있다.
    assert.doesNotMatch(short, /<button[^>]*disabled=""[^>]*>다음<\/button>/);
  });
});

describe("빠른 예약 ② 고객(1018 스펙 D21)", () => {
  it("경로 버튼, 예약자명, 기존 고객 검색, 메모, 한 줄 요약과 저장을 둔다", () => {
    const html = customerStep("ko", { bookingChannelCode: "TELEGRAM", bookerName: "홍길동" }, { summary: "18:00 · 1명 · 7번 C90 · 텔레그램 홍길동" });
    assert.match(html, /<button aria-pressed="true"[^>]*data-booking-channel="TELEGRAM"[^>]*>텔레그램<\/button>/);
    assert.match(html, /<button aria-pressed="false"[^>]*data-booking-channel="WALK_IN"[^>]*>워크인<\/button>/);
    assert.match(html, /예약자명/);
    assert.match(html, /value="홍길동"/);
    assert.match(html, /기존 고객 검색/);
    assert.match(html, />메모</);
    assert.match(html, /data-quick-booking-summary="">18:00 · 1명 · 7번 C90 · 텔레그램 홍길동</);
    assert.match(html, />예약 저장</);
    // 객실 단계와 확인 단계는 없다.
    assert.doesNotMatch(html, /객실/);
  });

  it("예약자명과 같은 이름 고객을 최근 방문 날짜와 함께 후보로 보인다", () => {
    const html = customerStep("ko", { bookerName: "홍길동" }, {
      bookerCandidates: [
        { kind: "customer", customerId: "customer-1", label: "홍길동", phone: "010-6655-1100", latestVisitDate: "2026-06-01", completedVisitCount: 3, sharedPhone: false }
      ]
    });
    assert.match(html, /같은 이름 고객/);
    assert.match(html, /data-booker-candidate="customer-1"/);
    assert.match(html, /최근 2026-06-01/);
  });

  it("고른 고객은 이름·연락처와 선택 해제로 보이고 검색칸은 숨는다", () => {
    const html = customerStep("ko", { customerId: "customer-1", bookerName: "홍길동" });
    assert.match(html, /연결한 고객/);
    assert.match(html, /홍길동 · 010-6655-1100/);
    assert.doesNotMatch(html, /기존 고객 검색/);
  });

  it("일행에 1명 추가할 때는 고객을 고르지 않는다", () => {
    const html = customerStep("ko", {}, { joining: true });
    assert.doesNotMatch(html, /기존 고객 검색/);
    assert.match(html, /예약자명/);
  });

  it("베트남어로도 같은 칸을 보인다", () => {
    const html = customerStep("vi");
    assert.match(html, /Kênh đặt chỗ/);
    assert.match(html, /Tên người đặt/);
    assert.match(html, /Lưu đặt lịch/);
  });
});
