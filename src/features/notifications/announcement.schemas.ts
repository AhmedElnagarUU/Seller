import { z } from "zod";
import { OBJECT_ID_PATTERN } from "@/features/themes/theme.constants";
import { ANNOUNCEMENT_MESSAGES, NO_CUSTOMER_MESSAGE } from "@/features/notifications/announcement.constants";
import type { AnnouncementInput } from "@/features/notifications/announcement.types";
import {
  ANNOUNCEMENT_AUDIENCES,
  INTERNAL_PATH_PATTERN,
  NOTIFICATION_BODY_MAX,
  NOTIFICATION_BODY_MIN,
  NOTIFICATION_LINK_MAX,
  NOTIFICATION_TITLE_MAX,
  NOTIFICATION_TITLE_MIN,
} from "@/features/notifications/notification.constants";

const linkField = z
  .string()
  .trim()
  .max(NOTIFICATION_LINK_MAX, ANNOUNCEMENT_MESSAGES.link)
  .refine((value) => value === "" || INTERNAL_PATH_PATTERN.test(value), ANNOUNCEMENT_MESSAGES.link)
  .transform((value) => (value === "" ? null : value));

const announcementFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(NOTIFICATION_TITLE_MIN, ANNOUNCEMENT_MESSAGES.titleLength)
    .max(NOTIFICATION_TITLE_MAX, ANNOUNCEMENT_MESSAGES.titleLength),
  body: z
    .string()
    .trim()
    .min(NOTIFICATION_BODY_MIN, ANNOUNCEMENT_MESSAGES.bodyLength)
    .max(NOTIFICATION_BODY_MAX, ANNOUNCEMENT_MESSAGES.bodyLength),
  link: linkField,
  audience: z.enum(ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_MESSAGES.audience),
  themeId: z.string().trim(),
  customerEmail: z.string().trim(),
  sendEmail: z.boolean(),
});

// The fields of the new announcement form. Fields that do not belong to the audience become null.
export const announcementInputSchema = announcementFieldsSchema
  .superRefine((fields, context) => {
    if (fields.audience === "theme_owners" && !OBJECT_ID_PATTERN.test(fields.themeId)) {
      context.addIssue({ code: "custom", path: ["themeId"], message: ANNOUNCEMENT_MESSAGES.theme });
    }
    if (fields.audience === "one_customer" && fields.customerEmail === "") {
      context.addIssue({ code: "custom", path: ["customerEmail"], message: NO_CUSTOMER_MESSAGE });
    }
  })
  .transform((fields): AnnouncementInput => ({
    title: fields.title,
    body: fields.body,
    link: fields.link,
    audience: fields.audience,
    themeId: fields.audience === "theme_owners" ? fields.themeId : null,
    customerEmail: fields.audience === "one_customer" ? fields.customerEmail : null,
    sendEmail: fields.sendEmail,
  }));
