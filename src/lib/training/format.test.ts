import { describe, expect, it } from "vitest";
import { estimateReadingMinutes, lintBody, parseBody, parseInline, sectionCount, slugify, tableOfContents, type Block } from "./format";
import { BUILTIN_MATERIALS } from "./library";

describe("parseInline", () => {
  it("splits bold segments", () => {
    expect(parseInline("Nospiediet **Sākt darbu** un gaidiet")).toEqual([
      { text: "Nospiediet " }, { text: "Sākt darbu", bold: true }, { text: " un gaidiet" },
    ]);
  });
  it("keeps unmatched ** literal", () => {
    expect(parseInline("a ** b")).toEqual([{ text: "a ** b" }]);
  });
  it("handles bold at start and end", () => {
    expect(parseInline("**A** b **C**")).toEqual([{ text: "A", bold: true }, { text: " b " }, { text: "C", bold: true }]);
  });
});

describe("slugify", () => {
  it("folds Latvian diacritics", () => {
    expect(slugify("Ikdienas pārbaude (pirms maiņas)")).toBe("ikdienas-parbaude-pirms-mainas");
    expect(slugify("!!!")).toBe("sadala");
  });
});

describe("parseBody", () => {
  const body = `## Mērķis
Pirmā rinda
turpinājums ar **svarīgu** vārdu.

Otrs paragrāfs.
- viens
- divi
1. pirmais
2. otrais
+ dari
x nedari
!! Nedrīkst strādāt: Ja nestrādā bremzes.
! Uzmanību — bez virsraksta
? Padoms: Izmanto lietotni.
| A | B |
|---|---|
| 1 | 2 |
| 3 |
## Mērķis
### Apakšsadaļa`;

  const blocks = parseBody(body);

  it("produces the expected block sequence", () => {
    expect(blocks.map((b) => b.type)).toEqual([
      "heading", "paragraph", "paragraph", "list", "steps", "do", "dont", "callout", "callout", "callout", "table", "heading", "heading",
    ]);
  });
  it("joins paragraph lines", () => {
    const p = blocks[1] as Extract<Block, { type: "paragraph" }>;
    expect(p.content).toEqual([{ text: "Pirmā rinda turpinājums ar " }, { text: "svarīgu", bold: true }, { text: " vārdu." }]);
  });
  it("parses callout tones and titles", () => {
    const c = blocks.filter((b): b is Extract<Block, { type: "callout" }> => b.type === "callout");
    expect(c.map((x) => [x.tone, x.title])).toEqual([["crit", "Nedrīkst strādāt"], ["warn", null], ["tip", "Padoms"]]);
    expect(c[0].content).toEqual([{ text: "Ja nestrādā bremzes." }]);
  });
  it("parses tables, skipping separator rows and padding short rows", () => {
    const t = blocks.find((b) => b.type === "table") as Extract<Block, { type: "table" }>;
    expect(t.header.map((c) => c[0]?.text)).toEqual(["A", "B"]);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[1]).toEqual([[{ text: "3" }], []]);
  });
  it("de-duplicates heading ids and builds a toc", () => {
    expect(tableOfContents(blocks)).toEqual([
      { id: "merkis", text: "Mērķis", level: 2 },
      { id: "merkis-2", text: "Mērķis", level: 2 },
    ]);
    expect(tableOfContents(blocks, 3)).toHaveLength(3);
    expect(sectionCount(blocks)).toBe(2);
  });
  it("groups consecutive items of the same kind only", () => {
    const b = parseBody("- a\n- b\n+ c\n- d");
    expect(b.map((x) => x.type)).toEqual(["list", "do", "list"]);
    expect((b[0] as Extract<Block, { type: "list" }>).items).toHaveLength(2);
  });
  it("handles empty and CRLF input", () => {
    expect(parseBody("")).toEqual([]);
    expect(parseBody("## A\r\nText\r\n").map((b) => b.type)).toEqual(["heading", "paragraph"]);
  });
  it("estimates reading time", () => {
    expect(estimateReadingMinutes("vārds ".repeat(360))).toBe(2);
    expect(estimateReadingMinutes("")).toBe(1);
  });
});

describe("lintBody", () => {
  it("reports unclosed bold and ragged tables", () => {
    const issues = lintBody("Teksts **bez beigām\n| a | b |\n| 1 | 2 | 3 |");
    expect(issues.map((i) => i.line)).toEqual([1, 3]);
  });
});

describe("built-in library", () => {
  it("has unique keys", () => {
    const keys = BUILTIN_MATERIALS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  for (const m of BUILTIN_MATERIALS) {
    it(`${m.key} parses cleanly`, () => {
      expect(lintBody(m.body)).toEqual([]);
      const blocks = parseBody(m.body);
      expect(sectionCount(blocks)).toBeGreaterThanOrEqual(3);
      // every non-empty source line must land in some block (nothing silently dropped)
      const text = JSON.stringify(blocks);
      for (const line of m.body.split("\n").map((l) => l.trim()).filter((l) => l && !/^\|?\s*:?-{2,}/.test(l))) {
        const probe = line.replace(/^(##+|!!|!|\?|\+|x|-|\d+[.)])\s+/, "").replace(/\*\*/g, "").split("|").map((s) => s.trim()).find(Boolean) ?? "";
        const word = (probe.split(/\s+/)[0] ?? "").replace(/[:.,;]+$/, "");
        expect(text.includes(JSON.stringify(word).slice(1, -1)), `${m.key}: ${line}`).toBe(true);
      }
    });
  }
});
