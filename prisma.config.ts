import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrate(`prisma migrate deploy`)는 직접(non-pooled) 연결을 사용해야 한다.
// Neon에서는 DIRECT_DATABASE_URL(=Direct connection)을 쓰고,
// 미설정 환경(로컬 Docker)에서는 DATABASE_URL로 폴백한다.
// `env()` 헬퍼는 미설정 변수에 throw하므로 process.env로 직접 폴백을 처리한다.
const migrateUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!migrateUrl) {
  throw new Error("DIRECT_DATABASE_URL 또는 DATABASE_URL 중 하나는 설정되어야 합니다 (prisma migrate).");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: migrateUrl
  }
});
