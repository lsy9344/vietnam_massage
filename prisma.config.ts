import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma migrate deploy`는 GitHub Actions에서 PlanetScale의 직접(non-pooled)
// DIRECT_DATABASE_URL을 주입해 실행한다. Vercel Preview는 운영 DB 비밀값을 받지 않고
// `prisma generate`와 Next.js 빌드만 수행하므로, 그때만 사용되는 연결 불가능한 로컬 URL로 폴백한다.
const datasourceUrl =
  process.env.DIRECT_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/vietnam_aesthetic";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: datasourceUrl
  }
});
