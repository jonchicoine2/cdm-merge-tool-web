"use client";
import React, { useState, useEffect, useRef } from "react";
import { Button, Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, FormGroup, FormControlLabel, Checkbox } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import * as XLSX from "xlsx";

// Define a type for Excel rows with dynamic fields, plus id
interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
}

export default function ExcelImportPage() {
  const [rowsA, setRowsA] = useState<ExcelRow[]>([]);
  const [columnsA, setColumnsA] = useState<GridColDef[]>([]);
  const [rowsB, setRowsB] = useState<ExcelRow[]>([]);
  const [columnsB, setColumnsB] = useState<GridColDef[]>([]);
  const [mergedRows, setMergedRows] = useState<ExcelRow[]>([]);
  const [mergedColumns, setMergedColumns] = useState<GridColDef[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [lastFileA, setLastFileA] = useState<string>("");
  const [lastFileB, setLastFileB] = useState<string>("");
  const fileAInputRef = useRef<HTMLInputElement>(null);
  const fileBInputRef = useRef<HTMLInputElement>(null);
  const [dragOverA, setDragOverA] = useState(false);
  const [dragOverB, setDragOverB] = useState(false);
  const [compareError, setCompareError] = useState("");

  // Modifier criteria state
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [modifierCriteria, setModifierCriteria] = useState({
    root00: true,
    root25: true,
    ignoreTrauma: false,
    root50: false,
    root59: false,
    rootXU: false,
    root76: false,
  });

  // Unmatched and duplicate records state
  const [unmatchedB, setUnmatchedB] = useState<ExcelRow[]>([]);
  const [dupsB, setDupsB] = useState<ExcelRow[]>([]);
  const [mergedForExport, setMergedForExport] = useState<ExcelRow[]>([]);

  useEffect(() => {
    setLastFileA(localStorage.getItem("lastFileA") || "");
    setLastFileB(localStorage.getItem("lastFileB") || "");
  }, []);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement> | File,
    which: "A" | "B"
  ) => {
    let file: File | undefined;
    if (e instanceof File) {
      file = e;
    } else {
      file = e.target.files?.[0];
    }
    if (!file) return;
    if (which === "A") {
      setLastFileA(file.name);
      localStorage.setItem("lastFileA", file.name);
    } else {
      setLastFileB(file.name);
      localStorage.setItem("lastFileB", file.name);
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (json.length === 0) return;
      const headers = json[0] as string[];
      const columns: GridColDef[] = headers.map((header, idx) => ({
        field: header || `col${idx}`,
        headerName: header || `Column ${idx + 1}`,
        width: 150,
      }));
      const rows: ExcelRow[] = Array.from(json.slice(1)).map((row, idx) => {
        const rowArr = row as unknown[];
        const rowObj: ExcelRow = { id: idx };
        headers.forEach((header, colIdx) => {
          let value = rowArr[colIdx];
          if (typeof value === "object" && value !== null) {
            value = JSON.stringify(value) as string;
          }
          rowObj[header || `col${colIdx}`] = (value === undefined || value === null) ? "" : (value as string | number);
        });
        return rowObj;
      });
      if (which === "A") {
        setColumnsA(columns);
        setRowsA(Array.from(rows));
      } else {
        setColumnsB(columns);
        setRowsB(Array.from(rows));
      }
    };
    reader.readAsBinaryString(file);
  };

  // Get shared columns for key selection
  const sharedColumns = columnsA
    .map((col) => col.field)
    .filter((field) => columnsB.some((col) => col.field === field));

  // Compare logic
  // Remove mergeSource state and related code

  // Find HCPCS and Modifier columns for each file independently
  const getHCPCSColumnA = () => columnsA.find(col => col.field.toLowerCase() === "hcpcs")?.field || null;
  const getHCPCSColumnB = () => columnsB.find(col => col.field.toLowerCase() === "hcpcs")?.field || null;
  const getModifierColumnA = () => columnsA.find(col => col.field.toLowerCase() === "modifier")?.field || null;
  const getModifierColumnB = () => columnsB.find(col => col.field.toLowerCase() === "modifier")?.field || null;

  // Improved HCPCS parsing: supports XXXXX-YY, XXXXXYY, and separate Modifier column
  function parseHCPCS(row: ExcelRow, hcpcsCol: string, modifierCol: string | null): { root: string, modifier: string } {
    let hcpcs = String(row[hcpcsCol] || "").toUpperCase().trim();
    let modifier = "";
    if (modifierCol && row[modifierCol]) {
      modifier = String(row[modifierCol]).toUpperCase().trim();
    } else if (hcpcs.length === 8 && hcpcs[5] === '-') {
      // Format: XXXXX-YY
      modifier = hcpcs.substring(6, 8);
      hcpcs = hcpcs.substring(0, 5);
    } else if (hcpcs.length === 7) {
      // Format: XXXXXYY (no dash)
      modifier = hcpcs.substring(5, 7);
      hcpcs = hcpcs.substring(0, 5);
    } else if (hcpcs.length > 5) {
      // Fallback: try to extract modifier
      modifier = hcpcs.substring(5);
      hcpcs = hcpcs.substring(0, 5);
    }
    return { root: hcpcs, modifier };
  }

  // Helper to get description column name (case-insensitive)
  function getDescriptionCol(cols: GridColDef[]): string | null {
    const descCol = cols.find(col => col.field.toLowerCase() === "description");
    return descCol ? descCol.field : null;
  }

  const handleCompare = () => {
    const hcpcsColA = getHCPCSColumnA();
    const hcpcsColB = getHCPCSColumnB();
    const modifierColA = getModifierColumnA();
    const modifierColB = getModifierColumnB();
    if (!hcpcsColA || !hcpcsColB) {
      setShowCompare(false);
      setCompareError('Both files must have a "HCPCS" column to compare.');
      return;
    }
    setCompareError("");
    const descColA = getDescriptionCol(columnsA);
    const descColB = getDescriptionCol(columnsB);

    // Diagnostics: log columns and sample rows
    console.log("[DIAG] columnsA:", columnsA.map(c => c.field));
    console.log("[DIAG] columnsB:", columnsB.map(c => c.field));
    console.log("[DIAG] hcpcsColA:", hcpcsColA, ", hcpcsColB:", hcpcsColB, ", modifierColA:", modifierColA, ", modifierColB:", modifierColB);
    if (rowsA.length > 0) console.log("[DIAG] Sample rowA:", rowsA[0]);
    if (rowsB.length > 0) console.log("[DIAG] Sample rowB:", rowsB[0]);

    function getCompareKey(row: ExcelRow, hcpcsCol: string, modifierCol: string | null): string {
      const { root, modifier } = parseHCPCS(row, hcpcsCol, modifierCol);
      const modMap = [
        { flag: modifierCriteria.root00, mod: "00" },
        { flag: modifierCriteria.root25, mod: "25" },
        { flag: modifierCriteria.root50, mod: "50" },
        { flag: modifierCriteria.root59, mod: "59" },
        { flag: modifierCriteria.rootXU, mod: "XU" },
        { flag: modifierCriteria.root76, mod: "76" },
      ];
      const anyModifierChecked = modMap.some(({ flag }) => flag);
      const cleanModifier = (modifier || "").trim();
      const key = !anyModifierChecked
        ? (cleanModifier ? `${root}-${cleanModifier}` : root)
        : (modMap.some(({ flag, mod }) => flag && cleanModifier === mod) ? root : (cleanModifier ? `${root}-${cleanModifier}` : root));
      // Diagnostics: log key for first 5 rows
      if (row.id < 5) {
        console.log(`[DIAG] Row id=${row.id}, root='${root}', modifier='${modifier}', cleanModifier='${cleanModifier}', key='${key}', hcpcsCol='${hcpcsCol}'`);
      }
      return key;
    }

    function filterTrauma(rows: ExcelRow[], descCol: string | null, hcpcsCol: string): ExcelRow[] {
      if (!modifierCriteria.ignoreTrauma || !descCol) return rows;
      return rows.filter(row => {
        const code = String(row[hcpcsCol] || "");
        const desc = String(row[descCol] || "").toLowerCase();
        if (["99284", "99285", "99291"].includes(code) && desc.includes("trauma team")) {
          return false;
        }
        return true;
      });
    }

    const filteredA = filterTrauma(rowsA, descColA, hcpcsColA);
    const filteredB = filterTrauma(rowsB, descColB, hcpcsColB);
    // Diagnostics: log filtered counts
    console.log(`[DIAG] filteredA count: ${filteredA.length}, filteredB count: ${filteredB.length}`);
    const mapA = new Map(filteredA.map(row => [getCompareKey(row, hcpcsColA, modifierColA), row]));
    const mapB = new Map(filteredB.map(row => [getCompareKey(row, hcpcsColB, modifierColB), row]));
    // Diagnostics: log map keys
    console.log("[DIAG] mapA keys:", Array.from(mapA.keys()).slice(0, 10));
    console.log("[DIAG] mapB keys:", Array.from(mapB.keys()).slice(0, 10));
    // Only include records from A that have a match in B
    const matchedKeys = Array.from(mapB.keys()).filter((key: string) => mapA.has(key));
    console.log(`[DIAG] matchedKeys count: ${matchedKeys.length}`);
    const allColumns = [
      ...columnsA,
      ...columnsB.filter((col) => !columnsA.some((c) => c.field === col.field)),
    ];
    setMergedColumns(allColumns);
    // Build merged rows: for each match, use B's data, keep A's id
    const merged: ExcelRow[] = matchedKeys.map((key: string, idx: number) => {
      const rowA = mapA.get(key);
      const rowB = mapB.get(key);
      const mergedRow: ExcelRow = { id: rowA?.id ?? idx };
      allColumns.forEach((col) => {
        mergedRow[col.field] = rowB?.[col.field] ?? rowA?.[col.field] ?? "";
      });
      return mergedRow;
    });
    setMergedRows(merged);
    setMergedForExport(merged);

    // --- New: Collect errors (B not matched) and dups (B with duplicate CDM numbers) ---
    // 1. Errors: records from B not matched with A
    const unmatchedB = filteredB.filter(row => !mapA.has(getCompareKey(row, hcpcsColB, modifierColB)));
    setUnmatchedB(unmatchedB);
    // 2. Dups: records from B with duplicate compare key (full field value, not parsed)
    // Use the raw value from the HCPCS column (and Modifier column if present) as the key
    const getRawKey = (row: ExcelRow, hcpcsCol: string, modifierCol: string | null): string => {
      const hcpcs = String(row[hcpcsCol] || "").toUpperCase().trim();
      const modifier = modifierCol ? String(row[modifierCol] || "").toUpperCase().trim() : "";
      // If there's a modifier column, use both; otherwise, use the full HCPCS field as-is
      return modifierCol ? `${hcpcs}-${modifier}` : hcpcs;
    };
    const rawKeyCount: Record<string, number> = {};
    filteredB.forEach(row => {
      const key = getRawKey(row, hcpcsColB, modifierColB);
      if (key) rawKeyCount[key] = (rawKeyCount[key] || 0) + 1;
    });
    const dupsB = filteredB.filter(row => {
      const key = getRawKey(row, hcpcsColB, modifierColB);
      return key && rawKeyCount[key] > 1;
    });
    setDupsB(dupsB);
    setShowCompare(true);
  };

  const handleExport = () => {
    if (!mergedForExport || mergedForExport.length === 0) return;
    // Remove id for export
    const clean = (rows: ExcelRow[]) => rows.map(row => {
      const result: { [key: string]: string | number | undefined } = {};
      Object.keys(row).forEach((key) => {
        if (key !== "id") {
          result[key] = row[key];
        }
      });
      return result;
    });
    const wsMerged = XLSX.utils.json_to_sheet(clean(mergedForExport));
    const wsDups = XLSX.utils.json_to_sheet(clean(dupsB || []));
    const wsErrors = XLSX.utils.json_to_sheet(clean(unmatchedB || []));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsMerged, "Merged");
    XLSX.utils.book_append_sheet(wb, wsDups, "Dups");
    XLSX.utils.book_append_sheet(wb, wsErrors, "Errors");
    XLSX.writeFile(wb, "merged_result.xlsx");
  };

  const handleDragEnter = (which: "A" | "B") => {
    if (which === "A") setDragOverA(true);
    else setDragOverB(true);
  };
  const handleDragLeave = (which: "A" | "B") => {
    if (which === "A") setDragOverA(false);
    else setDragOverB(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, which: "A" | "B") => {
    e.preventDefault();
    e.stopPropagation();
    if (which === "A") setDragOverA(false);
    else setDragOverB(false);
    let file: File | null = null;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f && (f.name.endsWith(".xls") || f.name.endsWith(".xlsx"))) {
            file = f;
            break;
          }
        }
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i];
        if (f.name.endsWith(".xls") || f.name.endsWith(".xlsx")) {
          file = f;
          break;
        }
      }
    }
    if (file) handleFileUpload(file, which);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, which: "A" | "B") => {
    e.preventDefault();
    e.stopPropagation();
    if (which === "A" && !dragOverA) setDragOverA(true);
    if (which === "B" && !dragOverB) setDragOverB(true);
  };

  const handleModifierChange = (key: keyof typeof modifierCriteria) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setModifierCriteria((prev) => ({ ...prev, [key]: e.target.checked }));
  };

  // Add a reset handler
  const handleReset = () => {
    setRowsA([]);
    setColumnsA([]);
    setRowsB([]);
    setColumnsB([]);
    setMergedRows([]);
    setMergedColumns([]);
    setShowCompare(false);
    setCompareError("");
    setUnmatchedB([]);
    setDupsB([]);
    setMergedForExport([]);
    setLastFileA("");
    setLastFileB("");
    if (fileAInputRef.current) fileAInputRef.current.value = "";
    if (fileBInputRef.current) fileBInputRef.current.value = "";
    localStorage.removeItem("lastFileA");
    localStorage.removeItem("lastFileB");
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Excel Import Demo (Dual File)
      </Typography>
      <Button variant="outlined" color="error" sx={{ mb: 2, ml: 2 }} onClick={handleReset}>
        Reset Form
      </Button>
      {/* Modifier Criteria Button and Dialog */}
      <Button variant="outlined" sx={{ mb: 2 }} onClick={() => setModifierDialogOpen(true)}>
        Modifier Criteria
      </Button>
      <Dialog open={modifierDialogOpen} onClose={() => setModifierDialogOpen(false)}>
        <DialogTitle>Change Modifier Criteria</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>Change Modifier Criteria Below</Typography>
          <FormGroup>
            <FormControlLabel control={<Checkbox checked={modifierCriteria.root00} onChange={handleModifierChange('root00')} />} label="Use Root HCPCS for -00's" />
            <FormControlLabel control={<Checkbox checked={modifierCriteria.root25} onChange={handleModifierChange('root25')} />} label="Use Root HCPCS for -25's" />
            <FormControlLabel control={<Checkbox checked={modifierCriteria.ignoreTrauma} onChange={handleModifierChange('ignoreTrauma')} />} label="Ignore Trauma Teams" />
            <FormControlLabel control={<Checkbox checked={modifierCriteria.root50} onChange={handleModifierChange('root50')} />} label="Use Root HCPCS for -50's" />
            <FormControlLabel control={<Checkbox checked={modifierCriteria.root59} onChange={handleModifierChange('root59')} />} label="Use Root HCPCS for -59's" />
            <FormControlLabel control={<Checkbox checked={modifierCriteria.rootXU} onChange={handleModifierChange('rootXU')} />} label="Use Root HCPCS for -XU's" />
            <FormControlLabel control={<Checkbox checked={modifierCriteria.root76} onChange={handleModifierChange('root76')} />} label="Use Root HCPCS for -76's" />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModifierDialogOpen(false)} variant="contained">OK</Button>
          <Button onClick={() => setModifierDialogOpen(false)} variant="outlined">Cancel</Button>
        </DialogActions>
      </Dialog>
      <Box sx={{ display: "flex", gap: 4, mb: 4 }}>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Box
            onDrop={(e) => handleDrop(e, "A")}
            onDragOver={(e) => handleDragOver(e, "A")}
            onDragEnter={() => handleDragEnter("A")}
            onDragLeave={() => handleDragLeave("A")}
            sx={{
              flex: 1,
              border: dragOverA ? "3px solid #1976d2" : "2px dashed #888",
              borderRadius: 2,
              p: 2,
              minHeight: 420,
              mb: 1,
              textAlign: "center",
              bgcolor: dragOverA ? "#e3f2fd" : "background.paper",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              transition: "border 0.2s, background 0.2s"
            }}
          >
            <Typography variant="subtitle1" sx={{ pointerEvents: dragOverA ? "none" : "auto" }}>File A</Typography>
            {rowsA.length > 0 && columnsA.length > 0 && (
              <Box sx={{ height: 400, width: "100%", mb: 2, pointerEvents: dragOverA ? "none" : "auto" }}>
                <DataGrid rows={rowsA} columns={columnsA} />
              </Box>
            )}
            <Button variant="contained" component="label" sx={{ pointerEvents: dragOverA ? "none" : "auto" }}>
              Upload File A
              <input
                type="file"
                accept=".xlsx,.xls"
                hidden
                ref={fileAInputRef}
                onChange={(e) => handleFileUpload(e, "A")}
              />
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 1, pointerEvents: dragOverA ? "none" : "auto" }}>
              {lastFileA ? `Last: ${lastFileA}` : "Drag & drop or click to upload"}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Box
            onDrop={(e) => {
              if (!modifierDialogOpen) handleDrop(e, "B");
            }}
            onDragOver={(e) => {
              if (!modifierDialogOpen) handleDragOver(e, "B");
            }}
            onDragEnter={() => {
              if (!modifierDialogOpen) handleDragEnter("B");
            }}
            onDragLeave={() => {
              if (!modifierDialogOpen) handleDragLeave("B");
            }}
            sx={{
              flex: 1,
              border: dragOverB ? "3px solid #1976d2" : "2px dashed #888",
              borderRadius: 2,
              p: 2,
              minHeight: 420,
              mb: 1,
              textAlign: "center",
              bgcolor: dragOverB ? "#e3f2fd" : "background.paper",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              transition: "border 0.2s, background 0.2s"
            }}
          >
            <Typography variant="subtitle1" sx={{ pointerEvents: dragOverB ? "none" : "auto" }}>File B</Typography>
            {rowsB.length > 0 && columnsB.length > 0 && (
              <Box sx={{ height: 400, width: "100%", mb: 2, pointerEvents: dragOverB ? "none" : "auto" }}>
                <DataGrid rows={rowsB} columns={columnsB} />
              </Box>
            )}
            <Button variant="contained" component="label" sx={{ pointerEvents: dragOverB ? "none" : "auto" }}>
              Upload File B
              <input
                type="file"
                accept=".xlsx,.xls"
                hidden
                ref={fileBInputRef}
                onChange={(e) => handleFileUpload(e, "B")}
              />
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 1, pointerEvents: dragOverB ? "none" : "auto" }}>
              {lastFileB ? `Last: ${lastFileB}` : "Drag & drop or click to upload"}
            </Typography>
          </Box>
        </Box>
      </Box>
      {rowsA.length > 0 && rowsB.length > 0 && compareError && (
        <Box sx={{ mb: 2 }}>
          <Typography color="error">{compareError}</Typography>
        </Box>
      )}
      {rowsA.length > 0 && rowsB.length > 0 && !compareError && (
        <Box sx={{ mb: 2 }}>
          <Button
            variant="contained"
            onClick={handleCompare}
          >
            Compare
          </Button>
        </Box>
      )}
      {rowsA.length > 0 && rowsB.length > 0 && sharedColumns.length === 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography color="error">
            No shared columns found between File A and File B. Cannot compare.
          </Typography>
        </Box>
      )}
      {showCompare && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Comparison Result
          </Typography>
          <Button variant="contained" sx={{ mb: 2 }} onClick={handleExport}>
            Export Merged
          </Button>
          <Box sx={{ height: 500, width: "100%" }}>
            <DataGrid
              rows={mergedRows}
              columns={mergedColumns}
              getRowClassName={() => ""}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
