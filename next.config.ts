import type { NextConfig } from "next";

// Cache Components is deliberately off: the /p/[people] page must answer with real
// 307/404 statuses (redirect/notFound before streaming), and TMDB caching uses
// fetch `next.revalidate`. Don't add a loading.tsx above that route for the same reason.
const nextConfig: NextConfig = {
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
