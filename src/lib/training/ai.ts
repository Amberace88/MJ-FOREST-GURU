import "server-only";
import { logServerError } from "@/lib/errors";
import { lintBody, parseBody, sectionCount } from "./format";
import { composeDocument, type GeneratedDoc, type GeneratorInput } from "./generator";

const API_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 90_000;

const FORMAT_SPEC = `Dokumenta teksts jāraksta MJFG markdown-lite formātā (katrs elements savā rindā):
## Sadaļas virsraksts
Parasts rindkopas teksts (blakus rindas apvienojas; tukša rinda beidz rindkopu). **treknraksts** darbojas teksta iekšienē.
- punkts sarakstā
1. numurēts solis (secīgām darbībām)
+ jādara (zaļš ķeksis) — obligātas darbības
x aizliegts (sarkans krustiņš) — aizliegtas darbības
!! Virsraksts: kritisks brīdinājums (dzīvības vai veselības apdraudējums)
! Virsraksts: brīdinājums
? Virsraksts: padoms vai informācija
| Kolonna A | Kolonna B |   (tabulas rinda; pirmā rinda ir galvene; atdalītājrindas |---| nelieto)
Citu markdown sintaksi (###, *, _, saites, attēlus, koda blokus) nelieto.`;

const SYSTEM_PROMPT = `Tu esi pieredzējis darba drošības un mežizstrādes procesu speciālists uzņēmumā MJ FOREST GURU (mežizstrāde, harvesteri, forvarderi, motorzāģi; darbs Latvijā, Zviedrijā un Islandē).
Tavs uzdevums: no vadītāja īsā apraksta uzrakstīt profesionālu, skaidru un praktisku iekšējo noteikumu vai pamācību latviešu valodā darbiniekiem.

Prasības:
- Raksti pareizā, vienkāršā latviešu valodā, otrajā personā vienskaitlī („pārbaudi”, „ziņo”), īsiem teikumiem.
- Neizdomā konkrētus likumu pantus, numurus, summas vai faktus, kas nav dotajā aprakstā. Vispārīgas labās prakses prasības drīkst.
- Obligātās sadaļas šādā secībā: „Mērķis un piemērošana”, „Fons – notikumi” (ja ir doti notikumi), „Noteikumi”, „Aizliegts”, „Rīcība, ja noticis negadījums” (ar 112), „Atbildība un kontrole” (tabula Loma | Atbildība), „Kontroljautājumi” (4–6 numurēti jautājumi).
- Izmanto + un x rindas prasībām un aizliegumiem, !! tikai reāliem dzīvības apdraudējumiem.
- Atbildē atgriez TIKAI dokumenta tekstu, bez ievada, komentāriem vai koda blokiem.

${FORMAT_SPEC}`;

function userPrompt(input: GeneratorInput): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "(nav norādīts)");
  return [
    `Nosaukums: ${input.title}`,
    `Kategorija: ${input.category}`,
    `Valsts: ${input.countryName ?? "visas valstis"}`,
    `Auditorija: ${input.audienceLabels.join(", ") || "visi darbinieki"}`,
    `Atbildīgais: ${input.responsible || "objekta meistars"}`,
    "",
    `Mērķis:\n${input.purpose || "(nav norādīts)"}`,
    "",
    `Notikumi / situācijas:\n${input.events || "(nav norādīts)"}`,
    "",
    `Galvenās prasības:\n${list(input.requirements)}`,
    "",
    `Aizliegts:\n${list(input.forbidden)}`,
  ].join("\n");
}

/** Accepts the AI output only if it is a well-formed document in our format. */
export function validateGenerated(body: string): boolean {
  if (body.length < 400 || body.length > 60_000) return false;
  const blocks = parseBody(body);
  if (sectionCount(blocks) < 3) return false;
  if (lintBody(body).length > 3) return false;
  return blocks.some((b) => b.type === "do" || b.type === "steps" || b.type === "list");
}

function stripFences(text: string): string {
  return text.replace(/^\s*```[a-z]*\s*\n/i, "").replace(/\n```\s*$/i, "").trim();
}

async function callAnthropic(input: GeneratorInput, apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt(input) }],
      }),
    });
    if (!res.ok) {
      logServerError("materials.ai", { code: String(res.status), message: (await res.text()).slice(0, 500) });
      return null;
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
    return stripFences(text) || null;
  } catch (e) {
    logServerError("materials.ai", { message: e instanceof Error ? e.message : String(e) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generates a document: Anthropic Messages API when ANTHROPIC_API_KEY is set and the
 * answer validates; otherwise (or on any failure) the deterministic composer.
 */
export async function generateDocument(input: GeneratorInput): Promise<GeneratedDoc & { source: "ai" | "template" }> {
  const fallback = composeDocument(input);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ...fallback, source: "template" };
  const body = await callAnthropic(input, apiKey);
  if (!body || !validateGenerated(body)) return { ...fallback, source: "template" };
  const words = body.split(/\s+/).length;
  return { summary: fallback.summary, body: body.endsWith("\n") ? body : `${body}\n`, readingMinutes: Math.max(2, Math.round(words / 180)), source: "ai" };
}
