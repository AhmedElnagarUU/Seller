import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/shared/config/env";

// The ONLY file that imports @aws-sdk/* (docs/07-delivery-updates.md section 2.1).
// It never sets an ACL (D-055) and never logs signed URLs.

export type StorageBucket = "private" | "public";
export type PresignedUpload = { key: string; url: string; headers: Record<string, string> };
export type StoredObjectInfo = { sizeBytes: number; contentType: string };

const NOT_FOUND_STATUS = 404;
const FIRST_BYTES_COUNT = 4;

let client: S3Client | null = null;

// One client, created on first use.
function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    // Required: without these two lines new SDK versions add checksum parameters to presigned URLs
    // that the browser cannot send, and uploads to R2 fail.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

function bucketName(bucket: StorageBucket): string {
  return bucket === "private" ? env.S3_PRIVATE_BUCKET : env.S3_PUBLIC_BUCKET;
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("name" in error && error.name === "NotFound") return true;
  if (!("$metadata" in error) || typeof error.$metadata !== "object" || error.$metadata === null) return false;
  return "httpStatusCode" in error.$metadata && error.$metadata.httpStatusCode === NOT_FOUND_STATUS;
}

// Presigned PUT. The URL only works for exactly this content type and size.
export async function createUploadUrl(input: {
  bucket: StorageBucket;
  key: string;
  contentType: string;
  sizeBytes: number;
  cacheControl: string | null;
  expiresInSeconds: number;
}): Promise<PresignedUpload> {
  const signableHeaders = new Set(["content-type", "content-length"]);
  const headers: Record<string, string> = { "Content-Type": input.contentType };
  if (input.cacheControl !== null) {
    signableHeaders.add("cache-control");
    headers["Cache-Control"] = input.cacheControl;
  }
  const command = new PutObjectCommand({
    Bucket: bucketName(input.bucket),
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
    CacheControl: input.cacheControl ?? undefined,
  });
  const url = await getSignedUrl(getClient(), command, { expiresIn: input.expiresInSeconds, signableHeaders });
  // Never Content-Length: the browser sets it itself.
  return { key: input.key, url, headers };
}

// Presigned GET on the PRIVATE bucket. downloadFileName → "attachment; filename=..."; null → shown inline.
export async function createDownloadUrl(input: {
  key: string;
  expiresInSeconds: number;
  downloadFileName: string | null;
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName("private"),
    Key: input.key,
    ResponseContentDisposition:
      input.downloadFileName !== null ? `attachment; filename="${input.downloadFileName}"` : undefined,
  });
  return getSignedUrl(getClient(), command, { expiresIn: input.expiresInSeconds });
}

// null when the object does not exist (404). Any other error is thrown.
export async function headObject(input: { bucket: StorageBucket; key: string }): Promise<StoredObjectInfo | null> {
  try {
    const response = await getClient().send(
      new HeadObjectCommand({ Bucket: bucketName(input.bucket), Key: input.key }),
    );
    return { sizeBytes: response.ContentLength ?? 0, contentType: response.ContentType ?? "" };
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

// Streams the object (never loads it all into memory). Returns the lowercase hex SHA-256
// and the first 4 bytes as lowercase hex (a zip starts with "504b0304").
export async function hashObject(input: {
  bucket: StorageBucket;
  key: string;
}): Promise<{ sha256: string; firstBytesHex: string }> {
  const response = await getClient().send(new GetObjectCommand({ Bucket: bucketName(input.bucket), Key: input.key }));
  const body = response.Body;
  if (!(body instanceof Readable)) throw new Error("STORAGE_BODY_NOT_STREAM");
  const hash = createHash("sha256");
  let firstBytes = Buffer.alloc(0);
  for await (const chunk of body) {
    const bytes = Buffer.from(chunk);
    if (firstBytes.length < FIRST_BYTES_COUNT) {
      firstBytes = Buffer.concat([firstBytes, bytes]).subarray(0, FIRST_BYTES_COUNT);
    }
    hash.update(bytes);
  }
  return { sha256: hash.digest("hex"), firstBytesHex: firstBytes.toString("hex") };
}

export async function deleteObject(input: { bucket: StorageBucket; key: string }): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucketName(input.bucket), Key: input.key }));
}
