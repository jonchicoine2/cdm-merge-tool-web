import { useState, useEffect, useCallback } from 'react';
import { GridColDef } from '@mui/x-data-grid';
import { 
  ExcelRow, 
  FileMetadata,
  FileProcessingCallbacks,
  handleFileUpload,
  restoreFileData,
  processAllSheets
} from '../utils/fileProcessing';

export interface UseFileManagementReturn {
  // Master file state
  masterData: ExcelRow[];
  masterColumns: GridColDef[];
  masterFileMetadata: FileMetadata | null;
  masterSheetData: {[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}};
  masterSheetNames: string[];
  activeMasterTab: number;
  lastMasterFile: string | null;
  lastMasterData: string | null;

  // Client file state
  clientData: ExcelRow[];
  clientColumns: GridColDef[];
  clientFileMetadata: FileMetadata | null;
  clientSheetData: {[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}};
  clientSheetNames: string[];
  activeClientTab: number;
  lastClientFile: string | null;
  lastClientData: string | null;

  // Drag and drop state
  dragOverMaster: boolean;
  dragOverClient: boolean;

  // Actions
  uploadFile: (e: React.ChangeEvent<HTMLInputElement> | File, which: "Master" | "Client") => void;
  restoreFile: (data: string, which: "Master" | "Client", filename: string, restoreMetadata?: boolean) => void;
  setActiveMasterTab: (tab: number) => void;
  setActiveClientTab: (tab: number) => void;
  handleDragOver: (e: React.DragEvent, which: "Master" | "Client") => void;
  handleDragLeave: (e: React.DragEvent, which: "Master" | "Client") => void;
  handleDrop: (e: React.DragEvent, which: "Master" | "Client") => void;
  clearMasterData: () => void;
  clearClientData: () => void;
  clearAllData: () => void;
  switchToTab: (which: "Master" | "Client", tabIndex: number) => void;
  loadSampleData: () => void;
  
  // Utility functions
  setHcpcsDefaultSorting: () => void;
}

