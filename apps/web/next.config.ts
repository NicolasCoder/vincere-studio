import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "node:path";

// Um único .env na raiz do monorepo alimenta web, worker e Prisma.
config({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@vincere-studio/ui", "@vincere-studio/core", "@vincere-studio/db", "@vincere-studio/providers", "@vincere-studio/render"],
  serverExternalPackages: ["@prisma/client"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
