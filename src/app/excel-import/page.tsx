"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button, Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, FormGroup, FormControlLabel, Checkbox, TextField, InputAdornment, Tabs, Tab, Card, CardContent, Chip, Grid, Divider } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import * as XLSX from "xlsx";

// Define a type for Excel rows with dynamic fields, plus id
interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
}

interface FileMetadata {
  name: string;
  size: number;
  uploadTime: Date;
  sheetCount: number;
  recordCount: number;
  columnCount: number;
}

interface ComparisonStats {
  totalMasterRecords: number;
  totalClientRecords: number;
  matchedRecords: number;
  unmatchedRecords: number;
  duplicateRecords: number;
  matchRate: number;
  processingTime: number;
  columnsMatched: number;
  totalMasterColumns: number;
  totalClientColumns: number;
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
  
  // Sheet management state
  const [masterSheetData, setMasterSheetData] = useState<{[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}}>({});
  const [clientSheetData, setClientSheetData] = useState<{[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}}>({});
  const [activeMasterTab, setActiveMasterTab] = useState<number>(0);
  const [activeClientTab, setActiveClientTab] = useState<number>(0);
  const [masterSheetNames, setMasterSheetNames] = useState<string[]>([]);
  const [clientSheetNames, setClientSheetNames] = useState<string[]>([]);
  const [lastMasterSheet, setLastMasterSheet] = useState<string | null>(null);
  const [lastClientSheet, setLastClientSheet] = useState<string | null>(null);
  const [mergedSheetInfo, setMergedSheetInfo] = useState<{masterSheet: string, clientSheet: string} | null>(null);
  
  // File metadata state
  const [masterFileMetadata, setMasterFileMetadata] = useState<FileMetadata | null>(null);
  const [clientFileMetadata, setClientFileMetadata] = useState<FileMetadata | null>(null);
  
  // Comparison statistics state
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(null);
  const [comparisonStartTime, setComparisonStartTime] = useState<number | null>(null);
  
  // Client-side hydration state
  const [isClient, setIsClient] = useState(false);
  
