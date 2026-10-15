import { jobPrompt } from "@/server/careers/service";
import { api } from "@/server/http";

export const POST = api<{ id: string }>(async (_req, { params }) => ({ prompt: await jobPrompt(params.id) }));
