---
project: OZC-cal
version: 1
status: draft
created: 2026-05-27
updated: 2026-05-27
prd_version: 1
main_goal: market-feedback
top_blocker: skills
---

# Roadmap: OZC-cal

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Programy OZC są drogie i przeładowane funkcjami, co podnosi barierę wejścia dla projektanta instalacji lub audytora energetycznego, który chce policzyć zapotrzebowanie na ciepło z rzutu kondygnacji — bez pełnego stosu CAD/BIM. OZC-cal ma wygrać prostotą interfejsu i ceną: użytkownik definiuje przegrody, parametry klimatyczne i wentylację grawitacyjną, importuje PDF rzutu, nanosi warstwy tworząc pomieszczenia i uruchamia obliczenia ze stratami cieplnymi zgodnymi z WT 2021.

## North star

**S-04: Pierwsze obliczenie OZC na rzucie PDF** — użytkownik uruchamia obliczenie i widzi straty cieplne oraz wentylację uznane za inżyniersko poprawne; to domyka US-01 i Primary Success Criteria produktu.

> Gwiazda przewodnia — najmniejszy kompletny przepływ end-to-end, którego udane dowiezienie potwierdza główną hipotezę produktu (prosty UI + PDF rzutu → sensowne OZC). Umieszczona tak wcześnie, jak pozwalają zależności: wymaga działającego edytora, parametrów budynku i silnika obliczeń.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | project-schema-rls | (foundation) trwały model projektu z RLS właściciela | — | Access Control, NFR | ready |
| F-02 | pdf-floor-plan-storage | (foundation) przechowywanie PDF rzutu w scope projektu | F-01 | FR-007, NFR | proposed |
| F-03 | wt2021-calculation-core | (foundation) deterministyczny silnik strat WT 2021 + wentylacji grawitacyjnej | F-01 | FR-009, NFR, Business Logic | proposed |
| S-01 | auth-and-project-lifecycle | zarejestrować się, zalogować, utworzyć projekt po nazwie i wrócić do niego | F-01 | FR-001, FR-002, FR-003 | proposed |
| S-02 | climate-and-assemblies | zdefiniować strefę klimatyczną, temperaturę zewnętrzną i przegrody z materiałami | S-01 | FR-004, FR-005 | proposed |
| S-03 | pdf-floor-plan-editor | zaimportować PDF, nanieść warstwy ortogonalnie, utworzyć pomieszczenia z temperaturą i wentylacją grawitacyjną | S-02, F-02 | FR-006, FR-007, FR-008 | proposed |
| S-04 | first-ozc-calculation | uruchomić obliczenie i zobaczyć straty cieplne oraz wentylację zgodne z oczekiwaniem inżynierskim | S-03, F-03 | FR-009, US-01 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Konto, parametry, edytor | `F-01` → `S-01` → `S-02` → `F-02` → `S-03` | Główna ścieżka must-have do geometrii rzutu; PDF to wyróżnik vs formularz OZC. |
| B | Silnik i wynik OZC | `F-03` → `S-04` | Równolegle z Stream A po `F-01`; dołącza Stream A w `S-04` (wymaga `S-03`); łagodzi blocker skills. |

## Baseline

What's already in place in the codebase as of `2026-05-27` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 islands, Tailwind 4, shadcn/ui (minimalnie); routing w `src/pages/`
- **Backend / API:** partial — tylko auth POST (`signin`/`signup`/`signout`); brak API domenowych i obliczeń
- **Data:** partial — Supabase client (auth only); brak migracji, schematu projektów, seedów
- **Auth:** partial — Supabase SSR + middleware; chroniony tylko `/dashboard`
- **Deploy / infra:** partial — Cloudflare Workers (`wrangler.jsonc`), CI lint/build; brak auto-deploy workflow
- **Observability:** partial — toggle Cloudflare w `wrangler.jsonc`; brak Sentry/logów w aplikacji

## Foundations

### F-01: Model projektu i RLS

- **Outcome:** (foundation) schemat projektu w bazie z polityką RLS — dane widoczne wyłącznie dla właściciela konta.
- **Change ID:** project-schema-rls
- **PRD refs:** Access Control, NFR (prywatność danych projektu)
- **Unlocks:** S-01, S-02, F-02, F-03
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez trwałości projektu FR-003 i cały flow US-01 nie mają sensu; sequencjonowane pierwsze, bo baseline raportuje data jako partial.
- **Status:** ready

### F-02: Przechowywanie PDF rzutu

- **Outcome:** (foundation) upload i odczyt pliku PDF rzutu kondygnacji w scope projektu właściciela.
- **Change ID:** pdf-floor-plan-storage
- **PRD refs:** FR-007, NFR (prywatność danych projektu)
- **Unlocks:** S-03
- **Prerequisites:** F-01
- **Parallel with:** S-01, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Import PDF to wyróżnik produktu; storage musi być gotowy zanim edytor zacznie pracę na pliku.
- **Status:** proposed

### F-03: Silnik obliczeń WT 2021

- **Outcome:** (foundation) deterministyczny moduł strat cieplnych przez przegrody (WT 2021) i uproszczonej wentylacji grawitacyjnej per pomieszczenie — ten sam input daje ten sam wynik.
- **Change ID:** wt2021-calculation-core
- **PRD refs:** FR-009, NFR (powtarzalność wyniku), Business Logic, Guardrails WT 2021
- **Unlocks:** S-04
- **Prerequisites:** F-01
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:**
  - Jaki dokładnie uproszczony model wentylacji grawitacyjnej per pomieszczenie (współczynniki, strumienie powietrza)? — Owner: user. Block: no.
