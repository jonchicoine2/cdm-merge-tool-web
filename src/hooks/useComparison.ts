import { useState, useCallback } from 'react';
import { GridColDef } from '@mui/x-data-grid-pro';
import {
  ExcelRow,
  ComparisonStats,
  ModifierCriteria,
  getHCPCSColumn,
  getModifierColumn,
  createColumnMapping,
  getCompareKey,
  validateForDuplicates
} from '../utils/excelOperations';
import { SharedAppData } from '../utils/sharedDataPersistence';

export const useComparison = () => {
  const [mergedRows, setMergedRows] = useState<ExcelRow[]>([]);
  const [mergedColumns, setMergedColumns] = useState<GridColDef[]>([]);
  const [unmatchedClient, setUnmatchedClient] = useState<ExcelRow[]>([]);
  const [dupsClient, setDupsClient] = useState<ExcelRow[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(null);

  // Create wider columns for merged grid to utilize full screen space
  const createMergedGridColumns = (masterColumns: GridColDef[]): GridColDef[] => {
    return masterColumns.map(col => {
      const fieldLower = col.field.toLowerCase();
      let width = 150; // default width for merged grid

      // Generous widths for merged grid that has full screen space
      if (fieldLower.includes('hcpcs') || fieldLower.includes('hcpc')) {
        width = 120; // More breathing room for HCPCS codes
      } else if (fieldLower.includes('cdm') || fieldLower.includes('code')) {
        width = 110; // Slightly wider for codes
      } else if (fieldLower.includes('description') || fieldLower.includes('desc')) {
        width = 400; // Much wider for descriptions - they need the space
      } else if (['quantity', 'qty', 'units', 'unit', 'count'].some(term => fieldLower.includes(term))) {
        width = 80; // A bit more room for quantities
      } else if (fieldLower.includes('modifier') || fieldLower.includes('mod')) {
        width = 110; // More space for modifiers
      } else {
        width = 150; // Generous default for other columns
      }

      return {
        ...col,
        width,
        editable: true
      };
    });
  };

  const performComparison = useCallback((
    rowsMaster: ExcelRow[],
    columnsMaster: GridColDef[],
    rowsClient: ExcelRow[],
    columnsClient: GridColDef[],
    modifierCriteria: ModifierCriteria
  ) => {
    const startTime = Date.now();
    console.log('[COMPARISON] Starting comparison with criteria:', modifierCriteria);
    
    // Find HCPCS and modifier columns
    const masterHcpcsCol = getHCPCSColumn(columnsMaster);
    const masterModifierCol = getModifierColumn(columnsMaster);
    const clientHcpcsCol = getHCPCSColumn(columnsClient);
    const clientModifierCol = getModifierColumn(columnsClient);
    
    if (!masterHcpcsCol || !clientHcpcsCol) {
      console.error('[COMPARISON] Could not find HCPCS columns');
      alert('Could not find HCPCS columns in the data. Please ensure your files contain HCPCS code columns.');
      return;
    }
    
    console.log('[COMPARISON] Found columns:', {
      masterHcpcs: masterHcpcsCol,
      masterModifier: masterModifierCol,
      clientHcpcs: clientHcpcsCol,
      clientModifier: clientModifierCol
    });
    
    // Create column mapping
    const columnMapping = createColumnMapping(columnsMaster, columnsClient);
    console.log('[COMPARISON] Column mapping:', columnMapping);
    
    // Create master lookup map
    const masterLookup = new Map<string, ExcelRow>();
    rowsMaster.forEach(row => {
      const key = getCompareKey(row, masterHcpcsCol, masterModifierCol, modifierCriteria);
      if (key) {
        masterLookup.set(key, row);
      }
    });
    
    console.log('[COMPARISON] Master lookup created with', masterLookup.size, 'entries');
    
    // Process client data
    const matched: ExcelRow[] = [];
    const unmatched: ExcelRow[] = [];
    
    rowsClient.forEach(clientRow => {
      const clientKey = getCompareKey(clientRow, clientHcpcsCol, clientModifierCol, modifierCriteria);
      
      if (clientKey && masterLookup.has(clientKey)) {
        const masterRow = masterLookup.get(clientKey)!;
        
        // Create merged row using master columns as base
        const mergedRow: ExcelRow = { id: clientRow.id };
        
        // Copy all master data first
        columnsMaster.forEach(col => {
          mergedRow[col.field] = masterRow[col.field];
        });
        
        // Override with client data where columns match
        Object.entries(columnMapping).forEach(([masterField, clientField]) => {
          if (clientRow[clientField] !== undefined && clientRow[clientField] !== '') {
            mergedRow[masterField] = clientRow[clientField];
          }
        });
        
        matched.push(mergedRow);
      } else {
        unmatched.push(clientRow);
      }
    });

    // No formatting needed - client data already has hyphens from file loading

    // Find duplicates in client data
    const duplicates = validateForDuplicates(rowsClient, clientHcpcsCol, clientModifierCol);
    
    // Calculate statistics
    const processingTime = Date.now() - startTime;
    const stats: ComparisonStats = {
      totalMasterRecords: rowsMaster.length,
      totalClientRecords: rowsClient.length,
      matchedRecords: matched.length,
      unmatchedRecords: unmatched.length,
      duplicateRecords: duplicates.length,
      matchRate: Math.round((matched.length / rowsClient.length) * 100),
      processingTime,
      columnsMatched: Object.keys(columnMapping).length,
      totalMasterColumns: columnsMaster.length,
      totalClientColumns: columnsClient.length
    };

    console.log('[COMPARISON] Comparison complete:', stats);

    // Update state
    setMergedRows(matched);
    setMergedColumns(createMergedGridColumns(columnsMaster)); // Use wider columns for merged grid
    setUnmatchedClient(unmatched);
    setDupsClient(duplicates);
    setComparisonStats(stats);
    setShowCompare(true);
  }, []); // Empty dependency array since this function doesn't depend on any external values

  const resetComparison = () => {
    setMergedRows([]);
    setMergedColumns([]);
    setUnmatchedClient([]);
    setDupsClient([]);
    setComparisonStats(null);
    setShowCompare(false);
  };

  const loadSharedData = (sharedData: SharedAppData) => {
    setMergedRows(sharedData.mergedRows || []);
    // Ensure merged columns have proper widths for full screen display
    const mergedCols = sharedData.mergedColumns || [];
    setMergedColumns(mergedCols.length > 0 ? createMergedGridColumns(mergedCols) : []);
    setUnmatchedClient(sharedData.unmatchedClient || []);
    setDupsClient(sharedData.dupsClient || []);
    setComparisonStats(sharedData.comparisonStats);
    setShowCompare(sharedData.showCompare || false);
  };

  return {
    mergedRows,
    mergedColumns,
    unmatchedClient,
    dupsClient,
    showCompare,
    comparisonStats,
    performComparison,
    resetComparison,
    setMergedRows,
    setUnmatchedClient,
    setDupsClient,
    loadSharedData
  };
};
