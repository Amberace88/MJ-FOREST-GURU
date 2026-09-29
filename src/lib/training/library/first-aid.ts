import type { BuiltinMaterial } from "../types";

export const firstAidForest: BuiltinMaterial = {
  key: "first-aid-forest",
  version: 1,
  category: "emergency",
  country: null,
  title: "Pirmā palīdzība mežā",
  subtitle: "Cietušā novērtēšana, šoks, lūzumi, apdegumi, ērces, odzes kodumi, alerģija un evakuācija no meža",
  summary:
    "Pirmās palīdzības pamati mežizstrādes darbiniekiem: kā novērtēt cietušo pēc DR ABC, kā rīkoties šoka, lūzumu, apdegumu, ērču un odzes kodumu, alerģiskas reakcijas un aukstuma traumu gadījumā, kā pārbaudīt aptieciņu un organizēt evakuāciju. Materiāls papildina „Rīcība ārkārtas situācijās” un neaizstāj praktisku pirmās palīdzības kursu.",
  audience: ["employee", "foreman", "mechanic", "manager"],
  requiresAck: true,
  readingMinutes: 13,
  body: `## Svarīgi pirms lasīšanas
Šis materiāls sniedz pirmās palīdzības zināšanas nespeciālista līmenī. Rīcības secība ārkārtas situācijā, zvans 112, stipras asiņošanas apturēšana ar turniketu, atdzīvināšanas pamati un aptieciņas minimālais saturs ir aprakstīti materiālā „Rīcība ārkārtas situācijās” — izlasi to vispirms.

!! Uzņēmuma noteikums: Katrs darbinieks, kas strādā mežā, iziet praktisku pirmās palīdzības kursu pie sertificēta pasniedzēja un to atkārto uzņēmuma noteiktajā termiņā. Motorzāģa darbiniekiem un meistariem kurss ir obligāts pirms patstāvīga darba uzsākšanas. Teksts neaizstāj praktisku treniņu — turniketu un atdzīvināšanu var iemācīties tikai ar rokām.

Vienmēr ievēro 112 dispečera norādījumus. Ja šeit rakstītais atšķiras no dispečera teiktā — klausi dispečeru.

## Cietušā novērtēšana: DR ABC
Kad pienāc pie cietušā, rīkojies šādā secībā. Tā palīdz nepazaudēt galveno stresa brīdī.

| Burts | Nozīme | Ko dari |
| D — Danger | Briesmas | Aptur tehniku un zāģi. Pārbaudi, vai nekrīt koki, neripo baļķi, nav uguns vai elektrības. Neesi otrais cietušais |
| R — Response | Reakcija | Uzrunā skaļi, viegli sakrati plecus. Ja nereaģē — sauc palīgā un zvani 112 |
| A — Airway | Elpceļi | Atliec galvu, pacel zodu. Izņem no mutes redzamus svešķermeņus |
| B — Breathing | Elpošana | Skaties, klausies un jūti 10 sekundes. Neelpo normāli — sāc atdzīvināšanu |
| C — Circulation | Asinsrite | Meklē un aptur stipru asiņošanu. Pārbaudi visu ķermeni, arī zem apģērba un aiz muguras |

? Masīva asiņošana pirmajā vietā: Ja redzi, ka no rokas vai kājas šļācas vai strauji plūst asinis, aptur asiņošanu uzreiz, pat pirms elpceļu pārbaudes. Motorzāģa trauma var nogalināt ātrāk nekā elpošanas problēma.

Kad dzīvībai bīstamais novērsts, apskati cietušo no galvas līdz kājām: sāpes, deformācijas, brūces, jutīgums. Jautā, kas notika, vai ir hroniskas slimības, alerģijas un kādas zāles lieto — un pastāsti to mediķiem.

## Stabilā sānu poza un AED
Ja cietušais ir bezsamaņā, bet elpo normāli un nav aizdomu par mugurkaula traumu, novieto viņu **stabilā sānu pozā**: tā mēle un vēmekļi neaizsprosto elpceļus. Pārbaudi elpošanu ik pēc minūtes.

Ja cietušais neelpo normāli, sāc krūškurvja kompresijas (30 kompresijas, 2 elpināšanas). Ja tuvumā ir **automātiskais ārējais defibrilators (AED)**, lūdz kādu to atnest:
1. Ieslēdz AED un klausies balss norādes.
2. Atsedz krūtis, noslauki mitrumu, uzliec elektrodus, kā parādīts attēlā uz tiem.
3. Analīzes un šoka laikā neviens nepieskaras cietušajam.
4. Pēc šoka vai ja šoks nav ieteikts — uzreiz turpini kompresijas.

Ja palīdzētāji ir vairāki — mainieties ik pēc 2 minūtēm, jo kompresiju kvalitāte ātri krītas.

## Šoks
Pēc liela asins zuduma, smagiem lūzumiem vai apdegumiem cietušajam var attīstīties šoks — asinsrite nespēj apgādāt orgānus.

Pazīmes: bāla, auksta, mitra āda; ātrs, vājš pulss; ātra elpošana; slāpes; nemiers, apjukums, vēlāk miegainība.
+ Aptur asiņošanu — tas ir svarīgākais.
+ Noguldi cietušo guļus, sedz ar termosegu no apakšas un virsas — mežā zeme ātri atdzesē.
+ Runā mierīgi, neatstāj vienu.
x Nedod ēst un dzert — var būt nepieciešama operācija.

## Lūzumi un izmežģījumi
Pazīmes: stipras sāpes, pietūkums, deformācija, nespēja kustināt, kaula daļas brūcē (vaļējs lūzums).
1. Neiztaisno un nekustini traumēto vietu. Atbalsti to tādā stāvoklī, kādā atradi.
2. Vaļēju lūzumu pārsedz ar sterilu pārsēju; ja stipri asiņo — spied ap kaulu, nevis uz to.
3. Imobilizē, ja palīdzība aizkavējas vai cietušais jānes: fiksē locītavu virs un zem lūzuma (šina, dēlītis, sarullēta sega, pie veselas kājas vai ķermeņa).
4. Pēc fiksēšanas pārbaudi, vai pirksti ir silti, rozā un jūtīgi. Ja nav — atbrīvo saiti.
5. Roku var fiksēt pie ķermeņa ar trīsstūra lakatu vai piespraustu jakas apakšmalu.

! Mugurkauls un galva: Ja cietušais krita no augstuma, viņam uzkrita koks vai viņš sūdzas par sāpēm kaklā vai mugurā, tirpšanu vai nejutīgumu — nekustini viņu, ja nav tiešu briesmu. Turi galvu neitrālā stāvoklī ar abām rokām līdz mediķu ierašanās brīdim.

## Apdegumi
Mežā biežākie apdegumi ir no izpūtēja, karstas hidrauliskās eļļas, dzesēšanas šķidruma un ugunsgrēka.
1. Pārtrauc apdegšanu: nodzēs liesmas, novāc cietušo no karstuma avota.
2. Dzesē ar vēsu (ne ledus aukstu) tekošu ūdeni vismaz 20 minūtes.
3. Uzmanīgi noņem gredzenus, pulksteni, apģērbu ap apdegumu, pirms sāk tūkt. Piekaltušu apģērbu nerauj.
4. Pārsedz ar tīru, nepūkainu pārsēju vai pārtikas plēvi.
5. Sedz pārējo ķermeni, lai nesasaltu.

Zvani 112 vai vāc pie ārsta, ja apdegums ir lielāks par cietušā plaukstu, ir uz sejas, rokām, kājām, dzimumorgāniem vai locītavām, ir dziļš (balts, ādains, nesāpīgs) vai radies no ķimikālijām vai elektrības.
x Neliec eļļu, krēmus, zobu pastu vai ledu. Nepārdur pūšļus.

Karsta hidrauliskā eļļa var būt zem spiediena. Ja eļļa iekļuvusi zem ādas — tā ir ķirurģiska neatliekama situācija pat tad, ja brūce izskatās maza. Vāc uz slimnīcu nekavējoties.

## Ērces
Latvijā ērces pārnēsā **ērču encefalītu** un **Laima slimību** (boreliozi); abas slimības sastopamas arī Zviedrijā. Ērces ir aktīvas no agra pavasara līdz vēlam rudenim.
- Pret ērču encefalītu ir vakcīna. Slimību profilakses un kontroles centrs (SPKC) vakcināciju uzskata par efektīvāko aizsardzību. Uzņēmums stingri iesaka vakcinēties visiem, kas strādā mežā — jautā meistaram par vakcinācijas iespējām.
- Pret Laima slimību vakcīnas nav, tāpēc svarīga ir ērces ātra noņemšana.

Kā noņemt ērci:
1. Satver ērci ar pinceti vai ērču noņēmēju pēc iespējas tuvāk ādai.
2. Velc vienmērīgi un taisni ārā, negriežot un nesaspiežot ķermeni.
3. Dezinficē vietu un nomazgā rokas. Pieraksti datumu.
x Neliec uz ērces eļļu, spirtu vai uguni — ērce var izspiest vairāk infekcijas.

Dodies pie ārsta, ja koduma vietā pēc dažām dienām vai nedēļām parādās paplašinošs sārtums (bieži ar gaišāku centru) vai ja 1–4 nedēļu laikā parādās drudzis, galvassāpes, nespēks. Pasaki ārstam par ērces kodumu.

+ Katru vakaru pārbaudi ķermeni, īpaši paduses, cirkšņus, ceļu locītavas, matu līniju.

## Odzes kodums
Latvijā un Zviedrijā sastopama **parastā odze** (Vipera berus). Tā kož, ja uzkāpj vai piespiež. Islandē čūsku nav. Kodums reti ir nāvējošs pieaugušajam, bet var radīt stipru tūsku, sliktu dūšu un smagas reakcijas.
1. Nomierini cietušo un noguldi. Kustības paātrina indes izplatīšanos.
2. Imobilizē sakosto ekstremitāti kā lūzuma gadījumā.
3. Noņem gredzenus, pulksteni, apavus no sakostās rokas vai kājas, pirms sākas tūska.
4. Zvani 112 vai nogādā cietušo pie ārsta. Atzīmē koduma laiku un tūskas robežu ar pildspalvu.
x Nelieto turniketu, negriez, neizsūc indi, neliec ledu, nedod alkoholu.

## Kukaiņu dzēlieni un alerģiska reakcija
Lapsenes un bites mežā bieži dzeļ, kad aizskar ligzdu celmā vai zemē. Lielākajai daļai tas ir tikai sāpīgi. Bīstama ir **anafilakse** — smaga alerģiska reakcija.

Pazīmes: sejas, lūpu, mēles tūska; apgrūtināta elpošana, sēkšana; izsitumi pa visu ķermeni; reibonis, ģībonis.
1. Zvani 112 uzreiz un pasaki „aizdomas par anafilaksi”.
2. Ja cietušajam ir adrenalīna autoinjektors — palīdzi to ievadīt augšstilba ārējā pusē (var caur biksēm).
3. Ja elpošana apgrūtināta — ļauj sēdēt; ja reibst — noguldi, kājas paceltas.
4. Ja 5–15 minūšu laikā nav uzlabojuma un ir otrs autoinjektors — lieto to.

+ Ja tev ir zināma alerģija pret dzēlieniem, pastāsti meistaram un nēsā autoinjektoru līdzi. Kolēģiem jāzina, kur tas atrodas.

## Aukstuma traumas
Hipotermijas pirmā palīdzība ir aprakstīta materiālā „Rīcība ārkārtas situācijās”. Papildus:
- **Apsaldējums** (balta, cieta, nejutīga āda uz pirkstiem, ausīm, deguna): pārvieto siltumā, sildi lēni ar ķermeņa siltumu vai remdenu ūdeni. Neberzē ar sniegu vai rokām. Ja pēc sasildīšanas vieta var atkal sasalt, nesildi to mežā — vispirms nogādā cietušo siltumā.
- Aukstumā pat nelielai traumai pievienojas atdzišana — vienmēr sedz cietušo ar termosegu arī no apakšas.

## Aptieciņas pārbaude
Uzņēmuma noteikums: aptieciņu pārbauda katru mēnesi un pēc katras lietošanas. Atbildīgais ir mašīnas operators vai transportlīdzekļa vadītājs, meistars kontrolē.

| Ko pārbaudīt | Kā |
| Turnikets | Vesels, iepakojums neatvērts, nav izbalējis vai saplīsis |
| Pārsēji | Iepakojumi neskarti un sausi, derīguma termiņš nav beidzies |
| Termosegas | Vismaz 2, neatvērtas |
| Cimdi, šķēres, elpināšanas maska | Ir vietā, nav bojāti |
| Acu skalošanas šķīdums | Derīgs, nav sasalis |
| Ērču noņēmējs, pincete | Ir vietā (uzņēmuma papildinājums) |

Izlietoto papildina uzreiz un ziņo meistaram. Aptieciņai jābūt vienmēr redzamā, zināmā vietā — nevis zem instrumentiem.

## Evakuācija no meža
Ātrās palīdzības auto parasti nevar iebraukt cirsmā. Meistars un komanda plāno evakuāciju iepriekš.
+ Maiņas sākumā zini objekta koordinātas, tuvāko izbraucamo ceļu un **tikšanās punktu** ar ātro palīdzību.
+ Pie tikšanās punkta nosūti cilvēku signālvestē ar telefonu — viņš aizved mediķus līdz cietušajam.
+ Ja cietušais jānes līdz ceļam — nes vismaz četri cilvēki uz nestuvēm, segas vai improvizētām nestuvēm. Dispečeram paziņo, ka cietušo nesīsiet uz konkrētu vietu.
+ Cietušo ar komandas transportu vai forvarderu ved tikai tad, ja to ieteicis dispečers un tas ir ātrāk un droši.
+ Paņem līdzi cietušā dokumentus un telefonu, pieraksti notikuma un turniketa laiku.
x Nevāc smagi cietušo pašu spēkiem, ja dispečers nav to ieteicis — sagaidi palīdzību.

## Kontroljautājumi
1. Ko nozīmē DR ABC, un kurā gadījumā asiņošanu aptur pirms elpceļu pārbaudes?
2. Kādas ir šoka pazīmes, un kā palīdzēt cietušajam šokā?
3. Kā pareizi dzesēt apdegumu, un ko nedrīkst uzlikt uz apdeguma?
4. Kā noņemt ērci, un kādu simptomu dēļ pēc tam jādodas pie ārsta?
5. Ko darīt un ko nedarīt, ja kolēģi sakodusi odze?
`,
};
