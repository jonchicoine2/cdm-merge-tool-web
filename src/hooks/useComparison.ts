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
  applyMultiplierQuantityLogic
} from '../utils/excelOperations';

export interface ComparisonComputation {
  mergedRows: ExcelRow[];
  mergedColumns: GridColDef[];
  unmatchedClient: ExcelRow[];
  dupsClient: ExcelRow[];
  comparisonStats: ComparisonStats;
}

const normalizeFieldName = (field: string): string =>
  field.toLowerCase().replace(/[\s_-]+/g, '');

const isPhysicianCdmField = (field: string): boolean =>
  normalizeFieldName(field) === 'physiciancdm';

const isCdmField = (field: string): boolean =>
  normalizeFieldName(field) === 'cdm';

const isBlankValue = (value: string | number | undefined): boolean =>
  value === undefined || String(value).trim() === '';

const TRAUMA_ROOTS = ['99284', '99285', '99291'];

const getFieldValue = (row: ExcelRow, field: string | null): string =>
  field ? String(row[field] ?? '').trim().toUpperCase() : '';

const getLegacyRawHcpcs = (
  row: ExcelRow,
  hcpcsCol: string,
  modifierCol: string | null
): string => {
  const hcpcs = getFieldValue(row, hcpcsCol);
  const modifier = getFieldValue(row, modifierCol);

  if (!hcpcs) {
    return '';
  }

  if (!modifier) {
    return hcpcs;
  }

  if (hcpcs.includes('-')) {
    return hcpcs;
  }

  const multiplierMatch = hcpcs.match(/^(.+)(X\d+)$/i);
  if (multiplierMatch) {
    return `${multiplierMatch[1]}-${modifier}${multiplierMatch[2].toUpperCase()}`;
  }

  return `${hcpcs}-${modifier}`;
};

const parseLegacyCode = (code: string) => {
  const cleanCode = String(code || '').trim().toUpperCase();
  const rootCode = cleanCode.slice(0, 5);
  const hasModifier =
    cleanCode.length === 11 || (cleanCode.length !== 5 && cleanCode.charAt(5) === '-');
  const hasMultiplier =
    cleanCode.length === 11 || (cleanCode.length !== 5 && cleanCode.charAt(5) === 'X');
  const modifier = hasModifier ? cleanCode.substring(6, 8) : '';

  return {
    cleanCode,
    rootCode,
    modifier,
    hasModifier,
    hasMultiplier
  };
};

const isLegacyTraumaCode = (code: string): boolean =>
  TRAUMA_ROOTS.some(traumaRoot => String(code || '').toUpperCase().includes(traumaRoot));

const getLegacyModifierCategory = (rawCode: string): string | null => {
  const parsedCode = parseLegacyCode(rawCode);

  if (!parsedCode.hasModifier) {
    return null;
  }

  return parsedCode.hasMultiplier ? `-${parsedCode.modifier}X` : `-${parsedCode.modifier}`;
};

const canUpdateBasedOnModifierConfigOptions = (
  masterRawCode: string,
  modifierCriteria: ModifierCriteria
): boolean => {
  switch (getLegacyModifierCategory(masterRawCode)) {
    case '-00':
    case '-00X':
      return modifierCriteria.root00;
    case '-25':
    case '-25X':
      return modifierCriteria.root25;
    case '-50':
    case '-50X':
      return modifierCriteria.root50;
    case '-59':
    case '-59X':
      return modifierCriteria.root59;
    case '-XU':
    case '-XUX':
      return modifierCriteria.rootXU;
    case '-76':
    case '-76X':
      return modifierCriteria.root76;
    default:
      return true;
  }
};

const hasSpecialModifierMultiplierException = (
  masterRawCode: string,
  clientRawCode: string
): boolean => {
  const parsedMasterCode = parseLegacyCode(masterRawCode);
  const rootAndModifier = `${parsedMasterCode.rootCode}-${parsedMasterCode.modifier}`;

  return (
    parsedMasterCode.hasModifier &&
    parsedMasterCode.hasMultiplier &&
    (parsedMasterCode.modifier === '59' || parsedMasterCode.modifier === 'XU') &&
    clientRawCode === rootAndModifier
  );
};

