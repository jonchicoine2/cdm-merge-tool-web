import { GridColDef } from "@mui/x-data-grid";

interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
}

interface RecordManagementCallbacks {
  // Master grid
  setRowsMaster: (rows: ExcelRow[]) => void;
  setMasterSheetData: (data: Record<string, {rows: ExcelRow[], columns: GridColDef[]}>) => void;
  setHasUnsavedMasterChanges: (hasChanges: boolean) => void;
  
  // Client grid
  setRowsClient: (rows: ExcelRow[]) => void;
  setClientSheetData: (data: Record<string, {rows: ExcelRow[], columns: GridColDef[]}>) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  
  // Merged grid
  setMergedRows: (rows: ExcelRow[]) => void;
  setMergedForExport: (rows: ExcelRow[]) => void;
  setHasUnsavedMergedChanges: (hasChanges: boolean) => void;
  
  // Validation
  setDuplicateValidationErrors: (callback: (prev: Record<string, {duplicateKeys: unknown[], duplicateRows: unknown[]}>) => Record<string, {duplicateKeys: unknown[], duplicateRows: unknown[]}>) => void;
  validateForDuplicates: (rows: ExcelRow[], gridType: 'master' | 'client' | 'merged') => { duplicateKeys: unknown[]; duplicateRows: unknown[]; };
}

