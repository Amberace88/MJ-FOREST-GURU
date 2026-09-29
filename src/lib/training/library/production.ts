import type { BuiltinMaterial } from "../types";

export const productionMeasurement: BuiltinMaterial = {
  key: "production-measurement",
  version: 1,
  category: "reporting",
  country: null,
  title: "Produkcijas uzskaite un sortimenti",
  subtitle: "Harvestera mērīšana, kalibrēšana, krautnes, forvardera uzskaite un ievade platformā",
  summary:
    "Kā harvesters mēra un saglabā produkciju, kā veikt kontrolmērījumus un kalibrēšanu, kā ievērot pircēja sortimentu prasības un pareizi sakraut un marķēt krautnes. Paskaidrots arī, kā produkciju ievadīt platformā un saskaņot ar meistaru, un kādas ir biežākās kļūdas.",
  audience: ["employee", "foreman", "mechanic"],
  requiresAck: true,
  readingMinutes: 11,
  body: `## Kāpēc precīza uzskaite ir svarīga
Pēc produkcijas apjoma pasūtītājs mums maksā, bet pircējs maksā pasūtītājam. Katrs nepareizi izmērīts vai sagarumots baļķis nozīmē zaudētu naudu — vai nu uzņēmumam, vai klientam. Kļūdaini dati platformā sabojā arī produktivitātes, degvielas patēriņa un izmaksu aprēķinus. Šajā materiālā visi noteikumi ir **uzņēmuma noteikumi**, ja nav norādīts citādi. Konkrētās sortimentu prasības vienmēr nosaka pircēja vai pasūtītāja specifikācija.

## Kā harvesters mēra
Harvestera galva mēra katru stumbru, kamēr to padod caur galvu:
- **garumu** — ar mērriteni (vai padeves veltņu impulsiem), kas rullē pa stumbru;
- **caurmēru** — ar sensoriem padeves veltņu vai atzarošanas nažu rokās.

Mērīšanas datorā ir ielādēta pircēja **sortimentu un cenu instrukcija**. Dators aprēķina, kā stumbru sagarumot, lai iegūtu vērtīgāko sortimentu kombināciju, un saglabā katra baļķa garumu, caurmērus, apjomu un sortimentu.

Dati tiek saglabāti starptautiskā meža mašīnu datu standartā **StanForD** (to uztur Zviedrijas meža pētniecības institūts Skogforsk). Jaunākajā versijā StanForD 2010 biežāk izmantotie faili ir:

| Fails | Saturs | Kas to izmanto |
| .pin, .oin, .spi | Produktu (sortimentu) instrukcija, objekta instrukcija, sugu grupas un kalibrēšanas parametri | Operators ielādē pirms darba |
| .hpr | Detalizēta harvestera produkcija — katrs stumbrs un baļķis | Pasūtītājs, uzskaite |
| .thp | Kopējā produkcija pa objektiem un sortimentiem (vienkāršs kopsavilkums) | Meistars, uzskaite |
| .hqc | Mērīšanas kvalitātes kontrole — kontrolmērījumi un kalibrēšana | Operators, meistars, pircējs |
| .fpr | Forvardera produkcija — kravas un nogādāšana | Meistars, uzskaite |
| .mom | Darbības uzraudzība — darba laiks, dīkstāves, degviela | Meistars, mehāniķis |

Vecākās mašīnās vēl var būt „klasiskā” StanForD faili (.pri, .prd, .stm, .ktr). Pēc satura tie atbilst jaunajiem failiem: .prd ir kopējā produkcija, .pri — detalizēta produkcija, .ktr un .stm — kontrolmērījumi.

+ Pirms darba sākšanas objektā pārbaudi, vai datorā ir ielādēta **pareizā objekta un pircēja instrukcija** — pareizs objekta numurs, sugas un sortimenti.
+ Datus pārsūti vai eksportē tā, kā norādījis meistars, un nedzēs tos no mašīnas, kamēr meistars nav apstiprinājis saņemšanu.
x Aizliegts pašrocīgi mainīt cenu matricas vai sortimentu prasības pircēja instrukcijā.

## Kontrolmērījumi un kalibrēšana
Mērīšanas precizitāte pasliktinās, ja nodilst mērritenis, netīrās sensori, mainās sezona (sasalusi koksne, miza) vai pēc galvas remonta. Tāpēc operators regulāri veic kontrolmērījumus.

1. Harvesters atzīmē stumbru kā kontrolstumbru un saglabā savus mērījumus.
2. Operators ar elektronisko dastmēru un mērlenti izmēra katra baļķa garumu un caurmērus norādītajās vietās.
3. Dati tiek salīdzināti mašīnas datorā, un tas parāda novirzes.
4. Ja novirzes pārsniedz pieļaujamās, operators kalibrē garuma vai caurmēra mērījumu pēc ražotāja instrukcijas.
5. Kalibrēšanu saglabā; tā tiek ierakstīta .hqc failā.

Uzņēmuma noteikumi:
+ Kontrolmērījumu veic katras maiņas sākumā un vismaz vienu kontrolstumbru katrai galvenajai sugai katrā maiņā, ja pircējs neprasa biežāk.
+ Papildu kontrolmērījumu veic pēc mērriteņa, sensoru, zāģa vai galvas remonta, pēc mašīnas pārvietošanas uz citu objektu un pēc krasas temperatūras maiņas (sals/atkusnis).
+ Elektroniskais dastmērs un mērlente tiek glabāti kabīnē, tīri un regulāri pārbaudīti.
x Aizliegts kalibrēt „uz aci” vai lai apzināti palielinātu vai samazinātu apjomu. Tā ir krāpšana.

? Mehāniķiem: Pēc jebkura remonta, kas skar harvestera galvu, mērriteni vai caurmēra sensorus, pasaki operatoram, ka jāveic kontrolmērījums, un ieraksti to remonta aprakstā.

## Sortimenti un garumi
Katram objektam pircējs nosaka sortimentus, garumus, caurmēru robežas un kvalitātes prasības. Tipiski sortimenti:
- **zāģbaļķi** (skujkoki) — noteikti garumi ar noteiktu soli un minimālo tievgaļa caurmēru;
- **finierkluči** (bērzs) — īpaši stingras kvalitātes prasības;
- **taras kluči, sīkbaļķi**;
- **papīrmalka** — skujkoku un lapu koku, parasti viens garums;
- **malka, enerģētiskā koksne, šķelda** — pēc līguma.

Galvenās lietas, kas jāievēro:
+ Katram baļķim ir **virsmērs** — neliels pieļaujamais garuma pārpalikums. Baļķis, kas ir īsāks par nominālo garumu, var tikt pazemināts zemākā sortimentā vai pat noraidīts.
+ Zāģējums ir taisns un perpendikulārs; bez plēsumiem un ieplaisājumiem.
+ Zari nozāģēti līdz stumbra virsmai.
+ Sortimentu nesajauc: katrā krautnē tikai viens sortiments un viena suga, ja pircējs nav noteicis citādi.

! Specifikācija ir galvenā: Ja pircēja prasības atšķiras no šī materiāla piemēriem — vienmēr ievēro pircēja specifikāciju. Ja neesi pārliecināts — jautā meistaram pirms darba, nevis pēc tam.

## Kvalitātes defekti
| Defekts | Kā atpazīt | Ko darīt |
| Puve (trupe) | Mīksta, krāsaina vai irdena koksne griezumā | Nogriez bojāto daļu; pārējo sortē pēc prasībām |
| Līkums | Stumbrs novirzās no taisnas līnijas | Sagarumo tā, lai līkums nonāk zemākā sortimentā |
| Zilējums | Zilgani pelēka koksne (sēne) | Ziņo meistaram — ietekmē sortimentu un izvešanas termiņu |
| Mehāniski bojājumi | Plēsumi, nobrāzumi no veltņiem, šķelti gali | Pārbaudi galvas veltņu spiedienu un zāģa ķēdi |
| Svešķermeņi | Nagla, stieple, akmeņi mizā | Atdali un marķē; ziņo meistaram |
| Stumbra plaisas | Plaisas galos no nepareizas gāšanas vai sala | Nogriez līdz veselai koksnei |

## Krautnes pie ceļa
Forvardera operators veido krautnes tā, lai kravas auto tās var droši un ātri iekraut.
+ Krautni novieto uz sausas, līdzenas vietas, kas pieejama kravas auto krānam. Apakšā liek paliktņus (šķērskokus), lai baļķi nesaskartos ar zemi un dubļiem.
+ Baļķu gali krautnes priekšpusē ir izlīdzināti vienā plaknē; resnie gali pēc iespējas vienā virzienā, ja pircējs to prasa.
+ Katrā krautnē viens sortiments; dažādas krautnes skaidri atdalītas.
+ Krautni marķē tā, kā norādījis pasūtītājs — ar krāsu, plāksnīti vai uzlīmi: sortiments, objekta vai cirsmas numurs, datums.
x Aizliegts veidot krautnes grāvjos, uz caurtekām, zem elektrolīnijām, uz ceļa braucamās daļas vai tā, ka tās aizsedz redzamību krustojumos.
x Aizliegts kraut sniegu, zarus un augsni kopā ar kokmateriāliem.

## Forvardera uzskaite
- Katrai kravai forvardera datorā atzīmē sortimentu un krautni, ja mašīnai ir šāda funkcija (.fpr fails).
- Ja datora nav, operators ved uzskaiti par kravām pēc sortimentiem un dienas beigās ievada tās platformā.
- Beidzot objektu, forvardera operators pārbauda, vai cirsmā nav palikuši sagatavoti kokmateriāli, un ziņo meistaram par atlikumu.

## Ievade platformā
Produkciju reģistrē **katru dienu līdz maiņas beigām**, katram objektam un tehnikai atsevišķi.
1. Nospied dzelteno pogu **Ziņot** un izvēlies **Produkcija** (ātrā atskaite „Šodienas apjoms”) vai atver sadaļu **Produkcija** un nospied **Pievienot produkciju**.
2. Pārbaudi **objektu** un **tehniku** — ja ir aktīva maiņa, tie aizpildās automātiski.
3. Ja objektam ir reģistrētas darba vietas, izvēlies pareizo **Darba vieta / nogabals**.
4. Ievadi **daudzumu** un **mērvienību**: m³, gab., kravas vai cits. Ja izvēlies „cits”, aizpildi **Mērvienības nosaukums** (piem., „bērza malka (ster)”).
5. Pārbaudi **datumu** — tam jābūt dienai, kad darbs faktiski veikts.
6. Nosūti. Ja nav interneta, ieraksts tiks nosūtīts vēlāk automātiski.

Harvestera operators ievada apjomu no mašīnas datora dienas kopsavilkuma (m³). Forvardera operators ievada izvesto apjomu vai kravu skaitu tā, kā noteicis meistars.

## Saskaņošana ar meistaru
+ **Katru dienu** meistars pārbauda, vai produkcija ievadīta visiem objektiem un visai tehnikai.
+ **Katru nedēļu** meistars salīdzina harvestera datus (.hpr/.thp), forvardera izvesto apjomu un ierakstus platformā. Lielas atšķirības noskaidro nekavējoties.
+ Ja atrodi kļūdu savā ierakstā — paziņo meistaram tajā pašā dienā. Labojumu veic meistars; neveido jaunu, dublējošu ierakstu.
+ Pabeidzot objektu, meistars pārbauda kopējo apjomu pret pasūtītāja uzmērījumiem un atzīmē atšķirības.

## Biežākās kļūdas
| Kļūda | Sekas | Kā novērst |
| Nepareiza objekta instrukcija datorā | Viss apjoms uzrakstīts citam objektam vai ar nepareiziem sortimentiem | Pārbaudi objektu pirms pirmā koka |
| Nav kontrolmērījumu | Sistemātiska garuma vai caurmēra kļūda visā objektā | Kontrolmērījums katrā maiņā |
| Baļķi par īsu | Pazemināts sortiments, pircēja sūdzības | Kalibrē garumu, uzturi mērriteni tīru |
| Jaukti sortimenti krautnē | Pircējs noraida vai pārvērtē kravu | Viena krautne — viens sortiments |
| Produkcija ievadīta vēlāk vai kopā par vairākām dienām | Nepareiza produktivitāte un izmaksas uz m³ | Ievadi katru dienu |
| Nepareiza mērvienība (kravas m³ vietā) | Kopsummas nesakrīt | Pārbaudi mērvienību pirms nosūtīšanas |
| Dublēts ieraksts | Divkāršs apjoms | Pārbaudi sarakstu; labojumus veic meistars |

## Kontroljautājumi
1. Ar ko harvesters mēra baļķa garumu un caurmēru, un kur tiek saglabāti dati?
2. Kad obligāti jāveic kontrolmērījums un kalibrēšana?
3. Kas ir virsmērs, un kas notiek, ja baļķis ir īsāks par nominālo garumu?
4. Kādas ir galvenās prasības krautnes novietošanai un marķēšanai pie ceļa?
5. Kā pareizi ievadīt dienas produkciju platformā, un ko darīt, ja ievadīts nepareizs daudzums?
`,
};
