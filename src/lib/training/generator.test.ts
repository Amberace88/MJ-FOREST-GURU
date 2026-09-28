import { describe, expect, it } from "vitest";
import { pdfFileName, inAudience } from "./categories";
import { lintBody, parseBody, sectionCount, tableOfContents, type Block } from "./format";
import { clean, composeDocument, splitLines, splitSentences, type GeneratorInput } from "./generator";

const base: GeneratorInput = {
  title: "Darbs ar motorzāģi ziemā",
  category: "machinery",
  countryName: "Latvija",
  audienceLabels: ["Darbinieki", "Meistari"],
  purpose: "noteikt drošu kārtību darbam ar motorzāģi sala apstākļos",
  events: "Janvārī darbinieks paslīdēja uz apledojuša stumbra. Motorzāģis atsitās un sabojāja bikses.\nNeviens neziņoja meistaram.",
  requirements: ["Pirms darba notīri sniegu no darba vietas", "Lieto zābakus ar radzēm."],
  forbidden: ["Strādāt vienatnē bez sakariem"],
  responsible: "Objekta meistars",
};

describe("text helpers", () => {
  it("strips leading format markers and pipes", () => {
    expect(clean("## Virsraksts")).toBe("Virsraksts");
    expect(clean("x nedarīt | tā")).toBe("nedarīt / tā");
    expect(clean("  !!  a  b ")).toBe("a b");
  });
  it("splits sentences and lines", () => {
    expect(splitSentences(base.events)).toEqual([
      "Janvārī darbinieks paslīdēja uz apledojuša stumbra.",
      "Motorzāģis atsitās un sabojāja bikses.",
      "Neviens neziņoja meistaram.",
    ]);
    expect(splitLines("a\n\n b \n")).toEqual(["a", "b"]);
  });
});

describe("composeDocument", () => {
  const doc = composeDocument(base);
  const blocks = parseBody(doc.body);

  it("produces a clean, well-structured document", () => {
    expect(lintBody(doc.body)).toEqual([]);
    expect(tableOfContents(blocks).map((e) => e.text)).toEqual([
      "Mērķis un piemērošana", "Fons – notikumi", "Noteikumi", "Aizliegts", "Rīcība, ja noticis negadījums", "Atbildība un kontrole", "Kontroljautājumi",
    ]);
    expect(sectionCount(blocks)).toBe(7);
    expect(doc.readingMinutes).toBeGreaterThanOrEqual(2);
    expect(doc.summary).toBe("Noteikt drošu kārtību darbam ar motorzāģi sala apstākļos.");
  });
  it("puts user requirements first, then category defaults", () => {
    const rules = blocks.find((b): b is Extract<Block, { type: "do" }> => b.type === "do")!;
    const texts = rules.items.map((i) => i.map((s) => s.text).join(""));
    expect(texts[0]).toBe("Pirms darba notīri sniegu no darba vietas.");
    expect(texts[1]).toBe("Lieto zābakus ar radzēm.");
    expect(texts.some((t) => t.includes("ikdienas pārbaudi"))).toBe(true);
  });
  it("lists events as bullets and forbidden items as crosses", () => {
    const lists = blocks.filter((b): b is Extract<Block, { type: "list" }> => b.type === "list");
    expect(lists[0].items).toHaveLength(3); // who / where / in force
    expect(lists[1].items).toHaveLength(3); // events
    const dont = blocks.find((b) => b.type === "dont") as Extract<Block, { type: "dont" }>;
    expect(dont.items[0].map((s) => s.text).join("")).toBe("Strādāt vienatnē bez sakariem.");
    expect(dont.items.some((i) => i.map((s) => s.text).join("").includes("nulles tolerance"))).toBe(true);
  });
  it("includes 112, responsibility table and control questions from the rules", () => {
    expect(doc.body).toContain("112");
    const table = blocks.find((b) => b.type === "table") as Extract<Block, { type: "table" }>;
    expect(table.rows.map((r) => r[0].map((s) => s.text).join(""))).toEqual(["Darbinieks", "Objekta meistars", "Vadība"]);
    expect(doc.body).toContain("Kā savā darbā izpildi prasību „pirms darba notīri sniegu no darba vietas”?");
  });
  it("omits the background section without events and survives hostile input", () => {
    const d = composeDocument({ ...base, category: "other", events: "", requirements: ["## hack", "| a | b |"], forbidden: [], responsible: null });
    const b = parseBody(d.body);
    expect(tableOfContents(b).map((e) => e.text)).not.toContain("Fons – notikumi");
    expect(lintBody(d.body)).toEqual([]);
    expect(sectionCount(b)).toBe(6);
  });
});

describe("categories helpers", () => {
  it("matches audience by role and country", () => {
    const m = { audience: ["employee"], country_id: "lv" };
    expect(inAudience(m, { roles: ["employee"], country_id: "lv" })).toBe(true);
    expect(inAudience(m, { roles: ["employee"], country_id: "se" })).toBe(false);
    expect(inAudience(m, { roles: ["mechanic"], country_id: "lv" })).toBe(false);
    expect(inAudience({ audience: [], country_id: null }, { roles: ["owner"], country_id: null })).toBe(true);
  });
  it("builds a safe ASCII file name", () => {
    expect(pdfFileName("Darba drošība mežizstrādē — Zviedrija", 3)).toBe("Darba-drosiba-mezizstrade-Zviedrija-v3.pdf");
    expect(pdfFileName("„“”", 1)).toBe("materials-v1.pdf");
  });
});
