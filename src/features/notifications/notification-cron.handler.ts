import { timingSafeEqual } from "node:crypto";
import { env } from "@/shared/config/env";
import { processNotificationJobs } from "@/features/notifications/notification-job.processor";

// True when the Authorization header is "Bearer <CRON_SECRET>". Different lengths are not equal.
function isAuthorized(request: Request): boolean {
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// The cron route (docs/09-emails.md section 5.1): runs the notification jobs when the secret is right.
export async function handleNotificationCron(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return new Response(null, { status: 401 });
  try {
    const result = await processNotificationJobs();
    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error("notification cron failed", error);
    return new Response(null, { status: 500 });
  }
}
