import { createHmac } from "node:crypto";

// Headers of a webhook signed like Polar does it (Standard Webhooks, HMAC-SHA256). Test use only.
export function signPolarWebhook(input: {
  id: string;
  body: string;
  secret: string;
  timestampSeconds?: number;
}): Record<string, string> {
  const timestamp = input.timestampSeconds ?? Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", input.secret)
    .update(`${input.id}.${timestamp}.${input.body}`)
    .digest("base64");
  return {
    "webhook-id": input.id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": "v1," + signature,
  };
}
