/**
 * Text extraction from uploaded materials. Reports honestly when a format is unsupported or
 * extraction is partial (e.g. a scanned PDF without a text layer).
 */
import JSZip from "jszip";

export type Extraction = {
  status: "ok" | "partial" | "unsupported" | "failed";
  text: string | null;
  error?: string;
  pages?: number;
};

export const SUPPORTED = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "text/plain": "TXT",
  "text/markdown": "MD",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
} as const;

export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function mimeFromName(filename: string, declared: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const byExt: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    md: "text/markdown",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    doc: "application/msword",
    ppt: "application/vnd.ms-powerpoint",
  };
  return byExt[ext] ?? declared ?? "application/octet-stream";
}

function clean(s: string): string {
  return s
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function pptxText(buf: Buffer): Promise<Extraction> {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  if (!slides.length) return { status: "failed", text: null, error: "Nie znaleziono slajdów w pliku PPTX." };
  const parts: string[] = [];
  for (const [i, name] of slides.entries()) {
    const xml = await zip.file(name)!.async("string");
    const paras = xml
      .split(/<\/a:p>/)
      .map((p) => [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1]!)).join(""));
    const text = paras.filter((p) => p.trim()).join("\n");
    if (text) parts.push(`[Slajd ${i + 1}]\n${text}`);
  }
  const text = clean(parts.join("\n\n"));
  return text
    ? { status: "ok", text, pages: slides.length }
    : {
        status: "partial",
        text: "",
        error: "Slajdy nie zawierają tekstu (np. same obrazy).",
        pages: slides.length,
      };
}

export async function extractText(buf: Buffer, mime: string): Promise<Extraction> {
  try {
    if (mime === "application/pdf") {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { totalPages, text } = await pdfText(pdf, { mergePages: true });
      const t = clean(Array.isArray(text) ? text.join("\n") : text);
      if (!t)
        return {
          status: "partial",
          text: "",
          error: "PDF nie ma warstwy tekstowej (np. skan). Wklej streszczenie ręcznie.",
          pages: totalPages,
        };
      if (t.length < totalPages * 40)
        return {
          status: "partial",
          text: t,
          error: "Wyodrębniono niewiele tekstu — część stron może być grafiką.",
          pages: totalPages,
        };
      return { status: "ok", text: t, pages: totalPages };
    }
    if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const mammoth = await import("mammoth");
      const r = await mammoth.extractRawText({ buffer: buf });
      const t = clean(r.value);
      return t
        ? {
            status: r.messages.length ? "partial" : "ok",
            text: t,
            error: r.messages.length
              ? r.messages
                  .map((m) => m.message)
                  .slice(0, 3)
                  .join("; ")
              : undefined,
          }
        : { status: "partial", text: "", error: "Dokument nie zawiera tekstu." };
    }
    if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation")
      return await pptxText(buf);
    if (mime === "text/plain" || mime === "text/markdown")
      return { status: "ok", text: clean(buf.toString("utf8")) };
    if (IMAGE_TYPES.has(mime)) {
      // Images (e.g. an offer as JPG) are attached as-is; Claude can read them when proposing a summary.
      return {
        status: "partial",
        text: null,
        error:
          "Obraz: tekst nie jest wyodrębniany. Streszczenie programu może przygotować AI na podstawie obrazu.",
      };
    }
    if (mime === "application/msword" || mime === "application/vnd.ms-powerpoint") {
      return {
        status: "unsupported",
        text: null,
        error: "Starsze formaty .doc/.ppt nie są obsługiwane — zapisz plik jako DOCX/PPTX lub PDF.",
      };
    }
    return {
      status: "unsupported",
      text: null,
      error: `Format ${mime} nie jest obsługiwany (PDF, DOCX, PPTX, TXT, JPG, PNG).`,
    };
  } catch (e) {
    return {
      status: "failed",
      text: null,
      error: `Błąd odczytu pliku: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`,
    };
  }
}
