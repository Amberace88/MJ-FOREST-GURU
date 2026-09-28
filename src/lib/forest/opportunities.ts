/**
 * Biznesa attīstības ceļvedis: kur atrast mežsaimniecības darbus, līgumus un
 * klientus (Latvija, Zviedrija, Islande). Izpēte veikta 2026-09-28.
 * Visi `url` ir pārbaudīti (lapa eksistē izpētes brīdī). Cenas un termiņi —
 * orientējoši; pirms piedāvājuma pārbaudīt aktuālos datus.
 */

export type Opportunity = {
  title: string;
  text: string;
  url?: string;
  kind: "tender" | "buyer" | "registry" | "association" | "tip";
};

export const OPPORTUNITIES: Record<
  "LV" | "SE" | "IS",
  { headline: string; market: string; items: Opportunity[] }
> = {
  /* ================================ LATVIJA =============================== */
  LV: {
    headline: "Latvija — LVM konkursi + privāto mežu īpašnieki",
    market:
      "Lielākais pasūtītājs ir AS “Latvijas valsts meži” (LVM), kas mežizstrādi un mežkopības darbus iepērk atklātos konkursos EIS sistēmā ar 1–5 gadu līgumiem. Otrs lielais tirgus — privātie meža īpašnieki (≈ puse no mežiem), kuriem vajag izpildītāju cirsmām, stādīšanai un kopšanai, un kokrūpniecības uzņēmumi, kas pērk cirsmas un nolīgst darbuzņēmējus.",
    items: [
      {
        kind: "tender",
        title: "LVM iepirkumi (izsludināti / vērtēšanā / noslēgti)",
        text: "LVM iepirkumu saraksts: meža ceļi, meža aizsardzība, mežkopības un mežizstrādes pakalpojumi pa reģioniem. Sekot sadaļai “Izsludināti” un noslēgto līgumu sadaļā redzēt, kas uzvar un par kādu cenu.",
        url: "https://www.lvm.lv/biznesa-partneriem/iepirkumi",
      },
      {
        kind: "tender",
        title: "EIS — Elektronisko iepirkumu sistēma",
        text: "Visi LVM un pašvaldību konkursi tiek iesniegti EIS. Reģistrēties kā piegādātājam un iestatīt paziņojumus pēc CPV 77200000 (mežsaimniecības pakalpojumi) un 77210000 (mežizstrāde).",
        url: "https://www.eis.gov.lv/",
      },
      {
        kind: "tender",
        title: "LVM mežkopības darbu konkurss 2026 (61 000+ ha)",
        text: "2026. g. augustā LVM iepirka agrotehnisko un jaunaudžu kopšanu, jaunaudžu aizsardzību, stādīšanu, stumbru aizsardzību un papildināšanu > 61 000 ha apjomā ar 1–2 gadu līgumiem; varēja pieteikties arī nozarē jauni uzņēmumi un uz atsevišķām daļām. Līdzīgi konkursi ir ik gadu — gatavot dokumentus laikus.",
        url: "https://lvportals.lv/dienaskartiba/393134-vel-nedelu-var-iesniegt-piedavajumu-mezkopibas-darbu-konkursa-2026",
      },
      {
        kind: "tip",
        title: "LVM tehnikas prasības — piemērs (jaunaudžu mašinizētā kopšana)",
        text: "2025. g. konkursā (1 880 ha, 2025–2029) prasīja 4–8 t harvesteru ≥ 50 kW, ne vecāku par 2011. g.; piedāvājumu varēja iesniegt arī, ja tehnikas iegāde tikai plānota. LVM rīko ieinteresēto piegādātāju sanāksmes — obligāti piedalīties.",
        url: "https://lvportals.lv/dienaskartiba/372749-izsludinats-konkurss-jaunaudzu-masinizetas-kopsanas-darbu-veiksanai-2025",
      },
      {
        kind: "buyer",
        title: "Stora Enso Mežs (Latvija)",
        text: "Pērk zāģbaļķus (Laukalnes zāģētava), kurināmo koksni un kokmateriālus pie ceļa; sadarbojas ar mežizstrādes darbuzņēmējiem un pieprasa piegādes ķēdes informāciju (darbuzņēmējs, darba drošība pēc MK not. Nr. 310). Kontakti pa produktu grupām lapā.",
        url: "https://forest.storaenso.com/lv-lv/sell-your-wood",
      },
      {
        kind: "buyer",
        title: "Latvijas Finieris — bērza finierkluči",
        text: "Viens no lielākajiem bērza finierkluču pircējiem Baltijā ar savu mežsaimniecības darbību. Bērzu masīvi (sk. Copernicus “Meža tips” slāni) = iespēja piedāvāt ciršanu + piegādi. Citi cirsmu pircēji/ darba devēji (Södra Mežs, zāģētavas, meža īpašnieku kooperatīvi) — kontaktēt tieši.",
        url: "https://www.finieris.com/",
      },
      {
        kind: "association",
        title: "Latvijas Meža īpašnieku biedrība (LMIB)",
        text: "> 450 biedru, kuru meži aptver ~2 miljonus ha (67 % Latvijas mežu). Biedrības pasākumi un izdevumi ir labākais kanāls, lai uzrunātu lielos privātos īpašniekus un kooperatīvus.",
        url: "https://mezaipasnieki.lv/en",
      },
      {
        kind: "association",
        title: "LLKC Meža konsultāciju pakalpojumu centrs (MKPC)",
        text: "Konsultē meža īpašniekus, sagatavo ES atbalsta (LAD) projektus un pats sniedz apsaimniekošanas pakalpojumus. Kļūt par MKPC konsultantu ieteiktu izpildītāju stādīšanai/kopšanai, ko finansē ES atbalsts.",
        url: "https://llkc.lv/noderigi/par-meza-konsultaciju-pakalpojumu-centru/",
      },
      {
        kind: "registry",
        title: "Meža valsts reģistra atvērtie dati (VMD, CC0)",
        text: "Nogabalu dati (suga, vecums, krāja) SHP formātā, atjauno reizi ceturksnī. Importēt Meža kartē un atlasīt pieaugušas audzes / jaunaudzes kopšanai; ar kadastra slāni atrast zemes vienību un uzrunāt īpašnieku (ievērot VDAR — tieša tirgvedība tikai ar leģitīmu pamatu). Ciršanas apliecinājumi kā atvērta datu kopa netiek publicēti.",
        url: "https://data.gov.lv/dati/lv/dataset/meza-valsts-registra-meza-dati",
      },
      {
        kind: "registry",
        title: "LAD — meža atbalsta pasākumi",
        text: "Īpašnieki saņem ES/valsts atbalstu apmežošanai, jaunaudžu kopšanai un bojāto mežu atjaunošanai — tie ir darbi, kam vajag izpildītāju. Sekot pieņemšanas kārtām un piedāvāt “pakalpojums + dokumentācija” paketi.",
        url: "https://www.lad.gov.lv/lv/",
      },
      {
        kind: "tip",
        title: "Sertifikācija: PEFC / FSC darbuzņēmēja sertifikāts",
        text: "Sertificētie pircēji un LVM prasa FSC/PEFC atbilstību un darba drošību. PEFC Latvija izsniedz “Mežsaimniecības darbuzņēmēju sertifikātu” (Latvijā > 30 uzņēmumu) — konkurētspējas priekšrocība; papildus uzturēt civiltiesiskās atbildības un tehnikas apdrošināšanu.",
        url: "https://pefc.lv/",
      },
      {
        kind: "tip",
        title: "Cenas un sezonalitāte",
        text: "Oficiālā statistika par mežizstrādes vidējām izmaksām EUR/m³ (galvenā un kopšanas cirte, pievešana) — CSP tabula MEI010, izmantot kā bāzi piedāvājuma cenai. Slapjos/kūdras nogabalus plānot ziemā uz sasalušas zemes; stādīšana aprīlis–jūnijs, jaunaudžu kopšana vasarā–rudenī. 2025. g. bija slapjākais 80 gados — ņemt rezervi termiņos.",
        url: "https://stat.gov.lv/lv/statistikas-temas/noz/mezsaimnieciba/tabulas/mei010-mezizstrades-videjas-izmaksas-eurm3-bez-pvn",
      },
    ],
  },

  /* ================================ ZVIEDRIJA ============================= */
  SE: {
    headline: "Zviedrija — lielie mežu uzņēmumi nolīgst entreprenörer",
    market:
      "Gandrīz visu mežizstrādi un mežkopību Zviedrijā veic neatkarīgi uzņēmēji (skogsentreprenörer) ar ilgtermiņa līgumiem pie Sveaskog, SCA, Holmen, Södra, Mellanskog, Norra Skog u.c. Sertificēti (PEFC/FSC) īpašnieki drīkst nolīgt tikai sertificētus uzņēmējus. Publisks un bezmaksas ciršanas pieteikumu slānis (Avverkningsanmälan) ļauj redzēt, kur darbs būs tuvākajos mēnešos.",
    items: [
      {
        kind: "buyer",
        title: "Sveaskog — valsts mežu uzņēmums",
        text: "Nolīgst daudz uzņēmēju visā valstī; pirms līguma veic plašas pārbaudes (darba vide, nodarbinātības nosacījumi, UN Global Compact principi). Uzņēmēji strādā caur portālu “Entrén”.",
        url: "https://www.sveaskog.se/om-sveaskog/upphandling/",
      },
      {
        kind: "buyer",
        title: "SCA Skog — > 150 uzņēmēju Ziemeļzviedrijā",
        text: "Aktīvi meklē jaunus partnerus mežizstrādē, kopšanā un plānošanā; piedāvā ilgtermiņa līgumus, finansēšanas un IT atbalstu (“entreprenörsstöd”). Ikgadēji auditē darba apstākļus.",
        url: "https://www.sca.com/skog/entreprenor",
      },
      {
        kind: "buyer",
        title: "Holmen Skog — “Skogsentreprenör? Se hit”",
        text: "Holmen lapa mežu uzņēmējiem, kas vēlas sadarboties mežizstrādē un mežkopībā Holmen mežos un pie Holmen koksnes piegādātājiem.",
        url: "https://www.holmen.com/sv/skog/om-oss/vart-skogsbruk/samarbeta-med-oss/",
      },
      {
        kind: "buyer",
        title: "Norra Skog — meža īpašnieku kooperatīvs",
        text: "Prasa apstiprinātu apmācību un operatora pieredzi, produktivitāti un kvalitāti; izmanto ForestLink un maskinGIS. Atbalsts: līdz 50 % algas jaunam operatoram 6 mēn., 50 % apmācības izmaksu.",
        url: "https://www.norraskog.se/om-oss/entreprenorer/",
      },
      {
        kind: "buyer",
        title: "Mellanskog — katrs trešais meža īpašnieks Vidus-Zviedrijā",
        text: "Kooperatīvs visus darbus veic ar sertificētiem darbuzņēmējiem (PEFC). Regulāri izsludina meklēšanu avverknings-, markberednings- un planläggningsentreprenörer (sk. Skogligaentreprenorer.se).",
        url: "https://www.mellanskog.se/om-mellanskog/det-har-ar-vi/var-affarsmodell/",
      },
      {
        kind: "tender",
        title: "Skogligaentreprenorer.se — uzdevumu tirgus",
        text: "Digitāla platforma, kur Mellanskog, SCA Skog, Häradskog, pašvaldības un iestādes publicē mežsaimniecības uzdevumus (~500 MSEK līgumu gadā). Pārbaudīt katru nedēļu.",
        url: "https://www.skogligaentreprenorer.se/",
      },
      {
        kind: "registry",
        title: "Skogsstyrelsen — ciršanas pieteikumu un veikto ciršu dati (CC0)",
        text: "Lejupielādējami “Avverkningsanmälda områden” un “Utförda avverkningar” (vektori, ZIP) + WMS/REST Meža kartē. Jauni pieteikumi (< 42 dienas) = īpašnieks drīz meklēs izpildītāju; svaigi izcirtumi = markberedning/stādīšana nākamajā sezonā. Īpašnieka kontaktus datos nemeklēt — ievērot GDPR; uzrunāt caur mežu kooperatīviem/ virkesköpare.",
        url: "https://www.skogsstyrelsen.se/laddanergeodata",
      },
      {
        kind: "tender",
        title: "Publiskie iepirkumi (pašvaldības, Statens fastighetsverk u.c.)",
        text: "Pašvaldību un valsts iestāžu mežizstrādes un kopšanas konkursi tiek publicēti Zviedrijas iepirkumu platformās (Mercell/Visma Opic, e-Avrop, TendSign); virs ES sliekšņa — arī TED. Meklēt pēc CPV 77210000 (mežizstrāde) un 77231000 (mežsaimniecības pakalpojumi).",
        url: "https://ted.europa.eu/",
      },
      {
        kind: "association",
        title: "Skogsentreprenörerna — nozares asociācija",
        text: "Apvieno ~pusi Zviedrijas mežu uzņēmēju (~20 reģionālās sekcijas). Bezmaksas biznesa konsultācijas (ekonomika, juridiskie jautājumi, apdrošināšana, darba drošība), Skogsmaskinsindex, mašīnu izmaksu kalkulatori, PEFC sertifikācija caur SE Certifiering.",
        url: "https://www.skogsentreprenorerna.se/",
      },
      {
        kind: "tip",
        title: "PEFC entreprenörscertifiering ir faktiski obligāta",
        text: "PEFC sertificētiem īpašniekiem jānolīgst tikai PEFC sertificēti uzņēmēji. Prasības: atbilstoša kompetence (dabas un kultūrvides apmācība jāatjauno ik 5 gadus), ES emisiju normām atbilstoša tehnika, videi draudzīgas hidrauliskās un ķēžu eļļas, atkritumu un avāriju plāns, apakšuzņēmējiem tās pašas prasības. Mazajiem — grupas sertifikācija.",
        url: "https://pefc.se/entreprenorer/det-har-ar-entreprenorscertifiering",
      },
      {
        kind: "tip",
        title: "Cenu atskaites punkts: 144 kr/m³fub galvenā cirte, 287 kr/m³fub kopšanas cirte (2025)",
        text: "Skogsstyrelsen statistika par lielo mežsaimniecību izmaksām 2025. g. (vidēji valstī). Kopšanas cirte ir ~2× dārgāka uz m³ — cenu piedāvājumā diferencēt pēc cirtes veida, attāluma un nesošās spējas. Sezona: ziemā ziemeļos (sasalusi zeme), pavasarī markberedning/stādīšana, vasarā röjning.",
        url: "https://www.skogsstyrelsen.se/statistik/ekonomi/kostnader-i-det-storskaliga-skogsbruket/",
      },
    ],
  },

  /* ================================= ISLANDE ============================== */
  IS: {
    headline: "Islande — apmežošana, stādīšana un pirmās krājas kopšanas cirtes",
    market:
      "Islandes mežsaimniecība ir jauna: ~60 000 ha stādītu mežu un ~150 000 ha dabisko bērzu mežu. Galvenie darbi — stādīšana, augsnes sagatavošana, mēslošana, žogi un pirmās kopšanas cirtes (lapegle, egle, priede). Valsts aģentūra Land og skógur finansē apmežošanu lauku saimniecībās pēc publicētām likmēm, lielākas kopšanas cirtes iet uz konkursu; aug oglekļa kompensācijas projektu (Skógarkolefni) tirgus.",
    items: [
      {
        kind: "buyer",
        title: "Land og skógur — valsts mežu un augsnes aģentūra",
        text: "Pārvalda valsts mežus, apmežošanas programmas, pētniecību un konsultācijas; lielākais pasūtītājs stādīšanai un kopšanas cirtēm. Sazināties ar reģionālajiem birojiem par apakšuzņēmēja darbiem.",
        url: "https://island.is/s/land-og-skogur",
      },
      {
        kind: "tip",
        title: "Skógrækt á lögbýlum — apmežošana lauku saimniecībās",
        text: "Land og skógur plāno un uzrauga, bet saimnieki paši organizē augsnes sagatavošanu, mēslošanu, transportu un kopšanu — ideāla vieta, kur piedāvāt savus pakalpojumus zemniekiem, kuriem trūkst tehnikas/ darbaroku.",
        url: "https://island.is/s/land-og-skogur/is-skograekt",
      },
      {
        kind: "tip",
        title: "2025. g. likmes (Taxtar) — orientieri cenām",
        text: "Stādīšana 24,35–35,43 ISK/stāds (atkarībā no kasetes 67/40/24), mehāniska augsnes sagatavošana 58 447 ISK/ha, manuāla 18,77–24,49 ISK/stāds, mēslošana 13,40–17,64 ISK/reize. Lapegļu pirmā kopšanas cirte < 3 ha — fiksēta samaksa, lielākas platības — konkurss.",
        url: "https://assets.ctfassets.net/8k0h54kbe6bj/5bmfoVjT5skYkNt2nkGWnS/e4ac6c0903da7e095124fed83b6699b4/Taxtar_2025.pdf",
      },
      {
        kind: "tender",
        title: "Útboðsvefur.is — valsts iepirkumu portāls",
        text: "Valsts iestāžu (t.sk. Land og skógur) konkursi: kopšanas cirtes, stādu piegāde, stādīšana. Iestatīt meklēšanu “skógur”, “grisjun”, “gróðursetning”.",
        url: "https://utbodsvefur.is/",
      },
      {
        kind: "association",
        title: "Skógræktarfélag Íslands — vietējo mežu biedrību savienība",
        text: "Koordinē vietējās mežu biedrības un projektus (piem., Landgræðsluskógar). Vietējās biedrības apsaimnieko pilsētu mežus un regulāri nolīgst kopšanas un ciršanas darbus.",
        url: "https://www.skog.is/",
      },
      {
        kind: "association",
        title: "Landssamtök skógareigenda (LSE) — mežu īpašnieki / skógarbændur",
        text: "Privāto mežu īpašnieku (skógarbændur) nacionālā organizācija ar reģionālajām biedrībām. Daudzi agrāko gadu desmitu stādījumi tagad sasniedz pirmās kopšanas cirtes vecumu — tieši šiem īpašniekiem vajag izpildītāju.",
        url: "https://www.skogarbondi.is/um-lse",
      },
      {
        kind: "registry",
        title: "Skógarkolefni — oglekļa vienību reģistrs jaunajiem mežiem",
        text: "Apmežošanas projekti, kas atbilst papildinātības prasībām, var pārdot sertificētas oglekļa vienības. Uzņēmumi un investori finansē stādīšanu — piedāvāt “atslēgas gatavu” stādīšanu + uzraudzību projektu attīstītājiem.",
        url: "https://www.skogarkolefni.is/is/fyrirtaekid/spurt-og-svarad",
      },
      {
        kind: "tip",
        title: "Fagráðstefna skógræktar — ikgadējā nozares konference",
        text: "Ikgadēja meža nozares konference (2026. g. marts, tēma “Lífið í skóginum”) — labākā vieta, lai satiktu Land og skógur, biedrības un lielos īpašniekus vienuviet.",
        url: "https://island.is/s/land-og-skogur/frett/fagradstefna-skograektar-2026",
      },
      {
        kind: "tip",
        title: "Praktiski: sezona, tehnika, noteikumi",
        text: "Stādīšanas sezona īsa (galvenokārt vasaras sākums); stāvas nogāzes un vulkāniskā augsne — nepieciešama maza, viegla tehnika un manuāls darbs. Islande ir EEZ dalībvalsts: ES uzņēmumi var sniegt pakalpojumus, bet jāreģistrē nodokļu vajadzībām (Skatturinn) un jānodrošina vietējā darba samaksa un apdrošināšana. Aizsargātās teritorijas pārbaudīt Meža kartē.",
      },
    ],
  },
};
