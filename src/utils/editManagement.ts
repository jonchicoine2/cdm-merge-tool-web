interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
}

interface EditManagementCallbacks {
  // Client grid
  setRowsClient: (rows: ExcelRow[]) => void;
  setClientSheetData: (data: any) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  setOriginalClientData: (data: ExcelRow[]) => void;
  
  // Master grid
  setRowsMaster: (rows: ExcelRow[]) => void;
  setMasterSheetData: (data: any) => void;
  setHasUnsavedMasterChanges: (hasChanges: boolean) => void;
  setOriginalMasterData: (data: ExcelRow[]) => void;
  
  // Merged grid
  setMergedRows: (rows: ExcelRow[]) => void;
  setHasUnsavedMergedChanges: (hasChanges: boolean) => void;
  setOriginalMergedData: (data: ExcelRow[]) => void;
  
  // Validation
  setDuplicateValidationErrors: (callback: (prev: any) => any) => void;
  validateForDuplicates: (rows: ExcelRow[], gridType: 'master' | 'client' | 'merged') => { hasDuplicates: boolean; duplicateKeys: any; duplicateRows: any };
}

export const createEditManagementHandlers = (
  rowsClient: ExcelRow[],
  rowsMaster: ExcelRow[],
  mergedRows: ExcelRow[],
  originalClientData: ExcelRow[],
  originalMasterData: ExcelRow[],
  originalMergedData: ExcelRow[],
  clientSheetNames: string[],
  masterSheetNames: string[],
  activeClientTab: number,
  activeMasterTab: number,
  clientSheetData: any,
  masterSheetData: any,
  callbacks: EditManagementCallbacks
) => {
  const handleSaveEdits = (gridType?: 'master' | 'client' | 'merged') => {
    if (!gridType || gridType === 'client') {
      // Validate for duplicates before saving
      const validation = callbacks.validateForDuplicates(rowsClient, 'client');
      if (validation.hasDuplicates) {
        callbacks.setDuplicateValidationErrors(prev => ({
          ...prev,
          client: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
        }));
        console.error('Cannot save: Duplicate records found in client grid', validation.duplicateKeys);
        return;
      }
      
      // Clear any previous validation errors and save
      callbacks.setDuplicateValidationErrors(prev => ({
        ...prev,
        client: { duplicateKeys: [], duplicateRows: [] }
      }));
      callbacks.setOriginalClientData([...rowsClient]);
      callbacks.setHasUnsavedChanges(false);
      console.log('Client changes saved successfully');
    }
    
    if (gridType === 'master') {
      // Validate for duplicates before saving
      const validation = callbacks.validateForDuplicates(rowsMaster, 'master');
      if (validation.hasDuplicates) {
        callbacks.setDuplicateValidationErrors(prev => ({
          ...prev,
          master: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
        }));
        console.error('Cannot save: Duplicate records found in master grid', validation.duplicateKeys);
        return;
      }
      
      // Clear any previous validation errors and save
      callbacks.setDuplicateValidationErrors(prev => ({
        ...prev,
        master: { duplicateKeys: [], duplicateRows: [] }
      }));
      callbacks.setOriginalMasterData([...rowsMaster]);
      callbacks.setHasUnsavedMasterChanges(false);
      console.log('Master changes saved successfully');
    }
    
    if (gridType === 'merged') {
      // Validate for duplicates before saving
      const validation = callbacks.validateForDuplicates(mergedRows, 'merged');
      if (validation.hasDuplicates) {
        callbacks.setDuplicateValidationErrors(prev => ({
          ...prev,
          merged: { duplicateKeys: validation.duplicateKeys, duplicateRows: validation.duplicateRows }
        }));
        console.error('Cannot save: Duplicate records found in merged grid', validation.duplicateKeys);
        return;
      }
      
      // Clear any previous validation errors and save
      callbacks.setDuplicateValidationErrors(prev => ({
        ...prev,
        merged: { duplicateKeys: [], duplicateRows: [] }
      }));
      callbacks.setOriginalMergedData([...mergedRows]);
      callbacks.setHasUnsavedMergedChanges(false);
      console.log('Merged changes saved successfully');
    }
  };

  const handleCancelEdits = (gridType?: 'master' | 'client' | 'merged') => {
    if (!gridType || gridType === 'client') {
      // Revert to original data
      callbacks.setRowsClient([...originalClientData]);
      
      // Update the sheet data as well
      const currentSheet = clientSheetNames[activeClientTab];
      if (currentSheet && clientSheetData[currentSheet]) {
        const updatedSheetData = {
          ...clientSheetData,
          [currentSheet]: {
            ...clientSheetData[currentSheet],
            rows: [...originalClientData]
          }
        };
        callbacks.setClientSheetData(updatedSheetData);
      }
      
      // Clear validation errors
      callbacks.setDuplicateValidationErrors(prev => ({
        ...prev,
        client: { duplicateKeys: [], duplicateRows: [] }
      }));
      
      callbacks.setHasUnsavedChanges(false);
      console.log('Client changes cancelled successfully');
    }
    
    if (gridType === 'master') {
      // Revert to original master data
      callbacks.setRowsMaster([...originalMasterData]);
      
      // Update the sheet data as well
      const currentSheet = masterSheetNames[activeMasterTab];
      if (currentSheet && masterSheetData[currentSheet]) {
        const updatedSheetData = {
          ...masterSheetData,
          [currentSheet]: {
            ...masterSheetData[currentSheet],
            rows: [...originalMasterData]
          }
        };
        callbacks.setMasterSheetData(updatedSheetData);
      }
      
      // Clear validation errors
      callbacks.setDuplicateValidationErrors(prev => ({
        ...prev,
        master: { duplicateKeys: [], duplicateRows: [] }
      }));
      
      callbacks.setHasUnsavedMasterChanges(false);
      console.log('Master changes cancelled successfully');
    }
    
    if (gridType === 'merged') {
      // Revert to original merged data
      callbacks.setMergedRows([...originalMergedData]);
      
      // Clear validation errors
      callbacks.setDuplicateValidationErrors(prev => ({
        ...prev,
        merged: { duplicateKeys: [], duplicateRows: [] }
      }));
      
      callbacks.setHasUnsavedMergedChanges(false);
      console.log('Merged changes cancelled successfully');
    }
  };

  return {
    handleSaveEdits,
    handleCancelEdits
  };
};