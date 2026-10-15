/** RFC 5322 message building (plain text + attachments) via nodemailer's MailComposer. */
import MailComposer from "nodemailer/lib/mail-composer/index.js";

export type MimeInput = {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  text: string;
  messageId: string; // "<...@...>"
  inReplyTo?: string | null;
  references?: string[];
  attachments?: { filename: string; contentType: string; content: Buffer }[];
};

export async function buildRaw(input: MimeInput): Promise<string> {
  const mail = new MailComposer({
    from: input.fromName ? { name: input.fromName, address: input.fromEmail } : input.fromEmail,
    to: input.to,
    subject: input.subject,
    text: input.text,
    messageId: input.messageId,
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references?.length ? input.references : undefined,
    attachments: (input.attachments ?? []).map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      content: a.content,
    })),
    textEncoding: "quoted-printable",
    headers: { "X-Mailer": "Mind the Gap Outreach Studio" },
  });
  const buf: Buffer = await new Promise((resolve, reject) =>
    mail.compile().build((err: Error | null, msg: Buffer) => (err ? reject(err) : resolve(msg))),
  );
  return buf.toString("base64url");
}

export function newMessageId(domain: string): string {
  const id = `${Date.now().toString(36)}.${crypto.randomUUID()}`;
  return `<mtg.${id}@${domain}>`;
}
