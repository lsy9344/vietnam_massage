export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      fieldErrors?: Record<string, string[]>;
      formError?: string;
      domainErrorCode?: string;
    };
