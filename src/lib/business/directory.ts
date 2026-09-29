/**
 * Standard market directory — organizations only (public company / agency info, no private
 * persons). Loaded into "Kontakti" on request; the owners then add their own contact people.
 */
export type DirectoryEntry = {
  key: string; country: "LV" | "SE" | "IS"; kind: "buyer" | "agency" | "association" | "portal" | "client";
  company: string; website: string; note: string;
};

export const MARKET_DIRECTORY: DirectoryEntry[] = [
  // Latvija
  { key: "lv-lvm", country: "LV", kind: "client", company: "AS \"Latvijas valsts meži\" (LVM)", website: "https://www.lvm.lv/biznesa-partneriem/iepirkumi", note: "Lielākais mežizstrādes un mežkopības pasūtītājs; konkursi EIS ar 1–5 gadu līgumiem." },
  { key: "lv-eis", country: "LV", kind: "portal", company: "EIS — Elektronisko iepirkumu sistēma", website: "https://www.eis.gov.lv/", note: "Reģistrēties kā piegādātājam; paziņojumi pēc CPV 77200000 / 77210000." },
  { key: "lv-storaenso", country: "LV", kind: "buyer", company: "Stora Enso Mežs (Latvija)", website: "https://forest.storaenso.com/lv-lv/sell-your-wood", note: "Pērk cirsmas un kokmateriālus; nolīgst darbuzņēmējus." },
  { key: "lv-finieris", country: "LV", kind: "buyer", company: "Latvijas Finieris", website: "https://www.finieris.com/", note: "Bērza finierkluču pircējs; piegādes un sagatavošanas līgumi." },
  { key: "lv-lmib", country: "LV", kind: "association", company: "Latvijas Meža īpašnieku biedrība (LMIB)", website: "https://mezaipasnieki.lv/en", note: "Privāto meža īpašnieku kontakti, pasākumi, sadarbības iespējas." },
  { key: "lv-mkpc", country: "LV", kind: "association", company: "LLKC Meža konsultāciju pakalpojumu centrs", website: "https://llkc.lv/noderigi/par-meza-konsultaciju-pakalpojumu-centru/", note: "Konsultē privātos īpašniekus — vērtīgs ieteikumu avots." },
  { key: "lv-vmd", country: "LV", kind: "agency", company: "Valsts meža dienests (VMD)", website: "https://www.vmd.gov.lv/", note: "Ciršanas apliecinājumi, MVR atvērtie dati (nogabali, CC0)." },
  // Zviedrija
  { key: "se-sveaskog", country: "SE", kind: "client", company: "Sveaskog", website: "https://www.sveaskog.se/om-sveaskog/upphandling/", note: "Valsts mežu uzņēmums — iepērk skogsentreprenörer." },
  { key: "se-sca", country: "SE", kind: "client", company: "SCA Skog", website: "https://www.sca.com/skog/entreprenor", note: "> 150 darbuzņēmēju Ziemeļzviedrijā." },
  { key: "se-holmen", country: "SE", kind: "client", company: "Holmen Skog", website: "https://www.holmen.com/sv/skog/om-oss/vart-skogsbruk/samarbeta-med-oss/", note: "\"Skogsentreprenör? Se hit\" — pieteikšanās darbuzņēmējiem." },
  { key: "se-sodra", country: "SE", kind: "client", company: "Södra", website: "https://www.sodra.com/", note: "Meža īpašnieku kooperatīvs Dienvidzviedrijā — liels darbuzņēmēju pasūtītājs." },
  { key: "se-norraskog", country: "SE", kind: "client", company: "Norra Skog", website: "https://www.norraskog.se/om-oss/entreprenorer/", note: "Meža īpašnieku kooperatīvs Ziemeļzviedrijā." },
  { key: "se-mellanskog", country: "SE", kind: "client", company: "Mellanskog", website: "https://www.mellanskog.se/om-mellanskog/det-har-ar-vi/var-affarsmodell/", note: "Katrs trešais meža īpašnieks Vidus-Zviedrijā." },
  { key: "se-storaenso", country: "SE", kind: "client", company: "Stora Enso Skog", website: "https://www.storaenso.com/", note: "Iepērk mežizstrādi no darbuzņēmējiem." },
  { key: "se-skogligaentr", country: "SE", kind: "portal", company: "Skogligaentreprenorer.se", website: "https://www.skogligaentreprenorer.se/", note: "Uzdevumu tirgus mežu darbiem." },
  { key: "se-skogsentr", country: "SE", kind: "association", company: "Skogsentreprenörerna", website: "https://www.skogsentreprenorerna.se/", note: "Darbuzņēmēju asociācija — tirgus, cenas, kontakti." },
  { key: "se-skogsstyrelsen", country: "SE", kind: "agency", company: "Skogsstyrelsen", website: "https://www.skogsstyrelsen.se/", note: "Ciršanas pieteikumi (avverkningsanmälningar) — publiski dati." },
  // Islande
  { key: "is-landogskogur", country: "IS", kind: "client", company: "Land og skógur", website: "https://island.is/s/land-og-skogur", note: "Valsts mežu un augsnes aģentūra — apmežošanas un kopšanas darbi." },
  { key: "is-utbod", country: "IS", kind: "portal", company: "Útboðsvefur.is", website: "https://utbodsvefur.is/", note: "Islandes valsts iepirkumu portāls." },
  { key: "is-skog", country: "IS", kind: "association", company: "Skógræktarfélag Íslands", website: "https://www.skog.is/", note: "Vietējo mežu biedrību savienība." },
  { key: "is-lse", country: "IS", kind: "association", company: "Landssamtök skógareigenda (LSE)", website: "https://www.skogarbondi.is/um-lse", note: "Meža īpašnieki / skógarbændur." },
];
