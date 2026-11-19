# Game Hub

Przeglądarkowy hub z ośmioma codziennymi zagadkami (PL, z opcją EN). Bez backendu, działa offline jako PWA. Motyw jasny / ciemny / systemowy (przełącznik w nagłówku i w ustawieniach) oraz tryb wysokiego kontrastu w obu motywach.

| Gra | Mechanika | Charakter wizualny |
| --- | --- | --- |
| **Słówko** | polskie słowo z 5 liter, 6 prób, oznaczenia trafiona / w złym miejscu / nieobecna, klawiatura z polskimi znakami; po odgadnięciu – jak w Wordle – komunikat („Genialnie!”, „Wspaniale!”…), podskok kafelków i okno ze statystykami | mocny grotesk (Archivo Black), płaskie kafelki z animacją obrotu |
| **Globus** | tajny kraj, bez limitu prób; każdy wpisany kraj koloruje się na obracanym globusie 3D tym mocniej, im bliżej (odległość granica–granica); odgadnięty kraj świeci na zielono | ciemny kosmos, skala ciepła od bladej do głębokiej czerwieni (Space Grotesk) |
| **Kontur** | sylwetka kraju, 6 prób; po każdej odległość w km, strzałka kierunku i % bliskości | styl kartograficzny: tusz na siatce, róża wiatrów (Barlow Condensed + IBM Plex Mono) |
| **Głębia** | 7 poleceń „podaj…” z geografii, historii, nauki, kultury, sportu i polityki (maks. 2 geograficzne w nurkowaniu); każda poprawna odpowiedź ma rzadkość 1–100 = punkty; 1 pkt = 10 m, maks. 700 pkt = 7000 m; 3 butle tlenu | tło ciemnieje z głębokością, głębokościomierz, bioluminescencja (Chakra Petch) |
| **Epoka** | polityczna mapa świata z przeszłości, zgadnij rok w 6 próbach; po każdej próbie tylko „wcześniej / później” (bez odległości w latach); poprawny cały okres ważności mapy; po rundzie wskazówki, po czym poznać datę | stary atlas, sepia, kartusz, oś czasu (Cinzel + Old Standard TT) |
| **Flagi** | 10 flag na rundę, wpisz nazwę państwa (autouzupełnianie), jedna odpowiedź na flagę lub „Nie wiem”; kategorie: Świat, Europa, Azja, Afryka, Ameryka Pn., Ameryka Pd., Oceania – każda z własną zagadką dnia i statystykami; zaliczenie od 7/10 | „pawilon”: flaga jako bohater na miękkiej scenie, królewski błękit (Outfit) |
| **Kronika** | 7 wydarzeń historycznych dziennie (po jednym z każdej z 7 epok), wpisz rok; 100 pkt za dokładną datę, minus 2 pkt za rok różnicy (1 pkt przed 1500 r., 0,5 pkt p.n.e.); każdy punkt to 10 km drogi podróżnika, maks. 7000 km, wyprawa udana od 3500 km | dziennik podróży: papier, turkusowa trasa z wędrowcem, pomarańczowe stemple dat (Fraunces + IBM Plex) |
| **Oko** | 4 próby percepcji dziennie: Liczenie (kropki widoczne 2 s, podaj liczbę), Kąt (ustaw ramię pod podanym kątem), Podział (zaznacz ułamek odcinka od wskazanego końca), Tor (kula odbija się od ścian i znika w locie – wskaż miejsce lądowania); każda próba 0–100 pkt, wynik to średnia, oceny S/A/B/C/D/F (F = porażka); bodźce z Liczenia i Toru pokazywane tylko raz | karta optyka: papierowa biel, czarny tusz, sygnałowa czerwień i kobaltowe odpowiedzi (IBM Plex Mono + IBM Plex Sans) |

## Synchronizacja między urządzeniami (GitHub)

