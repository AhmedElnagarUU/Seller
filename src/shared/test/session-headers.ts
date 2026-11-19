import { auth } from "@/features/auth/auth";

// Signs the user in with Better Auth and returns request headers that carry the session cookie.
// Each call creates a new session. Used only by tests.
export async function createSessionHeaders(email: string, password: string): Promise<Headers> {
  const { headers: responseHeaders } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = responseHeaders
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}
