import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { CategoryModel } from "@/features/categories/category.model";
import { CouponModel } from "@/features/coupons/coupon.model";
import { DownloadLogModel } from "@/features/downloads/download-log.model";
import { FavoriteModel } from "@/features/favorites/favorite.model";
import { FeedbackModel } from "@/features/feedback/feedback.model";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";
import { NotificationModel } from "@/features/notifications/notification.model";
import { OrderModel } from "@/features/orders/order.model";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import { WebhookEventModel } from "@/features/payments/webhook-event.model";
import { SettingsModel } from "@/features/settings/settings.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { UserModel } from "@/features/users/user.model";
import { VersionModel } from "@/features/versions/version.model";
import { WalletPaymentModel } from "@/features/wallet-payments/wallet-payment.model";

type ModelToBuild = {
  collection: { collectionName: string };
  createCollection(): Promise<unknown>;
  syncIndexes(): Promise<unknown>;
};

// Every Mongoose model of the app, listed only so that ensureDatabase can build them (docs/11 section 7).
// Ordered by file path.
export const ALL_MODELS: ModelToBuild[] = [
  ActivityLogModel,
  CategoryModel,
  CouponModel,
  DownloadLogModel,
  FavoriteModel,
  FeedbackModel,
  NotificationJobModel,
  NotificationModel,
  OrderModel,
  OwnershipModel,
  WebhookEventModel,
  SettingsModel,
  ThemeModel,
  UserModel,
  VersionModel,
  WalletPaymentModel,
];
