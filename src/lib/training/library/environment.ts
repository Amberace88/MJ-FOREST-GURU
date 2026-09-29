import type { BuiltinMaterial } from "../types";

export const environmentProtection: BuiltinMaterial = {
  key: "environment-protection",
  version: 1,
  category: "environment",
  country: null,
  title: "Vides aizsardzība mežizstrādē",
  subtitle: "Augsne un sliedes, ūdeņi un grāvji, noplūdes, degviela, atkritumi, ceļi un sertifikācija",
  summary:
    "Kā strādāt tā, lai cirsmā nepaliek dziļas sliedes, piesārņoti grāvji vai atkritumi. Materiāls skaidro augsnes aizsardzību, ūdensteču šķērsošanu un aizsargjoslas, rīcību ar eļļām un degvielu, ceļu uzturēšanu un to, ko FSC un PEFC sertifikācija nozīmē darbuzņēmējam.",
  audience: ["employee", "foreman", "mechanic"],
  requiresAck: true,
  readingMinutes: 10,
  body: `## Kāpēc tas ir mūsu darbs
Pasūtītāji mūs izvēlas ne tikai pēc ražības, bet arī pēc tā, kā cirsma izskatās pēc mums. Dziļas sliedes, duļķains grāvis vai eļļas traips var nozīmēt pasūtītāja sankcijas, sertifikācijas neatbilstību, iestāžu sodu un zaudētu klientu. Šis materiāls papildina vides sadaļas valstu drošības materiālos. Katrs noteikums ir atzīmēts kā **likuma prasība**, **sertifikācijas prasība** vai **uzņēmuma noteikums**. Pasūtītāja līgumā var būt vēl stingrākas prasības — tad ievēro tās.

## Pirms darba: plānošana
Lielākā daļa augsnes un ūdeņu bojājumu rodas nevis darba laikā, bet sliktas plānošanas dēļ.
+ Meistars pirms darba iepazīstas ar cirsmas karti: mitras vietas, grāvji, strauti, avoti, aizsargjoslas, kultūrvēsturiski objekti un iezīmētās dabas vērtības.
+ Galvenos pievešanas ceļus (tehnoloģiskos koridorus) plāno pa sausākajām vietām un tā, lai tie pēc iespējas mazāk šķērso grāvjus un strautus.
+ Mitras cirsmas plāno sausam periodam vai salam. Ja laikapstākļi mainās, meistars pārplāno secību, nevis „izbrauc cauri”.
+ Operatori saņem karti platformā vai izdrukā un zina, kur ir ierobežojumi.

## Augsnes aizsardzība un sliedes
Likuma prasība (Latvija, MK noteikumi Nr. 936): meža apsaimniekošanā izmanto paņēmienus, kas neizraisa augsnes eroziju, un izvairās no ūdens noteces traucēšanas grāvjos, strautos un upēs.

Uzņēmuma noteikumi:
+ **Zaru klājums:** harvesters atstāj zarus un galotnes uz pievešanas ceļiem, īpaši uz mitrām vietām. Zaru klājums sadala mašīnas svaru un aizsargā saknes.
+ Uz mīkstas grunts biezāku klājumu veido jau iepriekš; nenoņem zarus no ceļiem, pat ja tos plānots vākt enerģētiskajai koksnei — vispirms beidz izvešanu.
+ Samazini riepu spiedienu un lieto kāpurķēdes vai ķēdes uz riteņiem, ja mašīnai tas paredzēts.
+ Forvarders brauc ar mazāku kravu mitrās vietās un pēc iespējas mazāk reižu pa vienu un to pašu ceļu.
+ Ja sliedes kļūst dziļākas par apmēram 20 cm vai sāk vest ūdeni un dubļus uz grāvi vai strautu — **pārtrauc** braukšanu pa šo vietu un ziņo meistaram.
+ Pēc darba sliedes, kas novada ūdeni uz ūdensteci vai traucē ceļu, izlīdzina vai aizsprosto ar zariem, kā norāda meistars.
x Aizliegts braukt pa avotiem, avoksnājiem un mitrām ieplakām ar ūdens izplūdi.

? Sezona: Pavasara šķīšanas laiks un rudens lietus ir riskantākie. Sasalusi zeme vai sauss vasaras periods ļauj strādāt mitrās cirsmās bez bojājumiem.

Sertifikācijas prasība (piemēram, Zviedrijas PEFC standarts): braukšanas bojājumi, kas rada tiešu dūņu un humusa noplūdi ezerā vai ūdenstecē vai traucē izmantot bieži lietotus ceļus, ir jānovērš.

## Ūdensteces, grāvji un aizsargjoslas
Likuma prasība (Latvija, Aizsargjoslu likums): gar upēm un ezeriem ir virszemes ūdensobjektu aizsargjoslas, kurās ir saimnieciskās darbības ierobežojumi. Minimālais platums atkarīgs no upes garuma vai ezera platības — piemēram, upei, kas īsāka par 10 km, un ezeram, kas mazāks par 10 ha, vismaz 10 m; garākām upēm un lielākiem ezeriem — 50, 100, 300 vai 500 m. Precīzas robežas un ierobežojumus konkrētajai cirsmai norāda cirsmas dokumenti un meistars.

Likuma prasība (Zviedrija, Skogsvårdslagen 30. §): mežizstrādē jāņem vērā dabas un kultūrvides intereses (hänsyn). Tas ietver aizsargjoslas (skyddszoner, kantzoner) gar ūdeņiem un mitrājiem; to platums tiek pielāgots konkrētajai vietai.

Uzņēmuma noteikumi:
+ Ūdensteci šķērso tikai meistara norādītā vietā un tikai pa pagaidu pārbrauktuvi: pagaidu tiltu, baļķu klāju, zaru un baļķu klājumu vai caurules ar zaru klājumu.
+ Pārbrauktuve nedrīkst apturēt ūdens plūsmu. Pēc darba to novāc un atjauno krastu un noteci.
+ Aizsargjoslā tehniku nevadā ārpus iezīmētā ceļa, neveido krautnes un neuzpilda degvielu.
+ Ja koks iekritis strautā vai grāvī — izvāc to. Grāvi aizsprostot aizliegts.
+ Meliorācijas grāvju malās nebrauc garenvirzienā — mala nobrūk un aizsprosto grāvi.
x Aizliegts mazgāt tehniku ūdenstecēs vai to tuvumā.

## Eļļas un hidrauliskā šķidruma noplūdes
Harvesterā ir vairāki simti litru hidrauliskās eļļas. Pārsprāgusi šļūtene dažās sekundēs var izliet desmitiem litru.
+ **Bioloģiski noārdāma eļļa:** uzņēmuma noteikums — hidraulikā un ķēdes eļļošanai lieto bioloģiski noārdāmas eļļas, ja mašīnas ražotājs to pieļauj; to pieprasa arī daudzi pasūtītāji. Bioloģiski noārdāma eļļa **nav nekaitīga** — arī tās noplūde ir jāsavāc.
+ Katrā mašīnā ir **absorbenta komplekts** (absorbējošie paklāji, granulas vai bumas, maisi) un rezerves šļūtenes biežāk plīstošajām vietām.
+ Noplūdes gadījumā: aptur mašīnu, samazini spiedienu, aizspied vai nosloksnē noplūdi, noliec absorbentu, neļauj eļļai sasniegt ūdeni (zemes valnītis), savāc piesārņoto augsni maisos.
+ Katru noplūdi — arī nelielu — reģistrē platformā kā „Vides incidents” ar foto un GPS.
+ Mehāniķis maina šļūtenes un eļļu virs paplātes vai absorbenta paklāja, nevis tieši uz zemes.

Detalizēta rīcība noplūdes brīdī ir aprakstīta materiālā „Rīcība ārkārtas situācijās”.

## Degvielas uzglabāšana un uzpilde
+ Degvielu cirsmā glabā tikai apstiprinātās tvertnēs — dubultsienu tvertnēs vai tvertnēs ar savākšanas paplāti.
+ Tvertni novieto uz līdzenas, stabilas vietas, ne tuvāk par 50 m no ūdeņiem un grāvjiem, prom no pievešanas ceļiem, kur to var aizķert.
+ Uzpildes pistole un šļūtene pēc lietošanas ir noslēgtas; tvertne aizslēgta, kad neviens to neuzrauga.
+ Uzpildes laikā operators ir klāt visu laiku.
x Aizliegts uzpildīt degvielu, stāvot aizsargjoslā vai grāvī.

## Atkritumi
Uzņēmuma noteikumi: cirsmā neatstāj neko, kas tur nebija pirms darba.
- Eļļas filtri, lupatas, absorbenti un tukšas eļļas kannas ir **bīstamie atkritumi**. Tos savāc atsevišķos, noslēgtos maisos vai tvertnēs un nodod meistaram vai mehāniķim utilizācijai pie licencēta apsaimniekotāja.
- Sadzīves atkritumus (iepakojumus, pudeles) aizved līdzi katru dienu.
- Nolietotas ķēdes, sliedes, šļūtenes un metāla daļas savāc un aizved uz bāzi.
x Aizliegts dedzināt atkritumus vai tos aprakt.

## Ceļu uzturēšana
Meža ceļi un pievedceļi bieži pieder citam īpašniekam vai pasūtītājam.
+ Pirms darba meistars nofotografē ceļa stāvokli — tas pasargā no nepamatotām pretenzijām.
+ Krautnes neveido uz ceļa grāvjiem un caurtekām; kravas auto iekraušanas vietās neaizsprosto ūdens noteci.
+ Forvarders nebrauc pa ceļa braucamo daļu ar ķēdēm, ja to var izvairīties.
+ Ja uz ceļa rodas bedres vai sliedes, tās salabo pēc darba vai saskaņo remontu ar pasūtītāju.
+ Dubļus un zarus no ceļa novāc, īpaši pie koplietošanas ceļa pieslēguma.
+ Atkušņa laikā ievēro ceļa īpašnieka noteiktos svara ierobežojumus.

## FSC un PEFC — ko tas nozīmē darbuzņēmējam
FSC un PEFC ir brīvprātīgas meža sertifikācijas sistēmas. Lielākā daļa mūsu pasūtītāju ir sertificēti, un viņu prasības attiecas arī uz mums kā darbuzņēmēju.
- **Likumu ievērošana:** darba drošība, darba tiesības, vides un dabas aizsardzības likumi.
- **Kompetence:** darbiniekiem jābūt darbam atbilstošai apmācībai, arī dabas un kultūrvides jautājumos. Piemēram, Zviedrijas PEFC standarts prasa dabas aizsardzības kursu vai līdzvērtīgu apmācību tiem, kas plāno vai veic mežizstrādi.
- **Dabas vērtību saglabāšana:** ekoloģiskie un dabas aizsardzības koki, mirusī koksne, aizsargjoslas (skat. materiālu „Dabas vērtību saglabāšana cirsmā”).
- **Augsnes un ūdeņu aizsardzība, noplūžu novēršana un atkritumu savākšana.**
- **Dokumentēšana:** instruktāžas, apmācības, incidenti un novirzes ir jāreģistrē — to pārbauda auditori.

? Audits: Sertifikācijas auditori var ierasties cirsmā un uzdot jautājumus operatoram. Pastāsti godīgi, kā tu strādā, un parādi absorbenta komplektu, karti un aptieciņu. Ja nezini atbildi — pasauc meistaru.

## Kontroljautājumi
1. Kā zaru klājums pasargā augsni, un ko darīt, ja sliedes kļūst dziļas vai sāk vest ūdeni uz grāvi?
2. Kā drīkst šķērsot ūdensteci, un kas jāizdara pēc darba beigām?
3. Kā rīkoties hidrauliskās eļļas noplūdes gadījumā, un vai bioloģiski noārdāmu eļļu drīkst atstāt uz zemes?
4. Kur un kā drīkst glabāt degvielu cirsmā?
5. Kas ir bīstamie atkritumi mežizstrādē, un kā ar tiem rīkoties?
`,
};
