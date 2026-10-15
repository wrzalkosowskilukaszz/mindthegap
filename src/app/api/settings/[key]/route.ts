import { z } from "zod";
import { api, badRequest } from "@/server/http";
import { getSettings, SETTINGS, type SettingsKey, saveSettings } from "@/server/settings";

const Key = z.enum(Object.keys(SETTINGS) as [SettingsKey, ...SettingsKey[]]);

export const GET = api<{ key: string }>(async (_req, { params }) => getSettings(Key.parse(params.key)));

export const PUT = api<{ key: string }>(async (req, { params }) => {
  const key = Key.parse(params.key);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Oczekiwano JSON");
  }
  return saveSettings(key, body);
});
