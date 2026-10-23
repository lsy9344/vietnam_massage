"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission, requireRouteAccess } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage, resolveKoreanMessage } from "@/lib/i18n/errors";
import {
  autosaveServiceCallRow,
  correctServiceCallCustomerLink,
  createCustomer,
  createDailyExpense,
  customerSharedPhone,
  customerVisitCountsFromRows,
  deactivateDailyExpense,
  createQuickBookingParty,
  createQuickBookingServiceCall,
  createServiceCallRow,
  getServiceCallRow,
  listCustomerVisitHistory,
  mostRecentCustomerVisit,
  searchCustomerVisitCandidates,
  timeSlotSortOrderMap,
  updateCustomer,
  updateDailyExpense,
  redactServiceCallSettlementAmounts,
  autoFinishOverdueCalls,
  listTherapistAvailabilityWithSeats,
  QuickBookingGuestError,
  ServiceCallDomainError,
  StaleServiceCallError,
  type CustomerDto,
  type CustomerVisitCandidateDto,
  type CustomerVisitCountsDto,
  type CustomerVisitHistoryRowDto,
  type DailyExpenseDto,
  type ServiceCallRowDto
} from "@/modules/calls/service-call-service";
import {
  customerInputSchema,
  customerUpdateSchema,
  dailyExpenseDeactivateSchema,
  dailyExpenseInputSchema,
  dailyExpenseUpdateSchema,
  quickBookingPartyInputSchema,
  serviceCallAutosaveInputSchema,
  serviceCallCreateInputSchema,
  serviceCallCustomerLinkCorrectionSchema,
  type QuickBookingPartyInput,
  type ServiceCallAutosaveInput,
  type ServiceCallCreateInput
} from "@/modules/calls/service-call-schema";
import { quickBookingGuestFieldKey, quickBookingPartyIssueField } from "@/app/(erp)/calls/quick-booking-draft";

/** 오래된 저장(STALE_CALL)이면 저장은 거절되고, 화면이 다시 불러올 수 있게 지금의 행을 함께 받는다. */
export type ServiceCallAutosaveResult =
  | ActionResult<ServiceCallRowDto>
  | { ok: false; formError: string; domainErrorCode: "STALE_CALL"; currentRow: ServiceCallRowDto };
/** 고객 연결 정정(F06)도 같은 모양: STALE_CALL이면 쓰기·감사 없이 지금의 행을 함께 돌려준다. */
export type ServiceCallCustomerLinkCorrectionActionState = ServiceCallAutosaveResult | null;
export type DailyExpenseActionState = ActionResult<DailyExpenseDto> | null;
export type CustomerActionState = ActionResult<CustomerDto> | null;

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>, locale: Locale) {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
      // Zod 한국어 메시지를 inline field error 표시 직전에 locale로 번역한다.
      .map(([field, messages]) => [field, messages.map((message) => resolveKoreanMessage(locale, message))])
  );
}

function formValue(formData: FormData, key: string) {
  return formData.get(key);
}

