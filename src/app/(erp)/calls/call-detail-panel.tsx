"use client";

import { useLocale } from "@/lib/i18n/client";
import { BookingChannelIcon, parseCustomerCallInfo } from "@/app/(erp)/calls/booking-channel-icons";
import type { CustomerDto, ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";

export function CallDetailPanel({
  customers = [],
  isLocked,
  onClose,
  onEnterService,
  onEarlyFinish,
  onFinishCleaning,
  onTogglePayment,
  onUndoFinish,
  options,
  row
}: {
  customers?: CustomerDto[];
  isLocked: boolean;
  onClose: () => void;
  onEnterService?: () => void;
  onEarlyFinish?: () => void;
  onFinishCleaning?: () => void;
  onTogglePayment?: () => void;
  onUndoFinish?: () => void;
  options: ServiceCallFormOptions;
  row: ServiceCallRowDto | null;
}) {
  const locale = useLocale();
  const isKo = locale !== "vi";

  if (!row) {
    return (
      <aside
        aria-label={isKo ? "예약 상세" : "Chi tiết đặt chỗ"}
        className="flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold text-foreground">
            {isKo ? "예약 상세" : "Chi tiết đặt chỗ"}
          </h2>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted hover:bg-readonly hover:text-foreground transition-colors cursor-pointer"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>
        <p className="py-8 text-center text-xs text-muted">
          {isKo ? "선택된 예약 정보가 없습니다." : "Chưa chọn đặt chỗ nào."}
        </p>
      </aside>
    );
  }

  const { channel, name, contact, memo } = parseCustomerCallInfo(row, customers);

  // Status badge colors
  let statusBadgeClass = "bg-slate-100 text-slate-700";
  if (row.status === "예약") statusBadgeClass = "bg-blue-100 text-blue-800";
  else if (row.status === "사용중") statusBadgeClass = "bg-emerald-100 text-emerald-800";
  else if (row.status === "청소중") statusBadgeClass = "bg-amber-100 text-amber-800";
  else if (row.status === "방문완료") statusBadgeClass = "bg-teal-100 text-teal-800";
  else if (row.status === "노쇼") statusBadgeClass = "bg-rose-100 text-rose-800";
  else if (row.status === "취소") statusBadgeClass = "bg-slate-100 text-slate-700";

  return (
    <aside
      aria-label={`${isKo ? "예약 상세" : "Chi tiết đặt chỗ"}: ${row.startTime} ${name}`}
      className="flex flex-col rounded-xl border border-border bg-surface shadow-md overflow-hidden transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface-float/80 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-black text-foreground tabular-nums tracking-tight">
            {row.startTime}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${statusBadgeClass}`}>
            {row.status}
          </span>
        </div>
        <button
          aria-label={isKo ? "닫기" : "Đóng"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-muted hover:bg-readonly hover:text-foreground transition-colors cursor-pointer"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      </div>

      {/* Body content */}
      <div className="flex flex-col gap-4 p-4 text-xs overflow-y-auto max-h-[calc(100vh-14rem)]">
        {/* Customer card */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-float/60 p-3">
          <BookingChannelIcon channel={channel} className="w-10 h-10 rounded-full shadow-xs" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-sm font-black text-foreground truncate">{name}</span>
              <span className="text-[11px] font-semibold text-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                {channel}
              </span>
            </div>
            <div className="text-xs text-muted tabular-nums mt-0.5">{contact}</div>
            {memo ? (
              <div className="mt-1 text-[11px] text-foreground/80 bg-surface/80 p-1.5 rounded border border-border/60">
                {memo}
              </div>
            ) : null}
          </div>
        </div>

        {/* Quick action strip */}
        {!isLocked ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {row.status === "예약" && onEnterService ? (
              <button
                className="flex-1 h-9 rounded-lg bg-blue-600 font-bold text-white hover:bg-blue-700 active:scale-95 transition-all cursor-pointer shadow-xs"
                onClick={onEnterService}
                type="button"
              >
                {isKo ? "입장 처리" : "Xác nhận vào"}
              </button>
            ) : null}

            {row.status === "사용중" && onEarlyFinish ? (
              <button
                className="flex-1 h-9 rounded-lg bg-rose-600 font-bold text-white hover:bg-rose-700 active:scale-95 transition-all cursor-pointer shadow-xs"
                onClick={onEarlyFinish}
                type="button"
              >
                {isKo ? "종료 처리" : "Kết thúc"}
              </button>
            ) : null}

            {row.status === "청소중" ? (
              <>
                {onFinishCleaning ? (
                  <button
                    className="flex-1 h-9 rounded-lg bg-blue-100 font-bold text-blue-800 hover:bg-blue-200 active:scale-95 transition-all cursor-pointer border border-blue-300"
                    onClick={onFinishCleaning}
                    type="button"
                  >
                    🧹 {isKo ? "청소 끝 (방문완료)" : "Xong dọn dẹp"}
                  </button>
                ) : null}
                {onUndoFinish ? (
                  <button
                    className="h-9 px-3 rounded-lg border border-border bg-surface text-muted hover:text-foreground hover:bg-readonly active:scale-95 transition-all cursor-pointer"
                    onClick={onUndoFinish}
                    type="button"
                  >
                    ↺ {isKo ? "종료 취소" : "Hủy"}
                  </button>
                ) : null}
              </>
            ) : null}

            {onTogglePayment ? (
              <button
                className={`h-9 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  row.confirmationCode === "Y"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                }`}
                onClick={onTogglePayment}
                type="button"
              >
                {row.confirmationCode === "Y"
                  ? (isKo ? "✓ 결제완료" : "✓ Đã TT")
                  : (isKo ? "미확인 (결제)" : "Chưa TT")}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Detailed specs */}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-lg border border-border bg-surface-float/40 p-3">
          <div>
            <dt className="text-[11px] text-muted">{isKo ? "코스" : "Gói dịch vụ"}</dt>
            <dd className="font-bold text-foreground truncate mt-0.5">{row.courseLabel || "-"}</dd>
          </div>

          <div>
            <dt className="text-[11px] text-muted">{isKo ? "배정 객실" : "Phòng"}</dt>
            <dd className="font-bold text-foreground truncate mt-0.5">{row.roomLabel || (isKo ? "미배정" : "Chưa xếp")}</dd>
          </div>

          <div>
            <dt className="text-[11px] text-muted">{isKo ? "관리사 1" : "Therapist 1"}</dt>
            <dd className="font-bold text-foreground truncate mt-0.5">{row.therapist1?.displayName || (isKo ? "미배정" : "Chưa xếp")}</dd>
          </div>

          <div>
            <dt className="text-[11px] text-muted">{isKo ? "관리사 2" : "Therapist 2"}</dt>
            <dd className="font-bold text-foreground truncate mt-0.5">{row.therapist2?.displayName || "-"}</dd>
          </div>

          <div>
            <dt className="text-[11px] text-muted">{isKo ? "실제 입장" : "Giờ vào thực tế"}</dt>
            <dd className="font-bold text-foreground tabular-nums mt-0.5">
              {row.actualEntryTime || (isKo ? "미입장" : "Chưa vào")}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] text-muted">{isKo ? "예상/실제 종료" : "Giờ kết thúc"}</dt>
            <dd className="font-bold text-foreground tabular-nums mt-0.5">{row.displayEnd || "-"}</dd>
          </div>

          <div>
            <dt className="text-[11px] text-muted">{isKo ? "할인 유형" : "Giảm giá"}</dt>
            <dd className="font-bold text-foreground truncate mt-0.5">
              {options.discountTypes.find((d) => d.value === row.discountTypeCode)?.label || (isKo ? "없음" : "Không")}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] text-muted">{isKo ? "결제 수단" : "Phương thức TT"}</dt>
            <dd className="font-bold text-foreground truncate mt-0.5">
              {options.paymentMethods.find((p) => p.value === row.paymentMethodCode)?.label || "-"}
            </dd>
          </div>
        </dl>

        {row.note ? (
          <div className="rounded-lg border border-border bg-surface-float/40 p-2.5">
            <span className="text-[11px] font-semibold text-muted block mb-1">{isKo ? "비고" : "Ghi chú"}</span>
            <p className="text-xs text-foreground whitespace-pre-wrap">{row.note}</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
