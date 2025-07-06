import * as XLSX from "xlsx";
import { GridColDef } from "@mui/x-data-grid";

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

interface FileProcessingCallbacks {
  setRowsMaster: (rows: ExcelRow[]) => void;
  setColumnsMaster: (columns: GridColDef[]) => void;
  setRowsClient: (rows: ExcelRow[]) => void;
  setColumnsClient: (columns: GridColDef[]) => void;
  setMasterSheetData: (data: Record<string, {rows: ExcelRow[], columns: GridColDef[]}>) => void;
  setClientSheetData: (data: Record<string, {rows: ExcelRow[], columns: GridColDef[]}>) => void;
  setMasterSheetNames: (names: string[]) => void;
  setClientSheetNames: (names: string[]) => void;
  setActiveMasterTab: (tab: number) => void;
  setActiveClientTab: (tab: number) => void;
  setOriginalMasterData: (data: ExcelRow[]) => void;
  setOriginalClientData: (data: ExcelRow[]) => void;
  setHasUnsavedMasterChanges: (hasChanges: boolean) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  setMasterFileMetadata: (metadata: FileMetadata | null) => void;
  setClientFileMetadata: (metadata: FileMetadata | null) => void;
  setLastMasterFile: (filename: string | null) => void;
  setLastClientFile: (filename: string | null) => void;
  setLastMasterData: (data: string | null) => void;
  setLastClientData: (data: string | null) => void;
  setHcpcsDefaultSorting: () => void;
}

