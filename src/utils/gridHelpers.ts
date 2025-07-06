import { ExcelRow } from './excelOperations';
import { GridColDef, GridSortModel } from '@mui/x-data-grid';

export interface GridFilterOptions {
  searchTerm?: string;
  columnFilters?: {[field: string]: string};
  customFilters?: {[field: string]: (value: unknown) => boolean};
}

export interface GridStyleOptions {
  height?: number;
  width?: string;
  chatWidth?: number;
  isCompact?: boolean;
  headerHeight?: number;
  rowHeight?: number;
}

export interface GridContainerStyleOptions {
  chatWidth?: number;
  isFullWidth?: boolean;
  marginTop?: number;
  marginBottom?: number;
}

export function filterRows(data: ExcelRow[], options: GridFilterOptions): ExcelRow[] {
  let filteredData = [...data];

  // Apply search term filter
  if (options.searchTerm && options.searchTerm.trim() !== '') {
    const searchTerm = options.searchTerm.toLowerCase();
    filteredData = filteredData.filter(row => {
      return Object.values(row).some(value => {
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchTerm);
      });
    });
  }

  // Apply column filters
  if (options.columnFilters) {
    Object.entries(options.columnFilters).forEach(([field, filterValue]) => {
      if (filterValue && filterValue.trim() !== '') {
        const filterTerm = filterValue.toLowerCase();
        filteredData = filteredData.filter(row => {
          const cellValue = row[field];
          if (cellValue === null || cellValue === undefined) return false;
          return String(cellValue).toLowerCase().includes(filterTerm);
        });
      }
    });
  }

  // Apply custom filters
  if (options.customFilters) {
    Object.entries(options.customFilters).forEach(([field, filterFn]) => {
      filteredData = filteredData.filter(row => {
        const value = row[field];
        return filterFn(value);
      });
    });
  }

  return filteredData;
}

export function sortRows(data: ExcelRow[], sortModel: GridSortModel): ExcelRow[] {
  if (!sortModel || sortModel.length === 0) return data;

  const sortedData = [...data];
  
  // Apply sorting in reverse order to handle multiple sort criteria
  for (let i = sortModel.length - 1; i >= 0; i--) {
    const { field, sort } = sortModel[i];
    if (!sort) continue;

    sortedData.sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return sort === 'asc' ? 1 : -1;
      if (bValue === null || bValue === undefined) return sort === 'asc' ? -1 : 1;

      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sort === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string values
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (aStr < bStr) return sort === 'asc' ? -1 : 1;
      if (aStr > bStr) return sort === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return sortedData;
}

export function applyGridFilters(
  data: ExcelRow[],
  searchTerm: string,
  columnFilters: {[field: string]: string} = {},
  customFilters: {[field: string]: (value: unknown) => boolean} = {}
): ExcelRow[] {
  return filterRows(data, {
    searchTerm,
    columnFilters,
    customFilters
  });
}

export function getDataGridStyles(options: GridStyleOptions = {}) {
  const {
    height = 400,
    width = '100%',
    chatWidth = 0,
    isCompact = false
  } = options;

  const actualWidth = chatWidth > 0 ? `calc(100% - ${chatWidth}px)` : width;

  return {
    height,
    width: actualWidth,
    '& .MuiDataGrid-root': {
      border: 'none',
      fontSize: isCompact ? '0.75rem' : '0.875rem',
    },
    '& .MuiDataGrid-cell': {
      borderBottom: '1px solid #e0e0e0',
      fontSize: isCompact ? '0.75rem' : '0.875rem',
      padding: isCompact ? '4px 8px' : '8px 16px',
    },
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: '#f5f5f5',
      borderBottom: '2px solid #e0e0e0',
      fontSize: isCompact ? '0.75rem' : '0.875rem',
      fontWeight: 'bold',
    },
    '& .MuiDataGrid-columnHeader': {
      padding: isCompact ? '4px 8px' : '8px 16px',
    },
    '& .MuiDataGrid-row': {
      '&:nth-of-type(odd)': {
        backgroundColor: '#fafafa',
      },
      '&:hover': {
        backgroundColor: '#f0f0f0',
      },
    },
    '& .MuiDataGrid-cell:focus': {
      outline: 'none',
    },
    '& .MuiDataGrid-row:focus': {
      outline: 'none',
    },
    '& .MuiDataGrid-columnHeader:focus': {
      outline: 'none',
    },
    '& .MuiDataGrid-columnHeader--moving': {
      backgroundColor: '#e3f2fd',
    },
    '& .MuiDataGrid-columnSeparator': {
      display: 'none',
    },
    '& .MuiDataGrid-toolbarContainer': {
      padding: '8px',
      borderBottom: '1px solid #e0e0e0',
    },
    '& .MuiDataGrid-footerContainer': {
      borderTop: '1px solid #e0e0e0',
      backgroundColor: '#f5f5f5',
    },
    '& .MuiDataGrid-selectedRowCount': {
      fontSize: '0.75rem',
    },
    '& .MuiDataGrid-overlay': {
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
    },
    '& .MuiDataGrid-loadingOverlay': {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
    },
    '& .MuiDataGrid-noRowsOverlay': {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
    },
    '& .MuiDataGrid-errorOverlay': {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
    },
    // Custom styling for different data types
    '& .MuiDataGrid-cell--number': {
      textAlign: 'right',
    },
    '& .MuiDataGrid-cell--date': {
      textAlign: 'center',
    },
    // Responsive design
    '@media (max-width: 768px)': {
      '& .MuiDataGrid-cell': {
        padding: '4px 8px',
        fontSize: '0.75rem',
      },
      '& .MuiDataGrid-columnHeader': {
        padding: '4px 8px',
        fontSize: '0.75rem',
      },
    },
  };
}

