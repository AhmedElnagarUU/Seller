import { env } from "@/shared/config/env";

// Public URL of an image in the public bucket. The database stores only the key (D-053).
export function publicImageUrl(key: string): string {
  return `${env.PUBLIC_IMAGES_BASE_URL}/${key}`;
}
