import * as XLSX from "xlsx";
import { GridColDef } from "@mui/x-data-grid";

export interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
}

export interface FileMetadata {
  name: string;
  size: number;
  uploadTime: Date;
  sheetCount: number;
  recordCount: number;
  columnCount: number;
}

export interface ComparisonStats {
  totalMasterRecords: number;
  totalClientRecords: number;
  matchedRecords: number;
  unmatchedRecords: number;
  duplicateRecords: number;
  matchRate: number;
  processingTime: number;
  columnsMatched: number;
  totalMasterColumns: number;
  totalClientColumns: number;
}

export interface ModifierCriteria {
  root00: boolean;
  root25: boolean;
  ignoreTrauma: boolean;
  root50: boolean;
  root59: boolean;
  rootXU: boolean;
  root76: boolean;
}

export function parseHCPCS(row: ExcelRow, hcpcsCol: string, modifierCol: string | null): { root: string, modifier: string } {
  let hcpcs = String(row[hcpcsCol] || "").toUpperCase().trim();
  let modifier = "";
  if (modifierCol && row[modifierCol]) {
    modifier = String(row[modifierCol]).toUpperCase().trim();
  } else if (hcpcs.length === 8 && hcpcs[5] === '-') {
    // Format: XXXXX-YY
    modifier = hcpcs.substring(6, 8);
    hcpcs = hcpcs.substring(0, 5);
  } else if (hcpcs.length === 7) {
    // Format: XXXXXYY (no dash)
    modifier = hcpcs.substring(5, 7);
    hcpcs = hcpcs.substring(0, 5);
  } else if (hcpcs.length > 5) {
    // Fallback: try to extract modifier
    modifier = hcpcs.substring(5);
    hcpcs = hcpcs.substring(0, 5);
  }
  return { root: hcpcs, modifier };
}

export function findMatchingColumn(masterField: string, clientColumns: GridColDef[]): string | null {
  const clientFields = clientColumns.map(col => col.field);
  
  // Strategy 1: Exact match
  if (clientFields.includes(masterField)) {
    console.log(`[COLUMN MATCH] Exact match: ${masterField}`);
    return masterField;
  }
  
  // Strategy 2: Case-insensitive match
  const caseInsensitiveMatch = clientFields.find(field => 
    field.toLowerCase() === masterField.toLowerCase()
  );
  if (caseInsensitiveMatch) {
    console.log(`[COLUMN MATCH] Case-insensitive match: ${masterField} -> ${caseInsensitiveMatch}`);
    return caseInsensitiveMatch;
  }
  
  // Strategy 3: Normalized match (remove spaces, underscores, special chars)
  const normalizeField = (field: string) => field.toLowerCase().replace(/[\s_-]+/g, '');
  const normalizedMaster = normalizeField(masterField);
  const normalizedMatch = clientFields.find(field => 
    normalizeField(field) === normalizedMaster
  );
  if (normalizedMatch) {
    console.log(`[COLUMN MATCH] Normalized match: ${masterField} -> ${normalizedMatch}`);
    return normalizedMatch;
  }
  
  // Strategy 4: Partial match (master field contains client field or vice versa)
  const partialMatch = clientFields.find(field => {
    const masterLower = masterField.toLowerCase();
    const fieldLower = field.toLowerCase();
    return masterLower.includes(fieldLower) || fieldLower.includes(masterLower);
  });
  if (partialMatch) {
    console.log(`[COLUMN MATCH] Partial match: ${masterField} -> ${partialMatch}`);
    return partialMatch;
  }
  
  // Strategy 5: Fuzzy match for common variations
  const fuzzyMatches: {[key: string]: string[]} = {
    'hcpcs': ['hcpc', 'code', 'procedure_code', 'proc_code', 'cpt'],
    'modifier': ['mod', 'modif', 'modifier_code'],
    'description': ['desc', 'procedure_desc', 'proc_desc', 'name', 'procedure_name'],
    'quantity': ['qty', 'units', 'unit', 'count'],
    'price': ['amount', 'cost', 'charge', 'rate', 'fee'],
    'date': ['service_date', 'dos', 'date_of_service']
  };
  
  const masterLower = masterField.toLowerCase();
  for (const [standard, variations] of Object.entries(fuzzyMatches)) {
    if (masterLower.includes(standard) || variations.some(v => masterLower.includes(v))) {
      const fuzzyMatch = clientFields.find(field => {
        const fieldLower = field.toLowerCase();
        return fieldLower.includes(standard) || variations.some(v => fieldLower.includes(v));
      });
      if (fuzzyMatch) {
        console.log(`[COLUMN MATCH] Fuzzy match: ${masterField} -> ${fuzzyMatch} (via ${standard})`);
        return fuzzyMatch;
      }
    }
  }
  
  console.log(`[COLUMN MATCH] No match found for: ${masterField}`);
  return null;
}

