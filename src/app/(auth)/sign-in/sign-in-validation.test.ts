import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateSignIn } from "@/app/(auth)/sign-in/sign-in-validation";

describe("validateSignIn", () => {
  it("accepts an account and a password", () => {
    assert.deepEqual(validateSignIn({ identity: "lan_counter", password: "secret" }), {});
  });

  it("puts each missing value's message on its own field", () => {
    assert.deepEqual(validateSignIn({ identity: "", password: "" }), {
      identity: "auth.error.identityRequired",
      password: "auth.error.passwordRequired"
    });
  });

  it("treats an account made only of spaces as missing but keeps a password as typed", () => {
    assert.deepEqual(validateSignIn({ identity: "   ", password: " " }), { identity: "auth.error.identityRequired" });
  });
});
