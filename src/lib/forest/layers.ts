/**
 * Meža karte — publisko, bezmaksas un legāli lietojamo karšu slāņu katalogs
 * (Latvija, Zviedrija, Islande + globālie slāņi) MapLibre GL JS raster avotiem.
 *
 * Izpēte veikta 2026-09-28. `verified: true` nozīmē, ka tika atvērts servisa
 * GetCapabilities / ArcGIS REST JSON (vai export ar bboxSR=3857 atgrieza
 * wkid 102100/3857) un slāņa nosaukums + EPSG:3857 atbalsts ir apstiprināts.
 * `verified: false` — endpoint un slāņa nosaukums ņemts no oficiālas
 * dokumentācijas / metadatiem / JOSM imagery saraksta, bet GetCapabilities
 * no izpētes vides nebija sasniedzams (robots.txt / ģeobloķēšana).
 *
 * URL veidnes:
 *  - WMS: ...&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&CRS=EPSG:3857 (1.3.0)
 *    vai &SRS=EPSG:3857 (1.1.1).
 *  - ArcGIS REST MapServer "export" (Skogsstyrelsen, DAP OZOLS): Skogsstyrelsen
 *    WMS GetCapabilities NEPIEDĀVĀ EPSG:3857 (tikai 4326 + SWEREF99 zonas),
 *    tāpēc izmantojam REST export ar bboxSR=3857&imageSR=3857 — serveris
 *    pārprojicē "on the fly" (pārbaudīts: atbilde extent.spatialReference
 *    wkid 102100 / latestWkid 3857).
 *  - XYZ: {z}/{x}/{y}.
 *
 * CORS: MapLibre ielādē rastra flīzes ar fetch(), tāpēc serverim jāatgriež
 * Access-Control-Allow-Origin. Izpētes vidē HTTP galvenes nebija redzamas,
 * tāpēc visur `cors: "unknown"` — pārbaudīt pārlūkā; ja kāds serveris CORS
 * neatļauj, pievienot caur mūsu Next.js proxy maršrutu.
 *
 * NAV iekļauts (apzināti):
 *  - Lantmäteriet "Topografisk webbkarta Visning, översiktlig" (CC0, EPSG:3857
 *    atbalsts, https://api.lantmateriet.se/open/topowebb-ccby/v1/wmts) — prasa
 *    bezmaksas API atslēgu no Geotorget un produkts tiek slēgts 2026-12-31.
 *    Pievienot tikai ar servera pusē glabātu atslēgu (proxy).
 *  - Zviedrijas īpašumu robežas (Lantmäteriet Fastighetsindelning) — NAV atvērti
 *    dati; nepieciešams līgums/maksas licence.
 *  - Skogsstyrelsen Trädhöjd / Markfuktighet WMS — prasa "Samverkan" kontu.
 *  - LĢIA tiešie WMS (wms.lgia.gov.lv) jaunākajiem cikliem — prasa licences
 *    līgumu (e-pieteikumi.lgia.gov.lv); tos pašus ortofoto publiski izplata
 *    LVM GEO brīvpieejas WMS (zemāk).
 *  - VZD "Kadastra kartes WMS tīmekļa pakalpe" — pēc pieprasījuma/līguma.
 *    VZD kadastra telpiskie dati ir atvērti (CC BY 4.0, SHP, reizi nedēļā) —
 *    https://data.gov.lv/dati/lv/dataset/kadastra-informacijas-sistemas-atverti-telpiskie-dati
 *    — var importēt paši un pasniegt kā vektorflīzes. Publiski WMS: LVM GEO.
 *  - VMD Meža valsts reģistra dati (nogabali) — atvērti CC0, bet TIKAI SHP
 *    lejupielāde reizi ceturksnī (https://data.gov.lv/dati/lv/dataset/meza-valsts-registra-meza-dati),
 *    WMS nav. Ciršanas apliecinājumi kā atvērta datu kopa netiek publicēti.
 *  - Sentinel-2 cloudless (EOX) — CC BY-NC-SA, komerciāli nelietojams.
 */

