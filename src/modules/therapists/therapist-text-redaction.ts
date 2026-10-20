/**
 * 숫자 가림(스펙 M13, D11): 7자리 이상 이어진 숫자(사이에 공백·하이픈·점이 끼어도 이어진 것으로 본다.
 * "+"로 시작하는 국가 번호도 그 뒤에 바로 이어지면 함께 가린다)를 가림 표시로 바꾼다. 6자리 이하 숫자
 * (객실 번호, 시각, 금액)는 그대로 둔다. 연락처 칸 자체는 질의에서 아예 고르지 않으므로(M6) 여기서
 * 가리는 것은 이름·방문별 요청·고객 공통 선호·주의사항처럼 자유롭게 쓴 글에 섞여 들어온 번호다.
 *
 * R13(M13 "금액은 그대로"): 구분자 허용 때문에 7자리 이상인 천 단위 묶음 금액("1.500.000 VND")과
 * ISO 날짜("2026-10-20")까지 가려지던 것을 막는다. 전화번호(0으로 시작하는 묶음, 국가 번호, 묶음
 * 길이가 들쭉날쭉하거나 구분자가 섞인 경우)는 이 예외에 걸리지 않아 계속 가려진다.
 *
 * (가정) 가림 표시는 원래 숫자 길이와 무관하게 고정된 문자열이다 — 가려진 번호의 자릿수까지 남겨 두면
 * 그만큼 정보가 샌다.
 */
const DIGIT_RUN = /\+?\d(?:[ .-]?\d)*/g;
const REDACTED_MARK = "•••••••";
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function countDigits(value: string): number {
  return value.match(/\d/g)?.length ?? 0;
}

/** YYYY-MM-DD 모양이고 월·일이 있을 법한 범위면 ISO 날짜로 본다(R13). 구분자는 "-"로만 한정한다. */
function isIsoDate(match: string): boolean {
  const parsed = ISO_DATE.exec(match);
  if (!parsed) return false;
  const month = Number(parsed[2]);
  const day = Number(parsed[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/**
 * 천 단위로 묶인 금액 모양이면 true(R13). 숫자 묶음과 구분자를 따로 뽑아, 구분자가 모두 같고
 * (한 묶음 숫자 안에서는 섞이지 않는다), 첫 묶음이 1–3자리이며 0으로 시작하지 않고, 나머지 묶음이
 * 모두 정확히 3자리일 때만 금액으로 본다. "+" 같은 비숫자·비구분자 문자(국가 번호)가 있으면 토큰화에서
 * 빠지므로 전화번호는 이 모양에 거의 걸리지 않는다.
 */
function isThousandsGroupedAmount(match: string): boolean {
  const tokens = match.match(/\d+|[ .-]/g);
  if (!tokens) return false;
  const groups = tokens.filter((token) => /^\d+$/.test(token));
  const separators = tokens.filter((token) => !/^\d+$/.test(token));
  if (groups.length < 2 || separators.length === 0) return false;
  if (!separators.every((separator) => separator === separators[0])) return false;
  const [first, ...rest] = groups;
  if (!/^[1-9]\d{0,2}$/.test(first)) return false;
  return rest.every((group) => /^\d{3}$/.test(group));
}

function isExemptFromRedaction(match: string): boolean {
  return isIsoDate(match) || isThousandsGroupedAmount(match);
}

export function redactLongDigitSequences(text: string): string;
export function redactLongDigitSequences(text: string | null): string | null;
export function redactLongDigitSequences(text: string | null): string | null {
  if (text === null) return null;
  return text.replace(DIGIT_RUN, (match) => (countDigits(match) >= 7 && !isExemptFromRedaction(match) ? REDACTED_MARK : match));
}
