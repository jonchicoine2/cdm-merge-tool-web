import { useState, useMemo } from 'react';
import { GridColDef } from '@mui/x-data-grid-pro';
import * as XLSX from 'xlsx';
import {
  ExcelRow,
  FileMetadata,
  createFileMetadata,
  duplicateRecord,
  deleteRecords,
  filterAndSearchRows,
  formatHCPCSWithHyphens
} from '../utils/excelOperations';
import { SheetData } from '../components/excel-import/types';
import { validateCDMFile, ValidationResult, createValidationErrorMessage } from '../utils/fileValidation';

export const useFileOperations = (useNewHyphenAlgorithm: boolean = false) => {
  // Core data state
  const [rowsMaster, setRowsMaster] = useState<ExcelRow[]>([]);
  const [columnsMaster, setColumnsMaster] = useState<GridColDef[]>([]);
  const [rowsClient, setRowsClient] = useState<ExcelRow[]>([]);
  const [columnsClient, setColumnsClient] = useState<GridColDef[]>([]);
  
  // File metadata state
  const [masterFileMetadata, setMasterFileMetadata] = useState<FileMetadata | null>(null);
  const [clientFileMetadata, setClientFileMetadata] = useState<FileMetadata | null>(null);

  // Track filenames for export naming (like original implementation)
  const [lastClientFile, setLastClientFile] = useState<string>('');

  // Sheet management state
  const [masterSheetData, setMasterSheetData] = useState<{[sheetName: string]: SheetData}>({});
  const [clientSheetData, setClientSheetData] = useState<{[sheetName: string]: SheetData}>({});

  // Validation state
  const [validationResults, setValidationResults] = useState<{
    master?: ValidationResult;
    client?: ValidationResult;
  }>({});
  const [isValidating, setIsValidating] = useState<{
    master: boolean;
    client: boolean;
  }>({ master: false, client: false });
  const [activeMasterTab, setActiveMasterTab] = useState<number>(0);
  const [activeClientTab, setActiveClientTab] = useState<number>(0);
  const [masterSheetNames, setMasterSheetNames] = useState<string[]>([]);
  const [clientSheetNames, setClientSheetNames] = useState<string[]>([]);
  
  // Drag and drop state
  const [dragOverMaster, setDragOverMaster] = useState(false);
  const [dragOverClient, setDragOverClient] = useState(false);

  // Search state
  const [searchMaster, setSearchMaster] = useState('');
  const [searchClient, setSearchClient] = useState('');

  // Filtered data with search applied
  const filteredRowsMaster = useMemo(() => {
    return filterAndSearchRows(rowsMaster, {}, searchMaster);
  }, [rowsMaster, searchMaster]);

  const filteredRowsClient = useMemo(() => {
    return filterAndSearchRows(rowsClient, {}, searchClient);
  }, [rowsClient, searchClient]);

  // Process sheet data from Excel worksheet
  const processSheetData = (worksheet: XLSX.WorkSheet, isEditable: boolean = true) => {
    // Use raw: false to get formatted strings instead of raw values
    // This prevents HCPCS codes like "1012050" from being converted to numbers
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
    if (json.length === 0) return { rows: [], columns: [] };

    const headers = json[0] as string[];
    const dataRows = json.slice(1) as (string | number)[][];

    const columns: GridColDef[] = headers.map((header, index) => {
      const field = header || `Column${index + 1}`;
      const headerName = header || `Column ${index + 1}`;
      const fieldLower = field.toLowerCase();

      // Optimize column widths based on content type
      let width = 150; // default width

      if (fieldLower.includes('hcpcs') || fieldLower.includes('hcpc')) {
        width = 100;
      } else if (fieldLower.includes('cdm') || fieldLower.includes('code')) {
        width = 90;
      } else if (fieldLower.includes('description') || fieldLower.includes('desc')) {
        width = 200; // Further reduced width for description
      } else if (['quantity', 'qty', 'units', 'unit', 'count'].some(term => fieldLower.includes(term))) {
        width = 60; // Reduced width for quantity
      } else if (fieldLower.includes('modifier') || fieldLower.includes('mod')) {
        width = 90;
      } else {
        width = 110; // Reduced default width for other columns
      }

      return {
        field,
        headerName,
        width,
        editable: isEditable,
      };
    });

    const rows: ExcelRow[] = dataRows.map((row, index) => {
      const rowData: ExcelRow = { id: index + 1 };
      headers.forEach((header, colIndex) => {
        const fieldName = header || `Column${colIndex + 1}`;
        rowData[fieldName] = row[colIndex] || '';
      });
      return rowData;
    });

    return { rows, columns };
  };

  // Enhanced file upload with validation
  const handleFileUpload = async (file: File, which: "Master" | "Client") => {
    const fileType = which.toLowerCase() as 'master' | 'client';

    // Set validation loading state
    setIsValidating(prev => ({ ...prev, [fileType]: true }));

    try {
      // Validate file first
      console.log(`[VALIDATION] Starting validation for ${which} file:`, file.name);
      const validationResult = await validateCDMFile(file, fileType);

      // Store validation results
      setValidationResults(prev => ({ ...prev, [fileType]: validationResult }));

      // If validation fails, show error and stop processing
      if (!validationResult.isValid) {
        console.error(`[VALIDATION] ${which} file validation failed:`, validationResult.errors);
        const errorMessage = createValidationErrorMessage(validationResult);

        // You can emit this error to a notification system
        console.error(`[FILE UPLOAD] ${which} file validation failed:\n${errorMessage}`);

        // Clear validation loading state
        setIsValidating(prev => ({ ...prev, [fileType]: false }));
        return { success: false, error: errorMessage, validationResult };
      }

      // Show warnings if any
      if (validationResult.warnings.length > 0) {
        console.warn(`[VALIDATION] ${which} file warnings:`, validationResult.warnings);
        // You can emit warnings to a notification system here
      }

      console.log(`[VALIDATION] ${which} file validation passed`, validationResult.fileInfo);

      // Track client filename for export naming (like original implementation)
      if (which === "Client") {
        setLastClientFile(file.name);
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result;
          if (!data) {
            console.error(`[FILE UPLOAD] No data received for ${which} file`);
            setIsValidating(prev => ({ ...prev, [fileType]: false }));
            return;
          }

          const arrayBuffer = data as ArrayBuffer;

          // Process all sheets
          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          const sheets = workbook.SheetNames;
          console.log(`[DEBUG] File ${which} has ${sheets.length} sheets:`, sheets);

          // Create file metadata
          const metadata = createFileMetadata(file, workbook);

          // Process all sheets
          const sheetData: {[sheetName: string]: SheetData} = {};
          sheets.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            let processed = processSheetData(worksheet, true);
            
            // Apply hyphen formatting to client data only (mirrors old app behavior)
            if (which === "Client" && processed.rows.length > 0) {
              console.log(`[HYPHEN FORMAT] Applying hyphen formatting to ${which} data`);
              processed = {
                ...processed,
                rows: formatHCPCSWithHyphens(processed.rows, processed.columns, useNewHyphenAlgorithm)
              };
            }
            
            sheetData[sheetName] = processed;
          });
      
      if (which === "Master") {
        setMasterSheetData(sheetData);
        setMasterSheetNames(sheets);
        setActiveMasterTab(0);
        setMasterFileMetadata(metadata);
        
        // Set active sheet data
        if (sheets.length > 0) {
          const firstSheet = sheets[0];
          console.log('[DEBUG] Setting Master data:', {
            sheetName: firstSheet,
            rowsLength: sheetData[firstSheet].rows.length,
            columnsLength: sheetData[firstSheet].columns.length,
            sampleRow: sheetData[firstSheet].rows[0]
          });
          setRowsMaster(sheetData[firstSheet].rows);
          setColumnsMaster(sheetData[firstSheet].columns);
        }
      } else {
        setClientSheetData(sheetData);
        setClientSheetNames(sheets);
        setActiveClientTab(0);
        setClientFileMetadata(metadata);
        
        // Set active sheet data
        if (sheets.length > 0) {
          const firstSheet = sheets[0];
          setRowsClient(sheetData[firstSheet].rows);
          setColumnsClient(sheetData[firstSheet].columns);
        }
      }

      // Clear validation loading state on success
      setIsValidating(prev => ({ ...prev, [fileType]: false }));

      } catch (error) {
        console.error(`[FILE UPLOAD] Error processing ${which} file:`, error);
        setIsValidating(prev => ({ ...prev, [fileType]: false }));
      }
    };

    reader.onerror = () => {
      console.error(`[FILE UPLOAD] Error reading ${which} file`);
      setIsValidating(prev => ({ ...prev, [fileType]: false }));
    };

    reader.readAsArrayBuffer(file);

    } catch (error) {
      console.error(`[FILE UPLOAD] Error during ${which} file validation:`, error);
      setIsValidating(prev => ({ ...prev, [fileType]: false }));
      return {
        success: false,
        error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  };

  // Sample data loading function with support for multiple sample sets
  const handleLoadSampleData = async (sampleSet: number = 1) => {
    try {
      console.log(`[SAMPLE DATA] Starting to load sample data set ${sampleSet}...`);
      
      // Define sample file paths for each set
      const sampleSets = {
        1: {
          master: '/sample%20sheets/ED%20Master%20CDM%202025.xlsx',
          client: '/sample%20sheets/Client%20ED%20w%20Hyphens.xlsx',
          masterName: 'ED Master CDM 2025.xlsx',
          clientName: 'Client ED w Hyphens.xlsx'
        },
        2: {
          master: '/sample%20sheets%202/ED%20Master%20CDM%202025.xlsx',
          client: '/sample%20sheets%202/Client%20ED%20-%20no%20Hyphens.xlsx',
          masterName: 'ED Master CDM 2025.xlsx',
          clientName: 'Client ED - no Hyphens.xlsx'
        }
      };
      
      const selectedSet = sampleSets[sampleSet as keyof typeof sampleSets];
      if (!selectedSet) {
        console.error(`[SAMPLE DATA] Invalid sample set: ${sampleSet}`);
        alert(`Invalid sample set: ${sampleSet}`);
        return;
      }
      
      // Load the sample files in parallel
      const [masterFileResponse, clientFileResponse] = await Promise.all([
        fetch(selectedSet.master),
        fetch(selectedSet.client)
      ]);
      
      if (!masterFileResponse.ok || !clientFileResponse.ok) {
        console.error(`[SAMPLE DATA] Failed to fetch sample files for set ${sampleSet}`);
        alert(`Failed to load sample files for set ${sampleSet}. Please ensure the sample files are available.`);
        return;
      }
      
      const [masterBlob, clientBlob] = await Promise.all([
        masterFileResponse.blob(),
        clientFileResponse.blob()
      ]);
      
      // Create File objects
      const masterFile = new File([masterBlob], selectedSet.masterName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const clientFile = new File([clientBlob], selectedSet.clientName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      console.log(`[SAMPLE DATA] Sample files loaded from set ${sampleSet}, processing both files...`);
      
      // Process both files
      handleFileUpload(masterFile, "Master");
      handleFileUpload(clientFile, "Client");
      
      console.log('[SAMPLE DATA] File processing initiated...');
      
    } catch (error) {
      console.error(`[SAMPLE DATA] Error loading sample data set ${sampleSet}:`, error);
      alert(`Error loading sample data set ${sampleSet}. Please check the console for details.`);
    }
  };

  // Tab change handlers
  const handleMasterTabChange = (newValue: number) => {
    setActiveMasterTab(newValue);
    const sheetName = masterSheetNames[newValue];
    if (masterSheetData[sheetName]) {
      setRowsMaster(masterSheetData[sheetName].rows);
      setColumnsMaster(masterSheetData[sheetName].columns);
    }
  };

  const handleClientTabChange = (newValue: number) => {
    setActiveClientTab(newValue);
    const sheetName = clientSheetNames[newValue];
    if (clientSheetData[sheetName]) {
      // Apply hyphen formatting to client data when switching tabs
      const formattedRows = formatHCPCSWithHyphens(
        clientSheetData[sheetName].rows, 
        clientSheetData[sheetName].columns, 
        useNewHyphenAlgorithm
      );
      setRowsClient(formattedRows);
      setColumnsClient(clientSheetData[sheetName].columns);
    }
  };

  // Row operation functions
  const handleDuplicateRow = (rowId: number | string, gridType: 'master' | 'client' | 'merged', setRows: (rows: ExcelRow[]) => void, sourceRows: ExcelRow[]) => {
    const rowToDuplicate = sourceRows.find(row => row.id === rowId);
    if (rowToDuplicate) {
      const duplicatedRow = duplicateRecord(rowToDuplicate);
      setRows([...sourceRows, duplicatedRow]);
    }
  };

  const handleDeleteRow = (rowId: number | string, gridType: 'master' | 'client' | 'merged', setRows: (rows: ExcelRow[]) => void, sourceRows: ExcelRow[]) => {
    const updatedRows = deleteRecords(sourceRows, [rowId as number]);
    setRows(updatedRows);
  };

  // Modal-based row operations for clean UI
  const updateRowInGrid = (updatedRow: ExcelRow, gridType: 'master' | 'client') => {
    if (gridType === 'master') {
      const updatedRows = rowsMaster.map(row =>
        row.id === updatedRow.id ? updatedRow : row
      );
      setRowsMaster(updatedRows);
    } else if (gridType === 'client') {
      const updatedRows = rowsClient.map(row =>
        row.id === updatedRow.id ? updatedRow : row
      );
      setRowsClient(updatedRows);
    }
  };

  const duplicateRowInGrid = (rowId: number | string, gridType: 'master' | 'client') => {
    const sourceRows = gridType === 'master' ? rowsMaster : rowsClient;
    const rowToDuplicate = sourceRows.find(row => row.id === rowId);

    if (rowToDuplicate) {
      const duplicatedRow = duplicateRecord(rowToDuplicate);
      if (gridType === 'master') {
        setRowsMaster([...rowsMaster, duplicatedRow]);
      } else {
        setRowsClient([...rowsClient, duplicatedRow]);
      }
      return duplicatedRow;
    }
    return null;
  };

  const deleteRowFromGrid = (rowId: number | string, gridType: 'master' | 'client') => {
    if (gridType === 'master') {
      const updatedRows = rowsMaster.filter(row => row.id !== rowId);
      setRowsMaster(updatedRows);
    } else if (gridType === 'client') {
      const updatedRows = rowsClient.filter(row => row.id !== rowId);
      setRowsClient(updatedRows);
    }
  };

  // Row update handlers for cell edits
  const handleMasterRowUpdate = (updatedRow: ExcelRow) => {
    const updatedRows = rowsMaster.map(row =>
      row.id === updatedRow.id ? updatedRow : row
    );
    setRowsMaster(updatedRows);

    // Also update the sheet data
    const currentSheet = masterSheetNames[activeMasterTab];
    if (currentSheet && masterSheetData[currentSheet]) {
      const updatedSheetData = {
        ...masterSheetData,
        [currentSheet]: {
          ...masterSheetData[currentSheet],
          rows: updatedRows
        }
      };
      setMasterSheetData(updatedSheetData);
    }


  };

  const handleClientRowUpdate = (updatedRow: ExcelRow) => {
    const updatedRows = rowsClient.map(row =>
      row.id === updatedRow.id ? updatedRow : row
    );
    setRowsClient(updatedRows);

    // Also update the sheet data
    const currentSheet = clientSheetNames[activeClientTab];
    if (currentSheet && clientSheetData[currentSheet]) {
      const updatedSheetData = {
        ...clientSheetData,
        [currentSheet]: {
          ...clientSheetData[currentSheet],
          rows: updatedRows
        }
      };
      setClientSheetData(updatedSheetData);
    }


  };

  // Reset functions
  const resetMaster = () => {
    setRowsMaster([]);
    setColumnsMaster([]);
    setMasterFileMetadata(null);
    setMasterSheetData({});
    setMasterSheetNames([]);
    setActiveMasterTab(0);
    setValidationResults(prev => ({ ...prev, master: undefined }));
  };

  const resetClient = () => {
    setRowsClient([]);
    setColumnsClient([]);
    setClientFileMetadata(null);
    setClientSheetData({});
    setClientSheetNames([]);
    setActiveClientTab(0);
    setValidationResults(prev => ({ ...prev, client: undefined }));
  };

  const resetBoth = () => {
    resetMaster();
    resetClient();
  };

  // Export functions
  // Export function matching original implementation
  const handleExport = (mergedRows: ExcelRow[], unmatchedClient: ExcelRow[], dupsClient: ExcelRow[]) => {
    if (mergedRows.length === 0) {
      alert('No merged data to export');
      return;
    }

    // Use client filename, add datetime suffix (matching original logic)
    const clientName = lastClientFile ? lastClientFile.replace('.xlsx', '').replace('.xls', '') : 'merged_data';
    const clientSheetCount = clientFileMetadata?.sheetCount || 1;
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '');

    let filename = `${clientName}_${timestamp}.xlsx`;
    if (clientSheetCount > 1) {
      // For multi-sheet files, we could add sheet info if needed
      // For now, keep it simple like the original when no specific sheet info
      filename = `${clientName}_${timestamp}.xlsx`;
    }

    const wb = XLSX.utils.book_new();
    const clean = (rows: ExcelRow[]) => rows.map(row => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = row;
      return rest;
    });

    // Add merged data sheet
    const ws = XLSX.utils.json_to_sheet(clean(mergedRows));
    XLSX.utils.book_append_sheet(wb, ws, "Merged");

    // Always include Unmatched_Client sheet, even if empty (matching original)
    const wsErrors = XLSX.utils.json_to_sheet(clean(unmatchedClient));
    XLSX.utils.book_append_sheet(wb, wsErrors, "Unmatched_Client");

    // Always include Duplicate_Client sheet, even if empty (matching original)
    const wsDups = XLSX.utils.json_to_sheet(clean(dupsClient));
    XLSX.utils.book_append_sheet(wb, wsDups, "Duplicate_Client");

    XLSX.writeFile(wb, filename);
  };



  return {
    // Raw data state
    rowsMaster,
    columnsMaster,
    rowsClient,
    columnsClient,

    // Filtered data (with search applied)
    filteredRowsMaster,
    filteredRowsClient,

    // File metadata
    masterFileMetadata,
    clientFileMetadata,
    masterSheetData,
    clientSheetData,
    activeMasterTab,
    activeClientTab,
    masterSheetNames,
    clientSheetNames,

    // UI state
    dragOverMaster,
    dragOverClient,

    // Search state
    searchMaster,
    searchClient,
    setSearchMaster,
    setSearchClient,

    // Validation state
    validationResults,
    isValidating,

    // Setters
    setRowsMaster,
    setRowsClient,
    setDragOverMaster,
    setDragOverClient,

    // Functions
    handleFileUpload,
    handleLoadSampleData,
    handleMasterTabChange,
    handleClientTabChange,
    handleDuplicateRow,
    handleDeleteRow,
    handleMasterRowUpdate,
    handleClientRowUpdate,
    handleExport,
    resetMaster,
    resetClient,
    resetBoth,

    // Modal-based row operations for clean UI
    updateRowInGrid,
    duplicateRowInGrid,
    deleteRowFromGrid
  };
};