export type ForestLayer = {
  id: string;
  country: "LV" | "SE" | "IS" | "GLOBAL";
  group: "base" | "forest" | "cadastre" | "protected" | "felling" | "change";
  name: string; // Latvian UI name
  description: string; // Latvian, 1–2 sentences
  tiles: string[];
  tileSize: 256;
  minzoom?: number;
  maxzoom?: number;
  attribution: string;
  license: string;
  sourceUrl: string;
  defaultOpacity: number; // 0..1
  verified: boolean;
  cors?: "yes" | "unknown";
};

/* ------------------------------------------------------------------ helpers */

type WmsOpts = {
  layers: string;
  version?: "1.1.1" | "1.3.0";
  format?: string;
  transparent?: boolean;
  styles?: string;
};

/** WMS GetMap flīzes veidne EPSG:3857 (MapLibre aizvieto {bbox-epsg-3857}). */
function wms(base: string, o: WmsOpts): string {
  const version = o.version ?? "1.3.0";
  const crsKey = version === "1.3.0" ? "CRS" : "SRS";
  const sep = base.includes("?") ? (base.endsWith("?") || base.endsWith("&") ? "" : "&") : "?";
  return (
    `${base}${sep}SERVICE=WMS&REQUEST=GetMap&VERSION=${version}` +
    `&LAYERS=${encodeURIComponent(o.layers)}&STYLES=${o.styles ?? ""}` +
    `&FORMAT=${encodeURIComponent(o.format ?? "image/png")}` +
    `&TRANSPARENT=${o.transparent === false ? "false" : "true"}` +
    `&${crsKey}=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}`
  );
}

/** ArcGIS Server MapServer/export flīzes veidne ar pārprojicēšanu uz EPSG:3857. */
function arcgisExport(mapServerUrl: string, layers?: string): string {
  return (
    `${mapServerUrl}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857` +
    `&size=256,256&dpi=96&format=png32&transparent=true` +
    (layers ? `&layers=${encodeURIComponent(layers)}` : "") +
    `&f=image`
  );
}

const SKS_REST = "https://geodpags.skogsstyrelsen.se/arcgis/rest/services/Geodataportal";
const SKS_ATTR = "© Skogsstyrelsen";
const SKS_LICENSE = "CC0 1.0 (Skogsstyrelsen; lūdz norādīt avotu)";
const _SKS_TERMS = "https://www.skogsstyrelsen.se/e-tjanster-och-kartor/karttjanster/geodatatjanster/villkor/";

// LVM GEO brīvpieejas servisi (publicēti https://www.lvmgeo.lv/dati/tabmenu-two/brivpieejas-wms-wfs-servisi)
const LVM_WMS = "https://geoserver.lvmgeo.lv/wms62531a9bfcfa4015856924e94076a178";
const LVM_WMS_VECTOR = "https://geoserver.lvmgeo.lv/wmsvector62531a9bfcfa4015856924e94076a179";
const LVM_LICENSE = "LVM GEO brīvpieejas dati (izglītībai, pētniecībai un lietotņu izstrādei; LĢIA/VZD pirmdati CC BY 4.0) — komerciālai SaaS lietošanai apstiprināt ar LVM GEO";
const LVM_SOURCE = "https://www.lvmgeo.lv/dati/tabmenu-two/brivpieejas-wms-wfs-servisi";

const OZOLS = "https://ozols.gov.lv/arcgis/rest/services/OZOLS_DABASDATI_PUB_DATU_APMAINA/MapServer";

/* ------------------------------------------------------------------ catalog */

