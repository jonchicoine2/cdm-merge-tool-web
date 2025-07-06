import { GridColDef } from "@mui/x-data-grid";

interface AIIntent {
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

interface ExcelRow {
  id: number;
  [key: string]: string | number | undefined;
}

interface AIActionHandlerProps {
  aiSelectedGrid: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
  setAiSelectedGrid: (grid: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates') => void;
  setShowCompare: (show: boolean) => void;
  setErrorsTabValue: (value: number) => void;
  scrollToActiveGrid: (gridType: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates') => void;
  
  // Search setters
  setSearchMaster: (search: string) => void;
  setSearchClient: (search: string) => void;
  setSearchMerged: (search: string) => void;
  
  // Filter properties
  masterFilters: Array<{column: string, condition: string, value: string}>;
  clientFilters: Array<{column: string, condition: string, value: string}>;
  mergedFilters: Array<{column: string, condition: string, value: string}>;
  unmatchedFilters: Array<{column: string, condition: string, value: string}>;
  duplicatesFilters: Array<{column: string, condition: string, value: string}>;
  
  // Filter setters
  setMasterFilters: (filters: Array<{column: string, condition: string, value: string}>) => void;
  setClientFilters: (filters: Array<{column: string, condition: string, value: string}>) => void;
  setMergedFilters: (filters: Array<{column: string, condition: string, value: string}>) => void;
  setUnmatchedFilters: (filters: Array<{column: string, condition: string, value: string}>) => void;
  setDuplicatesFilters: (filters: Array<{column: string, condition: string, value: string}>) => void;
  
  // Sort setters
  setMasterSortModel: (model: Array<{field: string, sort: 'asc' | 'desc'}>) => void;
  setClientSortModel: (model: Array<{field: string, sort: 'asc' | 'desc'}>) => void;
  setMergedSortModel: (model: Array<{field: string, sort: 'asc' | 'desc'}>) => void;
  setUnmatchedSortModel: (model: Array<{field: string, sort: 'asc' | 'desc'}>) => void;
  setDuplicatesSortModel: (model: Array<{field: string, sort: 'asc' | 'desc'}>) => void;
  
  // Data and columns
  columnsMaster: GridColDef[];
  columnsClient: GridColDef[];
  mergedColumns: GridColDef[];
  rowsMaster: ExcelRow[];
  rowsClient: ExcelRow[];
  mergedRows: ExcelRow[];
  mergedForExport: ExcelRow[];
  
  // Selection data
  selectedRowsMaster: (number | string)[];
  selectedRowsClient: (number | string)[];
  selectedRowsMerged: (number | string)[];
  selectedRowsUnmatched: (number | string)[];
  selectedRowsDuplicates: (number | string)[];
  selectedRowMaster?: number | string;
  selectedRowClient?: number | string;
  selectedRowMerged?: number | string;
  selectedRowUnmatched?: number | string;
  selectedRowDuplicates?: number | string;
  
  // Handler functions
  getCurrentSelectedRowId: () => number | null;
  handleExportWithFilename: (filename: string) => void;
  handleExport: () => void;
  handleDuplicateRecord: (rowId: number | string, targetView: 'master' | 'client' | 'merged') => {success: boolean, newRowId?: number | string, originalRowId: number | string};
  handleDeleteRecord: (rowId: number | string, targetView: 'master' | 'client' | 'merged') => void;
  handleDeleteMultipleRecords: (rowIds: (number | string)[], targetView: 'master' | 'client' | 'merged') => {success: boolean, deletedCount: number};
  handleAddRecord: (targetView: 'master' | 'client' | 'merged', rowData?: Record<string, string | number | undefined>) => void;
}

export const createAIActionHandler = (props: AIActionHandlerProps) => {
  return (intent: AIIntent) => {
    console.log('[AI ACTION DEBUG] Received intent:', intent);
    console.log('[AI ACTION DEBUG] Intent type:', intent.type, 'Action:', intent.action);
    console.log('[AI ACTION DEBUG] Parameters:', intent.parameters);
    console.log('[AI ACTION DEBUG] Current aiSelectedGrid:', props.aiSelectedGrid);
    
    // Handle documentation questions - no grid action needed
    if (intent.type === 'documentation' || intent.action === 'explain') {
      // Just log for now - the response is already displayed in chat
      console.log('Documentation question answered:', intent.response);
      return;
    }

    // FALLBACK: If AI returned a query but we can detect it should be an action
    if (intent.type === 'query' && intent.response) {
      const response = intent.response.toLowerCase();
      
      // Check for duplicate commands
      if ((response.includes('duplicat') && (response.includes('current') || response.includes('selected'))) ||
          response.includes('duplicating the currently selected row') ||
          response.includes('duplicating the selected row')) {
        
        const selectedRowId = props.getCurrentSelectedRowId();
        console.log('[AI FALLBACK] Duplicate command detected, current selection:', selectedRowId);
        if (selectedRowId !== null) {
          console.log('[AI FALLBACK] Converting query to duplicate action, rowId:', selectedRowId);
          const duplicateIntent: AIIntent = {
            type: 'action',
            action: 'duplicate',
            parameters: { rowId: selectedRowId },
            response: 'Duplicating the currently selected row'
          };
          // Recursively call handleAIAction with the corrected intent
          createAIActionHandler(props)(duplicateIntent);
          return;
        } else {
          console.error('[AI FALLBACK] No row selected for duplicate command');
        }
      }
    }
    
    // Function to ensure grid is visible and scroll to it
    const ensureGridVisible = (targetView: string) => {
      switch (targetView) {
        case 'master':
          props.setShowCompare(false);
          setTimeout(() => props.scrollToActiveGrid('master'), 300);
          break;
        case 'client':
          props.setShowCompare(false);
          setTimeout(() => props.scrollToActiveGrid('client'), 300);
          break;
        case 'merged':
          props.setShowCompare(true);
          props.setErrorsTabValue(-1);
          setTimeout(() => props.scrollToActiveGrid('merged'), 500);
          break;
        case 'unmatched':
          props.setShowCompare(true);
          props.setErrorsTabValue(0);
          setTimeout(() => props.scrollToActiveGrid('unmatched'), 500);
          break;
        case 'duplicates':
          props.setShowCompare(true); 
          props.setErrorsTabValue(1);
          setTimeout(() => props.scrollToActiveGrid('duplicates'), 500);
          break;
      }
    };
    
    if (intent.action === 'switch' && intent.parameters?.view) {
      const view = intent.parameters.view as 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
      
      // Update AI selected grid
      props.setAiSelectedGrid(view);
      
      // Ensure grid is visible and scroll to it
      ensureGridVisible(view);
    }
    
    if (intent.action === 'search' && intent.parameters?.value) {
      const searchValue = intent.parameters.value;
      const targetView = intent.parameters?.view || props.aiSelectedGrid;
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        props.setAiSelectedGrid(intent.parameters.view as typeof props.aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the search results
        ensureGridVisible(targetView);
      }
      
      switch (targetView) {
        case 'master':
          props.setSearchMaster(searchValue);
          break;
        case 'client':
          props.setSearchClient(searchValue);
          break;
        case 'merged':
          props.setSearchMerged(searchValue);
          break;
      }
    }

    if (intent.action === 'filter' && intent.parameters?.column && intent.parameters?.condition) {
      const column = intent.parameters.column;
      const condition = intent.parameters.condition;
      const value = intent.parameters.value || '';
      const targetView = intent.parameters?.view || props.aiSelectedGrid;
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        props.setAiSelectedGrid(intent.parameters.view as typeof props.aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the filter results
        ensureGridVisible(targetView);
      }
      
      const newFilter = { column, condition, value };
      
      // Add filter to the correct grid
      switch (targetView) {
        case 'master':
          props.setMasterFilters([...props.masterFilters.filter(f => f.column !== column), newFilter]);
          break;
        case 'client':
          props.setClientFilters([...props.clientFilters.filter(f => f.column !== column), newFilter]);
          break;
        case 'merged':
          props.setMergedFilters([...props.mergedFilters.filter(f => f.column !== column), newFilter]);
          break;
        case 'unmatched':
          props.setUnmatchedFilters([...props.unmatchedFilters.filter(f => f.column !== column), newFilter]);
          break;
        case 'duplicates':
          props.setDuplicatesFilters([...props.duplicatesFilters.filter(f => f.column !== column), newFilter]);
          break;
      }
      
      console.log(`Applied filter: ${column} ${condition} ${value} to ${targetView} grid`);
    }

    if (intent.action === 'clear_filters') {
      const targetView = intent.parameters?.view || props.aiSelectedGrid;
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        props.setAiSelectedGrid(intent.parameters.view as typeof props.aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the cleared filters
        ensureGridVisible(targetView);
      }
      
      switch (targetView) {
        case 'master':
          props.setMasterFilters([]);
          break;
        case 'client':
          props.setClientFilters([]);
          break;
        case 'merged':
          props.setMergedFilters([]);
          break;
        case 'unmatched':
          props.setUnmatchedFilters([]);
          break;
        case 'duplicates':
          props.setDuplicatesFilters([]);
          break;
      }
      
      console.log(`Cleared filters for ${targetView} grid`);
    }

    if (intent.action === 'sort' && intent.parameters?.column) {
      const column = intent.parameters.column;
      const direction = intent.parameters.direction || 'asc';
      const targetView = intent.parameters?.view || props.aiSelectedGrid;
      
      console.log('[AI SORT DEBUG] Processing sort command:', {
        column,
        direction,
        targetView,
        aiSelectedGrid: props.aiSelectedGrid,
        intentParameters: intent.parameters
      });
      
      // Get the available columns for the target grid
      let targetColumns: GridColDef[] = [];
      switch (targetView) {
        case 'master':
          targetColumns = props.columnsMaster;
          break;
        case 'client':
          targetColumns = props.columnsClient;
          break;
        case 'merged':
          targetColumns = props.mergedColumns;
          break;
        case 'unmatched':
          targetColumns = props.columnsClient;
          break;
        case 'duplicates':
          targetColumns = props.columnsClient;
          break;
      }
      
      console.log('[AI SORT DEBUG] Available columns for', targetView, ':', targetColumns.map(col => col.field));
      
      // Try to find the exact column match or a case-insensitive match
      let matchedColumn = targetColumns.find(col => col.field === column)?.field;
      if (!matchedColumn) {
        // Try case-insensitive match
        matchedColumn = targetColumns.find(col => 
          col.field.toLowerCase() === column.toLowerCase()
        )?.field;
      }
      if (!matchedColumn) {
        // Try partial match (column name contains the search term or vice versa)
        matchedColumn = targetColumns.find(col => 
          col.field.toLowerCase().includes(column.toLowerCase()) ||
          column.toLowerCase().includes(col.field.toLowerCase())
        )?.field;
      }
      
      console.log('[AI SORT DEBUG] Column matching result:', {
        requestedColumn: column,
        matchedColumn,
        matchFound: !!matchedColumn
      });
      
      if (!matchedColumn) {
        console.error('[AI SORT ERROR] Column not found:', column, 'Available columns:', targetColumns.map(col => col.field));
        
        // Create a user-friendly error message
        const availableColumnNames = targetColumns.map(col => col.field).join(', ');
        const errorMessage = `Sorry, I couldn't find a column named "${column}" in the ${targetView} grid. Available columns are: ${availableColumnNames}`;
        
        // You could add a callback here to show this error in the AI chat
        // For now, just log it prominently
        console.error('[AI SORT ERROR MESSAGE]', errorMessage);
        return;
      }
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        props.setAiSelectedGrid(intent.parameters.view as typeof props.aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the sort results
        ensureGridVisible(targetView);
      }
      
      const sortModel = [{ field: matchedColumn, sort: direction }];
      
      console.log('[AI SORT DEBUG] Applying sort model:', sortModel, 'to grid:', targetView);
      
      // Apply sorting to the correct grid
      switch (targetView) {
        case 'master':
          props.setMasterSortModel(sortModel);
          console.log('[AI SORT DEBUG] Master sort model set');
          break;
        case 'client':
          props.setClientSortModel(sortModel);
          console.log('[AI SORT DEBUG] Client sort model set');
          break;
        case 'merged':
          props.setMergedSortModel(sortModel);
          console.log('[AI SORT DEBUG] Merged sort model set');
          break;
        case 'unmatched':
          props.setUnmatchedSortModel(sortModel);
          console.log('[AI SORT DEBUG] Unmatched sort model set');
          break;
        case 'duplicates':
          props.setDuplicatesSortModel(sortModel);
          console.log('[AI SORT DEBUG] Duplicates sort model set');
          break;
      }
      
      console.log(`[AI SORT SUCCESS] Applied sorting: ${matchedColumn} ${direction} to ${targetView} grid`);
    }

    if (intent.action === 'export') {
      const targetView = intent.parameters?.view || props.aiSelectedGrid;
      const customFilename = intent.parameters?.filename;
      
      // For now, only support exporting merged data
      if (targetView === 'merged' || !intent.parameters?.view) {
        if (props.mergedForExport.length === 0) {
          console.log('No merged data available for export');
          return;
        }
        
        if (customFilename) {
          // Call export with custom filename
          props.handleExportWithFilename(customFilename);
        } else {
          // Call standard export
          props.handleExport();
        }
        
        // Scroll to merged grid to show the export happened
        ensureGridVisible('merged');
      } else {
        console.log(`Export not supported for ${targetView} grid yet`);
      }
    }

    if (intent.action === 'duplicate' && intent.parameters?.rowId) {
      const targetView = intent.parameters?.view || props.aiSelectedGrid;
      const rowId = intent.parameters.rowId;
      
      console.log('[DUPLICATE ACTION] Processing duplicate request:', {
        targetView,
        rowId,
        aiSelectedGrid: props.aiSelectedGrid,
        intentView: intent.parameters?.view
      });
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        props.setAiSelectedGrid(intent.parameters.view as typeof props.aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the duplication
        ensureGridVisible(targetView);
      }
      
      // Add a small delay to ensure state is synchronized
      setTimeout(() => {
        // Get HCPCS info for the row being duplicated
        const getRowHcpcs = (data: Record<string, unknown> | null | undefined) => {
          if (!data) return null;
          const hcpcsKey = Object.keys(data).find(key => key.toLowerCase().includes('hcpcs'));
          const modifierKey = Object.keys(data).find(key => key.toLowerCase().includes('modifier') || key.toLowerCase().includes('mod'));
          const hcpcs = hcpcsKey ? String(data[hcpcsKey] || '').trim() : '';
          const modifier = modifierKey ? String(data[modifierKey] || '').trim() : '';
          return hcpcs ? (modifier ? `${hcpcs}-${modifier}` : hcpcs) : null;
        };
        
        // Get the current row data for HCPCS identification
        const currentRows = targetView === 'master' ? props.rowsMaster : targetView === 'client' ? props.rowsClient : props.mergedRows;
        const rowToAnalyze = currentRows.find(row => row.id === rowId);
        const hcpcsCode = getRowHcpcs(rowToAnalyze);
        
        // Call the duplicate function
        const result = props.handleDuplicateRecord(rowId, targetView as 'master' | 'client' | 'merged');
        console.log('[DUPLICATE ACTION] Duplicate result:', result);
        
        if (result.success && result.newRowId) {
          const identifier = hcpcsCode ? `HCPCS code ${hcpcsCode}` : `row ID ${result.originalRowId}`;
          console.log(`✅ Successfully duplicated ${identifier} in ${targetView} grid. New record ID: ${result.newRowId}`);
        } else {
          const identifier = hcpcsCode ? `HCPCS code ${hcpcsCode}` : `row ID ${result.originalRowId}`;
          console.error(`❌ Failed to duplicate ${identifier} in ${targetView} grid`);
        }
      }, 100); // Small delay to ensure state synchronization
    }

    if (intent.action === 'delete') {
      const targetView = intent.parameters?.view || props.aiSelectedGrid;
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        props.setAiSelectedGrid(intent.parameters.view as typeof props.aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the deletion
        ensureGridVisible(targetView);
      }
      
      // Check if we have a specific rowId or should delete all selected rows
      if (intent.parameters?.rowId) {
        // Single row delete
        const rowId = intent.parameters.rowId;
        props.handleDeleteRecord(rowId, targetView as 'master' | 'client' | 'merged');
        console.log(`Deleted record ${rowId} from ${targetView} grid`);
      } else {
        // Bulk delete - get all selected rows for the current grid
        let selectedRowIds: (number | string)[] = [];
        
        switch (targetView) {
          case 'master':
            selectedRowIds = props.selectedRowsMaster.length > 0 ? props.selectedRowsMaster : (props.selectedRowMaster ? [props.selectedRowMaster] : []);
            break;
          case 'client':
            selectedRowIds = props.selectedRowsClient.length > 0 ? props.selectedRowsClient : (props.selectedRowClient ? [props.selectedRowClient] : []);
            break;
          case 'merged':
            selectedRowIds = props.selectedRowsMerged.length > 0 ? props.selectedRowsMerged : (props.selectedRowMerged ? [props.selectedRowMerged] : []);
            break;
          case 'unmatched':
            selectedRowIds = props.selectedRowsUnmatched.length > 0 ? props.selectedRowsUnmatched : (props.selectedRowUnmatched ? [props.selectedRowUnmatched] : []);
            break;
          case 'duplicates':
            selectedRowIds = props.selectedRowsDuplicates.length > 0 ? props.selectedRowsDuplicates : (props.selectedRowDuplicates ? [props.selectedRowDuplicates] : []);
            break;
        }
        
        console.log(`[DELETE ACTION] Bulk delete requested for ${targetView} grid. Selected rows:`, selectedRowIds);
        console.log(`[DELETE ACTION] Current selection arrays:`, {
          master: { multi: props.selectedRowsMaster, single: props.selectedRowMaster },
          client: { multi: props.selectedRowsClient, single: props.selectedRowClient },
          merged: { multi: props.selectedRowsMerged, single: props.selectedRowMerged },
          unmatched: { multi: props.selectedRowsUnmatched, single: props.selectedRowUnmatched },
          duplicates: { multi: props.selectedRowsDuplicates, single: props.selectedRowDuplicates }
        });
        console.log(`[DELETE ACTION] getCurrentSelectedRowId returns:`, props.getCurrentSelectedRowId());
        
        if (selectedRowIds.length > 0) {
          // Get HCPCS codes for the rows being deleted for better feedback
          const currentRows = targetView === 'master' ? props.rowsMaster : targetView === 'client' ? props.rowsClient : props.mergedRows;
          const rowsToDelete = currentRows.filter(row => selectedRowIds.includes(row.id));
          const hcpcsCodes = rowsToDelete.map(row => {
            const hcpcsKey = Object.keys(row).find(key => key.toLowerCase().includes('hcpcs'));
            const modifierKey = Object.keys(row).find(key => key.toLowerCase().includes('modifier') || key.toLowerCase().includes('mod'));
            const hcpcs = hcpcsKey ? String(row[hcpcsKey] || '').trim() : '';
            const modifier = modifierKey ? String(row[modifierKey] || '').trim() : '';
            return hcpcs ? (modifier ? `${hcpcs}-${modifier}` : hcpcs) : `ID ${row.id}`;
          });
          
          const result = props.handleDeleteMultipleRecords(selectedRowIds, targetView as 'master' | 'client' | 'merged');
          if (result.success) {
            console.log(`✅ Successfully deleted ${result.deletedCount} records: ${hcpcsCodes.join(', ')}`);
          }
        } else {
          console.log(`❌ No rows selected for deletion in ${targetView} grid`);
        }
      }
    }

    if (intent.action === 'add') {
      const targetView = intent.parameters?.view || props.aiSelectedGrid;
      const rowData = intent.parameters?.rowData;
      
      // Update AI selected grid if specified
      if (intent.parameters?.view) {
        props.setAiSelectedGrid(intent.parameters.view as typeof props.aiSelectedGrid);
        ensureGridVisible(intent.parameters.view);
      } else {
        // Scroll to current grid to show the addition
        ensureGridVisible(targetView);
      }
      
      // Call the add function
      props.handleAddRecord(targetView as 'master' | 'client' | 'merged', rowData);
      console.log(`Added new record to ${targetView} grid`);
    }
  };
};