import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma";

loadEnv({ override: !process.env.CI, quiet: true });

/**
 * 공유 E2E Prisma 클라이언트.
 *
 * Playwright는 spec 파일마다 별도 워커 프로세스에서 실행하므로 이 모듈은
 * 워커당 한 번 평가되어 워커별로 단일 PrismaClient 인스턴스를 제공한다.
 * 각 spec은 기존과 동일하게 afterAll에서 `prisma.$disconnect()`를 호출한다.
 */
const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vietnam_aesthetic";

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) } as any);
