import { checkJobLink } from "@/server/careers/service";
import { api } from "@/server/http";

/** Opens the offer's link now and says whether the ad is still live. */
export const POST = api<{ id: string }>(async (_req, { params }) => checkJobLink(params.id));
