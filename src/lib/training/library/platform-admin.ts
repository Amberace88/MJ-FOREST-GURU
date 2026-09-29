import type { BuiltinMaterial } from "../types";

export const platformAdminGuide: BuiltinMaterial = {
  key: "platform-admin-guide",
  version: 1,
  category: "platform",
  country: null,
  title: "Vadītāja rokasgrāmata — MJ Forest Guru pārvaldība",
  subtitle: "Iestatīšana, ikdienas kontrole, finanses, piekļuves un datu kvalitāte — īpašniekiem, administratoriem un vadītājiem",
  summary:
    "Praktiska rokasgrāmata tiem, kas redz visu platformu: pirmā iestatīšana, uzņēmumi un valstis, Dashboard un vadītāja rutīna, kartes un jaunu darbu iespējas, objektu finanses, stundu un izdevumu apstiprināšana, drošība, apmācības, lietotāji un piekļuves, audita žurnāls.",
  audience: ["owner", "admin", "manager"],
  requiresAck: false,
  readingMinutes: 16,
  body: `## Kam paredzēta šī rokasgrāmata
Šī rokasgrāmata ir paredzēta īpašniekiem, administratoriem un vadītājiem. Jūs redzat visas platformas sadaļas un visu uzņēmumu datus, tāpēc no jūsu rīcības ir atkarīga datu kvalitāte, algu un izdevumu pareizība un tas, kam ir piekļuve uzņēmuma informācijai. Darbinieku ikdienas darbības ir aprakstītas materiālā **MJ Forest Guru platformas lietošanas rokasgrāmata**.

Datorā kreisajā izvēlnē sadaļas ir sagrupētas: **Command Center** (Dashboard, Live Map, Meža karte, Alerts), **Operations** (Darba objekti, Darba stundas, Uzdevumi, Produkcija), **People** (Darbinieki, Komandas, Dokumenti), **Fleet** (Tehnika, Degviela, Apkope un remonti), **Finance** (Izdevumi, Čeki, Atskaites), **Safety** (Drošība, Incidenti, Apmācības), **Analytics** (Analītika, Kalkulatori) un **System** (Iestatījumi, Lietotāji un piekļuves, Integrācijas, Audit Log). Ātrai meklēšanai jebkurā lapā nospiediet **/** vai **Ctrl+K** un ierakstiet darbinieka, tehnikas vai objekta nosaukumu.

## Pirmā iestatīšana
Vedni **Sistēmas iestatīšana** (adrese /setup) var atvērt lietotājs ar tiesībām pārvaldīt iestatījumus. Katru soli var aizpildīt uzreiz vai nospiest **Izlaist** un atgriezties vēlāk.
1. **Uzņēmumi** — holdinga nosaukums un juridiskās personas, piemēram, Land Guru (Latvija) un Skog Guru (Zviedrija). Šeit ir arī saite uz darba laika noteikumiem.
2. **Valstis** — aktīvās valstis ar laika joslu, valūtu un objekta identifikācijas laukiem (piemēram, kadastra numurs Latvijā, fastighet Zviedrijā).
3. **Pirmie darbinieki** — darbinieku kartītes.
4. **Tehnika** — harvesteri, forvarderi, transports.
5. **Pirmais objekts** — pirmais darba objekts.
6. **Mapon integrācija** — Mapon API atslēga tehnikas atrašanās vietai un motostundām.
7. **Uzaicināt darbiniekus** — uzaicinājumi vadītājiem un darbiniekiem.

Kad redzat uzrakstu **MJ FOREST GURU IS READY**, nospiediet **Atvērt Dashboard**.

## Uzņēmumi un valstis
Uzņēmumus pārvalda sadaļā **Iestatījumi**, cilnē **Uzņēmumi** (**Pievienot uzņēmumu**). Katram uzņēmumam ir īsais nosaukums, juridiskais nosaukums, reģistrācijas un PVN numurs, valsts un krāsa, kas to atšķir sarakstos. Objektus, darbiniekus, tehniku un izdevumus var piesaistīt uzņēmumam.

Augšējā joslā ir divi globālie filtri:
- **Uzņēmuma filtrs** — izvēlieties konkrētu uzņēmumu vai **Visi uzņēmumi**. Filtrs attiecas uz visām sadaļām.
- **Valsts slēdzis** — **Visas valstis** vai viena valsts (LV, SE, IS). Valstu salīdzinājums analītikā ir pieejams tikai tad, kad izvēlētas **Visas valstis**.

! Filtri paliek ieslēgti: Ja skaitļi šķiet par maziem, vispirms pārbaudiet augšējo joslu — iespējams, ir atlasīts viens uzņēmums vai viena valsts.

Deaktivizēts uzņēmums netiek piedāvāts jauniem ierakstiem, bet esošie ieraksti saglabājas. Dzēšot uzņēmumu, piesaistītie ieraksti paliek bez uzņēmuma norādes — tāpēc parasti izvēlieties **Deaktivizēt**, nevis **Dzēst**.

## Dashboard
Īpašnieka skatā Dashboard ir **Operations Center**. Augšā josla **Uzņēmuma statuss** parāda, vai ir kritiski brīdinājumi. Blokā **Šodien** ir rādītāji: **Aktīvie darbinieki**, **Aktīvā tehnika**, **Aktīvie objekti**, **Nostrādātās stundas**, **Degviela**, **Izdevumi**, **Remonti** un **Brīdinājumi**. Katrs rādītājs ir saite uz attiecīgo sadaļu.

Zemāk ir **Live operācijas** (karte), **Nepieciešama uzmanība** (brīdinājumi), grafiki **Stundas pa dienām**, **Degviela pa dienām**, **Izdevumi pa kategorijām**, kā arī **Finanšu momentuzņēmums** ar izdevumiem, kas **Gaida apstiprinājumu**. Kartīte **Objektu rentabilitāte** rāda aktīvos objektus ar līguma cenu un to rentabilitāti, bet kartīte **Uzņēmumi** — šī mēneša kopsavilkumu pa uzņēmumiem (objekti, darbinieki, tehnika, izdevumi EUR, darba stundas).

Sadaļā **Alerts** ir visi aktīvie brīdinājumi, piemēram, kritiska tehniska problēma, trūkstošs check-out, ilga maiņa, tuvojas serviss, beidzas dokuments vai sertifikāts, izdevumi gaida apstiprinājumu, neparasts degvielas patēriņš un nav telemetrijas datu. Kurus brīdinājumus rādīt un kādi ir sliekšņi, nosaka **Iestatījumi** cilnēs **Brīdinājumi** un **Darba noteikumi**.

## Vadītāja rutīna
| Biežums | Ko pārbaudīt | Kur |
| Katru dienu | Kritiskie brīdinājumi, aizmirsti check-out, ilgas maiņas | Dashboard, Alerts |
| Katru dienu | Kritiski remonti un tehnika dīkstāvē | Apkope un remonti |
| Katru dienu | Jauni incidenti | Incidenti |
| Katru nedēļu | Darba stundu apstiprināšana un labojumi | Darba stundas |
| Katru nedēļu | Iesniegtie izdevumi un neapstiprinātie čeki | Izdevumi, Čeki |
| Katru nedēļu | Iespēju nākamie soļi un nokavētie termiņi | Meža karte → Iespējas |
| Katru nedēļu | Objektu budžets un prognoze | Darba objekti → Finanses |
| Katru mēnesi | Mēneša vadības atskaite un eksports grāmatvedībai | Atskaites |
| Katru mēnesi | Dokumentu un sertifikātu derīguma termiņi | Dokumenti, Apmācības |
| Katru mēnesi | Lietotāju saraksts, lomas un bloķētās piekļuves | Lietotāji un piekļuves |

## Live Map
**Live Map** rāda tehniku, objektus un darbiniekus kartē. Slāņus **Tehnika**, **Objekti** un **Darbinieki** var ieslēgt un izslēgt, pamatkarti var pārslēgt starp **Satelīts**, **Karte** un OpenStreetMap. Krāsas nozīmē statusu: Aktīva, Uzmanību, Kritisks, Bezsaistē. Tehnikas uznirstošajā logā redzams vadītājs, motostundas un **Pēdējā atjaunošana**; ja dati ir veci, parādās **Novecojuši dati**.

Meklēšanas laukā var ievadīt adresi, vietas nosaukumu, sava objekta nosaukumu vai koordinātas. Koordinātas atpazīst decimālā formātā, grādos-minūtēs-sekundēs, kā arī LKS-92 (Latvija) un SWEREF 99 TM (Zviedrija) — tās automātiski tiek pārrēķinātas uz WGS 84. Poga **Mana atrašanās vieta** pārvieto karti uz jūsu atrašanās vietu.

? Tehnikas atrašanās vieta: Tehnikas pozīcijas nāk no Mapon. Ja redzat **Mapon dati pašlaik nav pieejami** vai tehnikai **Nav GPS pozīcijas**, pārbaudiet sadaļu **Integrācijas**.

## Meža karte un jaunu darbu iespējas
**Meža karte** ir pieejama lietotājiem ar tiesībām pārvaldīt objektus vai skatīt finanses. Tai ir trīs cilnes: **Karte**, **Iespējas** un **Kā iegūt darbus**.

Cilnē **Karte** nospiediet **Slāņi**. Slāņi ir sagrupēti: **Cirtes un paziņojumi**, **Mežs**, **Kadastrs un robežas**, **Aizsargājamās teritorijas**, **Izmaiņas (satelīts)** un **Pamatkartes**. Piemēram:
- Latvijā — **Kadastra karte (zemes vienību robežas)**, LĢIA ortofoto, īpaši aizsargājamās dabas teritorijas un mikroliegumi (DAP OZOLS).
- Zviedrijā — **Ciršanas pieteikumi (Avverkningsanmälan)**, **Veiktās cirtes (Utförd avverkning)**, krāja m³/ha, atslēgas biotopi un aizsargājamās teritorijas.
- Visām valstīm — koku seguma zudums, Natura 2000 teritorijas.

Katram slānim var regulēt **Redzamība** un apskatīt datu avotu un licenci.

Uzspiežot uz kartes, parādās koordinātas un pogas **Pievienot iespēju šeit**, **Kopēt** un **Navigācija**. Iespēja ir potenciāls darbs: nosaukums, statuss, avots (piemēram, Ciršanas paziņojums, Iepirkums / konkurss, Meža īpašnieks), darba veids, platība, apjoms, cena par m³, vērtība, varbūtība, kadastra numurs, īpašnieka kontakti un **Nākamais solis** ar termiņu.

Cilnē **Iespējas** redzami rādītāji **Atvērtās iespējas**, **Portfeļa vērtība**, **Svērtā prognoze** (vērtība × varbūtība) un **Uzvaru īpatsvars**, kā arī tāfele ar posmiem:
| Posms | Noklusējuma varbūtība |
| Jauna | 10% |
| Sazināts | 20% |
| Apsekošana | 40% |
| Piedāvājums | 60% |
| Iegūta | 100% |
| Zaudēta | 0% |

Kad darbs ir iegūts, nospiediet **Uz objektu**. Sistēma izveido plānotu darba objektu tajā pašā vietā ar kodu pēc valsts (piemēram, LV-019), pārnes klientu, platību, kadastra numuru un piezīmes, bet iespējas statuss kļūst **Iegūta**. Cilnē **Kā iegūt darbus** apkopoti iepirkumi, pircēji, reģistri un asociācijas katrā valstī.

## Darba objekti un finanses
Objektu izveido ar **Jauns darba objekts**, norādot **Objekta ID** (piemēram, LV-018), nosaukumu, klientu, valsti, uzņēmumu, koordinātas un valsts identifikatorus. Objekta kartītē ir cilnes Pārskats, Darbinieki, Tehnika, Stundas, Produkcija, Degviela, Izdevumi, Remonti, Uzdevumi, Dokumenti, Komentāri un Aktivitāte. Darbiniekus, tehniku un komandas piešķir ar **Piešķirt darbinieku**, **Piešķirt tehniku** un **Piešķirt komandu**.

Lietotājiem ar tiesībām skatīt finanses ir cilne **Finanses**. Nospiediet **Līgums un budžets** un aizpildiet:
- **Līguma veids** — Par vienību, Fiksēta summa vai Stundu likme.
- **Līguma cena**, **Valūta**, **Vienība** un **Plānotais apjoms**.
- **Budžets — stundas** un **Budžets — izmaksas**.

Pēc tam cilnē redzami ieņēmumi, izmaksas (darbaspēks, degviela, izdevumi, remonti), peļņa, rentabilitāte, pašizmaksa uz m³, izpilde, budžeta izlietojums un **Prognoze** pēc pēdējo 30 dienu tempa. Ja prognozētās izmaksas pārsniedz budžetu, parādās brīdinājums.

! Valūtas netiek konvertētas: Izmaksas citā valūtā, nekā norādīts līgumā, tiek rādītas atsevišķi un nav iekļautas rentabilitātē. Darbaspēka izmaksas tiek aprēķinātas tikai darbiniekiem ar norādītu stundas likmi vai mēnešalgu.

**Uzdevumi** tiek plānoti tāfelē (TODO, IN PROGRESS, WAITING, DONE) ar prioritāti, izpildītāju un termiņu. **Produkcija** uzskaita apjomus pa objektiem (m³, gab., kravas vai cita mērvienība) un rāda produktivitāti uz darba un tehnikas stundu.

## Darbinieki, komandas un dokumenti
Darbinieku pievieno ar **Pievienot darbinieku**. Kartītē ir nodarbinātība, kontakti, **Atalgojums** (redzams tikai ar tiesībām skatīt atalgojumu), objektu un tehnikas vēsture, apmācības un iepazīšanās ar drošības noteikumiem. **Komandas** sadaļā izveidojiet brigādes, norādiet vadītāju un brigadieri.

Sadaļā **Dokumenti** glabājiet līgumus, sertifikātus, polises un atļaujas. Katram dokumentam norādiet, kam tas pieder (darbiniekam, tehnikai, objektam vai uzņēmumam), **Derīgs līdz** un **Redzamība** (Tikai vadībai, Saistītajiem lietotājiem, Visam uzņēmumam). Atjaunotu dokumentu augšupielādējiet ar **Jauna versija** — iepriekšējā saņem statusu Aizstāts. Filtrs **Derīgums** parāda dokumentus, kuriem termiņš beidzas 7, 14, 30, 60 vai 90 dienu laikā.

## Darba stundas
Sadaļā **Darba stundas** redzami visu darbinieku ieraksti, parastās stundas un **Virsstundas**. Virsstundas tiek skaitītas pēc stundu skaita dienā, kas norādīts **Iestatījumi → Darba noteikumi**.
1. Pārbaudiet ierakstus par periodu un filtrējiet pa objektiem vai darbiniekiem.
2. Pareizos ierakstus apstipriniet ar **Apstiprināt** vai **Apstiprināt visus**.
3. Kļūdainu ierakstu izlabojiet ar **Labot**. Katra korekcija tiek reģistrēta audita žurnālā.
4. Aizmirstu maiņu noslēdziet ar **Noslēgt maiņu**, norādot faktisko beigu laiku.
5. Ja ieraksta nav vispār, izmantojiet **Pievienot ierakstu manuāli**. Viens ieraksts nevar būt garāks par 24 stundām.

## Tehnika, degviela, apkope un remonti
Tehnikas kartītē ir identifikācija (VIN, reģistrācijas numurs), motostundas, servisa intervāls, apdrošināšanas un tehniskās apskates termiņi, **Lietošanas vēsture** (kurš un kurā objektā vadīja tehniku) un cilne **Izmaksas** ar kopējām ekspluatācijas izmaksām un izmaksām uz motostundu. Operatoru piešķir ar **Piešķirt operatoru**.

Sadaļa **Degviela** rāda patēriņu L/h, izmaksas pa tehnikai, objektiem un valstīm. L/h aprēķinam uzpildēs jānorāda motostundas.

Sadaļā **Apkope un remonti** redzams **Tehnikas stāvoklis** (Kārtībā, Drīz serviss, Nokavēts, Kritisks), **Atvērtie remonti** un **Tuvākie servisi**. Vadītāja uzdevumi:
+ Piešķiriet mehāniķi jaunam pieteikumam ar **Piešķirt mehāniķi**.
+ Pabeigtu remontu pārbaudiet un apstipriniet ar **Apstiprināt remontu** — apstiprinātu remontu vairs nevar atvērt atkārtoti.
+ Pārbaudiet dīkstāves stundas un izmaksas blokā **Darbs un izmaksas**.

Mapon integrāciju iestata sadaļā **Integrācijas**: ievadiet API atslēgu, nospiediet **Pārbaudīt savienojumu** un **Sinhronizēt tagad**. Ierīces, kurām sakrīt VIN vai reģistrācijas numurs, tiek piesaistītas tehnikai automātiski; pārējās piesaistiet ar **Piesaistīt tehnikai**.

## Izdevumi un čeki
Sadaļā **Izdevumi** banneris rāda, cik izdevumu gaida jūsu apstiprinājumu. Atveriet izdevumu, pārbaudiet čeku un izvēlieties:
| Darbība | Kad lietot |
| Apstiprināt | Summa, kategorija un čeks ir pareizi |
| Pieprasīt labojumu | Trūkst informācijas vai čeks nav salasāms — komentārs obligāts |
| Noraidīt | Izdevums nav atmaksājams — komentārs obligāts |
| Atzīmēt kā apmaksātu | Apstiprinātais izdevums ir izmaksāts |

Savu izdevumu apstiprināt nevar. Sadaļā **Čeki** pārbaudiet čekus ar statusu **Nav apstiprināts** — automātiski nolasītie dati jāpārbauda pirms apstiprināšanas. Summas netiek konvertētas: katra valūta tiek uzskaitīta atsevišķi.

## Atskaites, analītika un kalkulatori
Sadaļā **Atskaites** var eksportēt darbinieku stundas, degvielu, izdevumus, tehniku, apkopi, objektus, produkciju, drošību un incidentus. Formāts **CSV** ir standarta komatatdalīts fails, bet **Excel CSV** ir paredzēts Latvijas Excel iestatījumiem (semikols un decimālkomats). Ar **Atvērt mēneša atskaiti** atveriet **Mēneša vadības atskaite** un saglabājiet to ar **Drukāt / PDF**.

**Analītika** ir sadalīta cilnēs Cilvēki, Tehnika, Degviela, Objekti, Izmaksas un Valstis ar salīdzinājumu pret iepriekšējo periodu. **Kalkulatori** palīdz ātri aprēķināt apaļkoksnes tilpumu, objekta rentabilitāti, tehnikas stundas pašizmaksu, degvielas un darba izmaksas; daļa vērtību tiek aizpildīta no jūsu organizācijas pēdējo 90 dienu datiem.

## Drošība, incidenti un apmācības
Sadaļā **Drošība** izveidojiet noteikumus ar **Jauns noteikums**. Ja noteikums mainās, publicējiet **Jauna versija** — visiem darbiniekiem būs no jauna jāapliecina iepazīšanās, bet iepriekšējās versijas un apliecinājumi saglabājas. Cilnē **Iepazīšanās pārskats** redzams, kuri darbinieki vēl nav iepazinušies.

Sadaļā **Incidenti** katram ziņojumam aizpildiet **Vadītāja atbilde**, **Izmeklēšana** un **Korektīvā darbība**, un mainiet statusu: Atvērts, Izmeklē, Nepieciešama rīcība, Atrisināts, Slēgts.

Sadaļā **Apmācības** ir cilnes **Mācību materiāli**, **Ieraksti** (sertifikāti ar derīguma termiņiem) un **Apmācību veidi**.
- **Jauns materiāls** atver ģeneratoru: aprakstiet mērķi, notikumus, prasības, aizliegumus un atbildīgo, tad nospiediet **Sagatavot dokumentu**. Pārskatiet tekstu un nospiediet **Publicēt**.
- Materiāla lapā blokā **Iepazīšanās statuss** redzams, kas ir apstiprinājuši un kas vēl nav.
- **Lejupielādēt PDF** sagatavo drukājamu versiju ar parakstu lauku.
- **Atjaunot standarta materiālus** atjauno platformas standarta materiālus un pārraksta jūsu labojumus tajos.

! Jauna versija: Publicējot izmainītu materiāla tekstu, tiek izveidota jauna versija, un visiem auditorijas darbiniekiem tā jāapstiprina vēlreiz. Mazus labojumus apvienojiet vienā publicēšanā.

## Lietotāji un piekļuves
Publiska reģistrācija nav iespējama — kontus izveido tikai vadība sadaļā **Lietotāji un piekļuves**.
1. Nospiediet **Uzaicināt lietotāju**, norādiet vārdu, e-pastu un lomu. Ja darbinieka kartīte jau ir, izvēlieties **Piesaistīt esošam darbiniekam** — citādi tiks izveidots jauns darbinieka ieraksts.
2. Nospiediet **Izveidot kontu un saiti**. Nosūtiet saiti ar **Kopēt saiti**, **WhatsApp**, **E-pasts** vai **SMS**. Saite ir derīga 7 dienas un darbojas vienu reizi.
3. Ja personai vēl nav e-pasta, izmantojiet blokā **Sagatavotie konti** pogu **Sagatavot kontu** (vārds un loma). Kad e-pasts ir zināms, nospiediet **Ievadīt e-pastu** un saņemiet saiti.
4. Pirmajā ienākšanā lietotājam obligāti jāiestata sava parole (vismaz 10 rakstzīmes).

Cilnē **Uzaicinājumi** var izveidot **Jauna saite** vai **Atsaukt** uzaicinājumu. Lomu maina ar **Mainīt lomu**, piekļuvi aptur ar **Bloķēt piekļuvi** un atjauno ar **Atjaunot piekļuvi**. Savu lomu mainīt nevar, un organizācijā vienmēr jāpaliek vismaz vienam īpašniekam.

| Loma | Tipiskā piekļuve |
| Īpašnieks | Visas atļaujas, nav maināmas |
| Administrators | Sistēma, lietotāji, iestatījumi |
| Vadītājs | Objekti, stundas, izdevumi, tehnika |
| Brigadieris | Sava komanda un tās stundas |
| Mehāniķis | Tehnika un remonti |
| Darbinieks | Savs darbs un atskaites |

Precīzas tiesības katrai lomai redzamas un maināmas cilnē **Atļauju matrica**. Izmaiņas stājas spēkā uzreiz un tiek reģistrētas audita žurnālā.

+ Katram cilvēkam izveidojiet savu kontu un piesaistiet to viņa darbinieka kartītei.
+ Darbiniekam aizejot, tajā pašā dienā nospiediet **Bloķēt piekļuvi** un arhivējiet darbinieku.
+ Piešķiriet mazāko lomu, kas nepieciešama darbam; atalgojuma un finanšu tiesības — tikai tiem, kam tās tiešām vajadzīgas.
x Neizsniedziet vienu kontu vairākiem cilvēkiem un nesūtiet paroles — sūtiet tikai ielūguma saiti.
x Nepiešķiriet Administratora vai Īpašnieka lomu "uz laiku" — to ir viegli aizmirst.

## Audit Log, iestatījumi un paziņojumi
**Audit Log** ir nemaināms darbību žurnāls: kas, ko, kad un no kurienes mainīja, ar vērtībām **Iepriekš** un **Tagad**. Ierakstus nevar labot vai dzēst. Izmantojiet to, lai pārbaudītu stundu korekcijas, izdevumu lēmumus, lomu un atļauju izmaiņas.

**Iestatījumi** ir sadalīti cilnēs **Uzņēmumi**, **Holdings**, **Darba noteikumi** (virsstundas, maksimālā maiņa, trūkstošs check-out, brīdinājums par servisu), **Valstis**, **Klasifikatori** (darba veidi, degvielas tipi, problēmu un izdevumu kategorijas, dokumentu tipi, produkcijas mērvienības) un **Brīdinājumi**.

Zvaniņš augšējā joslā rāda paziņojumus; sadaļā **Paziņojumi** tos var atzīmēt ar **Atzīmēt visus kā lasītus**.

## Demo dati un īstie dati
Demonstrācijas organizācija kreisajā izvēlnē ir atzīmēta ar **DEMO DATI**, bet ieraksti — ar zīmi **DEMO**. Ja jums ir piekļuve vairākām organizācijām, pārslēdzieties starp tām lietotāja izvēlnē (uzspiežot uz sava vārda augšējā joslā).

!! Nejauciet datus: Pirms apstiprināt stundas, izdevumus vai uzaicināt darbiniekus, pārliecinieties, ka neesat demo organizācijā. Demo datus izmantojiet tikai apmācībai un prezentācijām.

## Biežākās kļūdas
- Skaitļi neatbilst gaidītajiem, jo augšējā joslā ir atlasīts viens uzņēmums vai viena valsts.
- Objektam nav ievadīts līgums — rentabilitāte un prognoze netiek aprēķināta.
- Darbiniekiem nav stundas likmes — darbaspēka izmaksas objektā ir par zemu.
- Stundas apstiprinātas, nepārbaudot aizmirstus check-out un ilgas maiņas.
- Izdevums noraidīts bez skaidra komentāra — darbinieks nezina, kas jālabo; labāk lietot **Pieprasīt labojumu**.
- Konts nav piesaistīts darbinieka kartītei — lietotājs nevar sākt darbu un apstiprināt noteikumus.
- Aizgājušam darbiniekam nav bloķēta piekļuve.
- Drošības noteikums vai mācību materiāls labots vairākas reizes pēc kārtas, katru reizi prasot visiem apstiprināt no jauna.

## Kontroljautājumi
1. Kur pārslēgt uzņēmumu un valsti, un kā tas ietekmē redzamos skaitļus?
2. Kas jāievada cilnē Finanses, lai redzētu objekta rentabilitāti un prognozi?
3. Kā iespēju Meža kartē pārvērst par darba objektu, un kas notiek ar tās statusu?
4. Kā izveidot kontu cilvēkam, kuram vēl nav e-pasta, un kas notiek viņa pirmajā ienākšanā?
5. Kas jāizdara tajā pašā dienā, kad darbinieks aiziet no uzņēmuma?`,
};
