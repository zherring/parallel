import type { NextConfig } from "next";

// Cache Components is deliberately off: the /p/[people] page must answer with real
// 307/404 statuses (redirect/notFound before streaming), and TMDB caching uses
// fetch `next.revalidate`. Don't add a loading.tsx above that route for the same reason.
const nextConfig: NextConfig = {
  // Browser tests use Next's fetch proxy with deterministic fixtures, never real TMDB data.
  // Keep their build cache and proxy separate from the normal dev/production server.
  distDir: process.env.PLAYWRIGHT_TEST === "1" ? ".next-playwright" : ".next",
  experimental: { testProxy: process.env.PLAYWRIGHT_TEST === "1" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
