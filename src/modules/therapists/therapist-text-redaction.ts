/**
 * 숫자 가림(스펙 M13, D11): 7자리 이상 이어진 숫자(사이에 공백·하이픈·점이 끼어도 이어진 것으로 본다.
 * "+"로 시작하는 국가 번호도 그 뒤에 바로 이어지면 함께 가린다)를 가림 표시로 바꾼다. 6자리 이하 숫자
 * (객실 번호, 시각, 금액)는 그대로 둔다. 연락처 칸 자체는 질의에서 아예 고르지 않으므로(M6) 여기서
 * 가리는 것은 이름·방문별 요청·고객 공통 선호·주의사항처럼 자유롭게 쓴 글에 섞여 들어온 번호다.
 *
 * (가정) 가림 표시는 원래 숫자 길이와 무관하게 고정된 문자열이다 — 가려진 번호의 자릿수까지 남겨 두면
 * 그만큼 정보가 샌다.
 */
const DIGIT_RUN = /\+?\d(?:[ .-]?\d)*/g;
const REDACTED_MARK = "•••••••";

function countDigits(value: string): number {
  return value.match(/\d/g)?.length ?? 0;
}

export function redactLongDigitSequences(text: string): string;
export function redactLongDigitSequences(text: string | null): string | null;
export function redactLongDigitSequences(text: string | null): string | null {
  if (text === null) return null;
  return text.replace(DIGIT_RUN, (match) => (countDigits(match) >= 7 ? REDACTED_MARK : match));
}
