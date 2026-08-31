function unavailable(): never {
  throw new Error("Cloudflare Workers에서는 네이티브 Argon2를 사용할 수 없습니다.");
}

export async function hash(): Promise<string> {
  return unavailable();
}

export async function verify(): Promise<boolean> {
  return unavailable();
}
