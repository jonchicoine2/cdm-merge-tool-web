# ChargeMaster Merge Logic Spec

## Purpose

This document captures the behavior of the legacy WinForms ChargeMaster Merge tool and compares it with the current web implementation.

Scope:

- Document the desktop form workflow as implemented in source, not just as intended.
- Call out the legacy modifier and HCPCS matching rules in detail.
- Summarize the features the tool supports.
- Identify behavior gaps that can explain why the web app produces different analysis results.

Primary sources reviewed:

- Legacy WinForms:
  - `C:\Users\J794116\source\Workspaces\v2\Main_Next\SourceCode\OtherApps\ChargeMasterMerge\ExcelImport\Forms\Main\frmImport.cs`
  - `C:\Users\J794116\source\Workspaces\v2\Main_Next\SourceCode\OtherApps\ChargeMasterMerge\ExcelImport\Code\ProcessExcel.cs`
  - `C:\Users\J794116\source\Workspaces\v2\Main_Next\SourceCode\OtherApps\ChargeMasterMerge\ExcelImport\Code\Classes\HCPCSCodeHelper.cs`
  - `C:\Users\J794116\source\Workspaces\v2\Main_Next\SourceCode\OtherApps\ChargeMasterMerge\ExcelImport\Forms\Dialogs\ModifiersDialog.cs`
  - `C:\Users\J794116\source\Workspaces\v2\Main_Next\SourceCode\OtherApps\ChargeMasterMerge\ExcelImport\Forms\Main\frmSettings.cs`
- Web app:
  - `src/utils/excelOperations.ts`
  - `src/hooks/useComparison.ts`
  - `src/hooks/useFileOperations.ts`
  - `src/app/excel-import-clean/page.tsx`
  - `src/components/excel-import/ModifierCriteriaDialog.tsx`

## Executive Summary

The legacy desktop tool is a master-driven merge utility for Charge Description Master reconciliation. It loads one master worksheet and one client worksheet, normalizes client HCPCS values, compares the client rows against a master copy, then produces a merged master plus review buckets such as errors, empties, and duplicates.

At a feature level, the legacy tool supports:

- Loading a master workbook and a client workbook.
- Selecting one worksheet from each workbook.
- Saving and restoring session settings.
- Configuring modifier/root handling for `-00`, `-25`, `-50`, `-59`, `-XU`, and `-76`.
- Special trauma handling for `99284`, `99285`, and `99291`.
- Auto-normalizing 7-character client HCPCS values into `XXXXX-YY`.
- Filling missing master `CDM`, `PhysicianCDM`, and `QTY` values from client data.
- Separating client review rows into:
  - merged success rows
  - HCPCS mismatch rows
  - empty rows
  - duplicate client rows
- Manually moving selected rows into the merged/success result set.
- Exporting results in multiple formats and export modes.

The current web tool covers the broad workflow, but it is not behaviorally equivalent. The biggest gaps are:

- The web app updates all mapped columns from the client row, while the desktop app only updates `CDM`, `PhysicianCDM`, and `QTY`.
- The web app treats duplicate client keys as last-write-wins during matching, while the desktop app uses duplicates to suppress many updates and sends those rows to review buckets.
- The web app exposes `Ignore Trauma` but does not apply it in comparison.
- The web multiplier logic is not equivalent to the legacy logic and currently appears non-functional for uppercase `X` multiplier codes.
- The web app uses a stricter modifier key model for many modifier types, while the desktop app allows base-to-modified propagation for many non-configured modifiers such as anatomical modifiers.
- The web app uses fuzzy column detection and broader column mapping; the desktop app expects a very narrow 5-column shape.

## Legacy WinForms Workflow

### 1. Startup and session behavior

On startup the desktop app:

- Creates a user context object that stores current files, sheet names, modifier flags, and option flags.
- Loads default session settings from `Session\Default.ssn` if available.
- Opens in the `Import` tab.
- Hides some tabs at startup:
  - `Successes`
  - `Description Mismatch`
  - `Dups Src to Client`
- Keeps the merged results view, error view, empty view, and duplicate view.

The compare flow is user-driven. There is no automatic recomparison after edits. The user explicitly clicks `Compare` or `Compare Again`.

### 2. File intake

The desktop form lets the user choose:

- one master spreadsheet
- one client spreadsheet
- one worksheet from each

The form validates sheet structure before letting the user compare.

### 3. Expected worksheet shape

The legacy implementation is much stricter than the web app.

Observed requirements:

- The first row is treated as the header row.
- The first five columns must map to the legacy parameter list:
  - `HCPCS`
  - `CDM`
  - one of `LongName`, `Long Name`, or `Description`
  - one of `Quantity` or `Qty`
  - one of `PhysicianCDM` or `Physician CDM`
