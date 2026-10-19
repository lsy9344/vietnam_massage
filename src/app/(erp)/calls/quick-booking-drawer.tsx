"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { createQuickBookingAction, loadQuotaAction, loadTherapistAvailabilityAction } from "@/app/(erp)/calls/actions";
import type {
  CallLedgerQuotaDto,
  CustomerDto,
  ServiceCallOption,
  ServiceCallRowDto,
  TherapistAvailabilityRowDto
} from "@/modules/calls/service-call-service";

const BOOKING_PATHS = [
  { id: "텔레그램", label: "텔레그램" },
  { id: "카카오톡", label: "카카오톡" },
  { id: "왓츠앱", label: "왓츠앱" },
  { id: "잘로", label: "잘로" },
  { id: "전화", label: "전화" },
  { id: "워크인", label: "워크인" },
  { id: "기타", label: "기타" }
];

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export function QuickBookingDrawer({
  courses,
  customers = [],
  initialTherapistId = null,
  onClose,
  onSuccess,
  open,
  operatingMonthId,
  serviceDate,
  timeSlots
}: {
  courses: ServiceCallOption[];
  customers?: CustomerDto[];
  initialTherapistId?: string | null;
  onClose: () => void;
  onSuccess?: (createdRow: ServiceCallRowDto) => void;
  open: boolean;
  operatingMonthId: string;
  serviceDate: string;
  timeSlots: ServiceCallOption[];
}) {
  const locale = useLocale();
  const router = useSafeRouter();
  const isKo = locale !== "vi";

  // Step state
  const [step, setStep] = useState<1 | 2>(1);

  // Form state - Step 1
  const [startTime, setStartTime] = useState<string>(timeSlots[0]?.value ?? "15:00");
  const [partySize, setPartySize] = useState<number>(1);
  const [bookingType, setBookingType] = useState<"assigned" | "unassigned">(initialTherapistId ? "assigned" : "assigned");
  const [courseId, setCourseId] = useState<string>(courses[0]?.value ?? "");
  const [therapist1Id, setTherapist1Id] = useState<string | null>(initialTherapistId);
  const [therapist2Id, setTherapist2Id] = useState<string | null>(null);

  // Form state - Step 2
  const [bookingPath, setBookingPath] = useState<string>("텔레그램");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerMemo, setCustomerMemo] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>("");
  const [allowQuotaOverride, setAllowQuotaOverride] = useState<boolean>(false);

  // Data state
  const [quota, setQuota] = useState<CallLedgerQuotaDto | null>(null);
  const [therapistRows, setTherapistRows] = useState<TherapistAvailabilityRowDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset or update when drawer opens or initialTherapistId changes
  useEffect(() => {
    if (open) {
      setStep(1);
      setFormError(null);
      setCustomerName("");
      setCustomerMemo("");
      setSelectedCustomerId(null);
      setCustomerSearchQuery("");
      setAllowQuotaOverride(false);
      setBookingPath("텔레그램");
      setPartySize(1);
      if (initialTherapistId) {
        setTherapist1Id(initialTherapistId);
        setBookingType("assigned");
      } else {
        setTherapist1Id(null);
      }
      setTherapist2Id(null);
    }
  }, [open, initialTherapistId]);

  // Load quota and therapist availability whenever time changes
  useEffect(() => {
    if (!open || !startTime) return;
    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      loadQuotaAction({ operatingMonthId, serviceDate, time: startTime }),
      loadTherapistAvailabilityAction({ operatingMonthId, serviceDate, time: startTime })
    ])
      .then(([quotaRes, availabilityRes]) => {
        if (!isMounted) return;
        setQuota(quotaRes);
        setTherapistRows(availabilityRes);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsLoading(false);
        console.error("Failed to load quota or availability", err);
      });

    return () => {
      isMounted = false;
    };
  }, [open, operatingMonthId, serviceDate, startTime]);

  // Handle "지금" button: pick closest slot to now
  function handleSelectNow() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const currentClock = `${hh}:${mm}`;

    // find slot that is <= currentClock, or first slot
    const matching = [...timeSlots].reverse().find((s) => s.value <= currentClock) ?? timeSlots[0];
    if (matching) {
      setStartTime(matching.value);
    }
  }

  // Selected course details
  const selectedCourse = useMemo(() => courses.find((c) => c.value === courseId), [courses, courseId]);
  const isSecondTherapistRequired = useMemo(() => {
    return selectedCourse?.label.includes("2인") || selectedCourse?.label.startsWith("D");
  }, [selectedCourse]);

  // Filtered customer candidates
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return [];
    const q = customerSearchQuery.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.memo && c.memo.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [customers, customerSearchQuery]);

  // Submit quick booking
  async function handleSubmit() {
    setFormError(null);
    if (!startTime) {
      setFormError(isKo ? "예약 시간을 선택하세요." : "Vui lòng chọn giờ đặt.");
      return;
    }
    if (!courseId) {
      setFormError(isKo ? "코스를 선택하세요." : "Vui lòng chọn gói dịch vụ.");
      return;
    }
    if (bookingType === "assigned" && !therapist1Id) {
      setFormError(isKo ? "지명 예약을 위해 관리사를 선택하세요. 관리사를 나중에 배정하려면 '미지명 예약'을 선택하세요." : "Vui lòng chọn Therapist.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createQuickBookingAction({
        operatingMonthId,
        serviceDate,
        startTime,
        courseId,
        therapist1Id: bookingType === "assigned" ? therapist1Id : null,
        therapist2Id: isSecondTherapistRequired ? therapist2Id : null,
        bookingPath,
        customerName: customerName.trim() || (bookingPath === "워크인" ? "워크인" : "손님"),
        customerMemo: customerMemo.trim() || null,
        customerId: selectedCustomerId,
        partySize,
        allowQuotaOverride
      });

      if (!result.ok) {
        setFormError(result.formError ?? (isKo ? "예약 저장에 실패했습니다." : "Lỗi lưu đặt chỗ."));
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onSuccess?.(result.data);
      router?.refresh();
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setFormError(err?.message ?? (isKo ? "예약 저장 중 오류가 발생했습니다." : "Lỗi khi lưu đặt chỗ."));
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Semi-transparent backdrop that preserves view of ledger */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-foreground/15 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <aside
        aria-label={isKo ? "빠른 예약" : "Đặt chỗ nhanh"}
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border bg-surface-float shadow-2xl transition-transform"
        role="dialog"
      >
        {/* Drawer Header */}
        <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-foreground">{isKo ? "빠른 예약" : "Đặt chỗ nhanh"}</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted">
              <span className={`font-semibold ${step === 1 ? "text-brand underline underline-offset-4" : "text-muted"}`}>
                {isKo ? "1. 예약 조건 선택" : "1. Điều kiện đặt"}
              </span>
              <span>→</span>
              <span className={`font-semibold ${step === 2 ? "text-brand underline underline-offset-4" : "text-muted"}`}>
                {isKo ? "2. 고객 정보 & 저장" : "2. Thông tin khách & Lưu"}
              </span>
            </div>
          </div>
          <button
            aria-label={isKo ? "닫기" : "Đóng"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground hover:bg-readonly"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </header>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {formError ? (
            <div className="mb-4 rounded-md border border-danger bg-danger-soft p-3 text-xs font-medium text-danger" role="alert">
              {formError}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-5">
              {/* 날짜 및 시간 */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted" htmlFor="quick-booking-time">
                    {isKo ? "예약 시간" : "Giờ đặt"}
                  </label>
                  <button
                    className="h-7 rounded-full border border-border bg-surface px-3 text-xs font-medium text-foreground hover:bg-readonly"
                    onClick={handleSelectNow}
                    type="button"
                  >
                    {isKo ? "지금 시간 선택" : "Chọn giờ hiện tại"}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto rounded-md border border-border-strong bg-surface p-2">
                  {timeSlots.map((slot) => (
                    <button
                      className={`h-9 rounded-sm text-xs font-medium tabular-nums transition-colors ${
                        startTime === slot.value
                          ? "bg-brand text-brand-foreground font-bold"
                          : "bg-surface-float text-foreground hover:bg-readonly"
                      }`}
                      key={slot.value}
                      onClick={() => setStartTime(slot.value)}
                      type="button"
                    >
                      {slot.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* 예약 인원 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted">{isKo ? "예약 인원" : "Số khách"}</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      className={`flex-1 h-10 rounded-full border text-xs font-semibold transition-colors ${
                        partySize === num
                          ? "bg-brand text-brand-foreground border-brand"
                          : "bg-surface text-foreground border-border hover:border-border-strong"
                      }`}
                      key={num}
                      onClick={() => setPartySize(num)}
                      type="button"
                    >
                      {num}{isKo ? "명" : " người"}
                    </button>
                  ))}
                </div>
              </div>

              {/* 지명 / 미지명 선택 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted">{isKo ? "지명 방식" : "Loại đặt chỗ"}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`h-11 rounded-full border text-xs font-bold transition-colors ${
                      bookingType === "assigned"
                        ? "bg-brand text-brand-foreground border-brand"
                        : "bg-surface text-foreground border-border hover:border-border-strong"
                    }`}
                    onClick={() => setBookingType("assigned")}
                    type="button"
                  >
                    {isKo ? "지명 예약 (특정 관리사)" : "Chỉ định Therapist"}
                  </button>
                  <button
                    className={`h-11 rounded-full border text-xs font-bold transition-colors ${
                      bookingType === "unassigned"
                        ? "bg-brand text-brand-foreground border-brand"
                        : "bg-surface text-foreground border-border hover:border-border-strong"
                    }`}
                    onClick={() => {
                      setBookingType("unassigned");
                      setTherapist1Id(null);
                    }}
                    type="button"
                  >
                    {isKo ? "미지명 예약 (도착 후 배정)" : "Chưa chỉ định (Xếp sau)"}
                  </button>
                </div>
              </div>

              {/* 정원 현황 뱃지 바 */}
              {quota ? (
                <div className="rounded-md border border-border bg-surface p-3 text-xs">
                  <div className="flex items-center justify-between font-semibold text-foreground mb-1">
                    <span>{isKo ? `${startTime} 정원 현황` : `Tình trạng lúc ${startTime}`}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      quota.availableSlots >= partySize
                        ? "bg-success-soft text-success"
                        : "bg-danger-soft text-danger"
                    }`}>
                      {quota.availableSlots >= partySize
                        ? (isKo ? `예약 가능 (${quota.availableSlots}명 여유)` : `Còn ${quota.availableSlots} chỗ`)
                        : (isKo ? `정원 초과 (${quota.availableSlots}명 남음)` : `Hết chỗ (còn ${quota.availableSlots})`)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted text-[11px] tabular-nums">
                    <span>{isKo ? `총 가능: ${quota.totalTherapists}명` : `Tổng: ${quota.totalTherapists}`}</span>
                    <span>·</span>
                    <span>{isKo ? `지명 확정: ${quota.assignedSlots}명` : `Đã chỉ định: ${quota.assignedSlots}`}</span>
                    <span>·</span>
                    <span>{isKo ? `미지명 확보: ${quota.unassignedSlots}명` : `Đã giữ chỗ: ${quota.unassignedSlots}`}</span>
                  </div>
                </div>
              ) : null}

              {/* 코스 선택 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted">{isKo ? "코스 선택" : "Chọn gói dịch vụ"}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {courses.map((course) => (
                    <button
                      className={`h-11 rounded-md border p-2 text-left text-xs font-semibold transition-colors ${
                        courseId === course.value
                          ? "bg-brand text-brand-foreground border-brand"
                          : "bg-surface text-foreground border-border hover:border-border-strong"
                      }`}
                      key={course.value}
                      onClick={() => setCourseId(course.value)}
                      type="button"
                    >
                      <div className="truncate">{course.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 관리사 선택 (지명 예약일 경우) */}
              {bookingType === "assigned" ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted">
                      {isKo ? "관리사 선택 (지명)" : "Chọn Therapist chỉ định"}
                    </label>
                    {therapist1Id ? (
                      <span className="text-xs font-bold text-success">
                        {isKo ? "선택 완료" : "Đã chọn"}
                      </span>
                    ) : (
                      <span className="text-xs text-danger font-medium">
                        {isKo ? "관리사를 선택하세요" : "Vui lòng chọn"}
                      </span>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="py-4 text-center text-xs text-muted">
                      {isKo ? "관리사 가능 현황을 불러오는 중..." : "Đang tải dữ liệu..."}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto rounded-md border border-border-strong bg-surface p-2">
                      {therapistRows.map((row) => {
                        const isSelected = therapist1Id === row.therapistId;
                        return (
                          <button
                            className={`flex flex-col justify-between rounded-md border p-2 text-left transition-colors ${
                              isSelected
                                ? "bg-brand text-brand-foreground border-brand font-bold"
                                : row.available
                                ? "bg-surface-float text-foreground border-border hover:border-border-strong"
                                : "bg-readonly text-muted border-border opacity-75"
                            }`}
                            key={row.therapistId}
                            onClick={() => setTherapist1Id(row.therapistId)}
                            type="button"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold truncate">{row.therapistName}</span>
                              {row.available ? (
                                <span className={`text-[10px] px-1 rounded ${isSelected ? "text-brand-foreground" : "text-success font-bold"}`}>
                                  {isKo ? "가능" : "Rảnh"}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted">
                                  {row.freeFrom ? (isKo ? `${row.freeFrom}부터` : `Từ ${row.freeFrom}`) : (isKo ? "불가" : "Bận")}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-[10px] text-muted truncate tabular-nums">
                              {row.nextReservationTime ? (isKo ? `다음 ${row.nextReservationTime}` : `Sau: ${row.nextReservationTime}`) : (isKo ? "종일 가능" : "Cả ngày")}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-border bg-surface p-4 text-xs text-muted">
                  <p className="font-semibold text-foreground mb-1">
                    {isKo ? "미지명 예약 안내" : "Đặt chỗ không chỉ định"}
                  </p>
                  <p>
                    {isKo
                      ? "관리사를 미리 고정하지 않고 해당 시간의 수용 인원(정원)만 차감 확보합니다. 손님이 업소에 방문했을 때 카운터 원장에서 대기 중인 관리사를 바로 배정할 수 있습니다."
                      : "Chỉ giữ chỗ theo công suất phòng/thời gian. Sẽ xếp Therapist khi khách đến."}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Step 2: 고객 정보 및 저장 */
            <div className="flex flex-col gap-5">
              {/* 요약 카드 */}
              <div className="rounded-md border border-border bg-surface p-3.5 text-xs">
                <span className="font-bold text-foreground block mb-2">{isKo ? "예약 조건 요약" : "Tóm tắt đặt chỗ"}</span>
                <div className="grid grid-cols-2 gap-2 text-muted">
                  <div>
                    <span className="text-faint block">{isKo ? "날짜·시간" : "Ngày·Giờ"}</span>
                    <span className="font-semibold text-foreground tabular-nums">{serviceDate} {startTime}</span>
                  </div>
                  <div>
                    <span className="text-faint block">{isKo ? "인원" : "Số khách"}</span>
                    <span className="font-semibold text-foreground tabular-nums">{partySize}{isKo ? "명" : " người"}</span>
                  </div>
                  <div>
                    <span className="text-faint block">{isKo ? "코스" : "Gói dịch vụ"}</span>
                    <span className="font-semibold text-foreground truncate">{selectedCourse?.label ?? "-"}</span>
                  </div>
                  <div>
                    <span className="text-faint block">{isKo ? "관리사" : "Therapist"}</span>
                    <span className="font-semibold text-foreground">
                      {bookingType === "assigned"
                        ? (therapistRows.find((r) => r.therapistId === therapist1Id)?.therapistName ?? (isKo ? "지명 선택됨" : "Đã chọn"))
                        : (isKo ? "미지명 (방문 시 배정)" : "Chưa chỉ định")}
                    </span>
                  </div>
                </div>
              </div>

              {/* 예약 경로 선택 (원클릭 버튼) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted">{isKo ? "예약 경로" : "Kênh đặt chỗ"}</label>
                <div className="flex flex-wrap gap-2">
                  {BOOKING_PATHS.map((path) => (
                    <button
                      className={`h-9 px-3.5 rounded-full border text-xs font-semibold transition-colors ${
                        bookingPath === path.id
                          ? "bg-brand text-brand-foreground border-brand"
                          : "bg-surface text-foreground border-border hover:border-border-strong"
                      }`}
                      key={path.id}
                      onClick={() => setBookingPath(path.id)}
                      type="button"
                    >
                      {path.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 예약자명 입력 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted" htmlFor="quick-booking-name">
                  {isKo ? "예약자명 / 메신저 닉네임" : "Tên khách / Nickname"}
                </label>
                <input
                  className="h-11 rounded-sm border border-border-strong bg-surface px-3 text-sm text-foreground outline-none focus:border-brand"
                  id="quick-booking-name"
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={isKo ? "예: 텔레 닉네임, 카톡 이름, 워크인 손님" : "Nhập tên hoặc nickname"}
                  type="text"
                  value={customerName}
                />
              </div>

              {/* 고객 메모 입력 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted" htmlFor="quick-booking-memo">
                  {isKo ? "고객 메모 / 특이사항" : "Ghi chú khách"}
                </label>
                <input
                  className="h-11 rounded-sm border border-border-strong bg-surface px-3 text-sm text-foreground outline-none focus:border-brand"
                  id="quick-booking-memo"
                  onChange={(e) => setCustomerMemo(e.target.value)}
                  placeholder={isKo ? "예: 마사지 강하게, 샤워 먼저 요청 등" : "Yêu cầu đặc biệt"}
                  type="text"
                  value={customerMemo}
                />
              </div>

              {/* 기존 고객 검색 연동 */}
              <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
                <label className="text-xs font-semibold text-muted" htmlFor="quick-booking-customer-search">
                  {isKo ? "기존 고객 검색 연결 (선택)" : "Tìm khách cũ (tùy chọn)"}
                </label>
                <input
                  className="h-9 rounded-sm border border-border-strong bg-surface-float px-3 text-xs text-foreground outline-none focus:border-brand"
                  id="quick-booking-customer-search"
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder={isKo ? "이름 또는 전화번호 뒷자리 검색" : "Tìm tên hoặc số điện thoại"}
                  type="text"
                  value={customerSearchQuery}
                />
                {filteredCustomers.length > 0 ? (
                  <div className="flex flex-col gap-1 mt-1 border-t border-border pt-1">
                    {filteredCustomers.map((cust) => (
                      <button
                        className={`text-left p-1.5 text-xs rounded transition-colors ${
                          selectedCustomerId === cust.id ? "bg-readonly font-bold" : "hover:bg-readonly"
                        }`}
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomerId(cust.id);
                          setCustomerName(cust.name);
                          if (cust.memo) setCustomerMemo(cust.memo);
                        }}
                        type="button"
                      >
                        <span className="font-semibold text-foreground">{cust.name}</span>
                        {cust.phone ? <span className="ml-2 text-muted tabular-nums">{cust.phone}</span> : null}
                        {cust.memo ? <span className="ml-2 text-muted truncate">({cust.memo})</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* 정원 초과 시 오버라이드 체크박스 */}
              {quota && quota.availableSlots < partySize ? (
                <label className="flex items-center gap-2 rounded-md border border-warning bg-warning-soft p-3 text-xs text-warning-foreground font-medium cursor-pointer">
                  <input
                    checked={allowQuotaOverride}
                    className="h-4 w-4 rounded border-border-strong"
                    onChange={(e) => setAllowQuotaOverride(e.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    {isKo
                      ? "현재 정원을 초과했습니다. 관리자 권한으로 예외 예약을 확정합니다."
                      : "Đã vượt công suất. Cho phép quản trị viên đặt chỗ ngoại lệ."}
                  </span>
                </label>
              ) : null}
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <footer className="border-t border-border bg-surface p-4 flex items-center justify-between gap-3">
          {step === 1 ? (
            <>
              <button
                className="h-11 px-5 rounded-full border border-border text-sm font-semibold text-foreground hover:bg-readonly"
                onClick={onClose}
                type="button"
              >
                {isKo ? "취소" : "Hủy"}
              </button>
              <Button
                disabled={bookingType === "assigned" && !therapist1Id}
                onClick={() => setStep(2)}
                type="button"
              >
                {isKo ? "고객 정보 입력 →" : "Nhập thông tin khách →"}
              </Button>
            </>
          ) : (
            <>
              <button
                className="h-11 px-5 rounded-full border border-border text-sm font-semibold text-foreground hover:bg-readonly"
                disabled={isSubmitting}
                onClick={() => setStep(1)}
                type="button"
              >
                {isKo ? "← 이전 조건" : "← Quay lại"}
              </button>
              <Button
                disabled={isSubmitting}
                onClick={handleSubmit}
                type="button"
              >
                {isSubmitting ? (isKo ? "예약 저장 중..." : "Đang lưu...") : (isKo ? "예약 저장 완료" : "Hoàn tất đặt chỗ")}
              </Button>
            </>
          )}
        </footer>
      </aside>
    </>
  );
}

export function QuickBookingTrigger({
  courses,
  customers = [],
  isLocked,
  operatingMonthId,
  serviceDate,
  timeSlots
}: {
  courses: ServiceCallOption[];
  customers?: CustomerDto[];
  isLocked: boolean;
  operatingMonthId: string;
  serviceDate: string;
  timeSlots: ServiceCallOption[];
}) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const isKo = locale !== "vi";

  return (
    <>
      <Button disabled={isLocked} onClick={() => setOpen(true)} type="button">
        {isKo ? "+ 빠른 예약" : "+ Đặt nhanh"}
      </Button>
      {open ? (
        <QuickBookingDrawer
          courses={courses}
          customers={customers}
          onClose={() => setOpen(false)}
          open={open}
          operatingMonthId={operatingMonthId}
          serviceDate={serviceDate}
          timeSlots={timeSlots}
        />
      ) : null}
    </>
  );
}

