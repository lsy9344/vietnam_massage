import type { ko } from "@/lib/i18n/messages/ko";

export type { Locale } from "@/lib/i18n/config";

/**
 * 번역 key 집합. ko 카탈로그가 원천이므로, ko에 없는 key는 타입 에러가 된다.
 */
export type MessageKey = keyof typeof ko;

/**
 * 한 locale의 전체 메시지 맵. vi 카탈로그에 key가 누락되면 타입 에러가 난다.
 */
export type Messages = Record<MessageKey, string>;