- Only the first five columns are kept for processing.
- During load, column index `2` is renamed to `Description`, column index `3` to `Qty`, and column index `4` to `PhysicianCDM`.

Implication:

- Even though header validation looks name-based, the runtime processing expects the legacy five-column order.
- The legacy app does not have a separate modifier column. Modifier information lives inside the `HCPCS` string.

### 4. Compare confirmation and modifier dialog

When the user clicks `Compare`, the desktop app:

- shows a confirmation message box
- optionally shows the modifier criteria dialog

The modifier dialog is shown when either of these is true:

- the user has not already answered the modifier question in the current session
- `Always Show Option Box` is enabled

The dialog exposes:

- `Use Root HCPCS for -00's`
- `Use Root HCPCS for -25's`
- `Ignore Trauma Teams`
- `Use Root HCPCS for -50's`
- `Use Root HCPCS for -59's`
- `Use Root HCPCS for -XU's`
- `Use Root HCPCS for -76's`

These flags are stored in the session context and reused during processing.

## Legacy Data Normalization

### HCPCS formatting

Before comparison, the client dataset is normalized by `FixHcpcsInDataTable`.

Rule:

- If client `HCPCS` length is exactly `7`, insert a hyphen after the fifth character.

Examples:

- `9928300` becomes `99283-00`
- `12345LT` becomes `12345-LT`

Important detail:

- This is length-based only.
- The legacy app does not validate whether the last two characters are a real modifier before inserting the hyphen.
- This normalization is applied to the client data table before comparison logic runs.

### HCPCS structural model

`HCPCSCodeHelper` treats the code as one of three shapes:

- length `5`: root only
- length `8`: root plus modifier or root plus multiplier
- length `11`: root plus modifier plus multiplier

It models:

- root = first five characters
- modifier = characters `6-7` when a modifier exists
- multiplier = last two characters when a multiplier exists

## Legacy Matching and Update Logic

## High-level outcome

The desktop result table starts as a copy of the master rows. The comparison process does not merge arbitrary client columns into that row. It only tries to fill:

- `CDM`
- `PhysicianCDM`
- `QTY`

Descriptions and other master values are not overwritten by the client row during the main merge flow.

### 1. Review bucket classification

Before the main update pass, the client rows are bucketed as follows:

- `dtDups`:
  - client rows with duplicate `HCPCS`
  - only when at least one master row contains that HCPCS value
  - only when the client duplicate row has `CDM` or `PhysicianCDM`
- `dtEmpty`:
  - client rows whose HCPCS exists in the master but both `CDM` and `PhysicianCDM` are empty
  - also rows with blank HCPCS
- `dtErrors`:
  - client rows with no master match at all

This matters because duplicate rows are not just reported; they also suppress later update behavior.

### 2. Stage 1: direct exact matches

For each master row:

- find client rows where `client.HCPCS == master.HCPCS`
- if there is exactly one exact client match
- and the duplicate list does not contain the root of that HCPCS
- then update the master row from that client row

Important legacy quirk:

- duplicate suppression is root-based, not exact-code-based
- that means an exact match like `99281-00` can still be skipped if duplicate client rows exist for root `99281`

The source code contains a comment acknowledging that this behavior is questionable, but the stricter duplicate suppression is what is currently implemented.

### 3. Stage 2: fallback/root-based matching

After exact matches, the desktop app iterates master rows whose `CDM` and `PhysicianCDM` are still empty.

It then tries root-based matching using `GetRootofCol`.

Observed behavior:

- For most codes, `GetRootofCol(code, client)` returns the 5-character root.
- For a code that has both modifier and multiplier, it can return `root-modifier` if the client has a populated row with that exact `root-modifier`.
- If the modifier is `59` or `XU` in that combined modifier+multiplier case, special exception flags are set.

The fallback logic then:

- first tries an exact client row match on the full HCPCS string
- if that fails, falls back to root-based `LIKE '%root%'` searches
- applies update permissions through `CanUpdateDataRow` and modifier config

### 4. Update permissions

`FixRowDataAndUpdateMaster` performs the actual row update. It only writes:

- `CDM`
- `PhysicianCDM`
- `QTY`

It writes only into empty target fields.

For `CDM` / `PhysicianCDM`:

- if client `CDM` is populated and master `CDM` is empty, copy it
- if client `PhysicianCDM` is populated and master `PhysicianCDM` is empty, copy it
- the method can populate both fields from the same client row when available

For `QTY`:

- if the master HCPCS carries a multiplier, the multiplier participates in QTY calculation
- otherwise, client `QTY` is copied when present

### 5. Multiplier quantity rule

Legacy multiplier behavior:

