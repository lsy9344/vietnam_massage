import path from "node:path";
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
        },
        outputFileTracingExcludes: isCloudflareBuild
          ? {
              "**/*": [
                "node_modules/@node-rs/**",
                "**/@node-rs/**"
              ]
            }
          : {}
      }),
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  transpilePackages: isCloudflareBuild ? ["@node-rs/argon2"] : [],
  webpack: (config) => {
    if (isCloudflareBuild) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias,
        "@node-rs/argon2": path.resolve(process.cwd(), "src/lib/node-rs-argon2-cloudflare-stub.js")
      };
    }
    return config;
  },
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
