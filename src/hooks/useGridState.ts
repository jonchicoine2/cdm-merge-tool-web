import { useState, useCallback, useMemo } from 'react';
import { GridRowSelectionModel, GridSortModel } from '@mui/x-data-grid';
import { ExcelRow, ComparisonStats } from '../utils/excelOperations';
import { filterAndSearchRows } from '../utils/excelOperations';

export interface GridStateOptions {
  enableSearch?: boolean;
  enableSelection?: boolean;
  enableSorting?: boolean;
  defaultPageSize?: number;
}

export interface UseGridStateReturn {
  // Search state
  searchMaster: string;
  searchClient: string;
  searchMerged: string;
  searchUnmatched: string;
  searchDuplicates: string;
  
  // Selection state
  selectionMaster: GridRowSelectionModel;
  selectionClient: GridRowSelectionModel;
  selectionMerged: GridRowSelectionModel;
  selectionUnmatched: GridRowSelectionModel;
  selectionDuplicates: GridRowSelectionModel;
  
  // Sort state
  sortModelMaster: GridSortModel;
  sortModelClient: GridSortModel;
  sortModelMerged: GridSortModel;
  sortModelUnmatched: GridSortModel;
  sortModelDuplicates: GridSortModel;
  
  // Merged data state
  mergedRows: ExcelRow[];
  unmatchedClient: ExcelRow[];
  dupsClient: ExcelRow[];
  mergedForExport: ExcelRow[];
  comparisonStats: ComparisonStats | null;
  showCompare: boolean;
  
  // Tab state
  errorsTabValue: number;
  
  // Search handlers
  setSearchMaster: (search: string) => void;
  setSearchClient: (search: string) => void;
  setSearchMerged: (search: string) => void;
  setSearchUnmatched: (search: string) => void;
  setSearchDuplicates: (search: string) => void;
  clearAllSearches: () => void;
  
  // Selection handlers
  setSelectionMaster: (selection: GridRowSelectionModel) => void;
  setSelectionClient: (selection: GridRowSelectionModel) => void;
  setSelectionMerged: (selection: GridRowSelectionModel) => void;
  setSelectionUnmatched: (selection: GridRowSelectionModel) => void;
  setSelectionDuplicates: (selection: GridRowSelectionModel) => void;
  clearAllSelections: () => void;
  
  // Sort handlers
  setSortModelMaster: (sortModel: GridSortModel) => void;
  setSortModelClient: (sortModel: GridSortModel) => void;
  setSortModelMerged: (sortModel: GridSortModel) => void;
  setSortModelUnmatched: (sortModel: GridSortModel) => void;
  setSortModelDuplicates: (sortModel: GridSortModel) => void;
  clearAllSorts: () => void;
  
  // Data handlers
  setMergedRows: (rows: ExcelRow[]) => void;
  setUnmatchedClient: (rows: ExcelRow[]) => void;
  setDupsClient: (rows: ExcelRow[]) => void;
  setMergedForExport: (rows: ExcelRow[]) => void;
  setComparisonStats: (stats: ComparisonStats | null) => void;
  setShowCompare: (show: boolean) => void;
  setErrorsTabValue: (value: number) => void;
  
  // Utility functions
  getFilteredMasterData: (data: ExcelRow[]) => ExcelRow[];
  getFilteredClientData: (data: ExcelRow[]) => ExcelRow[];
  getFilteredMergedData: (data: ExcelRow[]) => ExcelRow[];
  getFilteredUnmatchedData: (data: ExcelRow[]) => ExcelRow[];
  getFilteredDuplicatesData: (data: ExcelRow[]) => ExcelRow[];
  
  // Selection utilities
  getSelectedMasterRows: (data: ExcelRow[]) => ExcelRow[];
  getSelectedClientRows: (data: ExcelRow[]) => ExcelRow[];
  getSelectedMergedRows: (data: ExcelRow[]) => ExcelRow[];
  getSelectedUnmatchedRows: (data: ExcelRow[]) => ExcelRow[];
  getSelectedDuplicatesRows: (data: ExcelRow[]) => ExcelRow[];
  