export const createRecordManagementHandlers = (
  rowsMaster: ExcelRow[],
  rowsClient: ExcelRow[],
  mergedRows: ExcelRow[],
  columnsMaster: GridColDef[],
  columnsClient: GridColDef[],
  mergedColumns: GridColDef[],
  masterSheetNames: string[],
  clientSheetNames: string[],
  activeMasterTab: number,
  activeClientTab: number,
  masterSheetData: Record<string, {rows: ExcelRow[], columns: GridColDef[]}>,
  clientSheetData: Record<string, {rows: ExcelRow[], columns: GridColDef[]}>,
  callbacks: RecordManagementCallbacks
) => {
  const handleDuplicateRecord = (rowId: number | string, gridType: 'master' | 'client' | 'merged'): { success: boolean; newRowId?: number | string; originalRowId: number | string } => {
    if (gridType === 'master') {
      const recordToDuplicate = rowsMaster.find(row => row.id === rowId);
      if (!recordToDuplicate) {
        console.error(`Record with ID ${rowId} not found in master grid`);
        return { success: false, originalRowId: rowId };
      }
      
      const maxId = Math.max(...rowsMaster.map(row => typeof row.id === 'number' ? row.id : parseInt(String(row.id)) || 0));
      const newRecord = { ...recordToDuplicate, id: maxId + 1 };
      const updatedRows = [...rowsMaster, newRecord];
      callbacks.setRowsMaster(updatedRows);
      
      // Update sheet data
      const currentSheet = masterSheetNames[activeMasterTab];
      if (currentSheet && masterSheetData[currentSheet]) {
        const updatedSheetData = {
          ...masterSheetData,
          [currentSheet]: {
            ...masterSheetData[currentSheet],
            rows: updatedRows
          }
        };
        callbacks.setMasterSheetData(updatedSheetData);
      }
      
      callbacks.setHasUnsavedMasterChanges(true);
      console.log(`Record duplicated in master grid. New record ID: ${newRecord.id}`);
      return { success: true, newRowId: newRecord.id, originalRowId: rowId };
    } else if (gridType === 'client') {
      const recordToDuplicate = rowsClient.find(row => row.id === rowId);
      if (!recordToDuplicate) {
        console.error(`Record with ID ${rowId} not found in client grid`);
        return { success: false, originalRowId: rowId };
      }
      
      const maxId = Math.max(...rowsClient.map(row => typeof row.id === 'number' ? row.id : parseInt(String(row.id)) || 0));
      const newRecord = { ...recordToDuplicate, id: maxId + 1 };
      const updatedRows = [...rowsClient, newRecord];
      callbacks.setRowsClient(updatedRows);
      
      // Update sheet data
      const currentSheet = clientSheetNames[activeClientTab];
      if (currentSheet && clientSheetData[currentSheet]) {
        const updatedSheetData = {
          ...clientSheetData,
          [currentSheet]: {
            ...clientSheetData[currentSheet],
            rows: updatedRows
          }
        };
        callbacks.setClientSheetData(updatedSheetData);
      }
      
      callbacks.setHasUnsavedChanges(true);
      console.log(`Record duplicated in client grid. New record ID: ${newRecord.id}`);
      return { success: true, newRowId: newRecord.id, originalRowId: rowId };
    } else if (gridType === 'merged') {
      const recordToDuplicate = mergedRows.find(row => row.id === rowId);
      if (!recordToDuplicate) {
        console.error(`Record with ID ${rowId} not found in merged grid`);
        return { success: false, originalRowId: rowId };
      }
      
      const maxId = Math.max(...mergedRows.map(row => typeof row.id === 'number' ? row.id : parseInt(String(row.id)) || 0));
      const newRecord = { ...recordToDuplicate, id: maxId + 1 };
      const updatedRows = [...mergedRows, newRecord];
      callbacks.setMergedRows(updatedRows);
      callbacks.setMergedForExport(updatedRows);
      callbacks.setHasUnsavedMergedChanges(true);
      console.log(`Record duplicated in merged grid. New record ID: ${newRecord.id}`);
      return { success: true, newRowId: newRecord.id, originalRowId: rowId };
    }
    
    return { success: false, originalRowId: rowId };
  };

  const handleDeleteRecord = (rowId: number | string, gridType: 'master' | 'client' | 'merged') => {
    if (gridType === 'master') {
      const updatedRows = rowsMaster.filter(row => row.id !== rowId);
      callbacks.setRowsMaster(updatedRows);
      
      // Update sheet data
      const currentSheet = masterSheetNames[activeMasterTab];
      if (currentSheet && masterSheetData[currentSheet]) {
        const updatedSheetData = {
          ...masterSheetData,
          [currentSheet]: {
            ...masterSheetData[currentSheet],
            rows: updatedRows
          }
        };
        callbacks.setMasterSheetData(updatedSheetData);
      }
      
      callbacks.setHasUnsavedMasterChanges(true);
      
      // Re-validate for duplicates after delete to potentially re-enable save button
      const validation = callbacks.validateForDuplicates(updatedRows, 'master');
      callbacks.setDuplicateValidationErrors(prev => ({
        ...prev,
        master: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
      }));
    } else if (gridType === 'client') {
      const updatedRows = rowsClient.filter(row => row.id !== rowId);
      callbacks.setRowsClient(updatedRows);
      
      // Update sheet data
      const currentSheet = clientSheetNames[activeClientTab];
      if (currentSheet && clientSheetData[currentSheet]) {
        const updatedSheetData = {
          ...clientSheetData,
          [currentSheet]: {
            ...clientSheetData[currentSheet],
            rows: updatedRows
          }
        };
        callbacks.setClientSheetData(updatedSheetData);
      }
      
      callbacks.setHasUnsavedChanges(true);
      
      // Re-validate for duplicates after delete to potentially re-enable save button
      const validation = callbacks.validateForDuplicates(updatedRows, 'client');
      callbacks.setDuplicateValidationErrors(prev => ({
        ...prev,
        client: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
      }));
    } else if (gridType === 'merged') {
      const updatedRows = mergedRows.filter(row => row.id !== rowId);
      callbacks.setMergedRows(updatedRows);
      callbacks.setMergedForExport(updatedRows);
      callbacks.setHasUnsavedMergedChanges(true);
      
      // Re-validate for duplicates after delete to potentially re-enable save button
      const validation = callbacks.validateForDuplicates(updatedRows, 'merged');
      callbacks.setDuplicateValidationErrors(prev => ({
        ...prev,
        merged: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
      }));
    }

    console.log(`Record with ID ${rowId} deleted from ${gridType} grid`);
    console.log(`[SINGLE DELETE] Re-validated duplicates for ${gridType} grid after deletion`);
  };

  const handleDeleteMultipleRecords = (rowIds: (number | string)[], gridType: 'master' | 'client' | 'merged') => {
    if (!rowIds || rowIds.length === 0) return { success: false, deletedCount: 0 };
    
    console.log(`[BULK DELETE] Deleting ${rowIds.length} records from ${gridType} grid:`, rowIds);
    
    if (gridType === 'master') {
      const updatedRows = rowsMaster.filter(row => !rowIds.includes(row.id));
      callbacks.setRowsMaster(updatedRows);
      
      // Update sheet data
      const currentSheet = masterSheetNames[activeMasterTab];
      if (currentSheet && masterSheetData[currentSheet]) {
        const updatedSheetData = {
          ...masterSheetData,
          [currentSheet]: {
            ...masterSheetData[currentSheet],
            rows: updatedRows
          }
        };
        callbacks.setMasterSheetData(updatedSheetData);
      }
      
      callbacks.setHasUnsavedMasterChanges(true);
      
      // Re-validate for duplicates after bulk delete to potentially re-enable save button
      const validation = callbacks.validateForDuplicates(updatedRows, 'master');
      callbacks.setDuplicateValidationErrors(prev => ({
        ...prev,
        master: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
      }));
    } else if (gridType === 'client') {
      const updatedRows = rowsClient.filter(row => !rowIds.includes(row.id));
      callbacks.setRowsClient(updatedRows);
      
      // Update sheet data
      const currentSheet = clientSheetNames[activeClientTab];
      if (currentSheet && clientSheetData[currentSheet]) {
        const updatedSheetData = {
          ...clientSheetData,
          [currentSheet]: {
            ...clientSheetData[currentSheet],
            rows: updatedRows
          }
        };
        callbacks.setClientSheetData(updatedSheetData);
      }
      
      callbacks.setHasUnsavedChanges(true);
      
      // Re-validate for duplicates after bulk delete to potentially re-enable save button
      const validation = callbacks.validateForDuplicates(updatedRows, 'client');
      callbacks.setDuplicateValidationErrors(prev => ({
        ...prev,
        client: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
      }));
    } else if (gridType === 'merged') {
      const updatedRows = mergedRows.filter(row => !rowIds.includes(row.id));
      callbacks.setMergedRows(updatedRows);
      callbacks.setMergedForExport(updatedRows);
      callbacks.setHasUnsavedMergedChanges(true);
      
      // Re-validate for duplicates after bulk delete to potentially re-enable save button
      const validation = callbacks.validateForDuplicates(updatedRows, 'merged');
      callbacks.setDuplicateValidationErrors(prev => ({
        ...prev,
        merged: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
      }));
    }

    const deletedCount = rowIds.length;
    console.log(`✅ Successfully deleted ${deletedCount} records from ${gridType} grid`);
    console.log(`[BULK DELETE] Re-validated duplicates for ${gridType} grid after deletion`);
    return { success: true, deletedCount };
  };

  const handleAddRecord = (gridType: 'master' | 'client' | 'merged', rowData?: {[key: string]: string | number | undefined}) => {
    if (gridType === 'master') {
      const maxId = rowsMaster.length > 0 ? Math.max(...rowsMaster.map(row => typeof row.id === 'number' ? row.id : parseInt(String(row.id)) || 0)) : 0;
      const newRecord: ExcelRow = { id: maxId + 1 };
      
      // Initialize all columns with empty values or provided data
      columnsMaster.forEach(col => {
        if (col.field !== 'id') {
          newRecord[col.field] = rowData?.[col.field] || '';
        }
      });
      
      const updatedRows = [...rowsMaster, newRecord];
      callbacks.setRowsMaster(updatedRows);
      
      // Update sheet data
      const currentSheet = masterSheetNames[activeMasterTab];
      if (currentSheet && masterSheetData[currentSheet]) {
        const updatedSheetData = {
          ...masterSheetData,
          [currentSheet]: {
            ...masterSheetData[currentSheet],
            rows: updatedRows
          }
        };
        callbacks.setMasterSheetData(updatedSheetData);
      }
      
      callbacks.setHasUnsavedMasterChanges(true);
      console.log(`New record added to master grid. New record ID: ${newRecord.id}`);
    } else if (gridType === 'client') {
      const maxId = rowsClient.length > 0 ? Math.max(...rowsClient.map(row => typeof row.id === 'number' ? row.id : parseInt(String(row.id)) || 0)) : 0;
      const newRecord: ExcelRow = { id: maxId + 1 };
      
      // Initialize all columns with empty values or provided data
      columnsClient.forEach(col => {
        if (col.field !== 'id') {
          newRecord[col.field] = rowData?.[col.field] || '';
        }
      });
      
      const updatedRows = [...rowsClient, newRecord];
      callbacks.setRowsClient(updatedRows);
      
      // Update sheet data
      const currentSheet = clientSheetNames[activeClientTab];
      if (currentSheet && clientSheetData[currentSheet]) {
        const updatedSheetData = {
          ...clientSheetData,
          [currentSheet]: {
            ...clientSheetData[currentSheet],
            rows: updatedRows
          }
        };
        callbacks.setClientSheetData(updatedSheetData);
      }
      
      callbacks.setHasUnsavedChanges(true);
      console.log(`New record added to client grid. New record ID: ${newRecord.id}`);
    } else if (gridType === 'merged') {
      const maxId = mergedRows.length > 0 ? Math.max(...mergedRows.map(row => typeof row.id === 'number' ? row.id : parseInt(String(row.id)) || 0)) : 0;
      const newRecord: ExcelRow = { id: maxId + 1 };
      
      // Initialize all columns with empty values or provided data
      mergedColumns.forEach(col => {
        if (col.field !== 'id') {
          newRecord[col.field] = rowData?.[col.field] || '';
        }
      });
      
      const updatedRows = [...mergedRows, newRecord];
      callbacks.setMergedRows(updatedRows);
      callbacks.setMergedForExport(updatedRows);
      callbacks.setHasUnsavedMergedChanges(true);
      console.log(`New record added to merged grid. New record ID: ${newRecord.id}`);
    }
  };

  return {
    handleDuplicateRecord,
    handleDeleteRecord,
    handleDeleteMultipleRecords,
    handleAddRecord
  };
};