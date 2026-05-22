## OZC-cal - MVP

### Główny problem

Programy liczące zapotrzebowanie na ciepło są kosztowne i oferują duzo funkcjonalnosci, ktore zwiekszaja bariere wejscia w obliczenia ciepla budynku. Zalozeniem aplikacji jest prosty interfejs, ktory pozwoli zdefiniowac przeplywy ciepla, przegrody konstrukcji ze zdefiniowanymi materialami oraz naniesienie na plik graficzny warstw, ktore utworzą pomieszczenia w efekcie pozwalając na obliczenie strat ciepla budynku. Aplikacja ma posiadac edytor graficzny z przeniesionym rzutem kondygnacji, udostepniajac mozliwosc nanoszenia scian, otworów, drzwi, okien, stropów, gruntu, posadzki, dachu itd. tworząc sekcje pomieszczeń z okresloną temperaturą wewnętrzną.

### Najmniejszy zestaw funkcjonalności

- Autoryzacja uzytkownika oraz tworzenie projektu, podajac nazwe projektu oraz rzut
- Definiowanie strefy klimatycznej i temperatury zewnętrznej dla obliczanego obiektu
- Definiowanie przegród budynku
- Definiowanie powietrza grawitacyjnego, jako nawiewane i wywiewane oraz naturalne, z podzialem na pomieszczenia
- Edytor graficzny pozwalajacy na import pliku PDF rzutu kondygnacji i nanoszenie warstw ze zdefiniowana przegroda
- Rysowanie warstw pozwala na tryb ortogonalny oraz laczenie sie początków oraz koncowek warstw, aby tworzyc zamkniete strefy, jako pomieszczenia
- Utworzenie koncowego raportu obliczeniowego ze stratami na cieplo oraz wentylacje

### Co NIE wchodzi w zakres MVP

- Wspóldzielenie projektu miedzy kilkoma kontami
- Import wielu formatów (.dwg, .dxf)
- Integracje z innymi platformami obliczeniowymi
- Obliczenia wielokondygnacyjne budynkow
- Obliczenia uwzgledniajace wentylacje mechaniczną oraz nawiewno-wywiewną
- Generowanie charakterystyki energetycznej budynku
- Tworzenie obiektu 3D na podstawie naniesionych warstw na rzut
- Aplikacja mobilna

### Kryteria sukcesu

- Uzytkownik po zdefiniowaniu wymaganych warstw i wykresleniu obiektu otrzymuje prawidlowe obliczenia zapotrzebowania na cieplo oraz wentylacje
