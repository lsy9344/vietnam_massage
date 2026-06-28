import { type Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { resolveKoreanMessage } from "@/lib/i18n/errors";

/**
 * 정산/월마감 "산출 근거(calculationBasis/monthlyCalculationBasis)" 표시 경계 번역기.
 *
 * 배경: ops-daily / ops-monthly / earcare 서비스가 산출 근거를 한국어 + 동적 숫자(금액·인원)로
 * 조합한 문자열로 만든다(테스트·검증이 이 한국어를 단언하므로 서비스는 ko 유지). 화면에서는
 * 이 문자열이 vi에 그대로 새므로, 표시 직전에 템플릿 패턴으로 파싱해 locale 문자열로 재구성한다.
 *
 * - locale === "ko"면 원문 그대로 반환(서비스 한국어).
 * - vi면: 고정 문구는 resolveKoreanMessage 화이트리스트, 동적 문구는 anchored 정규식으로 숫자를
 *   캡처해 vi 템플릿으로 재구성(숫자는 formatNumber로 locale 그룹 적용).
 * - 어떤 패턴에도 안 맞으면 원문(ko) 반환(빈 화면 방지).
 *
 * opsMonthly(page), closing.operations(monthlyCalculationBasis), closing.earcare, ops/earcare daily가 공유한다.
 */

type DynamicPattern = {
  // 캡처 그룹: 숫자(amount/count)들. re.exec 결과의 group들을 vi(...nums)로 넘긴다.
  re: RegExp;
  // 캡처된 숫자(원문 raw 문자열)를 받아 vi 문자열을 만든다. 숫자는 fmt로 포맷한다.
  vi: (fmt: (raw: string) => string, groups: string[]) => string;
};

function makeFmt(locale: Locale) {
  return (raw: string) => formatNumber(locale, Number(raw.replace(/,/g, "")));
}

// 동적 패턴(숫자 포함). 순서 중요: 더 구체적인 패턴을 먼저 둔다.
const DYNAMIC_PATTERNS: DynamicPattern[] = [
  // ops-monthly
  {
    re: /^팀장 몫 ([\d,]+) VND$/,
    vi: (f, g) => `Phần trưởng nhóm ${f(g[0])} VND`
  },
  {
    re: /^카운터팀 대상자 0명 \/ 미배분 ([\d,]+) VND$/,
    vi: (f, g) => `0 đối tượng nhóm quầy / chưa phân bổ ${f(g[0])} VND`
  },
  {
    re: /^카운터팀 몫 ([\d,]+) VND \/ (\d+)명$/,
    vi: (f, g) => `Phần nhóm quầy ${f(g[0])} VND / ${f(g[1])} người`
  },
  {
    re: /^웨이터팀 대상자 0명 \/ 미배분 ([\d,]+) VND$/,
    vi: (f, g) => `0 đối tượng nhóm phục vụ / chưa phân bổ ${f(g[0])} VND`
  },
  {
    re: /^웨이터팀 몫 ([\d,]+) VND \/ (\d+)명$/,
    vi: (f, g) => `Phần nhóm phục vụ ${f(g[0])} VND / ${f(g[1])} người`
  },
  // earcare daily
  {
    re: /^정상 근무자 0명 \/ 미분배 ([\d,]+) VND$/,
    vi: (f, g) => `0 nhân viên đi làm bình thường / chưa phân bổ ${f(g[0])} VND`
  },
  {
    re: /^방문완료 풀 ([\d,]+) VND \/ 정상 근무자 (\d+)명 \+ 잔여 ([\d,]+) VND 배분$/,
    vi: (f, g) => `Quỹ hoàn tất ${f(g[0])} VND / ${f(g[1])} nhân viên bình thường + phân bổ phần dư ${f(g[2])} VND`
  },
  {
    re: /^방문완료 풀 ([\d,]+) VND \/ 정상 근무자 (\d+)명$/,
    vi: (f, g) => `Quỹ hoàn tất ${f(g[0])} VND / ${f(g[1])} nhân viên bình thường`
  },
  // ops-daily
  {
    re: /^일 총콜 (\d+)콜 \/ (\d+)콜 이상 개인 ([\d,]+) VND$/,
    vi: (f, g) => `Tổng cuộc gọi ngày ${f(g[0])} ca / từ ${f(g[1])} ca, cá nhân ${f(g[2])} VND`
  },
  // ops-daily/ops-monthly threshold warning (동적 숫자)
  {
    re: /^(\d+)콜 미만으로 운영팀 (일일|월) 인센이 없습니다\.$/,
    vi: (f, g) => `Dưới ${f(g[0])} ca nên không có thưởng ${g[1] === "월" ? "tháng" : "ngày"} nhóm vận hành.`
  }
];

// 고정(숫자 없는) 산출근거 문구 → resolveKoreanMessage 화이트리스트(errors.ts)에 있음.
// 추가로 여기서만 쓰이는 고정 문구는 아래 맵으로 보강한다.
const FIXED_BASIS_VI: Record<string, string> = {
  "방문완료 귀케어 풀 0 VND": "Quỹ chăm sóc tai hoàn tất 0 VND",
  "운영팀 일일 인센 정책 없음": "Không có chính sách thưởng ngày nhóm vận hành",
  "30콜 미만": "Dưới 30 ca"
};

/**
 * "{근무상태} 제외" 형태 처리: 캡처한 상태 라벨을 화이트리스트로 번역하고 "제외"를 vi로.
 * 상태 라벨이 번역 사전에 없으면 원문 상태 + vi "제외"로 둔다.
 */
function translateExclusion(locale: Locale, koBasis: string): string | null {
  const match = /^(.+) 제외$/.exec(koBasis);
  if (!match) return null;
  const statusKo = match[1];
  const statusVi = resolveKoreanMessage(locale, statusKo);
  return `${statusVi} (loại trừ)`;
}

export function settlementBasisText(locale: Locale, koBasis: string | null | undefined): string {
  if (!koBasis) return "";
  if (locale === "ko") return koBasis;

  // 1) 고정 문구 화이트리스트(errors.ts 공유) 우선.
  const whitelisted = resolveKoreanMessage(locale, koBasis);
  if (whitelisted !== koBasis) return whitelisted;
  if (FIXED_BASIS_VI[koBasis]) return FIXED_BASIS_VI[koBasis];

  // 2) "{상태} 제외" 처리.
  const exclusion = translateExclusion(locale, koBasis);
  if (exclusion) return exclusion;

  // 3) 동적 패턴.
  const fmt = makeFmt(locale);
  for (const { re, vi } of DYNAMIC_PATTERNS) {
    const m = re.exec(koBasis);
    if (m) return vi(fmt, m.slice(1));
  }

  // 4) 미매칭: 원문(ko) 반환(빈 화면 방지).
  return koBasis;
}
