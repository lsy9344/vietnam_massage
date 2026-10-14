/**
 * 대시보드 차트의 축과 막대 위치. 서비스가 준 값을 화면에 놓는 비율만 정하고 집계는 하지 않는다.
 * 서버 페이지와 뷰가 함께 쓰므로 "use client" 없는 일반 모듈로 둔다.
 */

const TICK_COUNT = 4;

// 1·2·5×10^k 가운데 raw 이상인 가장 작은 값. 건수와 VND는 정수라 1보다 작은 간격은 두지 않는다.
function niceStep(raw: number) {
  if (raw <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw);
  return step ?? 10 * magnitude;
}

/** 0부터 가장 큰 값을 덮는 세로 축 눈금(아래에서 위로). 음수가 있으면 0 아래로도 늘린다. */
export function axisTicks(values: number[]) {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const step = niceStep((max - min) / TICK_COUNT);
  const first = Math.floor(min / step) * step;
  const last = Math.max(Math.ceil(max / step) * step, first + step);
  const ticks: number[] = [];
  for (let tick = first; tick <= last; tick += step) ticks.push(tick);
  return ticks;
}

/** axisTicks의 바닥에서 값까지의 높이(%). */
export function heightPercent(value: number, ticks: number[]) {
  const first = ticks[0];
  const last = ticks[ticks.length - 1];
  return ((value - first) / (last - first)) * 100;
}

const MAX_X_LABELS = 7;

/** 가로 축에서 몇 칸마다 날짜 글자를 다는지. 첫 칸부터 이 간격으로 단다. */
export function labelStride(count: number) {
  return Math.max(1, Math.ceil(count / MAX_X_LABELS));
}