export function getGridContainerStyles(options: GridContainerStyleOptions = {}) {
  const {
    chatWidth = 0,
    isFullWidth = false,
    marginTop = 16,
    marginBottom = 16
  } = options;

  const width = isFullWidth ? '100%' : (chatWidth > 0 ? `calc(100% - ${chatWidth}px)` : '100%');

  return {
    width,
    marginTop,
    marginBottom,
    transition: 'width 0.3s ease',
    '& .MuiBox-root': {
      width: '100%',
    },
  };
}

export function createGridColumns(
  fields: string[],
  options: {
    editable?: boolean;
    width?: number;
    type?: 'string' | 'number' | 'date' | 'boolean';
    headerStyle?: object;
    cellStyle?: object;
    customColumns?: {[field: string]: Partial<GridColDef>};
  } = {}
): GridColDef[] {
  const {
    editable = false,
    width = 150,
    type = 'string',
    headerStyle = {},
    cellStyle = {},
    customColumns = {}
  } = options;

  return fields.map(field => ({
    field,
    headerName: field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1'),
    width,
    editable,
    type,
    headerAlign: 'left',
    align: 'left',
    sortable: true,
    filterable: true,
    ...headerStyle,
    ...cellStyle,
    ...customColumns[field],
  }));
}

export function getFilteredAndSortedData(
  data: ExcelRow[],
  searchTerm: string,
  sortModel: GridSortModel,
  columnFilters: {[field: string]: string} = {}
): ExcelRow[] {
  let result = filterRows(data, {
    searchTerm,
    columnFilters
  });
  
  result = sortRows(result, sortModel);
  
  return result;
}

export function getGridSelectionModel(
  data: ExcelRow[],
  selectedIds: number[]
): number[] {
  return selectedIds.filter(id => data.some(row => row.id === id));
}

export function getSelectedRows(
  data: ExcelRow[],
  selectionModel: number[]
): ExcelRow[] {
  return data.filter(row => selectionModel.includes(row.id));
}

export function exportGridData(
  data: ExcelRow[],
  columns: GridColDef[],
  options: {
    selectedOnly?: boolean;
    selectionModel?: number[];
    includeHiddenColumns?: boolean;
    customHeaders?: {[field: string]: string};
  } = {}
): {data: ExcelRow[], headers: string[]} {
  const {
    selectedOnly = false,
    selectionModel = [],
    includeHiddenColumns = false,
    customHeaders = {}
  } = options;

  const exportData = selectedOnly && selectionModel.length > 0 
    ? getSelectedRows(data, selectionModel)
    : data;

  const visibleColumns = includeHiddenColumns 
    ? columns 
    : columns.filter(col => !(col as { hide?: boolean }).hide);

  const headers = visibleColumns.map(col => 
    customHeaders[col.field] || col.headerName || col.field
  );

  return {
    data: exportData,
    headers
  };
}

export function getGridHeight(
  rowCount: number,
  options: {
    headerHeight?: number;
    rowHeight?: number;
    minHeight?: number;
    maxHeight?: number;
    showFooter?: boolean;
    footerHeight?: number;
  } = {}
): number {
  const {
    headerHeight = 56,
    rowHeight = 52,
    minHeight = 200,
    maxHeight = 600,
    showFooter = true,
    footerHeight = 52
  } = options;

  const calculatedHeight = headerHeight + (rowCount * rowHeight) + (showFooter ? footerHeight : 0);
  
  return Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
}

export function getGridInitialState(
  columns: GridColDef[],
  options: {
    defaultSort?: {field: string, sort: 'asc' | 'desc'};
    hiddenColumns?: string[];
    pinnedColumns?: {left?: string[], right?: string[]};
    pageSize?: number;
  } = {}
) {
  const {
    defaultSort,
    hiddenColumns = [],
    pinnedColumns = {},
    pageSize = 25
  } = options;

  return {
    sorting: {
      sortModel: defaultSort ? [defaultSort] : [],
    },
    columns: {
      columnVisibilityModel: hiddenColumns.reduce((acc, field) => {
        acc[field] = false;
        return acc;
      }, {} as {[field: string]: boolean}),
      pinnedColumns,
    },
    pagination: {
      paginationModel: {
        pageSize,
        page: 0,
      },
    },
  };
}

