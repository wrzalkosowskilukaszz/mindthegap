/** Turns job-ad HTML into plain text with paragraphs and bullets. The app never renders ad HTML. */
import * as cheerio from "cheerio";

export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  // Some feeds escape their HTML (Greenhouse); unescape once before parsing.
  const raw =
    /&lt;\/?[a-z]/i.test(html) && !/<\/?[a-z]/i.test(html)
      ? cheerio.load(`<x>${html}</x>`)("x").text()
      : html;
  const $ = cheerio.load(raw);
  $("script, style, noscript, iframe").remove();
  $("br").replaceWith("\n");
  $("li").each((_, el) => {
    $(el).prepend("• ");
    $(el).append("\n");
  });
  $("p, div, h1, h2, h3, h4, h5, h6, ul, ol, tr, section").each((_, el) => {
    $(el).append("\n\n");
  });
  return $.root()
    .text()
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 20_000);
}

export function clean(s: unknown): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
}

export function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d =
    typeof v === "number"
      ? new Date(v < 1e12 ? v * 1000 : v)
      : new Date(String(v).replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T"));
  return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d;
}
