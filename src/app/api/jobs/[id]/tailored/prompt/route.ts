import { tailoredCvPrompt } from "@/server/careers/service";
import { api } from "@/server/http";

export const POST = api<{ id: string }>(async (_req, { params }) => ({
  prompt: await tailoredCvPrompt(params.id),
}));
