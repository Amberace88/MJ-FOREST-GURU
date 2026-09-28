import type { BuiltinMaterial } from "../types";

export const machineryRules: BuiltinMaterial = {
  key: "machinery-rules",
  version: 1,
  category: "machinery",
  country: null,
  title: "Tehnikas lietošanas un apkopes noteikumi",
  subtitle: "Harvesteri, forvarderi, motorzāģi, kvadracikli un servisa transports — droša lietošana katru dienu",
  summary:
    "Uzņēmuma noteikumi drošai meža tehnikas lietošanai un apkopei: ikdienas pārbaude, bīstamās zonas, degvielas uzpilde, hidraulika, bloķēšana pirms remonta un ziņošana lietotnē. Attiecas uz visām valstīm; valsts prasības skatīt attiecīgās valsts drošības materiālā.",
  audience: ["employee", "foreman", "mechanic"],
  requiresAck: true,
  readingMinutes: 14,
  body: `## Kam paredzēts šis materiāls
Šie noteikumi attiecas uz visiem, kas vada, apkalpo vai remontē MJ FOREST GURU tehniku Latvijā, Zviedrijā un Islandē. Ja kāda valsts normatīvie akti prasa vairāk, ievēro stingrāko prasību. Valsts prasības ir aprakstītas materiālos „Darba drošība mežizstrādē” katrai valstij.

Visi šajā materiālā minētie noteikumi ir **uzņēmuma noteikumi**, ja nav norādīts citādi. Vienmēr ievēro arī konkrētās mašīnas ražotāja lietošanas instrukciju — tai jābūt kabīnē.

## Kas drīkst vadīt tehniku
| Tehnika | Kas drīkst vadīt | Galvenie riski |
| Harvesters | Apmācīts operators ar meistara atļauju un nepieciešamajām valsts tiesībām | Ķēdes šāviens, apgāšanās, hidraulika |
| Forvarders | Apmācīts operators ar meistara atļauju | Krāna zona, apgāšanās nogāzē, krava |
| Motorzāģis | Darbinieks ar dokumentētu apmācību un pilnu IAL | Iegriezumi, atsitiens, krītoši koki |
| Kvadracikls (ATV) | Darbinieks ar vadītāja tiesībām un instruktāžu | Apgāšanās, sadursme |
| Servisa transports | Darbinieks ar derīgu vadītāja apliecību | Satiksme, krava, meža ceļi |

x Aizliegts vadīt tehniku, kurai neesi instruēts, pat „tikai pārbraukt”.

## Ikdienas pārbaude (pirms maiņas)
Ikdienas pārbaudi veic katras maiņas sākumā, pirms tehnika sāk darbu.
1. Apstaigā mašīnu: noplūdes zem mašīnas, bojātas šļūtenes, plaisas rāmī un krānā, riepas, ķēdes un sliedes.
2. Pārbaudi šķidrumu līmeņus: motoreļļa, hidrauliskā eļļa, dzesēšanas šķidrums, degviela, AdBlue (ja ir).
3. Pārbaudi kabīnes logus: bez plaisām, dziļiem skrāpējumiem un nekvalitatīva remonta.
4. Pārbaudi ugunsdzēšamo aparātu (spiediens, plomba) un aptieciņu.
5. Pārbaudi absorbenta komplektu.
6. Iedarbini motoru un pārbaudi brīdinājuma lampas, bremzes, stūrēšanu, apgaismojumu un avārijas apturēšanu.
7. Pārbaudi darba ierīces: krāna kustības, harvestera galvas zāģi un ķēdes spriegotāju, ķēdes aizturi.
8. Ieraksti atrasto: nopietnu defektu — ziņo meistaram un reģistrē lietotnē pirms darba sākuma.

| Pārbaudāmais | Harvesters | Forvarders | Motorzāģis | ATV | Servisa auto |
| Noplūdes un šļūtenes | Jā | Jā | Degvielas/eļļas tvertnes | Jā | Jā |
| Logi un aizsargi | Jā | Jā | Ķēdes aizsargs | Nav | Nav |
| Bremzes / ķēdes bremze | Jā | Jā | Ķēdes bremze | Jā | Jā |
| Ugunsdzēšamais aparāts | Jā | Jā | Nav | Nav | Jā |
| Ķēde, sliede, zāģis | Jā | Nav | Jā | Nav | Nav |
| Riepas, kāpurķēdes | Jā | Jā | Nav | Jā | Jā |
| Apgaismojums | Jā | Jā | Nav | Jā | Jā |

!! Nedrīkst strādāt: Ja nestrādā bremzes, avārijas apturēšana, ķēdes bremze vai ir hidrauliska noplūde zem spiediena, tehniku neizmanto, līdz defekts novērsts.

## Iedarbināšana, apturēšana un novietošana
+ Pirms iedarbināšanas pārliecinies, ka neviens neatrodas pie mašīnas vai zem tās.
+ Iekāp un izkāp, izmantojot trīs atbalsta punktus. Nelec no kabīnes.
+ Novietojot mašīnu: uz līdzena pamata, ja iespējams; stāvbremze ieslēgta; krāns un harvestera galva nolaisti zemē; motors izslēgts; atslēga izņemta.
+ Nogāzē mašīnu pēc iespējas nenovieto. Ja tas ir nepieciešams, novieto to taisni pa slīpumu (nevis šķērsām), ieslēdz stāvbremzi un nolaid darba ierīces zemē kā papildu atbalstu.
x Aizliegts atstāt mašīnu ar paceltu krānu vai kravu.
x Aizliegts atstāt atslēgu mašīnā, kad tā nav uzraudzīta.

## Krāna darbs un bīstamās zonas
| Situācija | Minimālā distance |
| Strādājošs harvesters | 90 m (uz mašīnām parasti norādīti 70 m) |
| Forvardera vai kravas auto krāns | Ārpus krāna sniedzamības + 5 m, ne mazāk kā 20 m |
| Koka gāšana ar motorzāģi | 2 koka garumi |

+ Operators aptur darbu, tiklīdz kāds cilvēks ienāk bīstamajā zonā.
+ Cilvēks, kas tuvojas mašīnai, vispirms nodibina acu kontaktu vai sakarus un gaida signālu.
x Aizliegts pārvietot kravu vai krānu pāri cilvēkiem, transportlīdzekļiem vai kabīnēm.
x Aizliegts atrasties zem pacelta krāna, kravas vai harvestera galvas.

## Ķēdes šāviens un kabīnes logi
Harvestera ķēdes pārtrūkšanas gadījumā ķēdes posmi var izlidot ar šāviena ātrumu (ķēdes šāviens). Tie var sasniegt cilvēkus daudz tālāk par marķēto zonu un var izsist kabīnes logu.
+ Harvestera zāģa sliedi nekad nevērs pret kabīni vai cilvēkiem.
+ Ķēdi, kas nolēkusi no sliedes, nomaini. Nelieto ķēdi, kas jau ir pārtrūkusi, vai ķēdi ar bojātiem posmiem.
+ Uzturi pareizu ķēdes spriegojumu un eļļošanu; ķēdes aizturim jābūt uzstādītam un veselam.
+ Kabīnes aizsarglogus maina tikai pret ražotāja noteiktajiem. Polikarbonāta logi ar laiku UV starojuma dēļ zaudē izturību — tos maina ražotāja noteiktajā termiņā vai tūlīt, ja tie ir bojāti.
x Aizliegts strādāt ar harvesteru, ja priekšējais vai sānu aizsarglogs ir ieplaisājis.

## Darbs pie elektrolīnijām
- Pirms darba sākuma meistars cirsmas kartē atzīmē visas gaisvadu līnijas.
- Ja darba vieta ir tuvāk par 30 m no gaisvadu līnijas, darbu sāk tikai pēc meistara instruktāžas un, ja nepieciešams, saskaņojuma ar tīkla operatoru.
- Kokus, kas var uzkrist līnijai, negāž, kamēr nav saņemts meistara norādījums.
- Krānu un harvestera galvu nekad nepaceļ līnijas tuvumā bez novērotāja.

!! Saskare ar līniju: Ja mašīna pieskārusies elektrolīnijai, paliec kabīnē, brīdini citus netuvoties un zvani 112. Izkāp tikai tad, ja mašīna deg: lec ar kopā saliktām kājām, nepieskaroties vienlaikus mašīnai un zemei, un attālinies maziem lēcieniem.

## Nogāzes un mīksta grunts
- Pirms darba nogāzē novērtē slīpumu, grunts nestspēju, akmeņus un celmus.
- Brauc taisni augšup vai lejup pa nogāzi, nevis šķērsām, ja ražotājs nenosaka citādi.
- Krava un krāns pēc iespējas zemāk; asi pagriezieni nogāzē aizliegti.
- Mīkstā gruntī izmanto zaru klājumu un, ja nepieciešams, kāpurķēdes.
- Ja mašīna sāk sasvērties, nemēģini izlekt — paliec kabīnē piesprādzējies un turies.
+ Kabīnē vienmēr lieto drošības jostu.

## Degvielas uzpilde
+ Motors izslēgts, atslēga izņemta.
+ Uzpilde ne tuvāk kā 50 m no ūdeņiem, grāvjiem un avotiem.
+ Absorbenta komplekts ir blakus uzpildes laikā.
+ Izmanto tikai marķētas, apstiprinātas kannas vai sertificētu mobilo degvielas tvertni.
+ Pēc uzpildes reģistrē degvielu lietotnes sadaļā „Degviela” tās pašas maiņas laikā.
x Aizliegts smēķēt un lietot atklātu uguni 10 m rādiusā no uzpildes vietas.
x Aizliegts uzpildīt karstu motorzāģi — ļauj tam atdzist.

## Hidrauliskās noplūdes
Hidrauliskā eļļa zem augsta spiediena var izspiesties caur ādu un radīt smagu iešļircināšanas traumu, kas sākumā izskatās kā maza skramba.
x Aizliegts meklēt noplūdi ar roku. Izmanto kartona vai koka gabalu.
+ Pirms darba pie hidraulikas nolaid darba ierīces zemē, izslēdz motoru un atbrīvo spiedienu saskaņā ar ražotāja instrukciju.
!! Iešļircināšanas trauma: Ja eļļa iekļuvusi zem ādas, tā ir ārkārtas situācija. Zvani 112 vai nekavējoties dodies uz slimnīcu, arī ja sāpes ir nelielas.

## Apkope un remonts: bloķēšana
Pirms jebkura apkopes vai remonta darba:
1. Nolaid krānu, galvu un citas darba ierīces zemē vai nostiprini tās ar mehānisku balstu.
2. Izslēdz motoru, izņem atslēgu un paturi to pie sevis.
3. Atslēdz akumulatora slēdzi (ja ir) un atbrīvo hidraulisko spiedienu.
4. Pie stūres vai slēdža novieto zīmi „Nedarbināt — notiek remonts”.
5. Nekad nestrādā zem pacelta rāmja vai krāna, kas balstās tikai uz hidrauliku.
6. Pēc darba uzstādi atpakaļ visus aizsargus un pārbaudi, vai instrumenti ir savākti.

## Vilkšana
- Vilkšanai izmanto tikai nebojātas trosis, ķēdes vai stieņus ar pietiekamu nestspēju.
- Vilkšanas zonā (vismaz pusotrs troses garums uz sāniem) cilvēki neatrodas.
- Vilkšanu vada viens cilvēks ar norunātiem signāliem.
x Aizliegts izmantot krānu vai harvestera galvu kā vilkšanas palīglīdzekli, ja ražotājs to neparedz.

## Pārvietošana pa koplietošanas ceļiem
- Ievēro valsts ceļu satiksmes noteikumus, gabarītus un pārvadāšanas atļaujas; harvestera galvu un krānu nostiprini transporta stāvoklī.
- Uz treilera tehniku nostiprina ar sertificētām siksnām vai ķēdēm.
- Pirms braukšanas pārbauda apgaismojumu un brīdinājuma zīmes.

## Motorzāģis, kvadracikls un servisa transports
- Motorzāģi iedarbina uz zemes vai starp kājām nostiprinātu, ar ieslēgtu ķēdes bremzi; nekad „no rokas”.
- Motorzāģa ķēdes bremzi pārbauda katru dienu.
- Kvadraciklā vienmēr lieto ķiveri; nogāzēs brauc ļoti uzmanīgi, kravu izvieto vienmērīgi.
- Servisa transportā kravu, kannas un instrumentus nostiprina; degvielu pārvadā tikai apstiprinātās tvertnēs.

## Ziņošana lietotnē
- Bojājums vai problēma: ziņo meistaram un reģistrē lietotnē (darbinieka notikums „Problēma” vai sadaļa „Apkope un remonti”) ar aprakstu un fotoattēlu tās pašas maiņas laikā.
- Degviela: katru uzpildi reģistrē sadaļā „Degviela”.
- Apkope: mehāniķis katru veikto apkopi reģistrē sadaļā „Apkope un remonti”.
- Negadījums vai gandrīz negadījums ar tehniku: sadaļā „Incidenti”.

## Darbs ziemā
- Pirms darba notīri sniegu un ledu no kāpšļiem, rokturiem, logiem un apgaismojuma.
- Ļauj hidraulikai iesilt pirms pilnas slodzes.
- Pārbaudi, vai zem sniega nav slēptu grāvju, akmeņu un celmu.
- Aukstā laikā degvielai un AdBlue jāatbilst sezonai.

## Stingri aizliegts
x Vest pasažierus mašīnās, kurām nav paredzēta pasažiera sēdvieta.
x Atslēgt, apiet vai bojāt aizsargierīces, sensorus un avārijas apturēšanu.
x Strādāt alkohola, narkotisko vai apreibinošo vielu ietekmē — nulles tolerance.
x Lietot telefonu, vadot tehniku kustībā.
x Strādāt ar tehniku, ja esi pārguris vai slikti jūties.

## Atbildība
| Loma | Galvenā atbildība |
| Operators | Ikdienas pārbaude, droša lietošana, bīstamās zonas kontrole, defektu un degvielas reģistrēšana |
| Mehāniķis | Apkope un remonts pēc ražotāja prasībām, bloķēšana, aizsargu atjaunošana, ierakstu veikšana |
| Meistars | Atļauja vadīt tehniku, instruktāža, cirsmas riski (līnijas, nogāzes), lēmums par tehnikas apturēšanu |

## Kontroljautājumi
1. Kādas darbības ietilpst ikdienas pārbaudē pirms maiņas?
2. Kā pareizi novietot forvarderu nogāzē maiņas beigās?
3. Kāda ir uzņēmuma noteiktā drošā distance līdz strādājošam harvesteram, un kāpēc tā ir lielāka par marķēto?
4. Kā meklēt hidraulisko noplūdi, un ko darīt, ja eļļa iekļuvusi zem ādas?
5. Kas jādara, ja mašīnas krāns pieskāries elektrolīnijai?
6. Kādi soļi jāveic pirms apkopes vai remonta darba (bloķēšana)?
`,
};