  // Grid state utilities
  resetAllGridStates: () => void;
  exportGridSelections: () => {
    master: GridRowSelectionModel;
    client: GridRowSelectionModel;
    merged: GridRowSelectionModel;
    unmatched: GridRowSelectionModel;
    duplicates: GridRowSelectionModel;
  };
}

export function useGridState(options: GridStateOptions = {}): UseGridStateReturn {
  const {
    enableSearch = true,
    enableSelection = true,
    enableSorting = true,
    defaultPageSize = 25
  } = options;

  // Search state
  const [searchMaster, setSearchMaster] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [searchMerged, setSearchMerged] = useState('');
  const [searchUnmatched, setSearchUnmatched] = useState('');
  const [searchDuplicates, setSearchDuplicates] = useState('');

  // Selection state
  const [selectionMaster, setSelectionMaster] = useState<GridRowSelectionModel>([]);
  const [selectionClient, setSelectionClient] = useState<GridRowSelectionModel>([]);
  const [selectionMerged, setSelectionMerged] = useState<GridRowSelectionModel>([]);
  const [selectionUnmatched, setSelectionUnmatched] = useState<GridRowSelectionModel>([]);
  const [selectionDuplicates, setSelectionDuplicates] = useState<GridRowSelectionModel>([]);

  // Sort state
  const [sortModelMaster, setSortModelMaster] = useState<GridSortModel>([]);
  const [sortModelClient, setSortModelClient] = useState<GridSortModel>([]);
  const [sortModelMerged, setSortModelMerged] = useState<GridSortModel>([]);
  const [sortModelUnmatched, setSortModelUnmatched] = useState<GridSortModel>([]);
  const [sortModelDuplicates, setSortModelDuplicates] = useState<GridSortModel>([]);

  // Merged data state
  const [mergedRows, setMergedRows] = useState<ExcelRow[]>([]);
  const [unmatchedClient, setUnmatchedClient] = useState<ExcelRow[]>([]);
  const [dupsClient, setDupsClient] = useState<ExcelRow[]>([]);
  const [mergedForExport, setMergedForExport] = useState<ExcelRow[]>([]);
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  // Tab state
  const [errorsTabValue, setErrorsTabValue] = useState(0);

  // Search handlers
  const clearAllSearches = useCallback(() => {
    setSearchMaster('');
    setSearchClient('');
    setSearchMerged('');
    setSearchUnmatched('');
    setSearchDuplicates('');
  }, []);

  // Selection handlers
  const clearAllSelections = useCallback(() => {
    setSelectionMaster([]);
    setSelectionClient([]);
    setSelectionMerged([]);
    setSelectionUnmatched([]);
    setSelectionDuplicates([]);
  }, []);

  // Sort handlers
  const clearAllSorts = useCallback(() => {
    setSortModelMaster([]);
    setSortModelClient([]);
    setSortModelMerged([]);
    setSortModelUnmatched([]);
    setSortModelDuplicates([]);
  }, []);

  // Filtered data getters using useMemo for performance
  const getFilteredMasterData = useCallback((data: ExcelRow[]) => {
    if (!enableSearch || !searchMaster) return data;
    return filterAndSearchRows(data, {}, searchMaster);
  }, [searchMaster, enableSearch]);

  const getFilteredClientData = useCallback((data: ExcelRow[]) => {
    if (!enableSearch || !searchClient) return data;
    return filterAndSearchRows(data, {}, searchClient);
  }, [searchClient, enableSearch]);

  const getFilteredMergedData = useCallback((data: ExcelRow[]) => {
    if (!enableSearch || !searchMerged) return data;
    return filterAndSearchRows(data, {}, searchMerged);
  }, [searchMerged, enableSearch]);

  const getFilteredUnmatchedData = useCallback((data: ExcelRow[]) => {
    if (!enableSearch || !searchUnmatched) return data;
    return filterAndSearchRows(data, {}, searchUnmatched);
  }, [searchUnmatched, enableSearch]);

  const getFilteredDuplicatesData = useCallback((data: ExcelRow[]) => {
    if (!enableSearch || !searchDuplicates) return data;
    return filterAndSearchRows(data, {}, searchDuplicates);
  }, [searchDuplicates, enableSearch]);

  // Selection utilities
  const getSelectedMasterRows = useCallback((data: ExcelRow[]) => {
    if (!enableSelection) return [];
    return data.filter(row => selectionMaster.includes(row.id));
  }, [selectionMaster, enableSelection]);

  const getSelectedClientRows = useCallback((data: ExcelRow[]) => {
    if (!enableSelection) return [];
    return data.filter(row => selectionClient.includes(row.id));
  }, [selectionClient, enableSelection]);

  const getSelectedMergedRows = useCallback((data: ExcelRow[]) => {
    if (!enableSelection) return [];
    return data.filter(row => selectionMerged.includes(row.id));
  }, [selectionMerged, enableSelection]);

  const getSelectedUnmatchedRows = useCallback((data: ExcelRow[]) => {
    if (!enableSelection) return [];
    return data.filter(row => selectionUnmatched.includes(row.id));
  }, [selectionUnmatched, enableSelection]);

  const getSelectedDuplicatesRows = useCallback((data: ExcelRow[]) => {
    if (!enableSelection) return [];
    return data.filter(row => selectionDuplicates.includes(row.id));
  }, [selectionDuplicates, enableSelection]);

  // Reset all grid states
  const resetAllGridStates = useCallback(() => {
    clearAllSearches();
    clearAllSelections();
    clearAllSorts();
    setMergedRows([]);
    setUnmatchedClient([]);
    setDupsClient([]);
    setMergedForExport([]);
    setComparisonStats(null);
    setShowCompare(false);
    setErrorsTabValue(0);
  }, [clearAllSearches, clearAllSelections, clearAllSorts]);

  // Export grid selections
  const exportGridSelections = useCallback(() => {
    return {
      master: selectionMaster,
      client: selectionClient,
      merged: selectionMerged,
      unmatched: selectionUnmatched,
      duplicates: selectionDuplicates,
    };
  }, [selectionMaster, selectionClient, selectionMerged, selectionUnmatched, selectionDuplicates]);

  return {
    // Search state
    searchMaster,
    searchClient,
    searchMerged,
    searchUnmatched,
    searchDuplicates,
    
    // Selection state
    selectionMaster,
    selectionClient,
    selectionMerged,
    selectionUnmatched,
    selectionDuplicates,
    
    // Sort state
    sortModelMaster,
    sortModelClient,
    sortModelMerged,
    sortModelUnmatched,
    sortModelDuplicates,
    
    // Merged data state
    mergedRows,
    unmatchedClient,
    dupsClient,
    mergedForExport,
    comparisonStats,
    showCompare,
    
    // Tab state
    errorsTabValue,
    
    // Search handlers
    setSearchMaster,
    setSearchClient,
    setSearchMerged,
    setSearchUnmatched,
    setSearchDuplicates,
    clearAllSearches,
    
    // Selection handlers
    setSelectionMaster,
    setSelectionClient,
    setSelectionMerged,
    setSelectionUnmatched,
    setSelectionDuplicates,
    clearAllSelections,
    
    // Sort handlers
    setSortModelMaster,
    setSortModelClient,
    setSortModelMerged,
    setSortModelUnmatched,
    setSortModelDuplicates,
    clearAllSorts,
    
    // Data handlers
    setMergedRows,
    setUnmatchedClient,
    setDupsClient,
    setMergedForExport,
    setComparisonStats,
    setShowCompare,
    setErrorsTabValue,
    
    // Utility functions
    getFilteredMasterData,
    getFilteredClientData,
    getFilteredMergedData,
    getFilteredUnmatchedData,
    getFilteredDuplicatesData,
    
    // Selection utilities
    getSelectedMasterRows,
    getSelectedClientRows,
    getSelectedMergedRows,
    getSelectedUnmatchedRows,
    getSelectedDuplicatesRows,
    
    // Grid state utilities
    resetAllGridStates,
    exportGridSelections,
  };
}