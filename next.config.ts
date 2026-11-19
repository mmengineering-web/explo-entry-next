import type { NextConfig } from "next";

// Static export: the app is a client-side, offline-first PWA, so there is no server to run.
// EXP_STUB=1 builds a test copy (out-test/) whose Supabase client is a local fake; never deploy that build.
const stub = process.env.EXP_STUB === "1";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  ...(stub ? { distDir: "out-test" } : {}),
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
    ...(stub ? { resolveAlias: { "@supabase/supabase-js": "./tests/stub_supabase.mjs" } } : {}),
  },
};

export default nextConfig;
