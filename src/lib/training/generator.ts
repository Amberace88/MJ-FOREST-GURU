/**
 * Deterministic document composer for "Jauns noteikums / pamācība".
 * Turns a short manager brief into a complete, structured markdown-lite body.
 * Pure and isomorphic (unit tested); the AI path in ./ai.ts falls back to it.
 */
import type { MaterialCategory } from "./types";

export type GeneratorInput = {
  title: string;
  category: MaterialCategory;
  countryName: string | null;     // null = all countries
  audienceLabels: string[];       // human labels, e.g. ["Darbinieki", "Meistari"]
  purpose: string;
  events: string;
  requirements: string[];
  forbidden: string[];
  responsible: string | null;
};

export type GeneratedDoc = { summary: string; body: string; readingMinutes: number };

/* ------------------------------------------------------------------ text helpers */

/** Collapses whitespace and removes leading format markers so user text can't break the structure. */
export function clean(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:#{1,6}|!!|!|\?|\+|[xX]|[-•*]|\d{1,3}[.)]|\|)\s+/, "")
    .replace(/\|/g, "/")
    .trim();
}

export function sentence(s: string): string {
  const c = clean(s);
  if (!c) return "";
  const cap = c.charAt(0).toLocaleUpperCase("lv") + c.slice(1);
  return /[.!?…:]$/.test(cap) ? cap : `${cap}.`;
}

const noDot = (s: string) => clean(s).replace(/[.!?…]+$/, "");
const lcFirst = (s: string) => (s ? s.charAt(0).toLocaleLowerCase("lv") + s.slice(1) : s);

