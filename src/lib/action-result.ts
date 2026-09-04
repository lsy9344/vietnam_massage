export type ActionResult<T> =
  | { ok: true; data: T; notice?: string }
  | {
      ok: false;
      fieldErrors?: Record<string, string[]>;
      formError?: string;
      domainErrorCode?: string;
    };
