import type { NextConfig } from "next";
import { env } from "./src/shared/config/env";

const imagesBaseUrl = new URL(env.PUBLIC_IMAGES_BASE_URL);
const imagesPath = imagesBaseUrl.pathname.replace(/\/$/, "");

// Locally and in CI the images come from MinIO on localhost, a private address that Next.js refuses by default (Q-010).
const allowsLocalImages = env.APP_ENV === "local" || env.APP_ENV === "ci";

const nextConfig: NextConfig = {
  output: "standalone",
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