const canLegacyUpdate = (
  masterRawCode: string,
  clientRawCode: string,
  modifierCriteria: ModifierCriteria
): boolean => {
  if (hasSpecialModifierMultiplierException(masterRawCode, clientRawCode)) {
    return true;
  }

  const masterIsTrauma = isLegacyTraumaCode(masterRawCode);
  const clientIsTrauma = isLegacyTraumaCode(clientRawCode);

  if (masterIsTrauma && clientIsTrauma) {
    if (clientRawCode === masterRawCode) {
      if (clientRawCode.includes('-') && masterRawCode.includes('-')) {
        return true;
      }

      return !modifierCriteria.ignoreTrauma;
    }

    if (!clientRawCode.includes('-') && masterRawCode.includes('-')) {
      return canUpdateBasedOnModifierConfigOptions(masterRawCode, modifierCriteria);
    }

    return !modifierCriteria.ignoreTrauma;
  }

  if (clientRawCode === masterRawCode) {
    return true;
  }

  return canUpdateBasedOnModifierConfigOptions(masterRawCode, modifierCriteria);
};

const hasWritableCodeData = (row: ExcelRow, fields: string[]): boolean =>
  fields.some(field => !isBlankValue(row[field]));

const buildIndexedRows = (rows: ExcelRow[], getKey: (row: ExcelRow) => string): Map<string, ExcelRow[]> => {
  const indexedRows = new Map<string, ExcelRow[]>();

  rows.forEach(row => {
    const key = getKey(row);
    if (!key) {
      return;
    }

    const existing = indexedRows.get(key) ?? [];
    existing.push(row);
    indexedRows.set(key, existing);
  });

  return indexedRows;
};

const getLegacyRootHcpcs = (
  rawCode: string,
  populatedClientRawCodes: Set<string>
): string => {
  const parsedCode = parseLegacyCode(rawCode);

  if (!(parsedCode.hasModifier && parsedCode.hasMultiplier)) {
    return parsedCode.rootCode;
  }

  const codeAndModifier = `${parsedCode.rootCode}-${parsedCode.modifier}`;
  return populatedClientRawCodes.has(codeAndModifier) ? codeAndModifier : parsedCode.rootCode;
};

const getLegacyDuplicateRows = (
  rowsMaster: ExcelRow[],
  masterHcpcsCol: string,
  masterModifierCol: string | null,
  rowsClient: ExcelRow[],
  clientHcpcsCol: string,
  clientModifierCol: string | null,
  clientCodeFields: string[]
): ExcelRow[] => {
  const clientRowsByRawCode = buildIndexedRows(
    rowsClient,
    row => getLegacyRawHcpcs(row, clientHcpcsCol, clientModifierCol)
  );
  const masterRawCodes = rowsMaster
    .map(row => getLegacyRawHcpcs(row, masterHcpcsCol, masterModifierCol))
    .filter(Boolean);

  const duplicateRows = new Set<ExcelRow>();

  clientRowsByRawCode.forEach((groupedRows, rawCode) => {
    if (!rawCode || groupedRows.length <= 1) {
      return;
    }

    const hasMasterLikeMatch = masterRawCodes.some(masterCode => masterCode.includes(rawCode));
    if (!hasMasterLikeMatch) {
      return;
    }

    groupedRows.forEach(row => {
      if (hasWritableCodeData(row, clientCodeFields)) {
        duplicateRows.add(row);
      }
    });
  });

  return rowsClient.filter(row => duplicateRows.has(row));
};

