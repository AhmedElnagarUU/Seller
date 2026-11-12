import { getCurrentUser } from "@/features/auth/session";
import { createDownloadLink } from "@/features/downloads/download.service";
import { DOWNLOAD_ERROR_PARAMS } from "@/features/downloads/download.constants";
import { AppError } from "@/shared/errors";
import { env } from "@/shared/config/env";

function redirectTo(path: string): Response {
  return Response.redirect(new URL(path, env.APP_URL), 302);
}

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const user = await getCurrentUser();
  if (!user) return redirectTo("/login?next=%2Faccount%2Fthemes");
  try {
    const { url } = await createDownloadLink({ userId: user.id, versionId });
    return Response.redirect(url, 302);
  } catch (err) {
    if (err instanceof AppError) return redirectTo(`/account/themes?downloadError=${DOWNLOAD_ERROR_PARAMS[err.code]}`);
    console.error("download failed", err);
    return redirectTo("/account/themes?downloadError=failed");
  }
}
