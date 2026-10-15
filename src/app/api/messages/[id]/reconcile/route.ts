import { reconcile } from "@/server/gmail/dispatch";
import { api } from "@/server/http";

export const POST = api<{ id: string }>(async (_req, { params }) => reconcile(params.id));