/** Splits free text into sentences / lines (for bullet points). */
export function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?…])\s+(?=[A-ZĀČĒĢĪĶĻŅŠŪŽ0-9„"])/u))
    .map(clean)
    .filter((s) => s.length > 2);
}

export function splitLines(text: string | null | undefined): string[] {
  return (text ?? "").split(/\n+/).map(clean).filter(Boolean);
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = noDot(i).toLocaleLowerCase("lv");
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ------------------------------------------------------------------ category defaults */

const DEFAULT_RULES: Record<MaterialCategory, string[]> = {
  machinery: [
    "Pirms darba sākuma veic tehnikas ikdienas pārbaudi (noplūdes, bremzes, avārijas apturēšana, aizsargi, ugunsdzēšamais aparāts).",
    "Nopietnu defektu gadījumā tehniku neizmanto, ziņo meistaram un reģistrē bojājumu platformā sadaļā „Apkope un remonti”.",
    "Pirms apkopes vai remonta nolaid darba ierīces, izslēdz motoru, izņem atslēgu un atbrīvo hidraulisko spiedienu.",
    "Ievēro bīstamās zonas: operators aptur darbu, tiklīdz kāds ienāk bīstamajā zonā.",
  ],
  safety: [
    "Lieto visus darbam noteiktos individuālos aizsardzības līdzekļus (IAL) — ķiveri ar sejsargu un austiņām, drošības apavus, cimdus, signālapģērbu un, strādājot ar motorzāģi, bikses ar aizsardzību pret iegriezumiem.",
    "Pirms darba sākuma novērtē riskus darba vietā: bīstami koki, elektrolīnijas, nogāzes, laikapstākļi.",
    "Maiņas sākumā pārliecinies, ka zini tuvāko evakuācijas vietu un pirmās palīdzības aptieciņas atrašanās vietu.",
    "Strādājot vienatnē, vienojies ar meistaru par regulāru saziņu.",
  ],
  reporting: [
    "Darba maiņu sāc un beidz platformā tās pašas dienas laikā; aizmirstu ierakstu labo nekavējoties un informē meistaru.",
    "Degvielu, izdevumus un čekus reģistrē platformā tās pašas maiņas laikā, pievienojot čeka fotoattēlu.",
    "Bojājumus, incidentus un gandrīz negadījumus reģistrē platformā uzreiz pēc notikuma, ar aprakstu un fotoattēlu.",
    "Ieraksti ir precīzi un patiesi — tie ir pamats algas aprēķinam, izdevumu atmaksai un darba drošībai.",
  ],
  emergency: [
    "Ja cilvēks ir smagi cietis, vispirms zvani 112, pēc tam meistaram.",
    "Maiņas sākumā pārliecinies, ka zini precīzu darba vietas atrašanās vietu (koordinātas) un piebraucamo ceļu glābējiem.",
    "Pirmās palīdzības aptieciņa un ugunsdzēšamais aparāts vienmēr ir pieejami darba vietā.",
  ],
  environment: [
    "Degvielu uzpilda ne tuvāk kā 50 m no ūdeņiem, grāvjiem un avotiem; absorbenta komplekts vienmēr ir blakus.",
    "Noplūdi nekavējoties ierobežo ar absorbentu un ziņo meistaram; notikumu reģistrē platformā.",
    "Atkritumus, eļļas filtrus un izlietoto absorbentu savāc un nodod atbilstoši noteikumiem.",
  ],
  platform: [
    "Platformā piesakies tikai ar savu kontu; paroli nedod citiem.",
    "Datus ievadi tās pašas maiņas laikā; ja nav interneta, ieraksts tiek saglabāts un nosūtīts, tiklīdz savienojums atjaunojas.",
    "Ja kaut kas nedarbojas, informē meistaru vai administratoru.",
  ],
  other: [
    "Pirms darba sākuma iepazīsties ar šo noteikumu un jautā meistaram, ja kaut kas nav skaidrs.",
    "Par jebkuru noteikuma pārkāpumu vai bīstamu situāciju ziņo meistaram un reģistrē to platformā.",
  ],
};

const DEFAULT_FORBIDDEN: Record<MaterialCategory, string[]> = {
  machinery: [
    "Atslēgt, apiet vai bojāt aizsargierīces, sensorus un avārijas apturēšanu.",
    "Atrasties zem pacelta krāna, kravas vai harvestera galvas.",
    "Vadīt tehniku, kurai neesi instruēts.",
  ],
  safety: [
    "Strādāt bez noteiktajiem individuālajiem aizsardzības līdzekļiem.",
    "Atrasties bīstamajā zonā ap strādājošu tehniku vai krītošu koku.",
  ],
  reporting: [
    "Ievadīt apzināti nepatiesus datus vai reģistrēt darbu cita darbinieka vārdā.",
    "Slēpt negadījumus, bojājumus vai gandrīz negadījumus.",
  ],
  emergency: ["Pārvietot cietušo, ja nav tiešu draudu dzīvībai (ugunsgrēks, krītoši koki)."],
  environment: ["Izliet degvielu, eļļu vai citus šķidrumus zemē vai ūdenī.", "Dedzināt atkritumus darba vietā."],
  platform: ["Dot savu paroli citam vai ļaut citam strādāt savā kontā."],
  other: [],
};

const COMMON_FORBIDDEN = "Strādāt alkohola, narkotisko vai citu apreibinošo vielu ietekmē — nulles tolerance.";

const INCIDENT_STEPS: Record<MaterialCategory, string[]> = {
  machinery: [
    "Nekavējoties aptur tehniku, nolaid darba ierīces un izslēdz motoru.",
    "Novērtē situāciju un pārliecinies, ka tev un citiem nedraud briesmas.",
  ],
  safety: [
    "Aptur darbu un nodrošini, lai citiem nedraud briesmas.",
    "Sniedz pirmo palīdzību, ja to vari izdarīt droši.",
  ],
  emergency: [
    "Novērtē situāciju — nekļūsti par nākamo cietušo.",
    "Sniedz pirmo palīdzību, ja to vari izdarīt droši.",
  ],
  environment: [
    "Aptur noplūdes avotu, ja to var izdarīt droši.",
    "Ierobežo noplūdi ar absorbentu un nepieļauj tās nokļūšanu ūdenī.",
  ],
  reporting: ["Aptur darbu, ja situācija ir bīstama, un nodrošini notikuma vietu."],
  platform: ["Ja situācija ir bīstama, vispirms rūpējies par drošību — ziņošana platformā var pagaidīt."],
  other: ["Aptur darbu un nodrošini, lai citiem nedraud briesmas."],
};

const INCIDENT_TAIL = [
  "Ja kāds ir cietis vai draud ugunsgrēks — zvani **112** un nosauc precīzu atrašanās vietu.",
  "Informē meistaru.",
  "Nepārvieto tehniku, instrumentus vai citus pierādījumus, ja tas nav nepieciešams drošībai.",
  "Reģistrē notikumu platformā sadaļā „Incidenti” tās pašas maiņas laikā, pievienojot fotoattēlus.",
];

/* ------------------------------------------------------------------ composer */

export function composeDocument(input: GeneratorInput): GeneratedDoc {
  const title = clean(input.title);
  const purpose = sentence(input.purpose);
  const events = splitSentences(input.events);
  const requirements = dedupe([...input.requirements.map(sentence), ...DEFAULT_RULES[input.category].map(sentence)].filter(Boolean));
  const forbidden = dedupe([...input.forbidden.map(sentence), ...DEFAULT_FORBIDDEN[input.category], COMMON_FORBIDDEN].filter(Boolean));
  const responsible = clean(input.responsible ?? "") || "Objekta meistars";
  const audience = input.audienceLabels.length ? input.audienceLabels.join(", ").toLocaleLowerCase("lv") : "visi uzņēmuma darbinieki";
  const where = input.countryName ? clean(input.countryName) : "visās valstīs, kur strādā uzņēmums";

  const out: string[] = [];
  const section = (h: string) => { if (out.length) out.push(""); out.push(`## ${h}`); };

  section("Mērķis un piemērošana");
  if (purpose) out.push(purpose);
  out.push(`- **Kam jāievēro:** ${audience}`);
  out.push(`- **Kur:** ${where}`);
  out.push("- **Spēkā:** no publicēšanas brīža platformā; iepazīšanās jāapstiprina platformā");
  out.push("? Stingrākā prasība: Ja valsts normatīvie akti vai ražotāja instrukcija nosaka stingrākas prasības, ievēro stingrāko prasību.");

  if (events.length) {
    section("Fons – notikumi");
    out.push("Šis noteikums izstrādāts, balstoties uz šādiem notikumiem un situācijām:");
    for (const e of events) out.push(`- ${sentence(e)}`);
    out.push("! Mācība: Līdzīgas situācijas var atkārtoties jebkurā objektā. Tāpēc zemāk minētās prasības ir obligātas visiem.");
  }

  section("Noteikumi");
  for (const r of requirements) out.push(`+ ${r}`);

  section("Aizliegts");
  for (const f of forbidden) out.push(`x ${sentence(f)}`);

  section("Rīcība, ja noticis negadījums");
  const steps = [...INCIDENT_STEPS[input.category], ...INCIDENT_TAIL];
  steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
  out.push("!! Ārkārtas numurs 112: Eiropas vienotais ārkārtas numurs darbojas Latvijā, Zviedrijā un Islandē. Zvani, ja ir apdraudēta dzīvība, veselība vai īpašums.");

  section("Atbildība un kontrole");
  out.push("| Loma | Atbildība |");
  out.push("| Darbinieks | Iepazīstas ar noteikumu, apstiprina to platformā un ievēro ikdienas darbā; ziņo par pārkāpumiem un bīstamām situācijām |");
  out.push(`| ${responsible} | Instruē darbiniekus, kontrolē noteikuma ievērošanu darba vietā, aptur darbu, ja tas nav drošs |`);
  out.push("| Vadība | Nodrošina resursus, pārskata noteikumu pēc incidentiem un vismaz reizi gadā |");
  out.push("");
  out.push("Noteikuma pārkāpums var būt par pamatu darba apturēšanai un disciplinārai atbildībai saskaņā ar darba kārtības noteikumiem.");

  section("Kontroljautājumi");
  const questions = [
    "Kāds ir šī noteikuma mērķis, un uz ko tas attiecas?",
    ...(events.length ? ["Kādi notikumi bija iemesls šī noteikuma ieviešanai?"] : []),
    ...input.requirements.map(noDot).filter(Boolean).slice(0, 3).map((r) => `Kā savā darbā izpildi prasību „${lcFirst(r)}”?`),
    ...(input.requirements.length ? [] : [`Kuras ir trīs svarīgākās prasības noteikumā „${title}”?`]),
    "Kuras darbības ir aizliegtas, un kāpēc?",
    "Kas jādara vispirms, ja noticis negadījums?",
    `Kas ir atbildīgs par šī noteikuma ievērošanas kontroli?`,
  ];
  questions.forEach((q, i) => out.push(`${i + 1}. ${q}`));

  const body = out.join("\n") + "\n";
  const summary = (purpose || `${title} — uzņēmuma noteikums.`).slice(0, 300);
  const words = body.split(/\s+/).length;
  return { summary, body, readingMinutes: Math.max(2, Math.round(words / 180)) };
}
