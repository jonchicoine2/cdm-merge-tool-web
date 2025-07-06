import { ExcelRow } from './excelOperations';
import { GridRowSelectionModel } from '@mui/x-data-grid';

export interface DataManipulationResult {
  success: boolean;
  data: ExcelRow[];
  message?: string;
  error?: string;
}

export interface AddRecordOptions {
  position?: 'start' | 'end' | number;
  generateId?: boolean;
  defaultValues?: Partial<ExcelRow>;
}

export interface UpdateRecordOptions {
  validateBeforeUpdate?: boolean;
  mergeStrategy?: 'replace' | 'merge';
}

export interface DuplicateRecordOptions {
  suffix?: string;
  generateNewId?: boolean;
  fieldsToExclude?: string[];
}

export function addRecord(
  data: ExcelRow[],
  newRecord: Partial<ExcelRow>,
  options: AddRecordOptions = {}
): DataManipulationResult {
  try {
    const {
      position = 'end',
      generateId = true,
      defaultValues = {}
    } = options;

    // Create the new record
    const record: ExcelRow = {
      id: generateId ? Date.now() : (newRecord.id || 0),
      ...defaultValues,
      ...newRecord
    };

    // Validate the record has an ID
    if (!record.id) {
      return {
        success: false,
        data,
        error: 'Record must have an ID'
      };
    }

    // Check for duplicate IDs
    const existingRecord = data.find(r => r.id === record.id);
    if (existingRecord) {
      return {
        success: false,
        data,
        error: `Record with ID ${record.id} already exists`
      };
    }

    let newData: ExcelRow[];
    
    if (position === 'start') {
      newData = [record, ...data];
    } else if (position === 'end') {
      newData = [...data, record];
    } else if (typeof position === 'number') {
      newData = [...data];
      newData.splice(position, 0, record);
    } else {
      return {
        success: false,
        data,
        error: 'Invalid position specified'
      };
    }

    return {
      success: true,
      data: newData,
      message: `Record added successfully at position ${position}`
    };
  } catch (error) {
    return {
      success: false,
      data,
      error: `Failed to add record: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function updateRecord(
  data: ExcelRow[],
  id: number,
  updates: Partial<ExcelRow>,
  options: UpdateRecordOptions = {}
): DataManipulationResult {
  try {
    const { mergeStrategy = 'merge' } = options;

    const recordIndex = data.findIndex(r => r.id === id);
    if (recordIndex === -1) {
      return {
        success: false,
        data,
        error: `Record with ID ${id} not found`
      };
    }

    const newData = [...data];
    const originalRecord = newData[recordIndex];

    if (mergeStrategy === 'replace') {
      // Replace the entire record but keep the ID
      newData[recordIndex] = { id, ...updates };
    } else {
      // Merge updates with existing record
      newData[recordIndex] = { ...originalRecord, ...updates };
    }

    return {
      success: true,
      data: newData,
      message: `Record ${id} updated successfully`
    };
  } catch (error) {
    return {
      success: false,
      data,
      error: `Failed to update record: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function deleteRecord(data: ExcelRow[], id: number): DataManipulationResult {
  try {
    const recordIndex = data.findIndex(r => r.id === id);
    if (recordIndex === -1) {
      return {
        success: false,
        data,
        error: `Record with ID ${id} not found`
      };
    }

    const newData = data.filter(r => r.id !== id);

    return {
      success: true,
      data: newData,
      message: `Record ${id} deleted successfully`
    };
  } catch (error) {
    return {
      success: false,
      data,
      error: `Failed to delete record: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function deleteRecords(data: ExcelRow[], ids: number[]): DataManipulationResult {
  try {
    if (!ids || ids.length === 0) {
      return {
        success: false,
        data,
        error: 'No IDs provided for deletion'
      };
    }

    const newData = data.filter(r => !ids.includes(r.id));
    const deletedCount = data.length - newData.length;

    return {
      success: true,
      data: newData,
      message: `${deletedCount} records deleted successfully`
    };
  } catch (error) {
    return {
      success: false,
      data,
      error: `Failed to delete records: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function duplicateRecord(
  data: ExcelRow[],
  id: number,
  options: DuplicateRecordOptions = {}
): DataManipulationResult {
  try {
    const {
      suffix = '_copy',
      generateNewId = true,
      fieldsToExclude = []
    } = options;

    const originalRecord = data.find(r => r.id === id);
    if (!originalRecord) {
      return {
        success: false,
        data,
        error: `Record with ID ${id} not found`
      };
    }

    // Create duplicate record
    const duplicateRecord: ExcelRow = { ...originalRecord };
    
    // Generate new ID if requested
    if (generateNewId) {
      duplicateRecord.id = Date.now();
    }

    // Exclude specified fields
    fieldsToExclude.forEach(field => {
      if (field !== 'id') {
        delete duplicateRecord[field];
      }
    });

    // Add suffix to string fields (optional)
    if (suffix) {
      Object.keys(duplicateRecord).forEach(key => {
        if (key !== 'id' && typeof duplicateRecord[key] === 'string') {
          duplicateRecord[key] = `${duplicateRecord[key]}${suffix}`;
        }
      });
    }

    const newData = [...data, duplicateRecord];

    return {
      success: true,
      data: newData,
      message: `Record duplicated successfully with ID ${duplicateRecord.id}`
    };
  } catch (error) {
    return {
      success: false,
      data,
      error: `Failed to duplicate record: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function bulkUpdateRecords(
  data: ExcelRow[],
  updates: Array<{id: number, changes: Partial<ExcelRow>}>,
  options: UpdateRecordOptions = {}
): DataManipulationResult {
  try {
    let newData = [...data];
    let successCount = 0;
    const errors: string[] = [];

    updates.forEach(({ id, changes }) => {
      const result = updateRecord(newData, id, changes, options);
      if (result.success) {
        newData = result.data;
        successCount++;
      } else {
        errors.push(result.error || `Failed to update record ${id}`);
      }
    });

    return {
      success: errors.length === 0,
      data: newData,
      message: `${successCount} records updated successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      error: errors.length > 0 ? errors.join('; ') : undefined
    };
  } catch (error) {
    return {
      success: false,
      data,
      error: `Failed to perform bulk update: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function moveRecord(
  data: ExcelRow[],
  id: number,
  newPosition: number
): DataManipulationResult {
  try {
    const currentIndex = data.findIndex(r => r.id === id);
    if (currentIndex === -1) {
      return {
        success: false,
        data,
        error: `Record with ID ${id} not found`
      };
    }

    if (newPosition < 0 || newPosition >= data.length) {
      return {
        success: false,
        data,
        error: `Invalid position: ${newPosition}`
      };
    }

    const newData = [...data];
    const [movedRecord] = newData.splice(currentIndex, 1);
    newData.splice(newPosition, 0, movedRecord);

    return {
      success: true,
      data: newData,
      message: `Record moved from position ${currentIndex} to ${newPosition}`
    };
  } catch (error) {
    return {
      success: false,
      data,
      error: `Failed to move record: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function reorderRecords(
  data: ExcelRow[],
  newOrder: number[]
): DataManipulationResult {
  try {
    if (newOrder.length !== data.length) {
      return {
        success: false,
        data,
        error: 'New order array length must match data length'
      };
    }

    const newData = newOrder.map(id => {
      const record = data.find(r => r.id === id);
      if (!record) {
        throw new Error(`Record with ID ${id} not found`);
      }
      return record;
    });

    return {
      success: true,
      data: newData,
      message: `Records reordered successfully`
    };
  } catch (error) {
    return {
      success: false,
      data,
      error: `Failed to reorder records: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function copyRecords(
  sourceData: ExcelRow[],
  selection: GridRowSelectionModel,
  options: { generateNewIds?: boolean } = {}
): DataManipulationResult {
  try {
    const { generateNewIds = true } = options;
    
    const selectedRecords = sourceData.filter(record => 
      Array.isArray(selection) && selection.includes(record.id)
    );

    if (selectedRecords.length === 0) {
      return {
        success: false,
        data: [],
        error: 'No records selected for copying'
      };
    }

    const copiedRecords = selectedRecords.map(record => ({
      ...record,
      id: generateNewIds ? Date.now() + Math.random() : record.id
    }));

    return {
      success: true,
      data: copiedRecords,
      message: `${copiedRecords.length} records copied successfully`
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      error: `Failed to copy records: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function pasteRecords(
  targetData: ExcelRow[],
  recordsToPaste: ExcelRow[],
  position: 'start' | 'end' | number = 'end',
  options: { resolveIdConflicts?: boolean } = {}
): DataManipulationResult {
  try {
    const { resolveIdConflicts = true } = options;
    
    let processedRecords = [...recordsToPaste];
    
    if (resolveIdConflicts) {
      const existingIds = new Set(targetData.map(r => r.id));
      processedRecords = processedRecords.map(record => {
        if (existingIds.has(record.id)) {
          return { ...record, id: Date.now() + Math.random() };
        }
        return record;
      });
    }

    let newData: ExcelRow[];
    
    if (position === 'start') {
      newData = [...processedRecords, ...targetData];
    } else if (position === 'end') {
      newData = [...targetData, ...processedRecords];
    } else if (typeof position === 'number') {
      newData = [...targetData];
      newData.splice(position, 0, ...processedRecords);
    } else {
      return {
        success: false,
        data: targetData,
        error: 'Invalid position specified'
      };
    }

    return {
      success: true,
      data: newData,
      message: `${processedRecords.length} records pasted successfully`
    };
  } catch (error) {
    return {
      success: false,
      data: targetData,
      error: `Failed to paste records: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function sortRecords(
  data: ExcelRow[],
  field: string,
  direction: 'asc' | 'desc' = 'asc'
): DataManipulationResult {
  try {
    const newData = [...data].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return direction === 'asc' ? 1 : -1;
      if (bValue === null || bValue === undefined) return direction === 'asc' ? -1 : 1;
      
      // Convert to strings for comparison
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (aStr < bStr) return direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return {
      success: true,
      data: newData,
      message: `Records sorted by ${field} (${direction})`
    };
  } catch (error) {
    return {
      success: false,
      data,
      error: `Failed to sort records: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function clearData(data: ExcelRow[]): DataManipulationResult {
  return {
    success: true,
    data: [],
    message: `${data.length} records cleared`
  };
}

export function getRecordStats(data: ExcelRow[]): {
  total: number;
  emptyFields: number;
  duplicateIds: number;
  fieldStats: {[field: string]: {filled: number, empty: number, unique: number}};
} {
  const stats = {
    total: data.length,
    emptyFields: 0,
    duplicateIds: 0,
    fieldStats: {} as {[field: string]: {filled: number, empty: number, unique: number}}
  };

  if (data.length === 0) return stats;

  // Get all unique fields
  const allFields = new Set<string>();
  data.forEach(record => {
    Object.keys(record).forEach(key => allFields.add(key));
  });

  // Check for duplicate IDs
  const ids = data.map(r => r.id);
  const uniqueIds = new Set(ids);
  stats.duplicateIds = ids.length - uniqueIds.size;

  // Calculate field statistics
  allFields.forEach(field => {
    const values = data.map(record => record[field]);
    const filled = values.filter(v => v !== null && v !== undefined && v !== '').length;
    const empty = values.length - filled;
    const unique = new Set(values.filter(v => v !== null && v !== undefined && v !== '')).size;

    stats.fieldStats[field] = { filled, empty, unique };
    stats.emptyFields += empty;
  });

  return stats;
}