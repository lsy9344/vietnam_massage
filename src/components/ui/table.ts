import { cn } from "@/lib/utils";

/**
 * 표 칸 공통 간격(design.md 6.6): 칸 사이 32px(px-4), 위아래 10px(py-2.5)로 모든 표가 같은 리듬을 쓴다.
 * 전에는 표마다 "border-b border-border px-3 py-2" 같은 상수를 따로 둬 칸 간격이 표마다 달랐다.
 */
export const tableHeadCellClassName = "px-4 py-2.5";
export const tableCellClassName = "border-b border-border px-4 py-2.5";

/** 숫자·금액 칸: 오른쪽 정렬, 줄바꿈 없이, 숫자 자릿수가 흔들리지 않는다. */
export const tableNumberCellClassName = cn(tableCellClassName, "whitespace-nowrap text-right tabular-nums");

/**
 * 칸을 내용 폭으로 줄이는 덧붙임(머리 칸에 붙이면 열 전체가 줄어든다). 줄인 열의 남는 폭은 줄이지 않은 열들이 나눠 갖는다.
 * 그래서 남는 폭을 받을 열(메모 같은 긴 글자 열, 또는 줄이지 않은 글자 열 여럿)이 있는 표에서만 쓴다. 이름 열 하나만 남으면
 * 나머지 칸이 오른쪽 끝에 몰린다(design.md 6.6).
 */
export const tableShrinkClassName = "w-px whitespace-nowrap";