export function validateGridData(
  data: ExcelRow[],
  columns: GridColDef[]
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if data exists
  if (!data || data.length === 0) {
    warnings.push('No data to validate');
    return { isValid: true, errors, warnings };
  }

  // Check if columns exist
  if (!columns || columns.length === 0) {
    errors.push('No columns defined');
    return { isValid: false, errors, warnings };
  }

  // Check for missing required columns
  const requiredColumns = columns.filter(col => col.type === 'number' || col.field === 'id');
  requiredColumns.forEach(col => {
    const hasData = data.some(row => row[col.field] !== undefined && row[col.field] !== null);
    if (!hasData) {
      warnings.push(`Column '${col.field}' appears to be empty`);
    }
  });

  // Check for duplicate IDs
  const ids = data.map(row => row.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    errors.push('Duplicate IDs found in data');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function getGridQuickFilterProps(searchTerm: string) {
  return {
    quickFilterValues: searchTerm ? [searchTerm] : [],
    quickFilterParser: (searchInput: string) => 
      searchInput.split(',').map(value => value.trim()).filter(value => value !== ''),
    quickFilterMatcher: (quickFilterValues: string[], row: ExcelRow) => {
      return quickFilterValues.some(value => {
        return Object.values(row).some(cellValue => {
          if (cellValue === null || cellValue === undefined) return false;
          return String(cellValue).toLowerCase().includes(value.toLowerCase());
        });
      });
    },
  };
}

export const commonGridProps = {
  checkboxSelection: true,
  disableRowSelectionOnClick: false,
  density: 'compact' as const,
  pageSizeOptions: [10, 25, 50, 100],
  autoHeight: false,
  disableColumnMenu: false,
  disableColumnFilter: false,
  disableColumnSelector: false,
  disableDensitySelector: false,
  hideFooter: false,
  hideFooterPagination: false,
  hideFooterSelectedRowCount: false,
  showCellVerticalBorder: true,
  showColumnVerticalBorder: true,
  disableVirtualization: false,
  keepNonExistentRowsSelected: false,
  loading: false,
  getRowId: (row: ExcelRow) => row.id,
};

export const gridLocaleText = {
  // Toolbar
  toolbarColumns: 'Columns',
  toolbarFilters: 'Filters',
  toolbarDensity: 'Density',
  toolbarExport: 'Export',
  toolbarExportCSV: 'Download as CSV',
  toolbarExportPrint: 'Print',
  
  // Filters
  filterPanelOperator: 'Operator',
  filterPanelColumns: 'Columns',
  filterPanelInputLabel: 'Value',
  filterPanelInputPlaceholder: 'Filter value',
  
  // Density
  toolbarDensityLabel: 'Density',
  toolbarDensityCompact: 'Compact',
  toolbarDensityStandard: 'Standard',
  toolbarDensityComfortable: 'Comfortable',
  
  // Columns
  columnsPanelTextFieldLabel: 'Find column',
  columnsPanelTextFieldPlaceholder: 'Column title',
  columnsPanelDragIconLabel: 'Reorder column',
  columnsPanelShowAllButton: 'Show all',
  columnsPanelHideAllButton: 'Hide all',
  
  // Footer
  footerRowSelected: (count: number) => `${count} row(s) selected`,
  footerTotalRows: 'Total Rows:',
  footerTotalVisibleRows: (visibleCount: number, totalCount: number) =>
    `${visibleCount.toLocaleString()} of ${totalCount.toLocaleString()}`,
  
  // Pagination
  MuiTablePagination: {
    labelRowsPerPage: 'Rows per page:',
    labelDisplayedRows: ({ from, to, count }: { from: number; to: number; count: number }) => `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`,
  },
  
  // Selection
  checkboxSelectionHeaderName: 'Checkbox selection',
  checkboxSelectionSelectAllRows: 'Select all rows',
  checkboxSelectionUnselectAllRows: 'Unselect all rows',
  checkboxSelectionSelectRow: 'Select row',
  checkboxSelectionUnselectRow: 'Unselect row',
  
  // Sorting
  columnMenuSortAsc: 'Sort by ASC',
  columnMenuSortDesc: 'Sort by DESC',
  columnMenuUnsort: 'Unsort',
  
  // Column menu
  columnMenuLabel: 'Menu',
  columnMenuShowColumns: 'Show columns',
  columnMenuFilter: 'Filter',
  columnMenuHideColumn: 'Hide',
  
  // No rows
  noRowsLabel: 'No rows',
  noResultsOverlayLabel: 'No results found.',
  
  // Error overlay
  errorOverlayDefaultLabel: 'An error occurred.',
  
  // Loading overlay
  loadingOverlayLabel: 'Loading...',
};