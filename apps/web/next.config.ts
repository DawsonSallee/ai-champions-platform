import type { NextConfig } from "next";

const config: NextConfig = {
  // Self-contained build for App Service / containers — only ships the deps
  // the server actually uses, no node_modules tree to upload.
  output: "standalone",
  outputFileTracingRoot: process.cwd().includes("apps/web")
    ? undefined
    : `${process.cwd()}`,
  serverExternalPackages: [
    "postgres",
    "@electric-sql/pglite",
    "@react-pdf/renderer",
  ],
};

export default config;
