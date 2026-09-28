import type { BuiltinMaterial } from "../types";

export const safetyLV: BuiltinMaterial = {
  key: "safety-lv",
  version: 1,
  category: "safety",
  country: "LV",
  title: "Darba drošība mežizstrādē — Latvija",
  subtitle: "Likuma prasības un uzņēmuma noteikumi darbam MJ FOREST GURU objektos Latvijā",
  summary:
    "Galvenās darba aizsardzības, ugunsdrošības un vides prasības mežizstrādē Latvijā: individuālie aizsardzības līdzekļi, drošās distances, darbs vienatnē, ziņošana par negadījumiem un rīcība, zvanot 112. Jāizlasa un jāapstiprina pirms darba uzsākšanas Latvijas objektos.",
  audience: ["employee", "foreman", "mechanic", "manager"],
  requiresAck: true,
  readingMinutes: 14,
  body: `## Kam paredzēts šis materiāls
Šis materiāls attiecas uz visiem, kas strādā MJ FOREST GURU (Land Guru) objektos Latvijā: harvesteru un forvarderu operatoriem, motorzāģa darbiniekiem, meistariem, mehāniķiem un autovadītājiem. Tas neaizstāj ievadapmācību un instruktāžu darba vietā, bet apkopo svarīgāko, kas jāzina katram.

Tekstā ir divu veidu prasības:
- **Likuma prasība** — izriet no Latvijas normatīvajiem aktiem, un to pārbauda valsts iestādes (VDI, VMD, policija).
- **Uzņēmuma noteikums** — MJ FOREST GURU iekšējā prasība. Tā var būt stingrāka par likumu, un tā ir obligāta visiem mūsu objektos.

? Aktuālā versija: Normatīvie akti mainās. Aktuālo šī materiāla versiju uztur meistars un sistēmas administrators. Ja pamani, ka kaut kas vairs neatbilst realitātei, ziņo meistaram.

## Darba devēja pienākumi
Saskaņā ar Darba aizsardzības likumu darba devējs organizē darba aizsardzības sistēmu un sedz visus ar to saistītos izdevumus. Praksē tas nozīmē:
- novērtēt darba vides risku katrā darba veidā un objektā (darba vides iekšējā uzraudzība);
- nodrošināt ievadapmācību un instruktāžu darba vietā pirms darba uzsākšanas, kā arī atkārtotas instruktāžas;
- bez maksas izsniegt piemērotus individuālos aizsardzības līdzekļus (IAL) un rūpēties par to uzturēšanu;
- nodrošināt, ka darba aprīkojums (tehnika, motorzāģi, instrumenti) ir drošā stāvoklī;
- organizēt pirmo palīdzību un rīcību ārkārtas situācijās;
- izmeklēt un uzskaitīt nelaimes gadījumus darbā.

## Darbinieka pienākumi un tiesības
Likuma prasība (Darba aizsardzības likums): katrs darbinieks rūpējas par savu un kolēģu drošību un veselību.
+ Lieto tehniku un instrumentus atbilstoši ražotāja instrukcijām un saņemtajai instruktāžai.
+ Pareizi lieto izsniegtos IAL visu darba laiku bīstamajā zonā.
+ Nekavējoties ziņo meistaram par nelaimes gadījumu, bīstamu situāciju vai bojātu aprīkojumu.
+ Piedalās apmācībās un instruktāžās.
+ Ievēro meistara norādījumus un drošības zīmes objektā.

Tiesības atteikties: likums dod tiesības atteikties veikt darbu, kas rada tiešus draudus drošībai vai veselībai, ja nav nepieciešamo IAL vai ja darbam nav atbilstošas apmācības. Par šādu atteikumu nedrīkst radīt nelabvēlīgas sekas.

!! Nedari to, ko neproti: Ja neesi apmācīts konkrētai tehnikai vai darbam (piemēram, bīstamu, sašķiebtu vai vēja gāztu koku apstrādei), darbu neuzsāc un sazinies ar meistaru.

## Individuālie aizsardzības līdzekļi (IAL)
Konkrēto IAL komplektu nosaka darba vides riska novērtējums. Tabulā ir uzņēmuma minimālā prasība.

| Darbs | Obligātie IAL | Standarts (atzīme uz izstrādājuma) |
| Motorzāģa darbs | Aizsargķivere ar sietveida sejsargu un austiņām | EN 397, EN 1731, EN 352 |
| Motorzāģa darbs | Bikses vai kājsargi ar zāģa aizsardzību | EN ISO 11393-2 |
| Motorzāģa darbs | Zābaki ar zāģa aizsardzību | EN ISO 17249 |
| Motorzāģa darbs | Darba cimdi (ieteicami ar zāģa aizsardzību) | EN ISO 11393-4 |
| Motorzāģa darbs | Signālkrāsas virsdrēbes | EN ISO 20471 |
| Tehnikas operators ārpus kabīnes | Ķivere, signālkrāsas veste, drošības apavi | EN 397, EN ISO 20471, EN ISO 20345 |
| Mehāniķis | Drošības apavi, cimdi, aizsargbrilles, dzirdes aizsardzība pēc vajadzības | EN ISO 20345, EN 166 |
| Autovadītājs iekraušanā | Signālkrāsas veste, drošības apavi, ķivere pie krāna | EN ISO 20471, EN ISO 20345 |

- Bikses ar zāģa aizsardzību pēc iegriezuma **vienmēr jāmaina** — aizsargšķiedras pēc iegriezuma vairs nepasargā.
- Ķiveri maina ražotāja norādītajā termiņā vai pēc trieciena.
- Bojātu vai nederīgu IAL nekavējoties uzrādi meistaram un saņem jaunu.

x Aizliegts strādāt ar motorzāģi bez pilna IAL komplekta — arī „tikai vienu koku”.

## Drošās distances
| Situācija | Minimālā distance | Statuss |
| Koka gāšana ar motorzāģi — citi cilvēki | Vismaz 2 gāžamā koka garumi | Uzņēmuma noteikums (nozares prakse) |
| Divi motorzāģa darbinieki viens no otra | Vismaz 2 koku garumi | Uzņēmuma noteikums |
| Strādājošs harvesters | 90 m (uz mašīnas parasti norādīti 70 m) | Uzņēmuma noteikums |
| Strādājošs forvarders vai krāns | Ārpus krāna sniedzamības + 5 m, ne mazāk kā 20 m | Uzņēmuma noteikums |
| Gaisvadu elektrolīnija | Darbs tuvāk par 30 m tikai pēc meistara instruktāžas | Uzņēmuma noteikums |

+ Tuvojoties strādājošai tehnikai, vispirms nodibini acu kontaktu vai radio/telefona sakarus un sagaidi, kamēr operators aptur darbu un nolaiž galvu vai krānu.
x Aizliegts atrasties zem pacelta krāna, kravas vai harvestera galvas.

## Darbs vienatnē un sakari
Uzņēmuma noteikums: koku gāšanu ar motorzāģi vienatnē neveic, ja vien meistars to nav īpaši atļāvis un noteicis sakaru kārtību. Ja darbs vienatnē ir atļauts:
1. Pirms maiņas pārbaudi mobilā tīkla pārklājumu. Ja tā nav, vienojies par citu sakaru veidu vai darbu neuzsāc.
2. Telefonam jābūt uzlādētam; līdzi ņem rezerves akumulatoru.
3. Paziņo meistaram, kur strādāsi, un zini sava objekta koordinātas.
4. Sazinies ar meistaru vai kolēģi norunātajos laikos (ne retāk kā ik pēc 2 stundām) un darba beigās.
5. Ja norunātā saziņa neienāk, meistars nekavējoties sāk meklēšanu.

## Laikapstākļi
- **Stiprs vējš:** pārtrauc manuālu koku gāšanu, ja vējš ietekmē krišanas virzienu. Vēja gāztu koku apstrādi veic tikai apmācīti darbinieki.
- **Pērkona negaiss:** motorzāģa darbinieki pārtrauc darbu un dodas uz transportlīdzekli; operatori paliek slēgtā kabīnē.
- **Apledojums, sniegs:** pārbaudi slīdamību kāpjot tehnikā — vienmēr trīs atbalsta punkti.
- **Karstums:** dzer ūdeni, ieturi pauzes ēnā, novēro sevi un kolēģus.
- **Sals un mitrums:** sausas rezerves drēbes un cimdi; nestrādā slapjā apģērbā.
- **Tumsa, migla:** ja redzamība nav pietiekama, lai droši kontrolētu bīstamo zonu, darbu pārtrauc.

## Ugunsdrošība mežā
Likuma prasība: meža ugunsnedrošais periods Latvijā ir no 1. aprīļa līdz 30. septembrim (Ugunsdrošības, ugunsdzēsības un glābšanas darbu likums). Šajā laikā mežā aizliegts nomest degošus smēķus, kurināt ugunskurus ārpus tam paredzētām vietām un veikt darbības, kas var izraisīt ugunsgrēku. Cirsmu atlieku dedzināšana bez Valsts meža dienesta (VMD) atļaujas nav pieļaujama. Ugunsgrēka dzēšanas laikā VMD var apturēt mežizstrādes darbus.

Uzņēmuma noteikumi:
+ Katrā tehnikas vienībā un transportlīdzeklī ir pārbaudīts ugunsdzēšamais aparāts.
+ Smēķē tikai meistara norādītā vietā uz minerālgrunts, izsmēķus nodzēs un aiznes.
+ Motora nodalījumu un izplūdes sistēmas zonu regulāri attīra no skaidām, zariem un eļļas.
+ Sausā laikā pēc maiņas apstaigā darba vietu un pārliecinies, ka nekas negruzd.
x Tehniku ar bojātu izplūdes sistēmu mežā nelieto.

!! Ugunsgrēks: Zvani 112, brīdini citus, ja iespējams un droši — dzēs ar ugunsdzēšamo aparātu. Pēc tam ziņo meistaram.

## Pirmās palīdzības aprīkojums
Likuma prasība: darba devējs nodrošina pirmās palīdzības līdzekļus un apmācītus cilvēkus. Uzņēmuma noteikumi:
- katrā tehnikas vienībā un transportlīdzeklī ir pirmās palīdzības aptieciņa ar turniketu;
- katrs motorzāģa darbinieks nēsā līdzi individuālo pārsienamo paketi (piemēram, bikšu kabatā);
- aptieciņas saturu pārbauda katru mēnesi, izlietoto papildina uzreiz.

Pilns minimālais saturs ir aprakstīts materiālā „Rīcība ārkārtas situācijās”.

## Nelaimes gadījumi un gandrīz negadījumi
Uzņēmuma noteikums: par katru nelaimes gadījumu, traumu, ugunsgrēku, vides piesārņojumu vai **gandrīz negadījumu** (kad nekas nenotika, bet varēja) ziņo:
1. nekavējoties meistaram pa tālruni;
2. tās pašas maiņas laikā lietotnes sadaļā „Incidenti” — „Ziņot par incidentu”, pievienojot GPS atrašanās vietu un fotoattēlus.

Likuma prasība (MK noteikumi Nr. 950): nelaimes gadījumu, kura dēļ darbnespēja ilgst vairāk nekā vienu dienu, darba devējs izmeklē un noformē. Ja cietušajam ir smagi vai iespējami smagi veselības traucējumi vai iestājusies nāve, darba devējs nekavējoties paziņo policijai un Valsts darba inspekcijai (VDI). Notikuma vietu saglabā neskartu, ja tas neapdraud cilvēkus vai vidi.

! Pierādījumi: Nepārvieto tehniku, instrumentus vai kokus pēc negadījuma, ja tas nav nepieciešams glābšanai vai drošībai. Ja kaut kas jāpārvieto, vispirms nofotografē.

## Vides aizsardzība
Likuma prasības (Meža likums, MK noteikumi Nr. 935 un Nr. 936, Aizsargjoslu likums):
- Koku ciršanu veic tikai cirsmā, kurai ir derīgs VMD ciršanas apliecinājums, un tikai tās robežās.
- Galvenajā cirtē atstāj ekoloģiskos kokus (vismaz 8 uz hektāru, citās cirtēs vismaz 5). Meistara vai plānotāja iezīmētus kokus nedrīkst cirst.
- Ap avotiem un avoksnājiem 10 m platā joslā saglabā raksturīgo veģetāciju; gar strautiem un meža malās saglabā daļēju apaugumu.
- No 1. aprīļa līdz 30. jūnijam atsevišķās vietās (piemēram, ezeru un purvu salās, ūdeņu krastos, bioloģiski vērtīgās audzēs) aizliegta koku ciršana ar motorizētu tehniku, kā arī jaunaudžu kopšana noteiktās audzēs.
- Grāvjus, strautus un upes nedrīkst aizsprostot; ja tas darba laikā noticis, notecei jābūt atjaunotai pēc darbu beigām.
- Ūdensobjektu un elektrolīniju aizsargjoslās ir saimnieciskās darbības ierobežojumi — robežas norāda cirsmas dokumentos.

Uzņēmuma noteikumi:
+ Ja atrodi lielu putnu ligzdu (piemēram, stārķa, ērgļa, melnā stārķa), darbu tuvumā pārtrauc un ziņo meistaram.
+ Degvielu uzpilda un tehniku apkopj ne tuvāk kā 50 m no ūdeņiem.
+ Katrā tehnikā ir absorbenta komplekts. Noplūdi aptur, savāc un ziņo lietotnē kā „Vides incidents”.
x Aizliegts šķērsot strautus ārpus meistara norādītām pārbrauktuvēm.
x Aizliegts atstāt mežā atkritumus, eļļas filtrus, tukšas kannas.

## Dokumenti, kam jābūt līdzi
- Personu apliecinošs dokuments.
- Tehnikas operatoriem — traktortehnikas vadītāja apliecība ar atbilstošu kategoriju (izsniedz VTUA); autovadītājiem — vadītāja apliecība un nepieciešamās kvalifikācijas apliecības.
- Uzņēmuma noteikums: motorzāģa darbiniekiem — apliecinājums par motorzāģa darba apmācību.
- Tehnikā — tās reģistrācijas dokumenti.
- Uzņēmuma noteikums: cirsmas karte un ciršanas apliecinājuma informācija, kas pieejama lietotnē vai izdrukā.

## Ārkārtas numuri un koordinātas
- **112** — vienotais ārkārtas numurs (ugunsdzēsēji, ātrā palīdzība, policija).
- **113** — Neatliekamās medicīniskās palīdzības dienests.
- **110** — Valsts policija.
- **67042473** — Saindēšanās un zāļu informācijas centrs (visu diennakti).

Koordinātas: telefona kartes lietotnē ilgi nospied savu atrašanās vietu — parādīsies divi skaitļi, piemēram, 56.95012, 24.10523. Pirmais ir platums, otrais — garums. Nolasi tos lēnām, cipariem. Papildus nosauc tuvāko ceļu, apdzīvoto vietu un kur ātrā palīdzība tiks sagaidīta.

## Zvanot 112
1. „Ārkārtas situācija mežizstrādē. Esmu [vārds], zvanu no uzņēmuma Land Guru.”
2. „Notika [kas notika — piemēram, motorzāģa iegriezums kājā, koks uzkrita cilvēkam, deg tehnika].”
3. „Cietušie: [cik], stāvoklis: [pie samaņas / elpo / stipri asiņo].”
4. „Atrašanās vieta: koordinātas [platums, garums], tuvākais ceļš [nosaukums vai numurs], pagasts, novads.”
5. „Sagaidīsim pie [ceļu krustojums / meža ceļa sākums], tur būs cilvēks ar signālvesti.”
6. „Mans tālruņa numurs: [numurs].” Neatvieno zvanu, kamēr dispečers to neatļauj.

## Svarīgākie kontakti
| Kas | Kontakts | Kad izmantot |
| Ārkārtas dienesti | 112 | Trauma, ugunsgrēks, dzīvības apdraudējums |
| Tavs meistars | Tālrunis no instruktāžas (saglabā telefonā) | Uzreiz pēc 112 vai jebkurā bīstamā situācijā |
| Valsts darba inspekcija | vdi.gov.lv; ārpus darba laika +371 67021797 | Smagu un letālu negadījumu paziņošana (to dara darba devējs) |
| Valsts meža dienests | vmd.gov.lv | Meža ugunsgrēki, ciršanas apliecinājumi |
| Saindēšanās un zāļu informācijas centrs | 67042473 | Saindēšanās ar ķimikālijām, degvielu |
| Neatliekamā medicīniskā palīdzība | 113 | Medicīniska palīdzība |

## Atsauces
- Darba aizsardzības likums — likumi.lv
- MK 2007. gada 2. oktobra noteikumi Nr. 660 „Darba vides iekšējās uzraudzības veikšanas kārtība”
- MK 2010. gada 10. augusta noteikumi Nr. 749 „Apmācības kārtība darba aizsardzības jautājumos”
- MK 2002. gada 20. augusta noteikumi Nr. 372 „Darba aizsardzības prasības, lietojot individuālos aizsardzības līdzekļus”
- MK 2002. gada 9. decembra noteikumi Nr. 526 „Darba aizsardzības prasības, lietojot darba aprīkojumu un strādājot augstumā”
- MK 2009. gada 25. augusta noteikumi Nr. 950 „Nelaimes gadījumu darbā izmeklēšanas un uzskaites kārtība”
- MK 2012. gada 18. decembra noteikumi Nr. 935 „Noteikumi par koku ciršanu mežā”
- MK 2012. gada 18. decembra noteikumi Nr. 936 „Dabas aizsardzības noteikumi meža apsaimniekošanā”
- Ugunsdrošības, ugunsdzēsības un glābšanas darbu likums (spēkā no 2025. gada 13. novembra)
- Aizsargjoslu likums
- Valsts darba inspekcija (vdi.gov.lv), Valsts meža dienests (vmd.gov.lv), VTUA (vtua.gov.lv)

## Kontroljautājumi
1. Kāds ir meža ugunsnedrošais periods Latvijā, un ko šajā laikā nedrīkst darīt mežā?
2. Kāda ir minimālā drošā distance līdz citiem cilvēkiem, gāžot koku ar motorzāģi, un kāda — līdz strādājošam harvesteram?
3. Kas jādara ar biksēm ar zāģa aizsardzību pēc iegriezuma?
4. Kur un cik ātri jāziņo par gandrīz negadījumu?
5. Kādos gadījumos darba devējam nekavējoties jāpaziņo policijai un Valsts darba inspekcijai?
6. Kādu informāciju un kādā secībā tu sniegsi, zvanot 112 no meža?
`,
};
