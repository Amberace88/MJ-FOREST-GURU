import type { BuiltinMaterial } from "../types";

export const safetySE: BuiltinMaterial = {
  key: "safety-se",
  version: 1,
  category: "safety",
  country: "SE",
  title: "Darba drošība mežizstrādē — Zviedrija",
  subtitle: "Arbetsmiljölagen, AFS prasības, ugunsdrošība un svarīgākie zviedru termini Skog Guru objektiem",
  summary:
    "Galvenās darba aizsardzības, ugunsdrošības un vides prasības mežizstrādē Zviedrijā: motorzāģa apmācības dokumentēšana, IAL, drošās distances, ziņošana par negadījumiem un rīcība, zvanot 112. Ietverti zviedru termini, kas jāzina katram darbiniekam.",
  audience: ["employee", "foreman", "mechanic", "manager"],
  requiresAck: true,
  readingMinutes: 15,
  body: `## Kam paredzēts šis materiāls
Šis materiāls attiecas uz visiem, kas strādā MJ FOREST GURU (Skog Guru) objektos Zviedrijā, arī uz darbiniekiem, kas uz Zviedriju norīkoti no Latvijas. Tas neaizstāj instruktāžu darba vietā un objekta instrukciju (traktdirektiv), bet apkopo svarīgāko.

Tekstā ir divu veidu prasības:
- **Likuma prasība** — izriet no Zviedrijas normatīvajiem aktiem un Arbetsmiljöverket (Zviedrijas Darba vides pārvaldes) noteikumiem.
- **Uzņēmuma noteikums** — MJ FOREST GURU iekšējā prasība, kas var būt stingrāka par likumu un ir obligāta visiem mūsu objektos.

? Aktuālā versija: Normatīvie akti mainās. No 2025. gada 1. janvāra Arbetsmiljöverket noteikumi (AFS) ir pārstrukturēti jaunajā AFS 2023 sērijā. Aktuālo šī materiāla versiju uztur meistars un sistēmas administrators.

## Darba devēja pienākumi
Arbetsmiljölagen (Darba vides likums) un AFS noteikumi prasa, lai darba devējs:
- veic sistemātisku darba vides darbu (systematiskt arbetsmiljöarbete, AFS 2023:1) — regulāri novērtē riskus (riskbedömning) un novērš tos;
- plāno un organizē darbu, tostarp pirmo palīdzību, krīzes atbalstu un darbu vienatnē (AFS 2023:2);
- nodrošina drošu darba aprīkojumu un individuālos aizsardzības līdzekļus (AFS 2023:11);
- ziņo Arbetsmiljöverket par smagiem negadījumiem un bīstamiem notikumiem.

Darba aizsardzības pārstāvis (skyddsombud) pārstāv darbiniekus drošības jautājumos un var pieprasīt pārtraukt darbu, kas rada tiešus un nopietnus draudus dzīvībai vai veselībai.

## Darbinieka pienākumi
+ Ievēro instruktāžu, traktdirektiv un drošības noteikumus.
+ Pareizi lieto IAL un aizsargierīces, tās neatslēdz un nebojā.
+ Nekavējoties ziņo meistaram par bīstamām situācijām, bojājumiem un negadījumiem.
+ Ja uzskati, ka darbs ir tieši bīstams, pārtrauc to un sazinies ar meistaru.

## Motorzāģa darbs — īpašās prasības
Likuma prasības (AFS 2023:11, 5. nodaļa „Motorkedjesågar och röjsågar”):
- Katram, kas strādā ar motorzāģi (motorkedjesåg), jābūt nokārtotam teorētiskam un praktiskam pārbaudījumam, un tam jābūt **dokumentētam**. Sarunvalodā to sauc par „motorsågskörkort”. Par šīs prasības pārkāpumu darba devējam draud sankciju maksājums.
- Strādājot ar motorzāģi vai krūmgriezi (röjsåg), līdzi jābūt pirmās palīdzības pārsējam (första förband).
- Darba devējam riska novērtējumā īpaši jāizvērtē darbinieku zināšanas, tehnikas apkope un darbs vienatnē (ensamarbete).

!! Bez apliecinājuma — nav zāģa: Neviens nedrīkst sākt darbu ar motorzāģi Zviedrijā, kamēr uzņēmumā nav reģistrēts viņa pārbaudījuma apliecinājums. Iesniedz to meistaram pirms pirmās maiņas.

## Individuālie aizsardzības līdzekļi (personlig skyddsutrustning)
Likuma prasība (AFS 2023:11): motorzāģa darbā obligāti ir šie IAL.

| IAL (latviski) | Zviedriski | Standarts (piemērs) |
| Dzirdes aizsardzība | hörselskydd | EN 352 |
| Aizsargķivere | skyddshjälm | EN 397 |
| Acu vai sejas aizsardzība | ögonskydd / ansiktsskydd | EN 1731, EN 166 |
| Zābaki ar zāģa aizsardzību | skyddskängor / skyddsstövlar med sågskydd | EN ISO 17249 |
| Bikses vai kājsargi ar zāģa aizsardzību | skyddsbyxa / byxholkar med sågskydd | EN ISO 11393-2 |
| Darba cimdi | arbetshandskar | EN ISO 11393-4 (ieteicami) |
| Signālkrāsas apģērbs ķermeņa augšdaļai | varselkläder | EN ISO 20471 |

Krūmgrieža darbā obligāta dzirdes un acu aizsardzība, cimdi, apavi ar zāģa aizsardzību un signālkrāsas apģērbs; ķivere — ja stumbri ir augstāki par diviem metriem.

Uzņēmuma noteikums: tehnikas operatori, mehāniķi un autovadītāji ārpus kabīnes meža objektā valkā signālkrāsas vesti un drošības apavus, pie krāna vai kravas — arī ķiveri.

## Drošās distances (riskområde)
| Situācija | Distance | Statuss |
| Koka gāšana — citi cilvēki | Vismaz 2 koka garumi | Uzņēmuma noteikums (nozares prakse) |
| Divi zāģētāji viens no otra | Vismaz divkāršs koka garums (dubbla trädlängden) | Nozares prakse, uzņēmuma noteikums |
| Strādājošs harvesters (skördare) | 90 m (uz mašīnas parasti norādīti 70 m) | Uzņēmuma noteikums |
| Forvarders (skotare) vai krāns | Ārpus krāna sniedzamības + 5 m, ne mazāk kā 20 m | Uzņēmuma noteikums |

! Ķēdes šāviens (kedjeskott): Pārtrūkusi harvestera ķēde var izlidot ar lodes ātrumu un tālāk par jebkuru marķēto zonu. Tāpēc harvestera zāģi nekad nevērš pret kabīni vai cilvēkiem.

## Darbs vienatnē (ensamarbete) un sakari
Likuma prasība: darba devējs novērtē darba vienatnē riskus un nosaka pasākumus (AFS 2023:2, AFS 2023:11). Uzņēmuma noteikumi:
1. Koku gāšanu ar motorzāģi vienatnē neveic bez meistara atļaujas un saskaņotas sakaru kārtības.
2. Pirms maiņas pārbaudi mobilā tīkla pārklājumu; ja tā nav, vienojies par citu sakaru veidu.
3. Sazinies ar meistaru vai kolēģi norunātajos laikos (ne retāk kā ik pēc 2 stundām) un darba beigās.
4. Ja norunātā saziņa neienāk, meistars nekavējoties sāk meklēšanu.

## Darba laiks un atpūta
Arbetstidslagen (Darba laika likums) paredz vismaz 11 stundu nepārtrauktu diennakts atpūtu (dygnsvila) un vismaz 36 stundu nepārtrauktu atpūtu katrā 7 dienu periodā (veckovila). Koplīgums var paredzēt atkāpes. Uzņēmuma noteikums: neviens nestrādā ar tehniku vai motorzāģi, ja ir pārguris.

## Laikapstākļi
- Stiprā vējā pārtrauc manuālu koku gāšanu; vēja gāztu koku (stormfälld skog) apstrādi veic tikai apmācīti darbinieki.
- Pērkona negaisā motorzāģa darbinieki dodas uz transportlīdzekli, operatori paliek slēgtā kabīnē.
- Ziemā Ziemeļzviedrijā diena ir īsa: nodrošini apgaismojumu, siltas rezerves drēbes un sakarus.
- Karstumā dzer ūdeni un ieturi pauzes.

## Ugunsdrošība (brandrisk)
Mežizstrādes nozarē Zviedrijā darbojas nozares kopīgās vadlīnijas „Riskhantering avseende brand vid skogsarbete”. Tās paredz:
- ugunsbīstamības sezonā visām mašīnām jābūt aprīkotām ar ugunsdzēšanas līdzekļiem, un operatori seko aktuālajai ugunsbīstamībai (SMHI brandriskprognos);
- ja FWI indekss ir 4 vai vairāk, darbuzņēmējs un pasūtītājs vienojas (samråd) par papildu pasākumiem: darbs tikai mazāk bīstamās vietās vai stundās, papildu ugunsdzēšamie aparāti (piemēram, 2 gab. pa 9 litriem uz ciršanas mašīnas), ugunsgrēka novērotājs (brandvakt), pārbaude pēc darba (efterkontroll), ķēžu noņemšana no riteņiem.

Länsstyrelsen (lēnes pārvalde) vai pašvaldība (kommun) var izsludināt uguns kurināšanas aizliegumu (eldningsförbud). Uzņēmuma noteikums: meistars katru dienu ugunsbīstamības sezonā pārbauda brandrisk un informē komandu.

!! Ugunsgrēks (brand): Zvani 112, brīdini citus, dzēs, ja tas ir droši. Pēc tam ziņo meistaram un lietotnē.

## Pirmās palīdzības aprīkojums
Likuma prasība: motorzāģa un krūmgrieža darbā līdzi jābūt pirmās palīdzības pārsējam; darba devējs organizē pirmo palīdzību (AFS 2023:2). Uzņēmuma noteikumi: katrā tehnikā un transportlīdzeklī ir aptieciņa ar turniketu; saturu pārbauda katru mēnesi. Pilns saraksts — materiālā „Rīcība ārkārtas situācijās”.

## Nelaimes gadījumi un gandrīz negadījumi
Uzņēmuma noteikums: par katru negadījumu (olycka), traumu, ugunsgrēku, noplūdi vai gandrīz negadījumu (tillbud) ziņo:
1. nekavējoties meistaram pa tālruni;
2. tās pašas maiņas laikā lietotnes sadaļā „Incidenti”, pievienojot GPS atrašanās vietu un fotoattēlus.

Likuma prasība: darba devējs bez kavēšanās (utan dröjsmål) ziņo Arbetsmiljöverket par nāves gadījumiem, smagām traumām un nopietniem bīstamiem notikumiem (allvarliga tillbud). Ziņošana notiek e-pakalpojumā anmalarbetsskada.se, kur arbetsskador tiek ziņotas arī Försäkringskassan (Sociālās apdrošināšanas aģentūrai). Notikuma vietu nemaina vairāk, nekā nepieciešams glābšanai un drošībai.

## Vides aizsardzība
Likuma prasības:
- Galvenās cirtes (slutavverkning) no 0,5 ha pieteikumu (avverkningsanmälan) Skogsstyrelsen iesniedz vismaz sešas nedēļas pirms darbu sākuma — to nodrošina meža īpašnieks vai pasūtītājs. Strādājam tikai tur, kur meistars apstiprinājis, ka dokumenti ir kārtībā.
- Dabas un kultūrvides saudzēšana (hänsyn) ir obligāta. Ievēro traktdirektiv: saudzējamās platības (hänsynsytor), dabas vērtību koki (naturvärdesträd), buferjoslas gar ūdeņiem (kantzoner), augstie celmi (högstubbar), kultūrvēsturiskie objekti (fornlämningar).
- Sugu aizsardzības noteikumi (Artskyddsförordningen) aizliedz tīši nogalināt putnus un iznīcināt ligzdas un olas. Pēc ES Tiesas 2025. gada sprieduma iestādes uzsver, ka putnu ligzdošanas laikā (häckningstid) mežizstrādē nepieciešama pastiprināta saudzēšana.

Uzņēmuma noteikumi:
+ Ja atrodi apdzīvotu ligzdu vai lielu putnu, darbu tuvumā pārtrauc un ziņo meistaram.
+ Degvielu uzpilda un tehniku apkopj ne tuvāk kā 50 m no ūdeņiem; noplūdi aptur, savāc ar absorbentu un reģistrē kā „Vides incidents”.
x Aizliegts šķērsot ūdenstecēs ārpus norādītām pārbrauktuvēm un bojāt kantzoner.
x Aizliegts atstāt mežā atkritumus, filtrus un kannas.

## Dokumenti, kam jābūt līdzi
- Personu apliecinošs dokuments.
- Motorzāģa darbiniekiem — pārbaudījuma apliecinājums (kopija ir arī uzņēmumā).
- Autovadītājiem — vadītāja apliecība un kvalifikācijas dokumenti.
- No Latvijas norīkotajiem darbiniekiem — A1 izziņa par sociālo apdrošināšanu. Par norīkošanu darba devējs paziņo Arbetsmiljöverket (anmälan om utstationering) — to kārto administrācija.
- Uzņēmuma noteikums: traktdirektiv un objekta karte lietotnē vai izdrukā.

## Svarīgākie zviedru vārdi
| Zviedriski | Latviski |
| Hjälp! | Palīgā! |
| Stopp! / Fara! | Stop! / Briesmas! |
| Brand | Ugunsgrēks |
| Olycka / tillbud | Negadījums / gandrīz negadījums |
| Skadad / blöder kraftigt | Ievainots / stipri asiņo |
| Medvetslös / andas inte | Bez samaņas / neelpo |
| Skogsbilväg | Meža ceļš |
| Avverkning / trakt | Ciršana / objekts |
| Riskområde | Bīstamā zona |
| Eldningsförbud | Uguns kurināšanas aizliegums |

## Ārkārtas numuri un koordinātas
- **112** — ārkārtas numurs (SOS Alarm: ugunsdzēsēji, ātrā palīdzība, policija, glābšana). Ja nerunā zviedriski, runā angliski.
- **1177** — veselības aprūpes konsultācijas (ne dzīvībai bīstamos gadījumos).
- **114 14** — policija, ja nav steidzami.
- **Giftinformationscentralen** — akūtas saindēšanās gadījumā zvani 112 un lūdz saindēšanās informāciju; mazāk steidzamos gadījumos 010-456 67 00.
- **113 13** — informācija lielu negadījumu un krīžu laikā.

Koordinātas: telefona kartes lietotnē ilgi nospied savu atrašanās vietu un nolasi abus skaitļus (platums, garums) lēnām, cipariem. Papildus nosauc tuvāko meža ceļu, ciemu un sagaidīšanas vietu.

## Zvanot 112
1. „Emergency in forestry work / Olycka i skogen. My name is [vārds], company Skog Guru.”
2. Kas notika: piemēram, „chainsaw cut to leg”, „tree fell on a person”, „machine on fire”.
3. Cik cietušo, vai elpo, vai ir pie samaņas, vai stipri asiņo.
4. Koordinātas [platums, garums], tuvākais ceļš, ciems vai kommun.
5. Kur sagaidīsiet ātro palīdzību (meža ceļa sākums), kur stāvēs cilvēks signālvestē.
6. Tavs tālruņa numurs. Neatvieno zvanu, kamēr operators to neatļauj.

## Svarīgākie kontakti
| Kas | Kontakts | Kad izmantot |
| SOS Alarm | 112 | Trauma, ugunsgrēks, dzīvības apdraudējums |
| Tavs meistars | Tālrunis no instruktāžas | Uzreiz pēc 112 un jebkurā bīstamā situācijā |
| Arbetsmiljöverket | av.se, anmalarbetsskada.se | Smagu negadījumu ziņošana (to dara darba devējs) |
| Skogsstyrelsen | skogsstyrelsen.se | Avverkningsanmälan, saudzēšanas jautājumi |
| SMHI | smhi.se | Ugunsbīstamības prognoze (brandrisk) |
| Giftinformationscentralen | 112 akūti; 010-456 67 00 | Saindēšanās |
| Veselības konsultācijas | 1177 | Nesteidzami veselības jautājumi |

## Atsauces
- Arbetsmiljölagen (1977:1160)
- Arbetsmiljöförordningen — pienākums ziņot par smagiem negadījumiem un allvarliga tillbud
- AFS 2023:1 Systematiskt arbetsmiljöarbete
- AFS 2023:2 Planering och organisering av arbetsmiljöarbete (arī pirmā palīdzība, krīzes atbalsts, darbs vienatnē)
- AFS 2023:11 Arbetsutrustning och personlig skyddsutrustning – säker användning (5. nodaļa: motorzāģi un krūmgrieži)
- Arbetstidslagen (1982:673)
- Skogsvårdslagen un Skogsstyrelsen norādījumi par avverkningsanmälan
- Artskyddsförordningen (2007:845)
- Branschgemensamma riktlinjer „Riskhantering avseende brand vid skogsarbete” (Skogforsk)
- Arbetsmiljöverket (av.se), Skogsstyrelsen (skogsstyrelsen.se), SMHI (smhi.se), Giftinformationscentralen (giftinformation.se), Krisinformation (krisinformation.se)

## Kontroljautājumi
1. Kāds dokuments nepieciešams, lai Zviedrijā drīkstētu strādāt ar motorzāģi?
2. Nosauc vismaz piecus obligātos IAL motorzāģa darbam un to zviedru nosaukumus.
3. Ko nozīmē FWI indekss 4 vai vairāk, un kādi papildu pasākumi var tikt noteikti?
4. Kā rīkosies, ja cirsmā atradīsi apdzīvotu putna ligzdu?
5. Kurš un kur ziņo Arbetsmiljöverket par smagu negadījumu, un kas tev pašam jādara uzreiz?
6. Kādu informāciju sniegsi, zvanot 112, un kā nosauksi savu atrašanās vietu?
`,
};
