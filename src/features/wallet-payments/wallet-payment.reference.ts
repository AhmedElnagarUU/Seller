import { randomInt } from "node:crypto";
import {
  REFERENCE_ALPHABET,
  REFERENCE_LENGTH,
  REFERENCE_PREFIX,
} from "@/features/wallet-payments/wallet-payment.constants";

// A reference code like "TS-K7M2QX" (docs/06-payments.md section 7.3). No 0, O, 1 or I: they are easy to mix up.
export function generateReferenceCode(): string {
  let code = REFERENCE_PREFIX;
  for (let index = 0; index < REFERENCE_LENGTH; index += 1) {
    code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  }
  return code;
}
