import { ExcelRow, ModifierCriteria } from './excelOperations';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationRules {
  required?: string[];
  minLength?: {[field: string]: number};
  maxLength?: {[field: string]: number};
  pattern?: {[field: string]: RegExp};
  custom?: {[field: string]: (value: unknown) => boolean};
}

export function validateRow(row: ExcelRow, rules: ValidationRules): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required field validation
  if (rules.required) {
    rules.required.forEach(field => {
      if (!row[field] || String(row[field]).trim() === '') {
        errors.push(`${field} is required`);
      }
    });
  }

  // Min length validation
  if (rules.minLength) {
    Object.entries(rules.minLength).forEach(([field, minLen]) => {
      const value = String(row[field] || '');
      if (value.length < minLen) {
        errors.push(`${field} must be at least ${minLen} characters`);
      }
    });
  }

  // Max length validation
  if (rules.maxLength) {
    Object.entries(rules.maxLength).forEach(([field, maxLen]) => {
      const value = String(row[field] || '');
      if (value.length > maxLen) {
        errors.push(`${field} must be no more than ${maxLen} characters`);
      }
    });
  }

  // Pattern validation
  if (rules.pattern) {
    Object.entries(rules.pattern).forEach(([field, pattern]) => {
      const value = String(row[field] || '');
      if (value && !pattern.test(value)) {
        errors.push(`${field} format is invalid`);
      }
    });
  }

  // Custom validation
  if (rules.custom) {
    Object.entries(rules.custom).forEach(([field, validator]) => {
      const value = row[field];
      if (value && !validator(value)) {
        errors.push(`${field} validation failed`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateDataSet(data: ExcelRow[], rules: ValidationRules): ValidationResult[] {
  return data.map(row => validateRow(row, rules));
}

export function validateHCPCS(hcpcs: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!hcpcs || hcpcs.trim() === '') {
    errors.push('HCPCS code is required');
  } else {
    const cleaned = hcpcs.trim().toUpperCase();
    
    // Basic HCPCS format validation
    if (cleaned.length < 5) {
      errors.push('HCPCS code must be at least 5 characters');
    } else if (cleaned.length > 8) {
      errors.push('HCPCS code must be no more than 8 characters');
    }
    
    // Check for valid HCPCS pattern
    const hcpcsPattern = /^[A-Z0-9]{5}(-[A-Z0-9]{1,2})?$/;
    if (!hcpcsPattern.test(cleaned)) {
      warnings.push('HCPCS code format may be invalid');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateModifier(modifier: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (modifier && modifier.trim() !== '') {
    const cleaned = modifier.trim().toUpperCase();
    
    // Modifier should be 1-2 characters
    if (cleaned.length > 2) {
      errors.push('Modifier must be 1-2 characters');
    }
    
    // Check for valid modifier characters
    const modifierPattern = /^[A-Z0-9]{1,2}$/;
    if (!modifierPattern.test(cleaned)) {
      warnings.push('Modifier format may be invalid');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateFileUpload(file: File): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // File size validation (50MB limit)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    errors.push('File size must be less than 50MB');
  }

  // File type validation
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv' // .csv
  ];
  
  if (!allowedTypes.includes(file.type)) {
    // Also check file extension as fallback
    const fileName = file.name.toLowerCase();
    const hasValidExtension = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv');
    
    if (!hasValidExtension) {
      errors.push('File must be an Excel file (.xlsx, .xls) or CSV file');
    } else {
      warnings.push('File type detection may be unreliable, but extension looks valid');
    }
  }

  // File name validation
  if (file.name.length > 255) {
    errors.push('File name must be less than 255 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateModifierCriteria(criteria: ModifierCriteria): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // At least one modifier criteria should be selected
  const hasSelection = Object.values(criteria).some(value => value === true);
  if (!hasSelection) {
    warnings.push('No modifier criteria selected - all modifiers will be preserved');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateDataIntegrity(data: ExcelRow[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || data.length === 0) {
    errors.push('No data to validate');
    return { isValid: false, errors, warnings };
  }

  // Check for duplicate IDs
  const ids = data.map(row => row.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    errors.push('Duplicate row IDs found');
  }

  // Check for completely empty rows
  const emptyRows = data.filter(row => {
    const values = Object.values(row).filter(val => val !== undefined && val !== null && val !== '');
    return values.length <= 1; // Only ID field
  });
  
  if (emptyRows.length > 0) {
    warnings.push(`${emptyRows.length} empty rows found`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateColumnMapping(mapping: {[key: string]: string}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!mapping || Object.keys(mapping).length === 0) {
    warnings.push('No column mapping provided');
    return { isValid: true, errors, warnings };
  }

  // Check for duplicate target columns
  const targetColumns = Object.values(mapping);
  const uniqueTargets = new Set(targetColumns);
  if (targetColumns.length !== uniqueTargets.size) {
    errors.push('Duplicate target columns in mapping');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateMergeCompatibility(
  masterData: ExcelRow[],
  clientData: ExcelRow[],
  masterColumns: string[],
  clientColumns: string[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if both datasets have data
  if (!masterData || masterData.length === 0) {
    errors.push('Master data is empty');
  }
  if (!clientData || clientData.length === 0) {
    errors.push('Client data is empty');
  }

  // Check if both datasets have columns
  if (!masterColumns || masterColumns.length === 0) {
    errors.push('Master data has no columns');
  }
  if (!clientColumns || clientColumns.length === 0) {
    errors.push('Client data has no columns');
  }

  // Check for HCPCS columns in both datasets
  const hcpcsKeywords = ['hcpcs', 'hcpc', 'code', 'procedure_code', 'proc_code', 'cpt'];
  const hasHCPCSInMaster = masterColumns.some(col => 
    hcpcsKeywords.some(keyword => col.toLowerCase().includes(keyword))
  );
  const hasHCPCSInClient = clientColumns.some(col => 
    hcpcsKeywords.some(keyword => col.toLowerCase().includes(keyword))
  );

  if (!hasHCPCSInMaster) {
    errors.push('Master data appears to be missing HCPCS/code column');
  }
  if (!hasHCPCSInClient) {
    errors.push('Client data appears to be missing HCPCS/code column');
  }

  // Warn about column count differences
  if (masterColumns.length !== clientColumns.length) {
    warnings.push(`Column count mismatch: Master has ${masterColumns.length}, Client has ${clientColumns.length}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export const commonValidationRules = {
  hcpcs: {
    required: ['HCPCS', 'hcpcs', 'code', 'procedure_code'],
    pattern: {
      'HCPCS': /^[A-Z0-9]{5}(-[A-Z0-9]{1,2})?$/,
      'hcpcs': /^[A-Z0-9]{5}(-[A-Z0-9]{1,2})?$/,
      'code': /^[A-Z0-9]{5}(-[A-Z0-9]{1,2})?$/,
      'procedure_code': /^[A-Z0-9]{5}(-[A-Z0-9]{1,2})?$/
    }
  },
  modifier: {
    pattern: {
      'modifier': /^[A-Z0-9]{1,2}$/,
      'mod': /^[A-Z0-9]{1,2}$/
    }
  },
  general: {
    maxLength: {
      'description': 255,
      'name': 100
    }
  }
};