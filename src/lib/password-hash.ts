import { argon2id, argon2Verify } from "argon2-wasm-edge";

const ARGON2ID_ALGORITHM = 2;
const ARGON2ID_MEMORY_COST_KIB = 19456;
const ARGON2ID_TIME_COST = 2;
const ARGON2ID_PARALLELISM = 1;
const ARGON2ID_HASH_LENGTH = 32;
const ARGON2ID_SALT_LENGTH = 16;

type LegacyArgon2Options = {
  algorithm?: number;
  memoryCost?: number;
  timeCost?: number;
  parallelism?: number;
};

type Argon2Runtime = {
  argon2id: typeof argon2id;
  argon2Verify: typeof argon2Verify;
};

type GlobalWithArgon2Runtime = typeof globalThis & {
  __CLOUDFLARE_ARGON2_RUNTIME__?: Argon2Runtime;
};

function getArgon2Runtime(): Argon2Runtime {
  return (globalThis as GlobalWithArgon2Runtime).__CLOUDFLARE_ARGON2_RUNTIME__ ?? {
    argon2id,
    argon2Verify
  };
}

function createSalt() {
  const salt = new Uint8Array(ARGON2ID_SALT_LENGTH);
  globalThis.crypto.getRandomValues(salt);
  return salt;
}

export async function hash(secret: string, options: LegacyArgon2Options = {}) {
  const algorithm = options.algorithm ?? ARGON2ID_ALGORITHM;
  if (algorithm !== ARGON2ID_ALGORITHM) {
    throw new Error("argon2id만 지원합니다.");
  }

  return getArgon2Runtime().argon2id({
    password: secret,
    salt: createSalt(),
    memorySize: options.memoryCost ?? ARGON2ID_MEMORY_COST_KIB,
    iterations: options.timeCost ?? ARGON2ID_TIME_COST,
    parallelism: options.parallelism ?? ARGON2ID_PARALLELISM,
    hashLength: ARGON2ID_HASH_LENGTH,
    outputType: "encoded"
  });
}

export async function verify(passwordHash: string, secret: string) {
  return getArgon2Runtime().argon2Verify({
    hash: passwordHash,
    password: secret
  });
}
