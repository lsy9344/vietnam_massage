import type { Options as NativeArgon2Options } from "@node-rs/argon2";

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

type ResolvedArgon2Options = Required<LegacyArgon2Options>;

type CloudflareArgon2Runtime = {
  argon2id(input: {
    password: string;
    salt: Uint8Array;
    memorySize: number;
    iterations: number;
    parallelism: number;
    hashLength: number;
    outputType: "encoded";
  }): Promise<string>;
  argon2Verify(input: { hash: string; password: string }): Promise<boolean>;
};

type PasswordHashRuntime = {
  hash(secret: string, options: ResolvedArgon2Options): Promise<string>;
  verify(passwordHash: string, secret: string): Promise<boolean>;
};

type GlobalWithArgon2Runtime = typeof globalThis & {
  __CLOUDFLARE_ARGON2_RUNTIME__?: CloudflareArgon2Runtime;
};

let nativeRuntimePromise: Promise<PasswordHashRuntime> | undefined;

function createSalt() {
  const salt = new Uint8Array(ARGON2ID_SALT_LENGTH);
  globalThis.crypto.getRandomValues(salt);
  return salt;
}

async function getPasswordHashRuntime(): Promise<PasswordHashRuntime> {
  const cloudflareRuntime = (globalThis as GlobalWithArgon2Runtime).__CLOUDFLARE_ARGON2_RUNTIME__;
  if (cloudflareRuntime) {
    return {
      hash(secret, options) {
        return cloudflareRuntime.argon2id({
          password: secret,
          salt: createSalt(),
          memorySize: options.memoryCost,
          iterations: options.timeCost,
          parallelism: options.parallelism,
          hashLength: ARGON2ID_HASH_LENGTH,
          outputType: "encoded"
        });
      },
      verify(passwordHash, secret) {
        return cloudflareRuntime.argon2Verify({ hash: passwordHash, password: secret });
      }
    };
  }

  nativeRuntimePromise ??= import("@node-rs/argon2").then((nativeArgon2) => ({
    hash(secret, options) {
      return nativeArgon2.hash(secret, options as NativeArgon2Options);
    },
    verify(passwordHash, secret) {
      return nativeArgon2.verify(passwordHash, secret);
    }
  }));

  return nativeRuntimePromise;
}

export async function hash(secret: string, options: LegacyArgon2Options = {}) {
  const resolvedOptions: ResolvedArgon2Options = {
    algorithm: options.algorithm ?? ARGON2ID_ALGORITHM,
    memoryCost: options.memoryCost ?? ARGON2ID_MEMORY_COST_KIB,
    timeCost: options.timeCost ?? ARGON2ID_TIME_COST,
    parallelism: options.parallelism ?? ARGON2ID_PARALLELISM
  };

  if (resolvedOptions.algorithm !== ARGON2ID_ALGORITHM) {
    throw new Error("argon2id만 지원합니다.");
  }

  return (await getPasswordHashRuntime()).hash(secret, resolvedOptions);
}

export async function verify(passwordHash: string, secret: string) {
  return (await getPasswordHashRuntime()).verify(passwordHash, secret);
}
