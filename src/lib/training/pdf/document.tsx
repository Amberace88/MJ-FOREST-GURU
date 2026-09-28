/** @jsxRuntime automatic */
/**
 * A4 PDF document for a training material (@react-pdf/renderer).
 * Shared by the route handler (/api/training/[id]/pdf) and scripts/export-training-pdfs.tsx.
 * Fonts are embedded TTFs committed to the repo (full Latvian diacritics); ✓ / ✕ are drawn as SVG.
 */
import path from "node:path";
import type { ComponentProps } from "react";
import { Circle, Document, Font, Line, Page, Path, Polygon, renderToBuffer, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { createT, getDictionary } from "@/i18n";
import { CATEGORY_META } from "../categories";
import { inlineText, parseBody, tableOfContents, type Block, type CalloutTone, type Inline } from "../format";
import type { MaterialCategory } from "../types";

/* ------------------------------------------------------------------ fonts */
export const PDF_FONT_DIR = path.join(process.cwd(), "src", "lib", "training", "pdf", "fonts");
let fontsReady = false;
export function registerPdfFonts(dir = PDF_FONT_DIR) {
  if (fontsReady) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Inter-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: path.join(dir, "Inter-Medium.ttf"), fontWeight: 500 },
      { src: path.join(dir, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(dir, "Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Saira",
    fonts: [
      { src: path.join(dir, "SairaCondensed-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(dir, "SairaCondensed-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Latvian words must not be hyphenated with English rules
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

/* ------------------------------------------------------------------ palette */
const C = {
  band: "#0f1a14",
  band2: "#16261d",
  ink: "#18211b",
  ink2: "#384239",
  muted: "#6b756d",
  faint: "#9aa39b",
  line: "#dde2da",
  paper: "#ffffff",
  soft: "#f5f7f3",
  forest: "#2b6139",
  forestDark: "#1c3a27",
  amber: "#e2a23b",
  ok: "#2f8a47", okBg: "#eef7f0",
  crit: "#c8392f", critBg: "#fcefed",
  warn: "#b7791f", warnBg: "#fdf5e6",
  tip: "#3d6d98", tipBg: "#edf3f9",
};

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 10, color: C.ink2, backgroundColor: C.paper, paddingTop: 74, paddingBottom: 64, paddingHorizontal: 52, lineHeight: 1.5 },
  cover: { fontFamily: "Inter", backgroundColor: C.paper, padding: 0 },
  // fixed header / footer
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 5 },
  header: { position: "absolute", top: 26, left: 52, right: 52, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottomWidth: 0.75, borderBottomColor: C.line },
  headerBrand: { fontFamily: "Saira", fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.forestDark },
  headerTitle: { fontSize: 7.5, color: C.muted, maxWidth: 330, textAlign: "right" },
  footer: { position: "absolute", bottom: 26, left: 52, right: 52, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 0.75, borderTopColor: C.line, fontSize: 7.5, color: C.muted },
  // body
  h2Wrap: { marginTop: 16, marginBottom: 8, flexDirection: "row", alignItems: "flex-end", paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: C.line },
  h2Num: { fontFamily: "Saira", fontWeight: 700, fontSize: 12, marginRight: 8, width: 20 },
  h2: { fontFamily: "Saira", fontWeight: 700, fontSize: 16, color: C.ink, textTransform: "uppercase", letterSpacing: 0.4, flex: 1, lineHeight: 1.15 },
  h3: { fontWeight: 600, fontSize: 11, color: C.ink, marginTop: 8, marginBottom: 4 },
  p: { marginBottom: 7 },
  bold: { fontWeight: 600, color: C.ink },
  row: { flexDirection: "row", marginBottom: 4 },
  bullet: { width: 4, height: 4, borderRadius: 2, marginTop: 5.5, marginRight: 9, marginLeft: 2 },
  itemText: { flex: 1 },
  stepNum: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.forest, color: C.paper, fontSize: 8, fontWeight: 700, textAlign: "center", paddingTop: 3, marginRight: 9, lineHeight: 1 },
  box: { borderRadius: 4, paddingVertical: 9, paddingHorizontal: 11, marginBottom: 9, borderLeftWidth: 3 },
  boxLabel: { fontSize: 7, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 },
  calloutTitle: { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  calloutIcon: { width: 15, height: 15, borderRadius: 7.5, color: C.paper, fontSize: 9, fontWeight: 700, textAlign: "center", paddingTop: 2.5, marginRight: 9, lineHeight: 1 },
  table: { borderWidth: 0.75, borderColor: C.line, borderRadius: 4, marginBottom: 10, overflow: "hidden" },
  th: { backgroundColor: C.forestDark, color: C.paper, fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, paddingVertical: 6, paddingHorizontal: 7, lineHeight: 1.3 },
  td: { fontSize: 8.8, paddingVertical: 5.5, paddingHorizontal: 7, lineHeight: 1.4 },
});

const CALLOUT: Record<CalloutTone, { fg: string; bg: string; glyph: string }> = {
  crit: { fg: C.crit, bg: C.critBg, glyph: "!" },
  warn: { fg: C.warn, bg: C.warnBg, glyph: "!" },
  tip: { fg: C.tip, bg: C.tipBg, glyph: "i" },
};

/* ------------------------------------------------------------------ inputs */
export type PdfMaterial = {
  title: string;
  subtitle: string | null;
  summary: string | null;
  category: MaterialCategory;
  version: number;
  date: string | Date;           // published / updated
  country: string | null;        // country name, null = all countries
  audience: string[];            // role keys
  readingMinutes: number | null;
  requiresAck: boolean;
  body: string;
};

const { t, label } = createT(getDictionary("lv"));

export function fmtPdfDate(d: string | Date) {
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "—";
  return new Intl.DateTimeFormat("lv-LV", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Riga" }).format(x);
}

/* ------------------------------------------------------------------ small pieces */
type TextStyle = ComponentProps<typeof View>["style"];

function Rich({ content, style }: { content: Inline[]; style?: TextStyle }) {
  return (
    <Text style={style}>
      {content.map((seg, i) => (seg.bold ? <Text key={i} style={s.bold}>{seg.text}</Text> : seg.text))}
    </Text>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" style={{ marginRight: 8, marginTop: 2 }}>
      <Circle cx="12" cy="12" r="12" fill={color} />
      <Path d="M6.5 12.5 L10.2 16 L17.5 8.3" stroke="#ffffff" strokeWidth={2.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CrossIcon({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" style={{ marginRight: 8, marginTop: 2 }}>
      <Circle cx="12" cy="12" r="12" fill={color} />
      <Path d="M8 8 L16 16 M16 8 L8 16" stroke="#ffffff" strokeWidth={2.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Polygon points="16,2 29,26 3,26" fill={C.amber} />
      <Polygon points="16,9 24,24 8,24" fill={C.band} />
      <Polygon points="16,13 21,23 11,23" fill={C.amber} />
      <Line x1="16" y1="26" x2="16" y2="30" stroke={C.amber} strokeWidth={2.4} />
    </Svg>
  );
}

/** Decorative topographic contour lines on the cover band. */
function Contours({ color }: { color: string }) {
  const rings = Array.from({ length: 11 }, (_, i) => i);
  const ring = (i: number) => {
    // organic closed curve: an ellipse with a gentle wobble, growing and drifting outward
    const cx = 250 - i * 4, cy = 170 + i * 3, rx = 26 + i * 21, ry = 18 + i * 15;
    const pts = Array.from({ length: 48 }, (_, k) => {
      const a = (k / 48) * Math.PI * 2;
      const wob = 1 + 0.07 * Math.sin(a * 3 + i * 0.6) + 0.04 * Math.cos(a * 5 - i);
      return [cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob];
    });
    return `M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")} Z`;
  };
  return (
    <Svg width={420} height={440} viewBox="0 0 420 440" style={{ position: "absolute", right: -60, top: -20 }}>
      {rings.map((i) => (
        <Path key={i} d={ring(i)} stroke={i % 4 === 2 ? color : "#ffffff"} strokeOpacity={i % 4 === 2 ? 0.45 : 0.08} strokeWidth={i % 4 === 2 ? 1.1 : 0.8} fill="none" />
      ))}
    </Svg>
  );
}

/* ------------------------------------------------------------------ blocks */
function columnWeights(b: Extract<Block, { type: "table" }>): number[] {
  const n = b.header.length;
  const raw = Array.from({ length: n }, (_, c) => {
    const cells = b.rows.map((r) => inlineText(r[c] ?? []).length);
    const avg = cells.reduce((a, x) => a + x, 0) / Math.max(1, cells.length);
    const longestWord = Math.max(0, ...inlineText(b.header[c] ?? []).split(/\s+/).map((w) => w.length));
    return Math.max(avg, longestWord * 1.35, 5);
  });
  const total = raw.reduce((a, x) => a + x, 0);
  // clamp each column between 8 % and 55 % of the width
  return raw.map((x) => Math.min(0.55, Math.max(0.08, x / total)));
}

function BlockView({ b, accent, sectionNo }: { b: Block; accent: string; sectionNo: number }) {
  switch (b.type) {
    case "heading":
      if (b.level === 3) return <Text style={s.h3} minPresenceAhead={40}>{b.text}</Text>;
      return (
        <View style={s.h2Wrap} minPresenceAhead={70} wrap={false}>
          <Text style={[s.h2Num, { color: accent }]}>{String(sectionNo).padStart(2, "0")}</Text>
          <Text style={s.h2}>{b.text}</Text>
        </View>
      );
    case "paragraph":
      return <Rich content={b.content} style={s.p} />;
    case "list":
      return (
        <View style={{ marginBottom: 6 }}>
          {b.items.map((it, i) => (
            <View key={i} style={s.row} wrap={false}>
              <View style={[s.bullet, { backgroundColor: accent }]} />
              <Rich content={it} style={s.itemText} />
            </View>
          ))}
        </View>
      );
    case "steps":
      return (
        <View style={{ marginBottom: 6 }}>
          {b.items.map((it, i) => (
            <View key={i} style={[s.row, { marginBottom: 5 }]} wrap={false}>
              <Text style={s.stepNum}>{i + 1}</Text>
              <Rich content={it} style={[s.itemText, { paddingTop: 0.5 }]} />
            </View>
          ))}
        </View>
      );
    case "do":
    case "dont": {
      const ok = b.type === "do";
      const fg = ok ? C.ok : C.crit;
      return (
        <View style={[s.box, { backgroundColor: ok ? C.okBg : C.critBg, borderLeftColor: fg }]}>
          <Text style={[s.boxLabel, { color: fg }]}>{ok ? t("materials.blocks.do") : t("materials.blocks.dont")}</Text>
          {b.items.map((it, i) => (
            <View key={i} style={[s.row, { marginBottom: i === b.items.length - 1 ? 0 : 4 }]} wrap={false}>
              {ok ? <CheckIcon color={fg} /> : <CrossIcon color={fg} />}
              <Rich content={it} style={[s.itemText, { color: C.ink }]} />
            </View>
          ))}
        </View>
      );
    }
    case "callout": {
      const c = CALLOUT[b.tone];
      return (
        <View style={[s.box, { backgroundColor: c.bg, borderLeftColor: c.fg, flexDirection: "row" }]} wrap={false}>
          <Text style={[s.calloutIcon, { backgroundColor: c.fg }]}>{c.glyph}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.calloutTitle, { color: c.fg }]}>{b.title ?? t(`materials.blocks.${b.tone}`)}</Text>
            <Rich content={b.content} style={{ color: C.ink }} />
          </View>
        </View>
      );
    }
    case "table": {
      const w = columnWeights(b);
      return (
        <View style={s.table}>
          <View style={{ flexDirection: "row" }} fixed={false} wrap={false}>
            {b.header.map((h, i) => <Rich key={i} content={h} style={[s.th, { flex: w[i] }]} />)}
          </View>
          {b.rows.map((r, j) => (
            <View key={j} style={{ flexDirection: "row", backgroundColor: j % 2 ? C.soft : C.paper, borderTopWidth: 0.5, borderTopColor: C.line }} wrap={false}>
              {r.map((c, i) => <Rich key={i} content={c} style={[s.td, { flex: w[i] }, i === 0 ? { fontWeight: 600, color: C.ink } : {}]} />)}
            </View>
          ))}
        </View>
      );
    }
  }
}

/* ------------------------------------------------------------------ document */
export function TrainingMaterialPdf({ m, orgName }: { m: PdfMaterial; orgName?: string }) {
  const accent = CATEGORY_META[m.category]?.color ?? CATEGORY_META.other.color;
  const blocks = parseBody(m.body);
  const toc = tableOfContents(blocks);
  const audience = m.audience.length ? m.audience.map((a) => label("materials.audiences", a)).join(", ") : t("materials.audienceAll");
  const categoryLabel = label("materials.categories", m.category);
  const date = fmtPdfDate(m.date);
  let section = 0;

  const pageNo = ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
    t("materials.pdf.page", { n: pageNumber, total: totalPages });

  const metaItems = [
    { k: t("materials.version"), v: `v${m.version}` },
    { k: t("materials.pdf.date"), v: date },
    { k: t("materials.country"), v: m.country ?? t("materials.forAll") },
    { k: t("materials.readingTime"), v: m.readingMinutes ? t("materials.minutes", { n: m.readingMinutes }) : "—" },
    { k: t("materials.audience"), v: audience },
    { k: t("materials.pdf.ackTitle"), v: m.requiresAck ? t("materials.pdf.requiresAck") : t("materials.ackNotRequired") },
  ];

  return (
    <Document title={m.title} author={orgName ?? "MJ FOREST GURU"} subject={categoryLabel} creator="MJ FOREST GURU" producer="MJ FOREST GURU" language="lv">
      {/* ------------------------------------------------------------ cover */}
      <Page size="A4" style={s.cover}>
        <View style={{ backgroundColor: C.band, height: 470, paddingHorizontal: 52, paddingTop: 46, paddingBottom: 40, position: "relative", overflow: "hidden" }}>
          <Contours color={accent} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <BrandMark />
              <Text style={{ fontFamily: "Saira", fontWeight: 700, fontSize: 15, letterSpacing: 3, color: "#f3efe4", marginLeft: 10 }}>{t("materials.pdf.brand")}</Text>
            </View>
            <Text style={{ fontSize: 8, color: "#9fb0a3", letterSpacing: 1.5, textTransform: "uppercase" }}>{t("materials.pdf.docType")}</Text>
          </View>

          <View style={{ flex: 1 }} />

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent, marginRight: 8 }} />
            <Text style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: accent }}>{categoryLabel}</Text>
            {m.country && <Text style={{ fontSize: 9, color: "#9fb0a3", marginLeft: 10, letterSpacing: 1 }}>·  {m.country.toUpperCase()}</Text>}
          </View>
          <Text style={{ fontFamily: "Saira", fontWeight: 700, fontSize: m.title.length > 60 ? 30 : 36, lineHeight: 1.04, color: "#ffffff", textTransform: "uppercase", letterSpacing: 0.3 }}>{m.title}</Text>
          {m.subtitle && <Text style={{ fontSize: 12, lineHeight: 1.45, color: "#c9d3cb", marginTop: 12, maxWidth: 440 }}>{m.subtitle}</Text>}
          <View style={{ width: 64, height: 3, backgroundColor: C.amber, marginTop: 20 }} />
        </View>

        <View style={{ paddingHorizontal: 52, paddingTop: 30 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -8 }}>
            {metaItems.map((it) => (
              <View key={it.k} style={{ width: "33.33%", paddingHorizontal: 8, marginBottom: 14 }}>
                <View style={{ borderTopWidth: 2, borderTopColor: it.k === t("materials.version") ? accent : C.line, paddingTop: 6 }}>
                  <Text style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", color: C.muted }}>{it.k}</Text>
                  <Text style={{ fontSize: 10, fontWeight: 600, color: C.ink, marginTop: 2, lineHeight: 1.35 }}>{it.v}</Text>
                </View>
              </View>
            ))}
          </View>

          {m.summary && (
            <View style={{ marginTop: 6, backgroundColor: C.soft, borderLeftWidth: 3, borderLeftColor: accent, borderRadius: 4, paddingVertical: 12, paddingHorizontal: 14 }}>
              <Text style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: accent, marginBottom: 4 }}>{t("materials.summary")}</Text>
              <Text style={{ fontSize: 10, lineHeight: 1.55, color: C.ink }}>{m.summary}</Text>
            </View>
          )}
        </View>

        <View style={[s.footer, { left: 52, right: 52 }]} fixed>
          <Text>{t("materials.pdf.brand")}  ·  {t("materials.pdf.confidential")}</Text>
          <Text style={{ width: 90, textAlign: "right" }} render={pageNo} />
        </View>
      </Page>

      {/* ------------------------------------------------------------ content */}
      <Page size="A4" style={s.page} wrap>
        <View style={[s.topBar, { backgroundColor: accent }]} fixed />
        <View style={s.header} fixed>
          <Text style={s.headerBrand}>{t("materials.pdf.brand")}</Text>
          <Text style={s.headerTitle}>{m.title}  ·  v{m.version}</Text>
        </View>
        {/* bottom-anchored fixed nodes are dropped on padded wrapping pages — anchor from the top instead */}
        <View style={[s.footer, { top: 841.89 - 50, bottom: undefined }]} fixed>
          <Text style={{ maxWidth: 360 }}>{t("materials.pdf.brand")}  ·  {categoryLabel}  ·  v{m.version}  ·  {date}</Text>
        </View>
        <Text fixed style={{ position: "absolute", top: 841.89 - 50 + 8.5, right: 52, width: 120, textAlign: "right", fontSize: 7.5, color: C.muted }} render={pageNo} />

        {toc.length > 1 && (
          <View style={{ marginBottom: 14, borderWidth: 0.75, borderColor: C.line, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 14 }} wrap={false}>
            <Text style={{ fontFamily: "Saira", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: C.ink, marginBottom: 6 }}>{t("materials.contents")}</Text>
            <View style={{ flexDirection: "row" }}>
              {[toc.slice(0, Math.ceil(toc.length / 2)), toc.slice(Math.ceil(toc.length / 2))].map((col, ci) => (
                <View key={ci} style={{ width: "50%", paddingRight: ci === 0 ? 12 : 0 }}>
                  {col.map((e, i) => (
                    <View key={e.id} style={{ flexDirection: "row", marginBottom: 2.5 }}>
                      <Text style={{ width: 18, fontSize: 8.5, fontWeight: 700, color: accent }}>{String(ci * Math.ceil(toc.length / 2) + i + 1).padStart(2, "0")}</Text>
                      <Text style={{ flex: 1, fontSize: 8.5, color: C.ink2 }}>{e.text}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {blocks.map((b, i) => {
          if (b.type === "heading" && b.level === 2) section++;
          return <BlockView key={i} b={b} accent={accent} sectionNo={section} />;
        })}

        {/* acknowledgement / signature block */}
        <View wrap={false} style={{ marginTop: 22, borderWidth: 0.75, borderColor: C.line, borderTopWidth: 3, borderTopColor: accent, borderRadius: 6, backgroundColor: "#fafbf8", paddingVertical: 16, paddingHorizontal: 18 }}>
          <Text style={{ fontFamily: "Saira", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: 0.8, color: C.ink }}>{t("materials.pdf.ackTitle")}</Text>
          <Text style={{ fontSize: 9.5, lineHeight: 1.5, color: C.ink2, marginTop: 6 }}>
            {t("materials.pdf.ackText", { title: m.title, version: m.version })}
          </Text>
          <View style={{ flexDirection: "row", marginTop: 30 }}>
            {[t("materials.pdf.fullName"), t("materials.pdf.signature"), t("materials.pdf.date")].map((f, i) => (
              <View key={f} style={{ flex: i === 0 ? 1.5 : 1, marginRight: i < 2 ? 18 : 0 }}>
                <View style={{ borderBottomWidth: 0.9, borderBottomColor: C.ink2, height: 22 }} />
                <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

      </Page>
    </Document>
  );
}

/** Renders the material to a PDF buffer (registers the embedded fonts on first use). */
export async function renderMaterialPdf(m: PdfMaterial, orgName?: string): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<TrainingMaterialPdf m={m} orgName={orgName} />);
}