export const createFileProcessingHandlers = (callbacks: FileProcessingCallbacks) => {
  const processSheetData = (worksheet: XLSX.WorkSheet, isEditable = false) => {
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (json.length === 0) return { rows: [], columns: [] };
    
    const headers = json[0] as string[];
    const columns: GridColDef[] = headers.map((header, idx) => ({
      field: header || `col${idx}`,
      headerName: header || `Column ${idx + 1}`,
      width: 150,
      editable: isEditable,
      type: 'string',
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

  const processAllSheets = (data: string, which: "Master" | "Client", sheetNames: string[]) => {
    const workbook = XLSX.read(data, { type: "binary" });
    const sheetData: {[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}} = {};
    
    // Make both client and master data editable
    const isEditable = true;
    
    sheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const processed = processSheetData(worksheet, isEditable);
      sheetData[sheetName] = processed;
    });
    
    if (which === "Master") {
      callbacks.setMasterSheetData(sheetData);
      callbacks.setMasterSheetNames(sheetNames);
      callbacks.setActiveMasterTab(0);
      // Update legacy state for first sheet for backward compatibility
      if (sheetNames.length > 0) {
        const firstSheet = sheetData[sheetNames[0]];
        callbacks.setRowsMaster(firstSheet.rows);
        callbacks.setColumnsMaster(firstSheet.columns);
        // Save original data for cancel functionality
        callbacks.setOriginalMasterData([...firstSheet.rows]);
        callbacks.setHasUnsavedMasterChanges(false);
        // Set HCPCS sorting after data is loaded
        setTimeout(() => callbacks.setHcpcsDefaultSorting(), 100);
      }
    } else {
      callbacks.setClientSheetData(sheetData);
      callbacks.setClientSheetNames(sheetNames);
      callbacks.setActiveClientTab(0);
      // Update legacy state for first sheet for backward compatibility
      if (sheetNames.length > 0) {
        const firstSheet = sheetData[sheetNames[0]];
        callbacks.setRowsClient(firstSheet.rows);
        callbacks.setColumnsClient(firstSheet.columns);
        // Save original data for cancel functionality
        callbacks.setOriginalClientData([...firstSheet.rows]);
        callbacks.setHasUnsavedChanges(false);
        // Set HCPCS sorting after data is loaded
        setTimeout(() => callbacks.setHcpcsDefaultSorting(), 100);
      }
    }
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
            callbacks.setMasterFileMetadata(metadata);
            console.log('[DEBUG] Master metadata restored AFTER processing:', metadata);
          } else {
            callbacks.setClientFileMetadata(metadata);
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

  const handleFileUpload = (file: File, which: "Master" | "Client") => {
    console.log(`[DEBUG] handleFileUpload called for ${which} with file:`, file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as string;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheets = workbook.SheetNames;
      console.log(`[DEBUG] ${which} sheets found:`, sheets);
      
      // Process all sheets immediately
      processAllSheets(data, which, sheets);
      console.log(`[DEBUG] processAllSheets completed for ${which}`);
      
      // Create and save metadata AFTER processing
      const totalRecords = sheets.reduce((total, sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        return total + Math.max(0, json.length - 1); // Subtract 1 for header
      }, 0);
      
      const totalColumns = sheets.reduce((max, sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const headers = json.length > 0 ? (json[0] as string[]).length : 0;
        return Math.max(max, headers);
      }, 0);
      
      const metadata: FileMetadata = {
        name: file.name,
        size: file.size,
        uploadTime: new Date(),
        sheetCount: sheets.length,
        recordCount: totalRecords,
        columnCount: totalColumns
      };
      
      console.log(`[DEBUG] ${which} metadata created:`, metadata);
      
      // Set metadata immediately
      if (which === "Master") {
        callbacks.setMasterFileMetadata(metadata);
        console.log('[DEBUG] Master metadata set AFTER processing');
      } else {
        callbacks.setClientFileMetadata(metadata);
        console.log('[DEBUG] Client metadata set AFTER processing');
      }
      
      // Save to localStorage for persistence
      if (which === "Master") {
        callbacks.setLastMasterFile(file.name);
        callbacks.setLastMasterData(data);
        localStorage.setItem("lastMasterFile", file.name);
        localStorage.setItem("lastMasterData", data);
        localStorage.setItem("lastMasterSheet", JSON.stringify(sheets));
        localStorage.setItem("lastMasterMetadata", JSON.stringify(metadata));
        console.log('[DEBUG] Master data saved to localStorage');
      } else {
        callbacks.setLastClientFile(file.name);
        callbacks.setLastClientData(data);
        localStorage.setItem("lastClientFile", file.name);
        localStorage.setItem("lastClientData", data);
        localStorage.setItem("lastClientSheet", JSON.stringify(sheets));
        localStorage.setItem("lastClientMetadata", JSON.stringify(metadata));
        console.log('[DEBUG] Client data saved to localStorage');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleLoadSampleData = async () => {
    try {
      console.log('[SAMPLE DATA] Starting to load sample data...');
      
      // Load the sample files
      const masterFileResponse = await fetch('/sample%20sheets/ED%20Master%20CDM%202025.xlsx');
      const clientFileResponse = await fetch('/sample%20sheets/Client%20ED%20w%20Hyphens.xlsx');
      
      if (!masterFileResponse.ok || !clientFileResponse.ok) {
        console.error('[SAMPLE DATA] Failed to fetch sample files');
        return;
      }
      
      const masterBlob = await masterFileResponse.blob();
      const clientBlob = await clientFileResponse.blob();
      
      // Convert blobs to files
      const masterFile = new File([masterBlob], 'ED Master CDM 2025.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const clientFile = new File([clientBlob], 'Client ED w Hyphens.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      console.log('[SAMPLE DATA] Files created, uploading...');
      
      // Upload both files
      handleFileUpload(masterFile, 'Master');
      handleFileUpload(clientFile, 'Client');
      
      console.log('[SAMPLE DATA] Sample data loaded successfully!');
    } catch (error) {
      console.error('[SAMPLE DATA] Error loading sample data:', error);
    }
  };

  return {
    handleFileUpload,
    handleLoadSampleData,
    processAllSheets,
    processSheetData,
    restoreFileData
  };
};