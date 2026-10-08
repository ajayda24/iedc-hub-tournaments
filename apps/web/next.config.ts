import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const revision = `${Date.now()}`;

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // registered by hand in src/pwa/RegisterSW.tsx, only on the online (https) site
  register: false,
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: ["/", "/practice/", "/play/", "/~offline/"].map((url) => ({ url, revision })),
});

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@iedc/shared", "@iedc/data"],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default withSerwist(nextConfig);
