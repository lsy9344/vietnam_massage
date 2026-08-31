import assert from "node:assert/strict";
import test from "node:test";
import { hash, verify } from "./password-hash";

const LEGACY_NODE_RS_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$cvBCM89AprraB5GwHu66fQ$mDEGL6QmeuNOo+hzRhqODSpweXiEzTwkwJ+Oa+Es8hw";
const LEGACY_TEST_PASSWORD = "stage-0-legacy-password";

test("WASM argon2 verifies an existing @node-rs/argon2 PHC hash", async () => {
  assert.equal(await verify(LEGACY_NODE_RS_HASH, LEGACY_TEST_PASSWORD), true);
  assert.equal(await verify(LEGACY_NODE_RS_HASH, "wrong-password"), false);
});

test("WASM argon2 keeps the existing argon2id parameters", async () => {
  const passwordHash = await hash("new-test-password", {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  assert.match(passwordHash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await verify(passwordHash, "new-test-password"), true);
});

test("WASM argon2 rejects unsupported algorithms", async () => {
  await assert.rejects(() => hash("test-password", { algorithm: 1 }), /argon2id/);
});
