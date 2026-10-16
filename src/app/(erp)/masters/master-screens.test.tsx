import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInShell } from "@/components/shell/test-harness";
import { RoomManager } from "@/app/(erp)/masters/rooms/room-forms";
import { CodeManager } from "@/app/(erp)/masters/codes/code-forms";
import { OperatingMonthManager } from "@/app/(erp)/masters/operating-months/operating-month-forms";
import { EmployeeManager, FutureCallsRejection } from "@/app/(erp)/masters/employees/employee-forms";
import { CoursePolicyManager } from "@/app/(erp)/masters/courses/course-forms";
import { courseItemKey } from "@/app/(erp)/masters/courses/course-item";
import { OpenIssueWorkspace, type OpenIssueView } from "@/app/(erp)/masters/sheet-mapping/open-issue-workspace";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { RoomDto } from "@/modules/masters/room-service";
import type { CodeItemDto, TimeSlotDto } from "@/modules/masters/code-service";
import type { OperatingMonthDto } from "@/modules/masters/operating-month-service";
import type { EmployeeDto } from "@/modules/masters/employee-service";
import type { CourseDto, TherapistCourseRateDto } from "@/modules/masters/course-service";
import type { ReactElement } from "react";

const stamp = "2026-10-01T03:00:00.000Z";

function render(element: ReactElement, locale: Locale = "ko") {
  return renderToStaticMarkup(renderInShell(element, locale));
}

/** 표 행 하나의 마크업(그 행의 첫 칸 글자로 찾는다). */
function rowOf(html: string, label: string) {
  const start = html.lastIndexOf("<tr", html.indexOf(`>${label}<`));
  return html.slice(start, html.indexOf("</tr>", start));
}

function room(overrides: Partial<RoomDto> = {}): RoomDto {
  return {
    id: "room-101",
    displayName: "101 호실",
    migrationReferenceName: "1번방",
    sortOrder: 10,
    isActive: true,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides
  };
}

describe("기준정보 화면 공통", () => {
  it("항목을 고르기 전에는 패널 대신 안내만 보인다", () => {
    const html = render(<RoomManager initialItem={null} rooms={[room()]} />);
    assert.ok(html.includes(t("ko", "masters.common.panelHint")));
    assert.ok(!html.includes(`aria-label="${t("ko", "masters.common.impact.title")}"`));
  });

  it("패널은 편집 칸보다 변경 영향을 먼저 보인다", () => {
    const html = render(<RoomManager initialItem="room-101" rooms={[room()]} />);
    const impact = html.indexOf(t("ko", "masters.rooms.impact.displayName"));
    const firstInput = html.indexOf('name="displayName"');
    assert.ok(impact > 0, "변경 영향이 있다");
    assert.ok(firstInput > impact, "표시명 칸이 변경 영향 뒤에 온다");
  });

  it("비활성 항목은 행 안에서 지우지 않고 남겨 둔 것이라고 설명하고, 패널에 비활성 처리 버튼 대신 이미 비활성을 보인다", () => {
    const html = render(<RoomManager initialItem="room-402" rooms={[room(), room({ id: "room-402", displayName: "402 호실", isActive: false })]} />);
    assert.ok(rowOf(html, "402 호실").includes(t("ko", "masters.rooms.inactiveNote")));
    assert.ok(!rowOf(html, "101 호실").includes(t("ko", "masters.rooms.inactiveNote")));
    assert.ok(html.includes(t("ko", "masters.common.alreadyInactive")));
    assert.ok(!html.includes(`>${t("ko", "masters.common.deactivate")}<`));
  });

  it("고른 행은 눌린 버튼으로 표시된다", () => {
    const html = render(<RoomManager initialItem="room-101" rooms={[room()]} />);
    assert.ok(rowOf(html, "101 호실").includes('aria-pressed="true"'));
  });
});

