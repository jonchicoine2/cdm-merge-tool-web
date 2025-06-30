"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button, Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, FormGroup, FormControlLabel, Checkbox, TextField, InputAdornment } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import * as XLSX from "xlsx";

// Define a type for Excel rows with dynamic fields, plus id
interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
}

export default function ExcelImportPage() {
  const [rowsMaster, setRowsMaster] = useState<ExcelRow[]>([]);
  const [columnsMaster, setColumnsMaster] = useState<GridColDef[]>([]);
  const [rowsClient, setRowsClient] = useState<ExcelRow[]>([]);
  const [columnsClient, setColumnsClient] = useState<GridColDef[]>([]);
  const [mergedRows, setMergedRows] = useState<ExcelRow[]>([]);
  const [mergedColumns, setMergedColumns] = useState<GridColDef[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const fileMasterInputRef = useRef<HTMLInputElement>(null);
  const fileClientInputRef = useRef<HTMLInputElement>(null);
  const [dragOverMaster, setDragOverMaster] = useState(false);
  const [dragOverClient, setDragOverClient] = useState(false);
  const [lastMasterFile, setLastMasterFile] = useState<string | null>(null);
  const [lastClientFile, setLastClientFile] = useState<string | null>(null);
  const [lastMasterData, setLastMasterData] = useState<string | null>(null);
  const [lastClientData, setLastClientData] = useState<string | null>(null);
  useEffect(() => {
    const lastMaster = localStorage.getItem("lastMasterFile");
    const lastMasterData = localStorage.getItem("lastMasterData");
    if (lastMaster) {
      setLastMasterFile(lastMaster);
    }
    if (lastMasterData) {
      setLastMasterData(lastMasterData);
    }
    const lastClient = localStorage.getItem("lastClientFile");
    const lastClientData = localStorage.getItem("lastClientData");
    if (lastClient) {
      setLastClientFile(lastClient);
    }
    if (lastClientData) {
      setLastClientData(lastClientData);
    }
  }, []);

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
  const [unmatchedClient, setUnmatchedClient] = useState<ExcelRow[]>([]);
  const [dupsClient, setDupsClient] = useState<ExcelRow[]>([]);
  const [mergedForExport, setMergedForExport] = useState<ExcelRow[]>([]);

  // Search state for each grid
  const [searchMaster, setSearchMaster] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [searchMerged, setSearchMerged] = useState("");

  // Tab state for errors and duplicates
  const [errorsTabValue, setErrorsTabValue] = useState(0);

  // Filter function for search
  const filterRows = (rows: ExcelRow[], searchTerm: string): ExcelRow[] => {
    if (!searchTerm.trim()) return rows;
    
    const lowercaseSearch = searchTerm.toLowerCase();
    return rows.filter(row => 
      Object.values(row).some(value => 
        String(value).toLowerCase().includes(lowercaseSearch)
      )
    );
  };

  // Filtered data for each grid
  const filteredRowsMaster = filterRows(rowsMaster, searchMaster);
  const filteredRowsClient = filterRows(rowsClient, searchClient);
  const filteredMergedRows = filterRows(mergedRows, searchMerged);
  const filteredUnmatchedClient = filterRows(unmatchedClient, "");
  const filteredDupsClient = filterRows(dupsClient, "");

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement> | File,
    which: "Master" | "Client"
  ) => {
    let file: File | undefined;
    if (e instanceof File) {
      file = e;
    } else {
      file = e.target.files?.[0];
    }
    if (!file) return;

    // Save the file name to localStorage and update state
    if (which === "Master") {
      localStorage.setItem("lastMasterFile", file.name);
      setLastMasterFile(file.name);
    } else {
      localStorage.setItem("lastClientFile", file.name);
      setLastClientFile(file.name);
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;
      
      // Save file data to localStorage for reload functionality
      if (which === "Master") {
        localStorage.setItem("lastMasterData", data as string);
        setLastMasterData(data as string);
      } else {
        localStorage.setItem("lastClientData", data as string);
        setLastClientData(data as string);
      }
      
      processFileData(data as string, which);
    };
    reader.readAsBinaryString(file);
  };

  // Compare logic
  // Remove mergeSource state and related code

  // Find HCPCS and Modifier columns for each file independently
  const getHCPCSColumnMaster = () => columnsMaster.find(col => col.field.toLowerCase() === "hcpcs")?.field || null;
  const getHCPCSColumnClient = () => columnsClient.find(col => col.field.toLowerCase() === "hcpcs")?.field || null;
  const getModifierColumnMaster = () => columnsMaster.find(col => col.field.toLowerCase() === "modifier")?.field || null;
  const getModifierColumnClient = () => columnsClient.find(col => col.field.toLowerCase() === "modifier")?.field || null;

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
    const hcpcsColMaster = getHCPCSColumnMaster();
    const hcpcsColClient = getHCPCSColumnClient();
    const modifierColMaster = getModifierColumnMaster();
    const modifierColClient = getModifierColumnClient();
    if (!hcpcsColMaster || !hcpcsColClient) {
      setShowCompare(false);
      console.error('Both files must have a "HCPCS" column to compare.');
      return;
    }
    const descColMaster = getDescriptionCol(columnsMaster);
    const descColClient = getDescriptionCol(columnsClient);

    // Diagnostics: log columns and sample rows
    console.log("[DIAG] columnsMaster:", columnsMaster.map(c => c.field));
    console.log("[DIAG] columnsClient:", columnsClient.map(c => c.field));
    console.log("[DIAG] hcpcsColMaster:", hcpcsColMaster, ", hcpcsColClient:", hcpcsColClient, ", modifierColMaster:", modifierColMaster, ", modifierColClient:", modifierColClient);
    if (rowsMaster.length > 0) console.log("[DIAG] Sample rowMaster:", rowsMaster[0]);
    if (rowsClient.length > 0) console.log("[DIAG] Sample rowClient:", rowsClient[0]);

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

    const filteredMaster = filterTrauma(rowsMaster, descColMaster, hcpcsColMaster);
    const filteredClient = filterTrauma(rowsClient, descColClient, hcpcsColClient);
    // Diagnostics: log filtered counts
    console.log(`[DIAG] filteredMaster count: ${filteredMaster.length}, filteredClient count: ${filteredClient.length}`);
    const mapMaster = new Map(filteredMaster.map(row => [getCompareKey(row, hcpcsColMaster, modifierColMaster), row]));
    const mapClient = new Map(filteredClient.map(row => [getCompareKey(row, hcpcsColClient, modifierColClient), row]));
    // Diagnostics: log map keys
    console.log("[DIAG] mapMaster keys:", Array.from(mapMaster.keys()).slice(0, 10));
    console.log("[DIAG] mapClient keys:", Array.from(mapClient.keys()).slice(0, 10));
    // Only include records from Master that have a match in Client
    const matchedKeys = Array.from(mapClient.keys()).filter((key: string) => mapMaster.has(key));
    console.log(`[DIAG] matchedKeys count: ${matchedKeys.length}`);
    const allColumns = [
      ...columnsMaster,
      ...columnsClient.filter((col) => !columnsMaster.some((c) => c.field === col.field)),
    ];
    setMergedColumns(allColumns);
    // Build merged rows: for each match, use Client's data, keep Master's id
    const merged: ExcelRow[] = matchedKeys.map((key: string, idx: number) => {
      const rowMaster = mapMaster.get(key);
      const rowClient = mapClient.get(key);
      const mergedRow: ExcelRow = { id: rowMaster?.id ?? idx };
      allColumns.forEach((col) => {
        mergedRow[col.field] = rowClient?.[col.field] ?? rowMaster?.[col.field] ?? "";
      });
      return mergedRow;
    });
    setMergedRows(merged);
    setMergedForExport(merged);

    // --- New: Collect errors (Client not matched) and dups (Client with duplicate CDM numbers) ---
    // 1. Errors: records from Client not matched with Master
    const unmatchedClient = filteredClient.filter(row => !mapMaster.has(getCompareKey(row, hcpcsColClient, modifierColClient)));
    setUnmatchedClient(unmatchedClient);
    // 2. Dups: records from Client with duplicate compare key (full field value, not parsed)
    // Use the raw value from the HCPCS column (and Modifier column if present) as the key
    const getRawKey = (row: ExcelRow, hcpcsCol: string, modifierCol: string | null): string => {
      const hcpcs = String(row[hcpcsCol] || "").toUpperCase().trim();
      const modifier = modifierCol ? String(row[modifierCol] || "").toUpperCase().trim() : "";
      // If there's a modifier column, use both; otherwise, use the full HCPCS field as-is
      return modifierCol ? `${hcpcs}-${modifier}` : hcpcs;
    };
    const rawKeyCount: Record<string, number> = {};
    filteredClient.forEach(row => {
      const key = getRawKey(row, hcpcsColClient, modifierColClient);
      if (key) rawKeyCount[key] = (rawKeyCount[key] || 0) + 1;
    });
    const duplicateKeys = Object.keys(rawKeyCount).filter(key => rawKeyCount[key] > 1);
    const dupsClient = filteredClient.filter(row => duplicateKeys.includes(getRawKey(row, hcpcsColClient, modifierColClient)));
    setDupsClient(dupsClient);
    setShowCompare(true);
    // Diagnostics: log unmatched and duplicates
    console.log(`[DIAG] unmatchedClient count: ${unmatchedClient.length}`);
    console.log(`[DIAG] dupsClient count: ${dupsClient.length}`);
    if (unmatchedClient.length > 0) console.log("[DIAG] Sample unmatched Client record:", unmatchedClient[0]);
    if (dupsClient.length > 0) console.log("[DIAG] Sample duplicate Client record:", dupsClient[0]);
  };

  const handleExport = () => {
    if (mergedForExport.length === 0) return;
    const wb = XLSX.utils.book_new();
    const clean = (rows: ExcelRow[]) => rows.map(row => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = row;
      return rest;
    });
    const ws = XLSX.utils.json_to_sheet(clean(mergedForExport));
    XLSX.utils.book_append_sheet(wb, ws, "Merged");
    
    // Always include Unmatched_Client sheet, even if empty
    const wsErrors = XLSX.utils.json_to_sheet(clean(unmatchedClient));
    XLSX.utils.book_append_sheet(wb, wsErrors, "Unmatched_Client");
    
    // Always include Duplicate_Client sheet, even if empty
    const wsDups = XLSX.utils.json_to_sheet(clean(dupsClient));
    XLSX.utils.book_append_sheet(wb, wsDups, "Duplicate_Client");
    XLSX.writeFile(wb, "merged_data.xlsx");
  };

  const handleDragEnter = (which: "Master" | "Client") => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (which === "Master") setDragOverMaster(true);
    else setDragOverClient(true);
  };
  const handleDragLeave = (which: "Master" | "Client") => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (which === "Master") setDragOverMaster(false);
    else setDragOverClient(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, which: "Master" | "Client") => {
    e.preventDefault();
    if (which === "Master") setDragOverMaster(false);
    else setDragOverClient(false);
    const files = e.dataTransfer.files;
    if (files.length) {
      handleFileUpload(files[0], which);
    }
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, which: "Master" | "Client") => {
    e.preventDefault();
    if (which === "Master" && !dragOverMaster) setDragOverMaster(true);
    if (which === "Client" && !dragOverClient) setDragOverClient(true);
  };

  const processFileData = (data: string, which: "Master" | "Client") => {
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
    if (which === "Master") {
      setColumnsMaster(columns);
      setRowsMaster(Array.from(rows));
    } else {
      setColumnsClient(columns);
      setRowsClient(Array.from(rows));
    }
  };

  const handleLoadLastFile = (which: "Master" | "Client") => {
    if (which === "Master" && lastMasterData) {
      processFileData(lastMasterData, "Master");
    } else if (which === "Client" && lastClientData) {
      processFileData(lastClientData, "Client");
    }
  };

  const handleModifierChange = (key: keyof typeof modifierCriteria) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setModifierCriteria({ ...modifierCriteria, [key]: e.target.checked });
  };

  const handleReset = () => {
    setRowsMaster([]);
    setColumnsMaster([]);
    setRowsClient([]);
    setColumnsClient([]);
    setMergedRows([]);
    setMergedColumns([]);
    setShowCompare(false);
    if (fileMasterInputRef.current) fileMasterInputRef.current.value = "";
    if (fileClientInputRef.current) fileClientInputRef.current.value = "";
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Excel File Merge Tool
      </Typography>
      
      {/* Original Data Section - Unified Upload/Grid Areas */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          Original Data
        </Typography>
        <Box sx={{ 
          display: "flex", 
          gap: 2,
          flexDirection: { xs: 'column', md: 'row' },
          width: '100%',
          mb: 4
        }}>
        {/* Master File Area */}
        <Box sx={{ 
          flex: 1,
          minWidth: 0
        }}>
          {rowsMaster.length > 0 ? (
            // Show grid when data is loaded
            <>
              <Typography variant="h6" gutterBottom>Master Data ({rowsMaster.length} records)</Typography>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search master data..."
                value={searchMaster}
                onChange={(e) => setSearchMaster(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'white',
                    '& fieldset': {
                      borderColor: '#ccc',
                    },
                    '&:hover fieldset': {
                      borderColor: '#999',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#1976d2',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: 'black',
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: '#666',
                    opacity: 1,
                  }
                }}
              />
              <Box sx={{ height: 400, width: "100%" }}>
                <DataGrid 
                  rows={filteredRowsMaster} 
                  columns={columnsMaster}
                  density="compact"
                  disableRowSelectionOnClick
                />
              </Box>
            </>
          ) : (
            // Show upload area when no data
            <Box
              sx={{
                height: 480,
                border: dragOverMaster ? '2px dashed #007bff' : '2px dashed #aaa',
                padding: '20px',
                textAlign: 'center',
                backgroundColor: dragOverMaster ? '#f0f8ff' : '#fafafa',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              onDragEnter={handleDragEnter("Master")}
              onDragLeave={handleDragLeave("Master")}
              onDragOver={(e) => handleDragOver(e, "Master")}
              onDrop={(e) => handleDrop(e, "Master")}
            >
              <Typography variant="h6" sx={{ mb: 2 }}>Master File</Typography>
              <Button variant="contained" component="label" sx={{ mb: 2 }}>
                Upload Master File
                <input
                  type="file"
                  hidden
                  onChange={(e) => handleFileUpload(e, "Master")}
                  ref={fileMasterInputRef}
                  accept=".xlsx, .xls"
                />
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Drag and drop your Excel file here or click to browse
              </Typography>
            </Box>
          )}
        </Box>

        {/* Client File Area */}
        <Box sx={{ 
          flex: 1,
          minWidth: 0
        }}>
          {rowsClient.length > 0 ? (
            // Show grid when data is loaded
            <>
              <Typography variant="h6" gutterBottom>Client Data ({rowsClient.length} records)</Typography>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search client data..."
                value={searchClient}
                onChange={(e) => setSearchClient(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'white',
                    '& fieldset': {
                      borderColor: '#ccc',
                    },
                    '&:hover fieldset': {
                      borderColor: '#999',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#1976d2',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: 'black',
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: '#666',
                    opacity: 1,
                  }
                }}
              />
              <Box sx={{ height: 400, width: "100%" }}>
                <DataGrid 
                  rows={filteredRowsClient} 
                  columns={columnsClient}
                  density="compact"
                  disableRowSelectionOnClick
                />
              </Box>
            </>
          ) : (
            // Show upload area when no data
            <Box
              sx={{
                height: 480,
                border: dragOverClient ? '2px dashed #007bff' : '2px dashed #aaa',
                padding: '20px',
                textAlign: 'center',
                backgroundColor: dragOverClient ? '#f0f8ff' : '#fafafa',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              onDragEnter={handleDragEnter("Client")}
              onDragLeave={handleDragLeave("Client")}
              onDragOver={(e) => handleDragOver(e, "Client")}
              onDrop={(e) => handleDrop(e, "Client")}
            >
              <Typography variant="h6" sx={{ mb: 2 }}>Client File</Typography>
              <Button variant="contained" component="label" sx={{ mb: 2 }}>
                Upload Client File
                <input
                  type="file"
                  hidden
                  onChange={(e) => handleFileUpload(e, "Client")}
                  ref={fileClientInputRef}
                  accept=".xlsx, .xls"
                />
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Drag and drop your Excel file here or click to browse
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      </Box>
      
      {/* Load Last File buttons */}
      {(lastMasterData || lastClientData) && (
        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 2 }}>
          <Button 
            variant="outlined" 
            onClick={() => handleLoadLastFile("Master")}
            disabled={!lastMasterData}
          >
            Load Last Master: {lastMasterFile || "Unknown"}
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => handleLoadLastFile("Client")}
            disabled={!lastClientData}
          >
            Load Last Client: {lastClientFile || "Unknown"}
          </Button>
        </Box>
      )}
      
      <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 2 }}>
        <Button variant="contained" onClick={handleCompare} disabled={rowsMaster.length === 0 || rowsClient.length === 0}>
          Compare
        </Button>
        <Button variant="contained" onClick={handleExport} disabled={mergedForExport.length === 0}>
          Export Merged Data
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" onClick={handleReset}>
          Reset
        </Button>
      </Box>
      
      {/* Modifier Criteria Dialog */}
      <Dialog open={modifierDialogOpen} onClose={() => setModifierDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier Criteria</DialogTitle>
        <DialogContent>
          <FormGroup>
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.root00} onChange={handleModifierChange("root00")} />}
              label="Include Root 00"
            />
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.root25} onChange={handleModifierChange("root25")} />}
              label="Include Root 25"
            />
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.ignoreTrauma} onChange={handleModifierChange("ignoreTrauma")} />}
              label="Ignore Trauma Team Codes"
            />
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.root50} onChange={handleModifierChange("root50")} />}
              label="Include Root 50"
            />
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.root59} onChange={handleModifierChange("root59")} />}
              label="Include Root 59"
            />
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.rootXU} onChange={handleModifierChange("rootXU")} />}
              label="Include Root XU"
            />
            <FormControlLabel
              control={<Checkbox checked={modifierCriteria.root76} onChange={handleModifierChange("root76")} />}
              label="Include Root 76"
            />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModifierDialogOpen(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Compare Results Section */}
      {showCompare && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            Compare Results
          </Typography>
          
          {/* Merged Results */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>Merged Data ({mergedRows.length} records)</Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search merged data..."
              value={searchMerged}
              onChange={(e) => setSearchMerged(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                  '& fieldset': {
                    borderColor: '#ccc',
                  },
                  '&:hover fieldset': {
                    borderColor: '#999',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1976d2',
                  },
                },
                '& .MuiInputBase-input': {
                  color: 'black',
                },
                '& .MuiInputBase-input::placeholder': {
                  color: '#666',
                  opacity: 1,
                }
              }}
            />
            <Box sx={{ height: 400, width: "100%" }}>
              <DataGrid 
                rows={filteredMergedRows} 
                columns={mergedColumns}
                density="compact"
                disableRowSelectionOnClick
              />
            </Box>
          </Box>
          
          {/* Errors and Duplicates Tabs */}
          <Box sx={{ display: 'flex', gap: 1, borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Button
              variant={errorsTabValue === 0 ? "contained" : "outlined"}
              onClick={() => setErrorsTabValue(0)}
              size="small"
            >
              Unmatched Records ({unmatchedClient.length})
            </Button>
            <Button
              variant={errorsTabValue === 1 ? "contained" : "outlined"}
              onClick={() => setErrorsTabValue(1)}
              size="small"
            >
              Duplicate Records ({dupsClient.length})
            </Button>
          </Box>
          
          {/* Unmatched Records Grid */}
          {errorsTabValue === 0 && (
            <Box sx={{ height: 400, width: "100%", mb: 4 }}>
              {unmatchedClient.length > 0 ? (
                <DataGrid 
                  rows={filteredUnmatchedClient} 
                  columns={columnsClient}
                  density="compact"
                  disableRowSelectionOnClick
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="body1" color="text.secondary">
                    No unmatched records found.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          
          {/* Duplicate Records Grid */}
          {errorsTabValue === 1 && (
            <Box sx={{ height: 400, width: "100%" }}>
              {dupsClient.length > 0 ? (
                <DataGrid 
                  rows={filteredDupsClient} 
                  columns={columnsClient}
                  density="compact"
                  disableRowSelectionOnClick
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="body1" color="text.secondary">
                    No duplicate records found.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          
        </Box>
      )}
    </Box>
  );
}
