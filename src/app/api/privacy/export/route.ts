import { db } from "@/server/db/client";
import {
  companies,
  contactEvidence,
  contacts,
  inboundMessages,
  messages,
  suppressions,
} from "@/server/db/schema";
import { api } from "@/server/http";

/** Full export of the owner's data (without uploaded files) for portability and backups. */
export const GET = api(async () => {
  const data = {
    exportedAt: new Date().toISOString(),
    companies: await db().select().from(companies),
    contacts: await db().select().from(contacts),
    evidence: await db().select().from(contactEvidence),
    messages: await db().select().from(messages),
    inbound: await db().select().from(inboundMessages),
    suppressions: await db().select().from(suppressions),
  };
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="outreach-studio-export-${data.exportedAt.slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
});