- If the master HCPCS contains a multiplier `xNN`:
  - if client `QTY` is blank, use the multiplier value
  - if client `QTY >= multiplier`, use client `QTY`
  - if client `QTY < multiplier`, use the multiplier value

This behavior is embedded directly in `FixRowDataAndUpdateMaster`.

## Legacy Modifier Behavior

### Core principle

The desktop app does not compare on a simple `HCPCS + modifier` composite key the way the web app does. Instead, it mixes:

- exact full-HCPCS matching
- root-based matching
- modifier-configured permission checks
- trauma exceptions
- duplicate suppression

The result is more procedural than key-based.

### Modifier flags that are configurable

User-configurable root-treatment exists for:

- `-00`
- `-25`
- `-50`
- `-59`
- `-XU`
- `-76`

The same concept also exists for codes that combine modifier + multiplier:

- `-00X`
- `-25X`
- `-50X`
- `-59X`
- `-XUX`
- `-76X`

### Trauma behavior

`Ignore Trauma Teams` is narrower than the label suggests.

The legacy code only special-cases:

- `99284`
- `99285`
- `99291`

Observed behavior:

- it does not inspect the description text for the word `trauma`
- it does not look for generic emergency keywords
- it only applies trauma logic to those specific HCPCS roots

### Exact logic for modifier-based updates

`CanUpdateDataRow(root, client)` allows the update when:

- client HCPCS and master HCPCS are exactly equal
- or `CanUpdateBasedOnModifierConfigOptions(masterHCPCS)` returns true
- or special `59` / `XU` exception flags are set for modifier+multiplier combinations

### Important legacy quirk: many non-configured modifiers still behave like root-matchable codes

`CanUpdateBasedOnModifierConfigOptions` only has explicit blocked-by-default cases for:

- `-00`
- `-25`
- `-50`
- `-59`
- `-XU`
- `-76`
- and their `...X` forms

Any other modifier shape falls through to the default branch, which returns `true`.

Practical implication:

- anatomical and other non-configured modifiers such as `LT`, `RT`, `FA`, `F1-F9`, `TA`, `T1-T9`, and other unlisted suffixes are effectively root-matchable by default in the legacy app
- the web app does not mirror this behavior

### Another legacy quirk: substring-style matching

Several fallback searches use `LIKE '%root%'` rather than exact tokenized comparison. In practice this means the legacy algorithm is not purely key-driven; it is using broad contains-style matching in a number of branches.

## Legacy UI and Output Behavior

### Main result views that remain active

At runtime the desktop app uses these main review/result areas:

- `Merged Master & Client`
- `Errors (HCPCS mismatch)`
- `Empty (HCPCS or CDM)`
- `Dups in Client`

### Hidden or retired views still present in the designer

These tabs exist in the form designer but are removed on startup:

- `Successes`
- `Description Mismatch`
- `Dups Src to Client`

### Manual review actions

The desktop form supports several post-compare manual actions, including:

- copy all rows
- copy selected rows
- add selected rows to successes
- add all rows to successes

Those actions are available from context menus on certain grids and can push values into the merged/success output.

### Export modes

The desktop app supports three export menu flows:

- `Export Successes and Master`
- `Export All Worksheets`
- `Export Successes without Masters`

It also supports multiple export formats:

- `.xlsx`
- `.xls`
- `.csv` without header
- `.csv` with header
- `.txt`

## Web Implementation Summary

The current web app follows the same broad business task but is implemented very differently.

Observed web behavior:

- Loads all sheets in both workbooks and shows tabs.
- Applies client-side hyphen insertion to client HCPCS fields only.
- Automatically recomputes comparison when files or rows change.
- Detects HCPCS / modifier / quantity / description columns using fuzzy matching.
- Builds a client lookup map using `getCompareKey`.
- Starts the merged result as a copy of the master row.
- Overwrites any mapped master column with the matching client value when the client field is non-empty.
- Shows three result groups:
  - merged data
  - unmatched client
  - duplicate client
- Exports a single `.xlsx` workbook with:
  - `Merged`
  - `Unmatched_Client`
  - `Duplicate_Client`

## Behavior Gaps: Legacy vs Web

The items below are the most likely explanations for why the web app produces different output.

### 1. The web app overwrites far more fields than the desktop app

Legacy:

- only fills `CDM`, `PhysicianCDM`, and `QTY`

Web:

- maps columns broadly and overwrites every mapped field with non-empty client data

Impact:

- descriptions can change in the web output
- master metadata can change in the web output
- result rows can look materially different even when the matched HCPCS logic is similar

### 2. Duplicate handling is fundamentally different

Legacy:

- duplicate client rows are a first-class review bucket
- duplicate roots suppress some exact matches
- duplicate exact matches can be intentionally skipped

