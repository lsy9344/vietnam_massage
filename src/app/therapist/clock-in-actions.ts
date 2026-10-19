"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { requireTherapistAccess } from "@/modules/therapists/therapist-access-service";
import { clockInWithCode, TherapistClockInDomainError, type TherapistClockInAction } from "@/modules/therapists/therapist-clock-in-service";
import type { TherapistAttendanceDto } from "@/modules/settlements/therapist-attendance-service";

export type TherapistClockInSubmitResult =
  | { ok: true; attendance: TherapistAttendanceDto }
  | { ok: false; code: "CLOCK_CODE_INVALID"; remainingAttempts: number }
  | { ok: false; code: "CLOCK_CODE_LOCKED"; lockedUntil: string }
  | { ok: false; code: "ALREADY_CLOCKED_IN" | "ALREADY_CLOCKED_OUT" | "CHECK_IN_REQUIRED_BEFORE_CHECK_OUT" }
  // 그 밖의 도메인 오류(잠긴 운영월 등). code 칸을 리터럴로 고정해 둬야 위 가지들과 구별된다 —
  // 여기만 string이면 TypeScript가 discriminated union 좁히기를 못 한다.
  | { ok: false; code: "DOMAIN_ERROR"; domainCode: string; message: string };

/**
 * 출근 코드로 찍기(스펙 D13–D15, 티켓 05). "오늘" 탭의 출근·퇴근 버튼이 코드 입력 다이얼로그에서
 * 이 액션을 직접 부른다(markTherapistNoticeReadAction과 같은 모양 — FormData 없는 일반 함수 호출).
 * employeeId·accountId는 세션에서만 얻는다(M3) — 클라이언트는 action과 code만 보낸다. 코드 틀림·
 * 잠김처럼 UI가 바로 보여줘야 하는 값은 구조화해 돌려주고, 그 밖의 도메인 오류(잠긴 운영월 등)는
 * 번역된 메시지만 돌려준다.
 */
export async function submitTherapistClockInCodeAction(action: TherapistClockInAction, code: string): Promise<TherapistClockInSubmitResult> {
  const locale = await getLocale();
  const { accountId, employeeId } = await requireTherapistAccess();

  try {
    const attendance = await clockInWithCode({ employeeId, accountId, action, code });
    revalidatePath("/therapist");
    return { ok: true, attendance };
  } catch (error) {
    if (error instanceof TherapistClockInDomainError) {
      if (error.code === "CLOCK_CODE_INVALID") {
        return { ok: false, code: "CLOCK_CODE_INVALID", remainingAttempts: error.details?.remainingAttempts ?? 0 };
      }
      if (error.code === "CLOCK_CODE_LOCKED") {
        return { ok: false, code: "CLOCK_CODE_LOCKED", lockedUntil: error.details?.lockedUntil ?? new Date().toISOString() };
      }
      if (error.code === "ALREADY_CLOCKED_IN" || error.code === "ALREADY_CLOCKED_OUT" || error.code === "CHECK_IN_REQUIRED_BEFORE_CHECK_OUT") {
        return { ok: false, code: error.code };
      }
      return { ok: false, code: "DOMAIN_ERROR", domainCode: error.code, message: resolveDomainErrorMessage(locale, error.code, error.message) };
    }
    if (error instanceof Error && "code" in error && typeof (error as { code?: unknown }).code === "string") {
      const domainCode = (error as { code: string }).code;
      return { ok: false, code: "DOMAIN_ERROR", domainCode, message: resolveDomainErrorMessage(locale, domainCode, error.message) };
    }
    return {
      ok: false,
      code: "DOMAIN_ERROR",
      domainCode: "UNKNOWN",
      message: resolveDomainErrorMessage(locale, undefined, "출퇴근을 저장하지 못했습니다.")
    };
  }
}
