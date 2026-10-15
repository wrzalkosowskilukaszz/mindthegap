import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashPassword, verifyPassword } from "./crypto.ts";

describe("crypto", () => {
  it("hashes and verifies passwords", () => {
    const h = hashPassword("correct horse battery");
    expect(h).not.toContain("$");
    expect(verifyPassword("correct horse battery", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
  it("encrypts secrets with authentication", () => {
    const enc = encryptSecret("refresh-token-123");
    expect(enc).not.toContain("refresh-token");
    expect(decryptSecret(enc)).toBe("refresh-token-123");
    const tampered = `${enc.slice(0, -2)}AA`;
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
