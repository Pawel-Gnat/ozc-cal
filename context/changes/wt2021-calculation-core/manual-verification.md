# WT 2021 Calculation Core — Manual Verification

Engineering checklist for validating F-03 (`wt2021-calculation-core`) without an automated test runner.

**Rounding tolerance:** ±1 W on all expected heat-loss values unless noted otherwise.

## Ventilation field semantics

Per-room ventilation inputs on `plan_rooms`:

| Field | Unit | Null handling |
| --- | --- | --- |
| `ventilation_supply` | m³/h | treated as 0 |
| `ventilation_exhaust` | m³/h | treated as 0 |
| `ventilation_natural` | m³/h | treated as 0 |

**Combined flow:** `V = supply + exhaust + natural` (m³/h).

**Heat loss formula:** `Q_vent [W] = 0,33 × V × ΔT`, where `ΔT = internal_temp_c − external_design_temp_c` [K].

If `V = 0`, ventilation loss is 0 W.

## Assembly preview (U / R)

`computeAssemblyPreview(layers, category)` delegates to `computeAssemblyU` (ISO 6946 direction-dependent R_si / R_se).

| Category | Preview change vs pre-F-03 |
| --- | --- |
| `external_wall`, `window`, `door` | Unchanged (horizontal: R_si 0,13 / R_se 0,04) |
| `ceiling`, `roof` | R_si 0,10 (upward) — U may increase slightly |
| `floor`, `ground_floor` | R_si 0,17 (downward) — U may decrease slightly |
| `internal_partition` | R_si 0,13 on both sides — differs from old single-sided preview |

## Running the engine

**From a seeded dev project** (requires auth session + Supabase):

```typescript
import { createClient } from "@/lib/supabase"; // or your server client helper
import { calculateProjectOzc } from "@/lib/services/ozc-calculation";

const result = await calculateProjectOzc(supabase, "<project-id>");
console.log(result);
// Repeat call — result must be identical (deterministic).
```

**From fixture data** (no DB):

```typescript
import { calculateOzc } from "@/lib/thermal/calculate-ozc";

const result = calculateOzc(fixtureInput);
```

**Automated fixture runner** (no DB): `npx tsx scripts/ozc-manual-check.mts` — covers Phase 2 geometry, Phase 3 preview delegation, Phase 4 ventilation, Case 1 & 2, and deterministic repeat. Last verified: 2026-06-10.

---

## Case 1: Single-room box

**Geometry:** rectangle 4 m × 5 m (20 m² floor + ceiling), storey height 2,6 m.

**Climate:** `T_room = 20 °C`, `T_external = −20 °C` → **ΔT = 40 K**.

**Assemblies (target U-values):**

| Surface | Category | Target U [W/(m²·K)] | Layer shortcut (λ = 1, d in mm) |
| --- | --- | --- | --- |
| Walls | `external_wall` | 0,20 | d ≈ 467 mm → R_layer = 0,467; R_total = 0,13+0,467+0,04 = 5; U = 0,2 |
| Floor | `floor` | 0,15 | d ≈ 633 mm with downward R_si 0,17 |
| Ceiling | `ceiling` | 0,15 | d ≈ 600 mm with upward R_si 0,10 |

For hand-checks, use the **target U** directly rather than re-deriving from layers.

**Ventilation:** `V = 120` m³/h (e.g. supply only).

### Hand calculations

| Component | Formula | Expected [W] |
| --- | --- | --- |
| Walls | 18 m perimeter × 2,6 m × 0,20 × 40 | 374,4 |
| Floor | 20 m² × 0,15 × 40 | 120 |
| Ceiling | 20 m² × 0,15 × 40 | 120 |
| **Transmission total** | | **614,4** |
| Ventilation | 0,33 × 120 × 40 | **1584** |
| **Room total** | | **≈ 2198** |

### Fixture sketch (scale 0,01 m/px)

Nodes: (0,0), (400,0), (400,500), (0,500). Four wall segments forming closed chain. Assign wall assembly to all perimeter segments.

### In-app (after S-04)

1. Set climate + storey height 2,6 m.
2. Create wall / floor / ceiling catalog entries.
3. Draw 4×5 m room, calibrate scale, assign assemblies.
4. Set room temp 20 °C, ventilation supply 120 m³/h.
5. Run calculation — compare to table above.

---

## Case 2: Two-room internal partition

**Setup:** two adjacent rooms sharing one wall line. Draw **duplicate colocated segments** on both sides (S-03 workaround).

| Room | T_int [°C] | Shared wall |
| --- | --- | --- |
| A | 20 | partition segment owned by A |
| B | 16 | colocated partition segment owned by B |

**Climate:** `T_external = −20 °C` (external walls still use ΔT = 40 K).

**Partition:** `internal_partition`, e.g. 3 m long × 2,6 m storey, U ≈ 0,5 W/(m²·K).

### Hand calculations (partition only)

| Side | ΔT | Area | U | Q [W] |
| --- | --- | --- | --- | --- |
| Room A | \|20−16\| = 4 K | 7,8 m² | 0,5 | **15,6** |
| Room B | 4 K | 7,8 m² | 0,5 | **15,6** |

Each room's **total** transmission also includes its external walls, floor, and ceiling — partition loss is additive.

**Without duplicate colocated segment:** partition ΔT = 0 → partition loss = 0 W (documented MVP limitation).

### Building total semantics (S-04 UI)

`buildingTransmissionW` and `buildingTotalW` are the **sum of per-room losses**, not net building envelope loss. Internal partitions with duplicate colocated segments contribute on **both** owning rooms — the building total therefore **double-counts** inter-zone partition transfer (intentional MVP model).

When S-04 presents building totals, label clearly (e.g. “Sum of room heat losses”) so users do not read it as net envelope loss.

---

## Phase 4 quick checks

- `V = 120` m³/h, `ΔT = 40` K → ventilation = **1584 W**
- All ventilation fields `null` → **ventilationW = 0**
