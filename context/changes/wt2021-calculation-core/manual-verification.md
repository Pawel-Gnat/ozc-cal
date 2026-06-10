# WT 2021 Calculation Core — Manual Verification

Engineering checklist for validating F-03 (`wt2021-calculation-core`) without an automated test runner. Expanded in Phase 5 with full reference cases.

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

### Quick check (Phase 4)

- Room with `V = 120` m³/h and `ΔT = 40` K → `0,33 × 120 × 40 = 1584` W
- Room with all ventilation fields `null` → `ventilationW = 0`
