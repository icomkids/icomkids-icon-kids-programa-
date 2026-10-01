import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: { webpackBuildWorker: false, workerThreads: true, cpus: 1, useTypeScriptCli: false },
};

export default nextConfig;
