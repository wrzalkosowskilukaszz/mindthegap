import { describe, expect, it } from "vitest";
import type { MetaMessage } from "./api.ts";
import { classifyInbound } from "./sync.ts";

const msg = (headers: Record<string, string>): MetaMessage => ({
  id: "1",
  threadId: "t",
  payload: { headers: Object.entries(headers).map(([name, value]) => ({ name, value })) },
});

describe("inbound classification", () => {
  it("detects bounces", () => {
    expect(
      classifyInbound(
        msg({
          From: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
          Subject: "Delivery Status Notification (Failure)",
        }),
      ),
    ).toBe("bounce");
    expect(
      classifyInbound(
        msg({ From: "postmaster@firma.pl", "Content-Type": "multipart/report; report-type=delivery-status" }),
      ),
    ).toBe("bounce");
  });
  it("detects automatic replies", () => {
    expect(
      classifyInbound(msg({ From: "anna@firma.pl", "Auto-Submitted": "auto-replied", Subject: "Re: x" })),
    ).toBe("auto_reply");
    expect(classifyInbound(msg({ From: "anna@firma.pl", Subject: "Odpowiedź automatyczna: Re: x" }))).toBe(
      "auto_reply",
    );
    expect(classifyInbound(msg({ From: "anna@firma.pl", Subject: "Out of Office" }))).toBe("auto_reply");
  });
  it("treats everything else as a human reply", () => {
    expect(
      classifyInbound(
        msg({ From: "Anna <anna@firma.pl>", Subject: "Re: Menedżerowie", "Auto-Submitted": "no" }),
      ),
    ).toBe("human_reply");
  });
});
