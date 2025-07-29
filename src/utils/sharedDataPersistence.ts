import { GridColDef } from '@mui/x-data-grid-pro';
import { ExcelRow, ComparisonStats, ModifierCriteria, FileMetadata } from './excelOperations';
import { SheetData } from '../components/excel-import/types';

// Shared data structure for cross-page persistence
export interface SharedAppData {
  // Master data
  rowsMaster: ExcelRow[];
  columnsMaster: GridColDef[];
  masterSheetData: {[sheetName: string]: SheetData};
  masterSheetNames: string[];
  activeMasterTab: number;
  masterFileMetadata: FileMetadata | null;

  // Client data  
  rowsClient: ExcelRow[];
  columnsClient: GridColDef[];
  clientSheetData: {[sheetName: string]: SheetData};
  clientSheetNames: string[];
  activeClientTab: number;
  clientFileMetadata: FileMetadata | null;

  // Comparison results
  mergedRows: ExcelRow[];
  mergedColumns: GridColDef[];
  unmatchedClient: ExcelRow[];
  dupsClient: ExcelRow[];
  showCompare: boolean;
  comparisonStats: ComparisonStats | null;

  // Settings
  modifierCriteria: ModifierCriteria;

  // Metadata
  lastSaved: string;
  sourceUI: 'main' | 'clean';
}

const SHARED_DATA_KEY = 'sharedAppData';

/**
 * Save current application data to localStorage for cross-page sharing
 */
export const saveSharedData = (data: SharedAppData): void => {
  try {
    const serializedData = JSON.stringify({
      ...data,
      lastSaved: new Date().toISOString()
    });
    localStorage.setItem(SHARED_DATA_KEY, serializedData);
    console.log('[SHARED DATA] Data saved successfully from', data.sourceUI, 'UI');
  } catch (error) {
    console.error('[SHARED DATA] Failed to save data:', error);
  }
};

/**
 * Load shared application data from localStorage
 */
export const loadSharedData = (): SharedAppData | null => {
  try {
    const serializedData = localStorage.getItem(SHARED_DATA_KEY);
    if (!serializedData) {
      console.log('[SHARED DATA] No shared data found');
      return null;
    }

    const data = JSON.parse(serializedData) as SharedAppData;
    
    // Convert date strings back to Date objects in metadata
    if (data.masterFileMetadata?.uploadTime) {
      data.masterFileMetadata.uploadTime = new Date(data.masterFileMetadata.uploadTime);
    }
    if (data.clientFileMetadata?.uploadTime) {
      data.clientFileMetadata.uploadTime = new Date(data.clientFileMetadata.uploadTime);
    }

    console.log('[SHARED DATA] Data loaded successfully, saved from', data.sourceUI, 'UI at', data.lastSaved);
    return data;
  } catch (error) {
    console.error('[SHARED DATA] Failed to load data:', error);
    return null;
  }
};

/**
 * Clear shared data from localStorage
 */
export const clearSharedData = (): void => {
  try {
    localStorage.removeItem(SHARED_DATA_KEY);
    console.log('[SHARED DATA] Shared data cleared');
  } catch (error) {
    console.error('[SHARED DATA] Failed to clear data:', error);
  }
};

/**
 * Check if shared data exists and is recent (within last hour)
 */
export const hasRecentSharedData = (): boolean => {
  try {
    const data = loadSharedData();
    if (!data) return false;

    const lastSaved = new Date(data.lastSaved);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    return lastSaved > oneHourAgo;
  } catch (error) {
    console.error('[SHARED DATA] Failed to check recent data:', error);
    return false;
  }
};

/**
 * Create default empty shared data structure
 */
export const createEmptySharedData = (sourceUI: 'main' | 'clean'): SharedAppData => ({
  // Master data
  rowsMaster: [],
  columnsMaster: [],
  masterSheetData: {},
  masterSheetNames: [],
  activeMasterTab: 0,
  masterFileMetadata: null,

  // Client data
  rowsClient: [],
  columnsClient: [],
  clientSheetData: {},
  clientSheetNames: [],
  activeClientTab: 0,
  clientFileMetadata: null,

  // Comparison results
  mergedRows: [],
  mergedColumns: [],
  unmatchedClient: [],
  dupsClient: [],
  showCompare: false,
  comparisonStats: null,

  // Settings
  modifierCriteria: {
    root00: false,
    root25: false,
    root50: false,
    root59: false,
    rootXU: false,
    root76: false,
    ignoreTrauma: false
  },

  // Metadata
  lastSaved: new Date().toISOString(),
  sourceUI
});
