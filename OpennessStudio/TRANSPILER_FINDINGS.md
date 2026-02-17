# Transpiler validation findings (PLC_1)

## What was executed

1. Compile PLC_1 program blocks to both targets.
2. Run generated Python modules by instantiating each generated class and calling `cycle()` once.
3. Type-check generated TypeScript files with `deno check`.

## Flow resolution (call graph)

Resolved block-level flow from generated code:

- `Main` calls:
  - `Supply_Conveyor`
  - `Work_Station`
  - `Control_Panel`
  - `Work_Station`
  - `Control_Panel`
  - `Work_Station`
  - `Control_Panel`
  - `Sequence_Data_Management`
- `Work_Station` calls:
  - `StationConveyorControl`
  - `StationProcessControl`
- `Control_Panel` calls:
  - `TimeLeftCalcuation`
- `Sequence_Data_Management` calls:
  - `DownloadNewData`
  - `PushDataToStation` (3 station targets)

## Fixes applied from this validation

- Fixed invalid generated TypeScript expressions (`not/and/or` → `! / && / ||`) and ensured state access is instance-based (`this.*`).
- Fixed Python symbol qualification so contacts/coils resolve to `self.*` and runtime calls stay `rt.*`.
- Added cross-block call wiring for known FB/FC calls:
  - known blocks are imported and instantiated,
  - call parameters are assigned onto callee state,
  - callee `cycle()` is executed.
- Added dynamic runtime placeholders (`AutoStruct` in Python and index signatures in TypeScript classes) so unresolved DB/UDT nested fields do not crash generated code immediately.

## Current coherence status

- Python: all generated block classes can be instantiated and a single `cycle()` can be executed without runtime exceptions.
- TypeScript: all generated files pass `deno check`.

## Remaining correctness gaps (next fixes)

1. **Flow semantics are still simplified**
   - Network ordering, branch/merge topology and wire power flow are reduced to a linear condition/action model.
2. **Edge/timer behavior is approximated**
   - `PContact` and time-related behavior are placeholders and should be backed by stateful runtime semantics.
3. **Type fidelity is partial**
   - Unknown or complex UDT/DB types still degrade to dynamic placeholders (`Any` / `any` / `AutoStruct`).
4. **Call argument typing and directionality**
   - IN/OUT/IN_OUT discipline should be enforced from call metadata and interfaces rather than assignment-by-name only.
5. **Formal solving path**
   - The `z3` hook exists, but a dedicated symbolic execution pass over the IR is still needed to prove reachability/safety.
