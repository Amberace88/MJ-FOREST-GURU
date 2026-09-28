/**
 * MJFG markdown-lite → typed blocks.
 *
 * Pure, dependency-free and isomorphic: used by the reader page (server), the
 * editor live preview (client), the PDF renderer and the generator validator.
 *
 *   ## Section heading            (### = sub-heading)
 *   Paragraph text — consecutive lines join; a blank line ends the paragraph. **bold** inline.
 *   - bullet item
 *   1. numbered step
 *   + must do (green check)
 *   x forbidden (red cross)
 *   !! critical callout           (optionally "!! Title: text")
 *   ! warning callout             (optionally "! Title: text")
 *   ? tip / info callout          (optionally "? Title: text")
 *   | a | b | c |                 table row (first row = header; |---| rows ignored)
 */

export type Inline = { text: string; bold?: boolean };
export type CalloutTone = "crit" | "warn" | "tip";

export type Block =
  | { type: "heading"; level: 2 | 3; id: string; text: string }
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; items: Inline[][] }
  | { type: "steps"; items: Inline[][] }
  | { type: "do"; items: Inline[][] }
  | { type: "dont"; items: Inline[][] }
  | { type: "callout"; tone: CalloutTone; title: string | null; content: Inline[] }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] };

export type TocEntry = { id: string; text: string; level: 2 | 3 };

/* ------------------------------------------------------------------ inline */

/** Splits `**bold**` segments. An unmatched `**` is kept as literal text. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const push = (text: string, bold: boolean) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && Boolean(last.bold) === bold) last.text += text;
    else out.push(bold ? { text, bold: true } : { text });
  };
  let rest = src;
  while (rest.length) {
    const start = rest.indexOf("**");
    if (start < 0) { push(rest, false); break; }
    const end = rest.indexOf("**", start + 2);
    if (end < 0) { push(rest, false); break; }
    push(rest.slice(0, start), false);
    const inner = rest.slice(start + 2, end);
    if (inner.trim()) push(inner, true);
    else push(rest.slice(start, end + 2), false);
    rest = rest.slice(end + 2);
  }
  return out;
}

export function inlineText(content: Inline[]): string {
  return content.map((s) => s.text).join("");
}

/** URL-friendly id for headings (keeps Latvian letters readable, ASCII-folds diacritics). */
export function slugify(text: string): string {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "sadala";
}

/* ------------------------------------------------------------------ callout title */

function splitCallout(text: string): { title: string | null; body: string } {
  const m = /^([^:.!?]{2,60}):\s+([\s\S]+)$/.exec(text);
  if (m && !m[1].includes("**")) return { title: m[1].trim(), body: m[2].trim() };
  return { title: null, body: text.trim() };
}

/* ------------------------------------------------------------------ tables */

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}
const isSeparatorRow = (cells: string[]) => cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));

/* ------------------------------------------------------------------ parser */

type ItemKind = "list" | "steps" | "do" | "dont";

const RE = {
  h3: /^###\s+(.+)$/,
  h2: /^##\s+(.+)$/,
  h1: /^#\s+(.+)$/,
  crit: /^!!\s+(.+)$/,
  warn: /^!\s+(.+)$/,
  tip: /^\?\s+(.+)$/,
  step: /^\d{1,3}[.)]\s+(.+)$/,
  bullet: /^[-•*]\s+(.+)$/,
  do: /^\+\s+(.+)$/,
  dont: /^[xX✕]\s+(.+)$/,
  table: /^\|.*\|\s*$/,
};

