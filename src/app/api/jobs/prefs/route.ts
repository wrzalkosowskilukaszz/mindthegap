import { z } from "zod";
import { savePrefs } from "@/server/careers/service";
import { api, parseBody } from "@/server/http";

export const PUT = api(async (req) => {
  const b = await parseBody(
    req,
    z
      .object({
        roleFamilies: z.array(z.enum(["learning", "people", "coaching", "creative"])),
        locations: z.array(z.enum(["warsaw", "remote_poland", "eu_relocation", "poland_other"])),
        languages: z.array(z.string().max(5)),
        workTypes: z.array(z.enum(["full_time", "freelance", "part_time"])),
        extraKeywords: z.array(z.string().trim().min(1).max(60)).max(60),
        excludeKeywords: z.array(z.string().trim().min(1).max(60)).max(60),
        cvKeywords: z.array(z.string().trim().min(1).max(60)).max(60),
        showFrom: z.number().int().min(0).max(100),
      })
      .partial(),
  );
  await savePrefs(b);
  return { ok: true };
});