Web:

- duplicate keys are detected for display
- matching still uses a `Map`, so the last client row for a key silently wins
- duplicates do not prevent a merge

Impact:

- the web app can populate master rows that the desktop app would leave untouched
- the chosen client source row may differ from the legacy behavior

### 3. `Ignore Trauma` is implemented in legacy but is effectively a no-op in the web app

Legacy:

- special logic exists for trauma-related HCPCS roots `99284`, `99285`, and `99291`

Web:

- the UI exposes `ignoreTrauma`
- a helper named `filterTrauma` exists
- comparison never calls that helper and never branches on `ignoreTrauma`

Impact:

- toggling trauma behavior changes legacy results
- toggling the same option in the web app currently does not change comparison output

### 4. Multiplier handling is not equivalent and appears broken in the web app

Legacy:

- understands multiplier-aware HCPCS logic and adjusts `QTY` accordingly

Web:

- tries to parse multipliers with `parseMultiplierCode`
- uppercases the code and then matches with a lowercase `x` regex
- also strips suffixes in `parseHCPCS` before multiplier parsing in some paths

Impact:

- legacy quantity outputs for `xNN` codes are unlikely to match the web app today

### 5. Legacy lets many non-configured modifiers collapse to the root by default

Legacy:

- only a small set of modifiers are explicitly gated by modifier flags
- many other modifier types fall through and are treated as updateable against the base code

Web:

- preserves the modifier in the compare key unless a specific root flag clears it

Impact:

- the web app is stricter than legacy for many modifier families
- anatomical modifiers are a likely mismatch area

### 6. The web app uses a modifier-column-aware key model that the legacy app never had

Legacy:

- modifier lives inside `HCPCS`
- no separate modifier column is part of the core data contract

Web:

- will parse a separate modifier column when found
- will also try to parse modifier content from the HCPCS field

Impact:

- if a file has both a combined HCPCS value and a separate modifier column, the web key can diverge sharply from the legacy logic

### 7. Column validation and column mapping are much broader in the web app

Legacy:

- expects a narrow five-column import shape
- depends heavily on positional assumptions

Web:

- validates loosely
- uses exact, case-insensitive, normalized, partial, and fuzzy column matching
- can map columns such as `code`, `desc`, `name`, `units`, and similar variants

Impact:

- the web app can accept and merge files the legacy app would reject
- the web app can also map fields differently than legacy would have processed

### 8. The result buckets are not equivalent

Legacy:

- classifies client rows into empties, errors, duplicates, and merged master rows
- duplicate rows only count as duplicates under certain conditions

Web:

- always shows unmatched client and duplicate client panels
- duplicate detection is based on raw row keys, independent of whether a master match exists

Impact:

- counts, classifications, and operator review queues will differ

### 9. Export behavior is not equivalent

Legacy:

- multiple export modes
- multiple file formats
- output naming based on `Combined [client file]`

Web:

- single export path
- single `.xlsx` format
- output workbook shape differs

Impact:

- even when comparison logic converges, exported artifacts will still differ

### 10. Comparison timing and user flow differ

Legacy:

- user explicitly triggers comparison
- modifier dialog is part of compare flow

Web:

- comparison auto-runs on load, on tab changes, and after edits
- modifier changes immediately affect recomputation

Impact:

- the same session can feel stateful in different ways
- operators may believe they are seeing equivalent behavior when they are not

## Highest-Value Parity Targets

If the goal is desktop parity rather than a new product definition, these are the highest-value areas to align first:

1. Update only `CDM`, `PhysicianCDM`, and `QTY` during merge.
2. Rebuild duplicate suppression so duplicates block updates the way legacy does.
3. Implement real trauma handling using the legacy HCPCS-specific rules.
4. Fix multiplier parsing and quantity application.
5. Align modifier fallback behavior for:
   - `-00`
   - `-25`
   - `-50`
   - `-59`
   - `-XU`
   - `-76`
   - non-configured modifiers such as anatomical modifiers
6. Decide whether the web app should preserve the legacy 5-column contract or intentionally keep the broader fuzzy-mapping model.

## Conclusion

The desktop app is not just "matching by HCPCS plus modifier." Its real behavior is a staged master-update process with:

- client-side HCPCS normalization
- duplicate-aware suppression
- root-based fallback matching
- narrow field updates
- special trauma handling
- special multiplier handling
- permissive default handling for many unlisted modifiers

The current web app implements a cleaner, more general merge engine, but that engine is not a drop-in behavioral replacement for the WinForms tool. The largest result drift is likely coming from duplicate handling, trauma no-op behavior, multiplier mismatch, and the web app's broader column overwrite behavior.
