import { withTransaction } from "@/shared/db/transaction";
import { AppError } from "@/shared/errors";
import * as activityService from "@/features/activity/activity.service";
import {
  ANNOUNCEMENT_JOBS_PER_PAGE,
  ANNOUNCEMENT_MESSAGES,
  NO_CUSTOMER_MESSAGE,
} from "@/features/notifications/announcement.constants";
import type {
  AnnouncementInput,
  AnnouncementJobPageDTO,
  AnnouncementJobRowDTO,
} from "@/features/notifications/announcement.types";
import { createAnnouncementJob } from "@/features/notifications/notification-job.service";
import type { NotificationJobRecord } from "@/features/notifications/notification-job.model";
import * as notificationJobRepository from "@/features/notifications/notification-job.repository";
import { getThemeForAdmin, listThemeOptionsForAdmin } from "@/features/themes/theme.service";
import { findCustomerByEmail, getUserSummaries } from "@/features/users/user.service";

// Finds the customer of an "one_customer" announcement. INVALID when there is none.
async function findAudienceUserId(customerEmail: string | null): Promise<string> {
  const customer = customerEmail === null ? null : await findCustomerByEmail(customerEmail);
  if (!customer) throw new AppError("INVALID", NO_CUSTOMER_MESSAGE);
  return customer.id;
}

// Queues an announcement (D-112). Nothing is sent here: the cron route processes the job in batches (D-116).
export async function sendAnnouncement(input: AnnouncementInput, adminUserId: string): Promise<{ id: string }> {
  let audienceThemeId: string | null = null;
  let audienceUserId: string | null = null;
  if (input.audience === "theme_owners") {
    const theme = input.themeId === null ? null : await getThemeForAdmin(input.themeId);
    if (!theme) throw new AppError("INVALID", ANNOUNCEMENT_MESSAGES.theme);
    audienceThemeId = theme.id;
  }
  if (input.audience === "one_customer") audienceUserId = await findAudienceUserId(input.customerEmail);

  return withTransaction(async (session) => {
    const job = await createAnnouncementJob(
      {
        title: input.title,
        body: input.body,
        link: input.link,
        sendEmail: input.sendEmail,
        audience: input.audience,
        audienceThemeId,
        audienceUserId,
        createdByUserId: adminUserId,
      },
      session,
    );
    await activityService.log(
      {
        action: "announcement_sent",
        actorRole: "admin",
        actorUserId: adminUserId,
        subjectUserId: audienceUserId,
        targetType: "notification_job",
        targetId: job.id,
        summary: `Announcement sent: ${input.title}`,
      },
      session,
    );
    return job;
  });
}

type AudienceNames = { themeNames: Map<string, string>; customerEmails: Map<string, string> };

function audienceLabelOf(job: NotificationJobRecord, names: AudienceNames): string {
  const { audienceThemeId, audienceUserId } = job.announcement;
  if (job.announcement.audience === "theme_owners" && audienceThemeId) {
    return `Owners of ${names.themeNames.get(audienceThemeId.toString()) ?? "a theme"}`;
  }
  if (job.announcement.audience === "one_customer" && audienceUserId) {
    return names.customerEmails.get(audienceUserId.toString()) ?? "One customer";
  }
  return ANNOUNCEMENT_MESSAGES.allCustomersLabel;
}

function toAnnouncementJobRowDTO(job: NotificationJobRecord, names: AudienceNames): AnnouncementJobRowDTO {
  return {
    id: job._id.toString(),
    createdAt: job.createdAt,
    title: job.announcement.title ?? "",
    audienceLabel: audienceLabelOf(job, names),
    status: job.status,
    notifiedCount: job.notifiedCount,
    emailedCount: job.emailedCount,
    error: job.status === "failed" ? (job.error ?? null) : null,
  };
}

// One page of the announcement jobs, newest first.
export async function listAnnouncementJobs(page: number): Promise<AnnouncementJobPageDTO> {
  const pageNumber = Math.max(1, page);
  const [jobs, total] = await Promise.all([
    notificationJobRepository.findAnnouncementJobsPage(pageNumber, ANNOUNCEMENT_JOBS_PER_PAGE),
    notificationJobRepository.countAnnouncementJobs(),
  ]);
  const customerIds = jobs.flatMap((job) =>
    job.announcement.audienceUserId ? [job.announcement.audienceUserId.toString()] : [],
  );
  const [themes, customers] = await Promise.all([listThemeOptionsForAdmin(), getUserSummaries(customerIds)]);
  const names: AudienceNames = {
    themeNames: new Map(themes.map((theme) => [theme.id, theme.name])),
    customerEmails: new Map(customers.map((customer) => [customer.id, customer.email])),
  };
  return {
    items: jobs.map((job) => toAnnouncementJobRowDTO(job, names)),
    page: pageNumber,
    totalPages: Math.ceil(total / ANNOUNCEMENT_JOBS_PER_PAGE),
    total,
  };
}
