/**
 * 기준정보 화면들이 서버 페이지와 클라이언트 작업면에서 함께 쓰는 값. "use client" 모듈에 두면
 * 서버 페이지에서 값이 아니라 클라이언트 참조가 되므로 여기에 둔다.
 */

/** 고른 항목(객실, 코드, 직원 …)의 id. 주소에 남아 새로고침과 링크로 같은 패널이 열린다. */
export const MASTER_ITEM_PARAM = "item";

export function readMasterItem(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** 지금 주소에서 item 매개변수만 바꾼 경로. 다른 매개변수(시트 매핑 필터 등)는 그대로 둔다. */
export function masterItemHref(currentHref: string, item: string | null) {
  const url = new URL(currentHref);
  if (item) url.searchParams.set(MASTER_ITEM_PARAM, item);
  else url.searchParams.delete(MASTER_ITEM_PARAM);
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

export function countActive(items: ReadonlyArray<{ isActive: boolean }>) {
  const active = items.filter((item) => item.isActive).length;
  return { active, inactive: items.length - active };
}