export function createColumnMapping(masterColumns: GridColDef[], clientColumns: GridColDef[]): {[masterField: string]: string} {
  const mapping: {[masterField: string]: string} = {};
  
  masterColumns.forEach(masterCol => {
    const matchedField = findMatchingColumn(masterCol.field, clientColumns);
    if (matchedField) {
      mapping[masterCol.field] = matchedField;
    }
  });
  
  console.log('[COLUMN MAPPING] Created mapping:', mapping);
  return mapping;
}

export function getCompareKey(row: ExcelRow, hcpcsCol: string, modifierCol: string | null, criteria: ModifierCriteria): string {
  const { root, modifier } = parseHCPCS(row, hcpcsCol, modifierCol);
  
  // Apply modifier criteria
  let effectiveModifier = modifier;
  if (criteria.root00 && (modifier === "" || modifier === "00")) {
    effectiveModifier = "";
  }
  if (criteria.root25 && modifier === "25") {
    effectiveModifier = "";
  }
  if (criteria.root50 && modifier === "50") {
    effectiveModifier = "";
  }
  if (criteria.root59 && modifier === "59") {
    effectiveModifier = "";
  }
  if (criteria.rootXU && modifier === "XU") {
    effectiveModifier = "";
  }
  if (criteria.root76 && modifier === "76") {
    effectiveModifier = "";
  }
  
  return effectiveModifier ? `${root}-${effectiveModifier}` : root;
}

export function filterTrauma(row: ExcelRow, descriptionCol: string | null): boolean {
  if (!descriptionCol || !row[descriptionCol]) return false;
  
  const description = String(row[descriptionCol]).toLowerCase();
  const traumaKeywords = ['trauma', 'emergency', 'fracture', 'injury', 'accident', 'wound'];
  
  return traumaKeywords.some(keyword => description.includes(keyword));
}

export function getHCPCSColumn(columns: GridColDef[]): string | null {
  const hcpcsKeywords = ['hcpcs', 'hcpc', 'code', 'procedure_code', 'proc_code', 'cpt'];
  
  for (const col of columns) {
    const fieldLower = col.field.toLowerCase();
    if (hcpcsKeywords.some(keyword => fieldLower.includes(keyword))) {
      return col.field;
    }
  }
  
  return null;
}

export function getModifierColumn(columns: GridColDef[]): string | null {
  const modifierKeywords = ['modifier', 'mod', 'modif', 'modifier_code'];
  
  for (const col of columns) {
    const fieldLower = col.field.toLowerCase();
    if (modifierKeywords.some(keyword => fieldLower.includes(keyword))) {
      return col.field;
    }
  }
  
  return null;
}

export function getDescriptionColumn(columns: GridColDef[]): string | null {
  const descKeywords = ['description', 'desc', 'procedure_desc', 'proc_desc', 'name', 'procedure_name'];
  
  for (const col of columns) {
    const fieldLower = col.field.toLowerCase();
    if (descKeywords.some(keyword => fieldLower.includes(keyword))) {
      return col.field;
    }
  }
  
  return null;
}

export function validateForDuplicates(data: ExcelRow[], hcpcsCol: string, modifierCol: string | null): ExcelRow[] {
  // Use raw key logic like the original implementation (not parsed comparison key)
  const getRawKey = (row: ExcelRow): string => {
    const hcpcs = String(row[hcpcsCol] || "").toUpperCase().trim();
    const modifier = modifierCol ? String(row[modifierCol] || "").toUpperCase().trim() : "";
    // If there's a modifier column, use both; otherwise, use the full HCPCS field as-is
    return modifierCol ? `${hcpcs}-${modifier}` : hcpcs;
  };

  // Count occurrences of each key (like original implementation)
  const rawKeyCount: Record<string, number> = {};
  data.forEach(row => {
    const key = getRawKey(row);
    if (key) {
      rawKeyCount[key] = (rawKeyCount[key] || 0) + 1;
    }
  });

  // Find duplicate keys (keys that appear more than once)
  const duplicateKeys = Object.keys(rawKeyCount).filter(key => rawKeyCount[key] > 1);

  // Return ALL rows that have duplicate keys (not just subsequent occurrences)
  const duplicates = data.filter(row => duplicateKeys.includes(getRawKey(row)));

  return duplicates;
}

