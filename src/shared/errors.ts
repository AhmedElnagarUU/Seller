export const APP_ERROR_CODES = ["NOT_FOUND", "FORBIDDEN", "CONFLICT", "INVALID", "RATE_LIMITED"] as const;
export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
