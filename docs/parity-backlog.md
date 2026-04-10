# WinForms Parity Backlog

## Goal

Make the web app produce the same analysis and merge output as the legacy WinForms ChargeMaster Merge application.

This backlog is ordered by expected impact on result parity, not by implementation difficulty.

## Working Rules

- Treat the WinForms source as the source of truth for behavior.
- Prefer executable parity tests before broad refactors.
- Change one behavior family at a time so we can isolate output drift.
- Use small, representative fixtures for each modifier and duplicate scenario.

## Phase 0: Lock Down Expected Behavior

Status:

- In progress

Deliverables:

- Legacy behavior spec:
  - [legacy-winforms-vs-web-spec.md](C:/Users/J794116/source/repos/cdm-merge-tool-web/docs/legacy-winforms-vs-web-spec.md)
- Unit tests that codify parity-sensitive behavior in the web comparison engine.

Immediate test matrix to build out:

1. Exact HCPCS match with blank master `CDM` / `PhysicianCDM`.
2. Exact HCPCS match with non-blank master `CDM` / `PhysicianCDM`.
3. Root matching with `-00`.
4. Root matching with `-25`.
5. Root matching with `-50`.
6. Root matching with `-59`.
7. Root matching with `-XU`.
8. Root matching with `-76`.
9. Anatomical modifier fallback such as `LT` / `RT`.
10. Duplicate client rows for the same exact HCPCS.
11. Duplicate client rows for the same root but different modifiers.
12. Trauma cases for `99284`, `99285`, `99291`.
13. Multiplier cases such as `J1234x10`.
14. Combined modifier + multiplier cases such as `12345-59x10`.

## Phase 1: Merge Write Semantics

Status:

- Started in this pass

Target parity changes:

1. Only fill legacy writable fields from client data:
   - `CDM`
   - `PhysicianCDM`
   - `QTY`
2. Do not overwrite non-empty master `CDM` or `PhysicianCDM`.
3. Preserve master description and other non-legacy fields during merge.

Why this comes first:

- It is a high-impact difference today.
- It is low-risk compared with duplicate and modifier rewrites.
- It affects almost every merged row.

## Phase 2: Duplicate Suppression Parity

Status:

- Started in this pass

Delivered so far:

1. Replaced last-write-wins matching with duplicate-aware candidate selection in the comparison hook.
2. Added legacy-style duplicate review filtering:
   - only duplicate client rows with a master-side match are sent to the duplicates bucket
   - duplicate rows without any master-side match stay in the unmatched bucket
3. Added suppression tests for:
   - exact duplicate client rows
   - duplicate root rows suppressing exact modifier matches

Target parity changes:

1. Rebuild legacy duplicate detection rules, not just raw duplicate display.
2. Stop using last-write-wins client lookup behavior for parity paths.
3. Suppress exact-match updates when legacy duplicate/root rules would block them.
4. Separate:
   - duplicate rows that should be reviewed
   - rows that are still allowed to update the master

Why this is critical:

- This is one of the largest drivers of row-level mismatch between desktop and web.

## Phase 3: Trauma and Multiplier Parity

Status:

- Started in this pass

Delivered so far:

1. Added legacy-style trauma update gating for:
   - `99284`
   - `99285`
   - `99291`
2. Fixed uppercase multiplier parsing for codes such as `J1234X10`.
3. Matched legacy quantity behavior for multiplier codes:
   - blank client qty uses the multiplier
   - lower client qty uses the multiplier
   - higher client qty stays as client qty
4. Added support for the legacy `-59X` exception path when a `root-modifier` client row exists.
5. Added parity tests for trauma and multiplier scenarios.

Target parity changes:

1. Implement real `Ignore Trauma` logic matching legacy behavior:
   - special-case `99284`, `99285`, `99291`
2. Fix multiplier parsing.
3. Match legacy quantity rules:
   - if client qty is blank, use multiplier
   - if client qty is lower than multiplier, use multiplier
   - if client qty is higher, keep client qty
4. Support modifier + multiplier exception behavior for `59` and `XU`.

## Phase 4: Modifier Matching Parity

Status:

- Started in this pass

Delivered so far:

1. Added root-fallback matching tier that mirrors WinForms `LIKE '%root%'` behavior:
   - When master has a modifier the client doesn't, the engine now tries matching by 5-char root code
   - Gated through `canLegacyUpdate` which returns `true` for non-configured modifiers (default case)
2. Non-configured modifiers now correctly allow root matching:
   - `LT`, `RT` (anatomical)
   - `FA`, `F1-F9` (finger)
   - `TA`, `T1-T9` (toe)
   - Any other unlisted modifier (e.g., `QW`, `TC`, `26`)
3. Configured modifiers (-00, -25, -50, -59, -XU, -76) still block root matching when their checkbox is disabled
4. Added consumed-candidate tracking so client rows found but blocked by `canLegacyUpdate` (e.g., trauma ignore) don't appear as unmatched
5. Added parity tests for LT, RT, FA, F5, TA, T5, QW (unknown), and negative tests for -25, -59, -76 disabled
6. Added multi-master test: two masters with different modifiers (LT, RT) matching the same root client row

Target parity changes:

1. ~~Match legacy permissive fallback for non-configured modifiers~~ — Done
2. ~~Match legacy root-handling behavior for configured modifiers~~ — Done (was already correct)
3. Revisit whether a separate modifier column should participate in parity mode at all.

## Phase 5: Intake and Export Parity

Status:

- Started in this pass

Delivered so far:

1. Added 3 WinForms-style export modes:
   - "All Worksheets" — 4 sheets: SourceMaster, Errors, Empty, Dups (default)
   - "Successes and Master" — single SourceMaster sheet with all merged rows
   - "Successes Without Masters" — 4 sheets: Successes (filtered to rows with CDM/PhysicianCDM), Errors, Empty, Dups
2. Aligned sheet names to match WinForms:
   - Merged → SourceMaster
   - Unmatched_Client → Errors
   - Added Empty bucket (rows with blank CDM and PhysicianCDM)
   - Duplicate_Client → Dups
3. Changed export filename from `{clientName}_{timestamp}.xlsx` to `Combined {clientName}.xlsx`
4. Added split-button export UI with dropdown for all 3 modes
5. Ctrl+E keyboard shortcut defaults to "All Worksheets" mode

Remaining target parity changes:

1. Decide whether parity mode should enforce the legacy 5-column contract.
2. Match legacy sheet validation more closely where needed.

## Recommended Execution Order

1. ~~Expand parity tests around exact matches and no-overwrite rules.~~ — Done (Phase 0/1)
2. ~~Finish duplicate suppression parity.~~ — Done (Phase 2)
3. ~~Finish trauma and multiplier parity.~~ — Done (Phase 3)
4. ~~Finish modifier fallback parity.~~ — Done (Phase 4)
5. ~~Tackle export and intake differences last.~~ — Done (Phase 5)

## Definition of Done

We should consider parity achieved only when all of the following are true:

1. The same master/client fixture set produces the same merged rows in desktop and web.
2. The same fixture set produces the same review buckets:
   - errors
   - empty rows
   - duplicates
3. Modifier settings produce the same row movement and field updates in both apps.
4. Quantity outputs for multiplier codes match.
5. Exported workbook contents match the legacy workbook shape closely enough for downstream users.
