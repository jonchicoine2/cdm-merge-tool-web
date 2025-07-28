import { useState } from 'react';
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

export const useComparison = () => {
  const [mergedRows, setMergedRows] = useState<ExcelRow[]>([]);
  const [mergedColumns, setMergedColumns] = useState<GridColDef[]>([]);
  const [unmatchedClient, setUnmatchedClient] = useState<ExcelRow[]>([]);
  const [dupsClient, setDupsClient] = useState<ExcelRow[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(null);

  const performComparison = (
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

    // Format HCPCS codes in merged data to ensure proper format (XXXXX-XX)
    const formattedMatched = matched.map(row => {
      const formattedRow = { ...row };
      Object.keys(formattedRow).forEach(key => {
        // Only target specifically HCPCS/CPT columns (more restrictive)
        if (key.toLowerCase().includes('hcpcs') || key.toLowerCase().includes('cpt')) {
          const value = formattedRow[key];
          if (typeof value === 'string') {
            const trimmedValue = value.trim();
            // Check for exactly 7 characters matching CPT+modifier pattern
            if (trimmedValue.length === 7 &&
                /^[A-Z0-9]{5}[A-Z0-9]{2}$/i.test(trimmedValue) &&
                !trimmedValue.includes('-')) {
              // Insert hyphen between base code and modifier
              formattedRow[key] = `${trimmedValue.substring(0, 5)}-${trimmedValue.substring(5)}`;
            }
            // Leave everything else unchanged
          }
        }
      });
      return formattedRow;
    });

    // Find duplicates in client data
    const duplicates = validateForDuplicates(rowsClient, clientHcpcsCol, clientModifierCol);
    
    // Calculate statistics
    const processingTime = Date.now() - startTime;
    const stats: ComparisonStats = {
      totalMasterRecords: rowsMaster.length,
      totalClientRecords: rowsClient.length,
      matchedRecords: formattedMatched.length,
      unmatchedRecords: unmatched.length,
      duplicateRecords: duplicates.length,
      matchRate: Math.round((formattedMatched.length / rowsClient.length) * 100),
      processingTime,
      columnsMatched: Object.keys(columnMapping).length,
      totalMasterColumns: columnsMaster.length,
      totalClientColumns: columnsClient.length
    };

    console.log('[COMPARISON] Comparison complete:', stats);

    // Update state
    setMergedRows(formattedMatched);
    setMergedColumns(columnsMaster); // Use master columns for merged data
    setUnmatchedClient(unmatched);
    setDupsClient(duplicates);
    setComparisonStats(stats);
    setShowCompare(true);
  };

  const resetComparison = () => {
    setMergedRows([]);
    setMergedColumns([]);
    setUnmatchedClient([]);
    setDupsClient([]);
    setComparisonStats(null);
    setShowCompare(false);
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
    setDupsClient
  };
};
