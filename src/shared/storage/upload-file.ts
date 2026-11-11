import type { PresignedUpload } from "@/shared/storage/s3";

const PERCENT = 100;
const SUCCESS_MIN_STATUS = 200;
const SUCCESS_MAX_STATUS = 299;

// Browser only. PUTs a file to a presigned URL and reports progress as integers 0–100.
// XMLHttpRequest is used because fetch cannot report upload progress.
export async function uploadFile(
  upload: PresignedUpload,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const fail = () => reject(new Error("UPLOAD_FAILED"));
    request.open("PUT", upload.url);
    for (const [name, value] of Object.entries(upload.headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.round((event.loaded / event.total) * PERCENT));
    };
    request.onload = () => {
      const isSuccess = request.status >= SUCCESS_MIN_STATUS && request.status <= SUCCESS_MAX_STATUS;
      if (!isSuccess) return fail();
      onProgress(PERCENT);
      resolve();
    };
    request.onerror = fail;
    request.onabort = fail;
    onProgress(0);
    request.send(file);
  });
}
