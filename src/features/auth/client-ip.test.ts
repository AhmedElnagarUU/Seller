import { describe, expect, it } from "vitest";
import { readClientIp } from "@/features/auth/client-ip";

describe("readClientIp", () => {
  it('prefers cf-connecting-ip, then the first x-forwarded-for entry, else "unknown"', () => {
    const both = new Headers({ "cf-connecting-ip": " 1.2.3.4 ", "x-forwarded-for": "5.6.7.8" });
    expect(readClientIp(both)).toBe("1.2.3.4");
    expect(readClientIp(new Headers({ "x-forwarded-for": " 5.6.7.8 , 10.0.0.1" }))).toBe("5.6.7.8");
    expect(readClientIp(new Headers())).toBe("unknown");
    expect(readClientIp(new Headers({ "cf-connecting-ip": "", "x-forwarded-for": "" }))).toBe("unknown");
  });
});
