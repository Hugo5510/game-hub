# Game Hub

Przeglądarkowy hub z pięcioma codziennymi zagadkami (PL, z opcją EN). Bez backendu, działa offline jako PWA.

| Gra | Mechanika | Charakter wizualny |
| --- | --- | --- |
| **Słówko** | polskie słowo z 5 liter, 6 prób, oznaczenia trafiona / w złym miejscu / nieobecna, klawiatura z polskimi znakami | mocny grotesk (Archivo Black), płaskie kafelki z animacją obrotu |
| **Globus** | tajny kraj, bez limitu prób; każdy wpisany kraj koloruje się na obracanym globusie 3D tym mocniej, im bliżej (odległość granica–granica) | ciemny kosmos, skala ciepła od bladej do głębokiej czerwieni (Space Grotesk) |
| **Kontur** | sylwetka kraju, 6 prób; po każdej odległość w km, strzałka kierunku i % bliskości | styl kartograficzny: tusz na siatce, róża wiatrów (Barlow Condensed + IBM Plex Mono) |
| **Głębia** | 7 poleceń „podaj…”; każda poprawna odpowiedź ma rzadkość 1–100 = punkty; 1 pkt = 10 m, maks. 700 pkt = 7000 m; 3 butle tlenu | tło ciemnieje z głębokością, głębokościomierz, bioluminescencja (Chakra Petch) |
| **Epoka** | polityczna mapa świata z przeszłości, zgadnij rok w 6 próbach; „wcześniej/później” + odległość w latach; poprawny cały okres ważności mapy; po rundzie wskazówki, po czym poznać datę | stary atlas, sepia, kartusz, oś czasu (Cinzel + Old Standard TT) |

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
- `src/styles/themes.css` – tokeny motywu każdej gry + wariant **wysokiego kontrastu** (`[data-contrast='high']`). Kolor nigdy nie jest jedynym nośnikiem informacji: kafelki Słówka mają kreskę/kropkę, Kontur i Epoka podają liczby i strzałki, Globus listę z odległościami, Głębia liczby rzadkości.
- PWA: `vite-plugin-pwa` (manifest, service worker, precache aplikacji i fontów, cache danych w trybie stale‑while‑revalidate).

## Źródła danych i licencje

