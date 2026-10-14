import type { MessageKey } from "@/lib/i18n";

export type SignInField = "identity" | "password";

/**
 * 보내기 전에 빈 칸을 막는다. 문장이 아니라 번역 key를 돌려줘서, 오류가 보이는 중에 언어를 바꿔도
 * 새 언어로 다시 그려진다. 비밀번호는 공백도 비밀번호의 일부라 그대로 둔다.
 */
export function validateSignIn(values: { identity: string; password: string }) {
  const errors: Partial<Record<SignInField, MessageKey>> = {};
  if (values.identity.trim() === "") errors.identity = "auth.error.identityRequired";
  if (values.password === "") errors.password = "auth.error.passwordRequired";
  return errors;
}
