import type { BuiltinMaterial } from "../types";

export const emergencyGuide: BuiltinMaterial = {
  key: "emergency-guide",
  version: 1,
  category: "emergency",
  country: null,
  title: "Rīcība ārkārtas situācijās",
  subtitle: "Ko darīt pirmajās minūtēs: drošība, 112, pirmā palīdzība, ziņošana un fiksēšana",
  summary:
    "Soli pa solim: kā rīkoties traumas, ugunsgrēka, noplūdes, mašīnas apgāšanās, elektrolīnijas skāriena vai pazuduša darbinieka gadījumā. Ietverts zvana 112 plāns, atrašanās vietas nodošana un ārkārtas numuri Latvijā, Zviedrijā un Islandē.",
  audience: ["employee", "foreman", "mechanic", "manager"],
  requiresAck: true,
  readingMinutes: 15,
  body: `## Kāpēc tas jāzina katram
Mežā ātrā palīdzība var ierasties tikai pēc 30–60 minūtēm vai vēlāk. Pirmās minūtes pēc negadījuma bieži izšķir, vai cilvēks izdzīvos. Tāpēc katram darbiniekam jāzina šī kārtība no galvas. Šis materiāls neaizstāj praktisku pirmās palīdzības apmācību — uzņēmums to organizē, un katrā komandā jābūt vismaz vienam apmācītam cilvēkam.

## Rīcības secība
1. **Drošība** — aptur tehniku, novērtē briesmas (krītoši koki, uguns, elektrība, ripojoši baļķi). Nekļūsti par otro cietušo.
2. **112** — zvani uzreiz vai liec kādam zvanīt, kamēr tu sniedz palīdzību.
3. **Pirmā palīdzība** — vispirms apturi stipru asiņošanu, nodrošini elpošanu, saglabā siltumu.
4. **Ziņo meistaram** — tūlīt pēc 112. Meistars organizē sagaidīšanu un informē vadību.
5. **Fiksē** — laiks, vieta, notikušais, fotoattēli, liecinieki; reģistrē lietotnē „Incidenti”.

!! Vienmēr vispirms 112: Nezvani vispirms meistaram, ja cilvēks ir smagi cietis. Meistars nevar atsūtīt ātro palīdzību — to var tikai 112.

## Zvans 112
1. „Ārkārtas situācija mežizstrādē. Mani sauc [vārds], uzņēmums [Land Guru / Skog Guru / MJ Forest Guru].”
2. Kas notika: „motorzāģa iegriezums kājā”, „koks uzkrita cilvēkam”, „apgāzās mašīna”, „deg tehnika”.
3. Cik cietušo, vai elpo, vai ir pie samaņas, vai stipri asiņo.
4. Kur: koordinātas, tuvākais ceļš, apdzīvotā vieta, pagasts vai pašvaldība.
5. Kur sagaidīsiet glābējus un vai ceļš ir izbraucams ar parastu auto.
6. Tavs tālruņa numurs. Neatvieno zvanu, kamēr dispečers to neatļauj, un seko viņa norādījumiem.

Ja nerunā vietējā valodā, runā angliski.

## Kā nodot atrašanās vietu
- **Koordinātas:** telefona kartes lietotnē ilgi nospied savu atrašanās vietu. Parādīsies divi skaitļi, piemēram, 56.95012, 24.10523. Nolasi tos lēnām, pa cipariem. Islandē garums ir ar mīnusa zīmi — to obligāti nosauc.
- **Meža ceļš un orientieri:** ceļa nosaukums vai numurs, krustojums, krautuve, tilts, liela zīme.
- **Sagaidīšanas vieta:** norunā vietu pie koplietošanas ceļa. Tur jāstāv cilvēkam signālvestē, kas aizved glābējus līdz cietušajam. Tumsā — ar lukturi vai ieslēgtām auto avārijas gaismām.
- Daudzos telefonos, zvanot 112, atrašanās vieta tiek nosūtīta automātiski, taču uz to nepaļaujies — vienmēr nosauc koordinātas.
- Islandē instalē lietotni „112 Iceland”, kas nosūta atrašanās vietu ārkārtas centram.

? Sagatavojies iepriekš: Uzņēmuma noteikums — maiņas sākumā katra komanda zina sava objekta koordinātas un sagaidīšanas vietu. Meistars tās norāda instruktāžā.

## Stipra asiņošana (motorzāģa iegriezums)
Stipra asiņošana var nogalināt dažu minūšu laikā.
1. Liec kādam zvanīt 112. Uzvelc cimdus, ja tie ir tuvumā.
2. Ar spēcīgu tiešu spiedienu spied uz brūces — ar pārsēju, drānu vai plaukstu. Dziļā brūcē iebāz (tamponē) pārsēju un spied vēl stiprāk.
3. Uzliec spiedošo pārsēju un turpini spiest. Ja asinis izsūcas cauri — neņem nost, liec virsū vēl.
4. Ja asiņošana no rokas vai kājas neapstājas ar spiedienu vai brūce ir tik liela, ka spiediens nav iespējams — uzliec **turniketu**.
5. Novieto cietušo guļus, sedz ar termosegu vai drēbēm, runā ar viņu.

Turniketa pamatnoteikumi:
+ Uzliec 5–7 cm virs brūces (tuvāk ķermenim), nevis uz locītavas. Ja neredzi brūci skaidri — uzliec pēc iespējas augstāk uz ekstremitātes.
+ Savelc, līdz asiņošana apstājas.
+ Pieraksti uzlikšanas laiku (uz turniketa vai cietušā pieres) un pasaki to mediķiem.
x Uzlikto turniketu neatlaid un nenoņem — to dara mediķi.

## Saspiedums un koka uzkrišana
1. Pārliecinies, ka nav citu krītošu koku vai ripojošu baļķu.
2. Zvani 112 un pasaki, ka cilvēks ir saspiests un cik ilgi.
3. Ja droši iespējams, atbrīvo cietušo pēc iespējas ātrāk — ar tehniku, sviru vai vairākiem cilvēkiem — un seko dispečera norādījumiem.
4. Ja ir aizdomas par mugurkaula traumu, cietušo nekustini, ja nav tiešu briesmu (uguns, krītoši koki).
5. Aptur asiņošanu, saglabā siltumu, uzraugi elpošanu.

## Bezsamaņa un elpošanas apstāšanās
1. Uzrunā un viegli sakrati. Ja nereaģē — zvani 112 (ieslēdz skaļruni).
2. Atver elpceļus (galvu atliec, zodu pacel) un 10 sekundes pārbaudi elpošanu.
3. Ja elpo — novieto stabilā sānu pozā un uzraugi.
4. Ja neelpo normāli — sāc atdzīvināšanu: 30 krūškurvja kompresijas (5–6 cm dziļi, 100–120 reizes minūtē) un 2 elpināšanas. Turpini, līdz ierodas mediķi.

## Hipotermija un karstums
- **Hipotermija** (drebuļi, apjukums, lēna runa): pārvieto sausā, no vēja aizsargātā vietā vai auto; nomaini slapjās drēbes; sedz ar termosegu; dod siltu, saldu dzērienu, ja cietušais pie samaņas. Smagos gadījumos zvani 112 un pārvieto cietušo saudzīgi.
- **Karstuma dūriens** (karsta āda, apjukums, vemšana): zvani 112, pārvieto ēnā, dzesē ar ūdeni un vēdināšanu, dod dzert mazām malkām, ja pie samaņas.

## Acu trauma
- Svešķermeni, kas iedūries acī, neizņem. Pārsien abas acis vaļīgi un vāc cietušo uz slimnīcu vai zvani 112.
- Degvielu, eļļu vai ķimikālijas no acs skalo ar tīru ūdeni vismaz 15 minūtes, tad dodies pie ārsta.
- Skaidas un putekļus neberzē — skalo ar ūdeni.

## Ugunsgrēks tehnikā vai mežā
1. Izslēdz motoru un, ja droši iespējams, akumulatora slēdzi.
2. Paņem ugunsdzēšamo aparātu un pamet kabīni.
3. Zvani 112, brīdini citus.
4. Dzēs tikai tad, ja tas ir droši un uguns ir maza. Motora nodalījumu atver uzmanīgi — skābekļa pieplūde var pastiprināt liesmas.
5. Ja uguns izplatās mežā — atkāpies pret vēju, prom no uguns, uz ceļu vai nodedzinātu laukumu. Nekad neskrien augšup pa nogāzi uguns priekšā.
6. Sagaidi glābējus un parādi ceļu. Pēc dzēšanas vieta jāuzrauga — uguns var atsākties.

## Degvielas vai eļļas noplūde
1. Aptur noplūdi: izslēdz motoru, aizver vārstu, aizspied šļūteni, pagriez kannu.
2. Neļauj noplūdei sasniegt ūdeni vai grāvi — izveido zemes valnīti, izmanto absorbentu.
3. Savāc piesārņoto augsni un absorbentu maisos; nodod meistaram utilizācijai.
4. Nofotografē un reģistrē lietotnē kā „Vides incidents”.
5. Ja noplūde ir liela vai sasniegusi ūdeni — nekavējoties ziņo meistaram; meistars lemj par iestāžu informēšanu, bet, ja pastāv tūlītējs apdraudējums, zvani 112.

## Mašīnas apgāšanās
- Ja mašīna sāk gāzties — paliec kabīnē, piesprādzējies, turies pie stūres vai sēdekļa. Nemēģini izlekt.
- Pēc apgāšanās izslēdz motoru, pārbaudi, vai esi ievainots, un izkāp pa drošāko izeju (avārijas lūku vai logu).
- Ja operators ir iesprostots — zvani 112; mašīnu nevelc un necel bez meistara un glābēju lēmuma, jo tā var pārvietoties.
- Uzmanies no noplūdušas degvielas un eļļas — uguns risks.

## Saskare ar elektrolīniju
!! Paliec kabīnē: Ja mašīna vai krāns pieskāries elektrolīnijai, paliec kabīnē un nepieskaries metāla daļām. Brīdini citus neskarties mašīnai un netuvoties vismaz 10 metrus. Zvani 112 un palūdz atslēgt līniju.

Ja mašīna deg un jāizkāpj: lec ar kopā saliktām kājām tālāk no mašīnas, nepieskaroties vienlaikus mašīnai un zemei, un attālinies maziem lēcieniem ar kopā saliktām kājām. Cietušajam, kas guļ pie vada, netuvojies, kamēr līnija nav atslēgta.

## Pazudis darbinieks
1. Ja norunātais saziņas laiks ir pagājis — zvani darbiniekam vairākas reizes.
2. Ja neatbild 15 minūšu laikā — meistars dodas vai sūta divus cilvēkus uz pēdējo zināmo darba vietu.
3. Meklē pa pāriem, nekad vienatnē; paņem aptieciņu un telefonu.
4. Ja darbinieks netiek atrasts 30 minūšu laikā vai laikapstākļi ir bīstami — zvani 112.
5. Visi pārējie paliek sakaros un gatavi palīdzēt.

## Pēc negadījuma
Uzņēmuma noteikumi:
+ Reģistrē notikumu lietotnes sadaļā „Incidenti” tās pašas maiņas laikā: kas notika, laiks, vieta ar GPS, veiktā tūlītējā rīcība.
+ Pievieno fotoattēlus: vispārīgu skatu, tehniku, instrumentus, IAL, laikapstākļus.
+ Pieraksti liecinieku vārdus un tālruņus.
+ Ziņo arī par gandrīz negadījumiem — tie palīdz novērst nākamo negadījumu.
x Nepārvieto tehniku, instrumentus un kokus, ja tas nav nepieciešams glābšanai vai drošībai. Ja jāpārvieto — vispirms nofotografē.
x Nemaini un neizmet bojātos IAL (piemēram, iegrieztas bikses) — tie ir pierādījumi.

Smagos negadījumos darba devējam jāinformē valsts iestādes (skat. tabulu). To dara meistars vai vadība, bet tavs precīzais apraksts ir izšķirošs.

## Ārkārtas numuri un iestādes pa valstīm
| Kas | Latvija | Zviedrija | Islande |
| Ārkārtas numurs | 112 | 112 | 112 |
| Medicīniska palīdzība / konsultācijas | 113 (NMPD) | 1177 (konsultācijas) | 1700 (konsultācijas) |
| Policija, nesteidzami | 110 | 114 14 | 444 1000 (galvaspilsētas reģions) |
| Saindēšanās informācija | 67042473 | 112 akūti; 010-456 67 00 | 543 2222 |
| Darba drošības iestāde | Valsts darba inspekcija | Arbetsmiljöverket | Vinnueftirlitið |
| Smags negadījums — ziņo | Nekavējoties policijai un VDI | Bez kavēšanās Arbetsmiljöverket | Ne vēlāk kā 24 h Vinnueftirlitið un policijai |
| Meža iestāde | Valsts meža dienests | Skogsstyrelsen | Land og skógur |

## Aptieciņas minimālais saturs
Uzņēmuma noteikums: katrā mašīnā un transportlīdzeklī ir aptieciņa, kurā ir vismaz:
- turnikets (komerciāls, ar skrūvējamu stieni) — 1 gab.;
- individuālās pārsienamās paketes vai spiedošie pārsēji — vismaz 3 gab.;
- hemostatiskais vai tamponēšanas pārsējs — 1 gab.;
- sterilas salvetes, elastīgā saite, plāksteri, lipīgā lente;
- šķēres, kas griež apģērbu;
- vienreizlietojamie cimdi — vairāki pāri;
- termosega (glābšanas sega) — vismaz 2 gab.;
- acu skalošanas šķīdums vai tīrs ūdens;
- elpināšanas maska ar vārstu;
- pildspalva un marķieris (laika pierakstīšanai).

Katrs motorzāģa darbinieks nēsā līdzi vismaz vienu individuālo pārsienamo paketi. Aptieciņu pārbauda katru mēnesi; izlietoto papildina uzreiz un ziņo meistaram.

## Kontroljautājumi
1. Kāda ir pareizā rīcības secība ārkārtas situācijā?
2. Kas jāpasaka, zvanot 112, un kā nodot savu atrašanās vietu mežā?
3. Kā apturēt stipru asiņošanu no motorzāģa iegriezuma, un kad jālieto turnikets?
4. Kas jāpieraksta pēc turniketa uzlikšanas, un vai to drīkst atlaist?
5. Kā rīkoties, ja mašīnas krāns pieskāries elektrolīnijai?
6. Kas jāizdara pēc negadījuma tās pašas maiņas laikā?
`,
};
