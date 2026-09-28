import type { BuiltinMaterial } from "../types";

export const platformGuide: BuiltinMaterial = {
  key: "platform-guide",
  version: 1,
  category: "platform",
  country: null,
  title: "MJ Forest Guru platformas lietošanas rokasgrāmata",
  subtitle: "Kā ikdienā lietot platformu telefonā un datorā — no pirmās pieslēgšanās līdz maiņas beigām",
  summary:
    "Praktiska rokasgrāmata darbiniekiem, meistariem un mehāniķiem: pieslēgšanās, instalēšana telefonā, darba maiņas uzskaite, ātrās atskaites, darbs bez interneta un biežākās kļūdas. Jāizlasa un jāapstiprina pirms platformas lietošanas.",
  audience: ["employee", "foreman", "mechanic", "manager"],
  requiresAck: true,
  readingMinutes: 12,
  body: `## Kas ir platforma
MJ Forest Guru ir uzņēmuma privātā darba platforma, ko izmanto visi MJ Forest Guru grupas uzņēmumi — Land Guru (Latvija) un Skog Guru (Zviedrija) — darbā Latvijā, Zviedrijā un Islandē. Platformā reģistrē darba laiku, degvielu, izdevumus, bojājumus, incidentus, produkciju un uzdevumus. Šie dati ir pamats algas aprēķinam, izdevumu atmaksai, tehnikas remontiem un darba drošībai.

Platforma darbojas pārlūkā telefonā, planšetē un datorā. Telefonā apakšā ir galvenā izvēlne ar piecām pogām.
- **Sākums** — jūsu šodienas kopsavilkums: aktīvā maiņa, nostrādātās stundas, uzdevumi, jūsu objekts un tehnika.
- **Darbs** — darba maiņas sākšana, pārtraukumi un beigšana.
- **Ziņot** — lielā dzeltenā poga vidū ātrajām atskaitēm.
- **Uzdevumi** — jums piešķirtie darbi.
- **Vairāk** — visas pārējās sadaļas (Darba stundas, Drošība, Incidenti, Čeki, Apmācības u.c.) un poga **Iziet**.

Datorā tās pašas sadaļas ir kreisajā izvēlnē. Augšējā joslā ir sinhronizācijas indikators, dienas un nakts režīma slēdzis, paziņojumu zvaniņš un jūsu vārds (lietotāja izvēlne). Jūs redzat tikai tās sadaļas un datus, kas atbilst jūsu lomai.

!! Privāta sistēma: Platforma ir paredzēta tikai autorizētiem uzņēmuma lietotājiem. Visas darbības tiek reģistrētas. Nekad nedodiet savu paroli citam un neļaujiet citam strādāt jūsu kontā.

## Pirmā pieslēgšanās
Publiska reģistrācija nav iespējama. Kontu jums sagatavo administrators, un jūs saņemat vienreizēju ielūguma saiti (WhatsApp, SMS vai e-pastā).
1. Atveriet ielūguma saiti savā telefonā. Saite ir derīga 7 dienas un darbojas tikai vienu reizi.
2. Atvērsies logs **Laipni lūgti MJ Forest Guru**. Ievadiet savu paroli laukā **Jaunā parole** un atkārtojiet to laukā **Atkārtojiet paroli**. Parolei jābūt vismaz 10 rakstzīmes garai.
3. Nospiediet **Saglabāt paroli**. Paroles iestatīšana ir obligāta — kamēr tā nav iestatīta, platforma neļaus sākt darbu.
4. Turpmāk piesakieties ar savu e-pastu un paroli, nospiežot **Ieiet sistēmā**.

Ja aizmirsāt paroli, pieteikšanās logā nospiediet **Aizmirsāt paroli?**, ievadiet e-pastu un nospiediet **Nosūtīt saiti**. E-pastā saņemsiet saiti jaunas paroles iestatīšanai. Paroli var nomainīt arī jebkurā brīdī: augšējā joslā nospiediet uz sava vārda un izvēlieties **Mainīt paroli**.

! Saite nedarbojas: Ja redzat ziņu, ka uzaicinājuma saite nav derīga, jau izmantota vai tai beidzies termiņš, palūdziet administratoram jaunu saiti. Ja redzat ziņu par pārāk daudziem mēģinājumiem, pagaidiet dažas minūtes un mēģiniet vēlreiz.

## Instalēšana telefonā
Platformu var pievienot telefona sākuma ekrānam kā lietotni. Tad tā atveras pilnekrāna režīmā ar savu ikonu, bez pārlūka joslām.
- **Android (Chrome)** — atveriet platformu, nospiediet pārlūka izvēlni (trīs punkti) un izvēlieties **Instalēt lietotni** vai **Pievienot sākuma ekrānam**.
- **iPhone (Safari)** — atveriet platformu, nospiediet kopīgošanas pogu un izvēlieties **Pievienot sākuma ekrānam**.

? Ātrās saites: Android telefonā, ilgāk turot nospiestu MJ Forest Guru ikonu, parādās ātrās darbības **Sākt darbu**, **Pieteikt remontu** un **Degviela**.

Augšējā joslā ar slēdzi var pārslēgt dienas un nakts režīmu. Nakts režīms ir ērtāks tumsā un kabīnē, dienas režīms — spilgtā saulē. Izvēle tiek saglabāta ierīcē.

## Darba dienas plūsma
Katra darba maiņa tiek reģistrēta sadaļā **Darbs** (lapa **Mans darbs**).
1. Pirms darba sākšanas izvēlieties **Darba objekts**. Jums piešķirtie objekti ir saraksta augšā grupā **Mans objekts**.
2. Ja strādājat ar tehniku, izvēlieties to laukā **Tehnika (ja strādājat ar tehniku)**. Ja nē — atstājiet **Bez tehnikas**.
3. Izvēlieties **Darba veids**, piemēram, Ciršana (harvesters), Pievešana (forvarders) vai Krājas kopšana.
4. Nospiediet lielo apaļo pogu **Sākt darbu**. Telefons īsu brīdi rāda **Nosaka atrašanās vietu…** — atļaujiet piekļuvi atrašanās vietai.
5. Parādās taimeris, statuss **Darbs aktīvs** un sākuma laiks.
6. Dodoties pusdienās vai citā pārtraukumā, nospiediet **Pārtraukums** (statuss mainās uz **Pārtraukumā**). Atsākot darbu, nospiediet **Turpināt darbu**.
7. Darba beigās nospiediet **Beigt darbu**. Poga kļūst sarkana ar uzrakstu **Apstiprināt** un jautājumu **Beigt darba maiņu?** — nospiediet to dažu sekunžu laikā, citādi apstiprinājums atceļas.

Ja beidzat maiņu pārtraukuma laikā, pārtraukums tiek noslēgts automātiski. Vienlaikus var būt tikai viena aktīva maiņa. Ja dienas laikā pārejat uz citu objektu vai citu tehniku, beidziet maiņu un sāciet jaunu ar pareizo objektu un tehniku.

Atrašanās vieta tiek fiksēta tikai maiņas sākšanas un beigšanas brīdī. Ja GPS nav pieejams, darbs tiks reģistrēts bez atrašanās vietas — par to parādīsies brīdinājums. Lapā redzams arī **Šodien nostrādāts**, bloks **Manas stundas** un tabula **Pēdējās 7 dienas**. Visus savus darba ierakstus varat apskatīt sadaļā **Vairāk → Darba stundas**.

## Ātrās atskaites
Nospiediet dzelteno pogu **Ziņot** un izvēlieties, ko vēlaties reģistrēt. Ja jums ir aktīva maiņa, objekts un tehnika tiek aizpildīti automātiski — pārbaudiet tos.
- **Degviela** — tehnika, litri, kopsumma un valūta, degvielas tips, motostundas, laiks, uzpildes vieta un čeka foto.
- **Izdevums** — summa, valūta, datums, kategorija, objekts, apraksts un čeka foto. Izdevums uzreiz tiek iesniegts apstiprināšanai. Ja nav čeka, apraksts ir obligāts.
- **Problēma ar tehniku** — tehnika, problēmas kategorija, prioritāte (Zema, Vidēja, Augsta, Kritiska), īss apraksts, detalizēts apraksts un foto. Mehāniķis saņem paziņojumu.
- **Foto** — izvēlieties, kam pievienot foto (objektam vai tehnikai), un nofotografējiet.
- **Incidents** — veids (piemēram, Gandrīz negadījums vai Trauma), smagums, virsraksts, apraksts, veiktā tūlītējā rīcība, notikuma laiks un foto.
- **Produkcija** — objekts, tehnika, daudzums, mērvienība (m³, gab., kravas vai cits) un datums.

Vienai atskaitei var pievienot līdz 8 fotogrāfijām. Degvielai, problēmai un incidentam var pievienot arī GPS atrašanās vietu ar pogu **Pievienot GPS atrašanās vietu**. Nospiediet **Nosūtīt**. Ja redzat **Nosūtīts**, ieraksts ir saglabāts sistēmā. Ar **Pievienot vēl** var uzreiz reģistrēt nākamo ierakstu.

! Kritiska prioritāte: Izvēloties prioritāti Kritiska, tehnika tiek atzīmēta kā bojāta un sākas dīkstāves uzskaite. Lietojiet to tikai tad, ja ar tehniku nav iespējams vai nav droši strādāt.

Čekus var augšupielādēt arī sadaļā **Vairāk → Čeki → Pievienot čeku**. Sistēma mēģina nolasīt čeka datus automātiski, taču nolasīšana nav garantēta — logā **Pārbaudiet čeka datus** pārbaudiet katru lauku un tikai tad nospiediet **Apstiprināt un saglabāt**. Ja izdevumam pieprasīts labojums (statuss **Jālabo**), atveriet to sadaļā **Izdevumi**, izlabojiet un nospiediet **Iesniegt atkārtoti**.

## Darbs bez interneta
Mežā bieži nav zonas. Maiņas sākums, pārtraukumi, beigas un visas ātrās atskaites vispirms tiek saglabātas jūsu telefonā un nosūtītas, tiklīdz parādās internets.
- Bez interneta lapā redzams paziņojums **Bezsaistē — dati tiks saglabāti ierīcē**, bet pēc nosūtīšanas — **Gaida sinhronizāciju**.
- Augšējā joslā indikators rāda nenosūtīto ierakstu skaitu. Kad savienojums atjaunojas, sinhronizācija notiek automātiski. To var palaist arī ar roku, nospiežot indikatoru vai pogu **Mēģināt vēlreiz**.
- Lapā **Mans darbs** blokā **Ierīcē saglabātie ieraksti** redzams katrs vēl nenosūtītais ieraksts.

+ Pirms došanās uz vietu bez zonas atveriet sadaļu **Darbs** vai **Ziņot**, kamēr internets vēl ir, un turiet lietotni atvērtu.
+ Pēc atgriešanās zonā pārliecinieties, ka indikators ir pazudis — tas nozīmē, ka viss ir nosūtīts.
x Neizejiet no konta, nedzēsiet pārlūka datus un nenomainiet telefonu, kamēr ir nenosūtīti ieraksti — tie var tikt zaudēti.
x Bezsaistē nepārlādējiet lapu un nepārejiet uz citām sadaļām — tās bez interneta neatvērsies.

Ja ieraksts ir atzīmēts sarkanā krāsā ar **Neizdevās sinhronizēt**, tas netika pieņemts (piemēram, objekts jau ir slēgts). Izlasiet kļūdas tekstu, informējiet meistaru un tikai tad ierakstu atmetiet ar miskastes pogu.

## Uzdevumi
Sadaļā **Uzdevumi** redzami jums piešķirtie darbi ar prioritāti un termiņu. Uzdevumi ir sakārtoti kolonnās TODO, IN PROGRESS, WAITING un DONE. Kartīti var pārvilkt uz citu kolonnu vai mainīt statusu ar pogu **Mainīt statusu**. Sākot darbu, pārlieciet uzdevumu uz IN PROGRESS, bet, pabeidzot — uz DONE. Jaunus uzdevumus darbinieks var izveidot tikai sev. Kad jums piešķir uzdevumu, saņemat paziņojumu.

## Drošības noteikumu apstiprināšana
Sadaļā **Vairāk → Drošība** ir uzņēmuma drošības noteikumi. Sākuma ekrānā rādītājs **Gaida apstiprinājumu** parāda, cik noteikumu vēl jāapstiprina. Izlasiet katru noteikumu un nospiediet **Es esmu iepazinies ar šo informāciju.** Ja noteikums tiek atjaunināts, parādās ziņa **Noteikums atjaunināts — nepieciešama atkārtota iepazīšanās**, un tas jāapstiprina vēlreiz. Apstipriniet tikai to, ko esat izlasījis un sapratis. Neskaidrību gadījumā jautājiet meistaram.

## Paziņojumi
Zvaniņš augšējā joslā rāda nelasīto paziņojumu skaitu. Paziņojumus saņemat, piemēram, kad jums piešķirts uzdevums, kad jūsu izdevums apstiprināts, noraidīts vai jālabo, kad mainās jūsu pieteiktā remonta statuss vai kad mehāniķim piešķirts remonts. Nospiežot paziņojumu, atveras saistītais ieraksts. Ar **Atzīmēt visus kā lasītus** notīriet sarakstu, bet ar **Skatīt visus** atveriet pilnu sarakstu.

## Meistariem
Meistars (sistēmā loma **Brigadieris**) redz savu komandu un atbild par tās datu kvalitāti.
- **Sākums** — **Mana komanda**, **Check-in šodien** un problēmas, kurām nepieciešama uzmanība. Sadaļā **Brīdinājumi** redzami arī aizmirsti check-out un ilgas maiņas.
- **Darba stundas** — pārbaudiet komandas ierakstus. Nospiediet **Apstiprināt** pie ieraksta vai **Apstiprināt visus**. Kļūdainu ierakstu izlabojiet ar **Labot** — katra korekcija tiek reģistrēta audita žurnālā. Aizmirstu maiņu noslēdziet ar **Noslēgt maiņu**, norādot faktisko beigu laiku.
- **Komandas** — komandas sastāvs un tas, kurš šobrīd strādā.
- **Uzdevumi** — ar **Jauns uzdevums** izveidojiet un piešķiriet darbus, norādiet prioritāti un termiņu, sekojiet izpildei uz tāfeles.

## Mehāniķiem
Mehāniķi strādā sadaļā **Vairāk → Apkope un remonti**. Tur redzami **Atvērtie remonti**, **Tuvākie servisi** un tehnikas stāvoklis.
1. Saņemot paziņojumu par jaunu vai piešķirtu remontu, atveriet to un nospiediet **Apstiprināt saņemšanu**.
2. Sākot darbu, nospiediet **Sākt remontu**. Ja jāgaida detaļas, izvēlieties **Gaida detaļas**, ja remonts notiek servisā — **Nodot ārējā servisā**.
3. Ar **Pievienot detaļu** reģistrējiet izmantotās rezerves daļas. Pievienojiet foto blokos **Pirms** un **Pēc**, bet servisa rēķinus un detaļu čekus — blokā **Rēķini un čeki**.
4. Pabeidzot nospiediet **Pabeigt remontu** un aizpildiet **Veiktais darbs**, darba stundas un dīkstāvi. Veiktā darba apraksts ir obligāts.
5. Plānoto servisu, eļļas maiņu vai apskati reģistrējiet ar **Reģistrēt apkopi**.

Pabeigtu remontu apstiprina vadītājs. Katra statusa maiņa tiek saglabāta remonta vēsturē.

## Biežākās kļūdas
- Aizmirsts **Beigt darbu** — maiņa paliek atvērta, un meistars saņem brīdinājumu. Nekavējoties informējiet meistaru par faktisko beigu laiku. Darbinieks pats savus darba ierakstus labot nevar.
- Nepareizs objekts vai tehnika maiņas sākumā — beidziet maiņu un informējiet meistaru, lai ieraksts tiktu izlabots.
- Nav atļauta atrašanās vieta — atļaujiet to pārlūka vai telefona iestatījumos.
- Ziņa **Jūsu lietotājs nav piesaistīts darbiniekam** — sazinieties ar administratoru, jo bez tā nevar reģistrēt darbu.
- Izslēgts telefons vai izdzēsti pārlūka dati pirms sinhronizācijas — ieraksti tiek zaudēti.
- Neskaidrs čeka foto — izdevumu var noraidīt vai pieprasīt labojumu.
- Ziņa **Sesija ir beigusies** — piesakieties vēlreiz. Nenosūtītie ieraksti paliek ierīcē un tiks nosūtīti pēc pieteikšanās.

## Palīdzība
Par darba jautājumiem, stundu labojumiem, objektiem un uzdevumiem vērsieties pie sava meistara. Tehnisku problēmu gadījumā (nevar pieslēgties, nedarbojas ielūguma saite, konts nav piesaistīts darbiniekam, ieraksti nesinhronizējas) sazinieties ar administratoru. Aprakstiet, ko darījāt, kādu ziņu redzējāt un kurā laikā, un, ja iespējams, pievienojiet ekrānuzņēmumu.

## Kontroljautājumi
1. Cik ilgi ir derīga ielūguma saite, un kas jāizdara pirmajā pieslēgšanās reizē?
2. Kādā secībā reģistrē darba maiņu, un kas jāizdara, ja dienas laikā pārejat uz citu objektu?
3. Kā redzēt, ka bezsaistē saglabātie ieraksti vēl nav nosūtīti, un ko nedrīkst darīt, kamēr tie nav nosūtīti?
4. Kuros gadījumos bojājumam jāizvēlas prioritāte Kritiska, un ko tā maina sistēmā?
5. Kur apstiprina drošības noteikumus, un kas jādara, ja noteikums ir atjaunināts?
6. Ko darīt, ja aizmirsāt nospiest Beigt darbu?`,
};
