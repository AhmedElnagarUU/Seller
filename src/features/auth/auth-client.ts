"use client";

import { createAuthClient } from "better-auth/react";

// Browser client for Better Auth. No baseURL: the API is on the same origin.
export const authClient = createAuthClient();
