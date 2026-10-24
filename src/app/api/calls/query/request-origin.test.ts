import assert from "node:assert/strict";
import { it } from "node:test";
import { isSameOriginCallQuery } from "./request-origin";

it("compares the browser origin to the public request host when Next uses an internal URL", () => {
  assert.equal(isSameOriginCallQuery(new Request("http://localhost:3194/api/calls/query", {
    headers: { origin: "http://127.0.0.1:3194", host: "127.0.0.1:3194" }
  })), true);
  assert.equal(isSameOriginCallQuery(new Request("http://internal/api/calls/query", {
    headers: { origin: "https://preview.example.com", host: "internal", "x-forwarded-host": "preview.example.com" }
  })), true);
});

it("rejects missing, malformed, and cross-host origins", () => {
  for (const origin of [null, "null", "bad", "https://example.invalid", "https://preview.example.com.attacker.invalid"]) {
    const headers = new Headers({ host: "preview.example.com" });
    if (origin !== null) headers.set("origin", origin);
    assert.equal(isSameOriginCallQuery(new Request("https://preview.example.com/api/calls/query", { headers })), false);
  }
});
