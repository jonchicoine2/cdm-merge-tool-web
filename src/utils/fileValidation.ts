import * as XLSX from 'xlsx';

// File validation types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo?: {
    size: number;
    type: string;
    sheets: string[];
    totalRows: number;
    totalColumns: number;
  };
}

export interface FileValidationOptions {
  maxFileSize?: number; // in bytes, default 50MB
  allowedExtensions?: string[];
  minRows?: number;
  maxRows?: number;
  requiredColumns?: string[];
  maxSheets?: number;
}

// Default validation options
const DEFAULT_OPTIONS: Required<FileValidationOptions> = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedExtensions: ['.xlsx', '.xls', '.csv'],
  minRows: 1,
  maxRows: 100000,
  requiredColumns: [],
  maxSheets: 10
};

/**
 * Comprehensive file validation for Excel/CSV uploads
 */
export const validateFile = async (
  file: File, 
  options: FileValidationOptions = {}
): Promise<ValidationResult> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Basic file validation
    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors, warnings };
    }

    // File size validation
    if (file.size > opts.maxFileSize) {
      errors.push(`File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(opts.maxFileSize)})`);
    }

    if (file.size === 0) {
      errors.push('File is empty');
      return { isValid: false, errors, warnings };
    }

    // File extension validation
    const fileExtension = getFileExtension(file.name);
    if (!opts.allowedExtensions.includes(fileExtension)) {
      errors.push(`File type "${fileExtension}" is not supported. Allowed types: ${opts.allowedExtensions.join(', ')}`);
    }

    // If basic validation fails, return early
    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    // Content validation - read and analyze the file
    const workbook = await readFileAsWorkbook(file);
    const sheetNames = workbook.SheetNames;

    // Sheet count validation
    if (sheetNames.length === 0) {
      errors.push('File contains no worksheets');
      return { isValid: false, errors, warnings };
    }

    if (sheetNames.length > opts.maxSheets) {
      warnings.push(`File contains ${sheetNames.length} sheets. Only the first ${opts.maxSheets} will be processed.`);
    }

    // Analyze first sheet for detailed validation
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const sheetData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
    
    let totalRows = 0;
    let totalColumns = 0;
    let hasData = false;

    // Count all sheets' data
    for (const sheetName of sheetNames.slice(0, opts.maxSheets)) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      if (data.length > 0) {
        hasData = true;
        totalRows += data.length;
        totalColumns = Math.max(totalColumns, Math.max(...data.map(row => row.length)));
      }
    }

    // Row count validation
    if (totalRows < opts.minRows) {
      errors.push(`File contains ${totalRows} rows, but minimum required is ${opts.minRows}`);
    }

    if (totalRows > opts.maxRows) {
      errors.push(`File contains ${totalRows} rows, which exceeds maximum allowed (${opts.maxRows})`);
    }

    // Data presence validation
    if (!hasData) {
      errors.push('File contains no data rows');
    }

    // Column validation (check first sheet)
    if (sheetData.length > 0 && opts.requiredColumns.length > 0) {
      const headerRow = sheetData[0] || [];
      const headers = headerRow.map(h => String(h || '').trim().toLowerCase());
      
      for (const requiredCol of opts.requiredColumns) {
        const normalizedRequired = requiredCol.toLowerCase();
        if (!headers.some(h => h.includes(normalizedRequired) || normalizedRequired.includes(h))) {
          errors.push(`Required column "${requiredCol}" not found in file`);
        }
      }
    }

    // Performance warnings
    if (totalRows > 10000) {
      warnings.push(`Large file detected (${totalRows.toLocaleString()} rows). Processing may take longer.`);
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      warnings.push(`Large file size (${formatFileSize(file.size)}). Upload may take longer.`);
    }

    // Empty columns warning
    if (sheetData.length > 1) {
      const dataRows = sheetData.slice(1);
      const emptyColumns = findEmptyColumns(dataRows);
      if (emptyColumns.length > 0) {
        warnings.push(`Found ${emptyColumns.length} empty columns that will be ignored.`);
      }
    }

    const fileInfo = {
      size: file.size,
      type: file.type || 'unknown',
      sheets: sheetNames,
      totalRows,
      totalColumns
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fileInfo
    };

  } catch (error) {
    console.error('[FILE VALIDATION] Error validating file:', error);
    errors.push(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { isValid: false, errors, warnings };
  }
};

/**
 * Validate file specifically for CDM merge operations
 */
export const validateCDMFile = async (file: File, fileType: 'master' | 'client'): Promise<ValidationResult> => {
  const baseOptions: FileValidationOptions = {
    maxFileSize: 100 * 1024 * 1024, // 100MB for CDM files
    minRows: 2, // At least header + 1 data row
    maxRows: 50000, // Reasonable limit for CDM files
  };

  // Different requirements for master vs client files
  if (fileType === 'master') {
    baseOptions.requiredColumns = ['hcpcs', 'description']; // Core columns for master
  } else {
    baseOptions.requiredColumns = ['hcpcs']; // Minimum for client
  }

  return validateFile(file, baseOptions);
};

// Helper functions
function readFileAsWorkbook(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        resolve(workbook);
      } catch (error) {
        reject(new Error(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsBinaryString(file);
  });
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.substring(lastDot).toLowerCase();
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function findEmptyColumns(dataRows: any[][]): number[] {
  if (dataRows.length === 0) return [];
  
  const maxColumns = Math.max(...dataRows.map(row => row.length));
  const emptyColumns: number[] = [];
  
  for (let col = 0; col < maxColumns; col++) {
    const hasData = dataRows.some(row => {
      const value = row[col];
      return value !== null && value !== undefined && String(value).trim() !== '';
    });
    
    if (!hasData) {
      emptyColumns.push(col);
    }
  }
  
  return emptyColumns;
}

/**
 * Create user-friendly error messages for common validation failures
 */
export const createValidationErrorMessage = (result: ValidationResult): string => {
  if (result.isValid) return '';
  
  const messages: string[] = [];
  
  // Group similar errors
  const sizeErrors = result.errors.filter(e => e.includes('size'));
  const formatErrors = result.errors.filter(e => e.includes('type') || e.includes('extension'));
  const contentErrors = result.errors.filter(e => !sizeErrors.includes(e) && !formatErrors.includes(e));
  
  if (formatErrors.length > 0) {
    messages.push('📄 File Format Issues:');
    formatErrors.forEach(error => messages.push(`  • ${error}`));
  }
  
  if (sizeErrors.length > 0) {
    messages.push('📏 File Size Issues:');
    sizeErrors.forEach(error => messages.push(`  • ${error}`));
  }
  
  if (contentErrors.length > 0) {
    messages.push('📊 Content Issues:');
    contentErrors.forEach(error => messages.push(`  • ${error}`));
  }
  
  return messages.join('\n');
};