Działa tak samo jak w aplikacji Budżet: dane trafiają do **prywatnego** repozytorium na Twoim koncie GitHub (jeden plik `gamehub-dane.json`), bez serwera pośredniego. Można użyć tego samego repozytorium i tokena co w Budżecie, bo plik jest osobny.

1. Na github.com utwórz prywatne repozytorium (np. `gry-dane`, z plikiem README) albo użyj repozytorium z Budżetu.
2. Na <https://github.com/settings/personal-access-tokens/new>: *Repository access → Only select repositories* → to repo → *Permissions → Contents: Read and write* → *Generate token*.
3. W grze: **ikona zębatki w rogu → Synchronizacja między urządzeniami** → `login/repo` i token → *Połącz i synchronizuj*. To samo na drugim urządzeniu.

Synchronizacja uruchamia się sama: po każdej rozegranej zagadce (z kilkusekundowym opóźnieniem), przy otwarciu aplikacji, po powrocie do karty i po powrocie internetu. Kropka na zębatce pokazuje stan (zielona = OK, pulsuje = trwa, czerwona = błąd).

**Co się synchronizuje:** wyniki dzienne (historia dzień po dniu, z niej liczone są statystyki i serie), dzisiejsze zagadki dzienne (rozpoczęte i ukończone, więc ukończona na telefonie jest zablokowana także na komputerze) oraz liczniki trybu bez limitu (osobno dla każdego urządzenia, potem sumowane). **Nie synchronizują się:** token, motyw, język, wysoki kontrast i bieżąca rozgrywka bez limitu.

**Scalanie:** ten sam dzień rozegrany na dwóch urządzeniach liczy się raz (wygrywa wcześniejszy zapis). Dla dzisiejszej zagadki wygrywa ukończona, a jeśli obie są nieukończone, to ostatnio grana. Wyniki sprzed wprowadzenia historii są zachowane jako „baza” i nie sumują się między urządzeniami, bo bierze się bazę z urządzenia, na którym rozegrano więcej gier.

## Uruchomienie

```bash
npm install
npm run dev          # serwer deweloperski
npm test             # testy jednostkowe (Vitest)
npm run build        # typecheck + build produkcyjny (dist/, z service workerem)
npm run preview      # podgląd buildu na http://localhost:4173
```

Test end-to-end (Playwright, wygrana i przegrana w obu trybach dla każdej gry):

```bash
npm run build && npx vite preview --port 4173 &
node e2e/play.mjs http://localhost:4173/
```

Dane są już wygenerowane i zapisane w repozytorium (`public/data/`, `src/data/`, `src/games/*/…json`). Odtworzenie ich od zera:

```bash
npm run data:fetch   # pobiera surowe zbiory do data-raw/ (nie commitowane)
npm run data:build   # buduje pliki gry
node scripts/refresh-depth.mjs   # składa pulę Głębi z zatwierdzonego depth.json + kategorii ręcznych (bez data-raw/)
node scripts/build-flags.mjs     # pula Flag + kopiowanie SVG z flag-icons do public/data/flags/
```

## Architektura

- **React 18 + TypeScript + Vite**, hash‑router (`#/slowko`, `#/slowko/unlimited`), każda gra ładowana leniwie.
- `src/core/` – silnik dzienny i stan:
  - `date.ts` – klucz daty **lokalnej** gracza (`YYYY-MM-DD`), numer dnia liczony z pól kalendarza (odporny na DST/strefy), czas do północy.
  - `daily.ts` – pula zagadek tasowana seedowanym Fisher–Yatesem (mulberry32 + cyrb53) raz na „cykl” (tyle dni, ile zagadek w puli); ziarno = id gry + numer cyklu. Ta sama data → ta sama zagadka u wszystkich; brak powtórek do wyczerpania puli; pierwsza zagadka cyklu nie powtarza ostatniej z poprzedniego. Unlimited losuje z puli z wyłączeniem dzisiejszej zagadki dziennej.
  - `session.ts` – hook `useGameSession`: wczytuje/zapisuje stan w `localStorage`, blokuje dzienny wynik po ukończeniu (do północy), odświeża się o północy i po powrocie do karty, zapisuje statystyki dokładnie raz.
  - `stats.ts` – rozegrane, % wygranych, seria (kolejne dni z wygraną), najdłuższa seria, rozkład; unlimited liczony osobno i nie wpływa na serię.
  - `i18n.tsx` – PL (domyślnie) / EN, przełącznik w ustawieniach.
