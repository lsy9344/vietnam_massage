const MEMOIZED_READ_METHODS = new Set(["findUnique", "findFirst", "findMany", "count", "aggregate"]);

function readCacheKey(model: string, method: string, args: unknown) {
  return `${model}.${method}:${JSON.stringify(args, (_key, value) =>
    typeof value === "bigint" ? `${value.toString()}n` : value
  )}`;
}

/**
 * 월 단위 화면(월마감/월간 대시보드/그래프 리포트)은 같은 하루를 여러 집계 경로가 중복 조회한다.
 * 이 프록시는 한 번의 요청 안에서 동일한 (모델, 조회 메서드, 인자) 조합을 한 번만 DB로 보내고
 * 같은 Promise 를 돌려준다. 쓰기 메서드는 그대로 통과시키고, 실패한 조회는 캐시에서 지워
 * 재시도가 가능하게 둔다. 반환 레코드는 호출자끼리 공유되므로 변형하면 안 된다.
 */
export function memoizePrismaReads<T extends object>(client: T): T {
  const promises = new Map<string, Promise<unknown>>();
  const delegates = new Map<PropertyKey, unknown>();

  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || property.startsWith("$") || !value || typeof value !== "object") {
        return typeof value === "function" ? value.bind(target) : value;
      }

      const existingDelegate = delegates.get(property);
      if (existingDelegate) return existingDelegate;

      const delegate = new Proxy(value, {
        get(delegateTarget, method, delegateReceiver) {
          const delegateValue = Reflect.get(delegateTarget, method, delegateReceiver);
          if (typeof method !== "string" || typeof delegateValue !== "function") return delegateValue;
          if (!MEMOIZED_READ_METHODS.has(method)) return delegateValue.bind(delegateTarget);

          return (args?: unknown) => {
            const key = readCacheKey(property, method, args);
            const existing = promises.get(key);
            if (existing) return existing;

            const promise = Promise.resolve(delegateValue.call(delegateTarget, args));
            promises.set(key, promise);
            promise.catch(() => promises.delete(key));
            return promise;
          };
        }
      });
      delegates.set(property, delegate);
      return delegate;
    }
  });
}