// Hyphen formatting functions (mirrors old ChargeMasterMerge behavior)
export function formatHCPCSWithHyphens(data: ExcelRow[], columns: GridColDef[], useNewAlgorithm: boolean = false): ExcelRow[] {
  // Find HCPCS/CPT columns
  const hcpcsColumns = columns.filter(col => 
    col.field.toLowerCase().includes('hcpcs') || 
    col.field.toLowerCase().includes('cpt')
  ).map(col => col.field);

  if (hcpcsColumns.length === 0) {
    console.log('[HYPHEN FORMAT] No HCPCS/CPT columns found, returning data unchanged');
    return data;
  }

  console.log('[HYPHEN FORMAT] Applying hyphen formatting to columns:', hcpcsColumns);
  console.log('[HYPHEN FORMAT] Using algorithm:', useNewAlgorithm ? 'NEW (pattern validation)' : 'OLD (length only)');

  // Apply formatting to each row
  return data.map((row, index) => {
    const formattedRow = { ...row };
    
    hcpcsColumns.forEach(colName => {
      const value = formattedRow[colName];
      const originalValue = value;
      
      if (typeof value === 'string') {
        const trimmedValue = value.trim();
        
        // Log specific value if it contains "1012050"
        if (trimmedValue.includes('1012050')) {
          console.log(`[HYPHEN FORMAT] Found 1012050 in row ${index}, column ${colName}:`);
          console.log(`  - Original value: "${originalValue}"`);
          console.log(`  - Trimmed value: "${trimmedValue}"`);
          console.log(`  - Length: ${trimmedValue.length}`);
          console.log(`  - Type: ${typeof value}`);
        }
        
        if (useNewAlgorithm) {
          // New algorithm: Check for exactly 7 characters matching CPT+modifier pattern
          if (trimmedValue.length === 7 &&
              /^[A-Z0-9]{5}[A-Z0-9]{2}$/i.test(trimmedValue) &&
              !trimmedValue.includes('-')) {
            // Insert hyphen between base code and modifier
            formattedRow[colName] = `${trimmedValue.substring(0, 5)}-${trimmedValue.substring(5)}`;
            if (trimmedValue.includes('1012050')) {
              console.log(`  - NEW ALGORITHM: Formatted to: "${formattedRow[colName]}"`);
            }
          }
        } else {
          // Old algorithm: Simply check length and insert hyphen (matching ChargeMasterMerge behavior)
          if (trimmedValue.length === 7) {
            formattedRow[colName] = `${trimmedValue.substring(0, 5)}-${trimmedValue.substring(5)}`;
            if (trimmedValue.includes('1012050')) {
              console.log(`  - OLD ALGORITHM: Formatted to: "${formattedRow[colName]}"`);
            }
          } else if (trimmedValue.includes('1012050')) {
            console.log(`  - OLD ALGORITHM: NOT formatted (length != 7)`);
          }
        }
      }
    });
    
    return formattedRow;
  });
}



export function exportToExcel(data: ExcelRow[], filename: string): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filename);
}

export function generateExportFilename(type: 'merged' | 'unmatched' | 'duplicates'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${type}_data_${timestamp}.xlsx`;
}

export function createFileMetadata(file: File, workbook: XLSX.WorkBook): FileMetadata {
  const sheets = workbook.SheetNames;
  let totalRecords = 0;
  let totalColumns = 0;
  
  sheets.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (json.length > 0) {
      totalRecords += Math.max(0, json.length - 1);
      totalColumns = Math.max(totalColumns, (json[0] as string[]).length);
    }
  });
  
  return {
    name: file.name,
    size: file.size,
    uploadTime: new Date(),
    sheetCount: sheets.length,
    recordCount: totalRecords,
    columnCount: totalColumns
  };
}

export function duplicateRecord(row: ExcelRow): ExcelRow {
  const newRow = { ...row };
  newRow.id = Date.now(); // Generate new ID
  return newRow;
}

export function deleteRecords(data: ExcelRow[], idsToDelete: number[]): ExcelRow[] {
  return data.filter(row => !idsToDelete.includes(row.id));
}

export function applyFilters(data: ExcelRow[], filters: {[field: string]: string}): ExcelRow[] {
  return data.filter(row => {
    return Object.entries(filters).every(([field, value]) => {
      if (!value) return true;
      const rowValue = String(row[field] || '').toLowerCase();
      return rowValue.includes(value.toLowerCase());
    });
  });
}

export function searchRows(data: ExcelRow[], searchTerm: string): ExcelRow[] {
  if (!searchTerm) return data;
  
  const term = searchTerm.toLowerCase();
  return data.filter(row => {
    // Search through all fields except 'id' which is not user-relevant
    return Object.entries(row).some(([key, value]) => {
      if (key === 'id') return false; // Skip ID field from search
      return String(value || '').toLowerCase().includes(term);
    });
  });
}

export function filterAndSearchRows(data: ExcelRow[], filters: {[field: string]: string}, searchTerm: string): ExcelRow[] {
  let result = applyFilters(data, filters);
  result = searchRows(result, searchTerm);
  return result;
}