import { api } from "@/server/http";
import { discoveryStatus } from "@/server/services/discovery-status";

export const GET = api(async () => discoveryStatus());
