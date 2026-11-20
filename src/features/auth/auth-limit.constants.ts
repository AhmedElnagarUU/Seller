// The limits of D-150 (docs/03-data-model.md section 20).
export const AUTH_ATTEMPT_KINDS = ["login_failed", "auth_email"] as const;
export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILED_LOGINS_PER_EMAIL_AND_IP = 5;
export const MAX_FAILED_LOGINS_PER_IP = 50;
export const AUTH_EMAIL_WINDOW_MINUTES = 60;
export const MAX_AUTH_EMAILS_PER_EMAIL = 3;
export const AUTH_ATTEMPT_RETENTION_SECONDS = 86_400;