export function useFileManagement(): UseFileManagementReturn {
  // Master file state
  const [masterData, setMasterData] = useState<ExcelRow[]>([]);
  const [masterColumns, setMasterColumns] = useState<GridColDef[]>([]);
  const [masterFileMetadata, setMasterFileMetadata] = useState<FileMetadata | null>(null);
  const [masterSheetData, setMasterSheetData] = useState<{[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}}>({});
  const [masterSheetNames, setMasterSheetNames] = useState<string[]>([]);
  const [activeMasterTab, setActiveMasterTab] = useState<number>(0);
  const [lastMasterFile, setLastMasterFile] = useState<string | null>(null);
  const [lastMasterData, setLastMasterData] = useState<string | null>(null);

  // Client file state
  const [clientData, setClientData] = useState<ExcelRow[]>([]);
  const [clientColumns, setClientColumns] = useState<GridColDef[]>([]);
  const [clientFileMetadata, setClientFileMetadata] = useState<FileMetadata | null>(null);
  const [clientSheetData, setClientSheetData] = useState<{[sheetName: string]: {rows: ExcelRow[], columns: GridColDef[]}}>({});
  const [clientSheetNames, setClientSheetNames] = useState<string[]>([]);
  const [activeClientTab, setActiveClientTab] = useState<number>(0);
  const [lastClientFile, setLastClientFile] = useState<string | null>(null);
  const [lastClientData, setLastClientData] = useState<string | null>(null);

  // Drag and drop state
  const [dragOverMaster, setDragOverMaster] = useState(false);
  const [dragOverClient, setDragOverClient] = useState(false);

  // Additional state for backward compatibility
  const [originalMasterData, setOriginalMasterData] = useState<ExcelRow[]>([]);
  const [originalClientData, setOriginalClientData] = useState<ExcelRow[]>([]);
  const [hasUnsavedMasterChanges, setHasUnsavedMasterChanges] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load saved data from localStorage
  useEffect(() => {
    if (!isClient) return;
    
    const lastMaster = localStorage.getItem("lastMasterFile");
    const lastMasterDataStored = localStorage.getItem("lastMasterData");
    const lastMasterMetadata = localStorage.getItem("lastMasterMetadata");
    
    if (lastMaster) {
      setLastMasterFile(lastMaster);
    }
    if (lastMasterDataStored) {
      setLastMasterData(lastMasterDataStored);
    }
    if (lastMasterMetadata) {
      try {
        const metadata = JSON.parse(lastMasterMetadata);
        metadata.uploadTime = new Date(metadata.uploadTime);
        setMasterFileMetadata(metadata);
      } catch (e) {
        console.error('Failed to parse master metadata:', e);
      }
    }

    const lastClient = localStorage.getItem("lastClientFile");
    const lastClientDataStored = localStorage.getItem("lastClientData");
    const lastClientMetadata = localStorage.getItem("lastClientMetadata");
    
    if (lastClient) {
      setLastClientFile(lastClient);
    }
    if (lastClientDataStored) {
      setLastClientData(lastClientDataStored);
    }
    if (lastClientMetadata) {
      try {
        const metadata = JSON.parse(lastClientMetadata);
        metadata.uploadTime = new Date(metadata.uploadTime);
        setClientFileMetadata(metadata);
      } catch (e) {
        console.error('Failed to parse client metadata:', e);
      }
    }
  }, [isClient]);

  // HCPCS default sorting function
  const setHcpcsDefaultSorting = useCallback(() => {
    console.log('[DEBUG] Setting HCPCS default sorting');
    // This would typically trigger a sort on HCPCS columns
    // Implementation depends on how the parent component handles sorting
  }, []);

  // Create callbacks object for file processing functions
  const callbacks: FileProcessingCallbacks = {
    setLastMasterFile,
    setLastClientFile,
    setLastMasterData,
    setLastClientData,
    setMasterFileMetadata,
    setClientFileMetadata,
    setMasterSheetData,
    setClientSheetData,
    setMasterSheetNames,
    setClientSheetNames,
    setActiveMasterTab,
    setActiveClientTab,
    setRowsMaster: setMasterData,
    setRowsClient: setClientData,
    setColumnsMaster: setMasterColumns,
    setColumnsClient: setClientColumns,
    setOriginalMasterData,
    setOriginalClientData,
    setHasUnsavedMasterChanges,
    setHasUnsavedChanges,
    setHcpcsDefaultSorting
  };

  // File upload handler
  const uploadFile = useCallback((
    e: React.ChangeEvent<HTMLInputElement> | File,
    which: "Master" | "Client"
  ) => {
    handleFileUpload(e, which, callbacks);
  }, [callbacks]);

  // File restoration handler
  const restoreFile = useCallback((
    data: string,
    which: "Master" | "Client",
    filename: string,
    restoreMetadata = false
  ) => {
    restoreFileData(data, which, filename, callbacks, restoreMetadata);
  }, [callbacks]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent, which: "Master" | "Client") => {
    e.preventDefault();
    if (which === "Master") {
      setDragOverMaster(true);
    } else {
      setDragOverClient(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, which: "Master" | "Client") => {
    e.preventDefault();
    if (which === "Master") {
      setDragOverMaster(false);
    } else {
      setDragOverClient(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, which: "Master" | "Client") => {
    e.preventDefault();
    if (which === "Master") {
      setDragOverMaster(false);
    } else {
      setDragOverClient(false);
    }

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0], which);
    }
  }, [uploadFile]);

  // Clear data functions
  const clearMasterData = useCallback(() => {
    setMasterData([]);
    setMasterColumns([]);
    setMasterFileMetadata(null);
    setMasterSheetData({});
    setMasterSheetNames([]);
    setActiveMasterTab(0);
    setLastMasterFile(null);
    setLastMasterData(null);
    setOriginalMasterData([]);
    setHasUnsavedMasterChanges(false);
    
    // Clear localStorage
    localStorage.removeItem("lastMasterFile");
    localStorage.removeItem("lastMasterData");
    localStorage.removeItem("lastMasterMetadata");
    localStorage.removeItem("lastMasterSheet");
  }, []);

  const clearClientData = useCallback(() => {
    setClientData([]);
    setClientColumns([]);
    setClientFileMetadata(null);
    setClientSheetData({});
    setClientSheetNames([]);
    setActiveClientTab(0);
    setLastClientFile(null);
    setLastClientData(null);
    setOriginalClientData([]);
    setHasUnsavedChanges(false);
    
    // Clear localStorage
    localStorage.removeItem("lastClientFile");
    localStorage.removeItem("lastClientData");
    localStorage.removeItem("lastClientMetadata");
    localStorage.removeItem("lastClientSheet");
  }, []);

  const clearAllData = useCallback(() => {
    clearMasterData();
    clearClientData();
  }, [clearMasterData, clearClientData]);

  // Tab switching
  const switchToTab = useCallback((which: "Master" | "Client", tabIndex: number) => {
    if (which === "Master") {
      if (tabIndex >= 0 && tabIndex < masterSheetNames.length) {
        setActiveMasterTab(tabIndex);
        const sheetName = masterSheetNames[tabIndex];
        const sheetData = masterSheetData[sheetName];
        if (sheetData) {
          setMasterData(sheetData.rows);
          setMasterColumns(sheetData.columns);
        }
      }
    } else {
      if (tabIndex >= 0 && tabIndex < clientSheetNames.length) {
        setActiveClientTab(tabIndex);
        const sheetName = clientSheetNames[tabIndex];
        const sheetData = clientSheetData[sheetName];
        if (sheetData) {
          setClientData(sheetData.rows);
          setClientColumns(sheetData.columns);
        }
      }
    }
  }, [masterSheetNames, masterSheetData, clientSheetNames, clientSheetData]);

  // Load sample data
  const loadSampleData = useCallback(() => {
    // This would typically load predefined sample data
    console.log('Loading sample data...');
    // Implementation would depend on where sample data is stored
  }, []);

  return {
    // Master file state
    masterData,
    masterColumns,
    masterFileMetadata,
    masterSheetData,
    masterSheetNames,
    activeMasterTab,
    lastMasterFile,
    lastMasterData,

    // Client file state
    clientData,
    clientColumns,
    clientFileMetadata,
    clientSheetData,
    clientSheetNames,
    activeClientTab,
    lastClientFile,
    lastClientData,

    // Drag and drop state
    dragOverMaster,
    dragOverClient,

    // Actions
    uploadFile,
    restoreFile,
    setActiveMasterTab,
    setActiveClientTab,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    clearMasterData,
    clearClientData,
    clearAllData,
    switchToTab,
    loadSampleData,
    setHcpcsDefaultSorting,
  };
}