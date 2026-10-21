function unavailable() {
  throw new Error("Cloudflare Workers에서는 네이티브 Argon2를 사용할 수 없습니다.");
}

export async function hash() {
  return unavailable();
}

export async function verify() {
  return unavailable();
}

export default { hash, verify };