describe("코드·시간 슬롯", () => {
  const cash: CodeItemDto = {
    id: "code-cash",
    codeType: "PAYMENT_METHOD",
    code: "CASH",
    displayName: "현금 결제",
    sortOrder: 10,
    isSystemDefault: true,
    isActive: true,
    createdAt: stamp,
    updatedAt: stamp
  };
  const slot: TimeSlotDto = { id: "slot-1100", value: "11:00", sortOrder: 1, isActive: true, createdAt: stamp, updatedAt: stamp };

  it("시스템 기본 코드는 저장된 표시명과 화면에 보이는 이름을 나눠 보이고, 그 차이를 변경 영향에 적는다", () => {
    const html = render(<CodeManager codeGroups={[{ codeType: "PAYMENT_METHOD", items: [cash] }]} initialItem="code-cash" timeSlots={[slot]} />);
    const row = rowOf(html, "현금 결제");
    assert.ok(row.includes(">CASH<"));
    assert.ok(row.includes(">현금<"), "화면 표시는 언어별 기본 이름이다");
    assert.ok(html.includes(t("ko", "masters.codes.impact.systemDefaultLabel")));
  });

  it("시간 슬롯을 고르면 저장된 콜의 예약시각이 바뀌지 않는다는 영향을 보인다", () => {
    const html = render(<CodeManager codeGroups={[]} initialItem="slot-1100" timeSlots={[slot]} />);
    assert.ok(html.includes(t("ko", "masters.codes.impact.storedTime")));
    assert.ok(html.includes('value="11:00"'));
  });
});

describe("운영월", () => {
  function month(overrides: Partial<OperatingMonthDto> = {}): OperatingMonthDto {
    return {
      id: "month-10",
      monthKey: "2026-10",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      status: "작성중",
      createdAt: stamp,
      updatedAt: stamp,
      ...overrides
    };
  }

  it("작성중 운영월만 검토 시작 버튼을 갖고, 그 밖은 월마감 화면으로 안내한다", () => {
    const draft = render(<OperatingMonthManager highlightedMonthKey={null} initialItem="month-10" months={[month()]} />);
    assert.ok(draft.includes(t("ko", "masters.operatingMonths.changeToReview")));
    assert.ok(draft.includes('aria-current="step"'));

    const locked = render(<OperatingMonthManager highlightedMonthKey={null} initialItem="month-10" months={[month({ status: "잠금" })]} />);
    assert.ok(!locked.includes(t("ko", "masters.operatingMonths.changeToReview")));
    assert.ok(locked.includes('href="/closing?operatingMonthId=month-10"'));
  });

  it("선택 기준 표시는 한 행에만 붙는다", () => {
    const html = render(
      <OperatingMonthManager highlightedMonthKey="2026-10" initialItem={null} months={[month(), month({ id: "month-09", monthKey: "2026-09" })]} />
    );
    assert.equal(html.split(t("ko", "masters.operatingMonths.selectedBasis")).length - 1, 1);
  });
});

describe("직원", () => {
  const employee: EmployeeDto = {
    id: "emp-1",
    displayName: "Mai",
    staffCode: "THR-001",
    employeeGroup: "THERAPIST",
    position: "마사지사",
    shiftType: "주간",
    baseSalary: 0,
    phone: null,
    birthday: null,
    hireDate: null,
    employmentStatus: "재직",
    sortOrder: 1,
    isActive: true,
    createdAt: stamp,
    updatedAt: stamp,
    account: null
  };

  it("주/야간과 재직상태는 값은 그대로 두고 보이는 이름만 번역한다", () => {
    const html = render(<EmployeeManager employees={[employee]} initialItem="emp-1" />, "vi");
    assert.ok(rowOf(html, "Mai").includes(t("vi", "masters.employees.shift.day")));
    assert.ok(rowOf(html, "Mai").includes(t("vi", "masters.employees.employment.employed")));
    assert.ok(html.includes('<option value="주간" selected="">'));
  });

  it("직원을 비활성으로 바꿔도 연결 계정은 막히지 않는다는 영향을 보인다", () => {
    const html = render(<EmployeeManager employees={[employee]} initialItem="emp-1" />);
    assert.ok(html.includes(t("ko", "masters.employees.impact.account")));
    assert.ok(rowOf(html, "Mai").includes(t("ko", "masters.employees.accountNotLinked")));
  });

  it("비활성 거절은 사유와 건수, 막은 콜의 날짜·예약시각을 두 언어로 보인다", () => {
    const calls = [
      { serviceCallId: "call-1", serviceDate: "2026-10-15", startTime: "14:00" },
      { serviceCallId: "call-2", serviceDate: "2026-10-16", startTime: "01:00" }
    ];
    for (const locale of ["ko", "vi"] as const) {
      const html = render(<FutureCallsRejection calls={calls} />, locale);
      assert.ok(html.includes(t(locale, "masters.employees.futureCalls.reason", { count: "2" })), locale);
      assert.ok(html.includes(t(locale, "masters.employees.futureCalls.hint")), locale);
      assert.ok(html.includes('role="alert"'));
      const first = html.indexOf(">2026-10-15<");
      assert.ok(first > 0 && html.indexOf(">14:00<") > first);
      const second = html.indexOf(">2026-10-16<");
      assert.ok(second > first && html.indexOf(">01:00<") > second);
    }
    assert.notEqual(t("ko", "masters.employees.futureCalls.reason", { count: "2" }), t("vi", "masters.employees.futureCalls.reason", { count: "2" }));
  });
});

