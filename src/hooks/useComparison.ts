import { useState, useCallback } from 'react';
import { GridColDef } from '@mui/x-data-grid-pro';
import {
  ExcelRow,
  ComparisonStats,
  ModifierCriteria,
  getHCPCSColumn,
  getModifierColumn,
  getQuantityColumn,
  createColumnMapping,
  getCompareKey,
  parseMultiplierCode,
  applyMultiplierQuantityLogic,
  validateForDuplicates
} from '../utils/excelOperations';

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
    
    // Find quantity columns for multiplier logic
    const masterQtyCol = getQuantityColumn(columnsMaster);
    const clientQtyCol = getQuantityColumn(columnsClient);

    console.log('[COMPARISON] Found columns:', {
      masterHcpcs: masterHcpcsCol,
      masterModifier: masterModifierCol,
      clientHcpcs: clientHcpcsCol,
      clientModifier: clientModifierCol,
      masterQty: masterQtyCol,
      clientQty: clientQtyCol
    });

    // Create column mapping
    const columnMapping = createColumnMapping(columnsMaster, columnsClient);
    console.log('[COMPARISON] Column mapping:', columnMapping);
    
    // Create client lookup map for efficient matching
    const clientLookup = new Map<string, ExcelRow>();
    rowsClient.forEach(row => {
      const key = getCompareKey(row, clientHcpcsCol, clientModifierCol, modifierCriteria);
      if (key) {
        clientLookup.set(key, row);
      }
    });

    console.log('[COMPARISON] Client lookup created with', clientLookup.size, 'entries');

    // Process master data (master-driven approach)
    const matched: ExcelRow[] = [];
    const unmatched: ExcelRow[] = [];

    // Start with all master records
    rowsMaster.forEach(masterRow => {
      const masterKey = getCompareKey(masterRow, masterHcpcsCol, masterModifierCol, modifierCriteria);
      const clientRow = clientLookup.get(masterKey);

      // Create merged row using master columns as base
      const mergedRow: ExcelRow = { id: masterRow.id };

      // Copy all master data first
      columnsMaster.forEach(col => {
        mergedRow[col.field] = masterRow[col.field];
      });

      // Override with client data where columns match (if client data exists)
      if (clientRow) {
        Object.entries(columnMapping).forEach(([masterField, clientField]) => {
          if (clientRow[clientField] !== undefined && clientRow[clientField] !== '') {
            // Special handling for quantity fields with multiplier logic
            if (masterField === masterQtyCol && masterQtyCol && clientQtyCol) {
              const masterHcpcs = String(masterRow[masterHcpcsCol] || "");
              const { hasMultiplier, multiplier } = parseMultiplierCode(masterHcpcs);

              if (hasMultiplier && multiplier !== null) {
                // Apply multiplier quantity logic
                const processedQty = applyMultiplierQuantityLogic(masterHcpcs, clientRow[clientField], multiplier);
                mergedRow[masterField] = processedQty;
              } else {
                // No multiplier, use client quantity as-is
                mergedRow[masterField] = clientRow[clientField];
              }
            } else {
              // Standard field override
              mergedRow[masterField] = clientRow[clientField];
            }
          }
        });
      }

      matched.push(mergedRow);
    });

    // Find unmatched client records
    rowsClient.forEach(clientRow => {
      const clientKey = getCompareKey(clientRow, clientHcpcsCol, clientModifierCol, modifierCriteria);
      // Check if this client record has a corresponding master record
      const hasMasterMatch = rowsMaster.some(masterRow => {
        const masterKey = getCompareKey(masterRow, masterHcpcsCol, masterModifierCol, modifierCriteria);
        return masterKey === clientKey;
      });

      if (!hasMasterMatch) {
        unmatched.push(clientRow);
      }
    });

    // No formatting needed - client data already has hyphens from file loading

    // Find duplicates in client data
    const duplicates = validateForDuplicates(rowsClient, clientHcpcsCol, clientModifierCol);
    
    // Calculate statistics
    const processingTime = Date.now() - startTime;

    // Count how many master records actually have matching client data
    const masterRecordsWithMatches = rowsMaster.filter(masterRow => {
      const masterKey = getCompareKey(masterRow, masterHcpcsCol, masterModifierCol, modifierCriteria);
      return clientLookup.has(masterKey);
    }).length;

    const matchRate = rowsClient.length > 0 ? Math.round((masterRecordsWithMatches / rowsClient.length) * 100) : 0;

    const stats: ComparisonStats = {
      totalMasterRecords: rowsMaster.length,
      totalClientRecords: rowsClient.length,
      matchedRecords: masterRecordsWithMatches, // Master records that have client matches
      unmatchedRecords: unmatched.length,
      duplicateRecords: duplicates.length,
      matchRate,
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
