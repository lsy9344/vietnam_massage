import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CustomerStep,
  ErrorSummary,
  QuickBookingPanel,
  ReviewStep,
  RoomStep,
  ScheduleStep,
  StepperNav,
  TherapistStep
} from "@/app/(erp)/calls/quick-booking-panel";
import { renderInShell } from "@/components/shell/test-harness";
import type { NewCallRowDraft } from "@/app/(erp)/calls/call-new-row-save";
import type { Locale } from "@/lib/i18n/config";
import type { CustomerDto, ServiceCallFormOptions, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

function render(locale: Locale, node: React.ReactElement) {
  return renderToStaticMarkup(renderInShell(node, locale));
}

const options: ServiceCallFormOptions = {
  rooms: [{ value: "room-101", label: "101 호실" }],
  timeSlots: [
    { value: "15:00", label: "15:00" },
    { value: "15:30", label: "15:30" }
  ],
  courses: [{ value: "course-a", label: "A 60분" }],
  statuses: [{ value: "RESERVED", label: "예약" }],
  discountTypes: [],
  paymentMethods: [],
  confirmationCodes: [],
  therapists: [{ value: "therapist-1", label: "마사지사1" }],
  earcareEmployees: [],
  expenseHandlers: []
};

const customers: CustomerDto[] = [
  { id: "customer-1", name: "지윤", phone: "010-6655-1100", memo: null },
  { id: "customer-2", name: "하나", phone: null, memo: null }
];

function draft(overrides: Partial<NewCallRowDraft> = {}): NewCallRowDraft {
  return {
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-10",
    startTime: "",
    actualEntryTime: null,
    roomId: null,
    courseId: "",
    customerMemo: null,
    customerId: null,
    therapist1Id: null,
    therapist2Id: null,
    earcareEmployeeId: null,
    status: "RESERVED",
    discountTypeCode: null,
    paymentMethodCode: null,
    note: null,
    confirmationCode: null,
    ...overrides
  };
}

describe("빠른 예약 패널 — 원장 탭 머리의 주요 버튼(명세 F08, 티켓 20)", () => {
  it("닫혀 있으면 태블릿 폭 이상에서만 버튼이 보이고, 패널 내용은 그려지지 않는다", () => {
    const html = render(
      "ko",
      <QuickBookingPanel
        customers={customers}
        initialAvailabilityRows={[]}
        initialAvailabilityTime="15:00"
        isLocked={false}
        monthEndDate="2026-06-30"
        monthStartDate="2026-06-01"
        operatingMonthId="month-2026-06"
        options={options}
        serviceDate="2026-06-10"
      />
    );
    assert.match(html, /<div class="hidden min-\[600px\]:block">/);
    assert.match(html, /<button[^>]*>빠른 예약<\/button>/);
    // 닫힌 모달의 내용(단계 화면)은 서버에서 그리지 않는다.
    assert.doesNotMatch(html, /날짜·예약시각/);

    const vietnamese = render(
      "vi",
      <QuickBookingPanel
        customers={customers}
        initialAvailabilityRows={[]}
        initialAvailabilityTime="15:00"
        isLocked={false}
        monthEndDate="2026-06-30"
        monthStartDate="2026-06-01"
        operatingMonthId="month-2026-06"
        options={options}
        serviceDate="2026-06-10"
      />
    );
    assert.match(vietnamese, />Đặt lịch nhanh</);
  });

  it("잠긴 운영월에서는 빠른 예약 버튼이 꺼진다", () => {
    const html = render(
      "ko",
      <QuickBookingPanel
        customers={customers}
        initialAvailabilityRows={[]}
        initialAvailabilityTime="15:00"
        isLocked
        monthEndDate="2026-06-30"
        monthStartDate="2026-06-01"
        operatingMonthId="month-2026-06"
        options={options}
        serviceDate="2026-06-10"
      />
    );
    assert.match(html, /<button[^>]*disabled=""[^>]*>빠른 예약<\/button>/);
  });
});

describe("빠른 예약 — 단계 화면(정적 렌더)", () => {
  it("고객 단계: 고르지 않았으면 검색칸과 고객/메모 칸을 보여 준다", () => {
    const html = render(
      "ko",
      <CustomerStep
        customers={customers}
        disabled={false}
        draft={draft()}
        fieldErrors={{}}
        monthEndDate="2026-06-30"
        monthStartDate="2026-06-01"
        onEdit={() => undefined}
        options={options}
      />
    );
    assert.match(html, />고객 검색</);
    assert.match(html, />고객\/메모</);
    assert.doesNotMatch(html, /선택 해제/);

    const vietnamese = render(
      "vi",
      <CustomerStep
        customers={customers}
        disabled={false}
        draft={draft()}
        fieldErrors={{}}
        monthEndDate="2026-06-30"
        monthStartDate="2026-06-01"
        onEdit={() => undefined}
        options={options}
      />
    );
    assert.match(vietnamese, />Tìm khách hàng</);
  });

  it("고객 단계: 고객을 고르면 이름·연락처와 선택 해제 버튼을 보여 주고 검색칸은 숨는다", () => {
    const html = render(
      "ko",
      <CustomerStep
        customers={customers}
        disabled={false}
        draft={draft({ customerId: "customer-1" })}
        fieldErrors={{}}
        monthEndDate="2026-06-30"
        monthStartDate="2026-06-01"
        onEdit={() => undefined}
        options={options}
      />
    );
    assert.match(html, /지윤 · 010-6655-1100/);
    assert.match(html, />선택 해제</);
    assert.doesNotMatch(html, /role="combobox"/);
  });

  it("고객 단계: 필드 오류는 그 칸 옆에 보인다", () => {
    const html = render(
      "ko",
      <CustomerStep
        customers={customers}
        disabled={false}
        draft={draft()}
        fieldErrors={{ customerMemo: ["500자 이하로 입력하세요."] }}
        monthEndDate="2026-06-30"
        monthStartDate="2026-06-01"
        onEdit={() => undefined}
        options={options}
      />
    );
    assert.match(html, /role="alert">500자 이하로 입력하세요\.</);
  });

  it("날짜·예약시각 단계: 운영월 범위로 날짜를 제한하고 '지금' 버튼이 있다", () => {
    const html = render(
      "ko",
      <ScheduleStep
        disabled={false}
        draft={draft({ startTime: "15:00" })}
        fieldErrors={{}}
        monthEndDate="2026-06-30"
        monthStartDate="2026-06-01"
        onNow={() => undefined}
        onScheduleChange={() => undefined}
        options={options}
      />
    );
    assert.match(html, /min="2026-06-01"/);
    assert.match(html, /max="2026-06-30"/);
    assert.match(html, /<option value="15:00" selected="">15:00<\/option>/);
    assert.match(html, /<button[^>]*>지금<\/button>/);

    const vietnamese = render(
      "vi",
      <ScheduleStep
        disabled={false}
        draft={draft()}
        fieldErrors={{}}
        monthEndDate="2026-06-30"
        monthStartDate="2026-06-01"
        onNow={() => undefined}
        onScheduleChange={() => undefined}
        options={options}
      />
    );
    assert.match(vietnamese, />Ngay bây giờ</);
  });

  it("Therapist·코스 단계: 고른 것이 없으면 안내 문장을, 고르면 요약과 해제 버튼을 보여 준다", () => {
    const row: TherapistAvailabilityRowDto = {
      therapistId: "therapist-1",
      therapistName: "마사지사1",
      attendance: "before_check_in",
      shiftCheck: false,
      available: true,
      unavailableReason: null,
      inServiceDisplayEnd: null,
      freeFrom: null,
      nextReservationTime: null,
      freeMinutes: 60,
      priorServiceEndCheck: false,
      courses: [{ courseId: "course-a", courseCode: "A", courseName: "A 60분", durationMinutes: 60, verdict: "possible", requiresSecondTherapist: false }]
    };

    const unset = render(
      "ko",
      <TherapistStep
        availabilityFailed={false}
        availabilityPending={false}
        availabilityRows={[row]}
        availabilityTime="15:00"
        courseId=""
        courseLabel={null}
        disabled={false}
        fieldErrors={{}}
        locale="ko"
        onChoose={() => undefined}
        onChooseSecond={() => undefined}
        onClear={() => undefined}
        onClearSecond={() => undefined}
        onTimeChange={() => undefined}
        options={options}
        therapist1Id={null}
        therapist2Label={null}
        therapistLabel={null}
      />
    );
    assert.match(unset, /가능 코스에서 Therapist와 코스를 고르세요\./);
    assert.doesNotMatch(unset, /선택 해제/);
    // 가능 목록은 늘 펼친 채로 보인다(접기 버튼을 눌러도 바뀌지 않는다, onToggle no-op).
    assert.match(unset, /A 60분 가능/);
    // 1인 코스는 두 번째 Therapist 영역이 보이지 않는다.
    assert.doesNotMatch(unset, /두 번째 Therapist/);

    const chosen = render(
      "ko",
      <TherapistStep
        availabilityFailed={false}
        availabilityPending={false}
        availabilityRows={[row]}
        availabilityTime="15:00"
        courseId="course-a"
        courseLabel="A 60분"
        disabled={false}
        fieldErrors={{ courseId: ["코스를 선택하세요."] }}
        locale="ko"
        onChoose={() => undefined}
        onChooseSecond={() => undefined}
        onClear={() => undefined}
        onClearSecond={() => undefined}
        onTimeChange={() => undefined}
        options={options}
        therapist1Id="therapist-1"
        therapist2Label={null}
        therapistLabel="마사지사1"
      />
    );
    assert.match(chosen, /A 60분 · 마사지사1/);
    assert.match(chosen, />선택 해제</);
    assert.match(chosen, /role="alert">코스를 선택하세요\.</);
  });

  it("Therapist·코스 단계: 두 명 코스는 두 번째 Therapist를 따로 고르고, 시간 부족·수당 없음은 경고 확인 후 배정 버튼이다", () => {
    const rows: TherapistAvailabilityRowDto[] = [
      {
        therapistId: "therapist-1",
        therapistName: "마사지사1",
        attendance: "before_check_in",
        shiftCheck: false,
        available: true,
        unavailableReason: null,
        inServiceDisplayEnd: null,
        freeFrom: null,
        nextReservationTime: null,
        freeMinutes: 90,
        priorServiceEndCheck: false,
        courses: [{ courseId: "course-d", courseCode: "D", courseName: "D 2:1 90", durationMinutes: 90, verdict: "possible", requiresSecondTherapist: true }]
      },
      {
        therapistId: "therapist-2",
        therapistName: "마사지사2",
        attendance: "checked_in",
        shiftCheck: false,
        available: true,
        unavailableReason: null,
        inServiceDisplayEnd: null,
        freeFrom: null,
        nextReservationTime: null,
        freeMinutes: 90,
        priorServiceEndCheck: false,
        courses: [{ courseId: "course-d", courseCode: "D", courseName: "D 2:1 90", durationMinutes: 90, verdict: "time_short", requiresSecondTherapist: true }]
      },
      {
        therapistId: "therapist-3",
        therapistName: "마사지사3",
        attendance: "before_check_in",
        shiftCheck: false,
        available: false,
        unavailableReason: "booked",
        inServiceDisplayEnd: null,
        freeFrom: "16:00",
        nextReservationTime: null,
        freeMinutes: null,
        priorServiceEndCheck: false,
        courses: [{ courseId: "course-d", courseCode: "D", courseName: "D 2:1 90", durationMinutes: 90, verdict: "rate_missing", requiresSecondTherapist: true }]
      }
    ];

    const noSecondYet = render(
      "ko",
      <TherapistStep
        availabilityFailed={false}
        availabilityPending={false}
        availabilityRows={rows}
        availabilityTime="15:00"
        courseId="course-d"
        courseLabel="D 2:1 90"
        disabled={false}
        fieldErrors={{}}
        locale="ko"
        onChoose={() => undefined}
        onChooseSecond={() => undefined}
        onClear={() => undefined}
        onClearSecond={() => undefined}
        onTimeChange={() => undefined}
        options={options}
        therapist1Id="therapist-1"
        therapist2Label={null}
        therapistLabel="마사지사1"
      />
    );
    assert.match(noSecondYet, /두 번째 Therapist/);
    // 두 번째 후보 목록(<ul>...</ul>)만 떼어 본다. 이미 고른 첫 번째 Therapist(therapist-1)는 거기서 빠진다.
    const secondCandidateList = noSecondYet.slice(noSecondYet.indexOf("<ul"), noSecondYet.lastIndexOf("</ul>"));
    assert.doesNotMatch(secondCandidateList, /마사지사1/);
    // 시간 부족·수당 없음 후보는 "가능"과 다른 문구의 경고 확인 버튼이다.
    assert.match(secondCandidateList, /마사지사2[\s\S]*?D 90분 · 시간 부족 · 경고 확인 후 배정/);
    assert.match(secondCandidateList, /마사지사3[\s\S]*?D 90분 · 이 코스 불가 · 경고 확인 후 배정/);
    assert.doesNotMatch(secondCandidateList, /마사지사2[\s\S]*?D 90분 가능/);

    const secondChosen = render(
      "ko",
      <TherapistStep
        availabilityFailed={false}
        availabilityPending={false}
        availabilityRows={rows}
        availabilityTime="15:00"
        courseId="course-d"
        courseLabel="D 2:1 90"
        disabled={false}
        fieldErrors={{ therapist2Id: ["Therapist 1과 Therapist 2는 서로 다른 사람이어야 합니다."] }}
        locale="ko"
        onChoose={() => undefined}
        onChooseSecond={() => undefined}
        onClear={() => undefined}
        onClearSecond={() => undefined}
        onTimeChange={() => undefined}
        options={options}
        therapist1Id="therapist-1"
        therapist2Label="마사지사2"
        therapistLabel="마사지사1"
      />
    );
    assert.match(secondChosen, />마사지사2</);
    assert.match(secondChosen, /role="alert">Therapist 1과 Therapist 2는 서로 다른 사람이어야 합니다\.</);
  });

  it("객실·메모 단계: 객실은 선택이고 메모는 500자까지다", () => {
    const html = render(
      "ko",
      <RoomStep
        customers={customers}
        disabled={false}
        draft={draft({ note: "조용한 방 부탁" })}
        fieldErrors={{ roomId: ["객실이 올바르지 않습니다."] }}
        monthEndDate="2026-06-30"
        monthStartDate="2026-06-01"
        onEdit={() => undefined}
        options={options}
      />
    );
    assert.match(html, /<option value="" selected="">미배정<\/option>/);
    assert.match(html, /maxLength="500"/);
    assert.match(html, />조용한 방 부탁</);
    assert.match(html, /role="alert">객실이 올바르지 않습니다\.</);
  });

  it("확인 단계: 고른 값을 요약으로 보여 주고 저장·취소 버튼이 있다", () => {
    const html = render(
      "ko",
      <ReviewStep
        courseLabel="A 60분"
        customerLabel="지윤"
        disabled={false}
        draft={draft({ startTime: "15:00", note: "조용한 방" })}
        message={null}
        notice={null}
        onCancel={() => undefined}
        onRetry={() => undefined}
        onSave={() => undefined}
        roomLabel="101 호실"
        status="idle"
        therapist2Label="마사지사2"
        therapistLabel="마사지사1"
      />
    );
    assert.match(html, /지윤/);
    assert.match(html, /2026-06-10 15:00/);
    assert.match(html, /A 60분/);
    assert.match(html, /101 호실/);
    assert.match(html, /마사지사1/);
    // 두 번째 Therapist가 있으면 요약에 함께 보인다(티켓 21).
    assert.match(html, /마사지사2/);
    assert.match(html, /<button[^>]*>예약 저장<\/button>/);
    assert.match(html, /<button[^>]*>취소<\/button>/);

    const noCustomer = render(
      "ko",
      <ReviewStep
        courseLabel={null}
        customerLabel={null}
        disabled={false}
        draft={draft()}
        message={null}
        notice={null}
        onCancel={() => undefined}
        onRetry={() => undefined}
        onSave={() => undefined}
        roomLabel={null}
        status="idle"
        therapist2Label={null}
        therapistLabel={null}
      />
    );
    assert.match(noCustomer, /고객 없음/);
    assert.match(noCustomer, /선택 안 함/);
    assert.match(noCustomer, /미배정/);
    // 두 번째 Therapist가 없으면 그 행을 그리지 않는다.
    assert.doesNotMatch(noCustomer, /마사지사2/);
  });

  it("단계 이동줄: 다섯 단계가 번호로 보이고 지금 단계가 표시되며, 오류가 있는 단계에 표시가 붙는다", () => {
    const html = render(
      "ko",
      <StepperNav disabled={false} errorSteps={new Set(["room"])} onSelect={() => undefined} step="schedule" />
    );
    for (const label of ["고객", "날짜·예약시각", "Therapist·코스", "객실·메모", "확인"]) {
      assert.match(html, new RegExp(label));
    }
    assert.match(html, /aria-current="step"[^>]*>[\s\S]*?날짜·예약시각/);
    assert.match(html, /객실·메모[\s\S]*?!/);
  });

  it("패널 요약: 필드 오류와 전체 메시지를 함께 보여 준다", () => {
    const empty = render("ko", <ErrorSummary fieldErrors={{}} message={null} onJump={() => undefined} />);
    assert.equal(empty, "");

    const html = render(
      "ko",
      <ErrorSummary fieldErrors={{ courseId: ["코스를 선택하세요."] }} message="입력값이 올바르지 않습니다." onJump={() => undefined} />
    );
    assert.match(html, /role="alert"/);
    assert.match(html, /입력값이 올바르지 않습니다\./);
    assert.match(html, /코스를 선택하세요\./);
  });
});
