import type { NextConfig } from "next";

const nextConfig: NextConfig = process.env.CAP_BUILD === "1"
  ? { output: "export", images: { unoptimized: true }, trailingSlash: true }
  : {};

export default nextConfig;