export const createMergedGridColumns = (masterColumns: GridColDef[]): GridColDef[] => {
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

export const compareDatasets = (
  rowsMaster: ExcelRow[],
  columnsMaster: GridColDef[],
  rowsClient: ExcelRow[],
  columnsClient: GridColDef[],
  modifierCriteria: ModifierCriteria
): ComparisonComputation => {
  const startTime = Date.now();
  console.log('[COMPARISON] Starting comparison with criteria:', modifierCriteria);

  // Find HCPCS and modifier columns
  const masterHcpcsCol = getHCPCSColumn(columnsMaster);
  const masterModifierCol = getModifierColumn(columnsMaster);
  const clientHcpcsCol = getHCPCSColumn(columnsClient);
  const clientModifierCol = getModifierColumn(columnsClient);

  if (!masterHcpcsCol || !clientHcpcsCol) {
    throw new Error('Could not find HCPCS columns in the data. Please ensure your files contain HCPCS code columns.');
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

  const clientCodeFields = columnsClient
    .map(col => col.field)
    .filter(field => isCdmField(field) || isPhysicianCdmField(field));
  const populatedClientRawCodes = new Set(
    rowsClient
      .filter(row => hasWritableCodeData(row, clientCodeFields))
      .map(row => getLegacyRawHcpcs(row, clientHcpcsCol, clientModifierCol))
      .filter(Boolean)
  );
  const duplicateRows = getLegacyDuplicateRows(
    rowsMaster,
    masterHcpcsCol,
    masterModifierCol,
    rowsClient,
    clientHcpcsCol,
    clientModifierCol,
    clientCodeFields
  );
  const duplicateRowIds = new Set(duplicateRows.map(row => row.id));
  const duplicateRawCodes = new Set(
    duplicateRows
      .map(row => getLegacyRawHcpcs(row, clientHcpcsCol, clientModifierCol))
      .filter(Boolean)
  );
  const clientRowsByCompareKey = buildIndexedRows(
    rowsClient,
    row => getCompareKey(row, clientHcpcsCol, clientModifierCol, modifierCriteria)
  );
  const clientRowsByRawCode = buildIndexedRows(
    rowsClient,
    row => getLegacyRawHcpcs(row, clientHcpcsCol, clientModifierCol)
  );
  const clientRowsByRootCode = buildIndexedRows(
    rowsClient,
    row => parseLegacyCode(getLegacyRawHcpcs(row, clientHcpcsCol, clientModifierCol)).rootCode
  );

  console.log('[COMPARISON] Client lookup created with', clientRowsByCompareKey.size, 'entries');

  // Process master data (master-driven approach)
  const matched: ExcelRow[] = [];
  const unmatched: ExcelRow[] = [];
  const matchedClientIds = new Set<number>();
  let matchedMasterRows = 0;

  rowsMaster.forEach(masterRow => {
    const masterKey = getCompareKey(masterRow, masterHcpcsCol, masterModifierCol, modifierCriteria);
    const masterRawCode = getLegacyRawHcpcs(masterRow, masterHcpcsCol, masterModifierCol);
    const masterRootCode = getLegacyRootHcpcs(masterRawCode, populatedClientRawCodes);
    const exactRawMatches = masterRawCode ? (clientRowsByRawCode.get(masterRawCode) ?? []) : [];

    let clientRow: ExcelRow | undefined;
    let consumedCandidate: ExcelRow | undefined;

    if (exactRawMatches.length === 1 && !duplicateRawCodes.has(masterRootCode)) {
      const exactMatch = exactRawMatches[0];
      const exactClientRawCode = getLegacyRawHcpcs(exactMatch, clientHcpcsCol, clientModifierCol);
      consumedCandidate = exactMatch;

      if (canLegacyUpdate(masterRawCode, exactClientRawCode, modifierCriteria)) {
        clientRow = exactMatch;
      }
    } else {
      const compareKeyMatches = masterKey ? (clientRowsByCompareKey.get(masterKey) ?? []) : [];
      const isSuppressedByDuplicates =
        duplicateRawCodes.has(masterRawCode) || duplicateRawCodes.has(masterRootCode);

      if (compareKeyMatches.length === 1 && !isSuppressedByDuplicates) {
        const compareKeyMatch = compareKeyMatches[0];
        const compareClientRawCode = getLegacyRawHcpcs(compareKeyMatch, clientHcpcsCol, clientModifierCol);
        consumedCandidate = compareKeyMatch;

        if (canLegacyUpdate(masterRawCode, compareClientRawCode, modifierCriteria)) {
          clientRow = compareKeyMatch;
        }
      }

      // Root-fallback: mirrors WinForms LIKE '%root%' behavior.
      // When master has a modifier the client doesn't have, try matching
      // by the 5-char root code. The canLegacyUpdate default case returns
      // true for non-configured modifiers (LT, RT, FA, F1-F9, TA, T1-T9, etc.)
      if (!clientRow && !consumedCandidate && !isSuppressedByDuplicates) {
        const parsedMaster = parseLegacyCode(masterRawCode);
        if (parsedMaster.hasModifier) {
          const rootMatches = clientRowsByRootCode.get(parsedMaster.rootCode) ?? [];
          const plainRootMatches = rootMatches.filter(row => {
            const clientRaw = getLegacyRawHcpcs(row, clientHcpcsCol, clientModifierCol);
            return parseLegacyCode(clientRaw).rootCode === parsedMaster.rootCode
              && !parseLegacyCode(clientRaw).hasModifier
              && !duplicateRowIds.has(row.id);
          });

          if (plainRootMatches.length === 1) {
            const rootMatch = plainRootMatches[0];
            const rootClientRawCode = getLegacyRawHcpcs(rootMatch, clientHcpcsCol, clientModifierCol);
            consumedCandidate = rootMatch;

            if (canLegacyUpdate(masterRawCode, rootClientRawCode, modifierCriteria)) {
              clientRow = rootMatch;
            }
          }
        }
      }
    }

    // Track consumed client rows: a row is consumed if it was found by any
    // matching tier, even if canLegacyUpdate blocked the actual field update.
    // This mirrors WinForms where the row is "processed" regardless.
    if (consumedCandidate) {
      matchedClientIds.add(consumedCandidate.id);
    }

    // Start from the master row and selectively fill legacy writable fields.
    const mergedRow: ExcelRow = { id: masterRow.id };

    columnsMaster.forEach(col => {
      mergedRow[col.field] = masterRow[col.field];
    });

    if (clientRow) {
      matchedMasterRows++;

      Object.entries(columnMapping).forEach(([masterField, clientField]) => {
        const clientValue = clientRow[clientField];
        const isQuantityField = masterQtyCol !== null && masterField === masterQtyCol;
        const isWritableCodeField = isCdmField(masterField) || isPhysicianCdmField(masterField);

        if (!isQuantityField && !isWritableCodeField) {
          return;
        }

        if (isQuantityField && masterQtyCol && clientQtyCol) {
          const masterHcpcs = String(masterRow[masterHcpcsCol] || '');
          const { hasMultiplier, multiplier } = parseMultiplierCode(masterHcpcs);

          if (clientValue === undefined && !hasMultiplier) {
            return;
          }

          if (hasMultiplier && multiplier !== null) {
            mergedRow[masterField] = applyMultiplierQuantityLogic(masterHcpcs, clientValue, multiplier);
          } else if (clientValue !== '') {
            mergedRow[masterField] = clientValue;
          }
          return;
        }

        if (clientValue === undefined || clientValue === '') {
          return;
        }

        if (isWritableCodeField && isBlankValue(mergedRow[masterField])) {
          mergedRow[masterField] = clientValue;
        }
      });
    }

    matched.push(mergedRow);
  });

  rowsClient.forEach(clientRow => {
    if (duplicateRowIds.has(clientRow.id)) {
      return;
    }

    if (matchedClientIds.has(clientRow.id)) {
      return;
    }

    unmatched.push(clientRow);
  });

  const processingTime = Date.now() - startTime;
  const matchRate = rowsClient.length > 0 ? Math.round((matchedMasterRows / rowsClient.length) * 100) : 0;

  const stats: ComparisonStats = {
    totalMasterRecords: rowsMaster.length,
    totalClientRecords: rowsClient.length,
    matchedRecords: matchedMasterRows,
    unmatchedRecords: unmatched.length,
    duplicateRecords: duplicateRows.length,
    matchRate,
    processingTime,
    columnsMatched: Object.keys(columnMapping).length,
    totalMasterColumns: columnsMaster.length,
    totalClientColumns: columnsClient.length
  };

  console.log('[COMPARISON] Comparison complete:', stats);

  return {
    mergedRows: matched,
    mergedColumns: createMergedGridColumns(columnsMaster),
    unmatchedClient: unmatched,
    dupsClient: duplicateRows,
    comparisonStats: stats
  };
};

export const useComparison = () => {
  const [mergedRows, setMergedRows] = useState<ExcelRow[]>([]);
  const [mergedColumns, setMergedColumns] = useState<GridColDef[]>([]);
  const [unmatchedClient, setUnmatchedClient] = useState<ExcelRow[]>([]);
  const [dupsClient, setDupsClient] = useState<ExcelRow[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(null);

  const performComparison = useCallback((
    rowsMaster: ExcelRow[],
    columnsMaster: GridColDef[],
    rowsClient: ExcelRow[],
    columnsClient: GridColDef[],
    modifierCriteria: ModifierCriteria
  ) => {
    try {
      const result = compareDatasets(
        rowsMaster,
        columnsMaster,
        rowsClient,
        columnsClient,
        modifierCriteria
      );

      setMergedRows(result.mergedRows);
      setMergedColumns(result.mergedColumns);
      setUnmatchedClient(result.unmatchedClient);
      setDupsClient(result.dupsClient);
      setComparisonStats(result.comparisonStats);
      setShowCompare(true);
    } catch (error) {
      console.error('[COMPARISON] Comparison failed:', error);
      alert(error instanceof Error ? error.message : 'Comparison failed.');
    }
  }, []);

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
