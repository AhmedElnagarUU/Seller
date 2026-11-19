import { handleNotificationCron } from "@/features/notifications/notification-cron.handler";

export async function POST(request: Request) {
  return handleNotificationCron(request);
}