export const FOREST_LAYERS: ForestLayer[] = [
  /* =============================== GLOBAL ================================= */
  {
    id: "global-esri-imagery",
    country: "GLOBAL",
    group: "base",
    name: "Satelītattēls (Esri World Imagery)",
    description:
      "Augstas izšķirtspējas satelīta/aerofoto pamatne visai pasaulei. Ļauj ātri novērtēt audzi, pievedceļus un krautuvju vietas pirms objekta apskates.",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    maxzoom: 19,
    attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    license: "Esri lietošanas noteikumi (bez maksas ar atribūciju; lielai komerciālai slodzei nepieciešams ArcGIS konts)",
    sourceUrl: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9",
    defaultOpacity: 1,
    verified: false,
    cors: "unknown",
  },
  {
    id: "global-osm",
    country: "GLOBAL",
    group: "base",
    name: "OpenStreetMap karte",
    description:
      "Ceļi, ciemi un meža ceļi no OpenStreetMap. Noder loģistikai — kā piebraukt ar tehniku un kokvedēju.",
    // OSMF Tile Usage Policy: tikai interaktīvai skatīšanai, obligāta atribūcija,
    // aizliegta priekšielāde/offline; komerciāli atļauts, bet piekļuvi var atsaukt.
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    tileSize: 256,
    maxzoom: 19,
    attribution: "© OpenStreetMap contributors",
    license: "ODbL 1.0 (dati); OSMF Tile Usage Policy (flīzes)",
    sourceUrl: "https://operations.osmfoundation.org/policies/tiles/",
    defaultOpacity: 1,
    verified: true,
    cors: "unknown",
  },
  {
    id: "global-gfw-tree-cover-loss",
    country: "GLOBAL",
    group: "change",
    name: "Koku seguma zudums 2021–2025 (GFW / UMD)",
    description:
      "Hansen/UMD 30 m koku seguma zuduma pikseļi (v1.13, dati līdz 2025. g.) — faktiski redzamas nesen veiktās kailcirtes un vējgāzes. Palīdz atrast aktīvos mežizstrādes reģionus un potenciālos klientus atjaunošanai.",
    // Dinamiskais endpoint ar render_type=true_color (noklusējums "encoded" ir datu flīzes WebGL dekodēšanai).
    tiles: [
      "https://tiles.globalforestwatch.org/umd_tree_cover_loss/v1.13/dynamic/{z}/{x}/{y}.png?start_year=2021&end_year=2025&tree_cover_density_threshold=30&render_type=true_color",
    ],
    tileSize: 256,
    maxzoom: 12,
    attribution: "Hansen/UMD/Google/USGS/NASA, via Global Forest Watch",
    license: "CC BY 4.0",
    sourceUrl: "https://data.globalforestwatch.org/documents/gfw::tree-cover-loss/about",
    defaultOpacity: 0.85,
    verified: true,
    cors: "unknown",
  },
  {
    id: "global-esa-worldcover-2021",
    country: "GLOBAL",
    group: "forest",
    name: "Zemes segums 10 m (ESA WorldCover 2021)",
    description:
      "10 m zemes seguma klasifikācija (koku segums, krūmāji, zālāji, mitrāji u.c.). Noder, lai novērtētu meža masīvus un aizaugušas lauksaimniecības zemes apmežošanai vai tīrīšanai.",
    tiles: [
      wms("https://mapproxy.terrascope.be/mapproxy/service", {
        layers: "esa-worldcover-map-10m-2021-v2_map",
      }),
    ],
    tileSize: 256,
    maxzoom: 16,
    attribution: "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
    license: "CC BY 4.0",
    sourceUrl: "https://esa-worldcover.org/en/data-access",
    defaultOpacity: 0.7,
    verified: true,
    cors: "unknown",
  },
  {
    id: "global-esa-worldcover-s2-fcc-2021",
    country: "GLOBAL",
    group: "forest",
    name: "Sentinel-2 viltus krāsu mozaīka 2021",
    description:
      "Bezmākoņu Sentinel-2 NIR viltus krāsu kompozīts (veģetācija sarkanā). Skujkoku un lapu koku audzes, izcirtumi un jaunaudzes kontrastē daudz labāk nekā dabiskās krāsās.",
    tiles: [
      wms("https://mapproxy.terrascope.be/mapproxy/service", {
        layers: "esa-worldcover-s2rgbnir-10m-2021-v2_fcc",
        transparent: false,
      }),
    ],
    tileSize: 256,
    maxzoom: 16,
    attribution: "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
    license: "CC BY 4.0",
    sourceUrl: "https://docs.terrascope.be/DataProducts/WorldCover/WorldCover.html",
    defaultOpacity: 1,
    verified: true,
    cors: "unknown",
  },
  {
    id: "global-hrl-tree-cover-density-2018",
    country: "GLOBAL",
    group: "forest",
    name: "Koku vainagu biezība 2018 (Copernicus HRL)",
    description:
      "Copernicus 10 m koku vainagu seguma blīvums 0–100 % visā Eiropā (ieskaitot Islandi). Ātri parāda biezas, ciršanai gatavas audzes pret retām vai jaunām platībām.",
    tiles: [
      wms("https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_TreeCoverDensity_2018/ImageServer/WMSServer", {
        layers: "HRL_TreeCoverDensity_2018",
      }),
    ],
    tileSize: 256,
    maxzoom: 15,
    attribution: "© European Union, Copernicus Land Monitoring Service 2018, European Environment Agency (EEA)",
    license: "Copernicus atvērtie dati (bezmaksas, jebkuram mērķim ar atribūciju)",
    sourceUrl: "https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_TreeCoverDensity_2018/ImageServer/WMSServer?request=GetCapabilities&service=WMS",
    defaultOpacity: 0.7,
    verified: true,
    cors: "unknown",
  },
  {
    id: "global-hrl-forest-type-2018",
    country: "GLOBAL",
    group: "forest",
    name: "Meža tips 2018 (Copernicus HRL)",
    description:
      "Copernicus 10 m karte: skujkoku pret lapu koku mežs. Palīdz plānot sortimentus un atrast bērzu/apšu masīvus finiera un malkas pircējiem.",
    tiles: [
      wms("https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_ForestType_2018/ImageServer/WMSServer", {
        layers: "HRL_ForestType_2018",
      }),
    ],
    tileSize: 256,
    maxzoom: 15,
    attribution: "© European Union, Copernicus Land Monitoring Service 2018, European Environment Agency (EEA)",
    license: "Copernicus atvērtie dati (bezmaksas, jebkuram mērķim ar atribūciju)",
    sourceUrl: "https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_ForestType_2018/ImageServer/WMSServer?request=GetCapabilities&service=WMS",
    defaultOpacity: 0.7,
    verified: true,
    cors: "unknown",
  },
  {
    id: "global-natura2000",
    country: "GLOBAL",
    group: "protected",
    name: "Natura 2000 teritorijas (EEA)",
    description:
      "ES Natura 2000 (Putnu un Biotopu direktīvas) teritoriju robežas LV un SE. Pirms piedāvājuma pārbaudi, vai cirsma nav Natura 2000 — tur ciršana ierobežota vai jāsaskaņo.",
    tiles: [
      wms("https://bio.discomap.eea.europa.eu/arcgis/services/ProtectedSites/Natura2000Sites/MapServer/WMSServer", {
        layers: "1,2",
      }),
    ],
    tileSize: 256,
    minzoom: 5,
    attribution: "© European Environment Agency (EEA), Natura 2000",
    license: "EEA standarta atkalizmantošana (CC BY 4.0)",
    sourceUrl: "https://bio.discomap.eea.europa.eu/arcgis/services/ProtectedSites/Natura2000Sites/MapServer/WMSServer?request=GetCapabilities&service=WMS",
    defaultOpacity: 0.6,
    verified: true,
    cors: "unknown",
  },

  /* ================================ LATVIJA =============================== */
  {
    id: "lv-orto-lvm",
    country: "LV",
    group: "base",
    name: "LĢIA ortofoto (LVM GEO)",
    description:
      "Jaunākā LĢIA krāsainā ortofoto mozaīka 1:5000 (7.–8. cikls) caur LVM GEO brīvpieejas WMS. Detalizēti redzamas cirsmas, stigas un krautuves.",
    tiles: [wms(LVM_WMS, { layers: "public:Orto_LKS", format: "image/jpeg", transparent: false })],
    tileSize: 256,
    minzoom: 7,
    maxzoom: 19,
    attribution: "AS Latvijas valsts meži (LVM GEO) atvērtais WMS: LĢIA ortofotokarte",
    license: LVM_LICENSE,
    sourceUrl: LVM_SOURCE,
    defaultOpacity: 1,
    verified: false,
    cors: "unknown",
  },
  {
    id: "lv-orto8-lvm",
    country: "LV",
    group: "base",
    name: "LĢIA ortofoto 2022–2024 (8. cikls)",
    description:
      "8. cikla ortofoto (2022–2024). Salīdzinot ar vecākiem cikliem, redzams, kur nesen cirsts un kur aug jaunaudzes, kam drīz vajadzēs kopšanu.",
    tiles: [wms(LVM_WMS, { layers: "public:Orto_8cikls", format: "image/jpeg", transparent: false })],
    tileSize: 256,
    minzoom: 7,
    maxzoom: 19,
    attribution: "AS Latvijas valsts meži (LVM GEO) atvērtais WMS: LĢIA ortofotokarte 2022–2024",
    license: LVM_LICENSE,
    sourceUrl: LVM_SOURCE,
    defaultOpacity: 1,
    verified: false,
    cors: "unknown",
  },
  {
    id: "lv-topo50-lvm",
    country: "LV",
    group: "base",
    name: "Topogrāfiskā karte 1:50 000 (LĢIA)",
    description:
      "LĢIA topogrāfiskā karte M 1:50 000 (2. izdevums). Parāda mežu masīvus, grāvjus, purvus un ceļu klases — noderīga maršrutiem un apjomu novērtēšanai.",
    tiles: [wms(LVM_WMS, { layers: "public:Topo50", transparent: false })],
    tileSize: 256,
    minzoom: 7,
    maxzoom: 16,
    attribution: "AS Latvijas valsts meži (LVM GEO) atvērtais WMS: LĢIA topogrāfiskā karte M 1:50 000",
    license: LVM_LICENSE,
    sourceUrl: LVM_SOURCE,
    defaultOpacity: 1,
    verified: false,
    cors: "unknown",
  },
  {
    id: "lv-dtm-lvm",
    country: "LV",
    group: "base",
    name: "Reljefs / DTM (LVM GEO 2022)",
    description:
      "Digitālais reljefa modelis no LĢIA lāzerskenēšanas. Atklāj slapjās ieplakas, grāvjus un nogāzes — svarīgi forvardera trasēm un sezonas (sausa/sasalusi zeme) plānošanai.",
    tiles: [wms(LVM_WMS, { layers: "public:ZemeLKS2", format: "image/jpeg", transparent: false })],
    tileSize: 256,
    minzoom: 9,
    maxzoom: 18,
    attribution: "AS Latvijas valsts meži (LVM GEO) atvērtais WMS: DTM no LĢIA virsmas modeļa datiem, 2022",
    license: LVM_LICENSE,
    sourceUrl: LVM_SOURCE,
    defaultOpacity: 0.6,
    verified: false,
    cors: "unknown",
  },
  {
    id: "lv-kadastrs-lvm",
    country: "LV",
    group: "cadastre",
    name: "Kadastra karte (zemes vienību robežas)",
    description:
      "VZD atvērto kadastra datu zemes vienību robežas (LVM GEO vektora WMS). Ļauj noteikt cirsmas zemes vienību un kadastra numuru, lai sazinātos ar īpašnieku vai pārbaudītu robežas pirms darbiem.",
    tiles: [wms(LVM_WMS_VECTOR, { layers: "Kadastra_karte" })],
    tileSize: 256,
    minzoom: 12,
    maxzoom: 19,
    attribution: "AS Latvijas valsts meži (LVM GEO) atvērtais WMS: kadastra karte no VZD atvērtajiem datiem",
    license: "VZD atvērtie dati CC BY 4.0; WMS — " + LVM_LICENSE,
    sourceUrl: "https://data.gov.lv/dati/lv/dataset/kadastra-informacijas-sistemas-atverti-telpiskie-dati",
    defaultOpacity: 0.9,
    verified: false,
    cors: "unknown",
  },
  {
    id: "lv-ozols-iadt",
    country: "LV",
    group: "protected",
    name: "Īpaši aizsargājamās dabas teritorijas (DAP OZOLS)",
    description:
      "Dabas aizsardzības pārvaldes ĪADT robežas (dabas liegumi, parki, rezervāti, t.sk. Natura 2000). Pārbaudi pirms cirsmas pirkšanas vai darbu līguma — ierobežojumi ietekmē cenu un termiņus.",
    tiles: [arcgisExport(OZOLS, "show:3,4")],
    tileSize: 256,
    minzoom: 7,
    attribution: "© Dabas aizsardzības pārvalde, Dabas datu pārvaldības sistēma OZOLS",
    license: "Atvērtie dati CC0 1.0 (data.gov.lv)",
    sourceUrl: "https://www.daba.gov.lv/lv/dabas-datu-sistema-ozols-0",
    defaultOpacity: 0.6,
    verified: true,
    cors: "unknown",
  },
  {
    id: "lv-ozols-mikroliegumi",
    country: "LV",
    group: "protected",
    name: "Mikroliegumi un buferzonas (DAP OZOLS)",
    description:
      "Mikroliegumi un to buferzonas, kur mežsaimnieciska darbība aizliegta vai ierobežota. Obligāti jāpārbauda katrai cirsmai, lai izvairītos no sodiem un FSC/PEFC neatbilstībām.",
    tiles: [arcgisExport(OZOLS, "show:0,1,2")],
    tileSize: 256,
    minzoom: 10,
    attribution: "© Dabas aizsardzības pārvalde, Dabas datu pārvaldības sistēma OZOLS",
    license: "Atvērtie dati CC0 1.0 (data.gov.lv)",
    sourceUrl: "https://data.gov.lv/dati/dataset/mikroliegumi",
    defaultOpacity: 0.7,
    verified: true,
    cors: "unknown",
  },

  /* ================================ ZVIEDRIJA ============================= */
  {
    id: "se-sks-avverkningsanmalan",
    country: "SE",
    group: "felling",
    name: "Ciršanas pieteikumi (Avverkningsanmälan)",
    description:
      "Skogsstyrelsen reģistrētie ciršanas pieteikumi; 'jauni' = saņemti pēdējo 42 dienu laikā. Galvenais potenciālo darbu avots — šīs platības drīz tiks cirstas, un īpašniekam vajag izpildītāju vai pircēju.",
    tiles: [arcgisExport(`${SKS_REST}/GeodataportalVisaAvverkningsanmalan/MapServer`)],
    tileSize: 256,
    minzoom: 8,
    attribution: SKS_ATTR,
    license: SKS_LICENSE,
    sourceUrl: "https://www.skogsstyrelsen.se/laddanergeodata",
    defaultOpacity: 0.8,
    verified: true,
    cors: "unknown",
  },
  {
    id: "se-sks-utford-avverkning",
    country: "SE",
    group: "felling",
    name: "Veiktās cirtes (Utförd avverkning)",
    description:
      "Satelītu konstatētās faktiski veiktās cirtes (šogad un vēsturiski). Svaigi izcirtumi = tuvākajos 1–3 gados vajadzīga augsnes sagatavošana, stādīšana un vēlāk kopšana.",
    tiles: [arcgisExport(`${SKS_REST}/GeodataportalVisaUtfordavverkning/MapServer`)],
    tileSize: 256,
    minzoom: 6,
    attribution: SKS_ATTR,
    license: SKS_LICENSE,
    sourceUrl: "https://www.skogsstyrelsen.se/laddanergeodata",
    defaultOpacity: 0.8,
    verified: true,
    cors: "unknown",
  },
  {
    id: "se-sks-skogliga-grunddata-volym",
    country: "SE",
    group: "forest",
    name: "Krāja m³/ha (Skogliga grunddata)",
    description:
      "Lāzerskenēšanā aprēķinātā koksnes krāja (m³sk/ha) 12,5 m rastrā. Ļauj novērtēt cirsmas apjomu un vērtību pirms braukšanas uz objektu.",
    // ImageServer exportImage ar raster funkciju "Volym_gron" (no Skogsstyrelsen tehniskā apraksta).
    // Host geodata.skogsstyrelsen.se izpētes vidē nebija sasniedzams — pārbaudīt pārlūkā.
    tiles: [
      "https://geodata.skogsstyrelsen.se/arcgis/rest/services/Publikt/SkogligaGrunddata_3_1/ImageServer/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png&renderingRule=%7B%22rasterFunction%22%3A%22Volym_gron%22%7D&f=image",
    ],
    tileSize: 256,
    minzoom: 10,
    attribution: SKS_ATTR,
    license: SKS_LICENSE,
    sourceUrl:
      "https://www.skogsstyrelsen.se/globalassets/sjalvservice/karttjanster/geodatatjanster/teknisk-beskrivning/skogliga-grunddata---teknisk-beskrivning.pdf",
    defaultOpacity: 0.7,
    verified: false,
    cors: "unknown",
  },
  {
    id: "se-sks-nyckelbiotop",
    country: "SE",
    group: "protected",
    name: "Atslēgas biotopi (Nyckelbiotoper)",
    description:
      "Skogsstyrelsen inventarizētie atslēgas biotopi. Sertificēti (FSC/PEFC) pircēji tur necērt — pārbaudi pirms piedāvājuma.",
    tiles: [arcgisExport(`${SKS_REST}/GeodataportalVisaNyckelbiotop/MapServer`)],
    tileSize: 256,
    minzoom: 8,
    attribution: SKS_ATTR,
    license: SKS_LICENSE,
    sourceUrl: "https://www.skogsstyrelsen.se/e-tjanster-och-kartor/karttjanster/skogens-parlor/",
    defaultOpacity: 0.7,
    verified: true,
    cors: "unknown",
  },
  {
    id: "se-sks-objekt-naturvarde",
    country: "SE",
    group: "protected",
    name: "Augstas dabas vērtības objekti (Naturvärden)",
    description:
      "Objekti ar augstām dabas vērtībām (zem atslēgas biotopa līmeņa). Nozīmē papildu saskaņošanu un iespējamus ierobežojumus ciršanai.",
    tiles: [arcgisExport(`${SKS_REST}/GeodataportalVisaObjektnaturvarde/MapServer`)],
    tileSize: 256,
    minzoom: 8,
    attribution: SKS_ATTR,
    license: SKS_LICENSE,
    sourceUrl: "https://www.skogsstyrelsen.se/e-tjanster-och-kartor/karttjanster/skogens-parlor/",
    defaultOpacity: 0.7,
    verified: true,
    cors: "unknown",
  },
  {
    id: "se-sks-biotopskydd",
    country: "SE",
    group: "protected",
    name: "Biotopu aizsardzības platības (Biotopskydd)",
    description:
      "Skogsstyrelsen noteiktās biotopu aizsardzības teritorijas, kur mežsaimniecība aizliegta.",
    tiles: [arcgisExport(`${SKS_REST}/GeodataportalVisaBiotopskydd/MapServer`)],
    tileSize: 256,
    minzoom: 8,
    attribution: SKS_ATTR,
    license: SKS_LICENSE,
    sourceUrl: "https://www.skogsstyrelsen.se/laddanergeodata",
    defaultOpacity: 0.7,
    verified: true,
    cors: "unknown",
  },
  {
    id: "se-sks-sumpskog",
    country: "SE",
    group: "forest",
    name: "Pārmitri meži (Sumpskog)",
    description:
      "Purvaini un pārmitri meži. Norāda, kur tehnikai vajag sasalušu zemi vai ciršanu ziemā un kur jāuzmanās no sliežu bojājumiem.",
    tiles: [arcgisExport(`${SKS_REST}/GeodataportalVisaSumpskog/MapServer`)],
    tileSize: 256,
    minzoom: 10,
    attribution: SKS_ATTR,
    license: SKS_LICENSE,
    sourceUrl: "https://www.skogsstyrelsen.se/e-tjanster-och-kartor/karttjanster/skogens-parlor/",
    defaultOpacity: 0.6,
    verified: true,
    cors: "unknown",
  },
  {
    id: "se-nv-skyddade-omraden",
    country: "SE",
    group: "protected",
    name: "Aizsargājamās teritorijas (Naturvårdsverket)",
    description:
      "Nacionālie parki, dabas rezervāti, dabas aizsardzības un biotopu aizsardzības zonas no Naturvårdsregistret. Pārbaudi pirms darba pieņemšanas.",
    tiles: [
      wms("https://geodata.naturvardsverket.se/naturvardsregistret/wms", {
        layers: "Nationalpark,Naturreservat,Naturreservat_kommunalt,Naturvardsomrade,Ovrigt_biotopskyddsomrade",
      }),
    ],
    tileSize: 256,
    minzoom: 6,
    attribution: "© Naturvårdsverket, Naturvårdsregistret",
    license: "Atvērti pieejams (metadatos: nosacījumi nav norādīti; Naturvårdsverket parasti CC0)",
    sourceUrl: "https://skyddadnatur.naturvardsverket.se/",
    defaultOpacity: 0.6,
    verified: true,
    cors: "unknown",
  },

  /* ================================ ISLANDE =============================== */
  {
    id: "is-lmi-kort",
    country: "IS",
    group: "base",
    name: "Islandes pamatkarte (LMÍ)",
    description:
      "Landmælingar Íslands (tagad Náttúrufræðistofnun) topogrāfiskā pamatkarte Web Mercator projekcijā. Ceļi, apdzīvotas vietas, reljefs.",
    tiles: [
      wms("https://gis.lmi.is/mapcache/web-mercator/", {
        layers: "LMI_Kort",
        version: "1.1.1",
      }),
    ],
    tileSize: 256,
    maxzoom: 19,
    attribution: "Inniheldur gögn frá Landmælingum Íslands / Náttúrufræðistofnun",
    license: "CC BY 4.0",
    sourceUrl: "https://www-gamli.lmi.is/landupplysingar/leyfi-fyrir-gjaldfrjals-gogn/",
    defaultOpacity: 1,
    verified: false,
    cors: "unknown",
  },
  {
    id: "is-lmi-dem-hillshade",
    country: "IS",
    group: "base",
    name: "Islandes reljefa ēnojums (LMÍ DEM)",
    description:
      "Reljefa ēnojums no Íslands DEM. Stāvās nogāzes Islandē būtiski ietekmē stādīšanas un ciršanas tehnoloģiju un izmaksas.",
    tiles: [
      wms("https://gis.lmi.is/mapcache/web-mercator/", {
        layers: "IslandsDEMDaylight",
        version: "1.1.1",
      }),
    ],
    tileSize: 256,
    maxzoom: 15,
    attribution: "Inniheldur gögn frá Landmælingum Íslands / Náttúrufræðistofnun (Íslands DEM)",
    license: "CC BY 4.0",
    sourceUrl: "https://www-gamli.lmi.is/landupplysingar/leyfi-fyrir-gjaldfrjals-gogn/",
    defaultOpacity: 0.6,
    verified: false,
    cors: "unknown",
  },
  {
    id: "is-los-birkilendi",
    country: "IS",
    group: "forest",
    name: "Dabiskie bērzu meži (Land og skógur)",
    description:
      "Visi Islandes dabiskie bērzu meži un birzis (~150 600 ha, kartēti 2010–2014). Parāda esošo meža segumu, kur iespējama kopšana un blakus esošas apmežošanas platības.",
    tiles: [
      wms("https://gis.is/geoserver/land_og_skogur/wms", {
        layers: "natturulegt_birkilendi",
      }),
    ],
    tileSize: 256,
    minzoom: 6,
    attribution: "© Land og skógur (Náttúrulegt birki á Íslandi)",
    license: "Atvērti un pieejami visiem; aizliegts datus pārdot trešajām personām",
    sourceUrl: "https://gatt.lmi.is/geonetwork/srv/api/records/%7B5AF2B0EC-47E7-4D88-8821-BF2462674862%7D",
    defaultOpacity: 0.7,
    verified: false,
    cors: "unknown",
  },
  {
    id: "is-fridlyst-svaedi",
    country: "IS",
    group: "protected",
    name: "Aizsargājamās teritorijas (Friðlýst svæði)",
    description:
      "Islandes aizsargājamās dabas teritorijas (nacionālie parki, dabas rezervāti u.c.). Pārbaudi pirms stādīšanas vai ciršanas projekta.",
    tiles: [
      wms("https://gis.ust.is/geoserver/ows", {
        layers: "fridlyst_svaedi:fridlyst_svaedi",
      }),
    ],
    tileSize: 256,
    minzoom: 5,
    attribution: "© Umhverfis- og orkustofnun (agr. Umhverfisstofnun) — Friðlýst svæði",
    license: "Bez lietošanas ierobežojumiem, jānorāda avots; robežas nedrīkst mainīt",
    sourceUrl: "https://gatt.lmi.is/geonetwork/srv/api/records/%7B6D940937-15DB-4D50-833B-37D2F2AB1207%7D",
    defaultOpacity: 0.6,
    verified: false,
    cors: "unknown",
  },
];

/* --------------------------------------------------------------- map views */

export const COUNTRY_VIEW: Record<
  "LV" | "SE" | "IS",
  { center: [number, number]; zoom: number; bounds: [number, number, number, number] }
> = {
  // bounds: [west, south, east, north] (WGS84)
  LV: { center: [24.6, 56.88], zoom: 6.6, bounds: [20.97, 55.67, 28.24, 58.09] },
  SE: { center: [16.5, 62.5], zoom: 4.3, bounds: [10.96, 55.34, 24.17, 69.06] },
  IS: { center: [-18.6, 64.95], zoom: 5.6, bounds: [-24.55, 63.29, -13.49, 66.57] },
};

export function layersForCountry(country: "LV" | "SE" | "IS"): ForestLayer[] {
  return FOREST_LAYERS.filter((l) => l.country === country || l.country === "GLOBAL");
}
