import type { BuiltinMaterial } from "../types";

export const safetyIS: BuiltinMaterial = {
  key: "safety-is",
  version: 1,
  category: "safety",
  country: "IS",
  title: "Darba drošība mežizstrādē — Islande",
  subtitle: "Islandes prasības, laikapstākļi, attālas darba vietas un rīcība ārkārtas gadījumā",
  summary:
    "Galvenās darba aizsardzības, ugunsdrošības un vides prasības mežizstrādē Islandē: Vinnueftirlitið loma, iekārtu vadītāju tiesības, ciršanas atļaujas, laikapstākļu riski un ziņošana par negadījumiem. Jāizlasa un jāapstiprina pirms darba uzsākšanas Islandes objektos.",
  audience: ["employee", "foreman", "mechanic", "manager"],
  requiresAck: true,
  readingMinutes: 13,
  body: `## Kam paredzēts šis materiāls
Šis materiāls attiecas uz visiem MJ FOREST GURU darbiniekiem Islandes objektos. Islandē mežizstrāde bieži notiek attālās vietās, mainīgos laikapstākļos un ar vāju mobilo sakaru pārklājumu, tāpēc plānošanai un sakariem šeit ir īpaša nozīme. Materiāls neaizstāj instruktāžu darba vietā.

Tekstā ir divu veidu prasības:
- **Likuma prasība** — izriet no Islandes normatīvajiem aktiem un Vinnueftirlitið (Islandes Darba drošības un veselības administrācijas) prasībām.
- **Uzņēmuma noteikums** — MJ FOREST GURU iekšējā prasība, kas ir obligāta visiem mūsu objektos.

? Aktuālā versija: Normatīvie akti mainās. Aktuālo šī materiāla versiju uztur meistars un sistēmas administrators. Neskaidros jautājumos vērsies pie meistara.

## Galvenais likums un iestādes
Islandē darba drošību regulē likums Nr. 46/1980 par darba apstākļiem, higiēnu un drošību darba vietās (Lög um aðbúnað, hollustuhætti og öryggi á vinnustöðum). Uzraudzību veic Vinnueftirlitið.

Mežsaimniecības valsts iestāde kopš 2024. gada ir **Land og skógur**, kas izveidota, apvienojot Skógræktin (Meža dienestu) un Landgræðslan (Zemes atjaunošanas dienestu).

## Darba devēja un darbinieka pienākumi
Likuma prasība: darba devējs nodrošina pēc iespējas pilnīgu drošību, labus darba apstākļus un higiēnu. Darbiniekam, kas pamana bojājumu vai trūkumu, par to nekavējoties jāziņo.
+ Ievēro instruktāžu un meistara norādījumus.
+ Pareizi lieto IAL un aizsargierīces.
+ Nekavējoties ziņo par bojājumiem, bīstamām situācijām un negadījumiem.
+ Ja darbs ir tieši bīstams, pārtrauc to un sazinies ar meistaru.

## Iekārtu vadītāju tiesības (vinnuvélaréttindi)
Likuma prasība: Islandē noteiktu darba mašīnu vadīšanai nepieciešamas Vinnueftirlitið izsniegtas vai atzītas tiesības (vinnuvélaréttindi). Kategorijas aptver, piemēram, celtņus, iekrāvējus, ekskavatorus un traktorus ar hidraulisko aprīkojumu. Meža mašīnas (harvesteri, forvarderi) kategoriju sarakstā nav nosauktas atsevišķi.

Ārvalstīs iegūtas tiesības var iesniegt izvērtēšanai Vinnueftirlitið.

!! Pirms darba ar mašīnu: Uzņēmuma noteikums — Islandē neviens nesāk darbu ar harvesteru, forvarderu, krānu vai citu mašīnu, kamēr administrācija nav pārbaudījusi ar Vinnueftirlitið, kādas tiesības konkrētajai mašīnai nepieciešamas, un meistars nav apstiprinājis, ka tev tās ir.

## Individuālie aizsardzības līdzekļi
Uzņēmuma noteikums: Islandē izmanto tādu pašu IAL komplektu kā pārējās valstīs.

| Darbs | Obligātie IAL | Standarts (piemērs) |
| Motorzāģa darbs | Ķivere ar sejsargu un austiņām | EN 397, EN 1731, EN 352 |
| Motorzāģa darbs | Bikses vai kājsargi ar zāģa aizsardzību | EN ISO 11393-2 |
| Motorzāģa darbs | Zābaki ar zāģa aizsardzību | EN ISO 17249 |
| Motorzāģa darbs | Darba cimdi, signālkrāsas virsdrēbes | EN ISO 11393-4, EN ISO 20471 |
| Operators ārpus kabīnes, mehāniķis, autovadītājs | Signālkrāsas veste, drošības apavi, ķivere pie krāna | EN ISO 20471, EN ISO 20345, EN 397 |

Papildus Islandē: vēja un ūdens necaurlaidīgs apģērbs, silts starpslānis un rezerves cimdi. Bikses ar zāģa aizsardzību pēc iegriezuma vienmēr jāmaina.

## Drošās distances
| Situācija | Distance | Statuss |
| Koka gāšana — citi cilvēki | Vismaz 2 koka garumi | Uzņēmuma noteikums |
| Divi zāģētāji | Vismaz 2 koku garumi | Uzņēmuma noteikums |
| Strādājošs harvesters | 90 m (uz mašīnas parasti norādīti 70 m) | Uzņēmuma noteikums |
| Forvarders vai krāns | Ārpus krāna sniedzamības + 5 m, ne mazāk kā 20 m | Uzņēmuma noteikums |

Islandes mežos bieži ir stāvas nogāzes un nelīdzens reljefs. Koki un baļķi var ripot lejup — nekad nestrādā nogāzē zem cita darbinieka vai mašīnas.

## Darbs vienatnē un sakari
Uzņēmuma noteikumi:
1. Pirms katra objekta meistars pārbauda mobilo sakaru pārklājumu un nosaka sakaru kārtību. Ja pārklājuma nav, darbs vienatnē nav atļauts.
2. Koku gāšanu ar motorzāģi vienatnē neveic bez meistara atļaujas.
3. Sazinies norunātajos laikos (ne retāk kā ik pēc 2 stundām) un darba beigās.
4. Telefonā instalē lietotni „112 Iceland” — zvanot caur to, tava atrašanās vieta tiek nosūtīta ārkārtas centram, un var arī nosūtīt teksta ziņu.
5. Transportlīdzeklī vienmēr jābūt pietiekamai degvielai atgriešanās ceļam, siltām drēbēm, ūdenim un pārtikai.

## Laikapstākļi un reljefs
Islandes laikapstākļi var strauji mainīties arī vasarā.
+ Katru rītu pārbaudi laika prognozi un brīdinājumus (Veðurstofa Íslands — vedur.is) un ceļu stāvokli.
+ Stiprā vējā pārtrauc manuālu koku gāšanu un darbu ar krānu, ja vējš ietekmē kravu.
+ Vētras brīdinājuma gadījumā meistars lemj par darba pārtraukšanu un savlaicīgu atgriešanos.
+ Ziemā diennakts gaišais laiks ir ļoti īss — plāno darbu gaismā, lieto lukturus un atstarojošu apģērbu.
+ Uzmanies no slapjas zāles, sūnām un irdenas grunts nogāzēs — tehnika var noslīdēt.
x Aizliegts doties uz attālu objektu, ja ir brīdinājums par bīstamiem laikapstākļiem un meistars to nav atļāvis.

## Ugunsdrošība
Islandes Civilās aizsardzības dienests (Almannavarnir) norāda, ka veģetācijas ugunsgrēku (gróðureldar) risks pēdējos gados ir pieaudzis, tostarp mežu stādījumu dēļ. Sausos periodos iestādes var izsludināt paaugstinātas bīstamības līmeni atsevišķos reģionos.

Uzņēmuma noteikumi:
+ Katrā mašīnā un transportlīdzeklī ir pārbaudīts ugunsdzēšamais aparāts.
+ Motora nodalījumu regulāri attīra no skaidām un eļļas.
+ Sausā laikā pēc maiņas pārbaudi darba vietu.
x Aizliegts smēķēt ārpus norādītās vietas un kurināt ugunskurus.

!! Ugunsgrēks (eldur): Zvani 112, brīdini citus, dzēs, ja tas ir droši. Pēc tam ziņo meistaram un lietotnē.

## Pirmās palīdzības aprīkojums
Uzņēmuma noteikumi: katrā mašīnā un transportlīdzeklī ir aptieciņa ar turniketu un termosegu; katrs motorzāģa darbinieks nēsā individuālo pārsienamo paketi. Attālās vietās ātrās palīdzības ierašanās var aizņemt ilgu laiku, tāpēc komandā jābūt vismaz vienam cilvēkam ar pirmās palīdzības apmācību. Pilns saraksts — materiālā „Rīcība ārkārtas situācijās”.

## Nelaimes gadījumi un gandrīz negadījumi
Uzņēmuma noteikums: par katru negadījumu, traumu, ugunsgrēku, noplūdi vai gandrīz negadījumu ziņo:
1. nekavējoties meistaram;
2. tās pašas maiņas laikā lietotnes sadaļā „Incidenti”, pievienojot GPS atrašanās vietu un fotoattēlus.

Likuma prasības (darba devēja pienākumi):
- par nāves gadījumu vai smagu traumu darba devējs pēc iespējas ātrāk, bet ne vēlāk kā 24 stundu laikā ziņo Vinnueftirlitið un policijai;
- par negadījumu, kura dēļ darbinieks ir darbnespējīgs vismaz vienu dienu pēc negadījuma dienas, darba devējs septiņu dienu laikā iesniedz ziņojumu Vinnueftirlitið;
- negadījuma vietā neko nedrīkst mainīt vairāk, nekā nepieciešams glābšanai, līdz Vinnueftirlitið izmeklēšanai.

## Vides aizsardzība
Likuma prasība: saskaņā ar likumu Nr. 33/2019 par mežiem un mežkopību meža ciršana ir atļauta tikai ar atļauju. Atļaujas izsniedz Land og skógur. Strādājam tikai tur, kur meistars apstiprinājis, ka atļauja ir spēkā, un tikai atļautajās robežās.

Uzņēmuma noteikumi:
+ Islandē daudzi putni ligzdo uz zemes. Ja atrodi ligzdu vai redzi, ka putns aizstāv ligzdu, darbu tuvumā pārtrauc un ziņo meistaram.
+ Degvielu uzpilda un tehniku apkopj ne tuvāk kā 50 m no ūdeņiem; noplūdi aptur un savāc ar absorbentu.
+ Ievēro zemes īpašnieka un Land og skógur norādījumus par ceļiem, pārbrauktuvēm un aizsargājamām vietām.
x Aizliegts braukt ar tehniku pa neskartu augsni un sūnām ārpus norādītiem maršrutiem — Islandes augsne un veģetācija atjaunojas ļoti lēni.
x Aizliegts atstāt atkritumus un eļļas produktus.

## Dokumenti, kam jābūt līdzi
- Personu apliecinošs dokuments.
- Iekārtu vadītāju tiesības (vinnuvélaréttindi) vai to atzīšanas apliecinājums, ja tādas nepieciešamas konkrētajai mašīnai.
- Autovadītāja apliecība.
- No Latvijas norīkotajiem darbiniekiem — A1 izziņa. Likuma prasība: ārvalstu pakalpojumu sniedzējs, kas norīko darbiniekus uz Islandi ilgāk par 10 darba dienām 12 mēnešu periodā, reģistrējas Vinnueftirlitið ne vēlāk kā darba sākuma dienā — to kārto administrācija.
- Uzņēmuma noteikums: objekta karte un ciršanas atļaujas informācija lietotnē vai izdrukā.

## Svarīgākie islandiešu vārdi
| Islandiski | Latviski |
| Hjálp! | Palīgā! |
| Hætta! | Briesmas! |
| Eldur | Uguns, ugunsgrēks |
| Slys / vinnuslys | Negadījums / nelaimes gadījums darbā |
| Sjúkrabíll | Ātrā palīdzība |
| Lögreglan | Policija |
| Neyðarlínan | Ārkārtas dienestu līnija (112) |
| Óveður | Vētra, slikti laikapstākļi |

## Ārkārtas numuri un koordinātas
- **112** — Neyðarlínan: policija, ugunsdzēsēji, ātrā palīdzība un glābšanas dienesti. Ja nerunā islandiski, runā angliski.
- **1700** — veselības konsultāciju līnija (ne dzīvībai bīstamos gadījumos).
- **543 2222** — Saindēšanās informācijas centrs (Eitrunarmiðstöð, Landspítali), visu diennakti.

Koordinātas: telefona kartes lietotnē ilgi nospied savu atrašanās vietu un nolasi abus skaitļus (platums, garums) lēnām, cipariem. Islandē platums ir ap 63–66, garums — ar mīnusa zīmi (rietumu garums), piemēram, 65.2811, -14.4020. Mīnusa zīmi obligāti nosauc („mīnuss” vai „west”).

## Zvanot 112
1. „Emergency in forestry work. My name is [vārds], company MJ Forest Guru.”
2. Kas notika: piemēram, „chainsaw cut”, „tree fell on a person”, „machine rolled over”, „fire”.
3. Cik cietušo, vai elpo, vai ir pie samaņas, vai stipri asiņo.
4. Koordinātas (ar mīnusa zīmi garumam), tuvākais ceļš vai saimniecība (bær), tuvākā apdzīvotā vieta.
5. Kur sagaidīsiet glābējus un vai piebraukšana iespējama ar parastu auto.
6. Tavs tālruņa numurs. Neatvieno zvanu, kamēr operators to neatļauj.

## Svarīgākie kontakti
| Kas | Kontakts | Kad izmantot |
| Neyðarlínan | 112 (arī lietotne „112 Iceland”) | Trauma, ugunsgrēks, dzīvības apdraudējums |
| Tavs meistars | Tālrunis no instruktāžas | Uzreiz pēc 112 un jebkurā bīstamā situācijā |
| Vinnueftirlitið | island.is/s/vinnueftirlitid | Negadījumu ziņošana, iekārtu vadītāju tiesības (to kārto administrācija) |
| Land og skógur | island.is/s/land-og-skogur | Ciršanas atļaujas, mežsaimniecības jautājumi |
| Veðurstofa Íslands | vedur.is | Laika prognoze un brīdinājumi |
| Eitrunarmiðstöð | 543 2222 | Saindēšanās |
| Veselības konsultācijas | 1700 | Nesteidzami veselības jautājumi |

## Atsauces
- Lög nr. 46/1980 um aðbúnað, hollustuhætti og öryggi á vinnustöðum
- Lög nr. 33/2019 um skóga og skógrækt (18. pants — ciršanas atļauja)
- Vinnueftirlitið noteikumi par iekārtu vadītāju tiesībām (vinnuvélaréttindi) un ārvalstu tiesību atzīšanu
- Vinnueftirlitið prasības par negadījumu ziņošanu (island.is — Tilkynning um vinnuslys)
- Prasības norīkoto darbinieku reģistrācijai (posting.is)
- Land og skógur (darbojas kopš 2024. gada)
- Almannavarnir — gróðureldar un ugunsbīstamība
- Neyðarlínan 112 un lietotne „112 Iceland” (112.is)
- Eitrunarmiðstöð, Landspítali

## Kontroljautājumi
1. Kura iestāde Islandē uzrauga darba drošību, un kura izsniedz meža ciršanas atļaujas?
2. Ko uzņēmuma noteikumi prasa pirms darba ar harvesteru vai forvarderu Islandē?
3. Kāpēc Islandē ir svarīgi nosaukt mīnusa zīmi, sakot koordinātas?
4. Cik ātri darba devējam jāziņo Vinnueftirlitið un policijai par smagu negadījumu?
5. Kas jāpārbauda katru rītu pirms došanās uz attālu objektu?
6. Kā rīkosies, ja cirsmā atradīsi uz zemes ligzdojoša putna ligzdu?
`,
};
