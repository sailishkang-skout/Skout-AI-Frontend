/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.platform === "win32" ? undefined : "standalone",
  reactStrictMode: true,
  env: {
    // Production behind the shared ALB uses relative /api/* (same origin, no CORS).
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ??
      (process.env.NODE_ENV === "production" ? "" : "http://localhost:3001"),
  },
};

export default nextConfig;