describe("코스·수당", () => {
  const course: CourseDto = {
    id: "course-a",
    code: "A",
    isActive: true,
    createdAt: stamp,
    updatedAt: stamp,
    currentPolicy: {
      id: "policy-a",
      courseId: "course-a",
      name: "누루 60",
      durationMinutes: 60,
      basePrice: 500000,
      requiresSecondTherapist: false,
      tvDisplayName: "A 누루60",
      effectiveFromMonth: "2026-06",
      effectiveToMonth: null,
      isActive: true,
      createdAt: stamp,
      updatedAt: stamp
    }
  };
  const therapist = (id: string, displayName: string): EmployeeDto => ({
    id,
    displayName,
    staffCode: `THR-${id}`,
    employeeGroup: "THERAPIST",
    position: "마사지사",
    shiftType: null,
    baseSalary: 0,
    phone: null,
    birthday: null,
    hireDate: null,
    employmentStatus: "재직",
    sortOrder: 1,
    isActive: true,
    createdAt: stamp,
    updatedAt: stamp,
    account: null
  });
  const zeroRate: TherapistCourseRateDto = {
    id: "rate-1",
    therapistId: "t1",
    courseId: "course-a",
    amount: 0,
    effectiveFromMonth: "2026-06",
    effectiveToMonth: null,
    isActive: true,
    createdAt: stamp,
    updatedAt: stamp
  };

  function renderCourses(initialItem: string | null, courses: CourseDto[] = [course], coursesWithCurrentPolicy = courses.map((item) => item.id)) {
    return render(
      <CoursePolicyManager
        courses={courses}
        coursesWithCurrentPolicy={coursesWithCurrentPolicy}
        currentMonthKey="2026-10"
        dailyRules={[]}
        initialItem={initialItem}
        monthKey="2026-06"
        monthlyRules={[]}
        therapistRates={[zeroRate]}
        therapists={[therapist("t1", "Mai"), therapist("t2", "Linh")]}
      />
    );
  }

  it("수당 표는 0원 수당과 미등록을 다르게 보인다", () => {
    const html = renderCourses(null);
    assert.ok(html.includes('aria-label="Mai A 수당: 0"'));
    assert.ok(html.includes(`aria-label="Linh A 수당: ${t("ko", "masters.courses.rateMissing")}"`));
  });

  it("코스를 고르면 현재 정책과 새 정책 이력 폼이 변경 영향 뒤에 온다", () => {
    const html = renderCourses(courseItemKey({ kind: "course", courseId: "course-a" }));
    const impact = html.indexOf(t("ko", "masters.courses.impact.newHistory"));
    assert.ok(impact > 0);
    assert.ok(html.indexOf(`>${t("ko", "masters.courses.saveCurrentPolicy")}<`) > impact);
    assert.ok(html.indexOf(`>${t("ko", "masters.courses.saveNewPolicyHistory")}<`) > impact);
  });

  // 코스 다시 사용과 새 코스 추가(콜 원장 흐름 재구성 스펙 D9).
  it("코스 목록 위에 새 코스 추가 버튼이 있다", () => {
    const html = renderCourses(null);
    assert.match(html, new RegExp(`<button[^>]*>${t("ko", "masters.courses.add")}</button>`));
    assert.match(render(<CoursePolicyManager courses={[course]} coursesWithCurrentPolicy={[course.id]} currentMonthKey="2026-10" dailyRules={[]} initialItem={null} monthKey="2026-06" monthlyRules={[]} therapistRates={[]} therapists={[]} />, "vi"), new RegExp(`>${t("vi", "masters.courses.add")}<`));
  });

  it("비활성 코스 패널은 비활성 처리 대신 다시 사용을 보이고, 그달 정책이 있으면 정책 칸 없이 켠다", () => {
    const inactive: CourseDto = { ...course, id: "course-b", code: "B", isActive: false, currentPolicy: { ...course.currentPolicy!, id: "policy-b", courseId: "course-b" } };
    const html = renderCourses(courseItemKey({ kind: "course", courseId: "course-b" }), [course, inactive]);
    assert.ok(html.includes(`>${t("ko", "masters.courses.reactivate")}<`));
    assert.ok(html.includes(t("ko", "masters.courses.reactivateNote")));
    assert.ok(!html.includes(`>${t("ko", "masters.common.deactivate")}<`));
    const reactivateForm = html.slice(html.lastIndexOf("<form", html.indexOf(t("ko", "masters.courses.reactivateNote"))), html.indexOf("</form>", html.indexOf(t("ko", "masters.courses.reactivateNote"))));
    assert.match(reactivateForm, /name="courseId"[^>]*value="course-b"/);
    assert.doesNotMatch(reactivateForm, /name="durationMinutes"/);
  });

  // 그달은 오늘이 속한 달(여기서는 2026-10)이다. 기준 적용월(2026-06) 정책이 있어도 그달 정책이 없으면 함께 받는다.
  it("그달 정책이 없는 비활성 코스는 다시 사용할 때 정책을 함께 받는다", () => {
    const inactive: CourseDto = { ...course, id: "course-e", code: "E", isActive: false };
    const html = renderCourses(courseItemKey({ kind: "course", courseId: "course-e" }), [course, inactive], [course.id]);
    const note = t("ko", "masters.courses.reactivatePolicyNote", { monthKey: "2026-10" });
    assert.ok(html.includes(note));
    const reactivateForm = html.slice(html.lastIndexOf("<form", html.indexOf(note)), html.indexOf("</form>", html.indexOf(note)));
    for (const field of ["name", "tvDisplayName", "durationMinutes", "basePrice", "effectiveFromMonth", "effectiveToMonth", "requiresSecondTherapist"]) {
      assert.match(reactivateForm, new RegExp(`name="${field}"`));
    }
    assert.match(reactivateForm, /name="effectiveFromMonth"[^>]*value="2026-10"|value="2026-10"[^>]*name="effectiveFromMonth"/);
  });

  it("활성 코스 패널에는 다시 사용이 없다", () => {
    const html = renderCourses(courseItemKey({ kind: "course", courseId: "course-a" }));
    assert.ok(html.includes(`>${t("ko", "masters.common.deactivate")}<`));
    assert.ok(!html.includes(`>${t("ko", "masters.courses.reactivate")}<`));
  });

  it("미등록 칸을 고르면 기준 적용월부터 만드는 폼을 보인다", () => {
    const html = renderCourses(courseItemKey({ kind: "rate", therapistId: "t2", courseId: "course-a" }));
    assert.ok(html.includes(t("ko", "masters.courses.rateCreateNote", { monthKey: "2026-06" })));
    assert.ok(html.includes(`>${t("ko", "masters.courses.create")}<`));
  });
});