| Zbiór | Użycie | Licencja |
| --- | --- | --- |
| [Natural Earth](https://www.naturalearthdata.com/) v5 (przez `nvkelso/natural-earth-vector`): Admin‑0 1:50m, populated places, Admin‑1, marine polys, geography regions, elevation points, lakes, rivers 1:10m | geometrie i nazwy PL/EN krajów (Globus, Kontur), kategorie Głębi | **domena publiczna** |
| [dictionary-pl](https://github.com/wooorm/dictionaries) (słownik Hunspell z projektu sjp.pl / OpenOffice.org PL, 2008) | lista dozwolonych prób Słówka (wszystkie 5‑literowe formy fleksyjne; ~26,7 tys.) i rozpoznawanie rzeczowników | GPL / LGPL / MPL (do wyboru), wg pakietu: `GPL-3.0 OR LGPL-3.0 OR MPL-2.0` |
| [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (H. Dave, OpenSubtitles 2018, `pl_50k`) | wybór popularnych haseł Słówka (680 rzeczowników po ręcznym odfiltrowaniu wulgaryzmów, imion, form nie‑mianownikowych – `scripts/words-exclude.txt`) | treść **CC BY‑SA 4.0**, kod MIT |
| [historical-basemaps](https://github.com/aourednik/historical-basemaps) (A. Ourednik) | mapy polityczne Epoki (lata 100–2010) | **GPL‑3.0** |
| [Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON) | pierwiastki: nazwy EN, symbole, okresy, kategorie (Głębia) | **CC BY‑SA 3.0** |
| Polskie nazwy pierwiastków (`scripts/depth/elements-pl.json`) i polskie egzonimy rzek (`scripts/depth/rivers-pl.json`) | aliasy PL w Głębi | zestawione ręcznie według standardowej polskiej nomenklatury (to tłumaczenia nazw, nie nowe dane) |
| Fonty: Archivo, Archivo Black, Space Grotesk, Barlow Condensed, Chakra Petch, Old Standard TT, Cinzel, IBM Plex Sans/Mono (przez Fontsource, hostowane lokalnie) | typografia | **SIL OFL 1.1** |

Biblioteki: React (MIT), d3-geo / topojson-client / topojson-server / topojson-simplify (ISC), vite-plugin-pwa / Workbox (MIT).

Ponieważ aplikacja zawiera dane na licencji GPL‑3.0 (historical-basemaps, słownik), cały projekt jest udostępniony na licencji **GPL‑3.0‑or‑later**; pliki danych pochodzące z CC BY‑SA zachowują swoją licencję (uznanie autorstwa powyżej).

## Decyzje projektowe i ograniczenia

- **Głębia – rzadkość.** Wikidata, Wikipedia i sjp.pl były niedostępne z sieci środowiska budowania, a danych o odpowiedziach graczy nie ma. Rzadkość 1–100 to więc **ranga obiektywnej miary w obrębie kategorii** (odpowiedź najbardziej „oczywista” = 1, najmniej = 100): populacja (kraje, stolice, stany USA), suma ludności miast z Natural Earth leżących w regionie (jednostki administracyjne), powierzchnia (wyspy, jeziora, duże państwa), ranga kartograficzna Natural Earth (morza, pustynie, pasma, rzeki), wysokość (szczyty), liczba atomowa (pierwiastki). Miara jest podana w danych każdej kategorii (`metric`).
- **Głębia – kategorie.** 65 kategorii, każda ≥ 30 odpowiedzi (łącznie ~3800), wyłącznie zbiory zamknięte i sprawdzalne w danym źródle. Kategorie geograficzne oparte na Natural Earth mają dopisek „wg Natural Earth” – akceptowane są obiekty obecne w tym zbiorze. Kraje transkontynentalne (np. Turcja w „Europie”) są akceptowane jako odpowiedzi dodatkowe z rzadkością 100. Dopasowanie: normalizacja (wielkość liter, diakrytyki, „ł”), aliasy PL/EN i nazwy lokalne, tolerancja literówek (Damerau‑Levenshtein: 1 dla 4–6 znaków, 2 dla dłuższych).
- **Głębia – wygrana/przegrana.** Ukończenie 7 poleceń = wygrana (wynik to głębokość); trzy odpowiedzi spoza kategorii (utrata 3 butli tlenu) = przegrana. Pominięcie polecenia daje 0 pkt.
- **Epoka – zakres ważności.** Zbiór zawiera migawki (np. 1914, 1920); mapa z roku *Y* jest uznawana za aktualną od *Y* do roku przed następną migawką. Kolejne migawki o praktycznie identycznym zestawie państw (2000 i 2010) są łączone. Migawka 1492 (1307 drobnych obiektów) służy tylko do wyznaczania zakresów, nie jest zagadką. Wskazówki „po czym poznać datę” są liczone automatycznie (państwa obecne na mapie, a nieobecne na sąsiedniej; z tolerancją na trywialne zmiany nazw) – zbiór bywa niekonsekwentny w nazewnictwie, co jest zaznaczone w grze.
- **Globus** – odległość = najmniejsza odległość po kole wielkim między wierzchołkami uproszczonych granic; kraje mające wspólną granicę (topologia TopoJSON) = 0 km. Można się poddać (liczy się jako przegrana).
- **Kontur** – odległość i kierunek między punktami etykiet Natural Earth (leżą wewnątrz głównej części kraju, więc np. Francja nie „przesuwa się” przez Gujanę); pula: kraje i terytoria ≥ 2000 km².
- **Słówko** – słownik z 2008 r., więc część najnowszych słów może nie być rozpoznawana; hasła wyłącznie z listy przeglądniętej ręcznie.
- Dane administracyjne Natural Earth odzwierciedlają stan z wersji 5 (np. 110 prowincji Włoch, Meksyk z „Distrito Federal”).
