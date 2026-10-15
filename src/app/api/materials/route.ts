import { aiConfigured } from "@/server/ai/client";
import { api } from "@/server/http";
import { listLibrary } from "@/server/materials/service";
import { getSettings } from "@/server/settings";

export const GET = api(async () => ({
  ...(await listLibrary()),
  ai: aiConfigured(),
  profile: await getSettings("profile"),
}));