describe("시트 매핑 이슈 상세", () => {
  const issue: OpenIssueView = {
    itemKey: "calculation:calls.payment:case-1",
    summary: "결제 합계 불일치",
    related: "FR-36 / Story 7.3",
    status: { label: "재검증 필요", tone: "warning" },
    expected: "1000",
    actual: "900",
    lastNote: "수정 배포 후 재검증 예정",
    changedAt: "26. 10. 14. 오후 3:00",
    form: <form data-testid="issue-form" />
  };

  it("고르기 전에는 목록만, 고르면 기대값·결과값과 상태 변경 폼이 패널에 열린다", () => {
    const idle = render(<OpenIssueWorkspace initialItem={null} issues={[issue]} />);
    assert.ok(rowOf(idle, "결제 합계 불일치").includes("수정 배포 후 재검증 예정"));
    assert.ok(!idle.includes("<aside"));

    const open = render(<OpenIssueWorkspace initialItem={issue.itemKey} issues={[issue]} />);
    const panel = open.slice(open.indexOf("<aside"));
    assert.ok(panel.includes(">1000<") && panel.includes(">900<"));
    assert.ok(panel.includes('data-testid="issue-form"'));
  });

  it("상태를 바꿀 수 없는 역할에게는 폼 없이 읽기만 보인다", () => {
    const html = render(<OpenIssueWorkspace initialItem={issue.itemKey} issues={[{ ...issue, form: null }]} />);
    assert.ok(!html.includes("<form"));
    assert.ok(html.slice(html.indexOf("<aside")).includes("수정 배포 후 재검증 예정"));
  });
});

describe("두 언어", () => {
  it("베트남어에서도 번역 key가 그대로 새지 않는다", () => {
    const html = [
      render(<RoomManager initialItem="room-101" rooms={[room({ isActive: false })]} />, "vi"),
      render(<OperatingMonthManager highlightedMonthKey="2026-10" initialItem="m" months={[{ id: "m", monthKey: "2026-10", startDate: "2026-10-01", endDate: "2026-10-31", status: "검토중", createdAt: stamp, updatedAt: stamp }]} />, "vi")
    ].join("");
    assert.ok(!/masters\.[a-zA-Z]/.test(html));
    assert.ok(html.includes(t("vi", "masters.common.impact.title")));
  });
});