  // Initialize client-side state
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (!isClient) return;
    const lastMaster = localStorage.getItem("lastMasterFile");
    const lastMasterData = localStorage.getItem("lastMasterData");
    const lastMasterSheet = localStorage.getItem("lastMasterSheet");
    const lastMasterMetadata = localStorage.getItem("lastMasterMetadata");
    if (lastMaster) {
      setLastMasterFile(lastMaster);
    }
    if (lastMasterData) {
      setLastMasterData(lastMasterData);
    }
    if (lastMasterSheet) {
      setLastMasterSheet(lastMasterSheet);
    }
    if (lastMasterMetadata) {
      try {
        const metadata = JSON.parse(lastMasterMetadata);
        // Convert uploadTime back to Date object
        metadata.uploadTime = new Date(metadata.uploadTime);
        setMasterFileMetadata(metadata);
      } catch (e) {
        console.error('Failed to parse master metadata:', e);
      }
    }
    const lastClient = localStorage.getItem("lastClientFile");
    const lastClientData = localStorage.getItem("lastClientData");
    const lastClientSheet = localStorage.getItem("lastClientSheet");
    const lastClientMetadata = localStorage.getItem("lastClientMetadata");
    if (lastClient) {
      setLastClientFile(lastClient);
    }
    if (lastClientData) {
      setLastClientData(lastClientData);
    }
    if (lastClientSheet) {
      setLastClientSheet(lastClientSheet);
    }
    if (lastClientMetadata) {
      try {
        const metadata = JSON.parse(lastClientMetadata);
        // Convert uploadTime back to Date object
        metadata.uploadTime = new Date(metadata.uploadTime);
        setClientFileMetadata(metadata);
      } catch (e) {
        console.error('Failed to parse client metadata:', e);
      }
    }
  }, [isClient]);
  
  // Auto-trigger comparison when both files are loaded
  useEffect(() => {
    if (rowsMaster.length > 0 && rowsClient.length > 0 && !showCompare) {
      console.log('[DEBUG] Auto-triggering comparison - rowsMaster:', rowsMaster.length, 'rowsClient:', rowsClient.length);
      handleCompare();
    }
  }, [rowsMaster.length, rowsClient.length, showCompare, handleCompare]);
  
  // Debug tab state
  useEffect(() => {
    console.log('[DEBUG] Master sheets:', masterSheetNames, 'Active tab:', activeMasterTab);
    console.log('[DEBUG] Client sheets:', clientSheetNames, 'Active tab:', activeClientTab);
  }, [masterSheetNames, clientSheetNames, activeMasterTab, activeClientTab]);
  
  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // File information card component with consistent theming
  const FileInfoCard = ({ metadata, type }: { metadata: FileMetadata | null, type: 'Master' | 'Client' }) => {
    console.log(`[DEBUG] FileInfoCard render - ${type}:`, metadata, 'isClient:', isClient);
    
    if (!isClient) {
      console.log(`[DEBUG] Not client-side yet, not rendering ${type} card`);
      return null;
    }
    
    if (!metadata) {
      console.log(`[DEBUG] No metadata for ${type}, not rendering card`);
      return null;
    }
    
    console.log(`[DEBUG] Rendering ${type} FileInfoCard with metadata:`, metadata);
    
    return (
      <Box sx={{ 
        mb: 1, 
        p: 1.5,
        backgroundColor: '#f8fbff', 
        border: '2px solid #2196f3',
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap'
      }}>
        <Typography variant="body2" sx={{ 
          fontWeight: 'bold', 
          color: '#1976d2',
          minWidth: '120px'
        }}>
          📄 {metadata.name}
        </Typography>
        <Chip 
          size="small" 
          label={formatFileSize(metadata.size)} 
          sx={{ 
            backgroundColor: '#1976d2', 
            color: 'white',
            fontSize: '0.75rem',
            height: '24px'
          }}
        />
        <Chip 
          size="small" 
          label={`${metadata.sheetCount} sheet${metadata.sheetCount !== 1 ? 's' : ''}`}
          sx={{ 
            backgroundColor: '#4caf50', 
            color: 'white',
            fontSize: '0.75rem',
            height: '24px'
          }}
        />
        <Chip 
          size="small" 
          label={`${metadata.recordCount.toLocaleString()} records`}
          sx={{ 
            backgroundColor: '#ff9800', 
            color: 'white',
            fontSize: '0.75rem',
            height: '24px'
          }}
        />
        <Typography variant="caption" sx={{ 
          color: '#666',
          ml: 'auto'
        }}>
          {metadata.uploadTime.toLocaleTimeString()}
        </Typography>
      </Box>
    );
  };
  
  // Comparison statistics panel component
  const ComparisonStatsPanel = ({ stats }: { stats: ComparisonStats | null }) => {
    if (!stats) return null;
    
    return (
      <Box sx={{
        mb: 2,
        p: 2,
        backgroundColor: '#f8fbff',
        border: '2px solid #4caf50',
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        flexWrap: 'wrap'
      }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
          📊 Results:
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip size="small" label={`${stats.matchedRecords.toLocaleString()} matched`} 
                sx={{ backgroundColor: '#4caf50', color: 'white', fontSize: '0.75rem' }} />
          <Chip size="small" label={`${stats.unmatchedRecords.toLocaleString()} unmatched`} 
                sx={{ backgroundColor: '#f44336', color: 'white', fontSize: '0.75rem' }} />
          <Chip size="small" label={`${stats.duplicateRecords.toLocaleString()} duplicates`} 
                sx={{ backgroundColor: '#ff9800', color: 'white', fontSize: '0.75rem' }} />
          <Chip size="small" label={`${stats.matchRate}% match rate`} 
                sx={{ backgroundColor: '#2196f3', color: 'white', fontSize: '0.75rem' }} />
          <Chip size="small" label={`${stats.columnsMatched} columns mapped`} 
                sx={{ backgroundColor: '#9c27b0', color: 'white', fontSize: '0.75rem' }} />
        </Box>
        
        <Typography variant="caption" sx={{ color: '#666', ml: 'auto' }}>
          {stats.processingTime}ms
        </Typography>
      </Box>
    );
  };

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
    which: "Master" | "Client",
    isRestore = false
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
      
      // Process all sheets
      const workbook = XLSX.read(data, { type: "binary" });
      const sheets = workbook.SheetNames;
      console.log(`[DEBUG] File ${which} has ${sheets.length} sheets:`, sheets);
      
      // Calculate total record count across all sheets
      let totalRecords = 0;
      let totalColumns = 0;
      sheets.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (json.length > 0) {
          totalRecords += Math.max(0, json.length - 1); // Subtract header row
          totalColumns = Math.max(totalColumns, (json[0] as any[]).length);
        }
      });
      
      // Create file metadata only for new uploads, not for restores
      if (!isRestore) {
        const metadata: FileMetadata = {
          name: file.name,
          size: file.size,
          uploadTime: new Date(),
          sheetCount: sheets.length,
          recordCount: totalRecords,
          columnCount: totalColumns
        };
        
        // Save file data and metadata
        if (which === "Master") {
          localStorage.setItem("lastMasterData", data as string);
          setLastMasterData(data as string);
          localStorage.setItem("lastMasterSheet", sheets[0]);
          setLastMasterSheet(sheets[0]);
          localStorage.setItem("lastMasterMetadata", JSON.stringify(metadata));
          setMasterFileMetadata(metadata);
          console.log('[DEBUG] Master metadata set:', metadata);
        } else {
          localStorage.setItem("lastClientData", data as string);
          setLastClientData(data as string);
          localStorage.setItem("lastClientSheet", sheets[0]);
          setLastClientSheet(sheets[0]);
          localStorage.setItem("lastClientMetadata", JSON.stringify(metadata));
          setClientFileMetadata(metadata);
          console.log('[DEBUG] Client metadata set:', metadata);
        }
      } else {
        // For restore operations, only update the data and sheet info
        if (which === "Master") {
          setLastMasterData(data as string);
          setLastMasterSheet(sheets[0]);
        } else {
          setLastClientData(data as string);
          setLastClientSheet(sheets[0]);
        }
      }
      
      // Process all sheets and store them
      processAllSheets(data as string, which, sheets);
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
  
  // Advanced column matching with multiple fallback strategies
  function findMatchingColumn(masterField: string, clientColumns: GridColDef[]): string | null {
    const clientFields = clientColumns.map(col => col.field);
    
    // Strategy 1: Exact match
    if (clientFields.includes(masterField)) {
      console.log(`[COLUMN MATCH] Exact match: ${masterField}`);
      return masterField;
    }
    
    // Strategy 2: Case-insensitive match
    const caseInsensitiveMatch = clientFields.find(field => 
      field.toLowerCase() === masterField.toLowerCase()
    );
    if (caseInsensitiveMatch) {
      console.log(`[COLUMN MATCH] Case-insensitive match: ${masterField} -> ${caseInsensitiveMatch}`);
      return caseInsensitiveMatch;
    }
    
    // Strategy 3: Normalized match (remove spaces, underscores, special chars)
    const normalizeField = (field: string) => field.toLowerCase().replace(/[\s_-]+/g, '');
    const normalizedMaster = normalizeField(masterField);
    const normalizedMatch = clientFields.find(field => 
      normalizeField(field) === normalizedMaster
    );
    if (normalizedMatch) {
      console.log(`[COLUMN MATCH] Normalized match: ${masterField} -> ${normalizedMatch}`);
      return normalizedMatch;
    }
    
    // Strategy 4: Partial match (master field contains client field or vice versa)
    const partialMatch = clientFields.find(field => {
      const masterLower = masterField.toLowerCase();
      const fieldLower = field.toLowerCase();
      return masterLower.includes(fieldLower) || fieldLower.includes(masterLower);
    });
    if (partialMatch) {
      console.log(`[COLUMN MATCH] Partial match: ${masterField} -> ${partialMatch}`);
      return partialMatch;
    }
    
    // Strategy 5: Fuzzy match for common variations
    const fuzzyMatches: {[key: string]: string[]} = {
      'hcpcs': ['hcpc', 'code', 'procedure_code', 'proc_code', 'cpt'],
      'modifier': ['mod', 'modif', 'modifier_code'],
      'description': ['desc', 'procedure_desc', 'proc_desc', 'name', 'procedure_name'],
      'quantity': ['qty', 'units', 'unit', 'count'],
      'price': ['amount', 'cost', 'charge', 'rate', 'fee'],
      'date': ['service_date', 'dos', 'date_of_service']
    };
    
    const masterLower = masterField.toLowerCase();
    for (const [standard, variations] of Object.entries(fuzzyMatches)) {
      if (masterLower.includes(standard) || variations.some(v => masterLower.includes(v))) {
        const fuzzyMatch = clientFields.find(field => {
          const fieldLower = field.toLowerCase();
          return fieldLower.includes(standard) || variations.some(v => fieldLower.includes(v));
        });
        if (fuzzyMatch) {
          console.log(`[COLUMN MATCH] Fuzzy match: ${masterField} -> ${fuzzyMatch} (via ${standard})`);
          return fuzzyMatch;
        }
      }
    }
    
    console.log(`[COLUMN MATCH] No match found for: ${masterField}`);
    return null;
  }
  
  // Create column mapping between master and client
  function createColumnMapping(masterColumns: GridColDef[], clientColumns: GridColDef[]): {[masterField: string]: string} {
    const mapping: {[masterField: string]: string} = {};
    
    masterColumns.forEach(masterCol => {
      const matchingClientField = findMatchingColumn(masterCol.field, clientColumns);
      if (matchingClientField) {
        mapping[masterCol.field] = matchingClientField;
      }
    });
    
    console.log('[COLUMN MAPPING] Final mapping:', mapping);
    return mapping;
  }

  const handleCompare = useCallback(() => {
    // Start timing the comparison
    const startTime = performance.now();
    setComparisonStartTime(startTime);
    
    // Save which sheets are being used for this merge
    const currentMasterSheet = masterSheetNames[activeMasterTab] || 'Unknown';
    const currentClientSheet = clientSheetNames[activeClientTab] || 'Unknown';
    setMergedSheetInfo({ masterSheet: currentMasterSheet, clientSheet: currentClientSheet });
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
    
    // Create column mapping and merged columns with only matching fields
    const columnMapping = createColumnMapping(columnsMaster, columnsClient);
    const matchingMasterColumns = columnsMaster.filter(col => columnMapping[col.field]);
    const matchingClientColumns = columnsClient.filter(col => 
      Object.values(columnMapping).includes(col.field) && 
      !matchingMasterColumns.some(masterCol => masterCol.field === col.field)
    );
    
    const mergedColumns = [...matchingMasterColumns, ...matchingClientColumns];
    setMergedColumns(mergedColumns);
    // Build merged rows: for each match, use mapped columns
    const merged: ExcelRow[] = matchedKeys.map((key: string, idx: number) => {
      const rowMaster = mapMaster.get(key);
      const rowClient = mapClient.get(key);
      const mergedRow: ExcelRow = { id: rowMaster?.id ?? idx };
      
      mergedColumns.forEach((col) => {
        if (columnMapping[col.field]) {
          // This is a master column with a mapped client column
          const clientField = columnMapping[col.field];
          mergedRow[col.field] = rowClient?.[clientField] ?? rowMaster?.[col.field] ?? "";
        } else if (Object.values(columnMapping).includes(col.field)) {
          // This is a client column that was mapped
          mergedRow[col.field] = rowClient?.[col.field] ?? "";
        } else {
          // Fallback for unmapped columns
          mergedRow[col.field] = rowMaster?.[col.field] ?? rowClient?.[col.field] ?? "";
        }
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
    
    // Calculate comparison statistics
    const endTime = performance.now();
    const processingTime = startTime ? endTime - startTime : 0;
    const matchRate = filteredMaster.length > 0 ? (merged.length / filteredMaster.length) * 100 : 0;
    
    const stats: ComparisonStats = {
      totalMasterRecords: filteredMaster.length,
      totalClientRecords: filteredClient.length,
      matchedRecords: merged.length,
      unmatchedRecords: unmatchedClient.length,
      duplicateRecords: dupsClient.length,
      matchRate: Math.round(matchRate * 100) / 100,
      processingTime: Math.round(processingTime),
      columnsMatched: Object.keys(columnMapping).length,
      totalMasterColumns: columnsMaster.length,
      totalClientColumns: columnsClient.length
    };
    
    setComparisonStats(stats);
    console.log('[STATS] Comparison statistics:', stats);
    
    setShowCompare(true);
    // Diagnostics: log unmatched and duplicates
    console.log(`[DIAG] unmatchedClient count: ${unmatchedClient.length}`);
    console.log(`[DIAG] dupsClient count: ${dupsClient.length}`);
    if (unmatchedClient.length > 0) console.log("[DIAG] Sample unmatched Client record:", unmatchedClient[0]);
    if (dupsClient.length > 0) console.log("[DIAG] Sample duplicate Client record:", dupsClient[0]);
  }, [rowsMaster, rowsClient, columnsMaster, columnsClient, masterSheetNames, clientSheetNames, activeMasterTab, activeClientTab, modifierCriteria]);

  const handleExport = () => {
    if (mergedForExport.length === 0) return;
    
    // Use client filename, add sheet name if multiple sheets, add datetime suffix
    const clientName = lastClientFile ? lastClientFile.replace('.xlsx', '').replace('.xls', '') : 'merged_data';
    const clientSheetCount = clientFileMetadata?.sheetCount || 1;
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '');
    
    let filename = `${clientName}_${timestamp}.xlsx`;
    if (clientSheetCount > 1 && mergedSheetInfo?.clientSheet) {
      const sheetName = mergedSheetInfo.clientSheet.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_');
      filename = `${clientName}_${sheetName}_${timestamp}.xlsx`;
    }
    
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
    XLSX.writeFile(wb, filename);
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

  const processAllSheets = (data: string, which: "Master" | "Client", sheetNames: string[]) => {
    const workbook = XLSX.read(data, { type: "binary" });
    const sheetData: {[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}} = {};
    
    sheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const processed = processSheetData(worksheet);
      sheetData[sheetName] = processed;
    });
    
    if (which === "Master") {
      setMasterSheetData(sheetData);
      setMasterSheetNames(sheetNames);
      setActiveMasterTab(0);
      // Update legacy state for first sheet for backward compatibility
      if (sheetNames.length > 0) {
        const firstSheet = sheetData[sheetNames[0]];
        setRowsMaster(firstSheet.rows);
        setColumnsMaster(firstSheet.columns);
      }
    } else {
      setClientSheetData(sheetData);
      setClientSheetNames(sheetNames);
      setActiveClientTab(0);
      // Update legacy state for first sheet for backward compatibility
      if (sheetNames.length > 0) {
        const firstSheet = sheetData[sheetNames[0]];
        setRowsClient(firstSheet.rows);
        setColumnsClient(firstSheet.columns);
      }
    }
  };
  
  const processSheetData = (worksheet: unknown) => {
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (json.length === 0) return { rows: [], columns: [] };
    
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
    
    return { rows: Array.from(rows), columns };
  };
  
  const processFileData = (data: string, which: "Master" | "Client") => {
    const workbook = XLSX.read(data, { type: "binary" });
    const sheets = workbook.SheetNames;
    processAllSheets(data, which, sheets);
  };
  
  const restoreFileData = (data: string, which: "Master" | "Client", filename: string, restoreMetadata = false) => {
    console.log(`[DEBUG] Starting restoreFileData for ${which}`);
    // For restore operations, process the data directly without creating a File object
    const workbook = XLSX.read(data, { type: "binary" });
    const sheets = workbook.SheetNames;
    console.log(`[DEBUG] ${which} sheets found:`, sheets);
    processAllSheets(data, which, sheets);
    console.log(`[DEBUG] processAllSheets completed for ${which}`);
    
    // Restore metadata AFTER processing sheets if requested
    console.log(`[DEBUG] restoreMetadata flag for ${which}:`, restoreMetadata);
    if (restoreMetadata) {
      const metadataKey = which === "Master" ? "lastMasterMetadata" : "lastClientMetadata";
      const storedMetadata = localStorage.getItem(metadataKey);
      console.log(`[DEBUG] ${which} stored metadata from localStorage:`, storedMetadata ? 'FOUND' : 'NOT FOUND');
      if (storedMetadata) {
        try {
          const metadata = JSON.parse(storedMetadata);
          metadata.uploadTime = new Date(metadata.uploadTime);
          
          // Set metadata immediately
          if (which === "Master") {
            setMasterFileMetadata(metadata);
            console.log('[DEBUG] Master metadata restored AFTER processing:', metadata);
          } else {
            setClientFileMetadata(metadata);
            console.log('[DEBUG] Client metadata restored AFTER processing:', metadata);
          }
        } catch (e) {
          console.error(`Failed to restore ${which.toLowerCase()} metadata after processing:`, e);
        }
      } else {
        console.log(`[DEBUG] No stored metadata found for ${which} with key:`, metadataKey);
      }
    } else {
      console.log(`[DEBUG] restoreMetadata is false for ${which}, skipping metadata restore`);
    }
  };

  const handleMasterTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveMasterTab(newValue);
    const sheetName = masterSheetNames[newValue];
    const sheetData = masterSheetData[sheetName];
    if (sheetData) {
      setRowsMaster(sheetData.rows);
      setColumnsMaster(sheetData.columns);
      localStorage.setItem("lastMasterSheet", sheetName);
      setLastMasterSheet(sheetName);
    }
  };
  
  const handleClientTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveClientTab(newValue);
    const sheetName = clientSheetNames[newValue];
    const sheetData = clientSheetData[sheetName];
    if (sheetData) {
      setRowsClient(sheetData.rows);
      setColumnsClient(sheetData.columns);
      localStorage.setItem("lastClientSheet", sheetName);
      setLastClientSheet(sheetName);
    }
  };
  
  const handleLoadLastFile = (which: "Master" | "Client") => {
    if (which === "Master" && lastMasterData && lastMasterFile) {
      console.log('[DEBUG] Loading last master file with metadata restore');
      restoreFileData(lastMasterData, "Master", lastMasterFile, true);
    } else if (which === "Client" && lastClientData && lastClientFile) {
      console.log('[DEBUG] Loading last client file with metadata restore');
      restoreFileData(lastClientData, "Client", lastClientFile, true);
    }
  };
  
  const handleRestoreSession = () => {
    if (lastMasterData && lastClientData && lastMasterFile && lastClientFile) {
      console.log('[DEBUG] Starting restore session - processing sheets first, then metadata');
      
      // Process file data first, then restore metadata AFTER processing
      restoreFileData(lastMasterData, "Master", lastMasterFile, true);
      restoreFileData(lastClientData, "Client", lastClientFile, true);
      
      console.log('[DEBUG] Restore session initiated');
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
    setMasterSheetData({});
    setClientSheetData({});
    setMasterSheetNames([]);
    setClientSheetNames([]);
    setActiveMasterTab(0);
    setActiveClientTab(0);
    setMergedSheetInfo(null);
    setMasterFileMetadata(null);
    setClientFileMetadata(null);
    setComparisonStats(null);
    setComparisonStartTime(null);
    if (fileMasterInputRef.current) fileMasterInputRef.current.value = "";
    if (fileClientInputRef.current) fileClientInputRef.current.value = "";
  };

  const handleClearAllData = () => {
    // First do a normal reset
    handleReset();
    
    // Then clear all localStorage data
    localStorage.removeItem("lastMasterFile");
    localStorage.removeItem("lastMasterData");
    localStorage.removeItem("lastMasterSheet");
    localStorage.removeItem("lastMasterMetadata");
    localStorage.removeItem("lastClientFile");
    localStorage.removeItem("lastClientData");
    localStorage.removeItem("lastClientSheet");
    localStorage.removeItem("lastClientMetadata");
    
    // Clear the state variables too
    setLastMasterFile(null);
    setLastMasterData(null);
    setLastMasterSheet(null);
    setLastClientFile(null);
    setLastClientData(null);
    setLastClientSheet(null);
  };

  // Don't render anything on server side to prevent hydration mismatch
  if (!isClient) {
    return (
      <Box sx={{ 
        p: 4, 
        background: 'linear-gradient(135deg, #f8fbff 0%, #e3f2fd 50%, #f0f8ff 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Typography variant="h4" sx={{ color: '#1976d2' }}>
          Loading...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: 4, 
      background: 'linear-gradient(135deg, #f8fbff 0%, #e3f2fd 50%, #f0f8ff 100%)',
      minHeight: '100vh' 
    }}>
      <Typography variant="h3" gutterBottom sx={{ 
        color: '#1976d2', 
        fontWeight: 'bold', 
        textAlign: 'center',
        mb: 4,
        textShadow: '0 2px 4px rgba(25, 118, 210, 0.2)'
      }}>
        🚀 VIC HCPCS Fusion Reactor
      </Typography>
      
      {/* Upload/Grid Areas */}
      <Box sx={{ mb: 4 }}>
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
          {masterSheetNames.length > 0 ? (
            // Show tabs and grid when data is loaded
            <>
              <FileInfoCard metadata={masterFileMetadata} type="Master" />
              
              {masterSheetNames.length > 0 && (
                <Tabs 
                  value={activeMasterTab} 
                  onChange={handleMasterTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ 
                    mb: 2, 
                    borderBottom: 2, 
                    borderColor: '#e0e0e0',
                    '& .MuiTab-root': {
                      color: '#424242',
                      backgroundColor: '#f5f5f5',
                      border: '2px solid #bdbdbd',
                      borderBottom: 'none',
                      marginRight: '4px',
                      minHeight: '40px',
                      fontWeight: 'bold',
                      fontSize: '0.875rem',
                      '&.Mui-selected': {
                        color: '#1976d2',
                        backgroundColor: 'white',
                        fontWeight: 'bold',
                        border: '2px solid #2196f3'
                      },
                      '&:hover': {
                        color: '#1976d2',
                        backgroundColor: '#e3f2fd',
                        border: '2px solid #64b5f6'
                      }
                    },
                    '& .MuiTabs-indicator': {
                      display: 'none'
                    }
                  }}
                >
                  {masterSheetNames.map((sheetName, index) => (
                    <Tab key={index} label={sheetName} />
                  ))}
                </Tabs>
              )}
              
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
              <Typography variant="h4" sx={{ 
                mb: 3, 
                color: '#1976d2', 
                fontWeight: 'bold',
                textAlign: 'center'
              }}>📄 Master File</Typography>
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
          {clientSheetNames.length > 0 ? (
            // Show tabs and grid when data is loaded
            <>
              <FileInfoCard metadata={clientFileMetadata} type="Client" />
              
              {clientSheetNames.length > 0 && (
                <Tabs 
                  value={activeClientTab} 
                  onChange={handleClientTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ 
                    mb: 2, 
                    borderBottom: 2, 
                    borderColor: '#e0e0e0',
                    '& .MuiTab-root': {
                      color: '#424242',
                      backgroundColor: '#f5f5f5',
                      border: '2px solid #bdbdbd',
                      borderBottom: 'none',
                      marginRight: '4px',
                      minHeight: '40px',
                      fontWeight: 'bold',
                      fontSize: '0.875rem',
                      '&.Mui-selected': {
                        color: '#1976d2',
                        backgroundColor: 'white',
                        fontWeight: 'bold',
                        border: '2px solid #2196f3'
                      },
                      '&:hover': {
                        color: '#1976d2',
                        backgroundColor: '#e3f2fd',
                        border: '2px solid #64b5f6'
                      }
                    },
                    '& .MuiTabs-indicator': {
                      display: 'none'
                    }
                  }}
                >
                  {clientSheetNames.map((sheetName, index) => (
                    <Tab key={index} label={sheetName} />
                  ))}
                </Tabs>
              )}
              
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
              <Typography variant="h4" sx={{ 
                mb: 3, 
                color: '#1976d2', 
                fontWeight: 'bold',
                textAlign: 'center'
              }}>📋 Client File</Typography>
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
      {isClient && (lastMasterData || lastClientData) && (
        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
          {lastMasterData && lastClientData && lastMasterFile && lastClientFile && (
            <Button 
              variant="contained"
              color="success"
              onClick={handleRestoreSession}
            >
              Restore Last Session
            </Button>
          )}
          <Button 
            variant="outlined" 
            onClick={() => handleLoadLastFile("Master")}
            disabled={!lastMasterData || !lastMasterFile}
          >
            Load Last Master: {lastMasterFile || "Unknown"}
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => handleLoadLastFile("Client")}
            disabled={!lastClientData || !lastClientFile}
          >
            Load Last Client: {lastClientFile || "Unknown"}
          </Button>
          <Button variant="contained" onClick={handleReset} color="warning">
            Reset
          </Button>
          <Button variant="contained" onClick={handleClearAllData} color="error">
            Clear All Data
          </Button>
        </Box>
      )}
      
      <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Button 
          variant="outlined" 
          onClick={() => setModifierDialogOpen(true)}
          sx={{ 
            fontWeight: 'bold', 
            borderWidth: 2, 
            color: '#9c27b0', 
            borderColor: '#9c27b0',
            '&:hover': { backgroundColor: '#f3e5f5', borderColor: '#7b1fa2' }
          }}
        >
          ⚙️ Modifier Settings
        </Button>
        <Button 
          variant="contained" 
          onClick={handleCompare} 
          disabled={rowsMaster.length === 0 || rowsClient.length === 0}
          sx={{ 
            fontWeight: 'bold', 
            backgroundColor: '#2196f3', 
            '&:hover': { backgroundColor: '#1976d2' },
            '&:disabled': { backgroundColor: '#e0e0e0', color: '#9e9e9e' }
          }}
        >
          🔍 Compare
        </Button>
        <Button 
          variant="contained" 
          onClick={handleExport} 
          disabled={mergedForExport.length === 0}
          sx={{ 
            fontWeight: 'bold', 
            backgroundColor: '#4caf50', 
            '&:hover': { backgroundColor: '#388e3c' },
            '&:disabled': { backgroundColor: '#e0e0e0', color: '#9e9e9e' }
          }}
        >
          📁 Export Merged Data
        </Button>
        {(!isClient || !(lastMasterData || lastClientData)) && (
          <Button 
            variant="contained" 
            onClick={handleReset} 
            sx={{ 
              fontWeight: 'bold', 
              backgroundColor: '#ff9800', 
              '&:hover': { backgroundColor: '#f57c00' }
            }}
          >
            🔄 Reset
          </Button>
        )}
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
          {mergedSheetInfo && (
            <Box sx={{ 
              mb: 1, 
              p: 1.5,
              backgroundColor: '#f0f8ff', 
              border: '2px solid #2196f3', 
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap'
            }}>
              <Typography variant="body2" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                📊 Merged:
              </Typography>
              <Typography variant="body2" sx={{ color: '#424242' }}>
                &quot;{mergedSheetInfo.masterSheet}&quot; ↔ &quot;{mergedSheetInfo.clientSheet}&quot;
              </Typography>
            </Box>
          )}
          
          <ComparisonStatsPanel stats={comparisonStats} />
          
          {/* Merged Results */}
          <Box sx={{ mb: 4 }}>
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
          <Box sx={{ display: 'flex', gap: 2, borderBottom: 2, borderColor: '#e0e0e0', mb: 3 }}>
            <Button
              variant={errorsTabValue === 0 ? "contained" : "outlined"}
              onClick={() => setErrorsTabValue(0)}
              size="medium"
              sx={{
                fontWeight: 'bold',
                borderWidth: 2,
                color: errorsTabValue === 0 ? 'white' : '#d32f2f',
                backgroundColor: errorsTabValue === 0 ? '#d32f2f' : 'white',
                borderColor: '#d32f2f',
                '&:hover': {
                  backgroundColor: errorsTabValue === 0 ? '#c62828' : '#ffebee',
                  borderColor: '#c62828'
                }
              }}
            >
              Unmatched Records ({unmatchedClient.length})
            </Button>
            <Button
              variant={errorsTabValue === 1 ? "contained" : "outlined"}
              onClick={() => setErrorsTabValue(1)}
              size="medium"
              sx={{
                fontWeight: 'bold',
                borderWidth: 2,
                color: errorsTabValue === 1 ? 'white' : '#f57c00',
                backgroundColor: errorsTabValue === 1 ? '#f57c00' : 'white',
                borderColor: '#f57c00',
                '&:hover': {
                  backgroundColor: errorsTabValue === 1 ? '#ef6c00' : '#fff3e0',
                  borderColor: '#ef6c00'
                }
              }}
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
