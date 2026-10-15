import { api } from "@/server/http";
import { syncReplies } from "@/server/gmail/sync";

export const maxDuration = 120;
export const POST = api(async () => syncReplies());
