import { api } from "@/server/http";
import { verifyContactNow } from "@/server/discovery/verify";

export const POST = api<{ id: string }>(async (_req, { params }) => verifyContactNow(params.id));
