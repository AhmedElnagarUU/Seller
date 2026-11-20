import type { NextConfig } from "next";
import { env } from "./src/shared/config/env";
import { securityHeaders } from "./src/shared/config/security-headers";

const imagesBaseUrl = new URL(env.PUBLIC_IMAGES_BASE_URL);
const imagesPath = imagesBaseUrl.pathname.replace(/\/$/, "");

// Locally and in CI the images come from MinIO on localhost, a private address that Next.js refuses by default (Q-010).
const allowsLocalImages = env.APP_ENV === "local" || env.APP_ENV === "ci";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(env.APP_ENV) }];
  },
  images: {
    dangerouslyAllowLocalIP: allowsLocalImages,
    remotePatterns: [
      {
        protocol: imagesBaseUrl.protocol === "https:" ? "https" : "http",
        hostname: imagesBaseUrl.hostname,
        port: imagesBaseUrl.port,
        pathname: `${imagesPath}/**`,
      },
    ],
  },
};

export default nextConfig;
