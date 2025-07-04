import { useState, useCallback, useEffect, useRef } from 'react';
import { ExcelRow } from '../utils/excelOperations';

export interface EditTrackingState {
  hasUnsavedChanges: boolean;
  hasUnsavedMasterChanges: boolean;
  originalData: ExcelRow[];
  originalMasterData: ExcelRow[];
  editedRows: Set<number>;
  editedMasterRows: Set<number>;
  changeHistory: EditChange[];
  canUndo: boolean;
  canRedo: boolean;
}

export interface EditChange {
  id: string;
  timestamp: Date;
  type: 'add' | 'update' | 'delete' | 'bulk';
  rowId?: number;
  rowIds?: number[];
  oldValue?: any;
  newValue?: any;
  field?: string;
  description: string;
}

export interface UseEditTrackingReturn extends EditTrackingState {
  // Change tracking
  trackCellEdit: (rowId: number, field: string, oldValue: any, newValue: any, isClient?: boolean) => void;
  trackRowAdd: (row: ExcelRow, isClient?: boolean) => void;
  trackRowDelete: (rowId: number, isClient?: boolean) => void;
  trackBulkOperation: (description: string, rowIds: number[], isClient?: boolean) => void;
  
  // State management
  markAsUnsaved: (isClient?: boolean) => void;
  markAsSaved: (isClient?: boolean) => void;
  resetChanges: (isClient?: boolean) => void;
  resetAllChanges: () => void;
  
  // Original data management
  setOriginalData: (data: ExcelRow[], isClient?: boolean) => void;
  restoreOriginalData: (isClient?: boolean) => ExcelRow[];
  hasDataChanged: (currentData: ExcelRow[], isClient?: boolean) => boolean;
  
  // Undo/Redo functionality
  undo: () => EditChange | null;
  redo: () => EditChange | null;
  clearHistory: () => void;
  
  // Validation and warnings
  getUnsavedRowCount: (isClient?: boolean) => number;
  getEditSummary: (isClient?: boolean) => {
    totalChanges: number;
    addedRows: number;
    editedRows: number;
    deletedRows: number;
  };
  
  // Auto-save functionality
  enableAutoSave: (callback: (data: ExcelRow[], isClient: boolean) => void, interval?: number) => void;
  disableAutoSave: () => void;
  
  // Conflict detection
  detectConflicts: (serverData: ExcelRow[], clientData: ExcelRow[]) => {
    conflicts: Array<{rowId: number, field: string, clientValue: any, serverValue: any}>;
    hasConflicts: boolean;
  };
}

