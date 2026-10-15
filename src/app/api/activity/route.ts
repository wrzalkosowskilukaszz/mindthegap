import { api, searchParams } from "@/server/http";
import { activityMetrics } from "@/server/services/activity";

export const GET = api(async (req) => {
  const sp = searchParams(req);
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(to.getTime() - 30 * 86_400_000);
  return activityMetrics(from, to);
});