export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  const lines = (body ?? "").replace(/\r\n?/g, "\n").split("\n");
  const usedIds = new Map<string, number>();

  let para: string[] = [];
  let items: { kind: ItemKind; items: Inline[][] } | null = null;
  let table: string[][] | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: "paragraph", content: parseInline(para.join(" ").replace(/\s+/g, " ").trim()) });
    para = [];
  };
  const flushItems = () => {
    if (items && items.items.length) blocks.push({ type: items.kind, items: items.items });
    items = null;
  };
  const flushTable = () => {
    if (table && table.length) {
      const [head, ...rows] = table;
      const width = Math.max(head.length, ...rows.map((r) => r.length));
      const pad = (r: string[]) => [...r, ...Array(Math.max(0, width - r.length)).fill("")].map(parseInline);
      blocks.push({ type: "table", header: pad(head), rows: rows.map(pad) });
    }
    table = null;
  };
  const flushAll = () => { flushPara(); flushItems(); flushTable(); };
  const addItem = (kind: ItemKind, text: string) => {
    flushPara(); flushTable();
    if (!items || items.kind !== kind) { flushItems(); items = { kind, items: [] }; }
    items.items.push(parseInline(text.trim()));
  };
  const heading = (level: 2 | 3, text: string) => {
    flushAll();
    const clean = text.replace(/\*\*/g, "").trim();
    let id = slugify(clean);
    const n = usedIds.get(id) ?? 0;
    usedIds.set(id, n + 1);
    if (n > 0) id = `${id}-${n + 1}`;
    blocks.push({ type: "heading", level, id, text: clean });
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushAll(); continue; }
    let m: RegExpExecArray | null;

    if (RE.table.test(line)) {
      flushPara(); flushItems();
      const cells = splitRow(line);
      if (isSeparatorRow(cells)) continue;
      (table ??= []).push(cells);
      continue;
    }
    if (table) flushTable();

    if ((m = RE.h3.exec(line))) { heading(3, m[1]); continue; }
    if ((m = RE.h2.exec(line)) || (m = RE.h1.exec(line))) { heading(2, m[1]); continue; }
    if ((m = RE.crit.exec(line)) || (m = RE.warn.exec(line)) || (m = RE.tip.exec(line))) {
      flushAll();
      const tone: CalloutTone = line.startsWith("!!") ? "crit" : line.startsWith("!") ? "warn" : "tip";
      const { title, body: text } = splitCallout(m[1]);
      blocks.push({ type: "callout", tone, title, content: parseInline(text) });
      continue;
    }
    if ((m = RE.step.exec(line))) { addItem("steps", m[1]); continue; }
    if ((m = RE.bullet.exec(line))) { addItem("list", m[1]); continue; }
    if ((m = RE.do.exec(line))) { addItem("do", m[1]); continue; }
    if ((m = RE.dont.exec(line))) { addItem("dont", m[1]); continue; }

    // plain text: a line right after list items starts a new paragraph
    flushItems();
    para.push(line);
  }
  flushAll();
  return blocks;
}

/* ------------------------------------------------------------------ helpers */

export function tableOfContents(blocks: Block[], maxLevel: 2 | 3 = 2): TocEntry[] {
  return blocks.flatMap((b) => (b.type === "heading" && b.level <= maxLevel ? [{ id: b.id, text: b.text, level: b.level }] : []));
}

export function sectionCount(blocks: Block[]): number {
  return blocks.filter((b) => b.type === "heading" && b.level === 2).length;
}

/** Rough reading time at ~180 words / minute (technical text), minimum 1. */
export function estimateReadingMinutes(body: string): number {
  const words = (body ?? "").replace(/[#|!?+*-]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

export type FormatIssue = { line: number; message: string };

/** Lints a body for common authoring mistakes (shown in the editor, used by tests). */
export function lintBody(body: string): FormatIssue[] {
  const issues: FormatIssue[] = [];
  const lines = (body ?? "").replace(/\r\n?/g, "\n").split("\n");
  let tableWidth: number | null = null;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const n = i + 1;
    if ((line.match(/\*\*/g) ?? []).length % 2 === 1) issues.push({ line: n, message: "Neaizvērts **treknraksts**" });
    if (RE.table.test(line)) {
      const cells = splitRow(line);
      if (!isSeparatorRow(cells)) {
        if (tableWidth === null) tableWidth = cells.length;
        else if (cells.length !== tableWidth) issues.push({ line: n, message: `Tabulas rindā ${cells.length} kolonnas, galvenē ${tableWidth}` });
      }
    } else {
      tableWidth = null;
      if (/^\|/.test(line)) issues.push({ line: n, message: "Tabulas rindai jābeidzas ar |" });
    }
    if (/^#{4,}\s/.test(line)) issues.push({ line: n, message: "Izmantojiet ## vai ### virsrakstu" });
  });
  return issues;
}
