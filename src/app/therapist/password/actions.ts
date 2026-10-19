"use server";

import type { ActionResult } from "@/lib/action-result";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { AccountDomainError, changeOwnPassword } from "@/modules/masters/account-service";
import { requireTherapistAccess } from "@/modules/therapists/therapist-access-service";

export type TherapistPasswordActionState = ActionResult<{ changed: true }> | null;

/**
 * Therapist 본인의 비밀번호 변경(티켓 02, 02 가정: 지금 비밀번호도 받는다). "나" 메뉴와 첫 로그인 강제
 * 변경 화면이 같이 쓴다. requireTherapistAccess를 allowPasswordChangeRequired로 불러, 표시가 켜져
 * 있어 다른 화면이 막힌 상태에서도 이 화면만은 열리게 한다(M17 예외).
 */
export async function changeTherapistPasswordAction(
  _previousState: TherapistPasswordActionState,
  formData: FormData
): Promise<TherapistPasswordActionState> {
  const locale = await getLocale();
  const currentSecret = String(formData.get("currentSecret") ?? "");
  const nextSecret = String(formData.get("nextSecret") ?? "");

  if (currentSecret.length === 0) {
    return { ok: false, fieldErrors: { currentSecret: [t(locale, "action.error.invalidInput")] } };
  }
  if (nextSecret.length < 8) {
    return { ok: false, fieldErrors: { nextSecret: [t(locale, "action.error.invalidInput")] } };
  }

  // requireTherapistAccess는 실패하면 redirect()를 던진다(세션 만료 등) — 그 예외가 아래 try/catch에
  // 잡혀 저장 실패 메시지로 바뀌지 않도록 try 밖에서 부른다.
  const { accountId } = await requireTherapistAccess({ allowPasswordChangeRequired: true });

  try {
    await changeOwnPassword({ accountId, currentSecret, nextSecret });
    return { ok: true, data: { changed: true } };
  } catch (error) {
    if (error instanceof AccountDomainError) {
      return { ok: false, formError: resolveDomainErrorMessage(locale, error.code, error.message), domainErrorCode: error.code };
    }
    return { ok: false, formError: t(locale, "action.error.saveFailed") };
  }
}
