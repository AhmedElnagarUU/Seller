import type { NextConfig } from "next";
import { env } from "./src/shared/config/env";

const imagesBaseUrl = new URL(env.PUBLIC_IMAGES_BASE_URL);
const imagesPath = imagesBaseUrl.pathname.replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
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
