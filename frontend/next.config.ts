import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the LAN address used during development to load Next.js dev
  // resources (client bundles, HMR). Next.js blocks cross-origin /_next/*
  // requests by default, which prevents the app from hydrating when it is
  // accessed via 192.168.1.12 instead of localhost.
  allowedDevOrigins: ["192.168.1.12"],
};

export default nextConfig;