- **Risk:** Najwyższe ryzyko domenowe (#1 blocker: skills); wydzielone od UI, żeby weryfikować poprawność inżynierską równolegle z edytorem.
- **Status:** proposed

## Slices

### S-01: Konto i cykl życia projektu

- **Outcome:** user can zarejestrować się, zalogować, utworzyć projekt podając nazwę i wrócić do zapisanego projektu, by kontynuować pracę.
- **Change ID:** auth-and-project-lifecycle
- **PRD refs:** FR-001, FR-002, FR-003
- **Prerequisites:** F-01
- **Parallel with:** F-02, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Auth baseline jest partial (tylko `/dashboard` chroniony); slice rozszerza ochronę na trasy projektów bez re-scaffoldingu Supabase auth.
- **Status:** proposed

### S-02: Klimat i przegrody

- **Outcome:** user can zdefiniować strefę klimatyczną, temperaturę zewnętrzną obiektu oraz katalog przegród budynku z materiałami dla projektu.
- **Change ID:** climate-and-assemblies
- **PRD refs:** FR-004, FR-005
- **Prerequisites:** S-01
- **Parallel with:** F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Wejście do strat przez przenikanie — bez przegród edytor nie ma czego przypisać do warstw.
- **Status:** proposed

### S-03: Edytor rzutu PDF

- **Outcome:** user can zaimportować PDF rzutu kondygnacji, nanosić ortogonalne warstwy ze zdefiniowaną przegrodą, łączyć je w zamknięte pomieszczenia z temperaturą wewnętrzną i wentylacją grawitacyjną per pomieszczenie.
- **Change ID:** pdf-floor-plan-editor
- **PRD refs:** FR-006, FR-007, FR-008
- **Prerequisites:** S-02, F-02
- **Parallel with:** F-03
- **Blockers:** —
- **Unknowns:**
  - Czy wentylacja grawitacyjna per pomieszczenie konfigurowana jest wyłącznie po narysowaniu stref, mimo że Primary Success Criteria listuje ją przed krokiem edytora? — Owner: user. Block: no.
- **Risk:** Największa inwestycja frontend (#1 blocker: skills); guardrail użyteczności edytora na typowym PDF decyduje o wartości produktu.
- **Status:** proposed

### S-04: Pierwsze obliczenie OZC na rzucie PDF

- **Outcome:** user can uruchomić obliczenie i zobaczyć na ekranie straty na ciepło oraz wentylację zgodne z oczekiwaniem inżynierskim (bez formalnego raportu).
- **Change ID:** first-ozc-calculation
- **PRD refs:** FR-009, US-01
- **Prerequisites:** S-03, F-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Kamień milowy walidacji produktu — łączy geometrię z edytora z silnikiem WT 2021; bez tego US-01 pozostaje niespełnione.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | project-schema-rls | Schemat projektu Supabase z RLS właściciela | yes | Odblokowuje S-01 i równoległe F-02 / F-03 |
| F-02 | pdf-floor-plan-storage | Storage PDF rzutu per projekt | no | Wymaga F-01 |
| F-03 | wt2021-calculation-core | Silnik obliczeń WT 2021 + wentylacja grawitacyjna | no | Wymaga F-01; można planować równolegle z S-02 |
| S-01 | auth-and-project-lifecycle | Rejestracja, logowanie i CRUD projektu | no | Wymaga F-01 |
| S-02 | climate-and-assemblies | Strefa klimatyczna i katalog przegród | no | Wymaga S-01 |
| S-03 | pdf-floor-plan-editor | Edytor PDF: warstwy, pomieszczenia, wentylacja | no | Wymaga S-02, F-02 |
| S-04 | first-ozc-calculation | Uruchomienie OZC i wynik na ekranie | no | Gwiazda przewodnia; wymaga S-03, F-03 |

## Open Roadmap Questions

1. **Jaki dokładnie uproszczony model wentylacji grawitacyjnej per pomieszczenie?** — Owner: user. Block: F-03 (planowanie silnika; Block: no na slice — research w `/10x-plan`).
2. **Kolejność UX: wentylacja przed czy w trakcie rysowania pomieszczeń?** — Owner: user. Block: S-03 (Block: no — decyzja UX w planie edytora).

(Pytania z PRD rozstrzygnięte 2026-05-19 — brak otwartych wpisów do skopiowania.)

## Parked

- **Współdzielenie projektu między kontami** — Why parked: PRD §Non-Goals; MVP single-tenant per użytkownik.
- **Import .dwg / .dxf** — Why parked: PRD §Non-Goals; v1 tylko PDF.
- **Integracje z zewnętrznymi platformami OZC** — Why parked: PRD §Non-Goals.
- **Obliczenia wielokondygnacyjne** — Why parked: PRD §Non-Goals; jedna kondygnacja na projekt w MVP.
- **Wentylacja mechaniczna / nawiewno-wywiewna** — Why parked: PRD §Non-Goals; tylko grawitacyjna per pomieszczenie.
- **Charakterystyka energetyczna budynku** — Why parked: PRD §Non-Goals.
- **Model 3D z warstw 2D** — Why parked: PRD §Non-Goals.
- **Aplikacja mobilna** — Why parked: PRD §Non-Goals; web desktop w MVP.
- **Formalny raport PDF/druk** — Why parked: PRD §Non-Goals; wynik na ekranie w v1.

## Done
