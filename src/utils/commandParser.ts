interface GridContext {
  columns: string[];
  rowCount: number;
  sampleData: Record<string, unknown>[];
  currentView: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
  availableGrids: {
    master: { hasData: boolean; rowCount: number };
    client: { hasData: boolean; rowCount: number };
    merged: { hasData: boolean; rowCount: number };
    unmatched: { hasData: boolean; rowCount: number };
    duplicates: { hasData: boolean; rowCount: number };
  };
  isInCompareMode: boolean;
  selectedGrid: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
  selectedRowId: number | string | null;
  selectedRowData: Record<string, unknown> | null;
  selectedHcpcs: string | null;
  selectedRowCount: number;
}

interface ParsedCommand {
  type: 'action' | 'query';
  action?: 'sort' | 'filter' | 'search' | 'summarize' | 'count' | 'show' | 'switch' | 'explain' | 'clear_filters' | 'export' | 'duplicate' | 'delete' | 'add';
  parameters?: {
    column?: string;
    value?: string;
    direction?: 'asc' | 'desc';
    condition?: string;
    view?: string;
    filename?: string;
    rowId?: number | string;
    rowData?: {[key: string]: string | number | undefined};
  };
  response?: string;
}

export function parseCommand(message: string, gridContext: GridContext): ParsedCommand | null {
  const msg = message.toLowerCase().trim();
  
  console.log('[COMMAND PARSER] Parsing message:', message);
  
  // Sort commands - handle specific multi-word patterns first, then general patterns
  let sortMatch = null;
  let column = '';
  let direction = 'asc';
  
  // Check for specific multi-word column patterns first
  if (msg.includes('charge master code') || msg.includes('charge code') || msg.includes('charge master')) {
    if (msg.includes('charge master code')) {
      column = 'charge master code';
    } else if (msg.includes('charge code')) {
      column = 'charge code';
    } else if (msg.includes('charge master')) {
      column = 'charge master';
    }
    
    // Check for direction
    if (msg.includes('desc') || msg.includes('descending')) {
      direction = 'desc';
    } else if (msg.includes('asc') || msg.includes('ascending')) {
      direction = 'asc';
    }
    
    sortMatch = { found: true };
  } else {
    // General single-word sort patterns
    const generalPatterns = [
      /sort\s+(?:by\s+)?(\w+)\s+(?:in\s+)?(asc|desc|ascending|descending)\s*(?:order)?/,
      /sort\s+(?:by\s+)?(\w+)\s+(asc|desc|ascending|descending)/,
      /sort\s+(?:by\s+)?(\w+)/
    ];
    
    for (const pattern of generalPatterns) {
      const match = msg.match(pattern);
      if (match) {
        column = match[1];
        if (match[2]) {
          direction = match[2].includes('desc') ? 'desc' : 'asc';
        }
        sortMatch = { found: true };
        break;
      }
    }
  }
  
  if (sortMatch) {
      
      // Column name aliases (including multi-word phrases)
      const columnAliases: { [key: string]: string } = {
        'cpt': 'hcpcs',
        'code': 'hcpcs',
        'codes': 'hcpcs',
        'desc': 'description',
        'descriptions': 'description',
        'qty': 'quantity',
        'quantities': 'quantity',
        'mod': 'modifier',
        'modifiers': 'modifier',
        'cdm': 'cdms',
        'charge': 'cdms',
        'charge code': 'cdms',
        'charge master': 'cdms',
        'charge master code': 'cdms',
        'chargecode': 'cdms',
        'chargemastercode': 'cdms',
        'chargemaster': 'cdms',
        'price': 'amount',
        'cost': 'amount'
      };
      
      // Display names for user-friendly responses
      const displayNames: { [key: string]: string } = {
        'hcpcs': 'HCPCS',
        'cdms': 'CDM',
        'description': 'description',
        'quantity': 'quantity', 
        'modifier': 'modifier',
        'amount': 'amount'
      };
      
    const originalColumn = column;
    
    // Map column alias to actual column name
    if (columnAliases[column.toLowerCase()]) {
      column = columnAliases[column.toLowerCase()];
    }
    
    const displayName = displayNames[column] || column;
    
    console.log('[COMMAND PARSER] Detected sort command:', { 
      originalColumn, 
      mappedColumn: column, 
      displayName,
      direction, 
      fullMessage: msg 
    });
    
    return {
      type: 'action',
      action: 'sort',
      parameters: { column, direction },
      response: `Sorting by ${displayName} in ${direction}ending order`
    };
  }
  
  // Delete commands
  if (/delete.*(selected|current|row)/i.test(msg) || /remove.*(selected|current|row)/i.test(msg)) {
    console.log('[COMMAND PARSER] Detected delete command');
    if (gridContext.selectedRowCount > 0) {
      if (gridContext.selectedRowCount === 1) {
        // Single row deletion - include specific row info
        return {
          type: 'action',
          action: 'delete',
          parameters: { rowId: gridContext.selectedRowId },
          response: `Deleting ${gridContext.selectedHcpcs ? `HCPCS code ${gridContext.selectedHcpcs}` : `row ID ${gridContext.selectedRowId}`} from the ${gridContext.selectedGrid} grid.`
        };
      } else {
        // Multiple row deletion - bulk delete
        return {
          type: 'action',
          action: 'delete',
          parameters: {}, // No rowId = bulk delete all selected
          response: `Deleting ${gridContext.selectedRowCount} selected rows from the ${gridContext.selectedGrid} grid.`
        };
      }
    } else {
      return {
        type: 'query',
        response: "I'm sorry, but there is currently no row selected. Please select a row first by clicking on it in the grid, then I can help you delete it."
      };
    }
  }
  
  // Duplicate commands  
  if (/duplicate.*(selected|current|row)/i.test(msg)) {
    console.log('[COMMAND PARSER] Detected duplicate command');
    if (gridContext.selectedRowId) {
      return {
        type: 'action',
        action: 'duplicate',
        parameters: { rowId: gridContext.selectedRowId },
        response: `Duplicating ${gridContext.selectedHcpcs ? `HCPCS code ${gridContext.selectedHcpcs}` : `row ID ${gridContext.selectedRowId}`}. The duplicated row will be assigned a new ID.`
      };
    } else {
      return {
        type: 'query',
        response: "I'm sorry, but there is currently no row selected. Please select a row first by clicking on it in the grid, then I can help you duplicate it."
      };
    }
  }
  
  // View switching
  const viewMatch = msg.match(/(?:show|switch\s+(?:to\s+)?|go\s+to)\s+(master|client|merged|unmatched|duplicates)/);
  if (viewMatch) {
    const view = viewMatch[1] as 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
    console.log('[COMMAND PARSER] Detected view switch command:', view);
    return {
      type: 'action',
      action: 'switch',
      parameters: { view },
      response: `Switching to ${view} view`
    };
  }
  
  // Export commands
  if (msg.includes('export')) {
    console.log('[COMMAND PARSER] Detected export command');
    const filenameMatch = msg.match(/export\s+(?:as\s+)?(.+)/);
    return {
      type: 'action', 
      action: 'export',
      parameters: filenameMatch ? { filename: filenameMatch[1].trim() } : {},
      response: filenameMatch ? `Exporting data as '${filenameMatch[1].trim()}.xlsx'` : 'Exporting merged data to Excel file'
    };
  }
  
  // Search commands
  const searchMatch = msg.match(/search\s+(?:for\s+)?(.+)/);
  if (searchMatch) {
    const searchTerm = searchMatch[1].trim();
    console.log('[COMMAND PARSER] Detected search command:', searchTerm);
    return {
      type: 'action',
      action: 'search',
      parameters: { value: searchTerm },
      response: `Searching for '${searchTerm}'`
    };
  }
  
  // Clear filters
  if (msg.includes('clear filters') || msg.includes('remove filters')) {
    console.log('[COMMAND PARSER] Detected clear filters command');
    return {
      type: 'action',
      action: 'clear_filters',
      parameters: {},
      response: 'Clearing all filters'
    };
  }
  
  // Filter commands - basic patterns
  const filterMatch = msg.match(/(?:hide|filter|show only)\s+(?:rows\s+)?(?:with\s+|where\s+)?(.+)/);
  if (filterMatch) {
    const filterText = filterMatch[1].trim();
    console.log('[COMMAND PARSER] Detected filter command:', filterText);
    
    // Try to extract column and condition
    if (filterText.includes('blank') || filterText.includes('empty')) {
      const columnMatch = filterText.match(/blank\s+(\w+)|(\w+)\s+(?:is\s+)?(?:blank|empty)/);
      if (columnMatch) {
        const column = columnMatch[1] || columnMatch[2];
        return {
          type: 'action',
          action: 'filter',
          parameters: { 
            column, 
            condition: msg.includes('hide') ? 'is_not_empty' : 'is_empty'
          },
          response: `Filtering rows where ${column} is ${msg.includes('hide') ? 'not empty' : 'empty'}`
        };
      }
    }
  }
  
  // Count commands
  if (msg.includes('how many') || msg.includes('count')) {
    console.log('[COMMAND PARSER] Detected count command');
    return {
      type: 'query',
      response: `There are ${gridContext.rowCount} rows in the ${gridContext.selectedGrid} grid.`
    };
  }
  
  // Add record commands
  if (msg.includes('add') && (msg.includes('record') || msg.includes('row'))) {
    console.log('[COMMAND PARSER] Detected add record command');
    return {
      type: 'action',
      action: 'add',
      parameters: {},
      response: 'Adding a new blank record to the current grid'
    };
  }
  
  console.log('[COMMAND PARSER] No pattern matched, will use AI fallback');
  return null; // No pattern matched, use AI fallback
}