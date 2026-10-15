/** The email signature, shared by the server (sending) and the browser (preview). */
export type SignatureFields = {
  senderName: string;
  senderRole: string;
  senderRoleEn?: string;
  businessName: string;
  website: string;
  signaturePl: string;
  signatureEn: string;
};

/**
 * Your own signature text for this language when you wrote one; otherwise built from your name,
 * position, company and website, so filling those fields is enough.
 */
export function signatureFor(p: SignatureFields, language: "pl" | "en"): { text: string; auto: boolean } {
  const own = (language === "pl" ? p.signaturePl : p.signatureEn).trim();
  if (own) return { text: own, auto: false };
  // English emails use the English job title when there is one.
  const title = language === "en" && p.senderRoleEn?.trim() ? p.senderRoleEn.trim() : p.senderRole.trim();
  const role = [title, p.businessName.trim()].filter(Boolean).join(" · ");
  const site = p.website.trim().replace(/\/$/, "");
  return { text: [p.senderName.trim(), role, site].filter(Boolean).join("\n"), auto: true };
}
