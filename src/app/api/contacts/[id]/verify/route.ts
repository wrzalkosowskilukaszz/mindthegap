import { verifyContactNow } from "@/server/discovery/verify";
import { api } from "@/server/http";

export const POST = api<{ id: string }>(async (_req, { params }) => verifyContactNow(params.id));