function mapActionError<T>(
  error: unknown,
  locale: Locale,
  fieldMap: { dateField: "serviceDate" | "expenseDate"; handlerField?: "handledByEmployeeId" } = { dateField: "serviceDate" }
): ActionResult<T> {
  if (error instanceof ServiceCallDomainError) {
    const message = resolveDomainErrorMessage(locale, error.code, error.message);

    if (error.code === "D_COURSE_SECOND_THERAPIST_REQUIRED" || error.code === "D_QUICK_BOOKING_DUPLICATE_THERAPIST") {
      return {
        ok: false,
        fieldErrors: { therapist2Id: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "SERVICE_CALL_CUSTOMER_LINK_REASON_REQUIRED") {
      return {
        ok: false,
        fieldErrors: { reason: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "INVALID_DAILY_EXPENSE_INPUT") {
      return {
        ok: false,
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "EMPLOYEE_NOT_ACTIVE" && fieldMap.handlerField) {
      return {
        ok: false,
        fieldErrors: { [fieldMap.handlerField]: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE") {
      return {
        ok: false,
        fieldErrors: { [fieldMap.dateField]: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "ROOM_REQUIRED_FOR_STATUS") {
      return {
        ok: false,
        fieldErrors: { roomId: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    return {
      ok: false,
      formError: message,
      domainErrorCode: error.code
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      formError: t(locale, "action.error.noPermission")
    };
  }

  if (error instanceof AuditDomainError) {
    return {
      ok: false,
      formError: t(locale, "action.error.auditFailed"),
      domainErrorCode: error.code
    };
  }

  return {
    ok: false,
    formError: t(locale, "action.error.saveFailed")
  };
}

function canViewSettlementAmounts(role: string) {
  return role === "administrator" || role === "settlement_manager";
}

function visibleServiceCallRowForRole(row: ServiceCallRowDto, role: string) {
  return canViewSettlementAmounts(role) ? row : redactServiceCallSettlementAmounts(row);
}

/** 원장 새 행 저장. 같은 요청 id로 이미 만든 콜이면 새로 만들지 않고 그 콜을 "이미 저장된 콜입니다"와 함께 돌려준다. */
export async function createServiceCallRowAction(input: ServiceCallCreateInput): Promise<ActionResult<ServiceCallRowDto>> {
  const locale = await getLocale();
  const parsed = serviceCallCreateInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const { row, alreadySaved } = await createServiceCallRow({ ...parsed.data, actorId: account.id });
    revalidatePath("/calls");
    const data = visibleServiceCallRowForRole(row, account.role);
    return alreadySaved ? { ok: true, data, notice: t(locale, "calls.save.alreadySaved") } : { ok: true, data };
  } catch (error) {
    return mapActionError<ServiceCallRowDto>(error, locale);
  }
}

/**
 * 빠른 예약 저장(F01, 티켓 21). createServiceCallRowAction과 같은 요청 id 계약을 쓰지만, 같은 사람을
 * Therapist 1·2로 두 번 고르는 것을 저장 오류로 더 막는다. 이 검사는 빠른 예약에만 적용하고, 원장
 * 표의 새 행 직접 입력(createServiceCallRowAction)에는 소급하지 않는다.
 */
export async function createQuickBookingServiceCallAction(input: ServiceCallCreateInput): Promise<ActionResult<ServiceCallRowDto>> {
  const locale = await getLocale();
  const parsed = serviceCallCreateInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const { row, alreadySaved } = await createQuickBookingServiceCall({ ...parsed.data, actorId: account.id });
    revalidatePath("/calls");
    const data = visibleServiceCallRowForRole(row, account.role);
    return alreadySaved ? { ok: true, data, notice: t(locale, "calls.save.alreadySaved") } : { ok: true, data };
  } catch (error) {
    return mapActionError<ServiceCallRowDto>(error, locale);
  }
}

/**
 * 빠른 예약 일행 저장(스펙 D10–D12, 티켓 02). 손님마다 콜 하나를 한 번에 만들고 1번(대표) 콜부터 순서대로
 * 돌려준다. 같은 요청 id로 다시 보내면 이미 만든 일행을 "이미 저장된 콜입니다"와 함께 돌려준다. 한 손님의
 * 값이 걸리면 아무것도 만들지 않고, 그 손님의 칸 오류와 "손님 N: …" 요약을 돌려준다.
 */
export async function createQuickBookingPartyAction(input: QuickBookingPartyInput): Promise<ActionResult<ServiceCallRowDto[]>> {
  const locale = await getLocale();
  const parsed = quickBookingPartyInputSchema.safeParse(input);

  if (!parsed.success) {
    // flatten은 첫 경로로만 묶어 손님 칸 오류가 모두 "guests"로 접힌다. 손님·칸별 키로 나눠 그 손님 옆에 보인다.
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = quickBookingPartyIssueField(issue.path);
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return {
      ok: false,
      fieldErrors: toFieldErrors(fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const { rows, alreadySaved } = await createQuickBookingParty({ ...parsed.data, actorId: account.id });
    revalidatePath("/calls");
    const data = rows.map((row) => visibleServiceCallRowForRole(row, account.role));
    return alreadySaved ? { ok: true, data, notice: t(locale, "calls.save.alreadySaved") } : { ok: true, data };
  } catch (error) {
    if (error instanceof QuickBookingGuestError) {
      const message = resolveDomainErrorMessage(locale, error.code, error.message);
      return {
        ok: false,
        fieldErrors: { [quickBookingGuestFieldKey(error.guestPosition, error.field)]: [message] },
        formError: t(locale, "calls.quickBooking.party.guestError", { position: error.guestPosition, message }),
        domainErrorCode: error.code
      };
    }
    return mapActionError<ServiceCallRowDto[]>(error, locale);
  }
}

export async function autosaveServiceCallRowAction(input: ServiceCallAutosaveInput): Promise<ServiceCallAutosaveResult> {
  const locale = await getLocale();
  const parsed = serviceCallAutosaveInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  let role: string | null = null;
  try {
    const account = await requirePermission("call:write");
    role = account.role;
    const data = await autosaveServiceCallRow({
      ...parsed.data,
      actorId: account.id
    });
    // revalidatePath를 부르지 않는다. 부르면 원장 화면 전체를 다시 그린 뒤에야 응답이 와서 줄의 "저장 중"이 그만큼 늦게
    // 걷히고, 서버 액션은 한 번에 하나씩 보내져 일행 입장처럼 여러 줄을 함께 저장하면 그 대기가 줄마다 쌓인다. 줄은 돌려받은
    // 행으로 바로 바뀌고, 나머지 화면(현황 줄·상태 칸)은 작업면이 저장 뒤에 한 번 새로 고친다(2026-10-23 고객 요청).
    return { ok: true, data: visibleServiceCallRowForRole(data, account.role) };
  } catch (error) {
    if (error instanceof StaleServiceCallError && role) {
      return {
        ok: false,
        formError: resolveDomainErrorMessage(locale, error.code, error.message),
        domainErrorCode: "STALE_CALL",
        currentRow: visibleServiceCallRowForRole(error.currentRow, role)
      };
    }
    return mapActionError<ServiceCallRowDto>(error, locale);
  }
}

/** 저장이 거절된 행이 "최신 내용으로 다시 불러오기"를 누르면 그 콜을 지금 저장된 그대로 읽는다. */
export async function reloadServiceCallRowAction(serviceCallId: string): Promise<ActionResult<ServiceCallRowDto>> {
  const locale = await getLocale();
  if (typeof serviceCallId !== "string" || serviceCallId.trim() === "") {
    return { ok: false, formError: t(locale, "action.error.invalidInput") };
  }

  try {
    const account = await requirePermission("call:write");
    const data = await getServiceCallRow({ serviceCallId: serviceCallId.trim() });
    return { ok: true, data: visibleServiceCallRowForRole(data, account.role) };
  } catch (error) {
    return mapActionError<ServiceCallRowDto>(error, locale);
  }
}

export async function createDailyExpenseAction(
  _previousState: DailyExpenseActionState,
  formData: FormData
): Promise<DailyExpenseActionState> {
  const locale = await getLocale();
  const parsed = dailyExpenseInputSchema.safeParse({
    operatingMonthId: formValue(formData, "operatingMonthId"),
    expenseDate: formValue(formData, "expenseDate"),
    amount: formValue(formData, "amount"),
    description: formValue(formData, "description"),
    handledByEmployeeId: formValue(formData, "handledByEmployeeId"),
    method: formValue(formData, "method"),
    note: formValue(formData, "note")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const data = await createDailyExpense({ ...parsed.data, actorId: account.id });
    revalidatePath("/calls");
    return { ok: true, data };
  } catch (error) {
    return mapActionError<DailyExpenseDto>(error, locale, { dateField: "expenseDate", handlerField: "handledByEmployeeId" });
  }
}

export async function updateDailyExpenseAction(
  _previousState: DailyExpenseActionState,
  formData: FormData
): Promise<DailyExpenseActionState> {
  const locale = await getLocale();
  const parsed = dailyExpenseUpdateSchema.safeParse({
    dailyExpenseId: formValue(formData, "dailyExpenseId"),
    operatingMonthId: formValue(formData, "operatingMonthId"),
    expenseDate: formValue(formData, "expenseDate"),
    amount: formValue(formData, "amount"),
    description: formValue(formData, "description"),
    handledByEmployeeId: formValue(formData, "handledByEmployeeId"),
    method: formValue(formData, "method"),
    note: formValue(formData, "note")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const data = await updateDailyExpense({ ...parsed.data, actorId: account.id });
    revalidatePath("/calls");
    return { ok: true, data };
  } catch (error) {
    return mapActionError<DailyExpenseDto>(error, locale, { dateField: "expenseDate", handlerField: "handledByEmployeeId" });
  }
}

export async function deactivateDailyExpenseAction(
  _previousState: DailyExpenseActionState,
  formData: FormData
): Promise<DailyExpenseActionState> {
  const locale = await getLocale();
  const parsed = dailyExpenseDeactivateSchema.safeParse({
    dailyExpenseId: formValue(formData, "dailyExpenseId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const data = await deactivateDailyExpense({ ...parsed.data, actorId: account.id });
    revalidatePath("/calls");
    return { ok: true, data };
  } catch (error) {
    return mapActionError<DailyExpenseDto>(error, locale, { dateField: "expenseDate", handlerField: "handledByEmployeeId" });
  }
}

export async function createCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const locale = await getLocale();
  const parsed = customerInputSchema.safeParse({
    name: formValue(formData, "name"),
    phone: formValue(formData, "phone"),
    memo: formValue(formData, "memo"),
    preferenceNote: formValue(formData, "preferenceNote")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const data = await createCustomer({ ...parsed.data, actorId: account.id });
    // 고객 등록·정정은 고객 화면에서 하고, 원장은 콜에 고객을 붙일 때 같은 고객 목록을 쓴다.
    revalidatePath("/customers");
    revalidatePath("/calls");
    return { ok: true, data };
  } catch (error) {
    return mapActionError<CustomerDto>(error, locale);
  }
}

export async function updateCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const locale = await getLocale();
  const parsed = customerUpdateSchema.safeParse({
    customerId: formValue(formData, "customerId"),
    name: formValue(formData, "name"),
    phone: formValue(formData, "phone"),
    memo: formValue(formData, "memo"),
    preferenceNote: formValue(formData, "preferenceNote")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const data = await updateCustomer({ ...parsed.data, actorId: account.id });
    // 고객 등록·정정은 고객 화면에서 하고, 원장은 콜에 고객을 붙일 때 같은 고객 목록을 쓴다.
    revalidatePath("/customers");
    revalidatePath("/calls");
    return { ok: true, data };
  } catch (error) {
    return mapActionError<CustomerDto>(error, locale);
  }
}

export async function loadTherapistAvailabilityAction(input: { operatingMonthId: string; serviceDate: string; time: string; excludeCallId?: string }) {
  await requireRouteAccess("/calls");
  // 자동 청소 중(1018 스펙 D14): 가능 판정도 그 영업일을 읽기 전에 정리한다. 끝낸 콜이 있으면 원장을 다시 그려
  // 열린 줄이 새 행을 따르게 한다(낡은 저장 거절이 그 줄을 막지 않게).
  const finished = await autoFinishOverdueCalls({ operatingMonthId: input.operatingMonthId, serviceDate: input.serviceDate });
  if (finished.length > 0) revalidatePath("/calls");
  // 빠른 예약 ①은 남은 자리(1018 스펙 D25)도 함께 받는다. 같은 조회로 계산해 DB를 더 읽지 않는다.
  return listTherapistAvailabilityWithSeats(input);
}

/** 콜 상세 패널의 고객 연결 정정이 검색할 때 쓴다. 22의 방문 건수·같은 연락처 비교 정보를 그대로 돌려준다. */
export async function searchCustomerLinkCandidatesAction(query: string): Promise<CustomerVisitCandidateDto[]> {
  await requirePermission("call:write");
  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed) return [];
  return searchCustomerVisitCandidates({ query: trimmed });
}

/**
 * 빠른 예약 고객 단계가 기존 고객을 고르면 부른다(B09, 스토리 71-73, 티켓 24). 방문완료·노쇼·취소 건수와
 * 가장 최근 방문(코스·Therapist·방문별 요청)을 돌려준다. 화면은 체크한 항목만 초안에 가져온다.
 * sharedPhone은 고른 고객이 검색 밖에서도 같은 연락처 경고를 보이기 위함이다(S5, 스펙 F01 단계 1).
 */
export async function loadCustomerVisitSummaryAction(
  customerId: string
): Promise<{ counts: CustomerVisitCountsDto; recentVisit: CustomerVisitHistoryRowDto | null; sharedPhone: boolean }> {
  await requireRouteAccess("/calls");
  const trimmed = typeof customerId === "string" ? customerId.trim() : "";
  if (!trimmed) {
    return { counts: { completedCount: 0, noShowCount: 0, canceledCount: 0 }, recentVisit: null, sharedPhone: false };
  }
  const [rows, sharedPhone, sortOrderByTime] = await Promise.all([
    listCustomerVisitHistory({ kind: "customer", customerId: trimmed }),
    customerSharedPhone({ customerId: trimmed }),
    timeSlotSortOrderMap()
  ]);
  return { counts: customerVisitCountsFromRows(rows), recentVisit: mostRecentCustomerVisit(rows, sortOrderByTime), sharedPhone };
}

/**
 * 콜 상세 패널에서 잘못 연결된 고객을 사유와 함께 바꾸거나 연결을 해제한다(F06, ADR 0003).
 * 원장 행 저장과는 별개의 전용 작업이라, saveBasicServiceCallRowAction/autosaveServiceCallRowAction과
 * 달리 콜의 다른 필드는 건드리지 않는다. STALE_CALL이면 autosave와 같은 모양으로 지금의 행을 함께 돌려준다.
 */
export async function correctServiceCallCustomerLinkAction(
  _previousState: ServiceCallCustomerLinkCorrectionActionState,
  formData: FormData
): Promise<ServiceCallCustomerLinkCorrectionActionState> {
  const locale = await getLocale();
  const parsed = serviceCallCustomerLinkCorrectionSchema.safeParse({
    serviceCallId: formValue(formData, "serviceCallId"),
    customerId: formValue(formData, "customerId"),
    reason: formValue(formData, "reason"),
    expectedUpdatedAt: formValue(formData, "expectedUpdatedAt")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  let role: string | null = null;
  try {
    const account = await requirePermission("call:write");
    role = account.role;
    const data = await correctServiceCallCustomerLink({ ...parsed.data, actorId: account.id });
    revalidatePath("/calls");
    revalidatePath("/customers");
    return { ok: true, data: visibleServiceCallRowForRole(data, account.role) };
  } catch (error) {
    if (error instanceof StaleServiceCallError && role) {
      return {
        ok: false,
        formError: resolveDomainErrorMessage(locale, error.code, error.message),
        domainErrorCode: "STALE_CALL",
        currentRow: visibleServiceCallRowForRole(error.currentRow, role)
      };
    }
    return mapActionError<ServiceCallRowDto>(error, locale);
  }
}
