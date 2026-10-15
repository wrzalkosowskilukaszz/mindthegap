import { syncReplies } from "@/server/gmail/sync";
import { api } from "@/server/http";

export const maxDuration = 120;
export const POST = api(async () => syncReplies());
