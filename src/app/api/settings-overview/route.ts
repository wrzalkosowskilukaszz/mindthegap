import { api } from "@/server/http";
import { systemStatus } from "@/server/services/status";
import { getSettings } from "@/server/settings";

export const GET = api(async () => ({
  status: await systemStatus(),
  freshness: await getSettings("freshness"),
  outreach: await getSettings("outreach"),
  privacy: await getSettings("privacy"),
  discovery: await getSettings("discovery"),
}));
