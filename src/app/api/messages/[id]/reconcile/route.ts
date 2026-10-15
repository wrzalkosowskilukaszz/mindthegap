import { api } from "@/server/http";
import { reconcile } from "@/server/gmail/dispatch";

export const POST = api<{ id: string }>(async (_req, { params }) => reconcile(params.id));
