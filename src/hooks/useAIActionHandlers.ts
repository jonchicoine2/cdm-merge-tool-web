import { useCallback } from 'react';
import { GridColDef, GridRowSelectionModel, GridSortModel } from '@mui/x-data-grid';
import { ExcelRow, exportToExcel, generateExportFilename } from '../utils/excelOperations';
import { addRecord, deleteRecords, sortRecords } from '../utils/dataManipulation';

export interface AIIntent {
  type: 'query' | 'action' | 'filter' | 'sort' | 'analysis' | 'documentation';
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

export interface AIActionContext {
  currentGrid: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
  data: ExcelRow[];
  columns: GridColDef[];
  selection: GridRowSelectionModel;
  searchTerm: string;
  sortModel: GridSortModel;
}

export interface AIActionResult {
  success: boolean;
  message: string;
  data?: ExcelRow[];
  intent?: AIIntent;
  affectedRows?: number[];
  response?: string;
}

export interface UseAIActionHandlersReturn {
  handleAIAction: (intent: AIIntent, context: AIActionContext) => Promise<AIActionResult>;
  parseAIMessage: (message: string) => AIIntent | null;
  executeQuery: (intent: AIIntent, context: AIActionContext) => Promise<AIActionResult>;
  executeAction: (intent: AIIntent, context: AIActionContext) => Promise<AIActionResult>;
  executeFilter: (intent: AIIntent, context: AIActionContext) => Promise<AIActionResult>;
  executeSort: (intent: AIIntent, context: AIActionContext) => Promise<AIActionResult>;
  executeAnalysis: (intent: AIIntent, context: AIActionContext) => Promise<AIActionResult>;
  generateDocumentation: (intent: AIIntent, context: AIActionContext) => Promise<AIActionResult>;
}

export function useAIActionHandlers(): UseAIActionHandlersReturn {
  // Main AI action handler
  const handleAIAction = useCallback(async (intent: AIIntent, context: AIActionContext): Promise<AIActionResult> => {
    try {
      console.log('[AI ACTION]', intent.type, intent.action, intent.parameters);

      switch (intent.type) {
        case 'query':
          return await executeQuery(intent, context);
        case 'action':
          return await executeAction(intent, context);
        case 'filter':
          return await executeFilter(intent, context);
        case 'sort':
          return await executeSort(intent, context);
        case 'analysis':
          return await executeAnalysis(intent, context);
        case 'documentation':
          return await generateDocumentation(intent, context);
        default:
          return {
            success: false,
            message: `Unknown intent type: ${intent.type}`,
            response: `I don't understand the action type "${intent.type}". Please try rephrasing your request.`
          };
      }
    } catch (error) {
      console.error('[AI ACTION ERROR]', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return {
        success: false,
        message: `Error executing AI action: ${errorMessage}`,
        response: `Sorry, I encountered an error while processing your request: ${errorMessage}`
      };
    }
  }, [executeQuery, executeAction, executeFilter, executeSort, executeAnalysis]);

  // Parse natural language message into AI intent
  const parseAIMessage = useCallback((message: string): AIIntent | null => {
    const msg = message.toLowerCase().trim();

    // Sort patterns
    if (msg.includes('sort') || msg.includes('order')) {
      const direction = msg.includes('desc') || msg.includes('descending') || msg.includes('reverse') ? 'desc' : 'asc';
      const column = extractColumnName(msg);
      
      return {
        type: 'sort',
        action: 'sort',
        parameters: { column, direction }
      };
    }

    // Filter patterns
    if (msg.includes('filter') || msg.includes('show only') || msg.includes('where')) {
      const column = extractColumnName(msg);
      const value = extractFilterValue(msg);
      
      return {
        type: 'filter',
        action: 'filter',
        parameters: { column, value }
      };
    }

    // Search patterns
    if (msg.includes('search') || msg.includes('find')) {
      const value = extractSearchValue(msg);
      
      return {
        type: 'filter',
        action: 'search',
        parameters: { value }
      };
    }

    // Export patterns
    if (msg.includes('export') || msg.includes('download')) {
      const filename = extractFilename(msg);
      
      return {
        type: 'action',
        action: 'export',
        parameters: { filename }
      };
    }

    // Count/summary patterns
    if (msg.includes('count') || msg.includes('how many') || msg.includes('total')) {
      return {
        type: 'analysis',
        action: 'count'
      };
    }

    // Clear filters patterns
    if (msg.includes('clear') && (msg.includes('filter') || msg.includes('search'))) {
      return {
        type: 'action',
        action: 'clear_filters'
      };
    }

    // Switch view patterns
    if (msg.includes('switch') || msg.includes('show') && (msg.includes('master') || msg.includes('client') || msg.includes('merged'))) {
      const view = extractViewName(msg);
      
      return {
        type: 'action',
        action: 'switch',
        parameters: { view }
      };
    }

    // Default query intent
    return {
      type: 'query',
      action: 'explain',
      response: `I'm processing your request: "${message}"`
    };
  }, []);

  // Execute query intents
  const executeQuery = useCallback(async (intent: AIIntent, context: AIActionContext): Promise<AIActionResult> => {
    const { data, columns } = context;

    switch (intent.action) {
      case 'explain':
        return {
          success: true,
          message: 'Query processed',
          response: intent.response || `I can help you with the ${context.currentGrid} data. You have ${data.length} records with ${columns.length} columns.`
        };

      case 'summarize':
        const summary = `Dataset Summary:
- Grid: ${context.currentGrid}
- Total Records: ${data.length}
- Columns: ${columns.length}
- Selected Records: ${Array.isArray(context.selection) ? context.selection.length : 0}
- Current Search: ${context.searchTerm || 'None'}`;

        return {
          success: true,
          message: 'Summary generated',
          response: summary
        };

      default:
        return {
          success: false,
          message: 'Unknown query action',
          response: 'I didn\'t understand that query. Could you rephrase it?'
        };
    }
  }, []);

  // Execute action intents
  const executeAction = useCallback(async (intent: AIIntent, context: AIActionContext): Promise<AIActionResult> => {
    const { data, selection } = context;

    switch (intent.action) {
      case 'export':
        try {
          const filename = intent.parameters?.filename || generateExportFilename('merged');
          const dataToExport = Array.isArray(selection) && selection.length > 0 
            ? data.filter(row => selection.includes(row.id))
            : data;
          
          exportToExcel(dataToExport, filename);
          
          return {
            success: true,
            message: `Exported ${dataToExport.length} records`,
            response: `Successfully exported ${dataToExport.length} records to ${filename}`
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
          return {
            success: false,
            message: 'Export failed',
            response: `Failed to export data: ${errorMessage}`
          };
        }

      case 'clear_filters':
        return {
          success: true,
          message: 'Filters cleared',
          response: 'All filters and search terms have been cleared.'
        };

      case 'switch':
        const view = intent.parameters?.view;
        if (view && ['master', 'client', 'merged', 'unmatched', 'duplicates'].includes(view)) {
          return {
            success: true,
            message: `Switched to ${view} view`,
            response: `Now showing ${view} data.`
          };
        }
        return {
          success: false,
          message: 'Invalid view',
          response: 'Please specify a valid view: master, client, merged, unmatched, or duplicates.'
        };

      case 'delete':
        if (!Array.isArray(selection) || selection.length === 0) {
          return {
            success: false,
            message: 'No records selected',
            response: 'Please select records to delete first.'
          };
        }

        const deleteResult = deleteRecords(data, selection as number[]);
        return {
          success: deleteResult.success,
          message: deleteResult.message || 'Delete operation completed',
          data: deleteResult.data,
          affectedRows: selection as number[],
          response: deleteResult.success 
            ? `Successfully deleted ${selection.length} records.`
            : `Failed to delete records: ${deleteResult.error}`
        };

      case 'duplicate':
        if (!Array.isArray(selection) || selection.length !== 1) {
          return {
            success: false,
            message: 'Select exactly one record',
            response: 'Please select exactly one record to duplicate.'
          };
        }

        const recordToDuplicate = data.find(row => row.id === selection[0]);
        if (!recordToDuplicate) {
          return {
            success: false,
            message: 'Record not found',
            response: 'Selected record not found.'
          };
        }

        const duplicateRow = { ...recordToDuplicate, id: Date.now() };
        const addResult = addRecord(data, duplicateRow);
        
        return {
          success: addResult.success,
          message: addResult.message || 'Duplicate operation completed',
          data: addResult.data,
          affectedRows: [duplicateRow.id],
          response: addResult.success 
            ? `Successfully duplicated record.`
            : `Failed to duplicate record: ${addResult.error}`
        };

      default:
        return {
          success: false,
          message: 'Unknown action',
          response: `I don't know how to perform the action "${intent.action}".`
        };
    }
  }, []);

  // Execute filter intents
  const executeFilter = useCallback(async (intent: AIIntent, context: AIActionContext): Promise<AIActionResult> => {
    const { data } = context;
    const { column, value } = intent.parameters || {};

    if (intent.action === 'search' && value) {
      const filteredData = data.filter(row => 
        Object.values(row).some(cellValue => 
          String(cellValue || '').toLowerCase().includes(value.toLowerCase())
        )
      );

      return {
        success: true,
        message: `Found ${filteredData.length} matching records`,
        data: filteredData,
        response: `Search for "${value}" found ${filteredData.length} matching records.`
      };
    }

    if (intent.action === 'filter' && column && value) {
      const filteredData = data.filter(row => {
        const cellValue = row[column];
        return String(cellValue || '').toLowerCase().includes(value.toLowerCase());
      });

      return {
        success: true,
        message: `Filtered to ${filteredData.length} records`,
        data: filteredData,
        response: `Filter on ${column} = "${value}" shows ${filteredData.length} records.`
      };
    }

    return {
      success: false,
      message: 'Invalid filter parameters',
      response: 'Please specify a column and value to filter by.'
    };
  }, []);

  // Execute sort intents
  const executeSort = useCallback(async (intent: AIIntent, context: AIActionContext): Promise<AIActionResult> => {
    const { data } = context;
    const { column, direction = 'asc' } = intent.parameters || {};

    if (!column) {
      return {
        success: false,
        message: 'No column specified',
        response: 'Please specify a column to sort by.'
      };
    }

    const sortResult = sortRecords(data, column, direction as 'asc' | 'desc');
    
    return {
      success: sortResult.success,
      message: sortResult.message || 'Sort completed',
      data: sortResult.data,
      response: sortResult.success 
        ? `Sorted ${data.length} records by ${column} (${direction}).`
        : `Failed to sort: ${sortResult.error}`
    };
  }, []);

  // Execute analysis intents
  const executeAnalysis = useCallback(async (intent: AIIntent, context: AIActionContext): Promise<AIActionResult> => {
    const { data, columns } = context;

    switch (intent.action) {
      case 'count':
        const stats = {
          totalRecords: data.length,
          totalColumns: columns.length,
          selectedRecords: Array.isArray(context.selection) ? context.selection.length : 0,
          emptyFields: 0,
        };

        // Count empty fields
        data.forEach(row => {
          Object.values(row).forEach(value => {
            if (!value || value === '') {
              stats.emptyFields++;
            }
          });
        });

        const analysis = `Data Analysis:
- Total Records: ${stats.totalRecords}
- Total Columns: ${stats.totalColumns}
- Selected Records: ${stats.selectedRecords}
- Empty Fields: ${stats.emptyFields}
- Data Completeness: ${((stats.totalRecords * stats.totalColumns - stats.emptyFields) / (stats.totalRecords * stats.totalColumns) * 100).toFixed(1)}%`;

        return {
          success: true,
          message: 'Analysis completed',
          response: analysis
        };

      default:
        return {
          success: false,
          message: 'Unknown analysis action',
          response: 'I don\'t know how to perform that analysis.'
        };
    }
  }, []);

  // Generate documentation
  const generateDocumentation = useCallback(async (intent: AIIntent, context: AIActionContext): Promise<AIActionResult> => {
    const { data, columns, currentGrid } = context;

    const documentation = `# ${currentGrid.toUpperCase()} Data Documentation

## Overview
- **Grid Type**: ${currentGrid}
- **Record Count**: ${data.length}
- **Column Count**: ${columns.length}

## Columns
${columns.map(col => `- **${col.field}**: ${col.headerName || col.field}`).join('\n')}

## Data Sample
${data.slice(0, 3).map(row => 
  `- Record ${row.id}: ${Object.entries(row).slice(0, 3).map(([k, v]) => `${k}=${v}`).join(', ')}`
).join('\n')}

## Usage
This data can be filtered, sorted, and exported using the AI assistant.`;

    return {
      success: true,
      message: 'Documentation generated',
      response: documentation
    };
  }, []);

  // Helper functions for parsing
  const extractColumnName = (message: string): string | undefined => {
    const columns = ['hcpcs', 'code', 'description', 'modifier', 'quantity', 'price', 'date'];
    return columns.find(col => message.includes(col));
  };

  const extractFilterValue = (message: string): string | undefined => {
    const match = message.match(/["']([^"']+)["']/) || message.match(/equals?\s+(\w+)/) || message.match(/is\s+(\w+)/);
    return match ? match[1] : undefined;
  };

  const extractSearchValue = (message: string): string | undefined => {
    const match = message.match(/(?:search|find)\s+(?:for\s+)?["']?([^"']+)["']?/) || message.match(/["']([^"']+)["']/);
    return match ? match[1].trim() : undefined;
  };

  const extractFilename = (message: string): string | undefined => {
    const match = message.match(/(?:as|to)\s+["']?([^"'\s]+\.(xlsx?|csv))["']?/);
    return match ? match[1] : undefined;
  };

  const extractViewName = (message: string): string | undefined => {
    const views = ['master', 'client', 'merged', 'unmatched', 'duplicates'];
    return views.find(view => message.includes(view));
  };

  return {
    handleAIAction,
    parseAIMessage,
    executeQuery,
    executeAction,
    executeFilter,
    executeSort,
    executeAnalysis,
    generateDocumentation,
  };
}