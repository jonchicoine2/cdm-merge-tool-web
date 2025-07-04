import * as XLSX from "xlsx";
import { GridColDef } from "@mui/x-data-grid";

export interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
}

export interface FileMetadata {
  name: string;
  size: number;
  uploadTime: Date;
  sheetCount: number;
  recordCount: number;
  columnCount: number;
}

export interface FileProcessingCallbacks {
  setLastMasterFile: (filename: string) => void;
  setLastClientFile: (filename: string) => void;
  setLastMasterData: (data: string) => void;
  setLastClientData: (data: string) => void;
  setMasterFileMetadata: (metadata: FileMetadata) => void;
  setClientFileMetadata: (metadata: FileMetadata) => void;
  setMasterSheetData: (data: {[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}}) => void;
  setClientSheetData: (data: {[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}}) => void;
  setMasterSheetNames: (names: string[]) => void;
  setClientSheetNames: (names: string[]) => void;
  setActiveMasterTab: (tab: number) => void;
  setActiveClientTab: (tab: number) => void;
  setRowsMaster: (rows: ExcelRow[]) => void;
  setRowsClient: (rows: ExcelRow[]) => void;
  setColumnsMaster: (columns: GridColDef[]) => void;
  setColumnsClient: (columns: GridColDef[]) => void;
  setOriginalMasterData: (data: ExcelRow[]) => void;
  setOriginalClientData: (data: ExcelRow[]) => void;
  setHasUnsavedMasterChanges: (hasChanges: boolean) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  setHcpcsDefaultSorting: () => void;
}

export const processSheetData = (worksheet: XLSX.WorkSheet, isEditable = false) => {
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

export const processAllSheets = (
  data: string, 
  which: "Master" | "Client", 
  sheetNames: string[],
  callbacks: FileProcessingCallbacks
) => {
  const workbook = XLSX.read(data, { type: "binary" });
  const sheetData: {[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}} = {};
  
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
    if (sheetNames.length > 0) {
      const firstSheet = sheetData[sheetNames[0]];
      callbacks.setRowsMaster(firstSheet.rows);
      callbacks.setColumnsMaster(firstSheet.columns);
      callbacks.setOriginalMasterData([...firstSheet.rows]);
      callbacks.setHasUnsavedMasterChanges(false);
      setTimeout(() => callbacks.setHcpcsDefaultSorting(), 100);
    }
  } else {
    callbacks.setClientSheetData(sheetData);
    callbacks.setClientSheetNames(sheetNames);
    callbacks.setActiveClientTab(0);
    if (sheetNames.length > 0) {
      const firstSheet = sheetData[sheetNames[0]];
      callbacks.setRowsClient(firstSheet.rows);
      callbacks.setColumnsClient(firstSheet.columns);
      callbacks.setOriginalClientData([...firstSheet.rows]);
      callbacks.setHasUnsavedChanges(false);
      setTimeout(() => callbacks.setHcpcsDefaultSorting(), 100);
    }
  }
};

export const handleFileUpload = (
  e: React.ChangeEvent<HTMLInputElement> | File,
  which: "Master" | "Client",
  callbacks: FileProcessingCallbacks,
  isRestore = false
) => {
  let file: File | undefined;
  if (e instanceof File) {
    file = e;
  } else {
    file = e.target.files?.[0];
  }
  if (!file) return;

  if (which === "Master") {
    localStorage.setItem("lastMasterFile", file.name);
    callbacks.setLastMasterFile(file.name);
  } else {
    localStorage.setItem("lastClientFile", file.name);
    callbacks.setLastClientFile(file.name);
  }

  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = evt.target?.result;
    if (!data) return;
    
    const workbook = XLSX.read(data, { type: "binary" });
    const sheets = workbook.SheetNames;
    console.log(`[DEBUG] File ${which} has ${sheets.length} sheets:`, sheets);
    
    let totalRecords = 0;
    let totalColumns = 0;
    sheets.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (json.length > 0) {
        totalRecords += Math.max(0, json.length - 1);
        totalColumns = Math.max(totalColumns, (json[0] as string[]).length);
      }
    });
    
    if (!isRestore) {
      const metadata: FileMetadata = {
        name: file.name,
        size: file.size,
        uploadTime: new Date(),
        sheetCount: sheets.length,
        recordCount: totalRecords,
        columnCount: totalColumns
      };
      
      if (which === "Master") {
        localStorage.setItem("lastMasterData", data as string);
        callbacks.setLastMasterData(data as string);
        localStorage.setItem("lastMasterSheet", sheets[0]);
        localStorage.setItem("lastMasterMetadata", JSON.stringify(metadata));
        callbacks.setMasterFileMetadata(metadata);
        console.log('[DEBUG] Master metadata set:', metadata);
      } else {
        localStorage.setItem("lastClientData", data as string);
        callbacks.setLastClientData(data as string);
        localStorage.setItem("lastClientSheet", sheets[0]);
        localStorage.setItem("lastClientMetadata", JSON.stringify(metadata));
        callbacks.setClientFileMetadata(metadata);
        console.log('[DEBUG] Client metadata set:', metadata);
      }
    } else {
      if (which === "Master") {
        callbacks.setLastMasterData(data as string);
      } else {
        callbacks.setLastClientData(data as string);
      }
    }
    
    processAllSheets(data as string, which, sheets, callbacks);
  };
  reader.readAsBinaryString(file);
};

export const restoreFileData = (
  data: string, 
  which: "Master" | "Client", 
  filename: string,
  callbacks: FileProcessingCallbacks,
  restoreMetadata = false
) => {
  console.log(`[DEBUG] Starting restoreFileData for ${which}`);
  const workbook = XLSX.read(data, { type: "binary" });
  const sheets = workbook.SheetNames;
  console.log(`[DEBUG] ${which} sheets found:`, sheets);
  processAllSheets(data, which, sheets, callbacks);
  console.log(`[DEBUG] processAllSheets completed for ${which}`);
  
  console.log(`[DEBUG] restoreMetadata flag for ${which}:`, restoreMetadata);
  if (restoreMetadata) {
    const metadataKey = which === "Master" ? "lastMasterMetadata" : "lastClientMetadata";
    const storedMetadata = localStorage.getItem(metadataKey);
    console.log(`[DEBUG] ${which} stored metadata from localStorage:`, storedMetadata ? 'FOUND' : 'NOT FOUND');
    if (storedMetadata) {
      try {
        const metadata = JSON.parse(storedMetadata);
        metadata.uploadTime = new Date(metadata.uploadTime);
        
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

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};