/**
 * 날짜 목록처럼 항목 수가 고정된 작업을 동시 실행 수를 제한해 처리한다.
 * 순차 실행은 한 달치에서 왕복 지연이 그대로 쌓이고, 무제한 Promise.all 은
 * DB 커넥션 풀을 넘겨 오히려 줄을 세운다. 결과 순서는 입력 순서를 유지한다.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
