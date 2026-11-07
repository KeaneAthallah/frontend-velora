import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Deployment target: `next build` also emits `.next/standalone`, which is
  // what the production image copies. `next dev` and `next start` still work.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
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
