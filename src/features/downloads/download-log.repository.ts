import { connectDB } from "@/shared/db/connect";
import { toObjectId } from "@/shared/db/ids";
import { DownloadLogModel } from "@/features/downloads/download-log.model";

type DownloadLogFields = { userId: string; themeId: string; versionId: string; createdAt: Date };

// Inserts one row. The service gives `createdAt` so the clock of the tests works.
export async function insertDownloadLog(fields: DownloadLogFields): Promise<void> {
  await connectDB();
  await DownloadLogModel.create({
    userId: toObjectId(fields.userId),
    themeId: toObjectId(fields.themeId),
    versionId: toObjectId(fields.versionId),
    createdAt: fields.createdAt,
  });
}

// Counts the downloads of a user after a moment (the moment itself is not counted).
export async function countDownloadLogsForUserSince(userId: string, since: Date): Promise<number> {
  await connectDB();
  return DownloadLogModel.countDocuments({ userId: toObjectId(userId), createdAt: { $gt: since } });
}
