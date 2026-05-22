---
project: OZC-cal
version: 1
status: draft
created: 2026-05-19
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Programy liczące zapotrzebowanie na ciepło są kosztowne i oferują dużo funkcjonalności, które zwiększają barierę wejścia w obliczenia ciepła budynku. Założeniem aplikacji jest prosty interfejs, który pozwoli zdefiniować przepływy ciepła, przegrody konstrukcji ze zdefiniowanymi materiałami oraz naniesienie na plik graficzny warstw, które utworzą pomieszczenia — w efekcie pozwalając na obliczenie strat ciepła budynku. Aplikacja ma posiadać edytor graficzny z przeniesionym rzutem kondygnacji, umożliwiając nanoszenie ścian, otworów, drzwi, okien, stropów, gruntu, posadzki, dachu itd., tworząc sekcje pomieszczeń z określoną temperaturą wewnętrzną.

Cena i prostota interfejsu mają być przewagą nad narzędziami rynkowymi oferującymi „wszystko w jednym”, dla użytkownika, którego celem jest obliczenie OZC na podstawie rzutu — bez pełnego stosu CAD/BIM.

## User & Persona

**Primary persona:** Pojedynczy wykonawca — projektant instalacji grzewczych lub audytor energetyczny pracujący sam nad projektem (MVP bez współdzielenia między kontami).

**Kontekst:** Moment, w którym musi policzyć zapotrzebowanie na ciepło i wentylację dla budynku na podstawie rzutu kondygnacji, definiując przegrody, strefy pomieszczeń i parametry klimatyczne — bez wdrażania ciężkiego, drogiego oprogramowania obliczeniowego.

**Koszt dziś:** Drogi, przeładowany funkcjami program obliczeniowy lub rozdzielony workflow (rzut poza narzędziem obliczeniowym), wysoka bariera przed pierwszym sensownym wynikiem.

## Success Criteria

### Primary

Użytkownik przechodzi end-to-end flow:

1. Rejestruje się / loguje (minimalna auth).
2. Tworzy projekt (nazwa; rzut dodawany później przy imporcie PDF w edytorze).
3. Definiuje strefę klimatyczną i temperaturę zewnętrzną obiektu.
4. Definiuje przegrody budynku (materiały).
5. Definiuje powietrze grawitacyjne (nawiewane, wywiewane, naturalne) z podziałem na pomieszczenia.
6. W edytorze graficznym importuje PDF rzutu kondygnacji i nanosi warstwy ze zdefiniowaną przegrodą (ściany, otwory, drzwi, okna, strop, grunt, posadzka, dach itd.).
7. Rysuje w trybie ortogonalnym, łączy początki i końce warstw w zamknięte strefy — pomieszczenia z temperaturą wewnętrzną.
8. Uruchamia obliczenia i widzi na ekranie straty na ciepło oraz wentylację zgodne z oczekiwaniem inżynierskim (bez formalnego dokumentu raportu w v1).

### Secondary

- Użytkownik może wrócić do zapisanego projektu i kontynuować edycję w kolejnej sesji.

### Guardrails

- Wynik OZC i wentylacji musi być inżyniersko poprawny względem **WT 2021** (współczynniki przenikania ciepła, straty przez przegrody) oraz oczekiwań użytkownika w zakresie uproszczonego modelu wentylacji grawitacyjnej per pomieszczenie zdefiniowanego w MVP.
- Edytor na typowym PDF rzutu musi pozostać używalny (czytelność, skala pracy na planie).
- Projekty użytkownika niewidoczne dla innych kont (prywatność danych projektu).

## User Stories

### US-01: Pierwsze obliczenie OZC na rzucie PDF

- **Given** zalogowany użytkownik z nowym projektem i zaimportowanym PDF rzutu kondygnacji
- **When** definiuje strefę klimatyczną, przegrody, wentylację grawitacyjną per pomieszczenie, nanosi warstwy w edytorze tworząc zamknięte pomieszczenia z temperaturą wewnętrzną i uruchamia obliczenie
- **Then** widzi na ekranie straty cieplne i wentylację uznane za inżyniersko poprawne względem jego oczekiwań

## Functional Requirements

### Authentication & projects

- FR-001: Użytkownik może zarejestrować konto i zalogować się adresem e-mail i hasłem. Priority: must-have
  > Socrates: Brak mocnego kontrargumentu — auth wymagane w MVP; minimalna auth bez resetu/weryfikacji e-mail.
- FR-002: Użytkownik może utworzyć projekt podając nazwę projektu (rzut dodawany później w edytorze, nie przy tworzeniu). Priority: must-have
  > Socrates: Kontrargument: wymaganie rzutu przy tworzeniu projektu duplikuje import PDF w edytorze. Resolution: projekt startuje od nazwy; PDF importowany w FR-007.
- FR-003: Użytkownik może wrócić do zapisanego projektu i kontynuować pracę. Priority: must-have
  > Socrates: Powrót do projektu wspiera Secondary (kontynuacja sesji); bez trwałości produkt nie dowozi wartości po pierwszym wieczorze pracy.

