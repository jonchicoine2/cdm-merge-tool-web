import { GridColDef } from "@mui/x-data-grid";

interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
}

export const findMatchingColumn = (searchTerms: string[], columns: GridColDef[]): string | null => {
  // Helper function to normalize column names for comparison
  const normalizeColumnName = (name: string): string => {
    return name.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  };

  // Create a normalized lookup of column fields to their original field names
  const normalizedColumns = columns.map(col => ({
    originalField: col.field,
    normalizedField: normalizeColumnName(col.field),
    normalizedHeaderName: col.headerName ? normalizeColumnName(col.headerName) : normalizeColumnName(col.field)
  }));

  // Strategy 1: Exact match (case-insensitive)
  for (const term of searchTerms) {
    const normalizedTerm = normalizeColumnName(term);
    for (const col of normalizedColumns) {
      if (col.normalizedField === normalizedTerm || col.normalizedHeaderName === normalizedTerm) {
        console.log(`[COLUMN MATCH] Exact match found: "${term}" -> "${col.originalField}"`);
        return col.originalField;
      }
    }
  }

  // Strategy 2: Contains match - term contains column name
  for (const term of searchTerms) {
    const normalizedTerm = normalizeColumnName(term);
    for (const col of normalizedColumns) {
      if (normalizedTerm.includes(col.normalizedField) || normalizedTerm.includes(col.normalizedHeaderName)) {
        console.log(`[COLUMN MATCH] Contains match found: "${term}" contains "${col.originalField}"`);
        return col.originalField;
      }
    }
  }

  // Strategy 3: Column name contains term
  for (const term of searchTerms) {
    const normalizedTerm = normalizeColumnName(term);
    for (const col of normalizedColumns) {
      if (col.normalizedField.includes(normalizedTerm) || col.normalizedHeaderName.includes(normalizedTerm)) {
        console.log(`[COLUMN MATCH] Column contains term: "${col.originalField}" contains "${term}"`);
        return col.originalField;
      }
    }
  }

  // Strategy 4: Partial word match
  for (const term of searchTerms) {
    const normalizedTerm = normalizeColumnName(term);
    const termWords = normalizedTerm.split(' ').filter(word => word.length > 0);
    
    for (const col of normalizedColumns) {
      const fieldWords = col.normalizedField.split(' ').filter(word => word.length > 0);
      const headerWords = col.normalizedHeaderName.split(' ').filter(word => word.length > 0);
      
      // Check if any term words match any field/header words
      const hasFieldMatch = termWords.some(termWord => 
        fieldWords.some(fieldWord => fieldWord.includes(termWord) || termWord.includes(fieldWord))
      );
      const hasHeaderMatch = termWords.some(termWord => 
        headerWords.some(headerWord => headerWord.includes(termWord) || termWord.includes(headerWord))
      );
      
      if (hasFieldMatch || hasHeaderMatch) {
        console.log(`[COLUMN MATCH] Partial word match: "${term}" ~= "${col.originalField}"`);
        return col.originalField;
      }
    }
  }

  console.log(`[COLUMN MATCH] No match found for terms: [${searchTerms.join(', ')}]`);
  console.log(`[COLUMN MATCH] Available columns: [${columns.map(c => c.field).join(', ')}]`);
  return null;
};

export const parseHCPCS = (row: ExcelRow, hcpcsCol: string, modifierCol: string | null): { root: string, modifier: string } => {
  const hcpcsValue = String(row[hcpcsCol] || "").trim();
  let modifierValue = modifierCol ? String(row[modifierCol] || "").trim() : "";
  
  // If HCPCS contains a hyphen, split it
  if (hcpcsValue.includes('-')) {
    const parts = hcpcsValue.split('-');
    const root = parts[0].trim();
    const hcpcsModifier = parts.slice(1).join('-').trim(); // Join in case there are multiple hyphens
    
    // Use HCPCS modifier if no separate modifier column or if modifier column is empty
    if (!modifierValue) {
      modifierValue = hcpcsModifier;
    }
    
    return { root, modifier: modifierValue };
  }
  
  return { root: hcpcsValue, modifier: modifierValue };
};

export const validateForDuplicates = (
  rows: ExcelRow[],
  gridType: 'master' | 'client' | 'merged',
  parseHCPCSFunction: (row: ExcelRow, hcpcsCol: string, modifierCol: string | null) => { root: string, modifier: string },
  getHCPCSColumn: () => string | null,
  getModifierColumn: () => string | null
): { hasDuplicates: boolean; duplicateRows: ExcelRow[]; duplicateKeys: string[] } => {
  const hcpcsCol = getHCPCSColumn();
  const modifierCol = getModifierColumn();
  
  if (!hcpcsCol) {
    return { hasDuplicates: false, duplicateRows: [], duplicateKeys: [] };
  }
  
  const seen = new Map<string, ExcelRow[]>();
  
  rows.forEach(row => {
    const { root, modifier } = parseHCPCSFunction(row, hcpcsCol, modifierCol);
    const key = modifier ? `${root}-${modifier}` : root;
    
    if (!seen.has(key)) {
      seen.set(key, []);
    }
    seen.get(key)!.push(row);
  });
  
  const duplicateEntries = Array.from(seen.entries()).filter(([, rows]) => rows.length > 1);
  const duplicateKeys = duplicateEntries.map(([key]) => key);
  const duplicateRows = duplicateEntries.flatMap(([, rows]) => rows);
  
  console.log(`[VALIDATION] ${gridType} grid: Found ${duplicateKeys.length} duplicate HCPCS keys:`, duplicateKeys);
  
  return {
    hasDuplicates: duplicateKeys.length > 0,
    duplicateRows,
    duplicateKeys
  };
};

export const applyFilters = (rows: ExcelRow[], filters: Array<{ column: string; condition: string; value: string }>) => {
  return rows.filter(row => {
    return filters.every(filter => {
      const cellValue = String(row[filter.column] || "").toLowerCase();
      const filterValue = filter.value.toLowerCase();
      
      switch (filter.condition) {
        case 'contains':
          return cellValue.includes(filterValue);
        case 'equals':
          return cellValue === filterValue;
        case 'startsWith':
          return cellValue.startsWith(filterValue);
        case 'endsWith':
          return cellValue.endsWith(filterValue);
        case 'notContains':
          return !cellValue.includes(filterValue);
        case 'notEquals':
          return cellValue !== filterValue;
        case 'isEmpty':
          return cellValue === '';
        case 'isNotEmpty':
          return cellValue !== '';
        case 'greaterThan':
          const numValue = parseFloat(cellValue);
          const numFilter = parseFloat(filterValue);
          return !isNaN(numValue) && !isNaN(numFilter) && numValue > numFilter;
        case 'lessThan':
          const numValue2 = parseFloat(cellValue);
          const numFilter2 = parseFloat(filterValue);
          return !isNaN(numValue2) && !isNaN(numFilter2) && numValue2 < numFilter2;
        default:
          return true;
      }
    });
  });
};