export function useEditTracking(): UseEditTrackingReturn {
  // State
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasUnsavedMasterChanges, setHasUnsavedMasterChanges] = useState(false);
  const [originalData, setOriginalDataState] = useState<ExcelRow[]>([]);
  const [originalMasterData, setOriginalMasterDataState] = useState<ExcelRow[]>([]);
  const [editedRows, setEditedRows] = useState<Set<number>>(new Set());
  const [editedMasterRows, setEditedMasterRows] = useState<Set<number>>(new Set());
  const [changeHistory, setChangeHistory] = useState<EditChange[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Auto-save refs
  const autoSaveInterval = useRef<NodeJS.Timeout | null>(null);
  const autoSaveCallback = useRef<((data: ExcelRow[], isClient: boolean) => void) | null>(null);

  // Computed state
  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < changeHistory.length - 1;

  // Change tracking functions
  const generateChangeId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addToHistory = useCallback((change: EditChange) => {
    setChangeHistory(prev => {
      // Remove any changes after current index (for redo functionality)
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(change);
      
      // Limit history size to prevent memory issues
      const maxHistorySize = 100;
      if (newHistory.length > maxHistorySize) {
        return newHistory.slice(-maxHistorySize);
      }
      
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const trackCellEdit = useCallback((
    rowId: number, 
    field: string, 
    oldValue: any, 
    newValue: any, 
    isClient = true
  ) => {
    const change: EditChange = {
      id: generateChangeId(),
      timestamp: new Date(),
      type: 'update',
      rowId,
      field,
      oldValue,
      newValue,
      description: `Updated ${field} for row ${rowId}`
    };

    addToHistory(change);
    
    if (isClient) {
      setEditedRows(prev => new Set(prev).add(rowId));
      setHasUnsavedChanges(true);
    } else {
      setEditedMasterRows(prev => new Set(prev).add(rowId));
      setHasUnsavedMasterChanges(true);
    }
  }, [addToHistory]);

  const trackRowAdd = useCallback((row: ExcelRow, isClient = true) => {
    const change: EditChange = {
      id: generateChangeId(),
      timestamp: new Date(),
      type: 'add',
      rowId: row.id,
      newValue: row,
      description: `Added new row ${row.id}`
    };

    addToHistory(change);
    
    if (isClient) {
      setEditedRows(prev => new Set(prev).add(row.id));
      setHasUnsavedChanges(true);
    } else {
      setEditedMasterRows(prev => new Set(prev).add(row.id));
      setHasUnsavedMasterChanges(true);
    }
  }, [addToHistory]);

  const trackRowDelete = useCallback((rowId: number, isClient = true) => {
    const change: EditChange = {
      id: generateChangeId(),
      timestamp: new Date(),
      type: 'delete',
      rowId,
      description: `Deleted row ${rowId}`
    };

    addToHistory(change);
    
    if (isClient) {
      setEditedRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(rowId);
        return newSet;
      });
      setHasUnsavedChanges(true);
    } else {
      setEditedMasterRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(rowId);
        return newSet;
      });
      setHasUnsavedMasterChanges(true);
    }
  }, [addToHistory]);

  const trackBulkOperation = useCallback((
    description: string, 
    rowIds: number[], 
    isClient = true
  ) => {
    const change: EditChange = {
      id: generateChangeId(),
      timestamp: new Date(),
      type: 'bulk',
      rowIds,
      description
    };

    addToHistory(change);
    
    if (isClient) {
      setEditedRows(prev => {
        const newSet = new Set(prev);
        rowIds.forEach(id => newSet.add(id));
        return newSet;
      });
      setHasUnsavedChanges(true);
    } else {
      setEditedMasterRows(prev => {
        const newSet = new Set(prev);
        rowIds.forEach(id => newSet.add(id));
        return newSet;
      });
      setHasUnsavedMasterChanges(true);
    }
  }, [addToHistory]);

  // State management
  const markAsUnsaved = useCallback((isClient = true) => {
    if (isClient) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedMasterChanges(true);
    }
  }, []);

  const markAsSaved = useCallback((isClient = true) => {
    if (isClient) {
      setHasUnsavedChanges(false);
      setEditedRows(new Set());
    } else {
      setHasUnsavedMasterChanges(false);
      setEditedMasterRows(new Set());
    }
  }, []);

  const resetChanges = useCallback((isClient = true) => {
    if (isClient) {
      setHasUnsavedChanges(false);
      setEditedRows(new Set());
    } else {
      setHasUnsavedMasterChanges(false);
      setEditedMasterRows(new Set());
    }
  }, []);

  const resetAllChanges = useCallback(() => {
    setHasUnsavedChanges(false);
    setHasUnsavedMasterChanges(false);
    setEditedRows(new Set());
    setEditedMasterRows(new Set());
    setChangeHistory([]);
    setHistoryIndex(-1);
  }, []);

  // Original data management
  const setOriginalData = useCallback((data: ExcelRow[], isClient = true) => {
    const dataCopy = data.map(row => ({ ...row }));
    if (isClient) {
      setOriginalDataState(dataCopy);
    } else {
      setOriginalMasterDataState(dataCopy);
    }
  }, []);

  const restoreOriginalData = useCallback((isClient = true) => {
    const dataToRestore = isClient ? originalData : originalMasterData;
    resetChanges(isClient);
    return dataToRestore.map(row => ({ ...row }));
  }, [originalData, originalMasterData, resetChanges]);

  const hasDataChanged = useCallback((currentData: ExcelRow[], isClient = true) => {
    const original = isClient ? originalData : originalMasterData;
    
    if (currentData.length !== original.length) return true;
    
    // Sort both arrays by ID for comparison
    const sortedCurrent = [...currentData].sort((a, b) => a.id - b.id);
    const sortedOriginal = [...original].sort((a, b) => a.id - b.id);
    
    return !sortedCurrent.every((row, index) => {
      const originalRow = sortedOriginal[index];
      if (!originalRow || row.id !== originalRow.id) return false;
      
      return Object.keys(row).every(key => row[key] === originalRow[key]);
    });
  }, [originalData, originalMasterData]);

  // Undo/Redo functionality
  const undo = useCallback(() => {
    if (!canUndo) return null;
    
    const change = changeHistory[historyIndex];
    setHistoryIndex(prev => prev - 1);
    
    return change;
  }, [canUndo, changeHistory, historyIndex]);

  const redo = useCallback(() => {
    if (!canRedo) return null;
    
    const change = changeHistory[historyIndex + 1];
    setHistoryIndex(prev => prev + 1);
    
    return change;
  }, [canRedo, changeHistory, historyIndex]);

  const clearHistory = useCallback(() => {
    setChangeHistory([]);
    setHistoryIndex(-1);
  }, []);

  // Validation and warnings
  const getUnsavedRowCount = useCallback((isClient = true) => {
    return isClient ? editedRows.size : editedMasterRows.size;
  }, [editedRows, editedMasterRows]);

  const getEditSummary = useCallback((isClient = true) => {
    const relevantHistory = changeHistory.filter(change => {
      // This is simplified - in practice you'd track which changes belong to which dataset
      return true;
    });

    const summary = {
      totalChanges: relevantHistory.length,
      addedRows: relevantHistory.filter(c => c.type === 'add').length,
      editedRows: relevantHistory.filter(c => c.type === 'update').length,
      deletedRows: relevantHistory.filter(c => c.type === 'delete').length
    };

    return summary;
  }, [changeHistory]);

  // Auto-save functionality
  const enableAutoSave = useCallback((
    callback: (data: ExcelRow[], isClient: boolean) => void, 
    interval = 30000
  ) => {
    autoSaveCallback.current = callback;
    
    if (autoSaveInterval.current) {
      clearInterval(autoSaveInterval.current);
    }
    
    autoSaveInterval.current = setInterval(() => {
      if (hasUnsavedChanges && autoSaveCallback.current) {
        // This would need access to current data - in practice you'd pass data or use context
        console.log('Auto-saving client data...');
      }
      if (hasUnsavedMasterChanges && autoSaveCallback.current) {
        console.log('Auto-saving master data...');
      }
    }, interval);
  }, [hasUnsavedChanges, hasUnsavedMasterChanges]);

  const disableAutoSave = useCallback(() => {
    if (autoSaveInterval.current) {
      clearInterval(autoSaveInterval.current);
      autoSaveInterval.current = null;
    }
    autoSaveCallback.current = null;
  }, []);

  // Conflict detection
  const detectConflicts = useCallback((
    serverData: ExcelRow[], 
    clientData: ExcelRow[]
  ) => {
    const conflicts: Array<{rowId: number, field: string, clientValue: any, serverValue: any}> = [];
    
    clientData.forEach(clientRow => {
      const serverRow = serverData.find(row => row.id === clientRow.id);
      if (serverRow) {
        Object.keys(clientRow).forEach(field => {
          if (field !== 'id' && clientRow[field] !== serverRow[field]) {
            conflicts.push({
              rowId: clientRow.id,
              field,
              clientValue: clientRow[field],
              serverValue: serverRow[field]
            });
          }
        });
      }
    });

    return {
      conflicts,
      hasConflicts: conflicts.length > 0
    };
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (autoSaveInterval.current) {
        clearInterval(autoSaveInterval.current);
      }
    };
  }, []);

  return {
    // State
    hasUnsavedChanges,
    hasUnsavedMasterChanges,
    originalData,
    originalMasterData,
    editedRows,
    editedMasterRows,
    changeHistory,
    canUndo,
    canRedo,

    // Change tracking
    trackCellEdit,
    trackRowAdd,
    trackRowDelete,
    trackBulkOperation,

    // State management
    markAsUnsaved,
    markAsSaved,
    resetChanges,
    resetAllChanges,

    // Original data management
    setOriginalData,
    restoreOriginalData,
    hasDataChanged,

    // Undo/Redo functionality
    undo,
    redo,
    clearHistory,

    // Validation and warnings
    getUnsavedRowCount,
    getEditSummary,

    // Auto-save functionality
    enableAutoSave,
    disableAutoSave,

    // Conflict detection
    detectConflicts,
  };
}