"use client";

import { apiFetch } from "@/lib/api-client";

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Uploads a file as a new version of a document in 2 MB chunks (fits small serverless body limits). */
export async function uploadVersion(documentId: string, file: File, onProgress?: (p: number) => void) {
  const buf = await file.arrayBuffer();
  const v = await apiFetch<{ id: string; chunkCount: number; chunkBytes: number }>(
    `/api/documents/${documentId}/versions`,
    {
      body: {
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        sha256: await sha256Hex(buf),
      },
    },
  );
  for (let i = 0; i < v.chunkCount; i++) {
    const part = buf.slice(i * v.chunkBytes, (i + 1) * v.chunkBytes);
    const res = await fetch(`/api/versions/${v.id}/chunks/${i}`, {
      method: "PUT",
      body: part,
      headers: { "content-type": "application/octet-stream" },
    });
    if (!res.ok)
      throw new Error((await res.json().catch(() => ({}))).error ?? "Przesyłanie nie powiodło się");
    onProgress?.((i + 1) / v.chunkCount);
  }
  return apiFetch<{ id: string; extractionStatus: string; extractionError: string | null }>(
    `/api/versions/${v.id}/complete`,
    { body: {} },
  );
}