- `src/components/` – wspólne `GameShell`, `Modal`, `StatsPanel`, `ShareButton`, `Countdown`, `CountryInput` (autouzupełnianie), ikony SVG. Komponenty czytają wyłącznie zmienne CSS, więc dziedziczą motyw gry.
- `src/styles/themes.css` – tokeny motywu każdej gry w wariancie jasnym i ciemnym (`[data-theme='light'|'dark']` na `<html>`, ustawiane przed pierwszym renderem, domyślnie wg systemu) + wariant **wysokiego kontrastu** (`[data-contrast='high']`) dla obu. Kolor nigdy nie jest jedynym nośnikiem informacji: kafelki Słówka mają kreskę/kropkę, Kontur i Epoka podają liczby i strzałki, Globus listę z odległościami, Głębia liczby rzadkości.
- PWA: `vite-plugin-pwa` (manifest, service worker, precache aplikacji i fontów, cache danych w trybie stale‑while‑revalidate).

## Źródła danych i licencje

| Zbiór | Użycie | Licencja |
| --- | --- | --- |
| [Natural Earth](https://www.naturalearthdata.com/) v5 (przez `nvkelso/natural-earth-vector`): Admin‑0 1:50m, populated places, Admin‑1, marine polys, geography regions, elevation points, lakes, rivers 1:10m | geometrie i nazwy PL/EN krajów (Globus, Kontur), kategorie Głębi | **domena publiczna** |
| [dictionary-pl](https://github.com/wooorm/dictionaries) (słownik Hunspell z projektu sjp.pl / OpenOffice.org PL, 2008) | lista dozwolonych prób Słówka (wszystkie 5‑literowe formy fleksyjne; ~26,7 tys.) i rozpoznawanie rzeczowników | GPL / LGPL / MPL (do wyboru), wg pakietu: `GPL-3.0 OR LGPL-3.0 OR MPL-2.0` |
| [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (H. Dave, OpenSubtitles 2018, `pl_50k`) | wybór popularnych haseł Słówka (680 rzeczowników po ręcznym odfiltrowaniu wulgaryzmów, imion, form nie‑mianownikowych – `scripts/words-exclude.txt`) | treść **CC BY‑SA 4.0**, kod MIT |
| [historical-basemaps](https://github.com/aourednik/historical-basemaps) (A. Ourednik) | mapy polityczne Epoki (lata 100–2010) | **GPL‑3.0** |
| [flag-icons](https://github.com/lipis/flag-icons) | flagi państw (SVG 4:3) w grze Flagi | **MIT** |
| [i18n-iso-countries](https://github.com/michaelwittig/node-i18n-iso-countries) | mapowanie kodów ISO alpha‑3 → alpha‑2 przy budowaniu puli flag | **MIT** |
| Kategorie ręczne Głębi (`scripts/depth/curated.mjs`) i wydarzenia Kroniki (`src/games/kronika/events.ts`) | władcy, prezydenci, gwiazdozbiory, księgi Biblii, sztuki Szekspira, sport itd.; ~420 wydarzeń z datami | zestawione ręcznie z faktów powszechnie znanych (zbiory zamknięte, daty ustalone) |
| [Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON) | pierwiastki: nazwy EN, symbole, okresy, kategorie (Głębia) | **CC BY‑SA 3.0** |
| Polskie nazwy pierwiastków (`scripts/depth/elements-pl.json`) i polskie egzonimy rzek (`scripts/depth/rivers-pl.json`) | aliasy PL w Głębi | zestawione ręcznie według standardowej polskiej nomenklatury (to tłumaczenia nazw, nie nowe dane) |
| Fonty: Archivo, Archivo Black, Space Grotesk, Barlow Condensed, Chakra Petch, Old Standard TT, Cinzel, IBM Plex Sans/Mono, Outfit, Fraunces (przez Fontsource, hostowane lokalnie) | typografia | **SIL OFL 1.1** |

Biblioteki: React (MIT), d3-geo / topojson-client / topojson-server / topojson-simplify (ISC), vite-plugin-pwa / Workbox (MIT).

Ponieważ aplikacja zawiera dane na licencji GPL‑3.0 (historical-basemaps, słownik), cały projekt jest udostępniony na licencji **GPL‑3.0‑or‑later**; pliki danych pochodzące z CC BY‑SA zachowują swoją licencję (uznanie autorstwa powyżej).

## Decyzje projektowe i ograniczenia

- **Głębia – rzadkość.** Wikidata, Wikipedia i sjp.pl były niedostępne z sieci środowiska budowania, a danych o odpowiedziach graczy nie ma. Rzadkość 1–100 to więc **ranga obiektywnej miary w obrębie kategorii** (odpowiedź najbardziej „oczywista” = 1, najmniej = 100): populacja (kraje, stolice, stany USA), suma ludności miast z Natural Earth leżących w regionie (jednostki administracyjne), powierzchnia (wyspy, jeziora, duże państwa), ranga kartograficzna Natural Earth (morza, pustynie, pasma, rzeki), wysokość (szczyty), liczba atomowa (pierwiastki). Miara jest podana w danych każdej kategorii (`metric`).
- **Głębia – kategorie.** 49 kategorii, każda ≥ 30 odpowiedzi (łącznie ~2700), wyłącznie zbiory zamknięte. Geografia ograniczona do 22 kategorii (usunięte jednostki administracyjne innych państw – zostały tylko stany USA; dodane miasta Polski), a każde nurkowanie ma najwyżej 2 polecenia geograficzne (grupy: geografia, nauka, historia, kultura, sport, polityka – `GROUP_CAP` w `logic.ts`). Nowe kategorie ręczne: władcy Polski, prezydenci USA, monarchowie Anglii, cesarze rzymscy, królowie Francji, gwiazdozbiory, liczby pierwsze, ciąg Fibonacciego, jednostki SI, księgi Biblii, sztuki Szekspira, instrumenty orkiestry, dyscypliny Paryż 2024, gospodarze igrzysk, lata igrzysk, mistrzowie F1, Złota Piłka, Wimbledon, NATO, monarchie, ruch lewostronny. Rzadkość w kategoriach ręcznych to ranga redakcyjna „oczywistości” (lub obiektywna miara, gdy podana); liczby i lata dopasowywane są wyłącznie dokładnie. Kategorie geograficzne oparte na Natural Earth mają dopisek „wg Natural Earth” – akceptowane są obiekty obecne w tym zbiorze. Kraje transkontynentalne (np. Turcja w „Europie”) są akceptowane jako odpowiedzi dodatkowe z rzadkością 100. Dopasowanie: normalizacja (wielkość liter, diakrytyki, „ł”), aliasy PL/EN i nazwy lokalne, tolerancja literówek (Damerau‑Levenshtein: 1 dla 4–6 znaków, 2 dla dłuższych).
- **Głębia – wygrana/przegrana.** Ukończenie 7 poleceń = wygrana (wynik to głębokość); trzy odpowiedzi spoza kategorii (utrata 3 butli tlenu) = przegrana. Pominięcie polecenia daje 0 pkt.
- **Epoka – mapa.** Część wielokątów w zbiorze ma odwróconą orientację pierścieni, przez co d3 rysował je jako „cały świat minus kraj” (zasłaniały inne państwa). Są odwracane przy wczytaniu. Państwa sąsiadujące (wg topologii) dostają różne kolory z 8-kolorowej palety (kolorowanie zachłanne, części jednego państwa mają wspólny kolor), a ludy i kultury bez państwa są neutralne. Nazwa stoi w „biegunie niedostępności” głównej części państwa (polylabel). Na widoku świata widać kilkanaście największych nazw, po przybliżeniu (przyciski, kółko myszy, szczypanie) wszystkie, które się nie nakładają. Dotknięcie państwa pokazuje jego nazwę. Przesuwanie nie przerysowuje mapy w React, a obramowania mają stałą grubość (`vector-effect`).
- **Głębia – zanurzanie.** Po każdej odpowiedzi zamiast pytania pojawia się scena schodzenia: warstwy wody przesuwają się w górę, licznik głębokości rośnie od starej do nowej wartości, tło ciemnieje. Czas zależy od zdobytych metrów (ok. 1–2,3 s), dopiero potem pokazuje się następne polecenie.
- **Epoka – zakres ważności.** Zbiór zawiera migawki (np. 1914, 1920); mapa z roku *Y* jest uznawana za aktualną od *Y* do roku przed następną migawką. Kolejne migawki o praktycznie identycznym zestawie państw (2000 i 2010) są łączone. Migawka 1492 (1307 drobnych obiektów) służy tylko do wyznaczania zakresów, nie jest zagadką. Wskazówki „po czym poznać datę” są liczone automatycznie (państwa obecne na mapie, a nieobecne na sąsiedniej; z tolerancją na trywialne zmiany nazw) – zbiór bywa niekonsekwentny w nazewnictwie, co jest zaznaczone w grze.
- **Oko** – mechanika inspirowana grą Perceptle (bez próby rytmu „Tempo”). Parametry prób generowane deterministycznie z numeru zagadki (`oko:<n>`), więc każdy dostaje tę samą dzienną planszę. Punktacja: liczenie – błąd względny (50 % = 0 pkt), kąt – 36° = 0 pkt, podział – ćwierć odcinka = 0 pkt, tor – ćwierć szerokości planszy = 0 pkt.
- **Kronika** – pula wydarzeń jest sortowana po roku i dzielona na 7 równych epok; runda bierze po jednym wydarzeniu z każdej epoki (osobna seedowana permutacja na epokę), więc przez ~60 dni nic się nie powtarza, a każdy dzień obejmuje od starożytności do współczesności. Różnica lat liczona bez roku 0.
- **Flagi** – pula: 193 państwa ONZ + Watykan, Palestyna, Kosowo, Tajwan; kontynent wg Natural Earth (Malediwy → Azja, Mauritius i Seszele → Afryka). Każda kategoria ma osobny klucz sesji i statystyk (`flagi-europe:stats` itd.; „Świat” = `flagi:stats`, widoczny w hubie).
- **Globus** – odległość = najmniejsza odległość po kole wielkim między wierzchołkami uproszczonych granic; kraje mające wspólną granicę (topologia TopoJSON) = 0 km. Można się poddać (liczy się jako przegrana).
- **Kontur** – odległość i kierunek między punktami etykiet Natural Earth (leżą wewnątrz głównej części kraju, więc np. Francja nie „przesuwa się” przez Gujanę); pula: kraje i terytoria ≥ 2000 km².
- **Słówko** – słownik z 2008 r., więc część najnowszych słów może nie być rozpoznawana; hasła wyłącznie z listy przeglądniętej ręcznie.
- Dane administracyjne Natural Earth odzwierciedlają stan z wersji 5 (np. 110 prowincji Włoch, Meksyk z „Distrito Federal”).

## Publikacja na GitHub Pages

Workflow `.github/workflows/deploy.yml` buduje i publikuje grę przy każdym pushu do `main`
(albo ręcznie: Actions → „Deploy to GitHub Pages” → Run workflow). Jednorazowo trzeba włączyć
Pages: Settings → Pages → Build and deployment → Source: **GitHub Actions**.
Gra będzie pod adresem `https://<użytkownik>.github.io/<repozytorium>/`.
