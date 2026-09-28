import type { BuiltinMaterial } from "../types";

export const reportingRules: BuiltinMaterial = {
  key: "reporting-rules",
  version: 1,
  category: "reporting",
  country: null,
  title: "Atskaišu un dokumentēšanas noteikumi",
  subtitle: "Ko, kad un kā reģistrēt platformā — uzņēmuma iekšējie noteikumi visiem darbiniekiem",
  summary:
    "Uzņēmuma iekšējie noteikumi par darba laika, degvielas, izdevumu, bojājumu, incidentu un produkcijas reģistrēšanu MJ Forest Guru platformā. Nosaka termiņus, foto prasības, labojumu kārtību, meistaru pienākumus un to, kā tiek izmantoti atrašanās vietas dati.",
  audience: ["employee", "foreman", "mechanic", "manager"],
  requiresAck: true,
  readingMinutes: 10,
  body: `## Kāpēc šie noteikumi ir svarīgi
Platformā ievadītie dati ir oficiāls uzņēmuma darba uzskaites avots. Pēc tiem tiek aprēķināta alga, atmaksāti izdevumi, izrakstīti rēķini klientiem, plānoti tehnikas remonti un izmeklēti negadījumi. Noteikumi ir vienādi visiem MJ Forest Guru grupas uzņēmumiem — Land Guru un Skog Guru — un visām valstīm, kurās strādājam: Latvijai, Zviedrijai un Islandei.

Galvenais princips ir vienkāršs: reģistrējiet notikumu tajā brīdī, kad tas notiek, ar patiesiem datiem un, ja nepieciešams, ar skaidru foto. Vēlāk atcerēts ieraksts gandrīz vienmēr ir neprecīzs.

!! Godīgums: Apzināti nepatiesi dati — izdomāts darba laiks, svešs čeks, nepareizi litri vai slēpts negadījums — ir nopietns darba disciplīnas pārkāpums. Kļūdīties var ikviens, bet kļūda ir jāziņo un jāizlabo.

## Kas, kad un kur jāreģistrē
| Kas | Kad | Kur platformā |
| Darba sākums | Tajā brīdī, kad sākat darbu objektā | Darbs → Sākt darbu |
| Pārtraukums un darba turpināšana | Katra pārtraukuma sākumā un beigās | Darbs → Pārtraukums / Turpināt darbu |
| Darba beigas | Tajā brīdī, kad beidzat darbu | Darbs → Beigt darbu → Apstiprināt |
| Degvielas uzpilde | Pēc katras uzpildes, pirms darba turpināšanas | Ziņot → Degviela |
| Izdevums ar čeku | Tajā pašā dienā | Ziņot → Izdevums vai Vairāk → Čeki |
| Bojājums vai tehnikas problēma | Nekavējoties, tiklīdz pamanīts | Ziņot → Problēma ar tehniku |
| Incidents vai gandrīz negadījums | Nekavējoties, tiklīdz tas ir droši | Ziņot → Incidents |
| Dienas produkcija | Katru dienu līdz maiņas beigām | Ziņot → Produkcija |
| Objekta vai tehnikas stāvokļa foto | Kad to prasa meistars vai situācija | Ziņot → Foto |
| Uzdevuma statuss | Tajā pašā dienā, kad mainās statuss | Uzdevumi |
| Drošības noteikumu apstiprināšana | Pirms pirmās maiņas un pirms nākamās maiņas pēc jaunas versijas | Vairāk → Drošība |
| Remonta gaita (mehāniķis) | Tajā pašā dienā, kad mainās statuss | Vairāk → Apkope un remonti |
| Veikta apkope (mehāniķis) | Tajā pašā dienā | Apkope un remonti → Reģistrēt apkopi |
| Stundu apstiprināšana (meistars) | Katru nedēļu līdz pirmdienai plkst. 12.00 | Vairāk → Darba stundas |

## Darba laiks
+ Nospiediet **Sākt darbu** tikai tad, kad faktiski sākat darbu, un **Beigt darbu** — kad to beidzat. Ne agrāk un ne vēlāk.
+ Katru pusdienu vai citu pārtraukumu reģistrējiet ar **Pārtraukums** un **Turpināt darbu**.
+ Maiņas sākumā izvēlieties pareizo darba objektu, tehniku un darba veidu. Ja dienas laikā maināt objektu vai tehniku, beidziet maiņu un sāciet jaunu.
+ Atļaujiet telefonam noteikt atrašanās vietu. Ja GPS nedarbojas, informējiet meistaru tajā pašā dienā.
x Aizliegts sākt vai beigt maiņu cita darbinieka vietā vai lūgt to izdarīt citam.
x Aizliegts sākt maiņu, pirms esat ieradies darba vietā, ja vien meistars nav noteicis citādi (piemēram, pārbrauciens starp objektiem).

Ja aizmirsāt sākt vai beigt maiņu, tajā pašā dienā paziņojiet meistaram precīzus laikus. Sistēma automātiski brīdina vadību par maiņām, kas atvērtas neparasti ilgi.

## Degviela
Katra uzpilde tiek reģistrēta atsevišķi, arī uzpilde no objekta degvielas tvertnes.
- Obligāti: **Tehnika** un **Litri**.
- Jānorāda vienmēr: **Motostundas** no tehnikas skaitītāja, **Degvielas tips**, **Laiks** un **Uzpildes vieta** (DUS nosaukums vai, piemēram, objekta tvertne).
- Pērkot degvielu par naudu: **Kopsumma**, **Valūta** un čeka foto.

Motostundas ir nepieciešamas patēriņa (L/h) aprēķinam. Bez tām nevar pamanīt noplūdes, zādzības vai tehnikas problēmas. Ja sistēma brīdina, ka šāds ieraksts jau eksistē, nereģistrējiet to atkārtoti — pārbaudiet, vai uzpilde jau nav ievadīta.

## Izdevumi un čeki
Izdevums tiek reģistrēts tajā pašā dienā, kad veikts pirkums, ar čeka foto. Ātrajā atskaitē izdevums uzreiz tiek iesniegts apstiprināšanai.
- Obligāti: **Summa**, **Valūta**, **Datums**, **Kategorija** un čeka foto vai apraksts.
- Norādiet **Darba objekts**, ja izdevums attiecas uz konkrētu objektu.
- **Apraksts**: kas pirkts un kāpēc, piemēram, „hidrauliskā šļūtene harvesterim, avārijas remonts”.
- Ja čeka nav, aprakstā paskaidrojiet iemeslu. Izdevums bez čeka var netikt atmaksāts.

Papīra čeka oriģinālu saglabājiet un nododiet atbilstoši grāmatvedības norādījumiem. Augšupielādējot čeku sadaļā **Čeki**, sistēma aizpilda laukus automātiski, taču tie jāpārbauda pirms **Apstiprināt un saglabāt**.

## Foto prasības
Foto ir pierādījums. Nekvalitatīvs foto ir tas pats, kas foto neesamība.
+ Kadrā ir viss čeks ar visiem četriem stūriem.
+ Salasāms ir tirgotāja nosaukums, datums, summa un PVN.
+ Foto ir uzņemts labā apgaismojumā, bez atspīduma, ēnām un izplūduma. Čeks ir iztaisnots uz līdzenas virsmas.
+ Garu čeku fotografējiet vairākās daļās. Vienai atskaitei var pievienot līdz 8 foto.
+ Bojājumam uzņemiet kopskatu, bojātās vietas tuvplānu un, ja iespējams, motostundu skaitītāju.
+ Incidentam fotografējiet vietu, tehniku un bojājumus tikai tad, kad tas ir droši.
x Nefotografējiet cietušo seju un neiesaistītas personas.
x Neizmantojiet ekrānuzņēmumus vai citu cilvēku čeku foto.

## Bojājumi un remonti
Par tehnikas bojājumu ziņojiet nekavējoties, tiklīdz to pamanāt, nevis maiņas beigās. Aprakstiet, kas notika, kad tas sākās, kādas ir pazīmes (troksnis, noplūde, kļūdas kods) un vai darbu var turpināt. Pievienojiet foto un atrašanās vietu.

!! Kritiska prioritāte: Ja tehnika nav droša lietošanai (noplūde, bremžu, stūres vai manipulatora kļūme, ugunsbīstamība), apturiet darbu, izvēlieties prioritāti Kritiska un zvaniet meistaram vai mehāniķim.

Mehāniķis remonta gaitu atjauno tajā pašā dienā, kad tā mainās, bet pabeidzot remontu reģistrē veikto darbu, rezerves daļas, darba stundas un dīkstāvi.

## Incidenti un gandrīz negadījumi
Vispirms rūpējieties par cilvēku drošību. Ja ir cietušie vai ugunsgrēks, zvaniet 112 un sniedziet pirmo palīdzību, tad nekavējoties zvaniet meistaram. Kad tas ir droši, reģistrējiet incidentu platformā.

Gandrīz negadījums ir situācija, kad neviens necieta, bet kāds varēja ciest, piemēram, koks krita nepareizā virzienā vai pārtrūka trose. Tas jāreģistrē tikpat obligāti kā negadījums. Tā ir galvenā informācija, kas ļauj novērst nākamo negadījumu.

Norādiet: veidu, smagumu, virsrakstu, precīzu aprakstu, notikuma laiku, objektu, tehniku un veikto tūlītējo rīcību. Rakstiet faktus, nevis vainīgos.

? Bez sodīšanas: Par godīgi ziņotu gandrīz negadījumu vai paša kļūdu darbinieks netiek sodīts. Sods var sekot par incidenta slēpšanu.

## Produkcija un uzdevumi
Dienas produkciju reģistrē katru dienu līdz maiņas beigām katram objektam atsevišķi. Norādiet objektu, tehniku, daudzumu, mērvienību (m³, gab., kravas vai cits) un datumu. Ja mērvienība ir cits, aizpildiet **Mērvienības nosaukums**. Daudzumam jāatbilst faktiski saražotajam — neapaļojiet un nepārnesiet uz citām dienām.

Uzdevumu statusu mainiet tajā pašā dienā: sākot darbu — IN PROGRESS, gaidot kaut ko — WAITING, pabeidzot — DONE.

## Labojumu kārtība
Kļūdu nedrīkst slēpt vai labot ar jaunu, dublējošu ierakstu.
1. Pamanot kļūdu savā darba laikā, tajā pašā dienā paziņojiet meistaram pareizos datus. Darbinieks savus darba ierakstus labot nevar.
2. Meistars izlabo ierakstu ar **Labot**. Katra korekcija tiek reģistrēta audita žurnālā ar iepriekšējo un jauno vērtību.
3. Ja izdevumam pieprasīts labojums (statuss **Jālabo**), izlabojiet to sadaļā **Izdevumi** un nospiediet **Iesniegt atkārtoti** divu darba dienu laikā.
4. Par kļūdām degvielas, bojājumu vai incidentu ierakstos informējiet meistaru, kurš nodrošinās labojumu.

## Atrašanās vietas dati un privātums
Atrašanās vietas datus uzņēmums apstrādā saskaņā ar Vispārīgo datu aizsardzības regulu (VDAR). Telefona atrašanās vieta tiek fiksēta tikai darba laikā un tikai konkrētos brīžos — nospiežot **Sākt darbu** un **Beigt darbu**, kā arī tad, ja pats nospiežat **Pievienot GPS atrašanās vietu** atskaitē. Platforma nepārtraukti neizseko darbinieku telefonus un neizseko atrašanās vietu ārpus darba laika.

Tehnikas GPS dati nāk no tehnikā uzstādītām izsekošanas ierīcēm un attiecas uz uzņēmuma tehniku.

Datu izmantošanas mērķi:
- darba laika un darba vietas uzskaite un pārbaude;
- darba drošība, arī cilvēka atrašana ārkārtas situācijā;
- tehnikas uzraudzība un izmaksu aprēķins;
- rēķinu sagatavošana un atskaites klientiem.

Piekļuve atrašanās vietas datiem, čekiem un incidentu foto ir tikai lietotājiem ar atbilstošām tiesībām, un visas darbības tiek reģistrētas. Jums ir tiesības saņemt informāciju par saviem datiem un pieprasīt neprecīzu datu labošanu, vēršoties pie administratora.

x Aizliegts viltot atrašanās vietu, izmantot citas personas kontu vai kopīgot platformas datus ārpus uzņēmuma.

## Meistaru pienākumi
- Katru dienu pārbaudīt komandas darba ierakstus, aizmirstos check-out un brīdinājumus.
- Noslēgt aizmirstas maiņas ar **Noslēgt maiņu**, norādot faktisko beigu laiku pēc saskaņošanas ar darbinieku.
- Apstiprināt iepriekšējās nedēļas darba stundas katru pirmdienu līdz plkst. 12.00.
- Pārliecināties, ka produkcija ir reģistrēta katru dienu un atbilst faktiskajam apjomam.
- Sekot, lai komandas bojājumi un incidenti tiek reģistrēti nekavējoties.
- Pārbaudīt, vai visi komandas locekļi ir apstiprinājuši drošības noteikumus.
- Nekavējoties ziņot vadībai par jebkādām aizdomām par nepatiesiem datiem.

## Sekas, ja noteikumi netiek ievēroti
- Nereģistrētas vai neapstiprinātas stundas netiek iekļautas algas aprēķinā, kamēr tās nav pārbaudītas.
- Izdevumi bez čeka vai skaidra apraksta var tikt noraidīti un netikt atmaksāti.
- Novēloti ziņots bojājums var palielināt remonta izmaksas un dīkstāvi. Tas tiek ņemts vērā, izvērtējot atbildību.
- Apzināti nepatiesi dati, incidenta slēpšana vai svešs konts ir disciplinārs pārkāpums saskaņā ar darba kārtības noteikumiem un piemērojamiem darba tiesību aktiem.

## Kontroljautājumi
1. Kad jānospiež Sākt darbu un Beigt darbu, un kas jādara, ja aizmirsāt to izdarīt?
2. Kādi dati jānorāda pie katras degvielas uzpildes, un kāpēc motostundas ir obligātas?
3. Kādām prasībām jāatbilst čeka foto?
4. Kā rīkoties, ja notiek negadījums ar cietušo, un kad reģistrē gandrīz negadījumu?
5. Kad telefona atrašanās vieta tiek fiksēta un kādiem mērķiem tā tiek izmantota?
6. Līdz kuram laikam meistaram jāapstiprina komandas darba stundas?`,
};
