import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const isCloudflareBuild = process.env.CLOUDFLARE_BUILD === "1";

if (isCloudflareBuild) {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  ...(process.env.VERCEL === "1"
    ? {}
    : {
        outputFileTracingIncludes: {
          "**/*": ["./node_modules/pg-cloudflare/dist/**", "./node_modules/pg-cloudflare/esm/**"]
        }
      }),
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  turbopack: {
    root: process.cwd(),
    resolveAlias: isCloudflareBuild
      ? {
          "@node-rs/argon2": "./src/lib/node-rs-argon2-cloudflare-stub.ts"
        }
      : {}
  }
};

export default nextConfig;
