import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "node:path";

// Um único .env na raiz do monorepo alimenta web, worker e Prisma.
config({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@docupulse/ui", "@docupulse/core", "@docupulse/db", "@docupulse/providers"],
  serverExternalPackages: ["@prisma/client"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
