# TODO — Game Hub

## Szkielet
- [x] Vite + React + TS, konfiguracja, Vitest
- [x] Silnik dzienny (data lokalna, seedowane tasowanie, cykle bez powtórek)
- [x] Testy silnika (ta sama data, zmiana o północy, brak powtórek, unlimited ≠ daily)
- [x] Storage (localStorage), statystyki, seria, blokada do północy, odliczanie
- [x] Wspólne komponenty: Modal, Statystyki, Udostępnianie (emoji, bez spoilerów)
- [x] i18n PL (domyślnie) / EN
- [x] Hub (neutralny), karty gier o własnym charakterze
- [x] Motywy CSS per gra + tryb wysokiego kontrastu
- [x] PWA (manifest, service worker, ikony)

## Dane
- [x] Natural Earth: kraje 50m → topojson + metadane PL/EN
- [x] Słownik: dictionary-pl (sjp.pl) → dozwolone próby; FrequencyWords → hasła
- [x] historical-basemaps → uproszczone mapy Epoki + podpowiedzi
- [x] Głębia: ≥60 kategorii × ≥30 odpowiedzi z wagami 1–100

## Gry
- [x] Słówko
- [x] Kontur
- [x] Globus
- [x] Głębia
- [x] Epoka
- [x] Flagi (kategorie: świat + kontynenty)
- [x] Kronika (7 wydarzeń dziennie, podróżnik)

## Zmiany v2
- [x] Motyw jasny / ciemny / systemowy (+ wysoki kontrast w obu)
- [x] Globus: odgadnięty kraj na zielono
- [x] Słówko: komunikat wygranej i okno statystyk jak w Wordle; naprawione samoczynne otwieranie okna wyniku we wszystkich grach
- [x] Głębia: mniej geografii (bez prowincji/stanów poza USA i Polską), nowe kategorie, maks. 2 geograficzne na nurkowanie
- [x] Epoka: tylko wcześniej/później, bez odległości w latach

## Weryfikacja
- [x] build bez błędów
- [x] testy jednostkowe
- [x] wygrana/przegrana w obu trybach dla każdej gry (e2e Playwright)
- [x] 360 px i desktop (zrzuty)
- [x] README: licencje danych, uruchomienie

## Uwagi / ograniczenia (opisane w README)
- Wikidata, Wikipedia i sjp.pl zablokowane przez sieć środowiska → rzadkość w Głębi z obiektywnych metryk danych, nie z częstości odpowiedzi graczy.
- Słówko w trybie EN nadal używa polskich haseł (gra słowna w języku polskim); EN tłumaczy interfejs.
- Wskazówki Epoki liczone automatycznie; zbiór historical-basemaps bywa niekonsekwentny w nazewnictwie.
