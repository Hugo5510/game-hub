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
- [ ] PWA (manifest, service worker, ikony)

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

## Weryfikacja
- [ ] build bez błędów
- [x] testy jednostkowe
- [ ] wygrana/przegrana w obu trybach dla każdej gry (e2e Playwright)
- [ ] 360 px i desktop (zrzuty)
- [ ] README: licencje danych, uruchomienie