### Parametry budynku

- FR-004: Użytkownik może zdefiniować strefę klimatyczną i temperaturę zewnętrzną dla obliczanego obiektu. Priority: must-have
  > Socrates: Bez parametrów klimatycznych wynik OZC nie ma sensu inżynierskiego — zostaje.
- FR-005: Użytkownik może zdefiniować przegrody budynku (konstrukcje z materiałami). Priority: must-have
  > Socrates: Przegrody są wejściem do strat przez przenikanie — rdzeń domeny, zostaje.
- FR-006: Użytkownik może zdefiniować powietrze grawitacyjne (nawiewane, wywiewane, naturalne) z podziałem na pomieszczenia. Priority: must-have
  > Socrates: Wentylacja per pomieszczenie jest w notatkach MVP — zostaje mimo kosztu UX.

### Edytor graficzny

- FR-007: Użytkownik może w edytorze graficznym zaimportować plik PDF rzutu kondygnacji i nanosić warstwy ze zdefiniowaną przegrodą. Priority: must-have
  > Socrates: Import PDF to wyróżnik vs „kolejny formularz OZC” — zostaje.
- FR-008: Użytkownik może rysować warstwy w trybie ortogonalnym i łączyć początki oraz końce warstw, tworząc zamknięte strefy jako pomieszczenia z temperaturą wewnętrzną. Priority: must-have
  > Socrates: Ortogonalność i zamknięte strefy redukują błędy geometryczne — zostaje w MVP.

### Obliczenia i wynik

- FR-009: Użytkownik może uruchomić obliczenie i zobaczyć na ekranie wynik strat na ciepło oraz wentylacji (bez formalnego dokumentu raportu w v1). Priority: must-have
  > Socrates: Kontrargument: pełny raport dokumentowy to osobny produkt (PDF, szablony). Resolution: v1 — wynik na ekranie; formalny raport poza MVP lub później.

## Non-Functional Requirements

- Dla tego samego zestawu danych projektu (przegrody, geometria, klimat, wentylacja) użytkownik otrzymuje ten sam wynik obliczenia przy ponownym uruchomieniu.
- Dane projektu są dostępne wyłącznie dla zalogowanego właściciela konta, który je utworzył (zgodnie z guardrails).

## Business Logic

Aplikacja oblicza stratę ciepła budynku i zapotrzebowanie wentylacyjne z geometrycznych stref pomieszczeń na rzucie, zdefiniowanych przegród, parametrów klimatycznych oraz wentylacji grawitacyjnej per pomieszczenie.

Wejścia użytkownika: strefa klimatyczna i temperatura zewnętrzna; katalog przegród z materiałami; parametry wentylacji grawitacyjnej per pomieszczenie; geometria i typ przegród nanoszone na rzut (warstwy tworzące zamknięte pomieszczenia z temperaturą wewnętrzną).

Wyjście: wartości strat ciepła i wentylacji prezentowane na ekranie po zakończeniu obliczenia.

Użytkownik spotyka regułę na końcu flow MVP — po zdefiniowaniu warstw i pomieszczeń uruchamia obliczenie i weryfikuje wynik względem oczekiwań inżynierskich.

## Access Control

Logowanie: e-mail + hasło. Rejestracja konta użytkownika.

Model dostępu: płaski — jeden typ użytkownika; każdy użytkownik jest właścicielem własnych projektów. Brak ról admin/członek/gość w MVP. Brak współdzielenia projektu między kontami.

MVP auth (zawężenie v1): rejestracja i logowanie e-mail + hasło bez resetu hasła i bez weryfikacji adresu e-mail.

## Non-Goals

- Współdzielenie projektu między kilkoma kontami — MVP jest single-tenant per użytkownik.
- Import wielu formatów (.dwg, .dxf) — tylko PDF rzutu w edytorze na v1.
- Integracje z innymi platformami obliczeniowymi — brak eksportu/importu do zewnętrznych narzędzi OZC.
- Obliczenia wielokondygnacyjne budynków — jedna kondygnacja / jeden rzut na projekt w MVP.
- Obliczenia z wentylacją mechaniczną oraz nawiewno-wywiewną — tylko wentylacja grawitacyjna per pomieszczenie.
- Generowanie charakterystyki energetycznej budynku — poza zakresem v1.
- Tworzenie obiektu 3D na podstawie warstw na rzucie — tylko obliczenia na rzucie 2D.
- Aplikacja mobilna — tylko web desktop w MVP.
- Formalny dokument raportu (PDF/druk) w v1 — wynik obliczeń na ekranie; raport dokumentowy później.

## Open Questions

Brak otwartych pytań — rozstrzygnięte 2026-05-19:

- `target_scale.qps`: **low**
- `target_scale.data_volume`: **small**
- Norma obliczeń: **WT 2021** (straty przez przegrody); wentylacja grawitacyjna per pomieszczenie — model uproszczony zdefiniowany w FR-006, bez wentylacji mechanicznej (Non-Goals).
- Primary flow krok 2 ujednolicony z FR-002 / FR-007 (projekt od nazwy; rzut w edytorze).
