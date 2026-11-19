import type { MetadataRoute } from "next";
import { env } from "@/shared/config/env";

export default function robots(): MetadataRoute.Robots {
  if (env.APP_ENV === "staging") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/account", "/admin", "/checkout", "/api"] },
    sitemap: `${env.APP_URL}/sitemap.xml`,
  };
}
