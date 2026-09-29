import type { BuiltinMaterial } from "../types";

export const chainsawSafety: BuiltinMaterial = {
  key: "chainsaw-safety",
  version: 1,
  category: "machinery",
  country: null,
  title: "Motorzāģa droša lietošana",
  subtitle: "IAL, ikdienas pārbaude, atsitiena novēršana, koku gāšanas tehnika, vējgāzes un darbs vienatnē",
  summary:
    "Praktiska rokasgrāmata motorzāģa darbiniekiem un meistariem: kā pārbaudīt zāģi, droši iedarbināt un uzpildīt, izvairīties no atsitiena un gāzt koku ar virziena iegriezumu un šarnīru. Ietverta rīcība ar iekārušamies kokiem un saspriegtu koksni, vibrācijas un trokšņa slodze un ikdienas apkope.",
  audience: ["employee", "foreman"],
  requiresAck: true,
  readingMinutes: 13,
  body: `## Kam paredzēts šis materiāls
Šis materiāls papildina „Tehnikas lietošanas un apkopes noteikumus” un valsts drošības materiālus. Tas apraksta, **kā** strādāt ar motorzāģi, lai darbs būtu drošs un ražīgs. Pamatnoteikums: ar motorzāģi strādā tikai darbinieks ar dokumentētu apmācību un meistara atļauju. Bīstamu, sašķiebtu, iekārušos un vēja gāztu koku apstrādi veic tikai tie, kas tam īpaši apmācīti.

Visi šeit minētie noteikumi ir **uzņēmuma noteikumi**, ja nav norādīts citādi. Vienmēr ievēro arī zāģa ražotāja lietošanas instrukciju.

## IAL — kas tev jāvalkā
Pilns IAL komplekts un standartu tabula ir valsts drošības materiālā. Šeit — ko pārbaudīt pašam.
- **Bikses vai kājsargi ar zāģa aizsardzību** (EN ISO 11393-2). Etiķetē redzama aizsardzības klase (1. klase — ķēdes ātrums līdz 20 m/s, 2. klase — 24 m/s, 3. klase — 28 m/s) un dizains: A — aizsardzība priekšpusē, C — apkārt visai kājai. Mežizstrādē parasti pietiek ar A dizainu un 1. klasi, bet zāģa ķēdes ātrumam jāatbilst klasei.
- **Zābaki ar zāģa aizsardzību** (EN ISO 17249) ar neslīdošu zoli un potītes atbalstu.
- **Ķivere ar sejsargu un austiņām.** Sejsargam jābūt neielauztam, austiņu blīvēm — veselām.
- **Cimdi** — ieteicami ar zāģa aizsardzību kreisajai rokai (EN ISO 11393-4).
- **Signālkrāsas augšdaļa**, lai tevi redz operators un kolēģi.

+ Pirms darba pārbaudi, vai biksēs nav iegriezumu, plīsumu vai izvilktu šķiedru. Iegrieztas bikses nekavējoties nomaini.
+ Bikses mazgā pēc ražotāja norādījumiem — nepareiza mazgāšana samazina aizsardzību.
x Aizliegts ielāpīt iegrieztas zāģa bikses un turpināt tās lietot.

## Zāģa ikdienas pārbaude
Pārbaudi zāģi katru dienu pirms darba un pēc katra kritiena vai trieciena.

| Detaļa | Kā pārbaudīt | Ja nestrādā |
| Ķēdes bremze | Iedarbini zāģi, dod gāzi un ar plaukstas virspusi nospied priekšējo roku aizsargu — ķēdei jāapstājas uzreiz | Zāģi nelieto |
| Gāzes slēdža bloķētājs | Gāzes slēdzi nevar nospiest, ja nav nospiests bloķētājs; atlaižot abi atgriežas | Zāģi nelieto |
| Ķēdes uztvērējs | Novietots zem sliedes, nav nolūzis vai saliekts | Nomaini pirms darba |
| Labās rokas aizsargs | Vesels, stingri piestiprināts | Nomaini pirms darba |
| Izslēgšanas slēdzis | Motors apstājas uzreiz | Zāģi nelieto |
| Izpūtējs un dzirksteļu tīkliņš | Nav plaisu, stiprinājums ciešs, tīkliņš tīrs | Zāģi nelieto — apdegumu un ugunsgrēka risks |
| Ķēdes spriegojums | Ķēdi ar cimdotu roku var pavilkt pa sliedi, bet tā neatkaras no sliedes apakšas | Noregulē, zāģim esot izslēgtam |
| Tukšgaita | Tukšgaitā ķēde nekustas | Noregulē karburatoru vai nodod mehāniķim |
| Ķēdes eļļošana | Turot sliedes galu virs gaiša celma, redzama eļļas josla | Iztīri eļļas atveres |
| Vibrācijas slāpētāji | Nav saplaisājuši, rokturi neļodzās | Nomaini |

!! Stingrs noteikums: Zāģi ar nestrādājošu ķēdes bremzi, gāzes slēdža bloķētāju, izslēgšanas slēdzi vai bojātu izpūtēju nelieto. Ziņo meistaram un reģistrē lietotnē kā „Problēma ar tehniku”.

## Degviela un uzpilde
- Divtaktu motoram izmanto degvielas maisījumu tieši tādā attiecībā, kādu norādījis ražotājs (bieži 1:50 jeb 2%). Nepareiza attiecība sabojā motoru.
- Uzņēmums iesaka **alkilāta benzīnu** (gatavu maisījumu). Tas satur mazāk kaitīgu vielu, ko tu ieelpo, un ilgāk saglabājas.
- Ķēdes eļļai lieto bioloģiski noārdāmu ķēdes eļļu, ja pasūtītājs vai ražotājs nenosaka citādi.

Uzpildes kārtība:
1. Apturi motoru un ļauj tam dažas minūtes atdzist.
2. Pārvietojies vismaz 3 m no vietas, kur iedarbināsi zāģi, un prom no ūdens un grāvjiem.
3. Lieto kombinēto kannu ar pārplūdes aizsardzības snīpi.
4. Aizver vāciņus un noslauki izlijušo.
5. Zāģi iedarbini vismaz 3 m no uzpildes vietas.
x Aizliegts uzpildīt ar strādājošu motoru, smēķēt vai uzpildīt pie karsta izpūtēja.

## Iedarbināšana
Ir divi droši veidi:
1. **Uz zemes:** novieto zāģi uz līdzenas vietas, ieslēdz ķēdes bremzi, ar kreiso roku turi priekšējo rokturi, labo kāju ieliec aizmugurējā rokturī un rauj startera auklu.
2. **Starp kājām:** aizmugurējo rokturi iespied starp ceļgaliem, ar kreiso roku turi priekšējo rokturi, ķēdes bremze ieslēgta.

+ Pirms iedarbināšanas pārliecinies, ka sliede nepieskaras zemei, zariem vai cilvēkiem.
x Aizliegts iedarbināt zāģi „no rokas” — metot to lejup.

## Atsitiens (kickback)
Atsitiens rodas, ja sliedes gala augšējā ceturtdaļa (atsitiena zona) pieskaras kokam vai zaram vai ja ķēde iespiežas griezumā. Zāģis zibenīgi uzsviežas augšup un atpakaļ pret operatoru. Ķēdes bremze var apturēt ķēdi, bet nepasargā no trieciena, ja zāģis tiek turēts nepareizi.

Kā izvairīties:
+ Vienmēr turi zāģi ar abām rokām, īkšķis apņem priekšējo rokturi.
+ Stāvi sāņus no griezuma līnijas, nevis tieši aiz sliedes.
+ Zāģē ar pilnu gāzi, ar asu un pareizi uzasinātu ķēdi (pareizs dziļuma ierobežotāja augstums).
+ Vēro sliedes galu. Pirms griezuma pārliecinies, ka priekšā nav zaru.
+ Iegremdēšanas griezumu sāc ar sliedes apakšējo daļu, tad pakāpeniski iegremdē.
x Nezāģē virs plecu augstuma.
x Nezāģē ar sliedes galu, ja tas nav nepieciešams tehnikā.

## Koku gāšana: sagatavošanās
Novērtē koku: sasvērums, vainaga smagums, vējš, puve, sausi zari, apkārtējie koki un elektrolīnijas. Izvēlies krišanas virzienu un **divus atkāpšanās ceļus** — slīpi atpakaļ, apmēram 45° leņķī no krišanas virziena. Notīri ap stumbru zarus un krūmus.

!! Bīstamā zona: Gāžot koku, nevienam citam cilvēkam nedrīkst atrasties tuvāk par 2 gāžamā koka garumiem. Pirms pēdējā griezuma paskaties apkārt un, ja nepieciešams, dod skaņas signālu.

## Gāšanas griezumi
1. **Virziena iegriezums** — koka pusē, uz kuru tas kritīs. Iegriezuma dziļums apmēram 1/4–1/3 no stumbra caurmēra, atvērums vismaz 45°. Iegriezuma apakšējais un augšējais griezums precīzi satiekas — bez „pakāpes” un bez pārgriezuma.
2. **Gāšanas griezums** — no pretējās puses, horizontāli, virziena iegriezuma apakšas līmenī vai nedaudz virs tā (līdz apmēram 3 cm), kā mācīts apmācībā.
3. **Šarnīrs** — starp abiem griezumiem atstāj nepārgrieztu koksnes joslu, parasti apmēram 1/10 no caurmēra biezu, vienādā biezumā visā garumā. Šarnīrs vada koku krišanas virzienā. Ja pārgriez šarnīru — koks krīt nekontrolēti.
4. Koku nogāz ar gāšanas ķīli vai sviru, nevis ar zāģi.
5. Kad koks sāk krist — ieslēdz ķēdes bremzi un atkāpies pa atkāpšanās ceļu vismaz 5 m, vērojot vainagu.

? Resni un sasvērti koki: Kokiem, kas stipri sasvērušies krišanas virzienā, izmanto speciālu tehniku (piemēram, ar iegremdēšanu un atbalsta sloksni), lai stumbrs neieplaisātu un „neatsistos”. Ja neesi to apguvis — izsauc meistaru.

## Iekārušies koki
Iekāries koks ir viena no bīstamākajām situācijām mežā.
+ Iezīmē bīstamo zonu un brīdini citus. Neatstāj iekārušos koku bez uzraudzības.
+ Novāc to ar sviru, pagriešanas stiprinājumu, vinču vai tehniku (harvesteru, forvarderu), ja tas ir tuvumā.
x Aizliegts strādāt zem iekārušā koka.
x Aizliegts nogāzt uz iekārušā koka citu koku.
x Aizliegts kāpt uz iekārušā koka vai zāģēt koku, uz kura tas balstās.

## Vējgāzes un saspriegta koksne
Vēja gāztos kokos koksne ir **saspriegta**: vienā pusē ir spiede (koksne spiežas kopā), otrā — stiepe (koksne velkas). Nepareizs griezums var izraisīt stumbra atsišanos vai zāģa iespiešanu.
1. Novērtē, kurā pusē ir spiede un kurā stiepe.
2. Vispirms iegriez spiedes pusē, tad pabeidz no stiepes puses.
3. Stāvi tā, lai atsprāgstošais stumbrs vai sakņu kamols tevi nevar trāpīt.
4. Pirms atdali stumbru no sakņu kamola, nostiprini kamolu vai pārliecinies, ka tas nevar apgāzties atpakaļ.

! Vējgāzes: Masveida vējgāžu apstrādi ar motorzāģi veic tikai apmācīti darbinieki pēc meistara instruktāžas. Kur vien iespējams, vējgāzes apstrādā ar harvesteru.

## Atzarošana un sagarumošana
+ Atzaro, stāvot tā, lai stumbrs atrodas starp tevi un zāģi, un balsti zāģi uz stumbra.
+ Nogāzē stāvi augšpusē no stumbra — tas var ripot.
+ Sagarumo atbilstoši sortimenta prasībām (skat. materiālu „Produkcijas uzskaite un sortimenti”).
x Nepārvietojies ar strādājošu zāģi. Starp kokiem ej ar ieslēgtu ķēdes bremzi; ilgāk par dažām sekundēm — apturi motoru.

## Darbs vienatnē
Uzņēmuma noteikums: koku gāšanu ar motorzāģi vienatnē neveic, ja vien meistars to nav īpaši atļāvis un noteicis sakaru kārtību (skat. valsts drošības materiālu). Ja strādājat divatā, turieties vismaz 2 koku garumu attālumā viens no otra, bet tik tuvu, lai varat viens otru redzēt vai dzirdēt.

## Vibrācija un troksnis
Likuma prasība (ES direktīvas 2002/44/EK un 2003/10/EK, pārņemtas visu trīs valstu tiesību aktos): roku un plaukstu vibrācijas dienas iedarbības darbības vērtība ir 2,5 m/s², robežvērtība — 5 m/s². Trokšņa apakšējā darbības vērtība ir 80 dB(A), augšējā — 85 dB(A), robežvērtība (ņemot vērā dzirdes aizsardzību) — 87 dB(A). Motorzāģa troksnis parasti pārsniedz 100 dB(A), tāpēc austiņas ir obligātas visu laiku, kamēr zāģis darbojas.

Uzņēmuma noteikumi:
+ Uzturi zāģi labā stāvoklī — neasa ķēde un nolietoti slāpētāji palielina vibrāciju.
+ Ieturi pārtraukumus, sildi rokas aukstā laikā, valkā sausus cimdus.
+ Ja pirksti kļūst balti, nejūtīgi vai durstoši — pastāsti meistaram. Tas var būt vibrācijas slimības sākums.

## Ikdienas un nedēļas apkope
| Kad | Ko darīt |
| Katru dienu | Notīri gaisa filtru, dzesēšanas ribas un zonu ap sliedi; uzasini ķēdi; pārbaudi drošības detaļas |
| Katru dienu | Apgriez sliedi otrādi, lai tā nodilst vienmērīgi; iztīri sliedes rievu un eļļas atveres |
| Katru nedēļu | Pārbaudi ķēdes zobratu, sveci, starteri, degvielas filtru; noņem atskarpes no sliedes malām |
| Pēc vajadzības | Nomaini ķēdi, ja zobi ir nodiluši līdz marķējumam vai ķēde ir bojāta |

+ Apkopi veic ar izslēgtu motoru, noņemtu sveces aizdedzes vadu (ja tiek strādāts pie ķēdes vai sajūga) un cimdos.
+ Nopietnākus remontus veic mehāniķis; tos reģistrē sadaļā „Apkope un remonti”.

## Kontroljautājumi
1. Kā pārbaudīt ķēdes bremzi, un ko darīt, ja tā nestrādā?
2. Kas izraisa atsitienu, un kādi ir trīs galvenie veidi, kā no tā izvairīties?
3. Kāda ir šarnīra nozīme koka gāšanā, un kas notiek, ja to pārgriež?
4. Kādas darbības ir aizliegtas, ja koks ir iekāries?
5. Kādā secībā jāveic griezumi saspriegtā vēja gāztā stumbrā, un kāpēc?
`,
};
